import { sceneData, simpleData } from "./background-data.ts";
import { eventById, seasonalMotifById } from "./seasonal-data.ts";
import { negativeSupport } from "./generator.ts";
import type { BackgroundState } from "./background-data.ts";
import { stageProfile } from "./view-rules.ts";

export type Advice = { id: string; kind: "warning" | "suggestion"; title: string; body: string; actionLabel?: string; patch?: { path: string; value: string | boolean; multi?: boolean } };

const has = (list: string[], id: string) => list.includes(id);

export function getAdvice(state: BackgroundState): Advice[] {
  const result: Advice[] = [];
  if (state.backgroundMode === "scene") {
    const s = state.scene;
    const profile = stageProfile(state);
    const stageId = s.place.mainStage;
    const allStructures = [s.structures.landmark, ...s.structures.secondary];
    if (s.subjectRelation === "character_focus" && s.composition.density === "intricate") result.push({ id: "focus-density", kind: "warning", title: "人物より背景が強くなるかも", body: "人物重視なら、密度は「標準」か「豊か」が安定します。", actionLabel: "豊かに変更", patch: { path: "scene.composition.density", value: "rich" } });
    if (s.subjectRelation === "background_only" && s.composition.density === "minimal") result.push({ id: "background-minimal", kind: "warning", title: "背景のみには情報が少なめ", body: "空間の主役を見せるなら「豊か」がおすすめです。", actionLabel: "豊かに変更", patch: { path: "scene.composition.density", value: "rich" } });
    if (s.place.environmentType === "indoor" && s.lighting.primarySource === "moonlight" && !s.structures.secondary.includes("large_windows")) result.push({ id: "moon-window", kind: "warning", title: "月明かりの入口がありません", body: "室内に大きな窓を加えると、光の理由が自然になります。", actionLabel: "大きな窓を追加", patch: { path: "scene.structures.secondary", value: "large_windows", multi: true } });
    if (s.environment.weather === "rain" && !s.structures.accents.includes("wet_ground")) result.push({ id: "rain-ground", kind: "suggestion", title: "雨らしさを足す", body: "濡れた地面が光と奥行きをつなぎます。", actionLabel: "濡れた地面を追加", patch: { path: "scene.structures.accents", value: "wet_ground", multi: true } });
    if (s.environment.weather === "rain" && !s.structures.accents.includes("neon_reflections") && s.environment.timeOfDay === "night") result.push({ id: "rain-reflection", kind: "suggestion", title: "夜の雨に反射を", body: "ネオン反射で路面の質感が伝わります。", actionLabel: "ネオン反射を追加", patch: { path: "scene.structures.accents", value: "neon_reflections", multi: true } });
    if (s.place.category === "forest" && !s.structures.accents.includes("mist")) result.push({ id: "forest-mist", kind: "suggestion", title: "森に空気の層を", body: "薄霧を足すと、前景と遠景が分かれます。", actionLabel: "薄霧を追加", patch: { path: "scene.structures.accents", value: "mist", multi: true } });

    // ---- v2.0：場所を識別する構成物・光の提案 ----
    if (stageId === "shinto_shrine" && !allStructures.includes("torii") && s.structures.landmark !== "grand_torii") result.push({ id: "shrine-torii", kind: "suggestion", title: "神社らしさを足す", body: "鳥居があると、寺院や一般的な神殿と描き分けやすくなります。", actionLabel: "鳥居を追加", patch: { path: "scene.structures.secondary", value: "torii", multi: true } });
    if (stageId === "tatami_room" && !has(s.structures.secondary, "tatami") && !has(s.structures.secondary, "shoji")) result.push({ id: "tatami-shoji", kind: "suggestion", title: "和室の手がかりを", body: "畳や障子を入れると、ただの室内にならずに済みます。", actionLabel: "障子を追加", patch: { path: "scene.structures.secondary", value: "shoji", multi: true } });
    if (profile.underwater && !["underwater_sunlight", "bioluminescence"].includes(s.lighting.primarySource) && s.lighting.secondarySource !== "caustics" && s.lighting.secondarySource !== "god_rays") result.push({ id: "underwater-light", kind: "suggestion", title: "水中らしい光を", body: "水面から差す光にすると、水上の海辺と区別しやすくなります。", actionLabel: "水面から差す光", patch: { path: "scene.lighting.primarySource", value: "underwater_sunlight" } });
    if (profile.underwater && ["rain", "snow", "storm"].includes(s.environment.weather)) result.push({ id: "underwater-weather", kind: "warning", title: "水中で天候が強く出るかも", body: "雨・雪・嵐は水中では描きにくい要素です。「指定しない」がおすすめです。", actionLabel: "天候を指定しない", patch: { path: "scene.environment.weather", value: "" } });
    if (s.environment.timeOfDay === "night" && s.lighting.primarySource === "underwater_sunlight") result.push({ id: "night-underwater-sun", kind: "warning", title: "夜に日光が差しています", body: "夜の水中なら「生物発光」や「月明かり」が自然です。", actionLabel: "生物発光に変更", patch: { path: "scene.lighting.primarySource", value: "bioluminescence" } });
    // 場所を変えたあとに、前の場所の構成物が残っていないか
    const stageGenres = profile.stage?.genres || profile.category?.genres || [];
    if (stageGenres.length) {
      const pools = [sceneData.landmarks, sceneData.secondary, sceneData.accents];
      const chosen = [s.structures.landmark, ...s.structures.secondary, ...s.structures.accents].filter((id) => id && id !== "none");
      const leftovers = chosen.map((id) => pools.flatMap((list) => list).find((item) => item.id === id)).filter((item) => item && item.genres?.length && !item.genres.some((genre) => stageGenres.includes(genre)));
      if (leftovers.length >= 2) result.push({ id: "structure-leftovers", kind: "suggestion", title: "前の場所の構成物が残っているかも", body: `「${leftovers.map((item) => item!.label).join("・")}」は、今の場所とは別の分類です。意図していなければ「建物や周囲のもの」で外してください。` });
    }
    if (s.structures.creatures.length && s.subjectRelation === "background_only") result.push({ id: "creatures-drawn", kind: "suggestion", title: "生き物は描かれます", body: "「背景のみ」でも、選んだ生き物・怪異は画面に入ります。痕跡だけにしたい場合は外してください。" });
    if (has(s.structures.creatures, "ghostly_figure") && s.subjectRelation !== "background_only") result.push({ id: "ghost-character", kind: "suggestion", title: "幽霊が人物と混ざるかも", body: "人物と一緒に使うと、幽霊がもう一人の人物として描かれることがあります。怖さだけなら「怪異の爪痕」などの痕跡がおすすめです。", actionLabel: "爪痕を追加", patch: { path: "scene.structures.accents", value: "scratch_marks", multi: true } });
    if (s.environment.timeOfDay === "night" && profile.indoor && s.lighting.primarySource === "natural") result.push({ id: "night-natural-indoor", kind: "warning", title: "夜の室内に自然光", body: "夜なら室内灯・ろうそくなど、光の理由がある光源が自然です。", actionLabel: "暖かな室内灯", patch: { path: "scene.lighting.primarySource", value: "warm_indoor" } });
  } else {
    const s = state.simple;
    // 端・四隅・上側に「まばら」で置く季節装飾は、プレーンでも無地寄りの意図を保てるので警告しない
    const edgeSparse = ["edges", "corners", "upper"].includes(s.decoration.placement) && s.decoration.density === "sparse";
    if (s.style === "plain" && s.decoration.enabled && s.decoration.motifs.length > 1 && !edgeSparse) result.push({ id: "plain-decor", kind: "warning", title: "プレーン背景には装飾が多め", body: "装飾を1つに絞ると、無地寄りの意図が保てます。" });
    if (s.style === "purikura" && ["deep", "dark"].includes(s.colors.intensity) && s.designProfile !== "dark_kawaii") result.push({ id: "purikura-dark", kind: "warning", title: "プリクラ風には色が重め", body: "淡い色にすると、軽くかわいい印象が安定します。", actionLabel: "淡くする", patch: { path: "simple.colors.intensity", value: "soft" } });
    if (s.subjectRelation === "character_focus" && s.decoration.motifs.length > 2) result.push({ id: "simple-focus", kind: "warning", title: "装飾が人物と競合しそう", body: "人物を目立たせるならモチーフは2種類までがおすすめです。" });
    if (s.style === "purikura" && s.colors.primary === "pastel_pink" && !s.decoration.motifs.includes("subtle_sparkles")) result.push({ id: "pink-sparkle", kind: "suggestion", title: "ピンクに軽いきらめき", body: "小さなきらめきなら、人物を邪魔せずプリクラ感が出ます。", actionLabel: "きらきらを追加", patch: { path: "simple.decoration.motifs", value: "subtle_sparkles", multi: true } });
    if (s.style === "soft" && s.colors.primary === "powder_blue" && !s.rendering.includes("gentle_blur")) result.push({ id: "blue-blur", kind: "suggestion", title: "青系をやわらかく", body: "ぼかしを足すと空気感が整います。", actionLabel: "ぼかしを追加", patch: { path: "simple.rendering", value: "gentle_blur", multi: true } });
    if (s.backgroundType === "pattern" && !s.pattern) result.push({ id: "pattern-missing", kind: "suggestion", title: "柄を選ぶと安定します", body: "「柄背景」は、具体的な柄を1つ選ぶと狙いが伝わりやすくなります。", actionLabel: "格子にする", patch: { path: "simple.pattern", value: "geometric_grid" } });
    if (s.backgroundType === "texture" && !s.texture) result.push({ id: "texture-missing", kind: "suggestion", title: "素材を選ぶと安定します", body: "「質感背景」は、紙・布などの素材を選ぶと質感が出ます。", actionLabel: "紙にする", patch: { path: "simple.texture", value: "paper" } });
    if (s.subjectRelation === "character_focus" && s.decoration.enabled && s.decoration.density === "dense") result.push({ id: "dense-decor", kind: "warning", title: "装飾が多めです", body: "人物を目立たせるなら、密度は「まばら」か「ほどほど」が安定します。", actionLabel: "ほどほどにする", patch: { path: "simple.decoration.density", value: "moderate" } });
    result.push(...seasonalAdvice(state));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* v2.2 季節・イベント装飾：人物を邪魔しない・見分けにくい組み合わせを避ける     */
/* ------------------------------------------------------------------ */

const motifLabel = (id: string) => simpleData.motifs.find((item) => item.id === id)?.label || id;
const PLACE_SHORT: Record<string, string> = { edges: "フチ", corners: "四隅", upper: "上側", scattered: "全体" };
const PLACE_ACTION: Record<string, string> = { edges: "フチに寄せる", corners: "四隅に寄せる", upper: "上側に寄せる", scattered: "全体に散らす" };

function seasonalAdvice(state: BackgroundState): Advice[] {
  const s = state.simple;
  if (!s.decoration.enabled || !s.decoration.motifs.length) return [];
  const result: Advice[] = [];
  const chosen = s.decoration.motifs;
  const seasonal = chosen.map(seasonalMotifById).filter((item) => item !== undefined);
  const event = eventById(s.eventTheme);
  if (!seasonal.length && !event) return [];

  // 1. 見分けにくい・文化が混ざる組み合わせ（後から選んだほうを外す提案）
  for (const motif of seasonal) {
    const clash = (motif.conflicts || []).find((id) => chosen.includes(id) && chosen.indexOf(id) > chosen.indexOf(motif.id));
    const reverse = chosen.find((id) => id !== motif.id && chosen.indexOf(id) > chosen.indexOf(motif.id) && seasonalMotifById(id)?.conflicts?.includes(motif.id));
    const other = clash || reverse;
    if (!other) continue;
    const otherMotif = seasonalMotifById(other);
    const cultural = Boolean(motif.culture && otherMotif?.culture && motif.culture !== otherMotif.culture);
    result.push({
      id: "motif-conflict", kind: "warning",
      title: cultural ? "別の文化の飾りが混ざっています" : "見分けにくい組み合わせです",
      body: cultural
        ? `「${motif.label}」と「${motifLabel(other)}」は別の行事の飾りです。どちらか一方にすると、行事がはっきり伝わります。`
        : `「${motif.label}」と「${motifLabel(other)}」は形や光が似ていて、混ざって描かれやすい組み合わせです。`,
      actionLabel: `「${motifLabel(other)}」を外す`, patch: { path: "simple.decoration.motifs", value: other, multi: true },
    });
    break;
  }

  // 2. 人物がいるときは、季節の装飾を端・四隅・上側に寄せる（中央・顔まわりを空ける）
  const person = s.subjectRelation !== "background_only";
  const prefer = seasonal[0]?.prefer[0] || event?.placement || "edges";
  if (person && (s.decoration.placement === "" || s.decoration.placement === "scattered")) {
    result.push({ id: "seasonal-edge", kind: "suggestion", title: "顔や衣装に重ならないように", body: "人物を目立たせたいなら、季節のモチーフは1〜2種類・端か上側・まばらがおすすめです。", actionLabel: PLACE_ACTION[prefer], patch: { path: "simple.decoration.placement", value: prefer } });
  } else if (person && s.decoration.placement) {
    // 3. モチーフに向かない置き場所（しめ縄を四隅に、など）
    const mismatch = seasonal.find((motif) => !motif.prefer.includes(s.decoration.placement as never));
    if (mismatch) result.push({ id: "motif-placement", kind: "suggestion", title: `「${mismatch.label}」は${mismatch.prefer.map((id) => PLACE_SHORT[id]).join("・")}向きです`, body: "置く場所は装飾全体で1つです。合わないモチーフがあるときは、どちらかに絞ると自然に収まります。", actionLabel: PLACE_ACTION[mismatch.prefer[0]], patch: { path: "simple.decoration.placement", value: mismatch.prefer[0] } });
  }

  // 4. 文字が入りやすいモチーフ（短冊・証書・ペナントなど）は、ネガティブで文字を外す
  const textRisk = seasonal.find((motif) => motif.textRisk);
  if (textRisk && negativeSupport(state).supported) {
    const t = state.target;
    if (!t.negativeEnabled) result.push({ id: "motif-text", kind: "suggestion", title: "文字が入りやすいモチーフです", body: `「${textRisk.label}」には文字やロゴが描かれることがあります。ネガティブで「文字・ロゴ」を外すと安定します。`, actionLabel: "ネガティブを作る", patch: { path: "target.negativeEnabled", value: true } });
    else if (!t.negativeItems.includes("text")) result.push({ id: "motif-text", kind: "suggestion", title: "文字が入りやすいモチーフです", body: `「${textRisk.label}」には文字やロゴが描かれることがあります。ネガティブに「文字・ロゴ」を入れると安定します。`, actionLabel: "文字・ロゴを外す", patch: { path: "target.negativeItems", value: "text", multi: true } });
  }
  return result;
}

export function enforceExclusions(state: BackgroundState): BackgroundState {
  const next = structuredClone(state);
  if (next.scene.environment.timeOfDay === "night" && next.scene.lighting.primarySource === "direct_sunlight") next.scene.lighting.primarySource = "moonlight";
  if (next.scene.environment.weather === "snow" && next.scene.environment.season === "summer" && next.scene.world.worldType !== "fantasy") next.scene.environment.season = "winter";
  return next;
}
