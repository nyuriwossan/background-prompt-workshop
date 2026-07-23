import { optionById, sceneData, simpleData } from "./background-data.ts";
import type { BackgroundState, Option } from "./background-data.ts";

const en = (list: Option[], id: string) => optionById(list, id)?.en || "";
const words = (list: Option[], ids: string[]) => ids.map((id) => en(list, id)).filter(Boolean);
const joinNatural = (items: string[]) => items.length < 2 ? items[0] || "" : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
const cap = (value: string) => value ? value[0].toUpperCase() + value.slice(1) : value;
const sentence = (value: string) => value ? `${cap(value.replace(/[,. ]+$/, ""))}.` : "";

function sceneCore(state: BackgroundState) {
  const s = state.scene;
  const stage = en(sceneData.stages, s.place.mainStage) || "a carefully designed setting";
  const states = words(sceneData.stageStates, s.place.stageState);
  if (!states.length) return stage;
  const articleMatch = stage.match(/^(a|an)\s+(.+)$/i);
  return articleMatch
    ? `${articleMatch[1]} ${states.join(", ")} ${articleMatch[2]}`
    : `${states.join(", ")} ${stage}`;
}

function sceneGroups(state: BackgroundState) {
  const s = state.scene;
  const world = [en(sceneData.worlds, s.world.worldType), en(sceneData.eras, s.world.era), ...words(sceneData.architecture, s.world.architectureStyle)].filter(Boolean);
  const environment = [en(sceneData.times, s.environment.timeOfDay), en(sceneData.seasons, s.environment.season), en(sceneData.weather, s.environment.weather), ...words(sceneData.phenomena, s.environment.phenomena)].filter(Boolean);
  const structures = [en(sceneData.landmarks, s.structures.landmark), ...words(sceneData.secondary, s.structures.secondary), ...words(sceneData.accents, s.structures.accents)].filter(Boolean);
  const lightSources = [en(sceneData.primaryLights, s.lighting.primarySource), en(sceneData.secondaryLights, s.lighting.secondarySource)].filter(Boolean);
  const light = lightSources.length ? `lit by ${joinNatural(lightSources)}, ${en(sceneData.directions, s.lighting.direction)}, with ${en(sceneData.qualities, s.lighting.quality)} illumination` : "";
  const space = [en(sceneData.perspectives, s.composition.perspective), en(sceneData.depth, s.composition.depthLayers), en(sceneData.blends, s.composition.blend)].filter(Boolean);
  const atmosphere = [en(sceneData.tones, s.atmosphere.colorTone), en(sceneData.contrasts, s.atmosphere.contrast), ...words(sceneData.moods, s.atmosphere.mood).map((m) => `${m} atmosphere`)].filter(Boolean);
  const fantasy = words(sceneData.fantasies, s.composition.fantasyEffects);
  const relation = en(sceneData.relations, s.subjectRelation);
  const density = en(sceneData.densities, s.composition.density);
  return { world, environment, structures, light, space, atmosphere, fantasy, relation, density };
}

export function generateScenePrompt(state: BackgroundState, style = state.outputStyle) {
  const g = sceneGroups(state);
  const core = sceneCore(state);
  if (style === "short") {
    return [core, g.world.join(", "), g.environment.join(", "), g.structures.join(", "), g.light, g.space.join(", "), g.atmosphere.join(", "), g.fantasy.join(", "), g.relation, g.density]
      .filter(Boolean).join(", ").replace(/,\s*,/g, ",");
  }
  const opening = [core, g.world.length ? `shaped by ${joinNatural(g.world)}` : "", g.environment.join(" ")].filter(Boolean).join(", ");
  const structureSentence = g.structures.length ? `The scene is organized around ${joinNatural(g.structures)}` : "The scene uses restrained environmental forms";
  const spaceSentence = g.space.length ? `${cap(joinNatural(g.space))} guide the eye through the setting` : "The space remains clearly organized";
  const atmosphereSentence = g.atmosphere.length ? `${cap(joinNatural(g.atmosphere))} establish the visual mood` : "A balanced atmosphere unifies the scene";
  const ending = [g.fantasy.length ? `subtle ${joinNatural(g.fantasy)}` : "", g.density, g.relation].filter(Boolean).join(", ");
  return [sentence(opening), sentence(`${structureSentence}${g.light ? `, ${g.light}` : ""}`), sentence(spaceSentence), sentence(`${atmosphereSentence}${ending ? `, with ${ending}` : ""}`)].join(" ");
}

export function generateSimplePrompt(state: BackgroundState, style = state.outputStyle) {
  const s = state.simple;
  const primary = en(simpleData.colors, s.colors.primary);
  const secondary = en(simpleData.colors, s.colors.secondary);
  const color = [en(simpleData.intensities, s.colors.intensity), primary, secondary ? `and ${secondary}` : ""].filter(Boolean).join(" ");
  const type = en(simpleData.types, s.backgroundType);
  const render = words(simpleData.renderings, s.rendering);
  const motifs = s.decoration.enabled ? words(simpleData.motifs, s.decoration.motifs) : [];
  const character = en(simpleData.styles, s.style);
  const relation = en(simpleData.relations, s.subjectRelation);
  if (style === "short") return [`${color} ${type}`, ...render, ...motifs, `${character} finish`, relation].filter(Boolean).join(", ");
  const detail = [...render, ...motifs];
  return sentence(`A ${color} ${type}${detail.length ? ` with ${joinNatural(detail)}` : ""}, creating a ${character} finish while remaining ${relation}`);
}

export function generatePrompt(state: BackgroundState, style = state.outputStyle) {
  return state.backgroundMode === "scene" ? generateScenePrompt(state, style) : generateSimplePrompt(state, style);
}

export function japaneseSummary(state: BackgroundState) {
  const label = (list: Option[], id: string) => optionById(list, id)?.label || "";
  if (state.backgroundMode === "scene") {
    const s = state.scene;
    return [label(sceneData.stages, s.place.mainStage), label(sceneData.times, s.environment.timeOfDay), label(sceneData.weather, s.environment.weather), label(sceneData.tones, s.atmosphere.colorTone), label(sceneData.relations, s.subjectRelation)].filter(Boolean).join(" ・ ");
  }
  const s = state.simple;
  return [label(simpleData.styles, s.style), label(simpleData.types, s.backgroundType), label(simpleData.colors, s.colors.primary), label(simpleData.relations, s.subjectRelation)].filter(Boolean).join(" ・ ");
}
