import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceExclusions, getAdvice } from "../app/lib/advisor.ts";
import { createDefaultState, presetGroups, presets, sceneData, simpleData } from "../app/lib/background-data.ts";
import type { BackgroundState, Platform, PixaiModel } from "../app/lib/background-data.ts";
import { buildViewSentence, generateOutput, generatePrompt, generateScenePrompt, generateSimplePrompt, negativeSupport } from "../app/lib/generator.ts";
import { exportDesign, exportLibrary, mergeSavedLists, migrateSavedList, migrateState, parseImportedJson, resetActiveMode, resetConfirmationMessage } from "../app/lib/state-utils.ts";
import { viewData, viewRecipes } from "../app/lib/view-data.ts";
import { getViewAvailability, viewSummary } from "../app/lib/view-rules.ts";

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const applyPreset = (id: string): BackgroundState => {
  const preset = presets.find((item) => item.id === id);
  assert.ok(preset, `missing preset: ${id}`);
  return { ...createDefaultState(), ...structuredClone(preset.patch), backgroundMode: preset.mode } as BackgroundState;
};
const withTarget = (state: BackgroundState, platform: Platform, pixaiModel: PixaiModel = "tsubaki", extra: Partial<BackgroundState["target"]> = {}): BackgroundState => ({ ...state, target: { ...state.target, platform, pixaiModel, ...extra } });
const tsubaki = (state: BackgroundState, style: "short" | "detailed" = "short") => generateOutput(withTarget(state, "pixai", "tsubaki"), style).positive;
const pixaiTag = (state: BackgroundState, style: "short" | "detailed" = "short") => generateOutput(withTarget(state, "pixai", "tag"), style).positive;
const novelai = (state: BackgroundState, style: "short" | "detailed" = "short") => generateOutput(withTarget(state, "novelai"), style).positive;
const ALL_TARGETS: [Platform, PixaiModel][] = [["generic", "tsubaki"], ["pixai", "tsubaki"], ["pixai", "tag"], ["novelai", "tsubaki"]];
/** 「a / an」の違いだけを同一視する（v1の冠詞の誤りを直したため） */
const normalizeArticles = (text: string) => text.replace(/\b[Aa]n?\b/g, "a");

/* ------------------------------------------------------------------ */
/* 辞書・プリセット                                                     */
/* ------------------------------------------------------------------ */

test("all master IDs are unique within their collections", () => {
  for (const collection of [...Object.values(sceneData), ...Object.values(simpleData), ...Object.values(viewData)]) {
    if (!Array.isArray(collection)) continue;
    const ids = collection.map((item) => item.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(collection.every((item) => item.label && typeof item.en === "string"));
  }
});

test("every stage belongs to an existing category and every category to an environment type", () => {
  const categoryIds = new Set(sceneData.categories.map((item) => item.id));
  const envIds = new Set(sceneData.environmentTypes.map((item) => item.id));
  for (const stage of sceneData.stages) assert.ok(categoryIds.has(stage.group!), stage.id);
  for (const category of sceneData.categories) {
    assert.ok(envIds.has(category.group!), category.id);
    assert.ok(sceneData.stages.some((stage) => stage.group === category.id), `empty category: ${category.id}`);
  }
});

test("v1 IDs are all still present (saved designs keep working)", () => {
  const inventory = readFileSync(new URL("./fixtures/v1-generic-output.json", import.meta.url), "utf8");
  assert.ok(inventory.length > 0);
  const v1Stages = ["quiet_room", "bedroom", "library", "laboratory", "office", "theater", "temple", "cathedral", "throne_room", "palace_hall", "underground_facility", "abandoned_factory", "deep_forest", "flower_field", "seaside", "lakeshore", "bright_sandy_beach", "rocky_coast", "back_alley", "city_street", "ancient_ruins", "ruined_garden", "floating_island", "crystal_valley", "future_city", "space_station", "balcony", "cloister", "station_platform", "rooftop", "cafe", "classroom", "old_town_street", "cave_entrance", "temple_gate", "dreamscape", "memory_space", "deep_space", "other_dimension", "infinite_space", "minimal_void"];
  for (const id of v1Stages) assert.ok(sceneData.stages.some((stage) => stage.id === id), id);
});

test("creatures are separated from traces", () => {
  assert.ok(sceneData.creatures.every((item) => item.creature));
  for (const trace of ["cobwebs", "scratch_marks", "dusty_footprints", "old_stains"]) assert.ok(sceneData.accents.some((item) => item.id === trace), trace);
  assert.ok(![...sceneData.secondary, ...sceneData.accents].some((item) => item.creature));
});

test("presets: unique IDs, valid groups, and expected counts", () => {
  assert.equal(new Set(presets.map((preset) => preset.id)).size, presets.length);
  assert.equal(presets.filter((preset) => preset.mode === "scene").length, 48);
  assert.equal(presets.filter((preset) => preset.mode === "simple").length, 15);
  for (const preset of presets) assert.ok(presetGroups[preset.mode].some((group) => group.id === preset.group), `${preset.id}: ${preset.group}`);
  for (const mode of ["scene", "simple"] as const) for (const group of presetGroups[mode]) assert.ok(presets.some((preset) => preset.mode === mode && preset.group === group.id), `empty preset group ${mode}/${group.id}`);
  assert.equal(presetGroups.scene[0].id, "recommended");
  assert.equal(presetGroups.simple[0].id, "recommended");
});

test("every preset only references known IDs (migration keeps it unchanged)", () => {
  for (const preset of presets) {
    const state = applyPreset(preset.id);
    assert.deepEqual(migrateState(state), state, preset.id);
  }
});

test("every preset produces a non-empty prompt for every target and style", () => {
  for (const preset of presets) {
    for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
      const out = generateOutput(withTarget(applyPreset(preset.id), platform, model), style).positive;
      assert.ok(out.length > 30, `${preset.id} ${platform}/${model}/${style}`);
      assert.doesNotMatch(out, /undefined|\{s\}|\{t\}|\{w\}|,\s*,|\s{2,}/, `${preset.id} ${platform}/${model}/${style}: ${out}`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 従来出力との互換                                                     */
/* ------------------------------------------------------------------ */

test("generic output is unchanged from v1 for every v1 preset (articles aside)", () => {
  const snapshot = fixture("v1-generic-output.json") as Record<string, string>;
  for (const [key, expected] of Object.entries(snapshot)) {
    const [id, style] = key.split(":") as [string, "short" | "detailed"];
    const state = id === "__default" ? createDefaultState() : applyPreset(id);
    assert.equal(normalizeArticles(generatePrompt(state, style)), normalizeArticles(expected), key);
  }
});

test("the three sea presets generate clearly different meaning blocks", () => {
  const summer = generateScenePrompt(applyPreset("summer_beach"), "short");
  const sunset = generateScenePrompt(applyPreset("sunset_sea"), "short");
  const storm = generateScenePrompt(applyPreset("stormy_sea"), "short");
  assert.match(summer, /sunlit sandy beach|clear blue water/i);
  assert.match(summer, /sunlight glittering across the water/i);
  assert.match(sunset, /at sunset/i);
  assert.match(sunset, /backlit/i);
  assert.match(storm, /white spray breaking against the rocks/i);
  assert.equal(new Set([summer, sunset, storm]).size, 3);
});

test("purikura presets stay character-focused with light decoration", () => {
  for (const id of ["peach_purikura", "lavender_purikura"]) {
    const simple = applyPreset(id).simple;
    assert.equal(simple.subjectRelation, "character_focus");
    assert.ok(simple.decoration.motifs.length <= 1);
  }
});

test("scene short and detailed outputs differ without duplicate background filler", () => {
  const state = createDefaultState();
  const short = generateScenePrompt(state, "short");
  const detailed = generateScenePrompt(state, "detailed");
  assert.match(short, /back alley/i);
  assert.match(detailed, /^[A-Z].*\.$/);
  assert.notEqual(short, detailed);
  assert.doesNotMatch(short, /background, background/i);
});

test("simple output uses its own state and stays workspace-friendly", () => {
  const state = createDefaultState(); state.backgroundMode = "simple";
  assert.match(generateSimplePrompt(state, "short"), /pastel pink/i);
  assert.match(generateSimplePrompt(state, "detailed"), /^A .*\.$/);
  assert.doesNotMatch(generateSimplePrompt(state, "short"), /back alley/i);
});

test("subject relation changes the generated ending", () => {
  const background = createDefaultState(); background.scene.subjectRelation = "background_only";
  assert.notEqual(generateScenePrompt(createDefaultState(), "short"), generateScenePrompt(background, "short"));
  assert.match(generateScenePrompt(background, "short"), /main visual focus/i);
});

/* ------------------------------------------------------------------ */
/* 見え方（依頼書のテストケース 1〜7）                                   */
/* ------------------------------------------------------------------ */

const lead = (state: BackgroundState) => buildViewSentence(state, getViewAvailability(state).active!).lead;
const before = (text: string, a: RegExp, b: RegExp) => {
  const ia = text.search(a); const ib = text.search(b);
  assert.ok(ia >= 0 && ib >= 0 && ia < ib, `expected ${a} before ${b} in: ${text}`);
};

test("1. looking up at the castle from the castle town street", () => {
  const state = applyPreset("castle_from_town");
  const text = tsubaki(state);
  assert.match(text, /at street level in a lived-in old castle town, looking up at a towering castle above/);
  before(text, /street level/, /towering castle/);
  assert.match(pixaiTag(state), /street level, from below, looking up, castle/);
});

test("2. looking down at the town from the castle balcony (not a ground view of the town)", () => {
  const state = applyPreset("castle_balcony_view");
  const text = tsubaki(state);
  assert.match(text, /^A view from a grand castle balcony, looking down at an old castle town below/);
  assert.doesNotMatch(text, /street level|ground level/);
  assert.match(novelai(state), /^detailed background, balcony, from above, looking down, old town/);
});

test("3. the whole castle seen from high in the sky", () => {
  const state = applyPreset("castle_aerial");
  assert.match(lead(state), /^from high in the sky, looking down at a castle standing on a hill and the surrounding streets and rooftops below, seen from far away$/);
  assert.match(pixaiTag(state), /no humans, scenery, castle standing on a hill, high altitude, aerial view, from above, looking down/);
});

test("4. flying over a harbor town and the sea", () => {
  const text = tsubaki(applyPreset("harbor_flight"));
  assert.match(text, /looking down at a bustling harbor town and the open sea below, as the viewpoint flies through the air/);
  before(text, /from midair/, /harbor town/);
});

test("5. falling from the sky toward a city — the viewpoint falls, no falling person", () => {
  const state = applyPreset("sky_fall_city");
  const text = tsubaki(state);
  assert.match(text, /from within a vast open sky at high altitude, looking straight down at a sprawling city directly below/);
  assert.match(text, /plunging viewpoint/);
  assert.match(text, /streaks of rushing wind, clouds rushing past and dramatic plunging perspective/);
  for (const tags of [pixaiTag(state), novelai(state), pixaiTag(state, "detailed")]) {
    assert.doesNotMatch(tags.replace(/as if falling from the sky/, ""), /\bfalling\b|\bflying\b|1girl|1boy/);
  }
});

test("6. looking up at the water surface from underwater", () => {
  const state = applyPreset("underwater_surface");
  assert.match(tsubaki(state), /from within a clear underwater scene, looking straight up at the shimmering water surface and the open sky and clouds directly above/);
  assert.match(novelai(state), /underwater, from directly below, looking up, water surface/);
});

test("7. the sky through a window from inside a building", () => {
  const state = applyPreset("window_sky_hall");
  assert.match(tsubaki(state), /from inside a long stone castle corridor, looking up at the open sky and clouds above, through a tall arched window/);
  assert.match(pixaiTag(state), /indoors, from below, looking up, sky, clouds, through window, arched window/);
});

test("vantage and target stay distinct when the stage itself is the target", () => {
  const state = applyPreset("castle_aerial");
  state.scene.view.targets = ["main_stage"];
  assert.match(lead(state), /^from high in the sky, looking down at a castle standing on a hill below/);
  state.scene.view.targets = ["castle_town"];
  assert.match(lead(state), /^from high in the sky over a castle standing on a hill, looking down at an old castle town below/);
});

test("standard view keeps the old perspective; custom view replaces it with gaze and lens", () => {
  const state = createDefaultState();
  assert.match(generatePrompt(state), /eye-level perspective/);
  state.scene.view.mode = "custom";
  state.scene.view.lens = "telephoto";
  const custom = generatePrompt(state);
  assert.doesNotMatch(custom, /eye-level perspective/);
  assert.match(custom, /compressed telephoto perspective/);
  assert.match(custom, /^viewed from ground level, looking straight ahead at a rain-soaked narrow back alley/);
});

test("every view recipe produces a coherent lead for a compatible stage", () => {
  for (const recipe of viewRecipes) {
    const state = recipe.id === "underwater_up" ? applyPreset("coral_reef_day") : recipe.id === "window_sky" ? applyPreset("palace_great_hall") : applyPreset("castle_aerial");
    state.scene.view = { ...state.scene.view, ...recipe.view, mode: "custom" };
    const availability = getViewAvailability(state);
    assert.ok(!availability.notices.some((notice) => notice.kind === "ignored"), `${recipe.id}: ${JSON.stringify(availability.notices)}`);
    assert.ok(lead(state).length > 20, recipe.id);
    assert.ok(viewSummary(state).includes("から"), recipe.id);
  }
});

/* ------------------------------------------------------------------ */
/* 矛盾制御（非活性化・無視・警告）                                      */
/* ------------------------------------------------------------------ */

test("impossible vantages are disabled with a Japanese reason", () => {
  const indoor = applyPreset("palace_great_hall");
  assert.match(getViewAvailability(indoor).disabled.vantage.sky, /屋内/);
  const reef = applyPreset("coral_reef_day");
  assert.ok(getViewAvailability(reef).disabled.vantage.street);
  assert.equal(getViewAvailability(reef).disabled.vantage.underwater, undefined);
  const street = createDefaultState();
  assert.ok(getViewAvailability(street).disabled.vantage.underwater);
  const fantasyStreet = createDefaultState(); fantasyStreet.scene.world.worldType = "fantasy";
  assert.equal(getViewAvailability(fantasyStreet).disabled.vantage.underwater, undefined);
});

test("11. disabled settings never leak into the output", () => {
  // 上空 → 地上へ変えると、高度・落下・真下は出力から外れる（値は保存されたまま）
  const ground = structuredClone(applyPreset("harbor_flight"));
  ground.scene.view.vantage = "ground";
  ground.scene.view.motion = "falling";
  ground.scene.view.gaze = "straight_down";
  ground.scene.view.altitude = "high";
  for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const out = generateOutput(withTarget(ground, platform, model), style).positive;
    assert.doesNotMatch(out, /high altitude|high in the sky|plunging|top-down|straight down|directly below/, `${platform}/${model}/${style}: ${out}`);
  }
  assert.equal(ground.scene.view.altitude, "high", "stored value must not be overwritten");
  const notices = getViewAvailability(ground).notices.filter((item) => item.kind === "ignored").map((item) => item.id);
  assert.deepEqual(notices.sort(), ["ignored-altitude", "ignored-effects", "ignored-gaze", "ignored-motion"].sort());

  // 屋内の舞台で「上空」を保存していても、空中視点の英語は出ない
  const indoor = applyPreset("palace_great_hall");
  indoor.scene.view = { ...indoor.scene.view, mode: "custom", vantage: "sky", altitude: "high", gaze: "down_diagonal", targets: ["main_stage"] };
  const out = tsubaki(indoor);
  assert.doesNotMatch(out, /in the sky|aerial|altitude/);
  assert.match(out, /from inside/);

  // 標準の見え方に戻すと、細かい見え方は一切出力されない
  const standard = applyPreset("harbor_flight"); standard.scene.view.mode = "standard";
  for (const [platform, model] of ALL_TARGETS) {
    assert.doesNotMatch(generateOutput(withTarget(standard, platform, model)).positive, /aerial|midair|fly|looking down/);
  }
});

test("single-choice view fields make contradictory pairs impossible", () => {
  const state = applyPreset("sky_fall_city");
  assert.equal(typeof state.scene.view.gaze, "string");
  assert.equal(typeof state.scene.view.motion, "string");
  const out = tsubaki(state, "detailed");
  assert.ok(!(out.includes("looking straight up") && out.includes("looking straight down")));
  assert.ok(!(out.includes("rises upward") && out.includes("falling")));
});

test("special but possible combinations only warn", () => {
  const state = applyPreset("castle_aerial");
  state.scene.view = { ...state.scene.view, vantage: "ship" };
  const availability = getViewAvailability(state);
  assert.ok(availability.notices.some((item) => item.id === "ship-dry" && item.kind === "warning"));
  assert.match(tsubaki(state), /from the deck of a ship/);
});

/* ------------------------------------------------------------------ */
/* 指定しない                                                          */
/* ------------------------------------------------------------------ */

test("12. items set to 'not specified' are not output", () => {
  const state = createDefaultState();
  Object.assign(state.scene.environment, { season: "", weather: "", timeOfDay: "", phenomena: [] });
  Object.assign(state.scene.lighting, { direction: "", quality: "" });
  Object.assign(state.scene.world, { worldType: "", era: "" });
  state.scene.atmosphere.colorTone = "";
  state.scene.place.stageState = [];
  for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const out = generateOutput(withTarget(state, platform, model), style).positive;
    assert.doesNotMatch(out, /autumn|steady rain|\brain\b|at night|side-lit|side lighting|diffused|modern|contemporary|muted blue/i, `${platform}/${model}/${style}: ${out}`);
    assert.doesNotMatch(out, /,\s*,|\s{2,}|\(\)/, `${platform}/${model}/${style}: ${out}`);
  }
  const simple = createDefaultState(); simple.backgroundMode = "simple";
  simple.simple.decoration.enabled = false;
  assert.doesNotMatch(generatePrompt(simple), /sparkle/);
});

/* ------------------------------------------------------------------ */
/* 生成先                                                              */
/* ------------------------------------------------------------------ */

test("10. switching targets never changes the design itself", () => {
  const state = applyPreset("harbor_flight");
  const outputs = new Set<string>();
  for (const [platform, model] of ALL_TARGETS) {
    const switched = withTarget(state, platform, model);
    assert.deepEqual(switched.scene, state.scene);
    assert.deepEqual(switched.simple, state.simple);
    outputs.add(generatePrompt(switched));
  }
  assert.equal(outputs.size, 4);
});

test("Tsubaki output is natural language; tag targets are comma-separated phrases", () => {
  const state = applyPreset("shrine_dusk");
  const natural = tsubaki(state);
  assert.match(natural, /^The background shows a quiet Shinto shrine, seen at eye level\./);
  assert.ok(natural.split(". ").length >= 4);
  for (const tags of [pixaiTag(state), novelai(state)]) {
    assert.doesNotMatch(tags, /\. [A-Z]/);
    assert.ok(tags.split(", ").every((tag) => tag.split(" ").length <= 8), tags);
  }
});

test("NovelAI puts view information first and only adds emphasis when asked", () => {
  const state = applyPreset("castle_aerial");
  const plain = novelai(state);
  assert.match(plain, /^no humans, scenery, high altitude, aerial view, from above/);
  assert.doesNotMatch(plain, /::|\{|\[/);
  const emphasized = generateOutput(withTarget(state, "novelai", "tsubaki", { novelaiEmphasis: true })).positive;
  assert.match(emphasized, /^no humans, scenery, 1\.2::high altitude, aerial view, from above, looking down, cityscape, rooftops, distant view ::, castle standing on a hill/);
  const standard = applyPreset("shrine_dusk");
  assert.doesNotMatch(generateOutput(withTarget(standard, "novelai", "tsubaki", { novelaiEmphasis: true })).positive, /::/);
});

test("no quality tags or emphasis brackets are added on any target", () => {
  for (const preset of presets) for (const [platform, model] of ALL_TARGETS) {
    const out = generateOutput(withTarget(applyPreset(preset.id), platform, model)).positive;
    assert.doesNotMatch(out, /masterpiece|best quality|highres|[{}[\]()]/i, `${preset.id} ${platform}`);
  }
});

test("negative prompts follow each target's capabilities", () => {
  const state = applyPreset("castle_aerial");
  assert.equal(generateOutput(state).negative, null);
  assert.equal(generateOutput(withTarget(state, "pixai", "tsubaki")).negative, null);
  assert.equal(negativeSupport(withTarget(state, "pixai", "tsubaki")).supported, false);
  assert.match(generateOutput(withTarget(state, "pixai", "tsubaki", { tsubakiProMode: true })).negative!, /^people, characters, text/);
  assert.match(generateOutput(withTarget(state, "pixai", "tag")).negative!, /people, 1girl, 1boy, crowd, text, logo, watermark, signature/);
  assert.match(generateOutput(withTarget(state, "novelai")).negative!, /watermark/);
  assert.equal(generateOutput(withTarget(state, "novelai", "tsubaki", { negativeEnabled: false })).negative, null);
  // 人物を描く比重では「人物」を入れない
  const character = applyPreset("shrine_dusk");
  assert.doesNotMatch(generateOutput(withTarget(character, "novelai")).negative!, /people|1girl/);
  // 生き物を選んでいるときは「生き物」を入れない
  const reef = withTarget(applyPreset("coral_reef_day"), "novelai", "tsubaki", { negativeItems: ["creatures", "text"] });
  assert.equal(generateOutput(reef).negative, "text, logo");
});

test("Tsubaki without a negative field adds one short 'no people' clause only for background-only", () => {
  const aerial = generateOutput(withTarget(applyPreset("castle_aerial"), "pixai", "tsubaki"));
  assert.match(aerial.positive, /with no people in the scene\.$/);
  assert.equal((aerial.positive.match(/\bno\b/g) || []).length, 1);
  assert.ok(aerial.notes.length);
  const pro = generateOutput(withTarget(applyPreset("castle_aerial"), "pixai", "tsubaki", { tsubakiProMode: true }));
  assert.doesNotMatch(pro.positive, /no people/);
  assert.doesNotMatch(tsubaki(applyPreset("shrine_dusk")), /no people/);
});

/* ------------------------------------------------------------------ */
/* 新しい背景（テストケース 8・9）                                       */
/* ------------------------------------------------------------------ */

test("8. new daily, Japanese, SF and horror backgrounds generate identifiable prompts", () => {
  const cases: [string, RegExp[]][] = [
    ["kitchen_morning", [/kitchen/, /kitchen counter with a sink/]],
    ["midnight_konbini", [/convenience store/, /store shelves/, /refrigerated/]],
    ["shrine_dusk", [/Shinto shrine/, /torii/, /stone lanterns/]],
    ["tatami_afternoon", [/tatami/, /shoji/, /tokonoma/]],
    ["neon_district_rain", [/neon-lit entertainment district/, /holographic/]],
    ["haunted_hall", [/haunted mansion/, /cobwebs/, /portraits/]],
    ["collapsed_city_dusk", [/collapsed ruined city/, /abandoned vehicles/, /barricades/]],
    ["coral_reef_day", [/coral reef/, /tropical fish/]],
  ];
  for (const [id, patterns] of cases) for (const [platform, model] of ALL_TARGETS) {
    const out = generateOutput(withTarget(applyPreset(id), platform, model)).positive;
    for (const pattern of patterns) assert.match(out, pattern, `${id} ${platform}/${model}: ${out}`);
  }
  assert.doesNotMatch(JSON.stringify([...sceneData.secondary, ...sceneData.accents].map((item) => item.en)), /blood|corpse|gore/i);
});

test("9. simple backgrounds: patterns, textures and decoration placement", () => {
  assert.match(generatePrompt(applyPreset("mint_grid"), "short"), /very pale soft mint and white patterned backdrop, a fine geometric grid pattern/);
  assert.match(generatePrompt(applyPreset("cream_paper"), "detailed"), /textured backdrop with fine paper texture/);
  assert.match(generatePrompt(applyPreset("lace_ribbon_pink"), "detailed"), /moderate lace trim details and delicate ribbon motifs arranged along the edges/);
  assert.match(pixaiTag(applyPreset("seigaiha_navy")), /simple background, deep navy background, soft gold background, seigaiha, japanese pattern/);
  // パターン以外の背景タイプでは、残っている柄の値を出力しない
  const state = applyPreset("mint_grid"); state.simple.backgroundType = "gradient";
  assert.doesNotMatch(generatePrompt(state), /grid/);
  const off = applyPreset("lace_ribbon_pink"); off.simple.decoration.enabled = false;
  assert.doesNotMatch(generatePrompt(off), /lace|edges/);
});

/* ------------------------------------------------------------------ */
/* 保存データ（テストケース 13）                                         */
/* ------------------------------------------------------------------ */

test("13. v1 design and library JSON load without errors and keep their output", () => {
  const data = fixture("v1-saved-data.json");
  const design = parseImportedJson(data.design);
  assert.equal(design.kind, "design");
  if (design.kind !== "design") return;
  assert.equal(design.state.version, 2);
  assert.equal(design.state.scene.view.mode, "standard");
  assert.equal(design.state.target.platform, "generic");
  assert.equal(normalizeArticles(generatePrompt(design.state)), normalizeArticles(generatePrompt(data.design.state)));

  const library = parseImportedJson(data.library);
  assert.equal(library.kind, "library");
  if (library.kind !== "library") return;
  assert.equal(library.saved.length, 4);
  assert.deepEqual(library.saved.map((item) => item.name), data.library.saved.map((item: { name: string }) => item.name));
  assert.equal(library.saved[3].state.backgroundMode, "simple");
  assert.equal(generatePrompt(library.saved[3].state), generatePrompt(data.library.saved[3].state));
});

test("migration keeps over-limit selections from old data instead of truncating", () => {
  const old = applyPreset("summer_beach");
  assert.equal(old.scene.structures.accents.length, 4);
  assert.equal(migrateState(old).scene.structures.accents.length, 4);
});

test("broken or partial saved data degrades per field instead of failing", () => {
  const partial = migrateState({ version: 1, backgroundMode: "scene", scene: { place: { mainStage: "library" }, environment: { season: "monsoon" } } });
  assert.equal(partial.scene.place.mainStage, "library");
  assert.equal(partial.scene.place.category, "study");
  assert.equal(partial.scene.environment.season, createDefaultState().scene.environment.season);
  assert.deepEqual(migrateState(null), createDefaultState());
  assert.deepEqual(migrateState("broken"), createDefaultState());
  const list = migrateSavedList([{ id: "a", name: "ok", savedAt: "x", state: { version: 1 } }, null, 5, { id: "b" }]);
  assert.equal(list.length, 1);
  assert.throws(() => parseImportedJson({ version: 9 }));
  assert.throws(() => parseImportedJson({ version: 1, type: "unknown" }));
});

test("v2 export round-trips through import", () => {
  const state = withTarget(applyPreset("harbor_flight"), "novelai", "tsubaki", { novelaiEmphasis: true });
  const design = parseImportedJson(JSON.parse(JSON.stringify(exportDesign(state))));
  assert.deepEqual(design.kind === "design" && design.state, state);
  const saved = [{ id: "x", name: "港町", savedAt: "2026-10-28T00:00:00.000Z", state }];
  const library = parseImportedJson(JSON.parse(JSON.stringify(exportLibrary(saved))));
  assert.deepEqual(library.kind === "library" && library.saved, saved);
});

test("importing a library adds to existing saves instead of replacing them", () => {
  const mine = [{ id: "mine", name: "自分の保存", savedAt: "2026-10-01T00:00:00.000Z", state: createDefaultState() }];
  const incoming = migrateSavedList(fixture("v1-saved-data.json").library.saved);
  let n = 0;
  const first = mergeSavedLists(mine, incoming, () => `new-${n++}`);
  assert.equal(first.saved.length, 5);
  assert.ok(first.saved.some((item) => item.id === "mine"));
  const again = mergeSavedLists(first.saved, incoming, () => `new-${n++}`);
  assert.equal(again.added, 0, "same data imported twice is not duplicated");
  const clash = mergeSavedLists(first.saved, [{ ...incoming[0], name: "別の内容" }], () => "clash-id");
  assert.equal(clash.added, 1);
  assert.ok(clash.saved.some((item) => item.id === "clash-id"));
  assert.ok(clash.saved.some((item) => item.id === incoming[0].id && item.name === incoming[0].name));
});

/* ------------------------------------------------------------------ */
/* 初期化・モード切り替え                                               */
/* ------------------------------------------------------------------ */

test("scene reset restores only scene state and keeps the target settings", () => {
  const state = withTarget(createDefaultState(), "novelai");
  state.scene.place.mainStage = "kitchen";
  state.scene.view.mode = "custom";
  state.simple.colors.primary = "deep_navy";
  state.outputStyle = "detailed";
  const reset = resetActiveMode(state);
  assert.deepEqual(reset.scene, createDefaultState().scene);
  assert.equal(reset.simple.colors.primary, "deep_navy");
  assert.equal(reset.outputStyle, "detailed");
  assert.equal(reset.target.platform, "novelai");
});

test("simple reset restores only simple state", () => {
  const state = createDefaultState();
  state.backgroundMode = "simple";
  state.simple.colors.primary = "deep_navy";
  state.scene.place.mainStage = "kitchen";
  const reset = resetActiveMode(state);
  assert.deepEqual(reset.simple, createDefaultState().simple);
  assert.equal(reset.scene.place.mainStage, "kitchen");
  assert.equal(reset.backgroundMode, "simple");
});

test("cancelled reset changes nothing and mode switching keeps both designs", () => {
  const state = createDefaultState();
  assert.equal(resetActiveMode(state, false), state);
  const scene = applyPreset("harbor_flight");
  const toSimple = { ...scene, backgroundMode: "simple" as const };
  const back = { ...toSimple, backgroundMode: "scene" as const };
  assert.deepEqual(back.scene, scene.scene);
  assert.equal(generatePrompt(back), generatePrompt(scene));
});

test("reset confirmation identifies the active mode", () => {
  assert.equal(resetConfirmationMessage("scene"), "空間背景の設定を初期状態に戻しますか？");
  assert.equal(resetConfirmationMessage("simple"), "シンプル背景の設定を初期状態に戻しますか？");
});

/* ------------------------------------------------------------------ */
/* 補助                                                                */
/* ------------------------------------------------------------------ */

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
  const shrine = applyPreset("shrine_dusk"); shrine.scene.structures.secondary = [];
  assert.ok(getAdvice(shrine).some((item) => item.id === "shrine-torii"));
  const reef = applyPreset("coral_reef_day"); reef.scene.lighting.primarySource = "natural"; reef.scene.lighting.secondarySource = "none";
  assert.ok(getAdvice(reef).some((item) => item.id === "underwater-light"));
});
