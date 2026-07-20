import assert from "node:assert/strict";
import test from "node:test";
import { enforceExclusions, getAdvice } from "../app/lib/advisor.ts";
import { createDefaultState, presets, sceneData, simpleData } from "../app/lib/background-data.ts";
import { generatePrompt, generateScenePrompt, generateSimplePrompt } from "../app/lib/generator.ts";

test("all master IDs are unique within their collections", () => {
  for (const collection of [...Object.values(sceneData), ...Object.values(simpleData)]) {
    if (!Array.isArray(collection)) continue;
    const ids = collection.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(collection.every((item) => item.label && typeof item.en === "string"));
  }
});

test("every preset produces a non-empty prompt", () => {
  for (const preset of presets) {
    const state = { ...createDefaultState(), ...structuredClone(preset.patch), backgroundMode: preset.mode };
    assert.ok(generatePrompt(state).length > 30, preset.label);
  }
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
