/**
 * 見え方（視点）辞書。
 * 「どこから（観測位置）」「何を（見える対象）」「どの向きに（視線）」「どのくらい離れて（距離・高度）」
 * 「どう動きながら（動き）」「何越しに（視界の枠）」「どんな画角で（レンズ）」を、互いに独立した情報として持つ。
 *
 * en  : 自然文向けの英語句（{s} は舞台、{t} は見える対象に置換される）
 * tag : タグ系モデル（PIXAIのタグ系・NovelAI）向けの短い句。空文字なら出力しない
 */

export type ViewLevel = "ground" | "interior" | "elevated" | "aerial" | "surface" | "underwater";

export type ViewOption = {
  id: string;
  label: string;
  en: string;
  tag: string;
  hint?: string;
  level?: ViewLevel;
  withStage?: string;
};

const v = (id: string, label: string, en: string, tag: string, extra: Partial<ViewOption> = {}): ViewOption => ({ id, label, en, tag, ...extra });

/** どこから見る？（観測位置） */
export const vantages: ViewOption[] = [
  v("ground", "地上", "from ground level", "", { level: "ground", withStage: "standing at ground level in {s}" }),
  v("street", "道路・広場", "from street level", "street level", { level: "ground", withStage: "at street level in {s}" }),
  v("interior", "建物の内部", "from inside a building", "indoors", { level: "interior", withStage: "from inside {s}" }),
  v("window", "窓辺", "from beside a window", "by the window", { level: "interior", withStage: "from beside a window in {s}" }),
  v("balcony", "バルコニー", "from a balcony", "balcony", { level: "elevated", withStage: "from a balcony of {s}" }),
  v("rooftop", "屋上", "from a rooftop", "rooftop", { level: "elevated", withStage: "from a rooftop in {s}" }),
  v("tower_top", "塔の上", "from the top of a tower", "on tower", { level: "elevated", withStage: "from the top of a tower in {s}" }),
  v("cliff", "高台・崖の上", "from a high cliff", "cliff", { level: "elevated", withStage: "from a high cliff overlooking {s}" }),
  v("bridge", "橋の上", "from a bridge", "bridge", { level: "elevated", withStage: "from a bridge in {s}" }),
  v("ship", "船上", "from the deck of a ship", "ship deck", { level: "surface", withStage: "from the deck of a ship near {s}" }),
  v("underwater", "水中", "from underwater", "underwater", { level: "underwater", withStage: "from underwater in {s}" }),
  v("low_air", "低空", "from low in the air", "aerial view, low altitude", { level: "aerial", withStage: "from low in the air above {s}" }),
  v("sky", "上空", "from high in the sky", "aerial view", { level: "aerial", withStage: "from high in the sky above {s}" }),
  v("above_clouds", "雲の上", "from high above the clouds", "above clouds, aerial view", { level: "aerial", withStage: "from high above the clouds over {s}" }),
];

/** 何が見える？（視界の対象）。main_stage は STEP 1 で選んだ場所そのもの */
export const viewTargets: ViewOption[] = [
  v("main_stage", "選んだ場所そのもの", "", ""),
  v("surroundings", "周辺の街並み", "the surrounding streets and rooftops", "cityscape, rooftops"),
  v("castle_town", "城下町・旧市街", "an old castle town", "old town, rooftops"),
  v("harbor_town", "港町", "a harbor town along the coast", "harbor, port town"),
  v("city", "都市", "a sprawling city", "cityscape"),
  v("city_night", "都市の夜景", "the glittering lights of a city at night", "city lights, night cityscape"),
  v("castle", "城・宮殿", "a towering castle", "castle"),
  v("forest", "森林", "a wide forest", "forest"),
  v("mountains", "山脈", "a mountain range", "mountain range"),
  v("sea", "海", "the open sea", "ocean"),
  v("lake_river", "湖・川", "a lake and a winding river", "lake, river"),
  v("sky_clouds", "空・雲", "the open sky and clouds", "sky, clouds"),
  v("horizon", "地平線・水平線", "the distant horizon", "horizon"),
  v("distant_buildings", "遠方の建築物", "distant buildings", "distant buildings"),
  v("countryside", "田園・平原", "rolling countryside and fields", "field, landscape"),
  v("water_surface", "水面", "the shimmering water surface", "water surface"),
  v("seafloor", "海底", "the seafloor", "seafloor"),
];

/** どの方向を見る？（視線の向き）。カメラの高さや画角とは別の情報 */
export const gazes: ViewOption[] = [
  v("forward", "正面", "looking straight ahead at", ""),
  v("up_diagonal", "斜め上を見上げる", "looking up at", "from below, looking up"),
  v("straight_up", "真上を見上げる", "looking straight up at", "from directly below, looking up"),
  v("down_diagonal", "斜め下を見下ろす", "looking down at", "from above, looking down"),
  v("straight_down", "真下を見る", "looking straight down at", "from above, top-down view"),
  v("horizon_far", "遠くを水平に眺める", "gazing out across", "wide view, horizon"),
  v("feet", "足元を見る", "looking down at the ground underfoot", "looking down, ground"),
];

/** どのくらい離れている？ */
export const distances: ViewOption[] = [
  v("", "指定しない", "", ""),
  v("near", "近距離", "seen up close", ""),
  v("mid", "中距離", "seen from a moderate distance", ""),
  v("far", "遠景", "seen from far away", "distant view"),
  v("very_far", "超遠景", "seen from a great distance across a vast expanse", "panorama, vast landscape"),
];

/** 高さ（空中の視点だけで使う）。en は「どこから」の句そのものを置き換える */
export const altitudes: ViewOption[] = [
  v("", "指定しない", "", ""),
  v("ground_level", "地表付近", "from just above the ground", "low altitude"),
  v("low", "低空", "from low in the air", "low altitude"),
  v("mid", "中高度", "from midair at a moderate altitude", ""),
  v("high", "高高度", "from high in the sky", "high altitude"),
  v("above_clouds", "雲上", "from high above the clouds", "above clouds"),
];

/**
 * 動きはある？ 人物のポーズではなく、視点（カメラ・観測者）の動き。
 * tag は確立した構図タグ（from above / foreshortening / perspective など）を使い、
 * falling・flying のように人物の姿勢と読まれやすい語や、学習されていない造語は使わない。
 * 速い動き（飛行・落下・急降下など）の向きと遠近の手がかりは motionProfiles にまとめる。
 */
export const motions: ViewOption[] = [
  v("still", "静止", "", ""),
  v("moving", "移動中", "as the viewpoint moves through the scene", ""),
  v("flying", "飛行中", "as the viewpoint flies forward through the open air", ""),
  v("gliding", "滑空中", "as the viewpoint glides smoothly on the wind", ""),
  v("ascending", "上昇中", "as the viewpoint slowly rises upward", ""),
  v("rapid_ascent", "急上昇", "as the viewpoint shoots rapidly upward", ""),
  v("descending", "降下中", "as the viewpoint slowly descends", ""),
  v("cloud_break", "雲を抜けて降下", "as the viewpoint descends out of a layer of clouds", ""),
  v("dive", "急降下", "as the viewpoint dives steeply toward {t}", ""),
  v("falling", "落下中", "as the viewpoint plunges straight down", ""),
  v("floating", "浮遊中", "from a weightless, drifting viewpoint", ""),
  v("approaching", "対象へ接近中", "as the viewpoint approaches {t}", ""),
  v("receding", "対象から遠ざかる", "as the viewpoint pulls away from {t}", ""),
  v("passing", "対象のそばを通過", "as the viewpoint sweeps past {t}", ""),
  v("fly_by", "高速で横を通過", "as the viewpoint races past close beside {t} at high speed", ""),
];

/**
 * 速い動きの「向き」と「遠近の手がかり」。
 * - cue / cueUp / cueLevel : 視線が下向き・上向き・水平のときに添える英文（動きが画面上でどう見えるか）
 * - tags / tagsUp / tagsLevel : 同じ条件で使うタグ系向けの構図タグ
 * - recommended : 演出の候補として先に並べるもの（自動では入れない）
 * 静止や、ゆっくりした動きには使わない。
 */
export type MotionProfile = {
  /** タグ系の詳細版で添える短い句（長い自然文に頼らない） */
  short: string;
  cue?: string; cueUp?: string; cueLevel?: string;
  tags?: string; tagsUp?: string; tagsLevel?: string;
  recommended: string[];
};
export const motionProfiles: Record<string, MotionProfile> = {
  flying: { short: "sweeping aerial view over the scenery", cue: "with the scenery below sliding past", cueLevel: "with the landscape stretching out ahead", tags: "very wide shot, perspective", tagsLevel: "very wide shot, horizon", recommended: ["wind_streaks", "rushing_clouds", "scale_contrast"] },
  gliding: { short: "viewpoint gliding low over the surface", cue: "skimming over the scenery below", cueLevel: "skimming just above the surface toward the horizon", tags: "very wide shot", tagsLevel: "very wide shot, horizon", recommended: ["wind_streaks", "tilted_horizon"] },
  rapid_ascent: { short: "viewpoint shooting upward away from the ground", cue: "with the ground dropping away and shrinking below", cueUp: "with the open sky expanding above", cueLevel: "with the scenery sinking out of view", tags: "from above, perspective", tagsUp: "from below, perspective, vanishing point", recommended: ["edge_blur", "scale_contrast", "rushing_clouds"] },
  cloud_break: { short: "viewpoint breaking through the clouds", cue: "as the clouds part to reveal the view far below", cueLevel: "as the clouds part to reveal the view ahead", tags: "from above, cloud, perspective", tagsLevel: "cloud, perspective", recommended: ["rushing_clouds", "strong_wind"] },
  dive: { short: "viewpoint diving steeply toward the scene", cue: "with everything below growing larger as it rushes closer", cueLevel: "with the scene ahead growing larger as it rushes closer", tags: "from above, foreshortening, perspective", tagsLevel: "foreshortening, perspective", recommended: ["converging_buildings", "tilted_horizon", "edge_blur", "strong_wind"] },
  falling: { short: "viewpoint plunging straight down toward the ground", cue: "with the ground and everything on it rushing up toward the viewer in strong foreshortening", cueLevel: "with the horizon tilting as the ground rushes closer", tags: "from above, foreshortening, perspective", tagsLevel: "foreshortening, perspective", recommended: ["converging_buildings", "strong_wind", "rushing_clouds", "approaching_ground"] },
  fly_by: { short: "viewpoint racing past at high speed", cue: "with it looming large in the near foreground while the distant scenery stays small", tags: "foreshortening, perspective", recommended: ["edge_blur", "scale_contrast", "tilted_horizon"] },
};

/** 動きの演出（動きがあるときだけ使う）。note がある演出は画風・線画に影響しやすい */
export const motionEffects: (ViewOption & { note?: string })[] = [
  v("wind_streaks", "風の流れ", "streaks of rushing wind", "wind"),
  { ...v("strong_wind", "強い風圧", "strong wind pressure tearing through the air", "wind") },
  v("rushing_clouds", "流れ去る雲", "clouds rushing past", "cloud"),
  { ...v("edge_blur", "周辺のモーションブラー", "motion blur at the edges of the frame", "motion blur"), note: "ブラーが線画をぼかすことがあります" },
  v("extreme_perspective", "誇張された遠近感", "dramatic plunging perspective", "foreshortening"),
  v("converging_buildings", "奥へ収束する建物", "buildings converging toward a vanishing point", "vanishing point, perspective"),
  v("tilted_horizon", "傾いた水平線", "a tilted horizon", "dutch angle"),
  v("diagonal_composition", "斜めの構図", "a dynamic diagonal composition", "dutch angle"),
  v("scale_contrast", "近景と遠景の大きなサイズ差", "an extreme size contrast between the near foreground and the tiny distant scenery", "perspective"),
  v("approaching_ground", "接近する地表", "the ground surface rushing closer", ""),
  { ...v("speed_lines", "スピード線", "subtle speed lines", "speed lines"), note: "漫画的な線が入り、画風が変わりやすい演出です" },
  v("rising_bubbles", "立ちのぼる泡", "streams of rising bubbles", "bubbles"),
];

/** 視界の枠・遮蔽物（任意） */
export const frames: ViewOption[] = [
  v("", "なし", "", ""),
  v("window", "窓越し", "through {w}", "through window"),
  v("doorway", "扉越し", "through an open doorway", "doorway"),
  v("archway", "アーチ越し", "through a stone archway", "archway"),
  v("railing", "手すり越し", "beyond a railing in the foreground", "railing"),
  v("trees_gap", "木々の隙間", "through a gap in the trees", "through trees"),
  v("clouds_gap", "雲の隙間", "through a break in the clouds", "through clouds"),
  v("water_surface", "水面越し", "through the rippling water surface", "through water"),
];

/** 窓の種類（「窓越し」を選んだときだけ表示） */
export const windowKinds: ViewOption[] = [
  v("", "ふつうの窓", "a window", "window"),
  v("arched", "アーチ窓", "a tall arched window", "arched window"),
  v("large_glass", "大きなガラス窓", "a large glass window", "large window"),
  v("shoji", "障子窓", "an open shoji window", "shoji"),
  v("round", "丸窓", "a round window", "round window"),
  v("stained", "ステンドグラス窓", "a stained glass window", "stained glass"),
  v("train", "電車の窓", "a train window", "train window"),
];

/** 画角（レンズ）。視線や位置とは別の情報 */
export const lenses: ViewOption[] = [
  v("", "指定しない", "", ""),
  v("wide", "広角", "wide-angle view", "wide shot"),
  v("standard", "標準", "natural lens perspective", ""),
  v("telephoto", "望遠", "compressed telephoto perspective", "telephoto"),
  v("panorama", "パノラマ", "sweeping panoramic view", "panorama"),
  { ...v("fisheye", "魚眼", "fisheye lens distortion", "fisheye"), hint: "遠近が強く曲がり、画風に影響することがあります" },
];

export type ViewState = {
  /** standard: かんたん（従来の視点のみ） / custom: 細かく指定 */
  mode: "standard" | "custom";
  vantage: string;
  targets: string[];
  gaze: string;
  distance: string;
  altitude: string;
  motion: string;
  motionEffects: string[];
  frame: string;
  frameDetail: string;
  lens: string;
};

export const createDefaultView = (): ViewState => ({
  mode: "standard",
  vantage: "ground",
  targets: ["main_stage"],
  gaze: "forward",
  distance: "",
  altitude: "",
  motion: "still",
  motionEffects: [],
  frame: "",
  frameDetail: "",
  lens: "",
});

export const viewData = { vantages, viewTargets, gazes, distances, altitudes, motions, motionEffects, frames, windowKinds, lenses };

/** 高度を設定できる観測位置と、それぞれで選べる高度 */
export const altitudeByVantage: Record<string, string[]> = {
  low_air: ["ground_level", "low"],
  sky: ["low", "mid", "high"],
  above_clouds: ["high", "above_clouds"],
};

/** 動きの演出を出す動き */
export const dynamicMotions = ["moving", "flying", "gliding", "ascending", "rapid_ascent", "descending", "cloud_break", "dive", "falling", "floating", "approaching", "receding", "passing", "fly_by"];

/** よく使う見え方のひな形（見え方だけを書き換え、場所や光は変えない） */
export type ViewRecipe = { id: string; label: string; description: string; view: Partial<ViewState> };
export const viewRecipes: ViewRecipe[] = [
  { id: "look_up", label: "見上げる", description: "道から場所を見上げる", view: { vantage: "street", gaze: "up_diagonal", targets: ["main_stage"], distance: "mid", altitude: "", motion: "still", motionEffects: [], frame: "" } },
  { id: "far_view", label: "遠くから眺める", description: "高台から遠景で", view: { vantage: "cliff", gaze: "horizon_far", targets: ["main_stage"], distance: "far", altitude: "", motion: "still", motionEffects: [], frame: "" } },
  { id: "look_down", label: "見下ろす", description: "高い所から周りを俯瞰", view: { vantage: "balcony", gaze: "down_diagonal", targets: ["surroundings"], distance: "far", altitude: "", motion: "still", motionEffects: [], frame: "railing" } },
  { id: "aerial", label: "上空から", description: "場所と周辺を空から", view: { vantage: "sky", altitude: "high", gaze: "down_diagonal", targets: ["main_stage", "surroundings"], distance: "far", motion: "still", motionEffects: [], frame: "" } },
  { id: "flying", label: "飛びながら", description: "空を移動しつつ眼下を見る", view: { vantage: "sky", altitude: "mid", gaze: "down_diagonal", targets: ["main_stage"], distance: "far", motion: "flying", motionEffects: ["wind_streaks"], frame: "", lens: "wide" } },
  { id: "falling", label: "空から落下", description: "真下の地上が迫ってくる", view: { vantage: "sky", altitude: "mid", gaze: "straight_down", targets: ["main_stage"], distance: "mid", motion: "falling", motionEffects: ["converging_buildings", "strong_wind", "rushing_clouds"], frame: "", lens: "wide" } },
  { id: "dive", label: "急降下", description: "斜めに対象へ突っ込む", view: { vantage: "sky", altitude: "mid", gaze: "down_diagonal", targets: ["main_stage"], distance: "mid", motion: "dive", motionEffects: ["converging_buildings", "tilted_horizon"], frame: "", lens: "wide" } },
  { id: "rapid_ascent", label: "急上昇", description: "地上が下へ遠ざかる", view: { vantage: "low_air", altitude: "low", gaze: "straight_down", targets: ["main_stage"], distance: "mid", motion: "rapid_ascent", motionEffects: ["scale_contrast", "edge_blur"], frame: "", lens: "wide" } },
  { id: "cloud_break", label: "雲を抜ける", description: "雲の下に景色が現れる", view: { vantage: "sky", altitude: "high", gaze: "down_diagonal", targets: ["main_stage"], distance: "far", motion: "cloud_break", motionEffects: ["rushing_clouds"], frame: "", lens: "" } },
  { id: "fly_by", label: "横を高速通過", description: "建物のすぐ脇をかすめる", view: { vantage: "sky", altitude: "low", gaze: "forward", targets: ["main_stage"], distance: "near", motion: "fly_by", motionEffects: ["edge_blur", "scale_contrast"], frame: "", lens: "wide" } },
  { id: "window_sky", label: "窓越しに空", description: "室内から窓の外を見る", view: { vantage: "interior", gaze: "up_diagonal", targets: ["sky_clouds"], distance: "", altitude: "", motion: "still", motionEffects: [], frame: "window", frameDetail: "arched" } },
  { id: "underwater_up", label: "水中から水面", description: "海中から水面を見上げる", view: { vantage: "underwater", gaze: "straight_up", targets: ["water_surface", "sky_clouds"], distance: "", altitude: "", motion: "floating", motionEffects: ["rising_bubbles"], frame: "" } },
];

/** ひな形を適用した見え方。見え方の初期値から組み立て、前の動き・演出・枠・画角を引き継がない */
export function viewFromRecipe(recipeId: string): ViewState | null {
  const recipe = viewRecipes.find((item) => item.id === recipeId);
  return recipe ? { ...createDefaultView(), ...structuredClone(recipe.view), mode: "custom" } : null;
}
