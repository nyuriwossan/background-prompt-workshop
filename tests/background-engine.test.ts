import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { enforceExclusions, getAdvice } from "../app/lib/advisor.ts";
import { createDefaultState, presetGroups, presets, sceneData, simpleData } from "../app/lib/background-data.ts";
import type { BackgroundState, Platform, PixaiModel } from "../app/lib/background-data.ts";
import { buildViewSentence, generateOutput, generatePrompt, generateScenePrompt, generateSimplePrompt, negativeSupport } from "../app/lib/generator.ts";
import { clearActiveMode, clearConfirmationMessage, defaultsConfirmationMessage, exportDesign, exportLibrary, mergeSavedLists, migrateSavedList, migrateState, parseImportedJson, resetActiveMode, resetConfirmationMessage } from "../app/lib/state-utils.ts";
import { createDefaultView, motionProfiles, viewData, viewFromRecipe, viewRecipes } from "../app/lib/view-data.ts";
import { getViewAvailability, viewSummary } from "../app/lib/view-rules.ts";
import { basicMotifIds } from "../app/lib/background-data.ts";
import { designProfiles, eventThemes, fusionKindLabels, proposalIdAliases, seasonalMotifs } from "../app/lib/seasonal-data.ts";

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
  assert.equal(presets.filter((preset) => preset.mode === "scene").length, 53);
  assert.equal(presets.filter((preset) => preset.mode === "simple").length, 37);
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

test("4. flying over a harbor town and the sea — movement is stated before the target", () => {
  const text = tsubaki(applyPreset("harbor_flight"));
  assert.match(text, /^A view from midair at a moderate altitude, as the viewpoint flies forward through the open air, looking down at a bustling harbor town and the open sea below, seen from far away, with the scenery below sliding past/);
  before(text, /flies forward/, /harbor town/);
});

test("5. falling toward a city — the viewpoint plunges, the ground rushes up, no falling person", () => {
  const state = applyPreset("sky_fall_city");
  const text = tsubaki(state);
  assert.match(text, /^A view from midair at a moderate altitude, as the viewpoint plunges straight down, looking straight down at a downtown district of glass skyscrapers directly below, seen from a moderate distance, with the ground and everything on it rushing up toward the viewer in strong foreshortening/);
  assert.match(text, /buildings converging toward a vanishing point/);
  // 地図のような静かな俯瞰へ寄せる語を使わない
  assert.doesNotMatch(text, /great distance|vast expanse|high altitude|as if falling/);
  for (const tags of [pixaiTag(state), novelai(state), pixaiTag(state, "detailed"), novelai(state, "detailed")]) {
    assert.match(tags, /from above, foreshortening, perspective/);
    assert.match(tags, /vanishing point/);
    assert.doesNotMatch(tags, /\bfalling\b|\bflying\b|1girl|1boy|top-down view|distant view|plunging view/);
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

/* ------------------------------------------------------------------ */
/* v2.1：選択をクリア／初期設定に戻す                                     */
/* ------------------------------------------------------------------ */

/** 画面の操作と同じ順で、STEP3の多くの項目と、条件で隠れる見え方の値を選んだ状態を作る */
function busySceneState(): BackgroundState {
  const state = withTarget(applyPreset("sky_fall_city"), "novelai", "tsubaki", { novelaiEmphasis: true });
  state.outputStyle = "detailed";
  Object.assign(state.scene.world, { worldType: "fantasy", era: "medieval", architectureStyle: ["gothic", "japanese"] });
  Object.assign(state.scene.structures, { landmark: "clock_tower", secondary: ["street_lamps", "torii", "signs"], accents: ["mist", "petals", "cobwebs"], creatures: ["birds", "ghostly_figure"] });
  Object.assign(state.scene.environment, { timeOfDay: "night", season: "autumn", weather: "rain", phenomena: ["fog", "aurora"] });
  Object.assign(state.scene.lighting, { primarySource: "neon", secondarySource: "embers", direction: "back", quality: "dramatic" });
  Object.assign(state.scene.atmosphere, { colorTone: "blue_purple", contrast: "high", mood: ["eerie", "majestic", "tense"] });
  Object.assign(state.scene.composition, { perspective: "low_angle", depthLayers: "layered", density: "intricate", fantasyEffects: ["floating_lights", "divine_halo"], blend: "soft_blur" });
  // 条件で非表示になる値（地上では使えない高度、窓以外の枠の窓の種類）も入れておく
  Object.assign(state.scene.view, { vantage: "ground", altitude: "high", frame: "railing", frameDetail: "stained", lens: "fisheye" });
  state.scene.place.stageState = ["rainy", "abandoned"];
  return state;
}

test("clear: removes every optional scene selection, including collapsed and hidden values", () => {
  const before = busySceneState();
  const cleared = clearActiveMode(before);
  const s = cleared.scene;
  assert.deepEqual(s.world, { worldType: "", era: "", architectureStyle: [] });
  assert.deepEqual(s.structures, { landmark: "none", secondary: [], accents: [], creatures: [] });
  assert.deepEqual(s.environment, { timeOfDay: "", season: "", weather: "", phenomena: [] });
  assert.deepEqual(s.lighting, { primarySource: "", secondarySource: "none", direction: "", quality: "" });
  assert.deepEqual(s.atmosphere, { colorTone: "", contrast: "", mood: [] });
  assert.deepEqual(s.composition, { perspective: "", depthLayers: "", density: "", fantasyEffects: [], blend: "" });
  assert.deepEqual(s.view, createDefaultView());
  assert.deepEqual(s.place.stageState, []);
  // 残すもの：場所・比重・生成先・出力形式・もう一方のモード
  assert.equal(s.place.mainStage, "skyscraper_district");
  assert.equal(s.place.category, "urban_street");
  assert.equal(s.subjectRelation, before.scene.subjectRelation);
  assert.deepEqual(cleared.target, before.target);
  assert.equal(cleared.outputStyle, "detailed");
  assert.deepEqual(cleared.simple, before.simple);
  // 保存データとして正しい形のまま（移行しても変わらない）
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(cleared))), cleared);
});

test("clear: the prompt keeps only the place for every target and style", () => {
  const cleared = clearActiveMode(busySceneState());
  for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const out = generateOutput(withTarget(cleared, platform, model), style);
    assert.match(out.positive, /downtown district of glass skyscrapers/, `${platform}/${model}/${style}`);
    assert.doesNotMatch(out.positive, /fantasy|medieval|Gothic|clock tower|street lamps|torii|mist|petals|cobwebs|birds|ghost|\bnight\b|autumn|\brain\b|\bfog\b|aurora|neon|ember|backlit|dramatic|violet|high contrast|eerie|majestic|tense|low-angle|from below|layered|intricate|floating lights|halo|softened|depth of field|plung|foreshortening|fisheye|railing|stained|\bwind\b|cloud|altitude|aerial/i, `${platform}/${model}/${style}: ${out.positive}`);
    assert.doesNotMatch(out.positive, /,\s*,|\s{2,}|undefined/);
  }
  assert.deepEqual(getAdvice(cleared).filter((item) => item.kind === "warning"), []);
});

test("clear: simple mode removes texture, pattern, blur and decoration but keeps style and main color", () => {
  const state = applyPreset("lace_ribbon_pink");
  state.simple.rendering = ["gentle_blur", "soft_glow", "vignette"];
  state.simple.colors.intensity = "deep";
  const cleared = clearActiveMode(state);
  assert.deepEqual(cleared.simple, { subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "", intensity: "medium" }, rendering: [], pattern: "", texture: "", decoration: { enabled: false, motifs: [], placement: "", density: "" }, eventTheme: "", designProfile: "", decorSeparation: true });
  assert.deepEqual(cleared.scene, state.scene);
  const pattern = clearActiveMode(applyPreset("seigaiha_navy"));
  assert.equal(pattern.simple.backgroundType, "solid");
  assert.equal(pattern.simple.pattern, "");
  for (const [platform, model] of ALL_TARGETS) {
    const out = generateOutput(withTarget(pattern, platform, model)).positive;
    assert.doesNotMatch(out, /seigaiha|gold|pattern|blur|glow|vignette|lace|ribbon/i, `${platform}: ${out}`);
    assert.match(out, /navy/);
  }
});

test("clear and defaults: cancel changes nothing; confirmations explain the difference", () => {
  const state = busySceneState();
  assert.equal(clearActiveMode(state, false), state);
  assert.equal(resetActiveMode(state, false), state);
  assert.match(clearConfirmationMessage("scene"), /任意の選択.*外します/s);
  assert.match(clearConfirmationMessage("scene"), /保存一覧は消えません/);
  assert.match(defaultsConfirmationMessage("scene"), /初期設定には.*選択が含まれます/s);
  assert.match(defaultsConfirmationMessage("simple"), /初期設定には.*選択が含まれます/s);
  // 初期設定に戻すは、従来どおり作例の状態（選択あり）に戻る
  const defaults = resetActiveMode(state);
  assert.deepEqual(defaults.scene, createDefaultState().scene);
  assert.deepEqual(defaults.target, state.target);
});

/* ------------------------------------------------------------------ */
/* v2.1：動きのある見え方                                               */
/* ------------------------------------------------------------------ */

const DYNAMIC = ["sky_fall_city", "city_dive", "sea_glide", "castle_tower_flyby", "cloud_break_harbor", "town_rapid_ascent", "harbor_flight"];
const STATIC_VIEWS = ["castle_from_town", "castle_balcony_view", "castle_aerial", "window_sky_hall", "mountain_dawn", "canyon_overlook", "multilevel_overlook"];

test("dynamic presets: vantage, gaze and motion are consistent and nothing is ignored", () => {
  for (const id of DYNAMIC) {
    const state = applyPreset(id);
    const availability = getViewAvailability(state);
    assert.ok(state.scene.view.motion in motionProfiles, id);
    assert.deepEqual(availability.notices.filter((item) => item.kind === "ignored"), [], id);
    assert.deepEqual(availability.notices.filter((item) => ["motion-gaze", "cloud-gaze", "motion-distance"].includes(item.id)), [], id);
    assert.ok(state.scene.view.motionEffects.length <= 3, id);
    for (const effect of state.scene.view.motionEffects) assert.ok(motionProfiles[state.scene.view.motion].recommended.includes(effect) || effect === "wind_streaks", `${id}: ${effect}`);
  }
});

test("dynamic presets: the ground scenery and direction of movement reach every target", () => {
  const cases: Record<string, { natural: RegExp[]; tags: RegExp }> = {
    sky_fall_city: { natural: [/plunges straight down/, /rushing up toward the viewer/], tags: /foreshortening/ },
    city_dive: { natural: [/dives steeply toward a downtown district of glass skyscrapers, looking down/, /growing larger as it rushes closer/], tags: /foreshortening, perspective/ },
    sea_glide: { natural: [/glides smoothly on the wind/, /the open sea and the distant horizon/, /skimming just above the surface toward the horizon/], tags: /horizon, very wide shot/ },
    castle_tower_flyby: { natural: [/races past close beside a castle standing on a hill at high speed/, /looming large in the near foreground/], tags: /foreshortening, perspective/ },
    cloud_break_harbor: { natural: [/descends out of a layer of clouds/, /clouds part to reveal the view far below/, /harbor town and the open sea below/], tags: /cloud, perspective/ },
    town_rapid_ascent: { natural: [/shoots rapidly upward/, /ground dropping away and shrinking below/, /residential street directly below/], tags: /from above, perspective/ },
  };
  for (const [id, expected] of Object.entries(cases)) {
    const state = applyPreset(id);
    const text = tsubaki(state);
    for (const pattern of expected.natural) assert.match(text, pattern, `${id}: ${text}`);
    // 移動の向きは、見える対象より前に書く
    before(text, /as the viewpoint/, /looking|gazing/);
    for (const tags of [pixaiTag(state), novelai(state)]) assert.match(tags, expected.tags, `${id}: ${tags}`);
  }
});

test("dynamic presets never add a person or a pose", () => {
  for (const id of DYNAMIC) for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const out = generateOutput(withTarget(applyPreset(id), platform, model), style).positive;
    assert.doesNotMatch(out, /\b(falling|flying|jumping|skydiv\w*|1girl|1boy|person|people|man|woman|character|pose|arms?|legs?|hands?|pov)\b/i, `${id} ${platform}/${model}/${style}: ${out}`);
  }
});

test("NovelAI and tag targets use short learned-style phrases for motion, not long sentences", () => {
  for (const id of DYNAMIC) {
    for (const out of [novelai(applyPreset(id), "detailed"), pixaiTag(applyPreset(id), "detailed")]) {
      assert.doesNotMatch(out, /as the viewpoint|view from/, `${id}: ${out}`);
      assert.ok(out.split(", ").every((tag) => tag.split(" ").length <= 9), `${id}: ${out}`);
    }
    const emphasized = generateOutput(withTarget(applyPreset(id), "novelai", "tsubaki", { novelaiEmphasis: true })).positive;
    assert.equal((emphasized.match(/::/g) || []).length, 2, `${id}: emphasis only once`);
    assert.doesNotMatch(emphasized, /[2-9]\.\d::|1\.[3-9]::/);
  }
});

test("static views keep exactly their v2.0 wording and get no motion cues", () => {
  for (const id of STATIC_VIEWS) {
    const state = applyPreset(id);
    assert.equal(state.scene.view.motion, "still", id);
    for (const [platform, model] of ALL_TARGETS) {
      const out = generateOutput(withTarget(state, platform, model), "detailed").positive;
      assert.doesNotMatch(out, /as the viewpoint|rushing|foreshortening|vanishing point|dutch angle|motion blur|speed lines/, `${id} ${platform}: ${out}`);
    }
  }
});

test("loading a preset or recipe never carries over motion, effects, frame or lens", () => {
  const dynamic = withTarget(applyPreset("city_dive"), "novelai");
  for (const id of STATIC_VIEWS.concat(["rainy_alley", "shrine_dusk"])) {
    const preset = presets.find((item) => item.id === id)!;
    // 画面の applyPreset と同じ合成
    const loaded = migrateState({ ...dynamic, ...structuredClone(preset.patch), backgroundMode: preset.mode, target: dynamic.target });
    assert.deepEqual(loaded.scene.view, applyPreset(id).scene.view, id);
    assert.equal(loaded.target.platform, "novelai");
  }
  for (const recipe of viewRecipes) {
    const view = viewFromRecipe(recipe.id)!;
    const reference = { ...createDefaultView(), ...recipe.view, mode: "custom" };
    assert.deepEqual(view, reference, recipe.id);
    if (!["flying", "falling", "dive", "rapid_ascent", "cloud_break", "fly_by", "underwater_up"].includes(recipe.id)) {
      assert.equal(view.motion, "still", recipe.id);
      assert.deepEqual(view.motionEffects, [], recipe.id);
      assert.equal(view.lens, "", recipe.id);
    }
  }
});

test("dynamic motions are disabled or warned where they cannot read well", () => {
  const ground = applyPreset("residential_dusk"); ground.scene.view = { ...ground.scene.view, mode: "custom", vantage: "street" };
  const g = getViewAvailability(ground);
  for (const id of ["falling", "dive", "cloud_break"]) assert.ok(g.disabled.motion[id], id);
  assert.equal(g.disabled.motion.rapid_ascent, undefined);
  const tower = applyPreset("castle_aerial"); tower.scene.view = { ...tower.scene.view, vantage: "tower_top", altitude: "" };
  assert.ok(getViewAvailability(tower).disabled.motion.cloud_break);
  assert.equal(getViewAvailability(tower).disabled.motion.dive, undefined);
  const fall = applyPreset("sky_fall_city");
  fall.scene.view = { ...fall.scene.view, gaze: "up_diagonal", distance: "very_far", motionEffects: ["speed_lines"], lens: "fisheye" };
  const ids = getViewAvailability(fall).notices.map((item) => item.id);
  for (const id of ["motion-gaze", "motion-distance", "effects-style", "fisheye-style"]) assert.ok(ids.includes(id), id);
  // 静止に戻すと、演出は出力されない
  const still = applyPreset("sky_fall_city"); still.scene.view.motion = "still";
  assert.doesNotMatch(tsubaki(still), /converging|strong wind|rushing/);
});


/* ------------------------------------------------------------------ */
/* v2.2：季節・イベント装飾                                              */
/* ------------------------------------------------------------------ */

const simpleState = (): BackgroundState => ({ ...createDefaultState(), backgroundMode: "simple" });
const seasonalPresetList = presets.filter((preset) => preset.mode === "simple" && ["season", "event", "world"].includes(preset.group));
const motifIds = new Set(simpleData.motifs.map((item) => item.id));

test("v2.2-1. new motif IDs are unique", () => {
  const ids = seasonalMotifs.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of seasonalMotifs) {
    assert.match(item.id, /^[a-z][a-z0-9_]*$/, item.id);
    assert.ok(item.label && item.en && item.tag, item.id);
    assert.doesNotMatch(item.tag, /[()]/, `${item.id}: PIXAIで強調に読まれる丸かっこを使わない`);
    assert.doesNotMatch(item.en, /^(a|an|the)\s/i, `${item.id}: 密度の語を前に付けるので冠詞で始めない`);
    assert.equal(item.validation, "unverified", `${item.id}: 実画像で確かめるまでは未検証のまま`);
  }
});

test("v2.2-2. new motif IDs never collide with existing IDs anywhere in the app", () => {
  const existing = new Set<string>();
  for (const collection of [...Object.values(sceneData), ...Object.values(viewData)]) if (Array.isArray(collection)) for (const item of collection) existing.add(item.id);
  for (const id of basicMotifIds) existing.add(id);
  for (const item of seasonalMotifs) assert.ok(!existing.has(item.id), item.id);
  // 基本の9件は1件ずつ、複製されずに残っている
  assert.deepEqual(simpleData.motifs.slice(0, 9).map((item) => item.id), basicMotifIds);
  assert.equal(simpleData.motifs.length, basicMotifIds.length + seasonalMotifs.length);
});

test("v2.2-3. events, profiles and presets only reference known IDs", () => {
  const profileIds = new Set(designProfiles.map((item) => item.id));
  const eventIds = eventThemes.map((item) => item.id);
  assert.equal(new Set(eventIds).size, eventIds.length);
  for (const event of eventThemes) {
    for (const id of event.motifs) assert.ok(seasonalMotifs.some((item) => item.id === id), `${event.id}: ${id} は新規モチーフ`);
    for (const id of event.reuse) assert.ok(basicMotifIds.includes(id), `${event.id}: ${id} は既存モチーフの再利用`);
    assert.ok(event.starter.length >= 1 && event.starter.length <= 2, `${event.id}: おすすめは1〜2種類`);
    for (const id of event.starter) assert.ok([...event.motifs, ...event.reuse].includes(id), `${event.id}: ${id}`);
    assert.ok(["edges", "corners", "upper"].includes(event.placement), event.id);
    assert.ok(event.profiles.length >= 2, `${event.id}: 見た目を1つに固定しない`);
    for (const id of event.profiles) assert.ok(profileIds.has(id), `${event.id}: ${id}`);
    // おすすめ同士が競合しない（文化の違う飾りが混ざらない）
    for (const id of event.starter) assert.ok(!(seasonalMotifs.find((item) => item.id === id)?.conflicts || []).some((other) => event.starter.includes(other)), `${event.id}: ${id}`);
  }
  for (const motif of seasonalMotifs) for (const id of motif.conflicts || []) assert.ok(motifIds.has(id), `${motif.id} → ${id}`);
  for (const profile of designProfiles) {
    const state = simpleState();
    Object.assign(state.simple, { ...structuredClone(profile.patch), pattern: profile.patch.pattern || "", texture: profile.patch.texture || "", designProfile: profile.id });
    assert.deepEqual(migrateState(state).simple, state.simple, profile.id);
  }
  for (const preset of seasonalPresetList) {
    const simple = applyPreset(preset.id).simple;
    assert.ok(eventIds.includes(simple.eventTheme), preset.id);
    assert.ok(simple.designProfile === "" || profileIds.has(simple.designProfile), preset.id);
  }
  // Manus提案データからの読み替え先は、すべて実在するID
  const negativeIds = ["people", "text", "watermark", "creatures", "clutter"];
  for (const [from, to] of Object.entries(proposalIdAliases)) assert.ok(motifIds.has(to) || eventIds.includes(to) || negativeIds.includes(to), `${from} → ${to}`);
});

test("v2.2-4. every event has a preset-free path that produces a clean prompt on every target", () => {
  for (const event of eventThemes) {
    const state = simpleState();
    state.simple.eventTheme = event.id;
    state.simple.decoration = { enabled: true, motifs: [...event.starter], placement: event.placement, density: "sparse" };
    for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
      const out = generateOutput(withTarget(state, platform, model), style).positive;
      assert.ok(out.length > 30, `${event.id} ${platform}/${model}/${style}`);
      assert.doesNotMatch(out, /undefined|null|\{|\}|,\s*,|\s{2,}/, `${event.id} ${platform}/${model}/${style}: ${out}`);
      const separated = event.starter.some((id) => (seasonalMotifs.find((item) => item.id === id)?.fusion.level || "low") !== "low");
      for (const id of event.starter) {
        const option = simpleData.motifs.find((item) => item.id === id)!;
        const seasonalMotif = seasonalMotifs.find((item) => item.id === id);
        const natural = platform === "generic" || model === "tsubaki" && platform === "pixai";
        const expected = natural ? (separated && seasonalMotif?.sepEn) || option.en : (separated && seasonalMotif?.sepTag) || option.tag || option.en;
        assert.ok(out.includes(expected.split(",")[0]), `${event.id}: ${id} が出力に入る ${out}`);
      }
    }
  }
});

test("v2.2-5. seasonal presets are person-friendly, distinct, and free of undefined values", () => {
  assert.ok(seasonalPresetList.length >= 20);
  const looks = new Set<string>();
  for (const preset of seasonalPresetList) {
    const state = applyPreset(preset.id);
    const s = state.simple;
    assert.equal(s.subjectRelation, "character_focus", preset.id);
    assert.ok(s.decoration.enabled && s.decoration.motifs.length >= 1 && s.decoration.motifs.length <= 2, `${preset.id}: モチーフは1〜2種類`);
    assert.equal(s.decoration.density, "sparse", preset.id);
    assert.ok(["edges", "corners", "upper"].includes(s.decoration.placement), preset.id);
    assert.deepEqual(getAdvice(state).filter((item) => item.kind === "warning").map((item) => item.id), [], `${preset.id}: 警告なしで使える`);
    looks.add(`${s.colors.primary}/${s.colors.secondary}/${s.backgroundType}/${s.decoration.motifs.join("+")}`);
    for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
      const out = generateOutput(withTarget(state, platform, model), style).positive;
      assert.doesNotMatch(out, /undefined|null|\b(\w+) \1\b/i, `${preset.id} ${platform}/${model}/${style}: ${out}`);
      // 人物・服装・ポーズは指定しない。品質タグも足さない
      assert.doesNotMatch(out, /\b(girl|boy|woman|man|wearing|holding|pose|masterpiece|best quality|kimono|costume)\b/i, `${preset.id}: ${out}`);
    }
  }
  assert.equal(looks.size, seasonalPresetList.length, "似た背景ばかりにならない");
  // 優先して入れたい系統がそろっている
  for (const id of ["sakura", "summer_festival", "moon_viewing", "winter_snow", "christmas", "halloween", "valentine", "white_day", "tanabata", "birthday", "school_milestone", "new_year"]) {
    assert.ok(seasonalPresetList.some((preset) => applyPreset(preset.id).simple.eventTheme === id), id);
  }
});

test("v2.2-6. without an event or taste, every simple output is byte-identical to v2.1", () => {
  const snapshot = fixture("v2.1-simple-output.json") as Record<string, string>;
  for (const [key, expected] of Object.entries(snapshot)) {
    const [id, target, style] = key.split(":") as [string, string, "short" | "detailed"];
    const [platform, model] = target.split("/") as [Platform, PixaiModel];
    let state: BackgroundState;
    if (id === "__default") state = simpleState();
    else if (id.startsWith("__rel_")) { state = simpleState(); state.simple.subjectRelation = id.slice(6); state.simple.decoration.placement = "corners"; state.simple.decoration.density = "sparse"; }
    else state = { ...applyPreset(id), backgroundMode: "simple" };
    const result = generateOutput(withTarget(state, platform, model), style);
    assert.equal(result.positive + (result.negative !== null ? ` ||NEG|| ${result.negative}` : ""), expected, key);
    assert.deepEqual(result.notes, [], key);
  }
});

test("v2.2-7. decoration off removes every event motif from every output", () => {
  for (const preset of seasonalPresetList) {
    const state = applyPreset(preset.id);
    state.simple.decoration.enabled = false;
    const words = state.simple.decoration.motifs.flatMap((id) => { const item = simpleData.motifs.find((option) => option.id === id)!; const extra = seasonalMotifs.find((option) => option.id === id); return [item.en, ...(item.tag || "").split(", "), extra?.sepEn || "", extra?.sepTag || ""]; }).filter(Boolean);
    for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
      const out = generateOutput(withTarget(state, platform, model), style).positive;
      for (const word of words) assert.ok(!out.includes(word), `${preset.id} ${platform}/${model}/${style}: ${word} in ${out}`);
      assert.doesNotMatch(out, /leaving the center open|open central space|apart from the character|sparse decorations|sticker|illustration/, `${preset.id}: ${out}`);
    }
  }
});

test("v2.2-8. v2.1 saved data (without the new fields) loads and keeps its output", () => {
  const old = applyPreset("lace_ribbon_pink") as unknown as { simple: Record<string, unknown> };
  delete old.simple.eventTheme; delete old.simple.designProfile;
  const migrated = migrateState(old);
  assert.equal(migrated.simple.eventTheme, "");
  assert.equal(migrated.simple.designProfile, "");
  assert.equal(generatePrompt({ ...migrated, backgroundMode: "simple" }), generatePrompt({ ...applyPreset("lace_ribbon_pink"), backgroundMode: "simple" }));
  // 書き出しJSON（v2）・保存一覧からも読める
  const design = parseImportedJson({ version: 2, type: "background-workshop-design", state: old });
  assert.equal(design.kind === "design" && design.state.simple.eventTheme, "");
  const list = migrateSavedList([{ id: "x", name: "旧データ", savedAt: "2026-10-01", state: old }]);
  assert.equal(list[0].state.simple.designProfile, "");
  // 未知・壊れた値は「選ばない」へ
  assert.equal(migrateState({ version: 2, simple: { eventTheme: "unknown_event", designProfile: 3 } }).simple.eventTheme, "");
  assert.equal(migrateState({ version: 2, simple: { eventTheme: "unknown_event", designProfile: 3 } }).simple.designProfile, "");
  // 新しい値は書き出し → 読み込みで保たれる
  const fresh = applyPreset("dark_halloween");
  const round = parseImportedJson(JSON.parse(JSON.stringify(exportDesign(fresh))));
  assert.ok(round.kind === "design");
  if (round.kind === "design") assert.deepEqual(round.state.simple, fresh.simple);
  // 生成処理に、移行前の形のまま渡しても落ちない
  assert.ok(generatePrompt({ ...(old as unknown as BackgroundState), backgroundMode: "simple" }).length > 30);
});

test("v2.2: the event does not fix the look — the same event can take different tastes", () => {
  const christmas = eventThemes.find((item) => item.id === "christmas")!;
  for (const name of ["classic_holiday", "pastel_pop", "dark_kawaii", "simple_elegant", "yume_kawaii", "sticker_seal"]) assert.ok(christmas.profiles.includes(name), name);
  const classic = applyPreset("classic_christmas"); const dreamy = applyPreset("yume_christmas");
  assert.equal(classic.simple.eventTheme, dreamy.simple.eventTheme);
  assert.notEqual(generatePrompt(classic), generatePrompt(dreamy));
  // テイストの一言は、選んだときだけ出力に入る（ステッカー風は装飾があるときだけ）
  const sticker = simpleState(); sticker.simple.designProfile = "sticker_seal";
  sticker.simple.decoration.enabled = false;
  assert.doesNotMatch(generatePrompt(sticker), /sticker/);
  sticker.simple.decoration.enabled = true;
  assert.match(generatePrompt(sticker), /sticker-like cutouts/);
  assert.match(pixaiTag(sticker), /sticker-style decorations/);
});

test("v2.2: tag outputs show placement and density for seasonal motifs, even in the short version", () => {
  const state = applyPreset("newyear_washi");
  for (const out of [pixaiTag(state, "short"), novelai(state, "short")]) {
    assert.match(out, /shimenawa, shide/);
    assert.match(out, /decorations along the top border, sparse decorations/);
  }
  assert.ok(generateOutput(withTarget(state, "pixai", "tag"), "short").notes.length === 1);
  assert.match(tsubaki(state), /decorated with sparse shimenawa rope trim .* concentrated toward the top, leaving the center open\./);
  // 背景のみのときは「中央を空ける」を書かない
  state.simple.subjectRelation = "background_only";
  assert.doesNotMatch(tsubaki(state), /center open/);
});

test("v2.2 advisor: conflicts, culture mix, edge placement and text-prone motifs", () => {
  const mix = applyPreset("summer_lantern_indigo"); mix.simple.decoration.motifs = ["tiny_paper_lanterns", "small_red_chinese_lanterns"];
  const conflict = getAdvice(mix).find((item) => item.id === "motif-conflict");
  assert.ok(conflict && conflict.kind === "warning" && /別の文化/.test(conflict.title));
  assert.deepEqual(conflict.patch, { path: "simple.decoration.motifs", value: "small_red_chinese_lanterns", multi: true });
  const sparkle = applyPreset("summer_firework_pop"); sparkle.simple.decoration.motifs = ["tiny_firework_bursts", "subtle_sparkles"];
  assert.ok(getAdvice(sparkle).some((item) => item.id === "motif-conflict" && /見分けにくい/.test(item.title)));
  const center = applyPreset("sakura_milk"); center.simple.decoration.placement = "scattered";
  assert.equal(getAdvice(center).find((item) => item.id === "seasonal-edge")?.patch?.value, "upper");
  center.simple.subjectRelation = "background_only";
  assert.ok(!getAdvice(center).some((item) => item.id === "seasonal-edge"));
  const kadomatsu = applyPreset("newyear_washi"); kadomatsu.simple.decoration.motifs = ["small_kadomatsu"];
  assert.equal(getAdvice(kadomatsu).find((item) => item.id === "motif-placement")?.patch?.value, "corners");
  const tanzaku = withTarget(applyPreset("tanabata_night"), "novelai", "tsubaki", { negativeItems: ["watermark"] });
  assert.deepEqual(getAdvice(tanzaku).find((item) => item.id === "motif-text")?.patch, { path: "target.negativeItems", value: "text", multi: true });
  assert.ok(!getAdvice(withTarget(applyPreset("tanabata_night"), "generic")).some((item) => item.id === "motif-text"), "ネガティブ欄のない生成先では提案しない");
  // 端に「まばら」なら、プレーンでも2種類まで警告しない。散らすと従来どおり警告する
  const plain = applyPreset("classic_christmas");
  assert.ok(!getAdvice(plain).some((item) => item.id === "plain-decor"));
  plain.simple.decoration.placement = "scattered";
  assert.ok(getAdvice(plain).some((item) => item.id === "plain-decor"));
});

test("v2.2: clearing and resetting the simple mode also clears the event and taste", () => {
  const state = applyPreset("dark_halloween");
  const cleared = clearActiveMode(state);
  assert.equal(cleared.simple.eventTheme, ""); assert.equal(cleared.simple.designProfile, "");
  assert.doesNotMatch(generatePrompt(cleared), /jack|center open|pastel accents/);
  assert.deepEqual(resetActiveMode(state).simple, createDefaultState().simple);
});


/* ------------------------------------------------------------------ */
/* v2.3：季節装飾と人物の融合防止                                         */
/* ------------------------------------------------------------------ */

const allOutputs = (state: BackgroundState) => ALL_TARGETS.flatMap(([platform, model]) => (["short", "detailed"] as const).map((style) => ({ key: `${platform}/${model}/${style}`, platform, model, style, out: generateOutput(withTarget(state, platform, model), style).positive })));
const halloween = () => applyPreset("pastel_halloween");

test("v2.3-1. high-risk motifs get the separation phrasing for a character background", () => {
  for (const { key, platform, model, out } of allOutputs(halloween())) {
    if (platform === "generic" || model === "tsubaki" && platform === "pixai") {
      assert.match(out, /small flat cartoon jack-o'-lantern stickers/, key);
      assert.match(out, /in the corners of the background, kept sparse, leaving an open central space for the character/, key);
    } else {
      assert.match(out, /jack-o'-lantern stickers, bat silhouette stickers, decorations in the corners, sparse decorations/, key);
      assert.doesNotMatch(out, /jack-o'-lantern,|jack-o'-lantern$/, `${key}: かぼちゃを単独のタグで出さない`);
    }
    if (platform === "pixai" && model === "tsubaki") assert.match(out, /The decorations stay flat on the background, apart from the character\./, key);
  }
  // 人物の容姿・人数・品質タグは足さない。否定語をポジティブに並べない
  for (const { key, out } of allOutputs(halloween())) assert.doesNotMatch(out, /\b(1boy|1girl|solo|face|hair|outfit|costume|pose|masterpiece|quality)\b|\bno \w+/i, key);
});

test("v2.3-2. background-only never adds character-protection wording", () => {
  for (const id of ["pastel_halloween", "birthday_candles", "tanabata_night", "moon_pale_blue"]) {
    const state = applyPreset(id); state.simple.subjectRelation = "background_only";
    for (const { key, out } of allOutputs(state)) {
      assert.doesNotMatch(out, /for the character|apart from the character|open central space|center open/, `${id} ${key}: ${out}`);
      assert.doesNotMatch(out, /stickers|flat .* illustrations?/, `${id} ${key}: 背景単体ではふだんの描写に戻す`);
    }
  }
});

test("v2.3-3. no-event backgrounds and the scene mode are untouched", () => {
  // v2.1 のスナップショット（v2.2-6）に加え、季節モチーフを選ばない限り「分ける」は効かない
  const plain = { ...applyPreset("lace_ribbon_pink"), backgroundMode: "simple" as const };
  const off = structuredClone(plain); off.simple.decorSeparation = false;
  for (const [platform, model] of ALL_TARGETS) assert.equal(generateOutput(withTarget(plain, platform, model)).positive, generateOutput(withTarget(off, platform, model)).positive);
  // 空間背景には人物分離の補正を入れない
  const scene = createDefaultState();
  scene.simple = applyPreset("pastel_halloween").simple;
  for (const [platform, model] of ALL_TARGETS) assert.doesNotMatch(generateOutput(withTarget(scene, platform, model)).positive, /sticker|apart from the character|jack/, platform);
});

test("v2.3-4. each target gets its own form", () => {
  const state = applyPreset("birthday_candles");
  const tsu = tsubaki(state);
  assert.match(tsu, /^A very pale white and peach clean studio background\. /);
  assert.match(tsu, /It is decorated with tiny flat candle illustrations and subtle sparkles in the corners of the background, kept sparse, leaving an open central space for the character\./);
  const tag = pixaiTag(state); const nai = novelai(state);
  for (const out of [tag, nai]) {
    assert.match(out, /candle illustrations, subtle sparkles, decorations in the corners, sparse decorations/);
    assert.doesNotMatch(out, /(^|, )candles(,|$)/, "キャンドルを単独のタグで出さない");
    assert.doesNotMatch(out, /\./, "タグ系は文にしない");
  }
  assert.match(generatePrompt(state, "detailed"), /\. The decorations stay flat on the background, apart from the character\.$/);
  // 分けるをオフにすると、v2.2 と同じ描き方（実物のモチーフ）に戻る
  state.simple.decorSeparation = false;
  assert.match(tsubaki(state), /sparse slim lit birthday candles and subtle sparkles gathered in the corners, leaving the center open\./);
  assert.doesNotMatch(tsubaki(state), /flat|apart from/);
});

test("v2.3-5/6. fusion metadata is complete and only references known risk kinds", () => {
  const kinds = new Set(Object.keys(fusionKindLabels));
  for (const motif of seasonalMotifs) {
    assert.ok(["low", "medium", "high"].includes(motif.fusion.level), motif.id);
    assert.ok(["flat", "print", "frame", "object", "phenomenon"].includes(motif.form), motif.id);
    for (const kind of motif.fusion.kinds) assert.ok(kinds.has(kind), `${motif.id}: ${kind}`);
    if (motif.fusion.level === "low") assert.deepEqual(motif.fusion.kinds, [], motif.id);
    else {
      assert.ok(motif.fusion.kinds.length > 0, motif.id);
      assert.ok(motif.sepEn && motif.sepTag, `${motif.id}: 分けるときの表現が要る`);
      assert.match(motif.sepEn!, /\bflat\b|hanging/, motif.id);
      assert.match(motif.sepTag!, /stickers?|illustrations?|decorations/, motif.id);
    }
    if (motif.fusion.observed) assert.match(motif.fusion.observed.date, /^\d{4}-\d{2}-\d{2}$/);
  }
  // 依頼で確認を求められたモチーフは、すべて medium 以上
  for (const id of ["smiling_jack_o_lantern", "slim_lit_birthday_candles", "five_color_tanzaku_paper_strips", "tiny_uchiwa_fans", "small_black_cat_silhouettes", "tiny_paper_lanterns", "small_red_chinese_knot_ornaments", "bauble_ornaments", "painted_eggs", "round_moon_ornament"]) {
    assert.notEqual(seasonalMotifs.find((item) => item.id === id)!.fusion.level, "low", id);
  }
  // 実画像で確かめたもの（2026-10-30 NovelAI）と推測だけのものを分けている
  assert.deepEqual(seasonalMotifs.filter((item) => item.fusion.observed).map((item) => item.id).sort(), ["bamboo_leaf_sprigs", "five_color_tanzaku_paper_strips", "round_moon_ornament", "slim_lit_birthday_candles", "smiling_jack_o_lantern"].sort());
});

test("v2.3: tag outputs never emit standalone words that also describe the character", () => {
  const forbidden = new Set(["silhouette", "white outline", "gold trim", "colorful", "retro style", "holographic", "sticker", "dreamy", "pastel colors", "concentrated toward the top", "gathered in the corners", "arranged along the edges"]);
  const states: BackgroundState[] = [...seasonalPresetList.map((preset) => applyPreset(preset.id))];
  for (const motif of seasonalMotifs) for (const separate of [true, false]) {
    const state = simpleState();
    Object.assign(state.simple, { eventTheme: "", decorSeparation: separate, decoration: { enabled: true, motifs: [motif.id], placement: motif.prefer[0], density: "sparse" } });
    states.push(state);
  }
  for (const profile of designProfiles) { const state = applyPreset("sakura_milk"); state.simple.designProfile = profile.id; states.push(state); }
  for (const state of states) for (const out of [pixaiTag(state, "short"), pixaiTag(state, "detailed"), novelai(state, "short"), novelai(state, "detailed")]) {
    for (const tag of out.split(", ")) assert.ok(!forbidden.has(tag), `${tag} in ${out}`);
  }
});

test("v2.3-7. decoration off removes motifs and the separation wording", () => {
  const state = applyPreset("dark_halloween"); state.simple.decoration.enabled = false;
  for (const { key, out } of allOutputs(state)) assert.doesNotMatch(out, /jack|cat|sticker|apart from|open central/, key);
});

test("v2.3-8. saved data without the separation flag loads with separation on", () => {
  const v22 = applyPreset("tanabata_night") as unknown as { simple: Record<string, unknown> };
  delete v22.simple.decorSeparation;
  const loaded = migrateState(v22);
  assert.equal(loaded.simple.decorSeparation, true);
  assert.deepEqual(loaded.simple, applyPreset("tanabata_night").simple);
  assert.equal(migrateState({ version: 2, simple: { decorSeparation: "yes" } }).simple.decorSeparation, true);
  const off = applyPreset("tanabata_night"); off.simple.decorSeparation = false;
  const round = parseImportedJson(JSON.parse(JSON.stringify(exportDesign(off))));
  assert.ok(round.kind === "design" && round.state.simple.decorSeparation === false);
  // v1 の保存データも引き続き読める
  assert.equal(parseImportedJson(fixture("v1-saved-data.json").design).kind, "design");
});

test("v2.3 advisor: one fusion notice only when separation is off, with a one-tap fix", () => {
  const on = halloween();
  assert.ok(!getAdvice(on).some((item) => item.id === "motif-fusion"));
  const off = halloween(); off.simple.decorSeparation = false;
  const fusion = getAdvice(off).filter((item) => item.id === "motif-fusion");
  assert.equal(fusion.length, 1);
  assert.equal(fusion[0].kind, "warning");
  assert.match(fusion[0].body, /かぼちゃが人物の顔や頭部として描かれることがあります。.*実画像で起きた例があります/);
  assert.deepEqual(fusion[0].patch, { path: "simple.decorSeparation", value: true });
  const tanzaku = applyPreset("tanabata_night"); tanzaku.simple.decorSeparation = false;
  assert.match(getAdvice(tanzaku).find((item) => item.id === "motif-fusion")!.body, /短冊が人物の手元に出ることがあります/);
  const candle = applyPreset("birthday_candles"); candle.simple.decorSeparation = false;
  assert.match(getAdvice(candle).find((item) => item.id === "motif-fusion")!.body, /キャンドルが人物の持ち物や頭部の装飾/);
  // 背景のみ・低リスクだけのときは出さない
  off.simple.subjectRelation = "background_only";
  assert.ok(!getAdvice(off).some((item) => item.id === "motif-fusion"));
  const petals = applyPreset("sakura_milk"); petals.simple.decorSeparation = false;
  assert.ok(!getAdvice(petals).some((item) => item.id === "motif-fusion"));
  // かぼちゃ・キャンドルを上側に置くと、四隅を勧める（頭の高さを避ける）
  const upper = halloween(); upper.simple.decoration.placement = "upper";
  assert.equal(getAdvice(upper).find((item) => item.id === "motif-placement")?.patch?.value, "corners");
});

/* ------------------------------------------------------------------ */
/* v2.4：simple background の比較（試験機能）                              */
/* ------------------------------------------------------------------ */

import { labVariants } from "../app/lib/generator.ts";
import { labRecordsToCsv, parseLabRecords, personPrompts, summarizeLab } from "../app/lib/lab-log.ts";

test("v2.4. the default output is unchanged; variant A is exactly the current output", () => {
  for (const preset of seasonalPresetList) for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const state = withTarget(applyPreset(preset.id), platform, model);
    assert.equal(generateOutput(state, style, {}).positive, generateOutput(state, style).positive, preset.id);
    const variants = labVariants(state, style);
    if (platform === "generic" || model === "tsubaki" && platform === "pixai") { assert.deepEqual(variants, [], "自然文の生成先は比較対象外"); continue; }
    assert.deepEqual(variants.map((item) => item.code), ["A", "B", "C", "D", "E"]);
    assert.equal(variants[0].positive, generateOutput(state, style).positive, `${preset.id} ${platform}/${style}`);
  }
});

test("v2.4. variants change only the base keyword and keep type, colors, motifs, placement and density", () => {
  const state = withTarget(applyPreset("pastel_halloween"), "novelai");
  const [a, b, c, d, e] = labVariants(state, "short").map((item) => item.positive);
  const rest = a.replace(/^simple background, /, "");
  assert.equal(b, rest);
  assert.equal(c, `decorative background, ${rest}`);
  assert.equal(d, `portrait backdrop, ${rest}`);
  assert.equal(e, `simple decorative backdrop, ${rest}`);
  for (const out of [a, b, c, d, e]) {
    assert.match(out, /lavender background, peach background, gradient background/, "背景タイプの指定は消えない");
    assert.match(out, /jack-o'-lantern stickers, bat silhouette stickers, decorations in the corners, sparse decorations/);
    assert.equal(new Set(out.split(", ")).size, out.split(", ").length, `重複なし：${out}`);
  }
  // 背景タイプのタグと同じ語でも重複しない（studio background + portrait backdrop など）
  const studio = labVariants(withTarget(applyPreset("birthday_candles"), "pixai", "tag"), "detailed");
  for (const item of studio) assert.match(item.positive, /studio background/, item.code);
  // 比較では「人物と装飾を分ける」をオンに固定する
  const off = withTarget(applyPreset("pastel_halloween"), "novelai"); off.simple.decorSeparation = false;
  assert.match(labVariants(off, "short")[0].positive, /jack-o'-lantern stickers/);
});

test("v2.4. variants appear only for seasonal character backgrounds on tag targets", () => {
  assert.deepEqual(labVariants(withTarget({ ...applyPreset("pink_purikura"), backgroundMode: "simple" }, "novelai")), [], "イベントなしの通常背景");
  const only = withTarget(applyPreset("pastel_halloween"), "novelai"); only.simple.subjectRelation = "background_only";
  assert.deepEqual(labVariants(only), [], "背景だけで使う");
  // 背景のみでは、試験の指定を渡しても portrait backdrop などを入れない
  assert.doesNotMatch(generateOutput(only, "short", { bgKeyword: "portrait" }).positive, /portrait backdrop/);
  assert.match(generateOutput(only, "short", { bgKeyword: "portrait" }).positive, /^no humans, simple background/);
  const off = withTarget(applyPreset("pastel_halloween"), "novelai"); off.simple.decoration.enabled = false;
  assert.deepEqual(labVariants(off), [], "装飾なし");
  assert.deepEqual(labVariants({ ...withTarget(applyPreset("pastel_halloween"), "novelai"), backgroundMode: "scene" }), [], "空間背景");
  // 通常のシンプル背景は、試験の指定を渡しても変わらない
  const plain = withTarget({ ...applyPreset("lace_ribbon_pink"), backgroundMode: "simple" }, "pixai", "tag");
  assert.equal(generateOutput(plain, "short", { bgKeyword: "decorative", decorForm: "printed", placeWording: "edge" }).positive, generateOutput(plain, "short").positive);
});

test("v2.4. motif form and placement wording can be compared without touching the default", () => {
  const state = withTarget(applyPreset("classic_christmas"), "novelai");
  const [printed] = labVariants(state, "short", { decorForm: "printed" });
  assert.match(printed.positive, /printed holly motifs, printed christmas ornament motifs/);
  const [illustrated] = labVariants(state, "short", { decorForm: "illustrations" });
  assert.match(illustrated.positive, /decorative holly illustrations, decorative christmas ornament illustrations/);
  const [stickers] = labVariants(state, "short", { decorForm: "stickers" });
  assert.match(stickers.positive, /holly stickers, christmas ornament stickers/);
  const [edge] = labVariants(state, "short", { placeWording: "edge" });
  assert.match(edge.positive, /decorations at the top of the background/);
  assert.doesNotMatch(edge.positive, /border/);
  assert.match(generateOutput(state, "short").positive, /decorations along the top border/, "既定はそのまま");
  // 低リスクのモチーフ（分ける対象外）は書き方を変えない
  const [petals] = labVariants(withTarget(applyPreset("sakura_milk"), "novelai"), "short", { decorForm: "printed" });
  assert.match(petals.positive, /cherry blossoms, petals/);
  for (const motif of seasonalMotifs.filter((item) => item.fusion.level !== "low")) assert.ok(motif.sepBase, `${motif.id}: 書き方を比べるための名詞`);
});

test("v2.4 lab log: tolerant parsing, grouping and CSV", () => {
  const records = parseLabRecords([
    { id: "1", model: "novelai", person: "rich", variant: "C", seed: "11", eventTheme: "halloween", checks: { person: true, face: true, decor: true, noFusion: true, size: true, season: true } },
    { id: "2", model: "novelai", person: "rich", variant: "C", seed: "12", eventTheme: "halloween", checks: { person: true, noFusion: false }, note: "瞳に, \"かぼちゃ\"" },
    { id: "3", model: "unknown", variant: "Z", checks: "broken" },
    null, 7,
  ]);
  assert.equal(records.length, 3);
  assert.equal(records[2].model, "other"); assert.equal(records[2].variant, "A"); assert.equal(records[2].checks.person, false);
  const summary = summarizeLab(records);
  const c = summary.find((row) => row.variant === "C")!;
  assert.equal(c.count, 2); assert.equal(c.allGood, 1); assert.equal(c.byCheck.noFusion, 1); assert.equal(c.byCheck.person, 2);
  const csv = labRecordsToCsv(records, { event: (id) => (id === "halloween" ? "ハロウィン" : "") });
  assert.match(csv.split("\n")[0], /^日時,生成先,人物指定,人物指定の入力先,方式/);
  assert.match(csv, /NovelAI,厚めの6語,その他・不明,C,default,border,ハロウィン,12,○,×,×,×,×,×,"瞳に, ""かぼちゃ"""/);
  assert.deepEqual(parseLabRecords("broken"), []);
});

/* ------------------------------------------------------------------ */
/* v2.5：人物指定の入力先（NovelAIのキャラクタープロンプト欄）               */
/* ------------------------------------------------------------------ */

test("v2.5 lab log: the input field is recorded, grouped separately and exported; old logs read as unknown", () => {
  const oldLog = parseLabRecords([{ id: "old", model: "novelai", person: "thin", variant: "A", checks: {} }]);
  assert.equal(oldLog[0].personSlot, "unknown", "v2.4 の記録は「不明」として読む");
  assert.equal(oldLog[0].person, "thin", "既存のIDの意味は変えない");
  assert.equal(personPrompts.find((item) => item.id === "thin")!.example, "1boy");
  assert.equal(personPrompts.find((item) => item.id === "focus")!.example, "boy, male focus, upper body, portrait");
  assert.equal(personPrompts.find((item) => item.id === "rich")!.example, "1boy, solo, portrait, upper body, looking at viewer, casual clothes");
  const base = { model: "novelai", person: "focus", variant: "C", eventTheme: "halloween", checks: { person: true } };
  const records = parseLabRecords([{ ...base, id: "1", personSlot: "character" }, { ...base, id: "2", personSlot: "combined" }, { ...base, id: "3", personSlot: "character" }, { ...base, id: "4", personSlot: "nonsense" }]);
  assert.deepEqual(records.map((item) => item.personSlot), ["character", "combined", "character", "unknown"]);
  const summary = summarizeLab(records);
  assert.equal(summary.length, 3, "入力先が違えば別の条件として数える");
  assert.equal(summary.find((row) => row.personSlot === "character")!.count, 2);
  const csv = labRecordsToCsv(records);
  assert.match(csv, /NovelAI,具体的な4語,キャラクター欄に分けた,C/);
  assert.match(csv, /,通常の欄にまとめた,/);
});

test("v2.5: guidance changes do not touch any generated prompt", () => {
  // 背景用プロンプトに人物タグが入らない（キャラクター欄の例は画面の案内だけ）
  for (const preset of seasonalPresetList) for (const [platform, model] of ALL_TARGETS) for (const style of ["short", "detailed"] as const) {
    const state = withTarget(applyPreset(preset.id), platform, model);
    const out = generateOutput(state, style).positive;
    assert.doesNotMatch(out, /male focus|\bboy\b|1boy|upper body|portrait(?! backdrop)/, `${preset.id} ${platform}/${model}/${style}`);
    for (const variant of labVariants(state, style)) assert.doesNotMatch(variant.positive, /male focus|1boy|upper body/, `${preset.id} ${variant.code}`);
  }
});
