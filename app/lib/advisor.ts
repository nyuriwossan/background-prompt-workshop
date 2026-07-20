import type { BackgroundState } from "./background-data.ts";

export type Advice = { id: string; kind: "warning" | "suggestion"; title: string; body: string; actionLabel?: string; patch?: { path: string; value: string; multi?: boolean } };

export function getAdvice(state: BackgroundState): Advice[] {
  const result: Advice[] = [];
  if (state.backgroundMode === "scene") {
    const s = state.scene;
    if (s.subjectRelation === "character_focus" && s.composition.density === "intricate") result.push({ id: "focus-density", kind: "warning", title: "人物より背景が強くなるかも", body: "人物重視なら、密度は「標準」か「豊か」が安定します。", actionLabel: "豊かに変更", patch: { path: "scene.composition.density", value: "rich" } });
    if (s.subjectRelation === "background_only" && s.composition.density === "minimal") result.push({ id: "background-minimal", kind: "warning", title: "背景のみには情報が少なめ", body: "空間の主役を見せるなら「豊か」がおすすめです。", actionLabel: "豊かに変更", patch: { path: "scene.composition.density", value: "rich" } });
    if (s.place.environmentType === "indoor" && s.lighting.primarySource === "moonlight" && !s.structures.secondary.includes("large_windows")) result.push({ id: "moon-window", kind: "warning", title: "月明かりの入口がありません", body: "室内に大きな窓を加えると、光の理由が自然になります。", actionLabel: "大きな窓を追加", patch: { path: "scene.structures.secondary", value: "large_windows", multi: true } });
    if (s.environment.weather === "rain" && !s.structures.accents.includes("wet_ground")) result.push({ id: "rain-ground", kind: "suggestion", title: "雨らしさを足す", body: "濡れた地面が光と奥行きをつなぎます。", actionLabel: "濡れた地面を追加", patch: { path: "scene.structures.accents", value: "wet_ground", multi: true } });
    if (s.environment.weather === "rain" && !s.structures.accents.includes("neon_reflections") && s.environment.timeOfDay === "night") result.push({ id: "rain-reflection", kind: "suggestion", title: "夜の雨に反射を", body: "ネオン反射で路面の質感が伝わります。", actionLabel: "ネオン反射を追加", patch: { path: "scene.structures.accents", value: "neon_reflections", multi: true } });
    if (s.place.category === "forest" && !s.structures.accents.includes("mist")) result.push({ id: "forest-mist", kind: "suggestion", title: "森に空気の層を", body: "薄霧を足すと、前景と遠景が分かれます。", actionLabel: "薄霧を追加", patch: { path: "scene.structures.accents", value: "mist", multi: true } });
  } else {
    const s = state.simple;
    if (s.style === "plain" && s.decoration.enabled && s.decoration.motifs.length > 1) result.push({ id: "plain-decor", kind: "warning", title: "プレーン背景には装飾が多め", body: "装飾を1つに絞ると、無地寄りの意図が保てます。" });
    if (s.style === "purikura" && ["deep", "dark"].includes(s.colors.intensity)) result.push({ id: "purikura-dark", kind: "warning", title: "プリクラ風には色が重め", body: "淡い色にすると、軽くかわいい印象が安定します。", actionLabel: "淡くする", patch: { path: "simple.colors.intensity", value: "soft" } });
    if (s.subjectRelation === "character_focus" && s.decoration.motifs.length > 2) result.push({ id: "simple-focus", kind: "warning", title: "装飾が人物と競合しそう", body: "人物を目立たせるならモチーフは2種類までがおすすめです。" });
    if (s.style === "purikura" && s.colors.primary === "pastel_pink" && !s.decoration.motifs.includes("subtle_sparkles")) result.push({ id: "pink-sparkle", kind: "suggestion", title: "ピンクに軽いきらめき", body: "小さなきらめきなら、人物を邪魔せずプリクラ感が出ます。", actionLabel: "きらきらを追加", patch: { path: "simple.decoration.motifs", value: "subtle_sparkles", multi: true } });
    if (s.style === "soft" && s.colors.primary === "powder_blue" && !s.rendering.includes("gentle_blur")) result.push({ id: "blue-blur", kind: "suggestion", title: "青系をやわらかく", body: "ぼかしを足すと空気感が整います。", actionLabel: "ぼかしを追加", patch: { path: "simple.rendering", value: "gentle_blur", multi: true } });
  }
  return result;
}

export function enforceExclusions(state: BackgroundState): BackgroundState {
  const next = structuredClone(state);
  if (next.scene.environment.timeOfDay === "night" && next.scene.lighting.primarySource === "direct_sunlight") next.scene.lighting.primarySource = "moonlight";
  if (next.scene.environment.weather === "snow" && next.scene.environment.season === "summer" && next.scene.world.worldType !== "fantasy") next.scene.environment.season = "winter";
  return next;
}
