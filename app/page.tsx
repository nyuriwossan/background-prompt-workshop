"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { enforceExclusions, getAdvice } from "./lib/advisor.ts";
import type { Advice } from "./lib/advisor.ts";
import { createDefaultState, optionById, optionsForGroup, presets, sceneData, simpleData } from "./lib/background-data.ts";
import type { BackgroundMode, BackgroundState, Option } from "./lib/background-data.ts";
import { generatePrompt, japaneseSummary } from "./lib/generator.ts";

const DRAFT_KEY = "background_prompt_workshop_draft_v1";
const SAVED_KEY = "background_prompt_workshop_saved_v1";
type SavedDesign = { id: string; name: string; savedAt: string; state: BackgroundState };

function clone<T>(value: T): T { return structuredClone(value); }
function getAtPath(source: unknown, path: string): unknown { return path.split(".").reduce((value: unknown, key) => (value as Record<string, unknown>)?.[key], source); }
function setAtPath<T>(source: T, path: string, value: unknown): T {
  const next = clone(source); const keys = path.split("."); let cursor = next as Record<string, unknown>;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key] as Record<string, unknown>; });
  cursor[keys.at(-1)!] = value; return next;
}

function Section({ number, title, description, summary, children, open = false }: { number: string; title: string; description: string; summary?: string; children: ReactNode; open?: boolean }) {
  return <details className="section-card" open={open}>
    <summary><span className="step-number">{number}</span><span className="section-heading"><strong>{title}</strong><small>{summary || description}</small></span><span className="chevron">⌄</span></summary>
    <div className="section-body"><p className="section-description">{description}</p>{children}</div>
  </details>;
}

function ChoiceGroup({ label, options, value, onChange, multi = false, max, optional = false, disabledIds = [] }: { label: string; options: Option[]; value: string | string[]; onChange: (id: string) => void; multi?: boolean; max?: number; optional?: boolean; disabledIds?: string[] }) {
  const selected = Array.isArray(value) ? value : [value];
  return <fieldset className="choice-group"><legend>{label}{multi && max ? <span>最大{max}つ</span> : optional ? <span>任意</span> : null}</legend><div className="chips">
    {options.map((item) => <button key={item.id} type="button" className={`chip ${selected.includes(item.id) ? "is-selected" : ""}`} aria-pressed={selected.includes(item.id)} disabled={disabledIds.includes(item.id)} onClick={() => onChange(item.id)}>{item.label}{selected.includes(item.id) && <span aria-hidden>✓</span>}</button>)}
  </div></fieldset>;
}

function AdviceCard({ advice, onApply }: { advice: Advice; onApply: (advice: Advice) => void }) {
  return <article className={`advice ${advice.kind}`}><span className="advice-icon" aria-hidden>{advice.kind === "warning" ? "!" : "+"}</span><div><strong>{advice.title}</strong><p>{advice.body}</p>{advice.patch && <button type="button" onClick={() => onApply(advice)}>{advice.actionLabel}</button>}</div></article>;
}

function Icon({ children }: { children: ReactNode }) { return <span className="button-icon" aria-hidden>{children}</span>; }

export default function Home() {
  const [state, setState] = useState<BackgroundState>(() => createDefaultState());
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [outputOpen, setOutputOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const draft = localStorage.getItem(DRAFT_KEY); if (draft) setState(enforceExclusions(JSON.parse(draft)));
      const stored = localStorage.getItem(SAVED_KEY); if (stored) setSaved(JSON.parse(stored));
    } catch { setToast("保存データの一部を読み込めませんでした"); }
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); }, [state, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); }, [saved, hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const prompt = useMemo(() => generatePrompt(state), [state]);
  const advice = useMemo(() => getAdvice(state), [state]);
  const modePresets = presets.filter((preset) => preset.mode === state.backgroundMode);
  const scene = state.scene; const simple = state.simple;
  const categories = optionsForGroup(sceneData.categories, scene.place.environmentType);
  const stages = optionsForGroup(sceneData.stages, scene.place.category);

  const update = (path: string, value: unknown) => setState((current) => enforceExclusions(setAtPath(current, path, value)));
  const toggle = (path: string, id: string, max?: number) => setState((current) => {
    const list = (getAtPath(current, path) as string[]) || [];
    const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id].slice(max ? -max : 0);
    return enforceExclusions(setAtPath(current, path, next));
  });
  const changeEnvironmentType = (id: string) => setState((current) => {
    const category = optionsForGroup(sceneData.categories, id)[0].id;
    const stage = optionsForGroup(sceneData.stages, category)[0].id;
    let next = setAtPath(current, "scene.place.environmentType", id);
    next = setAtPath(next, "scene.place.category", category); next = setAtPath(next, "scene.place.mainStage", stage); return next;
  });
  const changeCategory = (id: string) => setState((current) => setAtPath(setAtPath(current, "scene.place.category", id), "scene.place.mainStage", optionsForGroup(sceneData.stages, id)[0].id));
  const changeMode = (mode: BackgroundMode) => setState((current) => ({ ...current, backgroundMode: mode }));
  const applyAdvice = (item: Advice) => {
    if (!item.patch) return; item.patch.multi ? toggle(item.patch.path, item.patch.value) : update(item.patch.path, item.patch.value); setToast("提案を反映しました");
  };
  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId); if (!preset) return;
    setState((current) => enforceExclusions({ ...current, ...clone(preset.patch), backgroundMode: preset.mode } as BackgroundState)); setToast(`「${preset.label}」を読み込みました`);
  };
  const copyPrompt = async () => {
    try { await navigator.clipboard.writeText(prompt); setToast("プロンプトをコピーしました"); }
    catch { const area = document.createElement("textarea"); area.value = prompt; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); setToast("プロンプトをコピーしました"); }
  };
  const reset = () => { if (window.confirm("現在の設定を初期状態に戻しますか？")) { setState(createDefaultState()); setToast("初期状態に戻しました"); } };
  const saveDesign = () => {
    const name = saveName.trim() || japaneseSummary(state) || "名称未設定";
    const item: SavedDesign = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), state: clone(state) };
    setSaved((items) => [item, ...items]); setSaveName(""); setSaveOpen(false); setToast("端末に保存しました");
  };
  const exportJson = (all = false) => {
    const value = all ? { version: 1, type: "background-workshop-library", saved } : { version: 1, type: "background-workshop-design", state };
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = all ? "background-workshop-backup.json" : "background-design.json"; link.click(); URL.revokeObjectURL(url); setToast("JSONを書き出しました");
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const value = JSON.parse(await file.text());
      if (value.version !== 1) throw new Error("version");
      if (value.type === "background-workshop-library" && Array.isArray(value.saved)) setSaved(value.saved);
      else if (value.state?.version === 1) setState(enforceExclusions(value.state));
      else throw new Error("schema");
      setToast("JSONを読み込みました");
    } catch { setToast("対応していないJSONです"); }
    event.target.value = "";
  };

  return <div className={`app ${state.backgroundMode}`}>
    <header className="topbar"><div className="topbar-inner">
      <div className="brand"><span className="brand-mark" aria-hidden>景</span><div><strong>背景プロンプト工房</strong><small>Background Prompt Workshop</small></div></div>
      <div className="header-actions"><span className="draft-status"><i /> 自動保存</span><button type="button" className="icon-button" aria-label="保存した設計" onClick={() => setLibraryOpen(true)}>▤</button><button type="button" className="icon-button" aria-label="JSONを書き出す" onClick={() => exportJson(false)}>⇩</button></div>
    </div></header>

    <main className="shell">
      <section className="intro"><div><span className="eyebrow">SCENE DESIGN TOOL</span><h1>背景を、ひとつの場面として設計する。</h1><p>場所・光・空気・奥行きを日本語で選ぶと、意味の通る英語プロンプトへ組み立てます。</p></div><div className="mode-switch" role="group" aria-label="背景形式"><button type="button" className={state.backgroundMode === "scene" ? "active" : ""} onClick={() => changeMode("scene")}><span>⌂</span><strong>空間背景</strong><small>場所・光・奥行きを設計</small></button><button type="button" className={state.backgroundMode === "simple" ? "active" : ""} onClick={() => changeMode("simple")}><span>◐</span><strong>シンプル背景</strong><small>色・質感・装飾を整える</small></button></div></section>

      <section className="preset-strip"><div className="preset-heading"><div><span>QUICK START</span><strong>プリセットから始める</strong></div><small>選んだあとで自由に調整できます</small></div><div className="preset-list">{modePresets.map((preset) => <button type="button" key={preset.id} onClick={() => applyPreset(preset.id)}><span className="preset-orb" /><strong>{preset.label}</strong><small>{preset.description}</small><b>→</b></button>)}</div></section>

      <div className="workspace-grid"><section className="builder-column" aria-label="背景設定">
        <div className="column-title"><div><span className="tiny-label">DESIGN</span><h2>{state.backgroundMode === "scene" ? "空間背景を組み立てる" : "背景面を整える"}</h2></div><button type="button" className="text-button" onClick={reset}>↻ リセット</button></div>
        {state.backgroundMode === "scene" ? <>
          <Section number="01" title="生成目的" description="まず、人物と背景のどちらを主役にするか決めます。" summary={`${optionById(sceneData.relations, scene.subjectRelation)?.label}・${state.outputStyle === "short" ? "短縮版" : "詳細版"}`} open>
            <ChoiceGroup label="背景と人物の比重" options={sceneData.relations} value={scene.subjectRelation} onChange={(id) => update("scene.subjectRelation", id)} />
            <ChoiceGroup label="出力の詳しさ" options={[{ id: "short", label: "短縮版", en: "" }, { id: "detailed", label: "詳細版", en: "" }]} value={state.outputStyle} onChange={(id) => update("outputStyle", id)} />
          </Section>
          <Section number="02" title="メイン舞台" description="場所の骨格と世界観を決めます。選択に応じて候補が絞られます。" summary={`${optionById(sceneData.stages, scene.place.mainStage)?.label}・${optionById(sceneData.worlds, scene.world.worldType)?.label}`} open>
            <ChoiceGroup label="空間タイプ" options={sceneData.environmentTypes} value={scene.place.environmentType} onChange={changeEnvironmentType} />
            <ChoiceGroup label="場所カテゴリ" options={categories} value={scene.place.category} onChange={changeCategory} />
            <ChoiceGroup label="メイン舞台" options={stages} value={scene.place.mainStage} onChange={(id) => update("scene.place.mainStage", id)} />
            <ChoiceGroup label="舞台の状態" options={sceneData.stageStates} value={scene.place.stageState} multi max={2} onChange={(id) => toggle("scene.place.stageState", id, 2)} />
            <div className="choice-split"><ChoiceGroup label="世界観" options={sceneData.worlds} value={scene.world.worldType} onChange={(id) => update("scene.world.worldType", id)} /><ChoiceGroup label="時代" options={sceneData.eras} value={scene.world.era} onChange={(id) => update("scene.world.era", id)} /></div>
            <ChoiceGroup label="建築様式" options={sceneData.architecture} value={scene.world.architectureStyle} multi max={2} optional onChange={(id) => toggle("scene.world.architectureStyle", id, 2)} />
          </Section>
          <Section number="03" title="舞台を構成するもの" description="大・中・小の役割を分けると、要素を盛っても場面が散らかりません。" summary={`主役 ${scene.structures.landmark === "none" ? "なし" : "1"}・補助 ${scene.structures.secondary.length}・アクセント ${scene.structures.accents.length}`}>
            <ChoiceGroup label="主役構造物" options={sceneData.landmarks} value={scene.structures.landmark} onChange={(id) => update("scene.structures.landmark", id)} />
            <ChoiceGroup label="補助構成物" options={sceneData.secondary} value={scene.structures.secondary} multi max={3} onChange={(id) => toggle("scene.structures.secondary", id, 3)} />
            <ChoiceGroup label="装飾・環境アクセント" options={sceneData.accents} value={scene.structures.accents} multi max={3} onChange={(id) => toggle("scene.structures.accents", id, 3)} />
          </Section>
          <Section number="04" title="環境" description="時間・季節・天候を揃え、空気の動きを加えます。" summary={`${optionById(sceneData.times, scene.environment.timeOfDay)?.label}・${optionById(sceneData.seasons, scene.environment.season)?.label}・${optionById(sceneData.weather, scene.environment.weather)?.label}`}>
            <ChoiceGroup label="時間帯" options={sceneData.times} value={scene.environment.timeOfDay} onChange={(id) => update("scene.environment.timeOfDay", id)} />
            <div className="choice-split"><ChoiceGroup label="季節" options={sceneData.seasons} value={scene.environment.season} onChange={(id) => update("scene.environment.season", id)} disabledIds={scene.environment.weather === "snow" && scene.world.worldType !== "fantasy" ? ["summer"] : []} /><ChoiceGroup label="天候" options={sceneData.weather} value={scene.environment.weather} onChange={(id) => update("scene.environment.weather", id)} /></div>
            <ChoiceGroup label="環境現象" options={sceneData.phenomena} value={scene.environment.phenomena} multi max={2} optional onChange={(id) => toggle("scene.environment.phenomena", id, 2)} />
          </Section>
          <Section number="05" title="光・色・空気" description="光の理由と色の方向を決め、場面の感情を整えます。" summary={`${optionById(sceneData.primaryLights, scene.lighting.primarySource)?.label}・${optionById(sceneData.tones, scene.atmosphere.colorTone)?.label}`}>
            <ChoiceGroup label="主光源" options={sceneData.primaryLights} value={scene.lighting.primarySource} onChange={(id) => update("scene.lighting.primarySource", id)} disabledIds={scene.environment.timeOfDay === "night" ? ["direct_sunlight"] : []} />
            <ChoiceGroup label="補助光源" options={sceneData.secondaryLights} value={scene.lighting.secondarySource} onChange={(id) => update("scene.lighting.secondarySource", id)} />
            <div className="choice-split"><ChoiceGroup label="光の方向" options={sceneData.directions} value={scene.lighting.direction} onChange={(id) => update("scene.lighting.direction", id)} /><ChoiceGroup label="光の質" options={sceneData.qualities} value={scene.lighting.quality} onChange={(id) => update("scene.lighting.quality", id)} /></div>
            <ChoiceGroup label="色調" options={sceneData.tones} value={scene.atmosphere.colorTone} onChange={(id) => update("scene.atmosphere.colorTone", id)} />
            <ChoiceGroup label="コントラスト" options={sceneData.contrasts} value={scene.atmosphere.contrast} onChange={(id) => update("scene.atmosphere.contrast", id)} />
            <ChoiceGroup label="空気感" options={sceneData.moods} value={scene.atmosphere.mood} multi max={3} onChange={(id) => toggle("scene.atmosphere.mood", id, 3)} />
          </Section>
          <Section number="06" title="空間演出" description="視点・奥行き・密度を、人物との関係に合わせて仕上げます。" summary={`${optionById(sceneData.depth, scene.composition.depthLayers)?.label}・${optionById(sceneData.densities, scene.composition.density)?.label}`}>
            <ChoiceGroup label="視点" options={sceneData.perspectives} value={scene.composition.perspective} onChange={(id) => update("scene.composition.perspective", id)} />
            <ChoiceGroup label="奥行き" options={sceneData.depth} value={scene.composition.depthLayers} onChange={(id) => update("scene.composition.depthLayers", id)} />
            <ChoiceGroup label="背景密度" options={sceneData.densities} value={scene.composition.density} onChange={(id) => update("scene.composition.density", id)} />
            <ChoiceGroup label="人物との馴染ませ方" options={sceneData.blends} value={scene.composition.blend} onChange={(id) => update("scene.composition.blend", id)} />
            <ChoiceGroup label="幻想演出" options={sceneData.fantasies} value={scene.composition.fantasyEffects} multi max={2} optional onChange={(id) => toggle("scene.composition.fantasyEffects", id, 2)} />
          </Section>
        </> : <>
          <Section number="01" title="基本設定" description="背景が人物をどう支えるかと、出力形式を決めます。" summary={`${optionById(simpleData.relations, simple.subjectRelation)?.label}・${state.outputStyle === "short" ? "短縮版" : "詳細版"}`} open>
            <ChoiceGroup label="人物との関係" options={simpleData.relations} value={simple.subjectRelation} onChange={(id) => update("simple.subjectRelation", id)} />
            <ChoiceGroup label="出力の詳しさ" options={[{ id: "short", label: "短縮版", en: "" }, { id: "detailed", label: "詳細版", en: "" }]} value={state.outputStyle} onChange={(id) => update("outputStyle", id)} />
          </Section>
          <Section number="02" title="スタイル" description="背景面の性格を3つの系統から選びます。" summary={optionById(simpleData.styles, simple.style)?.label} open><ChoiceGroup label="スタイル" options={simpleData.styles} value={simple.style} onChange={(id) => update("simple.style", id)} /></Section>
          <Section number="03" title="背景タイプ" description="単色・グラデーション・抽象・スタジオから土台を選びます。" summary={optionById(simpleData.types, simple.backgroundType)?.label}><ChoiceGroup label="背景タイプ" options={simpleData.types} value={simple.backgroundType} onChange={(id) => update("simple.backgroundType", id)} /></Section>
          <Section number="04" title="色" description="主色と任意の副色、明るさを決めます。" summary={`${optionById(simpleData.colors, simple.colors.primary)?.label}・${optionById(simpleData.intensities, simple.colors.intensity)?.label}`}>
            <ChoiceGroup label="メインカラー" options={simpleData.colors} value={simple.colors.primary} onChange={(id) => update("simple.colors.primary", id)} />
            <ChoiceGroup label="サブカラー" options={[{ id: "", label: "なし", en: "" }, ...simpleData.colors]} value={simple.colors.secondary} onChange={(id) => update("simple.colors.secondary", id)} optional />
            <ChoiceGroup label="明るさ・濃さ" options={simpleData.intensities} value={simple.colors.intensity} onChange={(id) => update("simple.colors.intensity", id)} />
          </Section>
          <Section number="05" title="質感・出方" description="グラデーション・発光・ぼかしを軽く重ねます。" summary={`${simple.rendering.length}項目を選択`}><ChoiceGroup label="質感・出方" options={simpleData.renderings} value={simple.rendering} multi max={3} onChange={(id) => toggle("simple.rendering", id, 3)} /></Section>
          <Section number="06" title="装飾" description="装飾は人物を邪魔しない軽いモチーフに限定します。" summary={simple.decoration.enabled ? `${simple.decoration.motifs.length}種類` : "装飾なし"}>
            <ChoiceGroup label="装飾の有無" options={[{ id: "off", label: "なし", en: "" }, { id: "on", label: "軽く入れる", en: "" }]} value={simple.decoration.enabled ? "on" : "off"} onChange={(id) => update("simple.decoration.enabled", id === "on")} />
            {simple.decoration.enabled && <ChoiceGroup label="装飾モチーフ" options={simpleData.motifs} value={simple.decoration.motifs} multi max={3} onChange={(id) => toggle("simple.decoration.motifs", id, 3)} />}
          </Section>
        </>}
      </section>

      <aside className="output-column" aria-label="生成結果"><div className="output-card">
        <div className="output-head"><div><span className="live-dot" />LIVE OUTPUT</div><span>{prompt.length} chars</span></div>
        <h2>背景プロンプト</h2><p className="jp-summary">{japaneseSummary(state)}</p>
        <div className="output-tabs"><button type="button" className={state.outputStyle === "short" ? "active" : ""} onClick={() => update("outputStyle", "short")}>短縮版<small>Workspace向け</small></button><button type="button" className={state.outputStyle === "detailed" ? "active" : ""} onClick={() => update("outputStyle", "detailed")}>詳細版<small>背景単体向け</small></button></div>
        <div className="prompt-box"><p>{prompt}</p><button type="button" aria-label="プロンプトをコピー" onClick={copyPrompt}>□</button></div>
        <button type="button" className="primary-button" onClick={copyPrompt}><Icon>⧉</Icon>プロンプトをコピー</button>
        <div className="compatibility"><span>✓</span><div><strong>Workspace互換</strong><small>{state.outputStyle === "short" ? "カンマ区切りでそのまま貼り付けできます" : "短縮版へ切り替えると貼り付けやすくなります"}</small></div></div>
        <div className="advice-area"><div className="advice-heading"><strong>設計アドバイス</strong><span>{advice.length || "✓"}</span></div>{advice.length ? advice.slice(0, 4).map((item) => <AdviceCard key={item.id} advice={item} onApply={applyAdvice} />) : <div className="all-good"><span>✓</span><p><strong>きれいにまとまっています</strong><small>大きな矛盾はありません</small></p></div>}</div>
        <div className="output-secondary"><button type="button" onClick={() => setSaveOpen(true)}><Icon>◇</Icon>この設計を保存</button><button type="button" onClick={() => exportJson(false)}><Icon>⇩</Icon>JSON</button></div>
      </div></aside></div>
    </main>

    <nav className="mobile-dock" aria-label="操作"><button type="button" onClick={() => setOutputOpen(true)}><Icon>↑</Icon>出力を見る</button><button type="button" className="dock-primary" onClick={copyPrompt}><Icon>⧉</Icon>コピー</button><button type="button" onClick={() => setSaveOpen(true)}><Icon>◇</Icon>保存</button></nav>

    {(saveOpen || libraryOpen || outputOpen) && <div className="modal-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSaveOpen(false); setLibraryOpen(false); setOutputOpen(false); } }}>
      {saveOpen && <section className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title"><button className="modal-close" onClick={() => setSaveOpen(false)} aria-label="閉じる">×</button><span className="modal-kicker">SAVE DESIGN</span><h2 id="save-title">この背景設計を保存</h2><p>英語文ではなく、編集できる設計状態を端末に保存します。</p><label>保存名<input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={japaneseSummary(state)} /></label><button className="primary-button" type="button" onClick={saveDesign}>保存する</button></section>}
      {libraryOpen && <section className="modal library-modal" role="dialog" aria-modal="true" aria-labelledby="library-title"><button className="modal-close" onClick={() => setLibraryOpen(false)} aria-label="閉じる">×</button><span className="modal-kicker">MY LIBRARY</span><h2 id="library-title">保存した背景設計</h2><div className="library-tools"><button onClick={() => exportJson(true)}>全部を書き出す</button><button onClick={() => importRef.current?.click()}>JSONを読み込む</button></div><div className="saved-list">{saved.length ? saved.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleString("ja-JP")}</small></div><button onClick={() => { setState(clone(item.state)); setLibraryOpen(false); setToast("保存した設計を開きました"); }}>開く</button><button className="danger" onClick={() => setSaved((items) => items.filter((savedItem) => savedItem.id !== item.id))}>削除</button></article>) : <p className="empty-state">まだ保存した設計はありません。</p>}</div></section>}
      {outputOpen && <section className="modal mobile-output-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setOutputOpen(false)} aria-label="閉じる">×</button><span className="modal-kicker">LIVE OUTPUT</span><h2>背景プロンプト</h2><p className="jp-summary">{japaneseSummary(state)}</p><div className="prompt-box"><p>{prompt}</p></div><button type="button" className="primary-button" onClick={copyPrompt}>プロンプトをコピー</button></section>}
    </div>}
    <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
    {toast && <div className="toast" role="status">✓ {toast}</div>}
  </div>;
}
