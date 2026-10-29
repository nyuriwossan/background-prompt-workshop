"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ViewDiagram } from "./components/view-diagram.tsx";
import { enforceExclusions, getAdvice } from "./lib/advisor.ts";
import type { Advice } from "./lib/advisor.ts";
import { basicMotifIds, createDefaultState, optionById, optionsForGroup, presetGroups, presets, sceneData, simpleData } from "./lib/background-data.ts";
import type { BackgroundMode, BackgroundState, Option, PresetGroup } from "./lib/background-data.ts";
import { generateOutput, japaneseSummary, negativeItemAvailability, negativeOptions, negativeSupport } from "./lib/generator.ts";
import { clearActiveMode, clearConfirmationMessage, defaultsConfirmationMessage, exportDesign, exportLibrary, mergeSavedLists, migrateSavedList, migrateState, parseImportedJson, resetActiveMode } from "./lib/state-utils.ts";
import type { SavedDesign } from "./lib/state-utils.ts";
import { dynamicMotions, motionProfiles, viewData, viewFromRecipe, viewRecipes } from "./lib/view-data.ts";
import { getViewAvailability, stageProfile, viewSummary } from "./lib/view-rules.ts";
import { designProfiles, eventById, eventGroups, eventMotifIds, eventThemes, motifFamilies, profileById, seasonalMotifById, seasonalMotifs } from "./lib/seasonal-data.ts";

// 保存キーは v1 から変えない（既存の保存を見失わないため）。中身は読み込み時に v2 へ移行する
const DRAFT_KEY = "background_prompt_workshop_draft_v1";
const SAVED_KEY = "background_prompt_workshop_saved_v1";
const BACKUP_KEY = "background_prompt_workshop_backup_before_v2";

type ChoiceItem = { id: string; label: string };

function clone<T>(value: T): T { return structuredClone(value); }
function getAtPath(source: unknown, path: string): unknown { return path.split(".").reduce((value: unknown, key) => (value as Record<string, unknown>)?.[key], source); }
function setAtPath<T>(source: T, path: string, value: unknown): T {
  const next = clone(source); const keys = path.split("."); let cursor = next as Record<string, unknown>;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key] as Record<string, unknown>; });
  cursor[keys.at(-1)!] = value; return next;
}
const labelOf = (list: ChoiceItem[], id: string) => list.find((item) => item.id === id)?.label || "";
const labelsOf = (list: ChoiceItem[], ids: string[]) => ids.map((id) => labelOf(list, id)).filter(Boolean);
const shown = (value: string) => (value && value !== "指定しない" ? value : "");
const joinJa = (items: string[]) => items.filter(Boolean).join("・");

/** カタカナをひらがなに寄せ、大文字小文字を無視して検索する */
const normalize = (value: string) => value.toLowerCase().replace(/[ァ-ヶ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60)).replace(/\s+/g, "");
const matches = (item: Option, query: string) => {
  const q = normalize(query);
  return !q || normalize(`${item.label}${item.kw || ""}${item.en}`).includes(q);
};

/** テイストの色見本（画面表示だけに使う。出力には関係しない） */
const SWATCH: Record<string, string> = { white: "#ffffff", warm_gray: "#b9b2a8", pastel_pink: "#f6c6d6", lavender: "#cdbdf2", mint: "#bfe8d6", powder_blue: "#b9d3ea", cream: "#f4ead2", peach: "#f7c8a8", deep_navy: "#1d2a4a", black: "#141414", sage: "#b5c7a8", burgundy: "#7a2238", gold: "#d8b96a" };

/* ------------------------------------------------------------------ */
/* 小さな部品                                                         */
/* ------------------------------------------------------------------ */

function Section({ title, summary, children, open = false, tone }: { title: string; summary?: string; children: ReactNode; open?: boolean; tone?: string }) {
  return <details className={`section-card ${tone || ""}`} open={open}>
    <summary><span className="section-heading"><strong>{title}</strong><small>{summary || "未設定（出力に入りません）"}</small></span><span className="chevron" aria-hidden>⌄</span></summary>
    <div className="section-body">{children}</div>
  </details>;
}

function ChoiceGroup({ label, options, value, onChange, multi = false, max, optional = false, disabled = {}, note }: {
  label: string; options: ChoiceItem[]; value: string | string[]; onChange: (id: string) => void;
  multi?: boolean; max?: number; optional?: boolean; disabled?: Record<string, string>; note?: string;
}) {
  const selected = Array.isArray(value) ? value : [value];
  // 非活性の理由は、同じ理由ごとにまとめて下に出す（スマホでもホバーなしで読める）
  const reasons = new Map<string, string[]>();
  for (const item of options) if (disabled[item.id]) reasons.set(disabled[item.id], [...(reasons.get(disabled[item.id]) || []), item.label]);
  return <fieldset className="choice-group"><legend>{label}{multi && max ? <span>{max}つまで</span> : optional ? <span>任意</span> : null}</legend>
    {note && <p className="choice-note">{note}</p>}
    <div className="chips">
      {options.map((item) => {
        const isSelected = selected.includes(item.id);
        const isDisabled = Boolean(disabled[item.id]);
        return <button key={item.id || "unset"} type="button" className={`chip ${isSelected ? "is-selected" : ""} ${item.id === "" ? "is-unset" : ""} ${isDisabled && isSelected ? "is-stale" : ""}`} aria-pressed={isSelected} disabled={isDisabled && !isSelected} title={disabled[item.id] || undefined} onClick={() => onChange(item.id)}>{item.label}{isSelected && <span aria-hidden>✓</span>}</button>;
      })}
    </div>
    {[...reasons].map(([reason, names]) => <p key={reason} className="disabled-reason"><b>{names.join("・")}</b>：{reason}</p>)}
  </fieldset>;
}

function AdviceCard({ advice, onApply }: { advice: Advice; onApply: (advice: Advice) => void }) {
  return <article className={`advice ${advice.kind}`}><span className="advice-icon" aria-hidden>{advice.kind === "warning" ? "!" : "+"}</span><div><strong>{advice.title}</strong><p>{advice.body}</p>{advice.patch && <button type="button" onClick={() => onApply(advice)}>{advice.actionLabel}</button>}</div></article>;
}

function Step({ index, title, summary, children, id }: { index: number; title: string; summary?: string; children: ReactNode; id?: string }) {
  return <section className="step" id={id} aria-labelledby={`step-${index}`}>
    <header className="step-head"><span className="step-index" aria-hidden>{index}</span><div><h2 id={`step-${index}`}>{title}</h2>{summary && <p>{summary}</p>}</div></header>
    {children}
  </section>;
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: ReactNode }) {
  return <label className="toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden /><span>{children}</span></label>;
}

/* ------------------------------------------------------------------ */
/* 本体                                                               */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [state, setState] = useState<BackgroundState>(() => createDefaultState());
  const [saved, setSaved] = useState<SavedDesign[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [presetGroup, setPresetGroup] = useState<PresetGroup>("recommended");
  const [placeQuery, setPlaceQuery] = useState("");
  const [structureQuery, setStructureQuery] = useState("");
  const [showAllStructures, setShowAllStructures] = useState(false);
  const [showAllMotifs, setShowAllMotifs] = useState(false);
  /** リセット時に設定欄を作り直し、折りたたみ・入力中の検索語などの一時的な表示状態も初期化する */
  const [builderKey, setBuilderKey] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let message = "";
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      const stored = localStorage.getItem(SAVED_KEY);
      // v2 へ移る前のデータは、初回だけ手を加えずに控えを残す
      if ((draft || stored) && !localStorage.getItem(BACKUP_KEY)) {
        const parsedDraft = draft ? JSON.parse(draft) : null;
        if (!parsedDraft || parsedDraft.version !== 2) localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), draft, saved: stored }));
      }
      // 端末内の保存はマウント後にしか読めない（サーバー描画と一致させるため）ので、ここで反映する
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (draft) setState(enforceExclusions(migrateState(JSON.parse(draft))));
      if (stored) setSaved(migrateSavedList(JSON.parse(stored)));
    } catch { message = "保存データの一部を読み込めませんでした"; }
    if (message) setToast(message);
    setHydrated(true);
  }, []);
  useEffect(() => { if (hydrated) try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state)); } catch { /* 容量不足などは無視して続ける */ } }, [state, hydrated]);
  useEffect(() => { if (hydrated) try { localStorage.setItem(SAVED_KEY, JSON.stringify(saved)); } catch { /* 同上 */ } }, [saved, hydrated]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 2600); return () => window.clearTimeout(timer); }, [toast]);

  const result = useMemo(() => generateOutput(state), [state]);
  const advice = useMemo(() => getAdvice(state), [state]);
  const availability = useMemo(() => getViewAvailability(state), [state]);
  const negativeInfo = negativeSupport(state);
  const negativeDisabled = negativeItemAvailability(state);
  const modePresetGroups = presetGroups[state.backgroundMode];
  const modePresets = presets.filter((preset) => preset.mode === state.backgroundMode && preset.group === presetGroup);
  const scene = state.scene; const simple = state.simple; const view = scene.view; const target = state.target;
  const categories = optionsForGroup(sceneData.categories, scene.place.environmentType);
  const stages = optionsForGroup(sceneData.stages, scene.place.category);
  const stageLabel = labelOf(sceneData.stages, scene.place.mainStage);
  const profile = stageProfile(state);

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
  const selectStage = (id: string) => setState((current) => {
    const stage = optionById(sceneData.stages, id); const category = optionById(sceneData.categories, stage?.group || "");
    if (!stage || !category) return current;
    let next = setAtPath(current, "scene.place.environmentType", category.group);
    next = setAtPath(next, "scene.place.category", category.id);
    return setAtPath(next, "scene.place.mainStage", id);
  });
  const changeMode = (mode: BackgroundMode) => {
    setState((current) => ({ ...current, backgroundMode: mode }));
    setPresetGroup("recommended");
  };
  const applyAdvice = (item: Advice) => {
    if (!item.patch) return; if (item.patch.multi) toggle(item.patch.path, String(item.patch.value)); else update(item.patch.path, item.patch.value); setToast("提案を反映しました");
  };
  const applyPreset = (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId); if (!preset) return;
    // 生成先の設定はプリセットで変えない
    setState((current) => enforceExclusions(migrateState({ ...current, ...clone(preset.patch), backgroundMode: preset.mode, target: current.target })));
    setToast(`「${preset.label}」を読み込みました`);
  };
  /** 季節・イベントを選ぶ。おすすめのモチーフ（1〜2種類）・人物を邪魔しない置き場所・まばらを入れる。色やテイストは変えない */
  const selectEvent = (id: string, force = false) => {
    const event = eventById(id);
    if (!event) { update("simple.eventTheme", ""); return; }
    if (!force && state.simple.eventTheme === id) return;
    setState((current) => ({ ...current, simple: { ...current.simple, eventTheme: id, decoration: { enabled: true, motifs: [...event.starter], placement: event.placement, density: "sparse" } } }));
    setShowAllMotifs(false);
    setToast(`「${event.label}」のおすすめ装飾を入れました`);
  };
  /** テイストを選ぶ。色・背景タイプ・質感だけを変え、装飾とイベントはそのまま */
  const selectProfile = (id: string) => {
    const profile = profileById(id);
    if (!profile) { update("simple.designProfile", ""); return; }
    setState((current) => enforceExclusions({ ...current, simple: { ...current.simple, ...clone(profile.patch), pattern: profile.patch.pattern || "", texture: profile.patch.texture || "", designProfile: id } }));
    setToast(`「${profile.label}」の色と質感にしました`);
  };
  const applyRecipe = (id: string) => {
    const next = viewFromRecipe(id); if (!next) return;
    setState((current) => ({ ...current, scene: { ...current.scene, view: next } }));
  };
  const copy = async (text: string, message: string) => {
    try { await navigator.clipboard.writeText(text); }
    catch { const area = document.createElement("textarea"); area.value = text; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove(); }
    setToast(message);
  };
  const copyPrompt = () => copy(result.positive, "プロンプトをコピーしました");
  const clearTransientUi = () => {
    setPlaceQuery(""); setStructureQuery(""); setShowAllStructures(false); setShowAllMotifs(false); setBuilderKey((key) => key + 1);
  };
  const resetToDefaults = () => {
    if (!window.confirm(defaultsConfirmationMessage(state.backgroundMode))) return;
    setState((current) => resetActiveMode(current));
    clearTransientUi();
    setToast("初期設定に戻しました");
  };
  const clearSelections = () => {
    if (!window.confirm(clearConfirmationMessage(state.backgroundMode))) return;
    setState((current) => clearActiveMode(current));
    clearTransientUi();
    setToast("選択をクリアしました");
  };
  const saveDesign = () => {
    const name = saveName.trim() || japaneseSummary(state) || "名称未設定";
    const item: SavedDesign = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), state: clone(state) };
    setSaved((items) => [item, ...items]); setSaveName(""); setSaveOpen(false); setToast("端末に保存しました");
  };
  const exportJson = (all = false) => {
    const value = all ? exportLibrary(saved) : exportDesign(state);
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = all ? "background-workshop-backup.json" : "background-design.json"; link.click(); URL.revokeObjectURL(url); setToast("JSONを書き出しました");
  };
  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const imported = parseImportedJson(JSON.parse(await file.text()));
      if (imported.kind === "library") {
        const merged = mergeSavedLists(saved, imported.saved, () => crypto.randomUUID());
        setSaved(merged.saved); setToast(merged.added ? `${merged.added}件を保存一覧に追加しました` : "すべて保存済みの設計でした");
      } else {
        setState(enforceExclusions(imported.state)); setPresetGroup("recommended"); setToast("JSONの設計を開きました");
      }
    } catch { setToast("読み込めないJSONです。書き出したファイルか確認してください"); }
    event.target.value = "";
  };
  const goToOutput = () => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ---- 構成物：この場所に合うものを先に、必要ならすべて ----
  const stageOption = optionById(sceneData.stages, scene.place.mainStage);
  const stageGenres = stageOption?.genres || profile.category?.genres || [];
  const relevant = (list: Option[], selected: string[]) => {
    if (structureQuery) return list.filter((item) => item.id === "none" || selected.includes(item.id) || matches(item, structureQuery));
    if (showAllStructures || !stageGenres.length) return list;
    return list.filter((item) => item.id === "none" || selected.includes(item.id) || (item.genres || []).some((genre) => stageGenres.includes(genre)));
  };
  const hiddenCount = [sceneData.landmarks, sceneData.secondary, sceneData.accents, sceneData.creatures].reduce((sum, list) => sum + list.length, 0)
    - [relevant(sceneData.landmarks, [scene.structures.landmark]), relevant(sceneData.secondary, scene.structures.secondary), relevant(sceneData.accents, scene.structures.accents), relevant(sceneData.creatures, scene.structures.creatures)].reduce((sum, list) => sum + list.length, 0);
  const placeResults = placeQuery ? sceneData.stages.filter((item) => matches(item, placeQuery)).slice(0, 16) : [];

  // ---- 見出しの要約 ----
  const placeSummary = joinJa([stageLabel, ...labelsOf(sceneData.stageStates, scene.place.stageState)]);
  const worldSummary = joinJa([shown(labelOf(sceneData.worlds, scene.world.worldType)), shown(labelOf(sceneData.eras, scene.world.era)), ...labelsOf(sceneData.architecture, scene.world.architectureStyle)]);
  const structureSummary = joinJa([scene.structures.landmark !== "none" ? labelOf(sceneData.landmarks, scene.structures.landmark) : "", ...labelsOf(sceneData.secondary, scene.structures.secondary), ...labelsOf(sceneData.accents, scene.structures.accents), ...labelsOf(sceneData.creatures, scene.structures.creatures)]);
  const environmentSummary = joinJa([shown(labelOf(sceneData.times, scene.environment.timeOfDay)), shown(labelOf(sceneData.seasons, scene.environment.season)), shown(labelOf(sceneData.weather, scene.environment.weather)), ...labelsOf(sceneData.phenomena, scene.environment.phenomena)]);
  const lightSummary = joinJa([shown(labelOf(sceneData.primaryLights, scene.lighting.primarySource)), scene.lighting.secondarySource !== "none" ? labelOf(sceneData.secondaryLights, scene.lighting.secondarySource) : "", shown(labelOf(sceneData.tones, scene.atmosphere.colorTone)), ...labelsOf(sceneData.moods, scene.atmosphere.mood)]);
  const spaceSummary = joinJa([shown(labelOf(sceneData.depth, scene.composition.depthLayers)), shown(labelOf(sceneData.densities, scene.composition.density)), shown(labelOf(sceneData.blends, scene.composition.blend)), ...labelsOf(sceneData.fantasies, scene.composition.fantasyEffects)]);
  const targetLabel = target.platform === "generic" ? "汎用" : target.platform === "novelai" ? "NovelAI" : target.pixaiModel === "tsubaki" ? "PIXAI・Tsubaki系" : "PIXAI・タグ系";
  // 舞台と同じ名前の対象（港町を選んだときの「港町」など）は重複するので隠す
  const viewTargets = viewData.viewTargets
    .filter((item) => item.id === "main_stage" || item.label !== stageLabel || view.targets.includes(item.id))
    .map((item) => (item.id === "main_stage" ? { ...item, label: `${stageLabel}（選んだ場所）` } : item));

  // 動きの演出：今の動きに合うものを先に並べ、画風に影響しやすいものには「※」を付ける（自動では入れない）
  const recommendedEffects = motionProfiles[view.motion]?.recommended || [];
  const effectOptions = [...viewData.motionEffects]
    .sort((a, b) => (recommendedEffects.includes(a.id) ? recommendedEffects.indexOf(a.id) : 99) - (recommendedEffects.includes(b.id) ? recommendedEffects.indexOf(b.id) : 99))
    .map((item) => ({ id: item.id, label: `${item.label}${item.note ? "※" : ""}` }));
  const effectNote = [recommendedEffects.length ? `この動きに合う演出：${recommendedEffects.map((id) => labelOf(viewData.motionEffects, id)).join("・")}` : "", "入れすぎると画面が騒がしくなります。※は画風や線画に影響しやすい演出です。"].filter(Boolean).join("　");

  // ---- シンプル背景：季節・イベントとテイスト ----
  const activeEvent = eventById(simple.eventTheme);
  const activeProfile = profileById(simple.designProfile);
  const motifOption = (id: string) => simpleData.motifs.find((item) => item.id === id);
  const baseMotifIds = activeEvent ? eventMotifIds(activeEvent) : basicMotifIds;
  const shownMotifIds = [...baseMotifIds, ...simple.decoration.motifs.filter((id) => !baseMotifIds.includes(id))];
  const shownMotifs = shownMotifIds.map(motifOption).filter((item): item is Option => Boolean(item));
  const moreMotifGroups = [
    { id: "basic", label: "基本", ids: basicMotifIds },
    ...motifFamilies.map((family) => ({ id: family.id, label: family.label, ids: seasonalMotifs.filter((item) => item.family === family.id).map((item) => item.id) })),
  ].map((group) => ({ ...group, options: group.ids.filter((id) => !shownMotifIds.includes(id)).map(motifOption).filter((item): item is Option => Boolean(item)) })).filter((group) => group.options.length);
  const hiddenMotifCount = moreMotifGroups.reduce((sum, group) => sum + group.options.length, 0);
  const motifNotes = simple.decoration.enabled ? simple.decoration.motifs.map(seasonalMotifById).filter((item) => item?.note).map((item) => ({ id: item!.id, text: `${item!.label}：${item!.note}` })) : [];
  const orderedProfiles = activeEvent ? [...activeEvent.profiles.map((id) => profileById(id)!).filter(Boolean), ...designProfiles.filter((item) => !activeEvent.profiles.includes(item.id))] : designProfiles;
  const eventSummary = activeEvent ? `${activeEvent.label}（${activeEvent.period}）` : "選ばない（ふだんのシンプル背景）";

  const relationOptions = state.backgroundMode === "scene" ? sceneData.relations : simpleData.relations;
  const relationValue = state.backgroundMode === "scene" ? scene.subjectRelation : simple.subjectRelation;

  const outputCard = <div className="output-card">
    <div className="output-head"><span><span className="live-dot" />リアルタイムで更新</span><span>{result.positive.length}文字</span></div>
    <h2>プロンプトをコピー</h2>
    <p className="jp-summary">{state.backgroundMode === "scene" ? <>場所：{stageLabel}　見え方：{viewSummary(state)}</> : japaneseSummary(state)}</p>

    <div className="output-settings">
      <ChoiceGroup label="生成先" options={[{ id: "generic", label: "汎用" }, { id: "pixai", label: "PIXAI" }, { id: "novelai", label: "NovelAI" }]} value={target.platform} onChange={(id) => update("target.platform", id)} />
      {target.platform === "pixai" && <ChoiceGroup label="PIXAIのモデル" options={[{ id: "tsubaki", label: "Tsubaki系（文章）" }, { id: "tag", label: "タグ系モデル" }]} value={target.pixaiModel} onChange={(id) => update("target.pixaiModel", id)} note={target.pixaiModel === "tsubaki" ? "Tsubaki.2で確認した書き方です。自然な英文で位置関係を伝えます。" : "SDXL系などタグで学習したモデル向けに、短い英語の句を並べます。"} />}
      <ChoiceGroup label="人物と背景の比重" options={relationOptions} value={relationValue} onChange={(id) => update(state.backgroundMode === "scene" ? "scene.subjectRelation" : "simple.subjectRelation", id)} />
    </div>

    <div className="output-tabs" role="tablist" aria-label="出力の詳しさ">
      <button type="button" role="tab" aria-selected={state.outputStyle === "short"} className={state.outputStyle === "short" ? "active" : ""} onClick={() => update("outputStyle", "short")}>短縮版<small>要点だけ</small></button>
      <button type="button" role="tab" aria-selected={state.outputStyle === "detailed"} className={state.outputStyle === "detailed" ? "active" : ""} onClick={() => update("outputStyle", "detailed")}>詳細版<small>背景単体向け</small></button>
    </div>
    <div className="prompt-box"><p>{result.positive}</p><button type="button" aria-label="プロンプトをコピー" onClick={copyPrompt}>⧉</button></div>
    <button type="button" className="primary-button" onClick={copyPrompt}>プロンプトをコピー</button>
    <p className="target-note">{targetLabel}向け{state.outputStyle === "short" ? "・短縮版" : "・詳細版"}。{target.platform === "generic" ? "従来どおりの英文です。" : target.platform === "novelai" ? "見え方を先頭に置いたタグと短い句です。" : target.pixaiModel === "tsubaki" ? "どこから何を見ているかを1文目に書いています。" : "場所と見え方のタグを前の方に置いています。"}</p>
    {result.notes.map((note) => <p key={note} className="target-note">{note}</p>)}

    {target.platform === "novelai" && state.backgroundMode === "scene" && <div className="output-option"><Toggle checked={target.novelaiEmphasis} onChange={(value) => update("target.novelaiEmphasis", value)}>見え方を少し強める（1.2::〜::）</Toggle><small>NovelAI V4以降の数値強調。見え方を細かく指定したときだけ使います。</small></div>}
    {target.platform === "pixai" && target.pixaiModel === "tsubaki" && <div className="output-option"><Toggle checked={target.tsubakiProMode} onChange={(value) => update("target.tsubakiProMode", value)}>Pro・Ultraモードで使う</Toggle><small>Lite・Standardではネガティブ欄を編集できないため、オフのときはネガティブを作りません。</small></div>}

    {negativeInfo.supported ? <div className="negative-block">
      <Toggle checked={target.negativeEnabled} onChange={(value) => update("target.negativeEnabled", value)}>{negativeInfo.label}も作る</Toggle>
      {target.negativeEnabled && <>
        <ChoiceGroup label="入れたくないもの" options={negativeOptions} value={target.negativeItems} multi onChange={(id) => toggle("target.negativeItems", id)} disabled={negativeDisabled} />
        {result.negative ? <div className="prompt-box negative"><p>{result.negative}</p><button type="button" aria-label="ネガティブをコピー" onClick={() => copy(result.negative || "", `${negativeInfo.label}をコピーしました`)}>⧉</button></div> : <p className="target-note">今の設定で入る項目はありません。</p>}
        <p className="target-note">{negativeInfo.reason}</p>
      </>}
    </div> : <p className="target-note muted">{negativeInfo.reason}</p>}

    <div className="advice-area"><div className="advice-heading"><strong>設計アドバイス</strong><span>{advice.length || "✓"}</span></div>{advice.length ? advice.slice(0, 4).map((item) => <AdviceCard key={item.id} advice={item} onApply={applyAdvice} />) : <div className="all-good"><span>✓</span><p><strong>きれいにまとまっています</strong><small>大きな矛盾はありません</small></p></div>}</div>
    <div className="output-secondary"><button type="button" onClick={() => setSaveOpen(true)}>この設計を保存</button><button type="button" onClick={() => exportJson(false)}>JSONで書き出す</button></div>
  </div>;

  return <div className={`app ${state.backgroundMode}`}>
    <header className="topbar"><div className="topbar-inner">
      <div className="brand"><span className="brand-mark" aria-hidden>景</span><div><strong>背景プロンプト工房</strong><small>Background Prompt Workshop</small></div></div>
      <div className="header-actions"><span className="draft-status"><i /> 自動保存</span><button type="button" className="icon-button with-label" onClick={() => setLibraryOpen(true)}>保存一覧</button></div>
    </div></header>

    <main className="shell">
      <section className="intro"><div><h1>背景を、<wbr />ひとつの場面として<wbr />設計する。</h1><p>場所を選び、どこから・何を見ているかを決めると、生成先に合わせた英語プロンプトに組み立てます。</p></div><div className="mode-switch" role="group" aria-label="背景形式"><button type="button" className={state.backgroundMode === "scene" ? "active" : ""} aria-pressed={state.backgroundMode === "scene"} onClick={() => changeMode("scene")}><span aria-hidden>⌂</span><strong>空間背景</strong><small>場所・見え方・光</small></button><button type="button" className={state.backgroundMode === "simple" ? "active" : ""} aria-pressed={state.backgroundMode === "simple"} onClick={() => changeMode("simple")}><span aria-hidden>◐</span><strong>シンプル背景</strong><small>色・柄・質感</small></button></div></section>

      <section className="preset-strip" aria-label="プリセット">
        <div className="preset-heading"><strong>プリセットから始める</strong>
          <div className="reset-tools" role="group" aria-label={`${state.backgroundMode === "scene" ? "空間背景" : "シンプル背景"}をやり直す`}>
            <button type="button" className="reset-button" onClick={clearSelections} aria-describedby="reset-help">選択をクリア</button>
            <button type="button" className="reset-button" onClick={resetToDefaults} aria-describedby="reset-help">初期設定に戻す</button>
          </div>
        </div>
        <p className="reset-help" id="reset-help">「選択をクリア」は{state.backgroundMode === "scene" ? "場所" : "スタイルとメインカラー"}だけ残して他の選択を外します。「初期設定に戻す」は作例の状態（選択あり）に戻します。</p>
        <div className="preset-groups" role="tablist" aria-label="プリセット分類">
          {modePresetGroups.map((group) => <button type="button" role="tab" aria-selected={presetGroup === group.id} className={presetGroup === group.id ? "is-selected" : ""} key={group.id} onClick={() => setPresetGroup(group.id)}>{group.label}</button>)}
        </div>
        <div className="preset-list">{modePresets.map((preset) => <button type="button" key={preset.id} onClick={() => applyPreset(preset.id)}><strong>{preset.label}</strong><small>{preset.description}</small></button>)}</div>
      </section>

      <div className="workspace-grid"><div className="builder-column" key={builderKey}>
        {state.backgroundMode === "scene" ? <>
          <Step index={1} title="どんな場所？" summary={placeSummary}>
            <label className="search-field"><span className="search-icon" aria-hidden>⌕</span><input type="search" value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="場所を探す（例：じんじゃ、海中、コンビニ）" aria-label="場所を検索" /></label>
            {placeQuery ? <div className="search-results">
              {placeResults.length ? <div className="chips">{placeResults.map((item) => <button key={item.id} type="button" className={`chip ${scene.place.mainStage === item.id ? "is-selected" : ""}`} aria-pressed={scene.place.mainStage === item.id} onClick={() => { selectStage(item.id); setPlaceQuery(""); }}>{item.label}<em>{labelOf(sceneData.categories, item.group || "")}</em></button>)}</div> : <p className="choice-note">見つかりませんでした。ひらがなや別の言い方でも探せます。</p>}
            </div> : <>
              <ChoiceGroup label="空間タイプ" options={sceneData.environmentTypes} value={scene.place.environmentType} onChange={changeEnvironmentType} />
              <ChoiceGroup label="場所カテゴリ" options={categories} value={scene.place.category} onChange={changeCategory} />
              <ChoiceGroup label="メイン舞台" options={stages.length ? stages : sceneData.stages.filter((item) => item.id === scene.place.mainStage)} value={scene.place.mainStage} onChange={(id) => update("scene.place.mainStage", id)} />
            </>}
            <details className="inline-more"><summary>舞台の状態{scene.place.stageState.length ? `：${labelsOf(sceneData.stageStates, scene.place.stageState).join("・")}` : "（任意）"}</summary>
              <ChoiceGroup label="舞台の状態" options={sceneData.stageStates} value={scene.place.stageState} multi max={2} onChange={(id) => toggle("scene.place.stageState", id, 2)} />
            </details>
          </Step>

          <Step index={2} title="どう見える？" summary={viewSummary(state)}>
            <div className="segmented" role="group" aria-label="見え方の指定">
              <button type="button" aria-pressed={view.mode === "standard"} className={view.mode === "standard" ? "active" : ""} onClick={() => update("scene.view.mode", "standard")}>標準の見え方</button>
              <button type="button" aria-pressed={view.mode === "custom"} className={view.mode === "custom" ? "active" : ""} onClick={() => update("scene.view.mode", "custom")}>細かく指定する</button>
            </div>
            {view.mode === "standard" ? <>
              <ChoiceGroup label="視点" options={sceneData.perspectives} value={scene.composition.perspective} onChange={(id) => update("scene.composition.perspective", id)} note="場所をふつうに眺める見え方です。見上げる・上空から・窓越しなどは「細かく指定する」で選べます。" />
            </> : <>
              <div className="recipes" aria-label="よく使う見え方">
                {viewRecipes.map((recipe) => {
                  const blocked = recipe.view.vantage && availability.disabled.vantage[recipe.view.vantage];
                  return <button key={recipe.id} type="button" disabled={Boolean(blocked)} title={blocked || recipe.description} onClick={() => applyRecipe(recipe.id)}><strong>{recipe.label}</strong><small>{blocked ? "この場所では使えません" : recipe.description}</small></button>;
                })}
              </div>
              <ViewDiagram view={availability.active || view} stageLabel={stageLabel} />
              {availability.notices.length > 0 && <ul className="view-notices">{availability.notices.map((notice) => <li key={notice.id} className={notice.kind}>{notice.text}</li>)}</ul>}
              <ChoiceGroup label="どこから見る？" options={viewData.vantages} value={view.vantage} onChange={(id) => update("scene.view.vantage", id)} disabled={availability.disabled.vantage} />
              <ChoiceGroup label={view.frame === "window" ? "窓の外に何が見える？" : "何が見える？"} options={viewTargets} value={view.targets} multi max={2} onChange={(id) => setState((current) => {
                const list = current.scene.view.targets;
                const next = list.includes(id) ? list.filter((item) => item !== id) : [...list, id].slice(-2);
                return setAtPath(current, "scene.view.targets", next.length ? next : ["main_stage"]);
              })} note={view.targets.some((id) => id !== "main_stage") ? `いる場所（${stageLabel}）と、見えるものを分けて出力します。` : undefined} />
              <ChoiceGroup label="どの方向を見る？" options={viewData.gazes} value={view.gaze} onChange={(id) => update("scene.view.gaze", id)} disabled={availability.disabled.gaze} />
              {availability.altitudeActive && <ChoiceGroup label="どのくらいの高さ？" options={viewData.altitudes} value={view.altitude} onChange={(id) => update("scene.view.altitude", id)} disabled={availability.disabled.altitude} />}
              <ChoiceGroup label="どのくらい離れている？" options={viewData.distances} value={view.distance} onChange={(id) => update("scene.view.distance", id)} />
              <ChoiceGroup label="動きはある？" options={viewData.motions} value={view.motion} onChange={(id) => update("scene.view.motion", id)} disabled={availability.disabled.motion} note="人物の動きではなく、見ている視点の動きです。" />
              {dynamicMotions.includes(view.motion) && !availability.disabled.motion[view.motion] && <ChoiceGroup label="動きの演出" options={effectOptions} value={view.motionEffects} multi max={3} optional onChange={(id) => toggle("scene.view.motionEffects", id, 3)} note={effectNote} />}
              <details className="inline-more" open={Boolean(view.frame || view.lens)}><summary>手前の枠・画角{view.frame || view.lens ? `：${joinJa([view.frame ? labelOf(viewData.frames, view.frame) : "", shown(labelOf(viewData.lenses, view.lens))])}` : "（任意）"}</summary>
                <ChoiceGroup label="何越しに見る？" options={viewData.frames} value={view.frame} onChange={(id) => update("scene.view.frame", id)} optional />
                {view.frame === "window" && <ChoiceGroup label="窓の種類" options={viewData.windowKinds} value={view.frameDetail} onChange={(id) => update("scene.view.frameDetail", id)} />}
                <ChoiceGroup label="画角" options={viewData.lenses} value={view.lens} onChange={(id) => update("scene.view.lens", id)} optional />
              </details>
            </>}
          </Step>

          <Step index={3} title="細かく仕上げる" summary="開かなくても大丈夫です。閉じても選んだ内容は出力に残ります。">
            <Section title="世界観・建築" summary={worldSummary}>
              <div className="choice-split"><ChoiceGroup label="世界観" options={sceneData.worlds} value={scene.world.worldType} onChange={(id) => update("scene.world.worldType", id)} /><ChoiceGroup label="時代" options={sceneData.eras} value={scene.world.era} onChange={(id) => update("scene.world.era", id)} /></div>
              <ChoiceGroup label="建築様式" options={sceneData.architecture} value={scene.world.architectureStyle} multi max={2} optional onChange={(id) => toggle("scene.world.architectureStyle", id, 2)} />
            </Section>
            <Section title="建物や周囲のもの" summary={structureSummary}>
              <div className="structure-tools">
                <label className="search-field small"><span className="search-icon" aria-hidden>⌕</span><input type="search" value={structureQuery} onChange={(event) => setStructureQuery(event.target.value)} placeholder="構成物を探す（例：とりい、信号）" aria-label="構成物を検索" /></label>
                {!structureQuery && stageGenres.length > 0 && <button type="button" className="text-button" onClick={() => setShowAllStructures((value) => !value)}>{showAllStructures ? `「${stageLabel}」に合うものだけ` : `ほかの${hiddenCount}件も表示`}</button>}
              </div>
              <ChoiceGroup label="主役の構造物" options={relevant(sceneData.landmarks, [scene.structures.landmark])} value={scene.structures.landmark} onChange={(id) => update("scene.structures.landmark", id)} />
              <ChoiceGroup label="周りの構成物" options={relevant(sceneData.secondary, scene.structures.secondary)} value={scene.structures.secondary} multi max={3} onChange={(id) => toggle("scene.structures.secondary", id, 3)} />
              <ChoiceGroup label="小物・痕跡" options={relevant(sceneData.accents, scene.structures.accents)} value={scene.structures.accents} multi max={3} onChange={(id) => toggle("scene.structures.accents", id, 3)} />
              <ChoiceGroup label="生き物・怪異" options={relevant(sceneData.creatures, scene.structures.creatures)} value={scene.structures.creatures} multi max={2} optional onChange={(id) => toggle("scene.structures.creatures", id, 2)} note="選ぶと画面に描かれます。気配だけにしたいときは「小物・痕跡」を使います。" />
            </Section>
            <Section title="季節・天気・時間" summary={environmentSummary}>
              <ChoiceGroup label="時間帯" options={sceneData.times} value={scene.environment.timeOfDay} onChange={(id) => update("scene.environment.timeOfDay", id)} />
              <div className="choice-split"><ChoiceGroup label="季節" options={sceneData.seasons} value={scene.environment.season} onChange={(id) => update("scene.environment.season", id)} disabled={scene.environment.weather === "snow" && scene.world.worldType !== "fantasy" ? { summer: "雪の日は夏を選べません（ファンタジーを除く）" } : {}} /><ChoiceGroup label="天候" options={sceneData.weather} value={scene.environment.weather} onChange={(id) => update("scene.environment.weather", id)} /></div>
              <ChoiceGroup label="空気の動き・現象" options={sceneData.phenomena} value={scene.environment.phenomena} multi max={2} optional onChange={(id) => toggle("scene.environment.phenomena", id, 2)} />
            </Section>
            <Section title="光・色・雰囲気" summary={lightSummary}>
              <ChoiceGroup label="主な光" options={sceneData.primaryLights} value={scene.lighting.primarySource} onChange={(id) => update("scene.lighting.primarySource", id)} disabled={scene.environment.timeOfDay === "night" ? { direct_sunlight: "夜は直射日光を選べません" } : {}} />
              <ChoiceGroup label="補助の光" options={sceneData.secondaryLights} value={scene.lighting.secondarySource} onChange={(id) => update("scene.lighting.secondarySource", id)} />
              <div className="choice-split"><ChoiceGroup label="光の方向" options={sceneData.directions} value={scene.lighting.direction} onChange={(id) => update("scene.lighting.direction", id)} /><ChoiceGroup label="光の質" options={sceneData.qualities} value={scene.lighting.quality} onChange={(id) => update("scene.lighting.quality", id)} /></div>
              <ChoiceGroup label="色調" options={sceneData.tones} value={scene.atmosphere.colorTone} onChange={(id) => update("scene.atmosphere.colorTone", id)} />
              <ChoiceGroup label="コントラスト" options={sceneData.contrasts} value={scene.atmosphere.contrast} onChange={(id) => update("scene.atmosphere.contrast", id)} />
              <ChoiceGroup label="空気感" options={sceneData.moods} value={scene.atmosphere.mood} multi max={3} optional onChange={(id) => toggle("scene.atmosphere.mood", id, 3)} />
            </Section>
            <Section title="奥行き・幻想演出" summary={spaceSummary}>
              <ChoiceGroup label="奥行き" options={sceneData.depth} value={scene.composition.depthLayers} onChange={(id) => update("scene.composition.depthLayers", id)} />
              <ChoiceGroup label="背景の密度" options={sceneData.densities} value={scene.composition.density} onChange={(id) => update("scene.composition.density", id)} />
              <ChoiceGroup label="人物との馴染ませ方" options={sceneData.blends} value={scene.composition.blend} onChange={(id) => update("scene.composition.blend", id)} />
              <ChoiceGroup label="幻想演出" options={sceneData.fantasies} value={scene.composition.fantasyEffects} multi max={2} optional onChange={(id) => toggle("scene.composition.fantasyEffects", id, 2)} />
            </Section>
          </Step>
        </> : <>
          <Step index={1} title="どんな背景面？" summary={joinJa([activeEvent?.label || "", activeProfile?.label || "", labelOf(simpleData.styles, simple.style), labelOf(simpleData.types, simple.backgroundType), simple.backgroundType === "pattern" ? shown(labelOf(simpleData.patterns, simple.pattern)) : "", simple.backgroundType === "texture" ? shown(labelOf(simpleData.textures, simple.texture)) : ""])}>
            <Section title="季節・イベント（任意）" summary={eventSummary} tone="event-section">
              <p className="choice-note">選ぶと、その行事らしいモチーフを1〜2種類、人物を邪魔しにくい位置に「まばら」で入れます。色や雰囲気は変えません。</p>
              <div className="event-rows" role="group" aria-label="季節・イベント">
                <div className="chips"><button type="button" className={`chip is-unset ${!activeEvent ? "is-selected" : ""}`} aria-pressed={!activeEvent} onClick={() => selectEvent("")}>選ばない{!activeEvent && <span aria-hidden>✓</span>}</button></div>
                {eventGroups.map((group) => <div className="event-row" key={group.id}>
                  <span className="event-row-label">{group.label}</span>
                  <div className="chips">{eventThemes.filter((item) => item.group === group.id).map((item) => <button key={item.id} type="button" className={`chip ${simple.eventTheme === item.id ? "is-selected" : ""}`} aria-pressed={simple.eventTheme === item.id} onClick={() => selectEvent(item.id)}>{item.label}{simple.eventTheme === item.id && <span aria-hidden>✓</span>}</button>)}</div>
                </div>)}
              </div>
              {activeEvent && <div className="event-info">
                <p><b>{activeEvent.label}</b>　{activeEvent.period}。おすすめの装飾：{activeEvent.starter.map((id) => motifOption(id)?.label).join("・")}</p>
                {activeEvent.note && <p className="choice-note">{activeEvent.note}</p>}
                <button type="button" className="text-button" onClick={() => selectEvent(activeEvent.id, true)}>おすすめの装飾を入れ直す</button>
              </div>}
            </Section>
            <Section title="テイスト（任意）" summary={activeProfile ? `${activeProfile.label}（${activeProfile.description}）` : "選ばない"} tone="profile-section">
              <p className="choice-note">同じイベントでも、テイストで見た目を変えられます。選ぶと色・背景タイプ・質感が変わります（装飾はそのまま）。</p>
              <div className="profile-list" role="group" aria-label="テイスト">
                <button type="button" className={`profile-card is-unset ${!activeProfile ? "is-selected" : ""}`} aria-pressed={!activeProfile} onClick={() => selectProfile("")}><strong>選ばない</strong><small>今の色のまま</small></button>
                {orderedProfiles.map((item) => <button type="button" key={item.id} className={`profile-card ${simple.designProfile === item.id ? "is-selected" : ""}`} aria-pressed={simple.designProfile === item.id} onClick={() => selectProfile(item.id)}>
                  <span className="swatches" aria-hidden>{[item.patch.colors.primary, item.patch.colors.secondary].filter(Boolean).map((color) => <i key={color} style={{ background: SWATCH[color] }} />)}</span>
                  <strong>{item.label}{simple.designProfile === item.id && <span aria-hidden> ✓</span>}</strong>
                  <small>{activeEvent?.profiles.includes(item.id) ? <em>おすすめ</em> : null}{item.description}</small>
                </button>)}
              </div>
            </Section>
            <ChoiceGroup label="スタイル" options={simpleData.styles} value={simple.style} onChange={(id) => update("simple.style", id)} />
            <ChoiceGroup label="背景タイプ" options={simpleData.types} value={simple.backgroundType} onChange={(id) => update("simple.backgroundType", id)} />
            {simple.backgroundType === "pattern" && <ChoiceGroup label="柄" options={simpleData.patterns} value={simple.pattern} onChange={(id) => update("simple.pattern", id)} />}
            {simple.backgroundType === "texture" && <ChoiceGroup label="素材の質感" options={simpleData.textures} value={simple.texture} onChange={(id) => update("simple.texture", id)} />}
          </Step>
          <Step index={2} title="どんな色？" summary={joinJa([labelOf(simpleData.colors, simple.colors.primary), labelOf(simpleData.colors, simple.colors.secondary), labelOf(simpleData.intensities, simple.colors.intensity)])}>
            <ChoiceGroup label="メインカラー" options={simpleData.colors} value={simple.colors.primary} onChange={(id) => update("simple.colors.primary", id)} />
            <ChoiceGroup label="サブカラー" options={[{ id: "", label: "なし" }, ...simpleData.colors]} value={simple.colors.secondary} onChange={(id) => update("simple.colors.secondary", id)} optional />
            <ChoiceGroup label="明るさ・濃さ" options={simpleData.intensities} value={simple.colors.intensity} onChange={(id) => update("simple.colors.intensity", id)} />
          </Step>
          <Step index={3} title="細かく仕上げる" summary="開かなくても大丈夫です。閉じても選んだ内容は出力に残ります。">
            <Section title="質感・出方" summary={labelsOf(simpleData.renderings, simple.rendering).join("・")}><ChoiceGroup label="質感・出方" options={simpleData.renderings} value={simple.rendering} multi max={3} onChange={(id) => toggle("simple.rendering", id, 3)} /></Section>
            <Section title="装飾" summary={simple.decoration.enabled ? joinJa([...labelsOf(simpleData.motifs, simple.decoration.motifs), shown(labelOf(simpleData.placements, simple.decoration.placement)), shown(labelOf(simpleData.decorationDensities, simple.decoration.density))]) || "モチーフ未選択" : "装飾なし"}>
              <ChoiceGroup label="装飾の有無" options={[{ id: "off", label: "なし" }, { id: "on", label: "入れる" }]} value={simple.decoration.enabled ? "on" : "off"} onChange={(id) => update("simple.decoration.enabled", id === "on")} />
              {simple.decoration.enabled ? <>
                {simple.subjectRelation !== "background_only" && <p className="choice-note">人物を目立たせたいなら、モチーフは1〜2種類・端か上側・まばらがおすすめです。</p>}
                <ChoiceGroup label={activeEvent ? `モチーフ（「${activeEvent.label}」のおすすめ）` : "モチーフ"} options={shownMotifs} value={simple.decoration.motifs} multi max={3} onChange={(id) => toggle("simple.decoration.motifs", id, 3)} />
                {motifNotes.length > 0 && <ul className="motif-notes">{motifNotes.map((note) => <li key={note.id}>{note.text}</li>)}</ul>}
                {hiddenMotifCount > 0 && <button type="button" className="text-button motif-more" aria-expanded={showAllMotifs} onClick={() => setShowAllMotifs((value) => !value)}>{showAllMotifs ? "おすすめだけにする" : `ほかのモチーフも見る（${hiddenMotifCount}件）`}</button>}
                {showAllMotifs && <div className="motif-more-groups">{moreMotifGroups.map((group) => <ChoiceGroup key={group.id} label={group.label} options={group.options} value={simple.decoration.motifs} multi onChange={(id) => toggle("simple.decoration.motifs", id, 3)} />)}</div>}
                <ChoiceGroup label="置く場所" options={simpleData.placements} value={simple.decoration.placement} onChange={(id) => update("simple.decoration.placement", id)} />
                <ChoiceGroup label="量" options={simpleData.decorationDensities} value={simple.decoration.density} onChange={(id) => update("simple.decoration.density", id)} />
              </> : <p className="choice-note">装飾は出力に入りません{activeEvent ? `（「${activeEvent.label}」のモチーフも入りません）` : ""}。選んでいたモチーフは残っているので、「入れる」に戻すと元に戻ります。</p>}
            </Section>
          </Step>
        </>}
      </div>

      <aside className="output-column" aria-label="生成結果" ref={outputRef} id="output"><div className="step-head output-step"><span className="step-index" aria-hidden>4</span><div><h2>生成先を選んでコピー</h2></div></div>{outputCard}</aside></div>
    </main>

    <nav className="mobile-dock" aria-label="操作"><button type="button" onClick={goToOutput}>出力を見る</button><button type="button" className="dock-primary" onClick={copyPrompt}>コピー</button><button type="button" onClick={() => setSaveOpen(true)}>保存</button></nav>

    {(saveOpen || libraryOpen) && <div className="modal-layer" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSaveOpen(false); setLibraryOpen(false); } }}>
      {saveOpen && <section className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title"><button className="modal-close" onClick={() => setSaveOpen(false)} aria-label="閉じる">×</button><h2 id="save-title">この背景設計を保存</h2><p>英語文ではなく、あとで編集できる設計の状態を端末に保存します。</p><label>保存名<input autoFocus value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder={japaneseSummary(state)} /></label><button className="primary-button" type="button" onClick={saveDesign}>保存する</button></section>}
      {libraryOpen && <section className="modal library-modal" role="dialog" aria-modal="true" aria-labelledby="library-title"><button className="modal-close" onClick={() => setLibraryOpen(false)} aria-label="閉じる">×</button><h2 id="library-title">保存した背景設計</h2><div className="library-tools"><button onClick={() => exportJson(true)}>全部を書き出す</button><button onClick={() => importRef.current?.click()}>JSONを読み込む</button></div><p className="choice-note">読み込んだ一覧は、今の保存に追加されます（上書きしません）。</p><div className="saved-list">{saved.length ? saved.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{new Date(item.savedAt).toLocaleString("ja-JP")}</small></div><button onClick={() => { setState(enforceExclusions(migrateState(clone(item.state)))); setPresetGroup("recommended"); setLibraryOpen(false); setToast("保存した設計を開きました"); }}>開く</button><button className="danger" onClick={() => { if (window.confirm(`「${item.name}」を削除しますか？`)) setSaved((items) => items.filter((savedItem) => savedItem.id !== item.id)); }}>削除</button></article>) : <p className="empty-state">まだ保存した設計はありません。気に入った設計は「保存」から残せます。</p>}</div></section>}
    </div>}
    <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importJson} />
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
