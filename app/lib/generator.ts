import { optionById, sceneData, simpleData } from "./background-data.ts";
import type { BackgroundState, Option, OutputStyle } from "./background-data.ts";
import { migrateState } from "./state-utils.ts";
import { getViewAvailability } from "./view-rules.ts";
import { viewData } from "./view-data.ts";
import type { ViewOption, ViewState } from "./view-data.ts";

type AnyOption = Option | ViewOption;
const en = (list: AnyOption[], id: string) => list.find((item) => item.id === id)?.en || "";
const words = (list: AnyOption[], ids: string[]) => ids.map((id) => en(list, id)).filter(Boolean);
const joinNatural = (items: string[]) => items.length < 2 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const cap = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;
const article = (phrase: string) => `${/^[aeiou]/i.test(phrase) ? "an" : "a"} ${phrase}`;
const sentence = (value: string) => value ? `${cap(value.replace(/[,. ]+$/, ""))}.` : "";

/** タグ系向け：自然文の句から冠詞・前置詞を外して短い句にする */
const LEADING = /^(?:a|an|the|at|in|during|under|with|lit from|the soft glow of|the glow of|the sparkle of|the orange glow of)\s+/i;
export function tagify(text: string): string {
  let value = text.trim();
  for (let i = 0; i < 3; i += 1) value = value.replace(LEADING, "");
  return value;
}
const tagOf = (list: AnyOption[], id: string) => {
  const item = list.find((option) => option.id === id);
  if (!item) return "";
  return typeof item.tag === "string" ? item.tag : item.en ? tagify(item.en) : "";
};
const tagsOf = (list: AnyOption[], ids: string[]) => ids.map((id) => tagOf(list, id)).filter(Boolean);
const uniqueTags = (items: string[]) => {
  const seen = new Set<string>();
  return items.flatMap((item) => item.split(/,\s*/)).map((item) => item.trim()).filter((item) => {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* ------------------------------------------------------------------ */
/* 空間背景：共通の意味ブロック                                          */
/* ------------------------------------------------------------------ */

function sceneCore(state: BackgroundState) {
  const s = state.scene;
  const stage = en(sceneData.stages, s.place.mainStage) || "a carefully designed setting";
  const states = words(sceneData.stageStates, s.place.stageState);
  if (!states.length) return stage;
  const articleMatch = stage.match(/^(a|an)\s+(.+)$/i);
  // 冠詞は、状態語を前に足したあとの最初の語に合わせる（a lived-in / an abandoned）
  return articleMatch
    ? `${article(states.join(", ")).split(" ")[0]} ${states.join(", ")} ${articleMatch[2]}`
    : `${states.join(", ")} ${stage}`;
}

function lightPhrase(state: BackgroundState) {
  const s = state.scene;
  const sources = [en(sceneData.primaryLights, s.lighting.primarySource), en(sceneData.secondaryLights, s.lighting.secondarySource)].filter(Boolean);
  const direction = en(sceneData.directions, s.lighting.direction);
  const quality = en(sceneData.qualities, s.lighting.quality);
  if (!sources.length) return [direction, quality ? `with ${quality} illumination` : ""].filter(Boolean).join(", ");
  return [`lit by ${joinNatural(sources)}`, direction, quality ? `with ${quality} illumination` : ""].filter(Boolean).join(", ");
}

function sceneGroups(state: BackgroundState, active: ViewState | null) {
  const s = state.scene;
  const world = [en(sceneData.worlds, s.world.worldType), en(sceneData.eras, s.world.era), ...words(sceneData.architecture, s.world.architectureStyle)].filter(Boolean);
  const environment = [en(sceneData.times, s.environment.timeOfDay), en(sceneData.seasons, s.environment.season), en(sceneData.weather, s.environment.weather), ...words(sceneData.phenomena, s.environment.phenomena)].filter(Boolean);
  const structures = [en(sceneData.landmarks, s.structures.landmark), ...words(sceneData.secondary, s.structures.secondary), ...words(sceneData.accents, s.structures.accents), ...words(sceneData.creatures, s.structures.creatures)].filter(Boolean);
  const light = lightPhrase(state);
  // 細かく指定した見え方では、視線が「高い視点・低い視点」の役割を担うため、従来の視点は出力しない（画角だけ残す）
  const perspective = active ? en(viewData.lenses, active.lens) : en(sceneData.perspectives, s.composition.perspective);
  const space = [perspective, en(sceneData.depth, s.composition.depthLayers), en(sceneData.blends, s.composition.blend)].filter(Boolean);
  const atmosphere = [en(sceneData.tones, s.atmosphere.colorTone), en(sceneData.contrasts, s.atmosphere.contrast), ...words(sceneData.moods, s.atmosphere.mood).map((m) => `${m} atmosphere`)].filter(Boolean);
  const fantasy = words(sceneData.fantasies, s.composition.fantasyEffects);
  const relation = en(sceneData.relations, s.subjectRelation);
  const density = en(sceneData.densities, s.composition.density);
  return { world, environment, structures, light, space, atmosphere, fantasy, relation, density };
}

/* ------------------------------------------------------------------ */
/* 見え方：「どこから・何を・どの向きに」を英文の主語の位置に置く               */
/* ------------------------------------------------------------------ */

const ALTITUDE_SHORT: Record<string, string> = { ground_level: "just above the ground", low: "at low altitude", mid: "at a moderate altitude", high: "at high altitude", above_clouds: "far above the clouds" };
const GAZE_SUFFIX: Record<string, string> = { forward: "", up_diagonal: " above", straight_up: " directly above", down_diagonal: " below", straight_down: " directly below", horizon_far: " in the distance" };
const GAZE_BARE: Record<string, string> = { forward: "looking straight ahead", up_diagonal: "looking up", straight_up: "looking straight up", down_diagonal: "looking down", straight_down: "looking straight down", horizon_far: "gazing into the distance", feet: "looking down at the ground underfoot" };

export type ViewSentence = {
  /** 例：from high in the sky, looking down at a bustling harbor town and the open sea below, as the viewpoint flies through the air, seen from far away */
  lead: string;
  /** 動きの演出（風・雲など） */
  effects: string[];
  /** 舞台名が lead の中に含まれているか（含まれていれば場所名を重ねて書かない） */
  stageMentioned: boolean;
};

export function buildViewSentence(state: BackgroundState, view: ViewState): ViewSentence {
  const stage = optionById(sceneData.stages, state.scene.place.mainStage);
  const core = sceneCore(state);
  const vantage = viewData.vantages.find((item) => item.id === view.vantage) || viewData.vantages[0];
  const altitude = en(viewData.altitudes, view.altitude);
  const includesMain = view.targets.includes("main_stage");

  let where = "";
  let stageInWhere = false;
  const mediumMatches = (stage?.medium === "aerial" && vantage.level === "aerial") || (stage?.medium === "underwater" && vantage.level === "underwater");
  if (stage?.impliedVantage && stage.impliedVantage === vantage.id) {
    where = `from ${core}`; stageInWhere = true;
  } else if (mediumMatches) {
    where = [`from within ${core}`, ALTITUDE_SHORT[view.altitude] || ""].filter(Boolean).join(" "); stageInWhere = true;
  } else if (includesMain) {
    where = altitude || vantage.en;
  } else if (altitude) {
    where = `${altitude} over ${core}`; stageInWhere = true;
  } else {
    where = (vantage.withStage || `${vantage.en} near {s}`).replace("{s}", core); stageInWhere = true;
  }

  const targetPhrases = view.targets
    .map((id) => (id === "main_stage" ? (stageInWhere ? "" : core) : en(viewData.viewTargets, id)))
    .filter(Boolean);
  const targetText = joinNatural(targetPhrases);
  let gaze = "";
  if (view.gaze === "feet") {
    gaze = GAZE_BARE.feet + (targetText ? `, with ${targetText} in view` : "");
  } else if (targetText) {
    gaze = `${en(viewData.gazes, view.gaze)} ${targetText}${GAZE_SUFFIX[view.gaze] ?? ""}`;
  } else {
    gaze = GAZE_BARE[view.gaze] || "";
  }

  const windowKind = en(viewData.windowKinds, view.frameDetail) || "a window";
  const frame = en(viewData.frames, view.frame).replace("{w}", windowKind);
  const motionTarget = targetText || core;
  const motion = en(viewData.motions, view.motion).replace("{t}", motionTarget);
  const distance = en(viewData.distances, view.distance);
  const lead = [where, gaze, frame, motion, distance].filter(Boolean).join(", ");
  return { lead, effects: words(viewData.motionEffects, view.motionEffects), stageMentioned: stageInWhere || includesMain };
}

/** タグ系向けの見え方タグ（場所の名前は含めない） */
function viewTags(state: BackgroundState, view: ViewState): string[] {
  const tags = [
    view.altitude ? tagOf(viewData.altitudes, view.altitude) : "",
    viewData.vantages.find((item) => item.id === view.vantage)?.tag || "",
    tagOf(viewData.gazes, view.gaze),
    ...view.targets.filter((id) => id !== "main_stage").map((id) => viewData.viewTargets.find((item) => item.id === id)?.tag || ""),
    viewData.distances.find((item) => item.id === view.distance)?.tag || "",
    viewData.motions.find((item) => item.id === view.motion)?.tag || "",
    ...view.motionEffects.map((id) => viewData.motionEffects.find((item) => item.id === id)?.tag || ""),
    viewData.frames.find((item) => item.id === view.frame)?.tag || "",
    view.frame === "window" ? viewData.windowKinds.find((item) => item.id === view.frameDetail)?.tag || "" : "",
    viewData.lenses.find((item) => item.id === view.lens)?.tag || "",
  ];
  return uniqueTags(tags);
}

/* ------------------------------------------------------------------ */
/* 生成先ごとの出力                                                    */
/* ------------------------------------------------------------------ */

export type PromptResult = {
  positive: string;
  /** null = この生成先・モードではネガティブ欄を出さない */
  negative: string | null;
  /** 画面に添える短い説明（任意） */
  notes: string[];
};

const PERSPECTIVE_NATURAL: Record<string, string> = { eye_level: "seen at eye level", low_angle: "seen from a low angle", high_angle: "seen from a high angle", wide: "shown in a wide establishing view" };
const PERSPECTIVE_TAG: Record<string, string> = { eye_level: "eye level", low_angle: "from below", high_angle: "from above", wide: "wide shot" };
const RELATION_TAG: Record<string, string> = { character_focus: "", balanced: "detailed background", background_focus: "scenery, detailed background", background_only: "no humans, scenery" };
const DIRECTION_TAG: Record<string, string> = { front: "front lighting", side: "side lighting", back: "backlighting", top: "overhead lighting", scattered: "scattered light" };
const BLEND_TAG: Record<string, string> = { soft_blur: "depth of field", atmospheric: "atmospheric perspective", clear: "" };

/** 従来（v1）と同じ汎用出力。標準の見え方では1文字も変わらない */
function genericScene(state: BackgroundState, style: OutputStyle, active: ViewState | null) {
  const g = sceneGroups(state, active);
  const core = sceneCore(state);
  const view = active ? buildViewSentence(state, active) : null;
  const viewLead = view ? `viewed ${view.lead}` : "";
  if (style === "short") {
    return [viewLead, ...(view?.effects || []), view?.stageMentioned ? "" : core, g.world.join(", "), g.environment.join(", "), g.structures.join(", "), g.light, g.space.join(", "), g.atmosphere.join(", "), g.fantasy.join(", "), g.relation, g.density]
      .filter(Boolean).join(", ").replace(/,\s*,/g, ",");
  }
  const openingParts = [g.world.length ? `shaped by ${joinNatural(g.world)}` : "", g.environment.join(" ")].filter(Boolean);
  let opening = [core, ...openingParts].join(", ");
  if (view) {
    // 見え方を指定したときは、環境を読みやすく区切る（従来の標準出力は変えない）
    const s = state.scene;
    const timeWeather = [en(sceneData.times, s.environment.timeOfDay), en(sceneData.seasons, s.environment.season), en(sceneData.weather, s.environment.weather)].filter(Boolean).join(" ");
    const phenomena = words(sceneData.phenomena, s.environment.phenomena);
    const env = [timeWeather, phenomena.length ? `with ${joinNatural(phenomena)}` : ""].filter(Boolean).join(", ");
    const parts = [g.world.length ? `shaped by ${joinNatural(g.world)}` : "", env ? `set ${env}` : ""].filter(Boolean);
    opening = view.stageMentioned ? (parts.length ? `The scene is ${parts.join(", ")}` : "") : [core, ...parts].join(", ");
  }
  const structureSentence = g.structures.length ? `The scene is organized around ${joinNatural(g.structures)}` : "The scene uses restrained environmental forms";
  const spaceSentence = g.space.length ? `${cap(joinNatural(g.space))} guide the eye through the setting` : "The space remains clearly organized";
  const atmosphereSentence = g.atmosphere.length ? `${cap(joinNatural(g.atmosphere))} establish the visual mood` : "A balanced atmosphere unifies the scene";
  const ending = [g.fantasy.length ? `subtle ${joinNatural(g.fantasy)}` : "", g.density, g.relation].filter(Boolean).join(", ");
  const viewSentence = view ? sentence(`Viewed ${view.lead}${view.effects.length ? `, with ${joinNatural(view.effects)}` : ""}`) : "";
  return [viewSentence, sentence(opening), sentence(`${structureSentence}${g.light ? `, ${g.light}` : ""}`), sentence(spaceSentence), sentence(`${atmosphereSentence}${ending ? `, with ${ending}` : ""}`)].filter(Boolean).join(" ");
}

/** PIXAI Tsubaki系：位置関係が分かる、短い自然文 */
function tsubakiScene(state: BackgroundState, style: OutputStyle, active: ViewState | null, negativeHandlesPeople: boolean) {
  const s = state.scene;
  const g = sceneGroups(state, active);
  const core = sceneCore(state);
  const view = active ? buildViewSentence(state, active) : null;
  const perspective = active ? "" : PERSPECTIVE_NATURAL[s.composition.perspective] || "";

  const lead = view
    ? sentence(`A view ${view.lead}${view.effects.length ? `, with ${joinNatural(view.effects)}` : ""}`)
    : sentence([`The background shows ${core}`, perspective].filter(Boolean).join(", "));
  const placeLine = view && !view.stageMentioned ? `The location is ${core}` : "";
  const worldText = [en(sceneData.worlds, s.world.worldType), en(sceneData.eras, s.world.era)].filter(Boolean);
  const architecture = words(sceneData.architecture, s.world.architectureStyle);
  const worldLine = worldText.length
    ? `It has ${article(`${worldText.join(", ")} setting`)}${architecture.length ? ` with ${joinNatural(architecture)}` : ""}`
    : architecture.length ? `It features ${joinNatural(architecture)}` : "";
  const timeWeather = [en(sceneData.times, s.environment.timeOfDay), en(sceneData.seasons, s.environment.season), en(sceneData.weather, s.environment.weather)].filter(Boolean).join(", ");
  const phenomena = words(sceneData.phenomena, s.environment.phenomena);
  const environmentLine = [timeWeather ? `It is ${timeWeather}` : "", phenomena.length ? `with ${joinNatural(phenomena)}` : ""].filter(Boolean).join(", ");
  const structureLine = g.structures.length ? `The scene features ${joinNatural(g.structures)}` : "";
  const lightLine = g.light ? `It is ${g.light}` : "";
  const moods = words(sceneData.moods, s.atmosphere.mood);
  const toneLine = [en(sceneData.tones, s.atmosphere.colorTone), en(sceneData.contrasts, s.atmosphere.contrast)].filter(Boolean);
  const atmosphereLine = [toneLine.length ? `in ${joinNatural(toneLine)}` : "", moods.length ? `with ${article(`${moods.join(", ")} atmosphere`)}` : ""].filter(Boolean);
  const spaceLine = [...g.space, ...(g.fantasy.length ? [`subtle ${joinNatural(g.fantasy)}`] : []), g.density].filter(Boolean);
  const relation = s.subjectRelation === "background_only" && !negativeHandlesPeople ? `${g.relation}, with no people in the scene` : g.relation;

  if (style === "short") {
    const settingLine = worldLine
      ? [worldLine, timeWeather, phenomena.length ? `with ${joinNatural(phenomena)}` : ""].filter(Boolean).join(", ")
      : environmentLine;
    return [
      lead,
      sentence(placeLine),
      sentence(settingLine),
      sentence(structureLine),
      sentence([lightLine || "It is", ...atmosphereLine].filter(Boolean).join(", ").replace(/^It is, /, "It is ")),
      sentence(relation),
    ].filter(Boolean).join(" ");
  }
  return [
    lead,
    sentence(placeLine),
    sentence(worldLine),
    sentence(environmentLine),
    sentence(structureLine),
    sentence(lightLine),
    toneLine.length || moods.length ? sentence(`The palette uses ${[joinNatural(toneLine), moods.length ? article(`${moods.join(", ")} mood`) : ""].filter(Boolean).join(", with ")}`) : "",
    spaceLine.length ? sentence(`The composition uses ${joinNatural(spaceLine)}`) : "",
    sentence(relation),
  ].filter(Boolean).join(" ");
}

/** タグ系（PIXAIのタグ系モデル・NovelAI）共通の部品 */
function sceneTagBlocks(state: BackgroundState, active: ViewState | null) {
  const s = state.scene;
  const stage = optionById(sceneData.stages, s.place.mainStage);
  const place = [...s.place.stageState.map((id) => tagOf(sceneData.stageStates, id)), stage ? tagify(stage.en) : ""].filter(Boolean).join(" ");
  return {
    relation: RELATION_TAG[s.subjectRelation] || "",
    view: active ? viewTags(state, active) : [PERSPECTIVE_TAG[s.composition.perspective] || ""].filter(Boolean),
    place,
    world: [tagOf(sceneData.worlds, s.world.worldType), tagOf(sceneData.eras, s.world.era), ...tagsOf(sceneData.architecture, s.world.architectureStyle)],
    environment: [tagOf(sceneData.times, s.environment.timeOfDay), tagOf(sceneData.seasons, s.environment.season), tagOf(sceneData.weather, s.environment.weather), ...tagsOf(sceneData.phenomena, s.environment.phenomena)],
    structures: [tagOf(sceneData.landmarks, s.structures.landmark), ...tagsOf(sceneData.secondary, s.structures.secondary), ...tagsOf(sceneData.accents, s.structures.accents)],
    creatures: tagsOf(sceneData.creatures, s.structures.creatures),
    light: [tagOf(sceneData.primaryLights, s.lighting.primarySource), tagOf(sceneData.secondaryLights, s.lighting.secondarySource)],
    lightDetail: [DIRECTION_TAG[s.lighting.direction] || "", s.lighting.quality ? `${tagOf(sceneData.qualities, s.lighting.quality)} lighting` : ""],
    atmosphere: [tagOf(sceneData.tones, s.atmosphere.colorTone), ...s.atmosphere.mood.map((id) => `${tagOf(sceneData.moods, id)} atmosphere`)],
    atmosphereDetail: [tagOf(sceneData.contrasts, s.atmosphere.contrast)],
    space: [tagOf(sceneData.depth, s.composition.depthLayers), BLEND_TAG[s.composition.blend] || "", ...tagsOf(sceneData.fantasies, s.composition.fantasyEffects)],
    density: [tagOf(sceneData.densities, s.composition.density)],
  };
}

function pixaiTagScene(state: BackgroundState, style: OutputStyle, active: ViewState | null) {
  const b = sceneTagBlocks(state, active);
  const view = active ? buildViewSentence(state, active) : null;
  const items = style === "short"
    ? [b.relation, b.place, ...b.view, ...b.world, ...b.environment, ...b.structures, ...b.creatures, ...b.light, ...b.atmosphere]
    : [b.relation, b.place, ...b.view, view ? `view ${view.lead}` : "", ...b.world, ...b.environment, ...b.structures, ...b.creatures, ...b.light, ...b.lightDetail, ...b.atmosphere, ...b.atmosphereDetail, ...b.space, ...b.density];
  return uniqueTags(items.filter(Boolean)).join(", ");
}

function novelaiScene(state: BackgroundState, style: OutputStyle, active: ViewState | null) {
  const b = sceneTagBlocks(state, active);
  const view = active ? buildViewSentence(state, active) : null;
  const relation = uniqueTags([b.relation]);
  const viewTagsList = uniqueTags(b.view).filter((tag) => !relation.some((item) => item.toLowerCase() === tag.toLowerCase()));
  let viewBlock = viewTagsList.join(", ");
  if (viewBlock && active && state.target.novelaiEmphasis) viewBlock = `1.2::${viewBlock} ::`;
  const rest = style === "short"
    ? [b.place, ...b.world, ...b.environment, ...b.structures, ...b.creatures, ...b.light, ...b.atmosphere, ...b.space.slice(0, 1)]
    : [b.place, ...b.world, ...b.environment, ...b.structures, ...b.creatures, ...b.light, ...b.lightDetail, ...b.atmosphere, ...b.atmosphereDetail, ...b.space, ...b.density];
  const restTags = uniqueTags(rest.filter(Boolean)).filter((tag) => !viewTagsList.includes(tag) && !relation.includes(tag));
  const phrase = style === "detailed" && view ? [`view ${view.lead}`] : [];
  return [...relation, viewBlock, ...phrase, ...restTags].filter(Boolean).join(", ");
}

/* ------------------------------------------------------------------ */
/* シンプル背景                                                        */
/* ------------------------------------------------------------------ */

function simpleParts(state: BackgroundState) {
  const s = state.simple;
  const primary = en(simpleData.colors, s.colors.primary);
  const secondary = en(simpleData.colors, s.colors.secondary);
  const color = [en(simpleData.intensities, s.colors.intensity), primary, secondary ? `and ${secondary}` : ""].filter(Boolean).join(" ");
  const type = en(simpleData.types, s.backgroundType);
  const pattern = s.backgroundType === "pattern" ? en(simpleData.patterns, s.pattern) : "";
  const texture = s.backgroundType === "texture" ? en(simpleData.textures, s.texture) : "";
  const render = words(simpleData.renderings, s.rendering);
  const motifs = s.decoration.enabled ? words(simpleData.motifs, s.decoration.motifs) : [];
  const placement = s.decoration.enabled && motifs.length ? en(simpleData.placements, s.decoration.placement) : "";
  const density = s.decoration.enabled && motifs.length ? en(simpleData.decorationDensities, s.decoration.density) : "";
  return { s, primary, secondary, color, type, pattern, texture, render, motifs, placement, density, character: en(simpleData.styles, s.style), relation: en(simpleData.relations, s.subjectRelation) };
}

function genericSimple(state: BackgroundState, style: OutputStyle) {
  const p = simpleParts(state);
  const decoration = p.motifs.length && (p.placement || p.density) ? [`${p.density ? `${p.density} ` : ""}${joinNatural(p.motifs)}${p.placement ? ` ${p.placement}` : ""}`] : p.motifs;
  if (style === "short") return [`${p.color} ${p.type}`, p.pattern, p.texture, ...p.render, ...(p.placement || p.density ? decoration : p.motifs), `${p.character} finish`, p.relation].filter(Boolean).join(", ");
  const detail = [p.pattern, p.texture, ...p.render, ...decoration].filter(Boolean);
  return sentence(`A ${p.color} ${p.type}${detail.length ? ` with ${joinNatural(detail)}` : ""}, creating a ${p.character} finish while remaining ${p.relation}`);
}

function tsubakiSimple(state: BackgroundState, style: OutputStyle, negativeHandlesPeople: boolean) {
  const p = simpleParts(state);
  const base = sentence(`A ${p.color} ${p.type.replace("backdrop", "background")}${p.pattern ? ` with ${p.pattern}` : ""}${p.texture ? ` with ${p.texture}` : ""}`);
  const render = p.render.length ? sentence(`It has ${joinNatural(p.render)}`) : "";
  const decoration = p.motifs.length ? sentence(`It is decorated with ${p.density ? `${p.density} ` : ""}${joinNatural(p.motifs)}${p.placement ? ` ${p.placement}` : ""}`) : "";
  const relation = p.s.subjectRelation === "background_only" && !negativeHandlesPeople ? "an empty standalone background with no people" : p.relation;
  const finish = sentence(`The look is ${p.character}, ${relation}`);
  return (style === "short" ? [base, decoration, finish] : [base, render, decoration, finish]).filter(Boolean).join(" ");
}

function tagSimple(state: BackgroundState, style: OutputStyle, novelai: boolean) {
  const p = simpleParts(state);
  const s = p.s;
  const typeTag: Record<string, string> = { solid: "", gradient: "gradient background", soft_abstract: "abstract background", studio: "studio background", pattern: "", texture: "" };
  const colorTags = [p.primary ? `${p.primary} background` : "", p.secondary ? `${p.secondary} background` : ""];
  const items = [
    s.subjectRelation === "background_only" ? "no humans" : "",
    "simple background",
    ...colorTags,
    typeTag[s.backgroundType] || "",
    s.backgroundType === "pattern" ? tagOf(simpleData.patterns, s.pattern) : "",
    s.backgroundType === "texture" ? tagOf(simpleData.textures, s.texture) : "",
    ...(style === "detailed" || novelai ? tagsOf(simpleData.renderings, s.rendering) : tagsOf(simpleData.renderings, s.rendering).slice(0, 2)),
    ...tagsOf(simpleData.motifs, s.decoration.enabled ? s.decoration.motifs : []),
    style === "detailed" ? p.placement : "",
    style === "detailed" && p.density ? `${p.density} decorations` : "",
  ];
  return uniqueTags(items.filter(Boolean)).join(", ");
}

/* ------------------------------------------------------------------ */
/* ネガティブ（Undesired Content）                                       */
/* ------------------------------------------------------------------ */

export const negativeOptions = [
  { id: "people", label: "人物", tag: "people, 1girl, 1boy, crowd", natural: "people, characters", note: "背景のみのときだけ使います" },
  { id: "text", label: "文字・ロゴ", tag: "text, logo", natural: "text, letters, logos" },
  { id: "watermark", label: "透かし・署名", tag: "watermark, signature", natural: "watermark, signature" },
  { id: "creatures", label: "生き物", tag: "animal, creature", natural: "animals, creatures", note: "生き物を選んでいないときだけ使います" },
  { id: "clutter", label: "ごちゃつき", tag: "cluttered background", natural: "cluttered background" },
];

export function negativeSupport(state: BackgroundState): { supported: boolean; label: string; reason: string } {
  const t = state.target;
  if (t.platform === "novelai") return { supported: true, label: "Undesired Content", reason: "NovelAIのUndesired Content欄に貼ります。既存のUCプリセットと併用できます。" };
  if (t.platform === "pixai" && t.pixaiModel === "tag") return { supported: true, label: "ネガティブプロンプト", reason: "PIXAIのネガティブプロンプト欄に貼ります。" };
  if (t.platform === "pixai" && t.tsubakiProMode) return { supported: true, label: "ネガティブプロンプト（Pro / Ultra）", reason: "Tsubaki系ではPro・Ultraモードでのみネガティブ欄を編集できます。" };
  if (t.platform === "pixai") return { supported: false, label: "", reason: "Tsubaki系のLite・Standardではネガティブ欄を編集できないため、出力しません。" };
  return { supported: false, label: "", reason: "汎用出力ではネガティブを作りません。生成先を選ぶと使えます。" };
}

/** 今の設定で使えるネガティブ項目（人物は「背景のみ」のとき、生き物は生き物を選んでいないときだけ） */
export function negativeItemAvailability(state: BackgroundState): Record<string, string> {
  const relation = state.backgroundMode === "scene" ? state.scene.subjectRelation : state.simple.subjectRelation;
  const disabled: Record<string, string> = {};
  if (relation !== "background_only") disabled.people = "人物を描く設定なので外しています（比重を「背景のみ」にすると使えます）";
  if (state.backgroundMode === "scene" && state.scene.structures.creatures.length) disabled.creatures = "生き物を描く設定なので外しています";
  return disabled;
}

function negativePrompt(state: BackgroundState): string | null {
  const support = negativeSupport(state);
  if (!support.supported || !state.target.negativeEnabled) return null;
  const disabled = negativeItemAvailability(state);
  const natural = state.target.platform === "pixai" && state.target.pixaiModel === "tsubaki";
  const items = negativeOptions.filter((item) => state.target.negativeItems.includes(item.id) && !disabled[item.id]).map((item) => (natural ? item.natural : item.tag));
  return uniqueTags(items).join(", ");
}

/* ------------------------------------------------------------------ */
/* 公開API                                                            */
/* ------------------------------------------------------------------ */

export function generateOutput(input: BackgroundState, style: OutputStyle = input.outputStyle): PromptResult {
  // 旧形式のまま渡された場合も、移行してから生成する（画面では読み込み時に移行済み）
  const state = input.version === 2 && input.target && input.scene?.view ? input : migrateState(input);
  const negative = negativePrompt(state);
  const negativeHandlesPeople = Boolean(negative && state.target.negativeItems.includes("people") && !negativeItemAvailability(state).people);
  const notes: string[] = [];
  const { platform, pixaiModel } = state.target;

  if (state.backgroundMode === "simple") {
    const positive = platform === "pixai" && pixaiModel === "tsubaki" ? tsubakiSimple(state, style, negativeHandlesPeople)
      : platform === "pixai" ? tagSimple(state, style, false)
      : platform === "novelai" ? tagSimple(state, style, true)
      : genericSimple(state, style);
    return { positive, negative, notes };
  }

  const active = getViewAvailability(state).active;
  if (platform === "pixai" && pixaiModel === "tsubaki") {
    if (state.scene.subjectRelation === "background_only" && !negativeHandlesPeople) notes.push("ネガティブ欄が使えないため、「人物を入れない」ことは本文に一言だけ添えています。");
    return { positive: tsubakiScene(state, style, active, negativeHandlesPeople), negative, notes };
  }
  if (platform === "pixai") return { positive: pixaiTagScene(state, style, active), negative, notes };
  if (platform === "novelai") return { positive: novelaiScene(state, style, active), negative, notes };
  return { positive: genericScene(state, style, active), negative, notes };
}

export function generateScenePrompt(state: BackgroundState, style: OutputStyle = state.outputStyle) {
  return generateOutput({ ...state, backgroundMode: "scene" }, style).positive;
}

export function generateSimplePrompt(state: BackgroundState, style: OutputStyle = state.outputStyle) {
  return generateOutput({ ...state, backgroundMode: "simple" }, style).positive;
}

export function generatePrompt(state: BackgroundState, style: OutputStyle = state.outputStyle) {
  return generateOutput(state, style).positive;
}

export function japaneseSummary(state: BackgroundState) {
  const label = (list: Option[], id: string) => optionById(list, id)?.label || "";
  if (state.backgroundMode === "scene") {
    const s = state.scene;
    return [label(sceneData.stages, s.place.mainStage), label(sceneData.times, s.environment.timeOfDay), label(sceneData.weather, s.environment.weather), label(sceneData.tones, s.atmosphere.colorTone), label(sceneData.relations, s.subjectRelation)].filter((item) => item && item !== "指定しない").join(" ・ ");
  }
  const s = state.simple;
  return [label(simpleData.styles, s.style), label(simpleData.types, s.backgroundType), label(simpleData.colors, s.colors.primary), label(simpleData.relations, s.subjectRelation)].filter(Boolean).join(" ・ ");
}
