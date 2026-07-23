import assert from "node:assert/strict";
import test from "node:test";
import { enforceExclusions, getAdvice } from "../app/lib/advisor.ts";
import { createDefaultState, presetGroups, presets, sceneData, simpleData } from "../app/lib/background-data.ts";
import type { BackgroundState, Option } from "../app/lib/background-data.ts";
import { generatePrompt, generateScenePrompt, generateSimplePrompt } from "../app/lib/generator.ts";
import { resetActiveMode, resetConfirmationMessage } from "../app/lib/state-utils.ts";

const applyPreset = (id: string): BackgroundState => {
  const preset = presets.find((item) => item.id === id);
  assert.ok(preset, `missing preset: ${id}`);
  return { ...createDefaultState(), ...structuredClone(preset.patch), backgroundMode: preset.mode } as BackgroundState;
};

test("all master IDs are unique within their collections", () => {
  for (const collection of [...Object.values(sceneData), ...Object.values(simpleData)]) {
    if (!Array.isArray(collection)) continue;
    const ids = collection.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(collection.every((item) => item.label && typeof item.en === "string"));
  }
});

test("all preset IDs are unique and expected preset counts are present", () => {
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);
  assert.equal(presets.filter((preset) => preset.mode === "scene").length, 21);
  assert.equal(presets.filter((preset) => preset.mode === "simple").length, 10);
});

test("preset groups are valid for their background mode", () => {
  for (const preset of presets) {
    assert.ok(presetGroups[preset.mode].some((group) => group.id === preset.group), `${preset.id}: ${preset.group}`);
  }
  assert.equal(presetGroups.scene[0].id, "recommended");
  assert.equal(presetGroups.simple[0].id, "recommended");
});

test("every scene preset references existing option IDs", () => {
  const ids = (options: Option[]) => new Set(options.map((item) => item.id));
  const known = {
    relations: ids(sceneData.relations), stages: ids(sceneData.stages), states: ids(sceneData.stageStates),
    worlds: ids(sceneData.worlds), eras: ids(sceneData.eras), architecture: ids(sceneData.architecture),
    landmarks: ids(sceneData.landmarks), secondary: ids(sceneData.secondary), accents: ids(sceneData.accents),
    times: ids(sceneData.times), seasons: ids(sceneData.seasons), weather: ids(sceneData.weather),
    phenomena: ids(sceneData.phenomena), primaryLights: ids(sceneData.primaryLights),
    secondaryLights: ids(sceneData.secondaryLights), directions: ids(sceneData.directions),
    qualities: ids(sceneData.qualities), tones: ids(sceneData.tones), contrasts: ids(sceneData.contrasts),
    moods: ids(sceneData.moods), perspectives: ids(sceneData.perspectives), depth: ids(sceneData.depth),
    densities: ids(sceneData.densities), fantasies: ids(sceneData.fantasies), blends: ids(sceneData.blends),
  };
  for (const preset of presets.filter((item) => item.mode === "scene")) {
    const scene = preset.patch.scene!;
    const checks: [Set<string>, string[]][] = [
      [known.relations, [scene.subjectRelation]], [known.stages, [scene.place.mainStage]],
      [known.states, scene.place.stageState], [known.worlds, [scene.world.worldType]],
      [known.eras, [scene.world.era]], [known.architecture, scene.world.architectureStyle],
      [known.landmarks, [scene.structures.landmark]], [known.secondary, scene.structures.secondary],
      [known.accents, scene.structures.accents], [known.times, [scene.environment.timeOfDay]],
      [known.seasons, [scene.environment.season]], [known.weather, [scene.environment.weather]],
      [known.phenomena, scene.environment.phenomena], [known.primaryLights, [scene.lighting.primarySource]],
      [known.secondaryLights, [scene.lighting.secondarySource]], [known.directions, [scene.lighting.direction]],
      [known.qualities, [scene.lighting.quality]], [known.tones, [scene.atmosphere.colorTone]],
      [known.contrasts, [scene.atmosphere.contrast]], [known.moods, scene.atmosphere.mood],
      [known.perspectives, [scene.composition.perspective]], [known.depth, [scene.composition.depthLayers]],
      [known.densities, [scene.composition.density]], [known.fantasies, scene.composition.fantasyEffects],
      [known.blends, [scene.composition.blend]],
    ];
    for (const [collection, values] of checks) {
      for (const value of values) assert.ok(collection.has(value), `${preset.id}: ${value}`);
    }
  }
});

test("every preset produces a non-empty prompt", () => {
  for (const preset of presets) {
    const state = applyPreset(preset.id);
    assert.ok(generatePrompt(state).length > 30, preset.label);
  }
});

test("the three sea presets generate clearly different meaning blocks", () => {
  const summer = generateScenePrompt(applyPreset("summer_beach"), "short");
  const sunset = generateScenePrompt(applyPreset("sunset_sea"), "short");
  const storm = generateScenePrompt(applyPreset("stormy_sea"), "short");
  assert.match(summer, /sunlit sandy beach|clear blue water/i);
  assert.match(summer, /sunlight glittering across the water/i);
  assert.match(sunset, /at sunset/i);
  assert.match(sunset, /gentle waves rolling toward the shore/i);
  assert.match(sunset, /backlit/i);
  assert.match(storm, /rugged coast/i);
  assert.match(storm, /white spray breaking against the rocks/i);
  assert.match(storm, /wild and turbulent atmosphere/i);
  assert.equal(new Set([summer, sunset, storm]).size, 3);
});

test("new purikura presets stay character-focused with light decoration", () => {
  for (const id of ["peach_purikura", "lavender_purikura"]) {
    const simple = applyPreset(id).simple;
    assert.equal(simple.subjectRelation, "character_focus");
    assert.ok(simple.decoration.motifs.length <= 1);
  }
});

test("scene reset restores only scene state", () => {
  const state = createDefaultState();
  state.scene.place.mainStage = "summer_beach";
  state.simple.colors.primary = "deep_navy";
  state.outputStyle = "detailed";
  const reset = resetActiveMode(state);
  assert.deepEqual(reset.scene, createDefaultState().scene);
  assert.equal(reset.simple.colors.primary, "deep_navy");
  assert.equal(reset.outputStyle, "detailed");
  assert.equal(reset.backgroundMode, "scene");
});

test("simple reset restores only simple state", () => {
  const state = createDefaultState();
  state.backgroundMode = "simple";
  state.simple.colors.primary = "deep_navy";
  state.scene.place.mainStage = "summer_beach";
  const reset = resetActiveMode(state);
  assert.deepEqual(reset.simple, createDefaultState().simple);
  assert.equal(reset.scene.place.mainStage, "summer_beach");
  assert.equal(reset.backgroundMode, "simple");
});

test("cancelled reset changes nothing", () => {
  const state = createDefaultState();
  state.scene.place.mainStage = "summer_beach";
  assert.equal(resetActiveMode(state, false), state);
});

test("reset confirmation identifies the active mode", () => {
  assert.equal(resetConfirmationMessage("scene"), "空間背景の設定を初期状態に戻しますか？");
  assert.equal(resetConfirmationMessage("simple"), "シンプル背景の設定を初期状態に戻しますか？");
});

test("mode reset does not mutate a saved design library", () => {
  const saved = [{ id: "saved-1", state: structuredClone(createDefaultState()) }];
  const before = structuredClone(saved);
  resetActiveMode(createDefaultState());
  assert.deepEqual(saved, before);
});

test("scene short and detailed outputs differ without duplicate background filler", () => {
  const state = createDefaultState();
  const short = generateScenePrompt(state, "short");
  const detailed = generateScenePrompt(state, "detailed");
  assert.match(short, /back alley/i);
  assert.match(short, /the scene is designed to support the character/i);
  assert.match(detailed, /^[A-Z].*\.$/);
  assert.notEqual(short, detailed);
  assert.doesNotMatch(short, /background, background/i);
});

test("simple output uses its own state and stays workspace-friendly", () => {
  const state = createDefaultState(); state.backgroundMode = "simple";
  const short = generateSimplePrompt(state, "short");
  const detailed = generateSimplePrompt(state, "detailed");
  assert.match(short, /pastel pink/i);
  assert.match(short, /gradient backdrop/i);
  assert.match(detailed, /^A .*\.$/);
  assert.doesNotMatch(short, /back alley/i);
});

test("subject relation changes the generated ending", () => {
  const character = createDefaultState();
  const background = createDefaultState(); background.scene.subjectRelation = "background_only";
  assert.notEqual(generateScenePrompt(character, "short"), generateScenePrompt(background, "short"));
  assert.match(generateScenePrompt(background, "short"), /main visual focus/i);
});

test("exclusions resolve impossible default combinations", () => {
  const state = createDefaultState();
  state.scene.environment.timeOfDay = "night"; state.scene.lighting.primarySource = "direct_sunlight";
  state.scene.environment.weather = "snow"; state.scene.environment.season = "summer";
  const fixed = enforceExclusions(state);
  assert.equal(fixed.scene.lighting.primarySource, "moonlight");
  assert.equal(fixed.scene.environment.season, "winter");
});

test("advisor shows warnings and suggestions for representative rules", () => {
  const state = createDefaultState();
  state.scene.composition.density = "intricate";
  state.scene.structures.accents = [];
  const advice = getAdvice(state);
  assert.ok(advice.some((item) => item.id === "focus-density"));
  assert.ok(advice.some((item) => item.id === "rain-ground"));
  assert.ok(advice.some((item) => item.id === "rain-reflection"));
});
