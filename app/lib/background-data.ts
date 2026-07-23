export type Option = { id: string; label: string; en: string; group?: string };
export type BackgroundMode = "scene" | "simple";
export type OutputStyle = "short" | "detailed";
export type ScenePresetGroup = "recommended" | "nature_water" | "city_daily" | "fantasy_history" | "scifi_special";
export type SimplePresetGroup = "recommended" | "plain" | "soft" | "purikura";
export type PresetGroup = ScenePresetGroup | SimplePresetGroup;

export type BackgroundState = {
  version: 1;
  backgroundMode: BackgroundMode;
  outputStyle: OutputStyle;
  scene: {
    subjectRelation: string;
    place: { environmentType: string; category: string; mainStage: string; stageState: string[] };
    world: { worldType: string; era: string; architectureStyle: string[] };
    structures: { landmark: string; secondary: string[]; accents: string[] };
    environment: { timeOfDay: string; season: string; weather: string; phenomena: string[] };
    lighting: { primarySource: string; secondarySource: string; direction: string; quality: string };
    atmosphere: { colorTone: string; contrast: string; mood: string[] };
    composition: { perspective: string; depthLayers: string; density: string; fantasyEffects: string[]; blend: string };
  };
  simple: {
    subjectRelation: string;
    style: string;
    backgroundType: string;
    colors: { primary: string; secondary: string; intensity: string };
    rendering: string[];
    decoration: { enabled: boolean; motifs: string[] };
  };
  ui: { warningsDismissed: string[]; expandedSections: string[] };
};

const o = (id: string, label: string, en: string, group?: string): Option => ({ id, label, en, group });

export const sceneData = {
  relations: [
    o("character_focus", "人物重視", "the scene is designed to support the character"),
    o("balanced", "バランス", "the environment remains detailed yet secondary to the character"),
    o("background_focus", "背景重視", "the environment is richly detailed"),
    o("background_only", "背景のみ", "the background is the main visual focus"),
  ],
  environmentTypes: [
    o("indoor", "屋内", "interior"), o("outdoor", "屋外", "outdoor setting"),
    o("semi_outdoor", "半屋外", "sheltered open-air setting"), o("special", "特殊空間", "otherworldly space"),
  ],
  categories: [
    o("living", "住居・生活", "lived-in", "indoor"), o("study", "学校・研究", "scholarly", "indoor"),
    o("public", "仕事・公共", "public", "indoor"), o("sacred", "宗教・儀式", "sacred", "indoor"),
    o("palace", "城・宮殿", "palatial", "indoor"), o("industrial", "工業・地下施設", "industrial", "indoor"),
    o("forest", "森林・植物", "verdant", "outdoor"), o("waterfront", "水辺・海", "waterside", "outdoor"),
    o("urban_street", "都市・街路", "urban", "outdoor"), o("ruins", "遺跡・廃墟", "ancient", "outdoor"),
    o("fantasy_landscape", "幻想景観", "fantastical", "outdoor"), o("space_landscape", "SF・宇宙景観", "futuristic", "outdoor"),
    o("terrace", "テラス・回廊", "open-air", "semi_outdoor"), o("station", "駅・屋上", "transitional", "semi_outdoor"),
    o("entrance", "洞窟・神殿入口", "threshold", "semi_outdoor"),
    o("surreal", "夢・記憶", "surreal", "special"), o("cosmic", "宇宙・異次元", "cosmic", "special"),
    o("abstract", "抽象・無限空間", "abstract", "special"),
  ],
  stages: [
    o("quiet_room", "静かな部屋", "a quiet room", "living"), o("bedroom", "寝室", "an intimate bedroom", "living"),
    o("library", "図書館", "a grand library", "study"), o("laboratory", "研究室", "a refined laboratory", "study"),
    o("office", "オフィス", "a modern office", "public"), o("theater", "劇場", "an ornate theater", "public"),
    o("temple", "神殿", "a sacred temple", "sacred"), o("cathedral", "大聖堂", "a soaring cathedral", "sacred"),
    o("throne_room", "玉座の間", "a vast throne room", "palace"), o("palace_hall", "宮殿の大広間", "a palatial great hall", "palace"),
    o("underground_facility", "地下施設", "an underground facility", "industrial"), o("abandoned_factory", "廃工場", "an abandoned factory", "industrial"),
    o("deep_forest", "深い森", "a deep forest", "forest"), o("flower_field", "花畑", "a broad flower field", "forest"),
    o("seaside", "海辺", "a windswept seaside", "waterfront"), o("lakeshore", "湖畔", "a tranquil lakeshore", "waterfront"),
    o("bright_sandy_beach", "明るい砂浜", "a sunlit sandy beach beside clear blue water", "waterfront"),
    o("rocky_coast", "岩のある海岸", "a rugged coast lined with weathered rocks", "waterfront"),
    o("back_alley", "路地裏", "a narrow back alley", "urban_street"), o("city_street", "街路", "a lively city street", "urban_street"),
    o("ancient_ruins", "古代遺跡", "ancient ruins", "ruins"), o("ruined_garden", "廃庭園", "an overgrown ruined garden", "ruins"),
    o("floating_island", "浮遊島", "a floating island", "fantasy_landscape"), o("crystal_valley", "水晶の谷", "a crystal valley", "fantasy_landscape"),
    o("future_city", "未来都市", "a vast futuristic city", "space_landscape"), o("space_station", "宇宙ステーション", "an orbital space station", "space_landscape"),
    o("balcony", "ベランダ", "an open balcony", "terrace"), o("cloister", "回廊", "a covered cloister", "terrace"),
    o("station_platform", "駅ホーム", "a quiet station platform", "station"), o("rooftop", "屋上", "an urban rooftop", "station"),
    o("cafe", "カフェ", "a welcoming cafe with warm wooden finishes", "public"),
    o("classroom", "教室", "a quiet classroom with broad windows", "study"),
    o("old_town_street", "古い街並み", "a lived-in old town street paved with stone", "urban_street"),
    o("cave_entrance", "洞窟入口", "a shadowed cave entrance", "entrance"), o("temple_gate", "神殿入口", "a monumental temple entrance", "entrance"),
    o("dreamscape", "夢の中", "a fluid dreamscape", "surreal"), o("memory_space", "記憶の空間", "a fragmented memory space", "surreal"),
    o("deep_space", "宇宙", "the depths of space", "cosmic"), o("other_dimension", "異次元", "an impossible other dimension", "cosmic"),
    o("infinite_space", "無限空間", "an endless abstract space", "abstract"), o("minimal_void", "抽象空間", "a minimal luminous void", "abstract"),
  ],
  stageStates: [
    o("pristine", "端正", "pristine"), o("lived_in", "使い込まれた", "lived-in"),
    o("rainy", "雨に濡れた", "rain-soaked"), o("snow_covered", "雪に覆われた", "snow-covered"),
    o("abandoned", "放棄された", "abandoned"), o("ruined", "崩れかけた", "crumbling"),
    o("overgrown", "植物に覆われた", "overgrown"), o("ceremonial", "儀式の最中", "ceremonial"),
  ],
  worlds: [o("modern", "現代", "modern"), o("historical", "歴史世界", "historical"), o("fantasy", "ファンタジー", "fantasy"), o("scifi", "SF", "science-fiction"), o("post_apocalyptic", "終末世界", "post-apocalyptic")],
  eras: [o("contemporary", "現代", "contemporary"), o("ancient", "古代", "ancient"), o("medieval", "中世", "medieval"), o("victorian", "ヴィクトリア時代", "Victorian-era"), o("near_future", "近未来", "near-future"), o("far_future", "遠未来", "far-future")],
  architecture: [o("japanese", "和風", "Japanese architecture"), o("gothic", "ゴシック", "Gothic architecture"), o("classical", "クラシカル", "classical architecture"), o("islamic", "イスラム風", "Islamic architecture"), o("art_deco", "アール・デコ", "Art Deco architecture"), o("brutalist", "ブルータリズム", "Brutalist architecture"), o("futuristic", "未来建築", "futuristic architecture")],
  landmarks: [o("none", "指定なし", ""), o("giant_tree", "巨大樹", "a monumental ancient tree"), o("throne", "玉座", "an imposing throne"), o("spiral_staircase", "螺旋階段", "a sweeping spiral staircase"), o("giant_window", "巨大な窓", "a monumental arched window"), o("clock_tower", "時計塔", "a distant clock tower"), o("waterfall", "滝", "a cascading waterfall"), o("altar", "祭壇", "an illuminated altar"), o("distant_lighthouse", "遠くの灯台", "a lighthouse standing far along the shoreline")],
  secondary: [o("bookshelves", "本棚", "towering bookshelves"), o("columns", "柱", "rows of columns"), o("street_lamps", "街灯", "old street lamps"), o("tables", "テーブル", "weathered tables"), o("arches", "アーチ", "repeating arches"), o("statues", "石像", "stone statues"), o("bridge", "橋", "a slender bridge"), o("signs", "看板", "layered street signs"), o("rocks", "岩", "scattered rocks"), o("wall_pipes", "配管", "exposed wall pipes"), o("large_windows", "大きな窓", "large windows"), o("pier", "桟橋", "a slender pier reaching across the water"), o("coastal_rocks", "海岸の岩", "weathered rocks scattered along the shore"), o("palm_trees", "ヤシの木", "a few palm trees framing the shoreline")],
  accents: [o("scattered_books", "散らばった本", "scattered books"), o("fallen_leaves", "落ち葉", "drifting fallen leaves"), o("wet_ground", "濡れた地面", "wet pavement"), o("petals", "花びら", "floating petals"), o("candles", "ろうそく", "scattered candles"), o("light_particles", "光の粒", "delicate light particles"), o("mist", "薄霧", "low-lying mist"), o("moss", "苔", "soft moss"), o("neon_reflections", "ネオン反射", "neon reflections"), o("fabric", "布・旗", "trailing fabric banners"), o("debris", "破片・瓦礫", "scattered debris"), o("gentle_waves", "穏やかな波", "gentle waves rolling toward the shore"), o("white_sea_spray", "白い波しぶき", "white spray breaking against the rocks"), o("wet_sand", "濡れた砂", "wet sand reflecting the sky"), o("water_sparkle", "水面のきらめき", "sunlight glittering across the water"), o("seashells", "貝殻", "a few shells resting near the tide line"), o("cobblestones", "石畳", "worn cobblestones carrying a gentle lived-in texture")],
  times: [o("dawn", "夜明け", "at dawn"), o("morning", "朝", "in the morning"), o("day", "昼", "during the day"), o("sunset", "夕方", "at sunset"), o("dusk", "薄暮", "at dusk"), o("night", "夜", "at night")],
  seasons: [o("spring", "春", "in spring"), o("summer", "夏", "in summer"), o("autumn", "秋", "in autumn"), o("winter", "冬", "in winter")],
  weather: [o("clear", "晴れ", "under clear skies"), o("cloudy", "曇り", "under an overcast sky"), o("rain", "雨", "in steady rain"), o("snow", "雪", "in falling snow"), o("storm", "嵐", "during a distant storm")],
  phenomena: [o("fog", "霧", "rolling fog"), o("snow_drift", "雪煙", "windblown snow"), o("falling_petals", "舞う花びら", "drifting petals"), o("falling_leaves", "舞う落ち葉", "swirling autumn leaves"), o("dust", "光る塵", "dust motes in the air"), o("rain_haze", "雨霞", "rain haze"), o("sea_mist", "海霧", "sea mist drifting low over the water"), o("salt_spray", "潮風の飛沫", "salt spray carried through the air by the wind"), o("drifting_clouds", "流れる雲", "broad clouds drifting through the distance")],
  primaryLights: [o("natural", "自然光", "natural light"), o("direct_sunlight", "直射日光", "direct sunlight"), o("moonlight", "月明かり", "pale moonlight"), o("neon", "ネオン", "colored neon light"), o("candlelight", "ろうそく", "warm candlelight"), o("studio", "スタジオ光", "clean studio lighting"), o("magic", "魔法光", "ethereal magical light"), o("ambient_artificial", "柔らかい人工光", "soft ambient artificial illumination")],
  secondaryLights: [o("none", "なし", ""), o("streetlight", "街灯", "scattered streetlight"), o("window_light", "窓からの光", "light filtering through the windows"), o("rim_light", "リムライト", "a subtle rim light"), o("reflected_light", "反射光", "soft reflected light"), o("embers", "火の粉", "a faint ember glow")],
  directions: [o("front", "正面", "front-lit"), o("side", "横", "side-lit"), o("back", "逆光", "backlit"), o("top", "上方", "lit from above"), o("scattered", "分散", "with scattered illumination")],
  qualities: [o("soft", "柔らかい", "soft"), o("diffused", "拡散", "diffused"), o("dramatic", "ドラマチック", "dramatic"), o("hazy", "霞んだ", "hazy"), o("crisp", "くっきり", "crisp")],
  tones: [o("neutral", "ニュートラル", "balanced neutral tones"), o("warm", "暖色", "warm amber tones"), o("cool", "寒色", "cool blue tones"), o("blue_purple", "青紫", "muted blue and violet tones"), o("pastel", "パステル", "gentle pastel tones"), o("monochrome", "モノトーン", "restrained monochrome tones")],
  contrasts: [o("low", "低め", "low contrast"), o("medium", "標準", "balanced contrast"), o("high", "高め", "high contrast")],
  moods: [o("calm", "穏やか", "calm"), o("quiet", "静か", "quiet"), o("romantic", "ロマンチック", "romantic"), o("dreamlike", "幻想的", "dreamlike"), o("mysterious", "神秘的", "mysterious"), o("solemn", "厳か", "solemn"), o("melancholic", "アンニュイ", "melancholic"), o("decadent", "退廃的", "decadent"), o("cinematic", "映画的", "cinematic"), o("open_air", "開放的", "open and airy"), o("wild", "荒々しい", "wild and turbulent"), o("serene", "静謐", "serene"), o("nostalgic", "懐かしい", "gently nostalgic"), o("majestic", "壮大", "majestic")],
  perspectives: [o("eye_level", "目線の高さ", "eye-level perspective"), o("low_angle", "低い視点", "low-angle perspective"), o("high_angle", "高い視点", "high-angle perspective"), o("wide", "広角", "wide establishing view")],
  depth: [o("flat", "浅い", "shallow spatial depth"), o("moderate", "標準", "clear spatial depth"), o("layered", "前・中・遠景", "layered foreground, midground, and distance"), o("deep", "深い遠近感", "deep receding perspective")],
  densities: [o("minimal", "ミニマル", "minimal environmental detail"), o("standard", "標準", "balanced environmental detail"), o("rich", "豊か", "rich environmental detail"), o("intricate", "緻密", "intricate environmental detail")],
  fantasies: [o("floating_lights", "浮遊する光", "floating lights"), o("levitating_ruins", "浮遊遺跡", "levitating ruins"), o("impossible_scale", "非現実的な巨大さ", "impossible monumental scale"), o("time_distortion", "時間の歪み", "subtle distortions of time")],
  blends: [o("soft_blur", "柔らかく馴染ませる", "with gently softened background edges"), o("atmospheric", "空気遠近で馴染ませる", "with atmospheric perspective"), o("clear", "輪郭を保つ", "with clearly defined environmental forms")],
};

export const simpleData = {
  relations: [o("character_focus", "人物を目立たせる", "unobtrusive behind the character"), o("soft_blend", "やさしく馴染ませる", "gently blending around the character"), o("slight_presence", "背景も少し見せる", "with a subtle visual presence"), o("background_only", "背景だけで使う", "as a standalone background")],
  styles: [o("plain", "プレーン", "clean and understated"), o("soft", "ソフト", "soft and airy"), o("purikura", "プリクラ風", "cute and playful")],
  types: [o("solid", "単色", "solid color backdrop"), o("gradient", "グラデーション", "gradient backdrop"), o("soft_abstract", "やわらかい抽象背景", "soft abstract backdrop"), o("studio", "スタジオ背景", "clean studio backdrop")],
  colors: [o("white", "ホワイト", "white"), o("warm_gray", "ウォームグレー", "warm gray"), o("pastel_pink", "パステルピンク", "pastel pink"), o("lavender", "ラベンダー", "lavender"), o("mint", "ミント", "soft mint"), o("powder_blue", "くすみブルー", "powder blue"), o("cream", "クリーム", "soft cream"), o("peach", "ピーチ", "peach"), o("deep_navy", "ディープネイビー", "deep navy")],
  intensities: [o("very_light", "とても淡い", "very pale"), o("soft", "淡い", "soft"), o("medium", "標準", "balanced"), o("deep", "深め", "deep"), o("dark", "暗め", "dark")],
  renderings: [o("flat", "フラット", "even flat color"), o("subtle_variation", "少し濃淡", "subtle tonal variation"), o("vignette", "周辺を少し暗く", "a gentle edge vignette"), o("center_glow", "中央を少し明るく", "a soft central glow"), o("vertical_gradient", "上下グラデ", "a smooth vertical transition"), o("horizontal_gradient", "左右グラデ", "a smooth horizontal transition"), o("diagonal_gradient", "斜めグラデ", "a smooth diagonal transition"), o("radial_gradient", "放射状グラデ", "a subtle radial transition"), o("gentle_blur", "やわらかいぼかし", "gentle blur"), o("soft_glow", "ふんわり発光", "soft luminous glow"), o("light_bloom", "軽い光のにじみ", "delicate light bloom")],
  motifs: [o("tiny_hearts", "ハート", "tiny heart motifs"), o("small_stars", "星", "small star motifs"), o("subtle_sparkles", "きらきら", "subtle sparkles"), o("soft_dots", "ドット", "soft dot accents"), o("tiny_flowers", "小花", "tiny floral motifs")],
};

export const createDefaultState = (): BackgroundState => ({
  version: 1,
  backgroundMode: "scene",
  outputStyle: "short",
  scene: {
    subjectRelation: "character_focus",
    place: { environmentType: "outdoor", category: "urban_street", mainStage: "back_alley", stageState: ["rainy"] },
    world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
    structures: { landmark: "none", secondary: ["street_lamps", "wall_pipes"], accents: ["wet_ground", "neon_reflections"] },
    environment: { timeOfDay: "night", season: "autumn", weather: "rain", phenomena: ["rain_haze"] },
    lighting: { primarySource: "neon", secondarySource: "streetlight", direction: "side", quality: "diffused" },
    atmosphere: { colorTone: "blue_purple", contrast: "medium", mood: ["melancholic", "cinematic"] },
    composition: { perspective: "eye_level", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "atmospheric" },
  },
  simple: {
    subjectRelation: "character_focus", style: "soft", backgroundType: "gradient",
    colors: { primary: "pastel_pink", secondary: "lavender", intensity: "soft" },
    rendering: ["diagonal_gradient", "center_glow", "gentle_blur"], decoration: { enabled: true, motifs: ["subtle_sparkles"] },
  },
  ui: { warningsDismissed: [], expandedSections: ["purpose", "stage"] },
});

export type BackgroundPreset = {
  id: string;
  mode: BackgroundMode;
  group: PresetGroup;
  label: string;
  description: string;
  patch: Partial<BackgroundState>;
};

export const presetGroups: Record<BackgroundMode, { id: PresetGroup; label: string }[]> = {
  scene: [
    { id: "recommended", label: "おすすめ" },
    { id: "nature_water", label: "自然・水辺" },
    { id: "city_daily", label: "街・日常" },
    { id: "fantasy_history", label: "幻想・歴史" },
    { id: "scifi_special", label: "SF・特殊" },
  ],
  simple: [
    { id: "recommended", label: "おすすめ" },
    { id: "plain", label: "プレーン" },
    { id: "soft", label: "ソフト" },
    { id: "purikura", label: "プリクラ風" },
  ],
};

const scenePatch = (overrides: Partial<BackgroundState["scene"]>): Partial<BackgroundState> => ({
  scene: { ...createDefaultState().scene, ...overrides },
});

const simplePatch = (overrides: Partial<BackgroundState["simple"]>): Partial<BackgroundState> => ({
  simple: { ...createDefaultState().simple, ...overrides },
});

export const presets: BackgroundPreset[] = [
  {
    id: "rainy_alley", mode: "scene", group: "recommended", label: "雨の夜の街", description: "ネオンと濡れた路面",
    patch: scenePatch({}),
  },
  {
    id: "fantasy_forest", mode: "scene", group: "recommended", label: "幻想的な森", description: "薄霧と光の粒",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "forest", mainStage: "deep_forest", stageState: ["overgrown"] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: [] },
      structures: { landmark: "giant_tree", secondary: ["rocks"], accents: ["moss", "light_particles", "mist"] },
      environment: { timeOfDay: "dawn", season: "spring", weather: "clear", phenomena: ["fog"] },
      lighting: { primarySource: "magic", secondarySource: "rim_light", direction: "scattered", quality: "hazy" },
      atmosphere: { colorTone: "cool", contrast: "low", mood: ["dreamlike", "mysterious"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "rich", fantasyEffects: ["floating_lights"], blend: "atmospheric" },
    }),
  },
  {
    id: "quiet_library", mode: "scene", group: "fantasy_history", label: "静かな図書館", description: "落ち着いた室内",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "study", mainStage: "library", stageState: ["lived_in"] },
      world: { worldType: "historical", era: "victorian", architectureStyle: ["gothic"] },
      structures: { landmark: "giant_window", secondary: ["bookshelves", "tables"], accents: ["scattered_books"] },
      environment: { timeOfDay: "dusk", season: "autumn", weather: "cloudy", phenomena: ["dust"] },
      lighting: { primarySource: "natural", secondarySource: "window_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["quiet", "solemn"] },
      composition: { perspective: "eye_level", depthLayers: "layered", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "future_city", mode: "scene", group: "scifi_special", label: "未来都市の夜景", description: "高層都市と広い遠近感",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "space_landscape", mainStage: "future_city", stageState: ["pristine"] },
      world: { worldType: "scifi", era: "far_future", architectureStyle: ["futuristic"] },
      structures: { landmark: "clock_tower", secondary: ["bridge", "signs"], accents: ["neon_reflections", "light_particles"] },
      environment: { timeOfDay: "night", season: "winter", weather: "clear", phenomena: [] },
      lighting: { primarySource: "neon", secondarySource: "rim_light", direction: "scattered", quality: "crisp" },
      atmosphere: { colorTone: "blue_purple", contrast: "high", mood: ["cinematic", "mysterious"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "intricate", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "summer_beach", mode: "scene", group: "nature_water", label: "夏の青い海", description: "青空ときらめく水面",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "bright_sandy_beach", stageState: ["pristine"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "distant_lighthouse", secondary: ["palm_trees"], accents: ["gentle_waves", "wet_sand", "water_sparkle", "seashells"] },
      environment: { timeOfDay: "day", season: "summer", weather: "clear", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "reflected_light", direction: "front", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["open_air", "calm"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "sunset_sea", mode: "scene", group: "nature_water", label: "夕焼けの海", description: "暖かな逆光と穏やかな波",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "seaside", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "distant_lighthouse", secondary: ["pier"], accents: ["gentle_waves", "wet_sand"] },
      environment: { timeOfDay: "sunset", season: "summer", weather: "clear", phenomena: ["sea_mist"] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "reflected_light", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["calm", "romantic"] },
      composition: { perspective: "wide", depthLayers: "layered", density: "standard", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "stormy_sea", mode: "scene", group: "nature_water", label: "嵐の海", description: "岩礁に砕ける白い波",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "rocky_coast", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "distant_lighthouse", secondary: ["coastal_rocks"], accents: ["white_sea_spray"] },
      environment: { timeOfDay: "dusk", season: "autumn", weather: "storm", phenomena: ["salt_spray", "sea_mist"] },
      lighting: { primarySource: "natural", secondarySource: "none", direction: "side", quality: "dramatic" },
      atmosphere: { colorTone: "cool", contrast: "high", mood: ["wild", "cinematic"] },
      composition: { perspective: "low_angle", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "morning_mist_lake", mode: "scene", group: "nature_water", label: "朝霧の湖畔", description: "夜明けの霧と静かな水辺",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "lakeshore", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["pier"], accents: ["mist"] },
      environment: { timeOfDay: "dawn", season: "autumn", weather: "cloudy", phenomena: ["fog"] },
      lighting: { primarySource: "natural", secondarySource: "reflected_light", direction: "scattered", quality: "soft" },
      atmosphere: { colorTone: "cool", contrast: "low", mood: ["serene", "quiet"] },
      composition: { perspective: "eye_level", depthLayers: "layered", density: "minimal", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "flower_field_morning", mode: "scene", group: "nature_water", label: "花畑の朝", description: "春の光と舞う花びら",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "outdoor", category: "forest", mainStage: "flower_field", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: [], accents: ["petals"] },
      environment: { timeOfDay: "morning", season: "spring", weather: "clear", phenomena: ["falling_petals"] },
      lighting: { primarySource: "natural", secondarySource: "rim_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "pastel", contrast: "low", mood: ["open_air", "calm"] },
      composition: { perspective: "eye_level", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "snowy_forest", mode: "scene", group: "nature_water", label: "雪の森", description: "澄んだ冬の空気と静けさ",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "forest", mainStage: "deep_forest", stageState: ["snow_covered"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "giant_tree", secondary: ["rocks"], accents: [] },
      environment: { timeOfDay: "day", season: "winter", weather: "snow", phenomena: ["snow_drift"] },
      lighting: { primarySource: "natural", secondarySource: "reflected_light", direction: "scattered", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["quiet", "serene"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "rooftop_twilight", mode: "scene", group: "city_daily", label: "屋上の夕暮れ", description: "街を見渡す暖かな逆光",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "semi_outdoor", category: "station", mainStage: "rooftop", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "clock_tower", secondary: ["signs"], accents: [] },
      environment: { timeOfDay: "sunset", season: "summer", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "rim_light", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["open_air", "nostalgic"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "quiet_station_platform", mode: "scene", group: "city_daily", label: "静かな駅ホーム", description: "薄暮の人工光と少しの寂しさ",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "semi_outdoor", category: "station", mainStage: "station_platform", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["signs"], accents: ["wet_ground"] },
      environment: { timeOfDay: "dusk", season: "autumn", weather: "cloudy", phenomena: [] },
      lighting: { primarySource: "ambient_artificial", secondarySource: "streetlight", direction: "scattered", quality: "soft" },
      atmosphere: { colorTone: "neutral", contrast: "low", mood: ["quiet", "melancholic"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "minimal", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "old_town", mode: "scene", group: "city_daily", label: "古い街並み", description: "石畳と穏やかな生活感",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "old_town_street", stageState: ["lived_in"] },
      world: { worldType: "historical", era: "medieval", architectureStyle: ["classical"] },
      structures: { landmark: "clock_tower", secondary: ["street_lamps", "arches"], accents: ["cobblestones"] },
      environment: { timeOfDay: "sunset", season: "autumn", weather: "clear", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "streetlight", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["calm", "nostalgic"] },
      composition: { perspective: "eye_level", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "warm_cafe", mode: "scene", group: "city_daily", label: "あたたかなカフェ", description: "木の内装と落ち着く夕方の灯り",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "public", mainStage: "cafe", stageState: ["lived_in"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["tables", "large_windows"], accents: ["fabric"] },
      environment: { timeOfDay: "sunset", season: "autumn", weather: "clear", phenomena: [] },
      lighting: { primarySource: "ambient_artificial", secondarySource: "window_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["calm", "quiet"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "after_school_classroom", mode: "scene", group: "city_daily", label: "放課後の教室", description: "窓の光と静かな青春感",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "study", mainStage: "classroom", stageState: ["lived_in"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "giant_window", secondary: ["tables", "large_windows"], accents: [] },
      environment: { timeOfDay: "sunset", season: "spring", weather: "clear", phenomena: ["dust"] },
      lighting: { primarySource: "natural", secondarySource: "window_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["quiet", "nostalgic"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "moonlit_temple", mode: "scene", group: "fantasy_history", label: "月夜の神殿", description: "月光に包まれた荘厳な空間",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "sacred", mainStage: "temple", stageState: ["ceremonial"] },
      world: { worldType: "fantasy", era: "ancient", architectureStyle: ["classical"] },
      structures: { landmark: "altar", secondary: ["columns", "statues"], accents: ["candles", "mist"] },
      environment: { timeOfDay: "night", season: "winter", weather: "clear", phenomena: ["fog"] },
      lighting: { primarySource: "moonlight", secondarySource: "rim_light", direction: "top", quality: "soft" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["solemn", "mysterious"] },
      composition: { perspective: "low_angle", depthLayers: "deep", density: "rich", fantasyEffects: ["floating_lights"], blend: "atmospheric" },
    }),
  },
  {
    id: "ruined_garden", mode: "scene", group: "fantasy_history", label: "廃墟の庭", description: "薄霧と植物に覆われた遺構",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "ruins", mainStage: "ruined_garden", stageState: ["ruined", "overgrown"] },
      world: { worldType: "post_apocalyptic", era: "near_future", architectureStyle: ["classical"] },
      structures: { landmark: "none", secondary: ["arches", "columns"], accents: ["moss", "debris", "mist"] },
      environment: { timeOfDay: "dusk", season: "spring", weather: "cloudy", phenomena: ["fog"] },
      lighting: { primarySource: "natural", secondarySource: "none", direction: "scattered", quality: "hazy" },
      atmosphere: { colorTone: "neutral", contrast: "low", mood: ["decadent", "melancholic"] },
      composition: { perspective: "wide", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "floating_island_morning", mode: "scene", group: "fantasy_history", label: "浮遊島の朝", description: "雲海と壮大な遠近感",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "fantasy_landscape", mainStage: "floating_island", stageState: ["pristine"] },
      world: { worldType: "fantasy", era: "ancient", architectureStyle: [] },
      structures: { landmark: "waterfall", secondary: ["bridge", "rocks"], accents: ["light_particles"] },
      environment: { timeOfDay: "dawn", season: "spring", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "magic", secondarySource: "rim_light", direction: "scattered", quality: "soft" },
      atmosphere: { colorTone: "pastel", contrast: "low", mood: ["majestic", "dreamlike"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "rich", fantasyEffects: ["levitating_ruins", "impossible_scale"], blend: "atmospheric" },
    }),
  },
  {
    id: "crystal_valley_preset", mode: "scene", group: "fantasy_history", label: "水晶の谷", description: "青紫の反射と魔法の光",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "fantasy_landscape", mainStage: "crystal_valley", stageState: ["pristine"] },
      world: { worldType: "fantasy", era: "ancient", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["rocks"], accents: ["light_particles"] },
      environment: { timeOfDay: "night", season: "winter", weather: "clear", phenomena: ["fog"] },
      lighting: { primarySource: "magic", secondarySource: "reflected_light", direction: "scattered", quality: "crisp" },
      atmosphere: { colorTone: "blue_purple", contrast: "high", mood: ["mysterious", "majestic"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "rich", fantasyEffects: ["floating_lights"], blend: "atmospheric" },
    }),
  },
  {
    id: "palace_great_hall", mode: "scene", group: "fantasy_history", label: "宮殿の大広間", description: "列柱と巨大な窓の荘厳さ",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "indoor", category: "palace", mainStage: "palace_hall", stageState: ["pristine"] },
      world: { worldType: "historical", era: "victorian", architectureStyle: ["classical"] },
      structures: { landmark: "giant_window", secondary: ["columns", "large_windows"], accents: ["fabric"] },
      environment: { timeOfDay: "day", season: "spring", weather: "clear", phenomena: ["dust"] },
      lighting: { primarySource: "natural", secondarySource: "window_light", direction: "side", quality: "crisp" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["solemn", "majestic"] },
      composition: { perspective: "low_angle", depthLayers: "deep", density: "intricate", fantasyEffects: ["impossible_scale"], blend: "clear" },
    }),
  },
  {
    id: "orbital_station", mode: "scene", group: "scifi_special", label: "宇宙ステーション", description: "深い宇宙を望む端正な施設",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "space_landscape", mainStage: "space_station", stageState: ["pristine"] },
      world: { worldType: "scifi", era: "far_future", architectureStyle: ["futuristic"] },
      structures: { landmark: "giant_window", secondary: ["large_windows", "bridge"], accents: ["light_particles"] },
      environment: { timeOfDay: "night", season: "winter", weather: "clear", phenomena: [] },
      lighting: { primarySource: "ambient_artificial", secondarySource: "rim_light", direction: "scattered", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "high", mood: ["quiet", "cinematic"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "intricate", fantasyEffects: ["impossible_scale"], blend: "clear" },
    }),
  },
  {
    id: "plain_white", mode: "simple", group: "recommended", label: "白背景", description: "LoRA・立ち絵向け",
    patch: simplePatch({ style: "plain", backgroundType: "solid", colors: { primary: "white", secondary: "", intensity: "very_light" }, rendering: ["flat"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "pink_purikura", mode: "simple", group: "recommended", label: "プリクラ風ピンク", description: "控えめなハートときらめき",
    patch: simplePatch({ style: "purikura", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "lavender", intensity: "soft" }, rendering: ["diagonal_gradient", "center_glow", "soft_glow"], decoration: { enabled: true, motifs: ["tiny_hearts", "subtle_sparkles"] } }),
  },
  {
    id: "mint_soft", mode: "simple", group: "soft", label: "やわらかミント", description: "SNS・顔アップ向け",
    patch: simplePatch({ style: "soft", backgroundType: "soft_abstract", colors: { primary: "mint", secondary: "cream", intensity: "soft" }, rendering: ["subtle_variation", "center_glow", "gentle_blur"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "studio_gray", mode: "simple", group: "plain", label: "スタジオ風グレー", description: "端正でニュートラル",
    patch: simplePatch({ style: "plain", backgroundType: "studio", colors: { primary: "warm_gray", secondary: "white", intensity: "medium" }, rendering: ["vignette", "center_glow"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "pale_blue_gradient", mode: "simple", group: "soft", label: "淡いブルーグラデ", description: "軽やかな青の移ろい",
    patch: simplePatch({ style: "soft", backgroundType: "gradient", colors: { primary: "powder_blue", secondary: "white", intensity: "very_light" }, rendering: ["vertical_gradient", "center_glow", "gentle_blur"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "cream_solid", mode: "simple", group: "plain", label: "クリームの単色背景", description: "温かく控えめな無地",
    patch: simplePatch({ style: "plain", backgroundType: "solid", colors: { primary: "cream", secondary: "", intensity: "soft" }, rendering: ["flat", "subtle_variation"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "peach_purikura", mode: "simple", group: "purikura", label: "ピーチのプリクラ風", description: "小花を軽く添えたピーチ",
    patch: simplePatch({ subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "peach", secondary: "cream", intensity: "soft" }, rendering: ["radial_gradient", "center_glow"], decoration: { enabled: true, motifs: ["tiny_flowers"] } }),
  },
  {
    id: "lavender_purikura", mode: "simple", group: "purikura", label: "ラベンダーのプリクラ風", description: "小さな星を控えめに配置",
    patch: simplePatch({ subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "lavender", secondary: "powder_blue", intensity: "soft" }, rendering: ["diagonal_gradient", "center_glow"], decoration: { enabled: true, motifs: ["small_stars"] } }),
  },
  {
    id: "navy_studio", mode: "simple", group: "plain", label: "ネイビーのスタジオ背景", description: "深い色と中央の柔らかな光",
    patch: simplePatch({ style: "plain", backgroundType: "studio", colors: { primary: "deep_navy", secondary: "warm_gray", intensity: "dark" }, rendering: ["vignette", "center_glow"], decoration: { enabled: false, motifs: [] } }),
  },
  {
    id: "white_blue_soft", mode: "simple", group: "soft", label: "白と水色のソフト背景", description: "人物を包む淡い光",
    patch: simplePatch({ style: "soft", backgroundType: "soft_abstract", colors: { primary: "white", secondary: "powder_blue", intensity: "very_light" }, rendering: ["subtle_variation", "center_glow", "light_bloom"], decoration: { enabled: false, motifs: [] } }),
  },
];

export function optionById(list: Option[], id: string) {
  return list.find((item) => item.id === id);
}

export function optionsForGroup(list: Option[], group: string) {
  return list.filter((item) => item.group === group);
}
