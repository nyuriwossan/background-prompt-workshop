import { createDefaultState, createDefaultTarget, sceneData, simpleData } from "./background-data.ts";
import type { BackgroundMode, BackgroundState, Option } from "./background-data.ts";
import { createDefaultView, viewData } from "./view-data.ts";

export const CURRENT_VERSION = 2 as const;
export type SavedDesign = { id: string; name: string; savedAt: string; state: BackgroundState };

export function resetConfirmationMessage(mode: BackgroundMode) {
  return `${mode === "scene" ? "空間背景" : "シンプル背景"}の設定を初期状態に戻しますか？`;
}

/** 表示中のモードだけを初期化する。生成先の設定ともう一方のモードは保つ */
export function resetActiveMode(state: BackgroundState, confirmed = true): BackgroundState {
  if (!confirmed) return state;
  const defaults = createDefaultState();

  if (state.backgroundMode === "scene") {
    return { ...state, scene: defaults.scene };
  }

  return { ...state, simple: defaults.simple };
}

/* ------------------------------------------------------------------ */
/* 保存データの読み込みと移行                                            */
/* ------------------------------------------------------------------ */

type Dict = Record<string, unknown>;
const isObject = (value: unknown): value is Dict => typeof value === "object" && value !== null && !Array.isArray(value);
const ids = (list: { id: string }[]) => new Set(list.map((item) => item.id));

/** 単一選択：既知のIDならそのまま、未知なら初期値 */
function pick(value: unknown, list: { id: string }[], fallback: string): string {
  return typeof value === "string" && ids(list).has(value) ? value : fallback;
}
/** 複数選択：既知のIDだけを残し、重複を除く */
/** 件数の上限は画面操作側で守る。古いデータやプリセットに上限超えがあっても、移行では削らない */
function pickMany(value: unknown, list: { id: string }[], fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const known = ids(list);
  return [...new Set(value.filter((item): item is string => typeof item === "string" && known.has(item)))];
}
const section = (value: unknown): Dict => (isObject(value) ? value : {});
const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const negativeItemIds: Option[] = [{ id: "people", label: "", en: "" }, { id: "text", label: "", en: "" }, { id: "watermark", label: "", en: "" }, { id: "creatures", label: "", en: "" }, { id: "clutter", label: "", en: "" }];

/**
 * どの版の保存データでも、現行（v2）の形にそろえて返す。
 * - v1 には生成先・見え方・生き物などがないため、初期値（標準の見え方＝従来と同じ出力）で補う
 * - 壊れた値や未知のIDは、その項目だけ初期値へ戻す（全体は捨てない）
 */
export function migrateState(raw: unknown): BackgroundState {
  const d = createDefaultState();
  if (!isObject(raw)) return d;

  const scene = section(raw.scene);
  const place = section(scene.place);
  const world = section(scene.world);
  const structures = section(scene.structures);
  const environment = section(scene.environment);
  const lighting = section(scene.lighting);
  const atmosphere = section(scene.atmosphere);
  const composition = section(scene.composition);
  const view = section(scene.view);
  const simple = section(raw.simple);
  const colors = section(simple.colors);
  const decoration = section(simple.decoration);
  const target = section(raw.target);
  const ui = section(raw.ui);
  const dv = createDefaultView();
  const dt = createDefaultTarget();

  // 場所カテゴリは舞台から決める（舞台とカテゴリの食い違いで候補が空になるのを防ぐ）
  const stageId = pick(place.mainStage, sceneData.stages, d.scene.place.mainStage);
  const stageCategory = sceneData.stages.find((item) => item.id === stageId)?.group || d.scene.place.category;
  const categoryEnv = sceneData.categories.find((item) => item.id === stageCategory)?.group || d.scene.place.environmentType;
  const environmentType = pick(place.environmentType, sceneData.environmentTypes, categoryEnv);

  return {
    version: CURRENT_VERSION,
    backgroundMode: raw.backgroundMode === "simple" ? "simple" : "scene",
    outputStyle: raw.outputStyle === "detailed" ? "detailed" : "short",
    target: {
      platform: target.platform === "pixai" || target.platform === "novelai" ? target.platform : dt.platform,
      pixaiModel: target.pixaiModel === "tag" ? "tag" : dt.pixaiModel,
      negativeEnabled: bool(target.negativeEnabled, dt.negativeEnabled),
      tsubakiProMode: bool(target.tsubakiProMode, dt.tsubakiProMode),
      negativeItems: pickMany(target.negativeItems, negativeItemIds, dt.negativeItems),
      novelaiEmphasis: bool(target.novelaiEmphasis, dt.novelaiEmphasis),
    },
    scene: {
      subjectRelation: pick(scene.subjectRelation, sceneData.relations, d.scene.subjectRelation),
      place: {
        environmentType,
        category: stageCategory,
        mainStage: stageId,
        stageState: pickMany(place.stageState, sceneData.stageStates, d.scene.place.stageState),
      },
      world: {
        worldType: pick(world.worldType, sceneData.worlds, d.scene.world.worldType),
        era: pick(world.era, sceneData.eras, d.scene.world.era),
        architectureStyle: pickMany(world.architectureStyle, sceneData.architecture, d.scene.world.architectureStyle),
      },
      structures: {
        landmark: pick(structures.landmark, sceneData.landmarks, d.scene.structures.landmark),
        secondary: pickMany(structures.secondary, sceneData.secondary, d.scene.structures.secondary),
        accents: pickMany(structures.accents, sceneData.accents, d.scene.structures.accents),
        creatures: pickMany(structures.creatures, sceneData.creatures, []),
      },
      environment: {
        timeOfDay: pick(environment.timeOfDay, sceneData.times, d.scene.environment.timeOfDay),
        season: pick(environment.season, sceneData.seasons, d.scene.environment.season),
        weather: pick(environment.weather, sceneData.weather, d.scene.environment.weather),
        phenomena: pickMany(environment.phenomena, sceneData.phenomena, d.scene.environment.phenomena),
      },
      lighting: {
        primarySource: pick(lighting.primarySource, sceneData.primaryLights, d.scene.lighting.primarySource),
        secondarySource: pick(lighting.secondarySource, sceneData.secondaryLights, d.scene.lighting.secondarySource),
        direction: pick(lighting.direction, sceneData.directions, d.scene.lighting.direction),
        quality: pick(lighting.quality, sceneData.qualities, d.scene.lighting.quality),
      },
      atmosphere: {
        colorTone: pick(atmosphere.colorTone, sceneData.tones, d.scene.atmosphere.colorTone),
        contrast: pick(atmosphere.contrast, sceneData.contrasts, d.scene.atmosphere.contrast),
        mood: pickMany(atmosphere.mood, sceneData.moods, d.scene.atmosphere.mood),
      },
      composition: {
        perspective: pick(composition.perspective, sceneData.perspectives, d.scene.composition.perspective),
        depthLayers: pick(composition.depthLayers, sceneData.depth, d.scene.composition.depthLayers),
        density: pick(composition.density, sceneData.densities, d.scene.composition.density),
        fantasyEffects: pickMany(composition.fantasyEffects, sceneData.fantasies, d.scene.composition.fantasyEffects),
        blend: pick(composition.blend, sceneData.blends, d.scene.composition.blend),
      },
      view: {
        mode: view.mode === "custom" ? "custom" : "standard",
        vantage: pick(view.vantage, viewData.vantages, dv.vantage),
        targets: (() => { const list = pickMany(view.targets, viewData.viewTargets, dv.targets); return list.length ? list : dv.targets; })(),
        gaze: pick(view.gaze, viewData.gazes, dv.gaze),
        distance: pick(view.distance, viewData.distances, dv.distance),
        altitude: pick(view.altitude, viewData.altitudes, dv.altitude),
        motion: pick(view.motion, viewData.motions, dv.motion),
        motionEffects: pickMany(view.motionEffects, viewData.motionEffects, dv.motionEffects),
        frame: pick(view.frame, viewData.frames, dv.frame),
        frameDetail: pick(view.frameDetail, viewData.windowKinds, dv.frameDetail),
        lens: pick(view.lens, viewData.lenses, dv.lens),
      },
    },
    simple: {
      subjectRelation: pick(simple.subjectRelation, simpleData.relations, d.simple.subjectRelation),
      style: pick(simple.style, simpleData.styles, d.simple.style),
      backgroundType: pick(simple.backgroundType, simpleData.types, d.simple.backgroundType),
      colors: {
        primary: pick(colors.primary, simpleData.colors, d.simple.colors.primary),
        secondary: colors.secondary === "" ? "" : pick(colors.secondary, simpleData.colors, d.simple.colors.secondary),
        intensity: pick(colors.intensity, simpleData.intensities, d.simple.colors.intensity),
      },
      rendering: pickMany(simple.rendering, simpleData.renderings, d.simple.rendering),
      pattern: pick(simple.pattern, simpleData.patterns, d.simple.pattern),
      texture: pick(simple.texture, simpleData.textures, d.simple.texture),
      decoration: {
        enabled: bool(decoration.enabled, d.simple.decoration.enabled),
        motifs: pickMany(decoration.motifs, simpleData.motifs, d.simple.decoration.motifs),
        placement: pick(decoration.placement, simpleData.placements, d.simple.decoration.placement),
        density: pick(decoration.density, simpleData.decorationDensities, d.simple.decoration.density),
      },
    },
    ui: {
      warningsDismissed: Array.isArray(ui.warningsDismissed) ? ui.warningsDismissed.filter((item): item is string => typeof item === "string") : [],
      expandedSections: Array.isArray(ui.expandedSections) ? ui.expandedSections.filter((item): item is string => typeof item === "string") : d.ui.expandedSections,
    },
  };
}

/** 端末内の保存一覧を読み込む。形の壊れた1件があっても、他の保存は残す */
export function migrateSavedList(raw: unknown): SavedDesign[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!isObject(item) || !isObject(item.state)) return [];
    return [{
      id: typeof item.id === "string" && item.id ? item.id : `restored-${index}-${Date.now()}`,
      name: typeof item.name === "string" && item.name ? item.name : "名称未設定",
      savedAt: typeof item.savedAt === "string" ? item.savedAt : new Date(0).toISOString(),
      state: migrateState(item.state),
    }];
  });
}

export type ImportedJson = { kind: "design"; state: BackgroundState } | { kind: "library"; saved: SavedDesign[] };

/** 書き出しJSON（v1・v2）を読み取る。対応外なら Error を投げる */
export function parseImportedJson(value: unknown): ImportedJson {
  if (!isObject(value) || (value.version !== 1 && value.version !== 2)) throw new Error("version");
  if (value.type === "background-workshop-library" && Array.isArray(value.saved)) return { kind: "library", saved: migrateSavedList(value.saved) };
  if (isObject(value.state) && (value.state.version === 1 || value.state.version === 2)) return { kind: "design", state: migrateState(value.state) };
  throw new Error("schema");
}

/**
 * 読み込んだ一覧を、今ある保存へ「追加」する（以前は置き換えだったため、既存の保存が消えることがあった）。
 * 同じIDで同じ内容なら重複として除き、同じIDで内容が違う場合は別IDで追加する。
 */
export function mergeSavedLists(current: SavedDesign[], incoming: SavedDesign[], makeId: () => string): { saved: SavedDesign[]; added: number } {
  const byId = new Map(current.map((item) => [item.id, item]));
  const additions: SavedDesign[] = [];
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (existing && JSON.stringify(existing.state) === JSON.stringify(item.state) && existing.name === item.name) continue;
    const next = existing ? { ...item, id: makeId() } : item;
    byId.set(next.id, next);
    additions.push(next);
  }
  return { saved: [...additions, ...current], added: additions.length };
}

export const exportDesign = (state: BackgroundState) => ({ version: CURRENT_VERSION, type: "background-workshop-design", state });
export const exportLibrary = (saved: SavedDesign[]) => ({ version: CURRENT_VERSION, type: "background-workshop-library", saved });
