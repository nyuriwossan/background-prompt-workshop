import { createDefaultView } from "./view-data.ts";
import type { ViewState } from "./view-data.ts";
import { seasonalMotifs } from "./seasonal-data.ts";

/**
 * id     : 保存データにも残る安定ID（変更しない）
 * label  : 日本語表示名
 * en     : 自然文向けの英語表現
 * group  : 親の分類ID（場所カテゴリなど）
 * tag    : タグ系モデル向けの短い句（省略時は en から冠詞・前置詞を外して使う）
 * kw     : 日本語検索用のよみ・別名
 * genres : 関連づけ用の分類（場所の分類と重なる構成物を優先表示する）
 * medium : 舞台そのものが空間（空・水中）で、観測者がその中にいる場合の種別
 * impliedVantage : 舞台名がすでに観測位置を含む場合（例：城のバルコニー）
 * creature : 生き物・怪異そのもの。痕跡（足跡・蜘蛛の巣など）は含めない
 */
export type Option = {
  id: string;
  label: string;
  en: string;
  group?: string;
  tag?: string;
  kw?: string;
  genres?: string[];
  medium?: "aerial" | "underwater";
  impliedVantage?: string;
  creature?: boolean;
};
export type BackgroundMode = "scene" | "simple";
export type OutputStyle = "short" | "detailed";
export type Platform = "generic" | "pixai" | "novelai";
export type PixaiModel = "tsubaki" | "tag";
export type ScenePresetGroup = "recommended" | "nature_water" | "city_daily" | "japan" | "fantasy_history" | "horror_ruin" | "scifi_special" | "view_examples";
export type SimplePresetGroup = "recommended" | "season" | "event" | "plain" | "soft" | "purikura" | "pattern" | "world";
export type PresetGroup = ScenePresetGroup | SimplePresetGroup;

export type TargetSettings = {
  platform: Platform;
  pixaiModel: PixaiModel;
  /** ネガティブ／Undesired Content を併せて作るか（対応している生成先だけで有効） */
  negativeEnabled: boolean;
  /** Tsubaki系で Pro / Ultra モードを使う（このときだけネガティブ欄を使える） */
  tsubakiProMode: boolean;
  negativeItems: string[];
  /** NovelAI V4以降の数値強調で、見え方の句を少し強める */
  novelaiEmphasis: boolean;
};

export type BackgroundState = {
  version: 2;
  backgroundMode: BackgroundMode;
  outputStyle: OutputStyle;
  target: TargetSettings;
  scene: {
    subjectRelation: string;
    place: { environmentType: string; category: string; mainStage: string; stageState: string[] };
    world: { worldType: string; era: string; architectureStyle: string[] };
    structures: { landmark: string; secondary: string[]; accents: string[]; creatures: string[] };
    environment: { timeOfDay: string; season: string; weather: string; phenomena: string[] };
    lighting: { primarySource: string; secondarySource: string; direction: string; quality: string };
    atmosphere: { colorTone: string; contrast: string; mood: string[] };
    composition: { perspective: string; depthLayers: string; density: string; fantasyEffects: string[]; blend: string };
    view: ViewState;
  };
  simple: {
    subjectRelation: string;
    style: string;
    backgroundType: string;
    colors: { primary: string; secondary: string; intensity: string };
    rendering: string[];
    pattern: string;
    texture: string;
    decoration: { enabled: boolean; motifs: string[]; placement: string; density: string };
    /** v2.2：季節・イベント（seasonal-data.ts の eventThemes）。空なら選ばない。出力には直接書かず、候補の絞り込みに使う */
    eventTheme: string;
    /** v2.2：デザインのテイスト（designProfiles）。空なら選ばない。既存の項目で表せない見た目だけを出力に足す */
    designProfile: string;
  };
  ui: { warningsDismissed: string[]; expandedSections: string[] };
};

type Meta = Omit<Option, "id" | "label" | "en" | "group">;
const o = (id: string, label: string, en: string, group?: string, meta: Meta = {}): Option => ({ id, label, en, group, ...meta });
/** 「指定しない」。出力には何も入らない */
const unset = (label = "指定しない") => o("", label, "");

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
    o("living", "住居・生活", "lived-in", "indoor", { genres: ["home"] }),
    o("study", "学校・研究", "scholarly", "indoor", { genres: ["study", "home"] }),
    o("public", "仕事・公共", "public", "indoor", { genres: ["public"] }),
    o("sacred", "宗教・儀式", "sacred", "indoor", { genres: ["sacred", "western"] }),
    o("palace", "城・宮殿", "palatial", "indoor", { genres: ["castle", "western"] }),
    o("industrial", "工業・地下施設", "industrial", "indoor", { genres: ["industrial", "apocalypse"] }),
    o("japanese_room", "和の室内", "traditional Japanese", "indoor", { genres: ["japanese", "home"] }),
    o("horror_interior", "怪異・ホラー", "eerie", "indoor", { genres: ["horror", "western"] }),
    o("dungeon", "ダンジョン・魔法", "arcane", "indoor", { genres: ["fantasy", "horror", "castle"] }),
    o("forest", "森林・植物", "verdant", "outdoor", { genres: ["nature"] }),
    o("waterfront", "水辺・海", "waterside", "outdoor", { genres: ["water", "nature"] }),
    o("underwater", "海中・水中", "underwater", "outdoor", { genres: ["underwater"] }),
    o("mountain_terrain", "山岳・荒野", "rugged", "outdoor", { genres: ["terrain", "nature"] }),
    o("sky", "空・雲海", "skyborne", "outdoor", { genres: ["sky"] }),
    o("urban_street", "都市・街路", "urban", "outdoor", { genres: ["city"] }),
    o("japanese_outdoor", "和の景観", "traditional Japanese", "outdoor", { genres: ["japanese", "nature"] }),
    o("fortress", "城塞・城下町", "fortified", "outdoor", { genres: ["castle", "western", "city"] }),
    o("ruins", "遺跡・廃墟", "ancient", "outdoor", { genres: ["ruins", "apocalypse"] }),
    o("fantasy_landscape", "幻想景観", "fantastical", "outdoor", { genres: ["fantasy", "nature"] }),
    o("space_landscape", "SF・宇宙景観", "futuristic", "outdoor", { genres: ["scifi", "cyber"] }),
    o("cyber_city", "サイバーパンク都市", "cyberpunk", "outdoor", { genres: ["cyber", "city"] }),
    o("terrace", "テラス・回廊", "open-air", "semi_outdoor", { genres: ["western", "castle", "city"] }),
    o("station", "駅・屋上", "transitional", "semi_outdoor", { genres: ["city"] }),
    o("entrance", "洞窟・神殿入口", "threshold", "semi_outdoor", { genres: ["sacred", "nature", "terrain"] }),
    o("surreal", "夢・記憶", "surreal", "special", { genres: [] }),
    o("cosmic", "宇宙・異次元", "cosmic", "special", { genres: [] }),
    o("abstract", "抽象・無限空間", "abstract", "special", { genres: [] }),
  ],
  stages: [
    o("quiet_room", "静かな部屋", "a quiet room", "living", { kw: "しずかなへや 部屋 室内 個室" }),
    o("bedroom", "寝室", "an intimate bedroom", "living", { kw: "しんしつ ベッド" }),
    o("library", "図書館", "a grand library", "study", { kw: "としょかん 本" }),
    o("laboratory", "研究室", "a refined laboratory", "study", { kw: "けんきゅうしつ ラボ 実験室" }),
    o("office", "オフィス", "a modern office", "public", { kw: "おふぃす 会社 職場" }),
    o("theater", "劇場", "an ornate theater", "public", { kw: "げきじょう 舞台 シアター" }),
    o("temple", "神殿", "a sacred temple", "sacred", { kw: "しんでん 寺院 テンプル" }),
    o("cathedral", "大聖堂", "a soaring cathedral", "sacred", { kw: "だいせいどう 教会 聖堂" }),
    o("throne_room", "玉座の間", "a vast throne room", "palace", { kw: "ぎょくざのま 王座 城の中" }),
    o("palace_hall", "宮殿の大広間", "a palatial great hall", "palace", { kw: "きゅうでん おおひろま 城の中 ホール" }),
    o("underground_facility", "地下施設", "an underground facility", "industrial", { kw: "ちかしせつ 地下" }),
    o("abandoned_factory", "廃工場", "an abandoned factory", "industrial", { kw: "はいこうじょう 工場 廃墟" }),
    o("deep_forest", "深い森", "a deep forest", "forest", { kw: "ふかいもり 森 森林" }),
    o("flower_field", "花畑", "a broad flower field", "forest", { kw: "はなばたけ 花" }),
    o("seaside", "海辺", "a windswept seaside", "waterfront", { kw: "うみべ 海 海岸" }),
    o("lakeshore", "湖畔", "a tranquil lakeshore", "waterfront", { kw: "こはん 湖 みずうみ" }),
    o("bright_sandy_beach", "明るい砂浜", "a sunlit sandy beach beside clear blue water", "waterfront", { kw: "すなはま ビーチ 海 夏" }),
    o("rocky_coast", "岩のある海岸", "a rugged coast lined with weathered rocks", "waterfront", { kw: "いわ かいがん 海 岩場" }),
    o("back_alley", "路地裏", "a narrow back alley", "urban_street", { kw: "ろじうら 路地 裏通り" }),
    o("city_street", "街路", "a lively city street", "urban_street", { kw: "がいろ 街 通り 都市" }),
    o("ancient_ruins", "古代遺跡", "ancient ruins", "ruins", { kw: "こだいいせき 遺跡" }),
    o("ruined_garden", "廃庭園", "an overgrown ruined garden", "ruins", { kw: "はいていえん 庭 廃墟" }),
    o("floating_island", "浮遊島", "a floating island", "fantasy_landscape", { kw: "ふゆうとう 空 島" }),
    o("crystal_valley", "水晶の谷", "a crystal valley", "fantasy_landscape", { kw: "すいしょうのたに クリスタル 谷" }),
    o("future_city", "未来都市", "a vast futuristic city", "space_landscape", { kw: "みらいとし SF 都市" }),
    o("space_station", "宇宙ステーション", "an orbital space station", "space_landscape", { kw: "うちゅうすてーしょん 宇宙" }),
    o("balcony", "ベランダ", "an open balcony", "terrace", { kw: "べらんだ バルコニー", impliedVantage: "balcony" }),
    o("cloister", "回廊", "a covered cloister", "terrace", { kw: "かいろう 廊下" }),
    o("station_platform", "駅ホーム", "a quiet station platform", "station", { kw: "えきほーむ 駅 電車" }),
    o("rooftop", "屋上", "an urban rooftop", "station", { kw: "おくじょう", impliedVantage: "rooftop" }),
    o("cafe", "カフェ", "a welcoming cafe with warm wooden finishes", "public", { kw: "かふぇ 喫茶店" }),
    o("classroom", "教室", "a quiet classroom with broad windows", "study", { kw: "きょうしつ 学校" }),
    o("old_town_street", "古い街並み", "a lived-in old town street paved with stone", "urban_street", { kw: "ふるいまちなみ 旧市街 石畳" }),
    o("cave_entrance", "洞窟入口", "a shadowed cave entrance", "entrance", { kw: "どうくつ 洞窟 洞穴" }),
    o("temple_gate", "神殿入口", "a monumental temple entrance", "entrance", { kw: "しんでんいりぐち 門" }),
    o("dreamscape", "夢の中", "a fluid dreamscape", "surreal", { kw: "ゆめ" }),
    o("memory_space", "記憶の空間", "a fragmented memory space", "surreal", { kw: "きおく" }),
    o("deep_space", "宇宙", "the depths of space", "cosmic", { kw: "うちゅう 星" }),
    o("other_dimension", "異次元", "an impossible other dimension", "cosmic", { kw: "いじげん" }),
    o("infinite_space", "無限空間", "an endless abstract space", "abstract", { kw: "むげんくうかん" }),
    o("minimal_void", "抽象空間", "a minimal luminous void", "abstract", { kw: "ちゅうしょうくうかん" }),
    // ---- v2.0 追加：現代・日常 ----
    o("kitchen", "キッチン", "a lived-in modern kitchen", "living", { kw: "きっちん 台所 だいどころ" }),
    o("living_room", "リビング", "a cozy living room", "living", { kw: "りびんぐ 居間 いま" }),
    o("bathroom", "浴室・洗面所", "a tiled bathroom", "living", { kw: "よくしつ せんめんじょ お風呂 ふろ バスルーム" }),
    o("convenience_store", "コンビニ", "a brightly lit convenience store", "public", { kw: "こんびに コンビニエンスストア 店" }),
    o("supermarket", "スーパーマーケット", "a supermarket aisle lined with long shelves", "public", { kw: "すーぱー スーパー 店" }),
    o("hospital_room", "病院・診察室", "a clean hospital room", "public", { kw: "びょういん しんさつしつ 病室 医院" }),
    o("intersection", "交差点", "a busy urban intersection", "urban_street", { kw: "こうさてん 信号 横断歩道" }),
    o("shopping_arcade", "商店街", "a covered shopping arcade", "urban_street", { kw: "しょうてんがい アーケード 商店" }),
    o("residential_street", "住宅街", "a quiet residential street", "urban_street", { kw: "じゅうたくがい 住宅地 通学路 帰り道" }),
    o("skyscraper_district", "高層ビル街", "a downtown district of glass skyscrapers", "urban_street", { kw: "こうそうびる ビル街 都心 オフィス街" }),
    o("apartment_corridor", "集合住宅の外廊下", "an open-air apartment corridor", "terrace", { kw: "しゅうごうじゅうたく マンション アパート ろうか" }),
    // ---- 日本・東洋 ----
    o("tatami_room", "和室", "a traditional Japanese tatami room", "japanese_room", { kw: "わしつ たたみ 座敷 ざしき" }),
    o("tea_room", "茶室", "a quiet Japanese tea room", "japanese_room", { kw: "ちゃしつ 茶道 さどう" }),
    o("shinto_shrine", "神社", "a quiet Shinto shrine", "japanese_outdoor", { kw: "じんじゃ 鳥居 とりい お宮 境内" }),
    o("japanese_garden", "日本庭園", "a Japanese garden", "japanese_outdoor", { kw: "にほんていえん 庭園 枯山水 かれさんすい" }),
    // ---- 自然・地形・水中・空 ----
    o("underwater_scene", "海中", "a clear underwater scene", "underwater", { kw: "かいちゅう 水中 すいちゅう 海の中", medium: "underwater" }),
    o("coral_reef", "サンゴ礁", "a vibrant coral reef", "underwater", { kw: "さんごしょう 珊瑚", medium: "underwater" }),
    o("deep_sea", "深海", "the dark deep sea", "underwater", { kw: "しんかい 海底", medium: "underwater" }),
    o("shipwreck_site", "沈没船の眠る海底", "a sunken shipwreck resting on the seafloor", "underwater", { kw: "ちんぼつせん 難破船 海底", medium: "underwater" }),
    o("mountain_range", "山岳", "a towering mountain range", "mountain_terrain", { kw: "さんがく 山 やま 山脈 雪山" }),
    o("canyon", "峡谷", "a deep rocky canyon", "mountain_terrain", { kw: "きょうこく 渓谷 けいこく 谷" }),
    o("desert", "砂漠", "a vast sand desert", "mountain_terrain", { kw: "さばく 砂丘 さきゅう" }),
    o("volcano", "火山", "a smoldering volcano", "mountain_terrain", { kw: "かざん 溶岩 ようがん" }),
    o("glacier", "氷河", "a sweeping glacier", "mountain_terrain", { kw: "ひょうが 氷 こおり 雪原" }),
    o("open_sky", "大空", "a vast open sky", "sky", { kw: "おおぞら 空 そら 上空", medium: "aerial" }),
    o("sea_of_clouds", "雲海", "a sea of clouds", "sky", { kw: "うんかい 雲 くも 雲の上", medium: "aerial" }),
    o("harbor_town", "港町", "a bustling harbor town", "waterfront", { kw: "みなとまち 港 みなと 漁港", genres: ["water", "city"] }),
    // ---- ファンタジー・歴史 ----
    o("castle_exterior", "丘の上の城", "a castle standing on a hill", "fortress", { kw: "おしろ 城 しろ 城塞 じょうさい" }),
    o("castle_gate", "城門", "a massive castle gate", "fortress", { kw: "じょうもん 門 城" }),
    o("castle_rampart", "城壁の上", "castle ramparts lined with battlements", "fortress", { kw: "じょうへき 城壁 塔" }),
    o("castle_town", "城下町", "an old castle town", "fortress", { kw: "じょうかまち 城下 旧市街" }),
    o("castle_corridor", "城の回廊", "a long stone castle corridor", "palace", { kw: "しろ 城の中 廊下 ろうか" }),
    o("castle_balcony", "城のバルコニー", "a grand castle balcony", "terrace", { kw: "しろ 城 ばるこにー テラス", impliedVantage: "balcony" }),
    o("dungeon", "ダンジョン", "a torchlit stone dungeon", "dungeon", { kw: "だんじょん 地下牢 迷宮" }),
    o("magic_circle_chamber", "魔法陣の間", "a ritual chamber with a magic circle inscribed on the floor", "dungeon", { kw: "まほうじん 儀式 魔法" }),
    o("divine_realm", "神域", "a sacred divine realm", "fantasy_landscape", { kw: "しんいき 聖域 天界" }),
    // ---- ホラー・終末 ----
    o("haunted_mansion", "幽霊屋敷", "a haunted mansion interior", "horror_interior", { kw: "ゆうれいやしき お化け屋敷 洋館 館" }),
    o("catacombs", "地下墓所", "underground catacombs", "horror_interior", { kw: "ちかぼしょ カタコンベ 墓 はか" }),
    o("shelter_bunker", "避難所・シェルター", "an underground shelter bunker", "industrial", { kw: "ひなんじょ しぇるたー バンカー 終末", genres: ["apocalypse", "industrial"] }),
    o("collapsed_city", "崩壊都市", "a collapsed ruined city", "ruins", { kw: "ほうかいとし 廃墟 終末 崩れた街", genres: ["apocalypse", "city", "ruins"] }),
    // ---- SF・サイバーパンク ----
    o("neon_district", "ネオン繁華街", "a neon-lit entertainment district", "cyber_city", { kw: "ねおん はんかがい 繁華街 歓楽街" }),
    o("multilevel_city", "多層高架都市", "a multilevel city of stacked overpasses", "cyber_city", { kw: "たそうこうか 高架 立体都市" }),
    o("underground_market", "地下マーケット", "a crowded underground market", "industrial", { kw: "ちかまーけっと 闇市 バザール 露店", genres: ["cyber", "industrial"] }),
  ],
  stageStates: [
    o("pristine", "端正", "pristine"), o("lived_in", "使い込まれた", "lived-in"),
    o("rainy", "雨に濡れた", "rain-soaked"), o("snow_covered", "雪に覆われた", "snow-covered"),
    o("abandoned", "放棄された", "abandoned"), o("ruined", "崩れかけた", "crumbling"),
    o("overgrown", "植物に覆われた", "overgrown"), o("ceremonial", "儀式の最中", "ceremonial"),
  ],
  worlds: [unset(), o("modern", "現代", "modern"), o("historical", "歴史世界", "historical"), o("fantasy", "ファンタジー", "fantasy"), o("scifi", "SF", "science-fiction"), o("post_apocalyptic", "終末世界", "post-apocalyptic")],
  eras: [unset(), o("contemporary", "現代", "contemporary"), o("ancient", "古代", "ancient"), o("medieval", "中世", "medieval"), o("victorian", "ヴィクトリア時代", "Victorian-era"), o("near_future", "近未来", "near-future"), o("far_future", "遠未来", "far-future")],
  architecture: [o("japanese", "和風", "Japanese architecture"), o("gothic", "ゴシック", "Gothic architecture"), o("classical", "クラシカル", "classical architecture"), o("islamic", "イスラム風", "Islamic architecture"), o("art_deco", "アール・デコ", "Art Deco architecture"), o("brutalist", "ブルータリズム", "Brutalist architecture"), o("futuristic", "未来建築", "futuristic architecture")],
  landmarks: [
    o("none", "指定なし", ""),
    o("giant_tree", "巨大樹", "a monumental ancient tree", undefined, { genres: ["nature", "fantasy", "japanese"], kw: "きょだいじゅ 大樹 木" }),
    o("throne", "玉座", "an imposing throne", undefined, { genres: ["castle"], kw: "ぎょくざ" }),
    o("spiral_staircase", "螺旋階段", "a sweeping spiral staircase", undefined, { genres: ["western", "castle", "study", "horror"], kw: "らせんかいだん 階段" }),
    o("giant_window", "巨大な窓", "a monumental arched window", undefined, { genres: ["western", "sacred", "castle", "study"], kw: "きょだいなまど 窓" }),
    o("clock_tower", "時計塔", "a distant clock tower", undefined, { genres: ["city", "western", "castle"], kw: "とけいとう 塔" }),
    o("waterfall", "滝", "a cascading waterfall", undefined, { genres: ["nature", "terrain", "fantasy", "japanese"], kw: "たき" }),
    o("altar", "祭壇", "an illuminated altar", undefined, { genres: ["sacred", "fantasy"], kw: "さいだん" }),
    o("distant_lighthouse", "遠くの灯台", "a lighthouse standing far along the shoreline", undefined, { genres: ["water"], kw: "とうだい" }),
    o("grand_torii", "大鳥居", "a towering vermilion torii gate", undefined, { genres: ["japanese"], kw: "おおとりい 鳥居 とりい 神社" }),
    o("castle_keep", "城の主塔", "a tall castle keep", undefined, { genres: ["castle", "western"], kw: "しろ 天守 主塔 キープ" }),
    o("sunken_ship", "沈没船", "a sunken shipwreck", undefined, { genres: ["underwater"], kw: "ちんぼつせん 難破船" }),
    o("magic_circle", "床の魔法陣", "a glowing magic circle inscribed on the floor", undefined, { genres: ["fantasy", "sacred"], kw: "まほうじん 儀式" }),
    o("glowing_portal", "光るポータル", "a shimmering portal of light", undefined, { genres: ["fantasy", "scifi"], kw: "ぽーたる 門 ゲート 異界" }),
    o("erupting_volcano", "噴煙を上げる火山", "a volcano venting smoke in the distance", undefined, { genres: ["terrain"], kw: "かざん 噴火" }),
    o("mega_billboard", "巨大ホログラム看板", "a colossal holographic billboard", undefined, { genres: ["cyber"], kw: "ほろぐらむ 看板 広告" }),
  ],
  secondary: [
    o("bookshelves", "本棚", "towering bookshelves", undefined, { genres: ["study", "home", "western"], kw: "ほんだな 本" }),
    o("columns", "柱", "rows of columns", undefined, { genres: ["western", "sacred", "castle", "ruins"], kw: "はしら 列柱" }),
    o("street_lamps", "街灯", "old street lamps", undefined, { genres: ["city", "western"], kw: "がいとう" }),
    o("tables", "テーブル", "weathered tables", undefined, { genres: ["home", "public", "study"], kw: "てーぶる 机" }),
    o("arches", "アーチ", "repeating arches", undefined, { genres: ["western", "castle", "sacred"], kw: "あーち" }),
    o("statues", "石像", "stone statues", undefined, { genres: ["sacred", "western", "fantasy", "ruins"], kw: "せきぞう 像" }),
    o("bridge", "橋", "a slender bridge", undefined, { genres: ["city", "nature", "water", "japanese"], kw: "はし" }),
    o("signs", "看板", "layered street signs", undefined, { genres: ["city", "cyber"], kw: "かんばん" }),
    o("rocks", "岩", "scattered rocks", undefined, { genres: ["nature", "terrain"], kw: "いわ" }),
    o("wall_pipes", "配管", "exposed wall pipes", undefined, { genres: ["industrial", "cyber", "apocalypse"], kw: "はいかん パイプ" }),
    o("large_windows", "大きな窓", "large windows", undefined, { genres: ["home", "study", "public", "western"], kw: "おおきなまど 窓" }),
    o("pier", "桟橋", "a slender pier reaching across the water", undefined, { genres: ["water"], kw: "さんばし" }),
    o("coastal_rocks", "海岸の岩", "weathered rocks scattered along the shore", undefined, { genres: ["water"], kw: "かいがんのいわ" }),
    o("palm_trees", "ヤシの木", "a few palm trees framing the shoreline", undefined, { genres: ["water"], kw: "やしのき 南国" }),
    // 現代・日常
    o("kitchen_counter", "調理台・シンク", "a kitchen counter with a sink and cabinets", undefined, { genres: ["home"], kw: "ちょうりだい しんく キッチン 台所" }),
    o("refrigerator", "冷蔵庫・家電", "a refrigerator and small kitchen appliances", undefined, { genres: ["home"], kw: "れいぞうこ かでん" }),
    o("sofa_set", "ソファとローテーブル", "a sofa and a low coffee table", undefined, { genres: ["home"], kw: "そふぁ ローテーブル 居間" }),
    o("television", "テレビ", "a flat-screen television", undefined, { genres: ["home"], kw: "てれび" }),
    o("houseplants", "観葉植物", "potted houseplants", undefined, { genres: ["home", "public"], kw: "かんようしょくぶつ 植物" }),
    o("washbasin_mirror", "洗面台と鏡", "a washbasin beneath a wide mirror", undefined, { genres: ["home"], kw: "せんめんだい かがみ" }),
    o("bathtub", "浴槽", "a deep bathtub", undefined, { genres: ["home"], kw: "よくそう お風呂 ふろ" }),
    o("store_shelves", "商品棚", "neatly stocked store shelves", undefined, { genres: ["public"], kw: "しょうひんだな 棚 陳列" }),
    o("checkout_counter", "レジカウンター", "a checkout counter", undefined, { genres: ["public"], kw: "れじ カウンター" }),
    o("refrigerated_cases", "冷蔵ケース", "glowing refrigerated drink cases", undefined, { genres: ["public"], kw: "れいぞうけーす 冷蔵" }),
    o("hospital_bed", "病院のベッド", "a hospital bed", undefined, { genres: ["public"], kw: "びょういん べっど" }),
    o("medical_equipment", "医療機器", "medical monitors and an IV stand", undefined, { genres: ["public"], kw: "いりょうきき 点滴 モニター" }),
    o("privacy_curtain", "仕切りカーテン", "pale privacy curtains", undefined, { genres: ["public"], kw: "かーてん しきり" }),
    o("traffic_lights", "信号機", "traffic lights", undefined, { genres: ["city"], kw: "しんごうき 信号" }),
    o("crosswalk", "横断歩道", "a striped crosswalk", undefined, { genres: ["city"], kw: "おうだんほどう" }),
    o("utility_poles", "電柱と電線", "utility poles strung with overhead wires", undefined, { genres: ["city", "japanese"], kw: "でんちゅう でんせん" }),
    o("passing_cars", "行き交う車", "cars on the road", undefined, { genres: ["city"], kw: "くるま 車 自動車 交通" }),
    o("train", "電車", "a passing train", undefined, { genres: ["city"], kw: "でんしゃ 列車" }),
    o("skyscrapers", "高層ビル", "glass skyscrapers", undefined, { genres: ["city", "cyber"], kw: "こうそうびる ビル" }),
    o("shop_fronts", "店先・のれん", "rows of small shop fronts", undefined, { genres: ["city", "japanese"], kw: "みせさき のれん 商店" }),
    o("arcade_roof", "アーケード屋根", "a translucent arcade roof", undefined, { genres: ["city"], kw: "あーけーど 屋根" }),
    o("bicycles", "自転車", "parked bicycles", undefined, { genres: ["city"], kw: "じてんしゃ" }),
    o("vending_machines", "自動販売機", "glowing vending machines", undefined, { genres: ["city", "japanese"], kw: "じどうはんばいき 自販機" }),
    o("low_houses", "低層住宅", "rows of low-rise houses", undefined, { genres: ["city", "japanese"], kw: "じゅうたく 家 いえ" }),
    // 日本・東洋
    o("torii", "鳥居", "a row of torii gates", undefined, { genres: ["japanese"], kw: "とりい 神社" }),
    o("stone_lanterns", "石灯籠", "stone lanterns", undefined, { genres: ["japanese"], kw: "いしどうろう 灯籠" }),
    o("temizuya", "手水舎", "a temizuya purification basin", undefined, { genres: ["japanese"], kw: "ちょうずや 手水" }),
    o("shrine_hall", "拝殿", "a wooden shrine hall", undefined, { genres: ["japanese"], kw: "はいでん 社殿 本殿" }),
    o("shrine_approach", "参道", "a stone-paved shrine approach", undefined, { genres: ["japanese"], kw: "さんどう 石畳" }),
    o("tatami", "畳", "tatami mat flooring", undefined, { genres: ["japanese"], kw: "たたみ" }),
    o("shoji", "障子", "translucent shoji screens", undefined, { genres: ["japanese"], kw: "しょうじ" }),
    o("fusuma", "襖", "painted fusuma sliding doors", undefined, { genres: ["japanese"], kw: "ふすま" }),
    o("tokonoma", "床の間", "a tokonoma alcove with a hanging scroll", undefined, { genres: ["japanese"], kw: "とこのま 掛け軸 かけじく" }),
    o("engawa", "縁側", "a wooden engawa veranda", undefined, { genres: ["japanese"], kw: "えんがわ" }),
    o("garden_pond", "池", "a still garden pond", undefined, { genres: ["japanese", "nature"], kw: "いけ 池" }),
    o("rock_arrangement", "石組", "a deliberate rock arrangement", undefined, { genres: ["japanese"], kw: "いしぐみ 庭石" }),
    o("raked_gravel", "砂紋", "raked gravel patterns", undefined, { genres: ["japanese"], kw: "さもん 枯山水 砂" }),
    o("arched_bridge", "太鼓橋", "an arched wooden bridge", undefined, { genres: ["japanese"], kw: "たいこばし 橋" }),
    o("tea_kettle", "茶釜と炉", "an iron tea kettle over a sunken hearth", undefined, { genres: ["japanese"], kw: "ちゃがま ろ 茶道" }),
    // 西洋・城塞
    o("stained_glass", "ステンドグラス", "tall stained glass windows", undefined, { genres: ["western", "sacred", "castle"], kw: "すてんどぐらす" }),
    o("rose_window", "バラ窓", "a rose window", undefined, { genres: ["western", "sacred"], kw: "ばらまど" }),
    o("pointed_arches", "尖頭アーチ", "pointed Gothic arches", undefined, { genres: ["western", "sacred", "castle", "horror"], kw: "せんとうあーち ゴシック" }),
    o("castle_walls", "城壁と胸壁", "stone castle walls with battlements", undefined, { genres: ["castle"], kw: "じょうへき きょうへき" }),
    o("towers", "塔", "slender stone towers", undefined, { genres: ["castle", "western", "fantasy"], kw: "とう タワー" }),
    o("drawbridge", "跳ね橋", "a wooden drawbridge", undefined, { genres: ["castle"], kw: "はねばし" }),
    o("banners_heraldry", "紋章旗", "heraldic banners", undefined, { genres: ["castle", "western"], kw: "もんしょう 旗" }),
    o("iron_bars", "鉄格子", "rusted iron bars", undefined, { genres: ["fantasy", "horror", "castle"], kw: "てつごうし 牢" }),
    // 自然・地形
    o("cliffs", "断崖", "sheer cliffs", undefined, { genres: ["terrain", "nature", "water"], kw: "だんがい 崖 がけ" }),
    o("canyon_walls", "峡谷の岩壁", "layered canyon walls", undefined, { genres: ["terrain"], kw: "きょうこく 岩壁" }),
    o("sand_dunes", "砂丘", "rolling sand dunes", undefined, { genres: ["terrain"], kw: "さきゅう 砂" }),
    o("lava_flows", "溶岩流", "glowing lava flows", undefined, { genres: ["terrain"], kw: "ようがん" }),
    o("ice_formations", "氷の造形", "jagged blue ice formations", undefined, { genres: ["terrain"], kw: "こおり 氷河" }),
    o("pine_trees", "針葉樹", "dark pine trees", undefined, { genres: ["nature", "terrain", "japanese"], kw: "しんようじゅ 松 まつ" }),
    // 水中
    o("coral", "サンゴ", "branching coral", undefined, { genres: ["underwater"], kw: "さんご 珊瑚" }),
    o("seaweed", "海藻・ケルプ", "swaying kelp and seaweed", undefined, { genres: ["underwater"], kw: "かいそう けるぷ" }),
    o("seafloor_ripples", "海底の砂紋", "sand ripples on the seafloor", undefined, { genres: ["underwater"], kw: "かいてい 砂紋" }),
    o("underwater_rocks", "海底の岩", "rocky outcrops on the seabed", undefined, { genres: ["underwater"], kw: "かいてい いわ" }),
    // ホラー・終末
    o("ominous_portraits", "不気味な肖像画", "ominous old portraits", undefined, { genres: ["horror"], kw: "しょうぞうが 絵画" }),
    o("coffins", "棺", "stone coffins", undefined, { genres: ["horror"], kw: "ひつぎ かんおけ" }),
    o("bone_niches", "骨を納めた壁龕", "wall niches filled with old bones", undefined, { genres: ["horror"], kw: "ほね 骨 カタコンベ" }),
    o("covered_furniture", "白布をかけた家具", "furniture draped in dust sheets", undefined, { genres: ["horror", "home"], kw: "しろぬの 家具 空き家" }),
    o("abandoned_vehicles", "放棄された車", "abandoned vehicles", undefined, { genres: ["apocalypse", "city"], kw: "はいしゃ 廃車 車" }),
    o("barricades", "バリケード", "makeshift barricades", undefined, { genres: ["apocalypse"], kw: "ばりけーど" }),
    o("evacuation_signs", "避難誘導サイン", "evacuation signs", undefined, { genres: ["apocalypse", "industrial"], kw: "ひなん 標識" }),
    o("supply_shelves", "備蓄棚", "shelves of emergency supplies", undefined, { genres: ["apocalypse", "industrial"], kw: "びちく 物資" }),
    o("collapsed_buildings", "倒壊したビル", "collapsed buildings", undefined, { genres: ["apocalypse", "ruins", "city"], kw: "とうかい 崩れたビル" }),
    // SF・サイバーパンク
    o("holographic_ads", "ホログラム広告", "holographic advertisements", undefined, { genres: ["cyber", "scifi"], kw: "ほろぐらむ 広告" }),
    o("led_billboards", "巨大LED看板", "towering LED billboards", undefined, { genres: ["cyber", "city"], kw: "えるいーでぃー 看板 広告" }),
    o("flying_cars", "飛行車", "flying cars streaking between buildings", undefined, { genres: ["cyber", "scifi"], kw: "ひこうしゃ 空飛ぶ車" }),
    o("drones", "ドローン", "hovering drones", undefined, { genres: ["cyber", "scifi"], kw: "どろーん" }),
    o("overpasses", "高架道路", "stacked elevated overpasses", undefined, { genres: ["cyber", "city"], kw: "こうか 高速道路" }),
    o("dense_cables", "密集したケーブル", "dense tangles of overhead cables", undefined, { genres: ["cyber", "industrial"], kw: "けーぶる 配線" }),
    o("market_stalls", "露店", "crowded market stalls", undefined, { genres: ["cyber", "city", "japanese"], kw: "ろてん 屋台 やたい" }),
    // 神話・魔法
    o("runes", "ルーン文様", "carved glowing runes", undefined, { genres: ["fantasy", "sacred"], kw: "るーん 文様" }),
    o("offerings", "供物", "small offerings", undefined, { genres: ["sacred", "japanese", "fantasy"], kw: "くもつ お供え おそなえ" }),
    o("sacred_emblem", "聖なる紋章", "a sacred emblem carved in stone", undefined, { genres: ["sacred", "fantasy"], kw: "もんしょう 紋章" }),
    o("idol_statue", "神像", "a weathered deity statue", undefined, { genres: ["sacred", "fantasy", "ruins"], kw: "しんぞう 像" }),
  ],
  accents: [
    o("scattered_books", "散らばった本", "scattered books", undefined, { genres: ["study", "home", "horror"], kw: "ほん" }),
    o("fallen_leaves", "落ち葉", "drifting fallen leaves", undefined, { genres: ["nature", "japanese", "city"], kw: "おちば" }),
    o("wet_ground", "濡れた地面", "wet pavement", undefined, { genres: ["city", "cyber"], kw: "ぬれたじめん 雨" }),
    o("petals", "花びら", "floating petals", undefined, { genres: ["nature", "japanese", "fantasy"], kw: "はなびら 桜" }),
    o("candles", "ろうそく", "scattered candles", undefined, { genres: ["sacred", "horror", "castle"], kw: "ろうそく" }),
    o("light_particles", "光の粒", "delicate light particles", undefined, { genres: ["fantasy", "sky"], kw: "ひかりのつぶ" }),
    o("mist", "薄霧", "low-lying mist", undefined, { genres: ["nature", "horror", "terrain", "japanese"], kw: "うすぎり 霧" }),
    o("moss", "苔", "soft moss", undefined, { genres: ["nature", "japanese", "ruins"], kw: "こけ" }),
    o("neon_reflections", "ネオン反射", "neon reflections", undefined, { genres: ["cyber", "city"], kw: "ねおん 反射" }),
    o("fabric", "布・旗", "trailing fabric banners", undefined, { genres: ["castle", "western"], kw: "ぬの はた" }),
    o("debris", "破片・瓦礫", "scattered debris", undefined, { genres: ["ruins", "apocalypse", "industrial"], kw: "がれき" }),
    o("gentle_waves", "穏やかな波", "gentle waves rolling toward the shore", undefined, { genres: ["water"], kw: "なみ" }),
    o("white_sea_spray", "白い波しぶき", "white spray breaking against the rocks", undefined, { genres: ["water"], kw: "なみしぶき" }),
    o("wet_sand", "濡れた砂", "wet sand reflecting the sky", undefined, { genres: ["water"], kw: "すな" }),
    o("water_sparkle", "水面のきらめき", "sunlight glittering across the water", undefined, { genres: ["water"], kw: "すいめん きらめき" }),
    o("seashells", "貝殻", "a few shells resting near the tide line", undefined, { genres: ["water"], kw: "かいがら" }),
    o("cobblestones", "石畳", "worn cobblestones carrying a gentle lived-in texture", undefined, { genres: ["city", "western", "castle"], kw: "いしだたみ" }),
    // v2.0 追加（痕跡・小物）
    o("cobwebs", "蜘蛛の巣", "thick cobwebs", undefined, { genres: ["horror", "ruins"], kw: "くものす" }),
    o("dust_layers", "積もった埃", "thick layers of dust", undefined, { genres: ["horror", "ruins", "apocalypse"], kw: "ほこり" }),
    o("old_stains", "古い染み", "dark old stains on the walls", undefined, { genres: ["horror"], kw: "しみ 汚れ" }),
    o("scratch_marks", "怪異の爪痕", "strange scratch marks on the walls", undefined, { genres: ["horror"], kw: "つめあと 痕跡 怪異" }),
    o("dusty_footprints", "埃の足跡", "footprints left in the dust", undefined, { genres: ["horror", "ruins", "apocalypse"], kw: "あしあと 痕跡" }),
    o("scattered_bones", "散らばった骨", "scattered old bones", undefined, { genres: ["horror", "fantasy"], kw: "ほね" }),
    o("faded_graffiti", "色あせた落書き", "faded graffiti", undefined, { genres: ["apocalypse", "city", "cyber"], kw: "らくがき" }),
    o("warning_tape", "立入禁止テープ", "torn warning tape", undefined, { genres: ["apocalypse", "horror"], kw: "けいこく テープ" }),
    o("shimenawa", "しめ縄", "a shimenawa rope with paper streamers", undefined, { genres: ["japanese"], kw: "しめなわ 紙垂 しで" }),
    o("ema_plaques", "絵馬", "rows of wooden ema plaques", undefined, { genres: ["japanese"], kw: "えま" }),
    o("zabuton", "座布団", "a few zabuton cushions", undefined, { genres: ["japanese"], kw: "ざぶとん" }),
    o("suspended_particles", "漂う粒子", "tiny particles suspended in the water", undefined, { genres: ["underwater"], kw: "りゅうし 浮遊物" }),
    o("bubbles", "泡", "rising bubbles", undefined, { genres: ["underwater"], kw: "あわ" }),
    o("puddles", "水たまり", "shallow puddles", undefined, { genres: ["city", "apocalypse"], kw: "みずたまり" }),
    o("magic_sigils", "宙に浮く紋様", "floating luminous sigils", undefined, { genres: ["fantasy"], kw: "もんよう 魔法" }),
    o("lived_in_clutter", "生活感のある小物", "everyday clutter", undefined, { genres: ["home", "public"], kw: "せいかつかん 小物" }),
  ],
  /** 生き物・怪異そのもの。選ぶと実際に描かれる（痕跡は accents 側） */
  creatures: [
    o("fish_school", "魚の群れ", "a school of fish", undefined, { genres: ["underwater"], kw: "さかな 魚", creature: true }),
    o("tropical_fish", "熱帯魚", "colorful tropical fish", undefined, { genres: ["underwater"], kw: "ねったいぎょ 魚", creature: true }),
    o("jellyfish", "クラゲ", "drifting jellyfish", undefined, { genres: ["underwater"], kw: "くらげ", creature: true }),
    o("whale", "遠くのクジラ", "a whale silhouette in the distance", undefined, { genres: ["underwater", "water"], kw: "くじら 鯨", creature: true }),
    o("koi", "鯉", "koi fish in the water", undefined, { genres: ["japanese"], kw: "こい", creature: true }),
    o("birds", "鳥の群れ", "a flock of birds", undefined, { genres: ["nature", "sky", "water", "city"], kw: "とり 鳥 かもめ", creature: true }),
    o("butterflies", "蝶", "fluttering butterflies", undefined, { genres: ["nature", "fantasy", "japanese"], kw: "ちょう", creature: true }),
    o("dragon_silhouette", "遠くの竜", "a distant dragon silhouette", undefined, { genres: ["fantasy", "sky", "castle"], kw: "りゅう ドラゴン", creature: true }),
    o("ghostly_figure", "幽霊の影", "a faint ghostly apparition", undefined, { genres: ["horror"], kw: "ゆうれい 幽霊 おばけ", creature: true }),
    o("monster_silhouette", "怪物の影", "a looming monstrous silhouette", undefined, { genres: ["horror", "fantasy"], kw: "かいぶつ 怪物 モンスター", creature: true }),
  ],
  times: [unset(), o("dawn", "夜明け", "at dawn"), o("morning", "朝", "in the morning"), o("day", "昼", "during the day"), o("sunset", "夕方", "at sunset"), o("dusk", "薄暮", "at dusk"), o("night", "夜", "at night")],
  seasons: [unset(), o("spring", "春", "in spring"), o("summer", "夏", "in summer"), o("autumn", "秋", "in autumn"), o("winter", "冬", "in winter")],
  weather: [unset(), o("clear", "晴れ", "under clear skies"), o("cloudy", "曇り", "under an overcast sky"), o("rain", "雨", "in steady rain"), o("snow", "雪", "in falling snow"), o("storm", "嵐", "during a distant storm")],
  phenomena: [
    o("fog", "霧", "rolling fog"), o("snow_drift", "雪煙", "windblown snow"), o("falling_petals", "舞う花びら", "drifting petals"), o("falling_leaves", "舞う落ち葉", "swirling autumn leaves"), o("dust", "光る塵", "dust motes in the air"), o("rain_haze", "雨霞", "rain haze"), o("sea_mist", "海霧", "sea mist drifting low over the water"), o("salt_spray", "潮風の飛沫", "salt spray carried through the air by the wind"), o("drifting_clouds", "流れる雲", "broad clouds drifting through the distance"),
    o("steam", "湯気", "soft rising steam"), o("smoke", "立ちのぼる煙", "plumes of smoke rising in the distance"), o("falling_ash", "降る灰", "ash drifting down through the air"), o("heat_haze", "陽炎", "shimmering heat haze"), o("sandstorm", "砂嵐", "a swirling sandstorm"), o("lightning", "稲妻", "lightning forking across the sky"), o("rainbow", "虹", "a faint rainbow"), o("aurora", "オーロラ", "an aurora rippling across the sky"),
  ],
  primaryLights: [
    unset(), o("natural", "自然光", "natural light"), o("direct_sunlight", "直射日光", "direct sunlight"), o("moonlight", "月明かり", "pale moonlight"), o("neon", "ネオン", "colored neon light"), o("candlelight", "ろうそく", "warm candlelight"), o("studio", "スタジオ光", "clean studio lighting"), o("magic", "魔法光", "ethereal magical light"), o("ambient_artificial", "柔らかい人工光", "soft ambient artificial illumination"),
    o("fluorescent", "蛍光灯", "flat fluorescent ceiling light"), o("warm_indoor", "暖かな室内灯", "warm indoor lamplight"), o("store_lighting", "明るい店内照明", "bright, even store lighting"), o("paper_lantern", "行灯・提灯", "the soft glow of paper lanterns"), o("underwater_sunlight", "水面から差す光", "sunlight filtering down from the water surface"), o("bioluminescence", "生物発光", "faint bioluminescent glow"), o("torchlight", "松明", "flickering torchlight"), o("stained_glass_light", "ステンドグラスの光", "colored light streaming through stained glass"), o("flickering", "明滅する照明", "flickering, unreliable lights"), o("emergency_red", "赤い非常灯", "red emergency lighting"), o("fire_glow", "火災の光", "the orange glow of distant fires"), o("hologram", "ホログラム光", "cool holographic glow"),
  ],
  secondaryLights: [
    o("none", "なし", ""), o("streetlight", "街灯", "scattered streetlight"), o("window_light", "窓からの光", "light filtering through the windows"), o("rim_light", "リムライト", "a subtle rim light"), o("reflected_light", "反射光", "soft reflected light"), o("embers", "火の粉", "a faint ember glow"),
    o("shoji_light", "障子越しの光", "light diffused through shoji screens"), o("caustics", "水面の揺らぎ光", "rippling caustic light"), o("god_rays", "光芒", "shafts of light"), o("flashlight", "懐中電灯の光", "a narrow flashlight beam"), o("monitor_glow", "画面の光", "the glow of screens"), o("toxic_glow", "不気味な緑の光", "a sickly green glow"), o("chandelier", "シャンデリア", "the sparkle of chandeliers"), o("lantern", "提灯", "paper lantern light"),
  ],
  directions: [unset(), o("front", "正面", "front-lit"), o("side", "横", "side-lit"), o("back", "逆光", "backlit"), o("top", "上方", "lit from above"), o("scattered", "分散", "with scattered illumination")],
  qualities: [unset(), o("soft", "柔らかい", "soft"), o("diffused", "拡散", "diffused"), o("dramatic", "ドラマチック", "dramatic"), o("hazy", "霞んだ", "hazy"), o("crisp", "くっきり", "crisp")],
  tones: [unset(), o("neutral", "ニュートラル", "balanced neutral tones"), o("warm", "暖色", "warm amber tones"), o("cool", "寒色", "cool blue tones"), o("blue_purple", "青紫", "muted blue and violet tones"), o("pastel", "パステル", "gentle pastel tones"), o("monochrome", "モノトーン", "restrained monochrome tones"), o("teal_aqua", "青緑", "clear teal and aqua tones"), o("desaturated", "くすんだ色", "desaturated, washed-out tones")],
  contrasts: [unset(), o("low", "低め", "low contrast"), o("medium", "標準", "balanced contrast"), o("high", "高め", "high contrast")],
  moods: [o("calm", "穏やか", "calm"), o("quiet", "静か", "quiet"), o("romantic", "ロマンチック", "romantic"), o("dreamlike", "幻想的", "dreamlike"), o("mysterious", "神秘的", "mysterious"), o("solemn", "厳か", "solemn"), o("melancholic", "アンニュイ", "melancholic"), o("decadent", "退廃的", "decadent"), o("cinematic", "映画的", "cinematic"), o("open_air", "開放的", "open and airy"), o("wild", "荒々しい", "wild and turbulent"), o("serene", "静謐", "serene"), o("nostalgic", "懐かしい", "gently nostalgic"), o("majestic", "壮大", "majestic"), o("eerie", "不気味", "eerie"), o("desolate", "荒涼", "desolate"), o("cozy", "くつろぎ", "cozy"), o("tense", "緊迫", "tense")],
  perspectives: [unset(), o("eye_level", "目線の高さ", "eye-level perspective"), o("low_angle", "低い視点", "low-angle perspective"), o("high_angle", "高い視点", "high-angle perspective"), o("wide", "広角", "wide establishing view")],
  depth: [unset(), o("flat", "浅い", "shallow spatial depth"), o("moderate", "標準", "clear spatial depth"), o("layered", "前・中・遠景", "layered foreground, midground, and distance"), o("deep", "深い遠近感", "deep receding perspective")],
  densities: [unset(), o("minimal", "ミニマル", "minimal environmental detail"), o("standard", "標準", "balanced environmental detail"), o("rich", "豊か", "rich environmental detail"), o("intricate", "緻密", "intricate environmental detail")],
  fantasies: [o("floating_lights", "浮遊する光", "floating lights"), o("levitating_ruins", "浮遊遺跡", "levitating ruins"), o("impossible_scale", "非現実的な巨大さ", "impossible monumental scale"), o("time_distortion", "時間の歪み", "subtle distortions of time"), o("divine_halo", "後光", "a radiant divine halo of light"), o("ritual_rings", "儀式の光輪", "concentric rings of ritual light")],
  blends: [unset(), o("soft_blur", "柔らかく馴染ませる", "with gently softened background edges"), o("atmospheric", "空気遠近で馴染ませる", "with atmospheric perspective"), o("clear", "輪郭を保つ", "with clearly defined environmental forms")],
};

export const simpleData = {
  relations: [o("character_focus", "人物を目立たせる", "unobtrusive behind the character"), o("soft_blend", "やさしく馴染ませる", "gently blending around the character"), o("slight_presence", "背景も少し見せる", "with a subtle visual presence"), o("background_only", "背景だけで使う", "as a standalone background")],
  styles: [o("plain", "プレーン", "clean and understated"), o("soft", "ソフト", "soft and airy"), o("purikura", "プリクラ風", "cute and playful")],
  types: [o("solid", "単色", "solid color backdrop"), o("gradient", "グラデーション", "gradient backdrop"), o("soft_abstract", "やわらかい抽象背景", "soft abstract backdrop"), o("studio", "スタジオ背景", "clean studio backdrop"), o("pattern", "柄背景", "patterned backdrop"), o("texture", "質感背景", "textured backdrop")],
  colors: [o("white", "ホワイト", "white"), o("warm_gray", "ウォームグレー", "warm gray"), o("pastel_pink", "パステルピンク", "pastel pink"), o("lavender", "ラベンダー", "lavender"), o("mint", "ミント", "soft mint"), o("powder_blue", "くすみブルー", "powder blue"), o("cream", "クリーム", "soft cream"), o("peach", "ピーチ", "peach"), o("deep_navy", "ディープネイビー", "deep navy"), o("black", "ブラック", "black"), o("sage", "セージグリーン", "sage green"), o("burgundy", "ボルドー", "burgundy"), o("gold", "ゴールド", "soft gold")],
  intensities: [o("very_light", "とても淡い", "very pale"), o("soft", "淡い", "soft"), o("medium", "標準", "balanced"), o("deep", "深め", "deep"), o("dark", "暗め", "dark")],
  renderings: [o("flat", "フラット", "even flat color"), o("subtle_variation", "少し濃淡", "subtle tonal variation"), o("vignette", "周辺を少し暗く", "a gentle edge vignette"), o("center_glow", "中央を少し明るく", "a soft central glow"), o("vertical_gradient", "上下グラデ", "a smooth vertical transition"), o("horizontal_gradient", "左右グラデ", "a smooth horizontal transition"), o("diagonal_gradient", "斜めグラデ", "a smooth diagonal transition"), o("radial_gradient", "放射状グラデ", "a subtle radial transition"), o("gentle_blur", "やわらかいぼかし", "gentle blur"), o("soft_glow", "ふんわり発光", "soft luminous glow"), o("light_bloom", "軽い光のにじみ", "delicate light bloom")],
  /** 柄（背景タイプが「柄背景」のときに使う） */
  patterns: [unset(), o("geometric_grid", "格子", "a fine geometric grid pattern", undefined, { tag: "grid background" }), o("stripes", "ストライプ", "a soft striped pattern", undefined, { tag: "striped background" }), o("checkered", "チェック", "a subtle checkered pattern", undefined, { tag: "checkered background" }), o("polka_dots", "水玉", "an even polka dot pattern", undefined, { tag: "polka dot background" }), o("triangles", "三角形の幾何学", "a repeating triangle geometric pattern", undefined, { tag: "geometric pattern" }), o("circles", "円の反復", "repeating overlapping circles", undefined, { tag: "circle pattern" }), o("wavy_lines", "波線", "gentle wavy line patterns", undefined, { tag: "wavy lines" }), o("argyle", "アーガイル", "a classic argyle pattern", undefined, { tag: "argyle background" }), o("japanese_seigaiha", "青海波（和柄）", "a traditional seigaiha wave pattern", undefined, { tag: "seigaiha, japanese pattern" })],
  /** 素材の質感（背景タイプが「質感背景」のときに使う） */
  textures: [unset(), o("paper", "紙", "fine paper texture with soft fibers", undefined, { tag: "paper texture" }), o("watercolor_paper", "水彩紙", "watercolor paper texture", undefined, { tag: "watercolor paper" }), o("fabric", "布", "woven fabric texture", undefined, { tag: "fabric texture" }), o("velvet", "ベルベット", "rich velvet texture with a soft sheen", undefined, { tag: "velvet" }), o("linen", "リネン", "natural linen texture", undefined, { tag: "linen texture" }), o("metallic", "金属", "brushed metallic texture", undefined, { tag: "metallic texture" }), o("marble", "大理石", "polished marble texture", undefined, { tag: "marble texture" }), o("frosted_glass", "すりガラス", "frosted glass texture", undefined, { tag: "frosted glass" })],
  /** 基本の9件（v1から）＋季節・イベントのモチーフ（seasonal-data.ts で一度だけ定義） */
  motifs: [o("tiny_hearts", "ハート", "tiny heart motifs"), o("small_stars", "星", "small star motifs"), o("subtle_sparkles", "きらきら", "subtle sparkles"), o("soft_dots", "ドット", "soft dot accents"), o("tiny_flowers", "小花", "tiny floral motifs"), o("ribbons", "リボン", "delicate ribbon motifs"), o("lace_trim", "レース", "lace trim details"), o("tiny_bubbles", "しゃぼん玉", "tiny floating bubbles"), o("little_clouds", "小さな雲", "little cloud motifs"),
    ...seasonalMotifs.map((item) => o(item.id, item.label, item.en, undefined, { tag: item.tag, kw: item.kw }))],
  /** 装飾の位置 */
  placements: [unset("おまかせ"), o("scattered", "全体に散らす", "scattered across the backdrop"), o("edges", "フチに沿って", "arranged along the edges"), o("corners", "四隅に", "gathered in the corners"), o("upper", "上側に", "concentrated toward the top")],
  /** 装飾の密度 */
  decorationDensities: [unset("おまかせ"), o("sparse", "まばら", "sparse"), o("moderate", "ほどほど", "moderate"), o("dense", "多め", "dense")],
};

export const createDefaultTarget = (): TargetSettings => ({
  platform: "generic",
  pixaiModel: "tsubaki",
  negativeEnabled: true,
  tsubakiProMode: false,
  negativeItems: ["people", "text", "watermark"],
  novelaiEmphasis: false,
});

export const createDefaultState = (): BackgroundState => ({
  version: 2,
  backgroundMode: "scene",
  outputStyle: "short",
  target: createDefaultTarget(),
  scene: {
    subjectRelation: "character_focus",
    place: { environmentType: "outdoor", category: "urban_street", mainStage: "back_alley", stageState: ["rainy"] },
    world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
    structures: { landmark: "none", secondary: ["street_lamps", "wall_pipes"], accents: ["wet_ground", "neon_reflections"], creatures: [] },
    environment: { timeOfDay: "night", season: "autumn", weather: "rain", phenomena: ["rain_haze"] },
    lighting: { primarySource: "neon", secondarySource: "streetlight", direction: "side", quality: "diffused" },
    atmosphere: { colorTone: "blue_purple", contrast: "medium", mood: ["melancholic", "cinematic"] },
    composition: { perspective: "eye_level", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    view: createDefaultView(),
  },
  simple: {
    subjectRelation: "character_focus", style: "soft", backgroundType: "gradient",
    colors: { primary: "pastel_pink", secondary: "lavender", intensity: "soft" },
    rendering: ["diagonal_gradient", "center_glow", "gentle_blur"], pattern: "", texture: "",
    decoration: { enabled: true, motifs: ["subtle_sparkles"], placement: "", density: "" },
    eventTheme: "", designProfile: "",
  },
  ui: { warningsDismissed: [], expandedSections: ["purpose", "stage"] },
});

/** プリセットの差分。scene / simple は部分指定でよく、省略した項目は初期値で補う */
export type ScenePatch = Partial<Omit<BackgroundState["scene"], "view" | "structures">> & {
  structures?: Partial<BackgroundState["scene"]["structures"]>;
  view?: Partial<ViewState>;
};
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
    { id: "view_examples", label: "見え方の例" },
    { id: "nature_water", label: "自然・水辺" },
    { id: "city_daily", label: "街・日常" },
    { id: "japan", label: "和・日本" },
    { id: "fantasy_history", label: "幻想・歴史" },
    { id: "horror_ruin", label: "ホラー・終末" },
    { id: "scifi_special", label: "SF・特殊" },
  ],
  simple: [
    { id: "recommended", label: "おすすめ" },
    { id: "season", label: "季節" },
    { id: "event", label: "行事・記念日" },
    { id: "plain", label: "プレーン" },
    { id: "soft", label: "ソフト" },
    { id: "purikura", label: "プリクラ風" },
    { id: "pattern", label: "柄・質感" },
    { id: "world", label: "海外の行事" },
  ],
};

const scenePatch = (overrides: ScenePatch): Partial<BackgroundState> => {
  const base = createDefaultState().scene;
  return {
    scene: {
      ...base,
      ...overrides,
      structures: { ...base.structures, ...overrides.structures },
      view: { ...base.view, ...overrides.view, ...(overrides.view ? { mode: overrides.view.mode || "custom" } : {}) },
    } as BackgroundState["scene"],
  };
};

const simplePatch = (overrides: Partial<BackgroundState["simple"]>): Partial<BackgroundState> => {
  const base = createDefaultState().simple;
  return { simple: { ...base, ...overrides, decoration: { ...base.decoration, ...overrides.decoration } } };
};


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
  // ===================== v2.0 追加：空間背景 =====================
  {
    id: "harbor_flight", mode: "scene", group: "recommended", label: "港町の上空を飛ぶ", description: "眼下に港町と海が広がる",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "harbor_town", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "distant_lighthouse", secondary: ["pier"], accents: ["water_sparkle"], creatures: ["birds"] },
      environment: { timeOfDay: "day", season: "summer", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "reflected_light", direction: "front", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["open_air", "majestic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "sky", altitude: "mid", gaze: "down_diagonal", targets: ["main_stage", "sea"], distance: "far", motion: "flying", motionEffects: ["wind_streaks"], lens: "wide" },
    }),
  },
  {
    id: "castle_from_town", mode: "scene", group: "view_examples", label: "城下町から城を見上げる", description: "道の先にそびえる城",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "fortress", mainStage: "castle_town", stageState: ["lived_in"] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: ["gothic"] },
      structures: { landmark: "none", secondary: ["street_lamps", "banners_heraldry"], accents: ["cobblestones"] },
      environment: { timeOfDay: "morning", season: "spring", weather: "clear", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "none", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["majestic", "calm"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "street", gaze: "up_diagonal", targets: ["castle"], distance: "mid", lens: "wide" },
    }),
  },
  {
    id: "castle_balcony_view", mode: "scene", group: "view_examples", label: "城のバルコニーから街を見下ろす", description: "夕方の城下町を俯瞰",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "semi_outdoor", category: "terrace", mainStage: "castle_balcony", stageState: [] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: ["gothic"] },
      structures: { landmark: "none", secondary: ["columns"], accents: ["fabric"] },
      environment: { timeOfDay: "sunset", season: "autumn", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "rim_light", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["majestic", "nostalgic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "balcony", gaze: "down_diagonal", targets: ["castle_town"], distance: "far", frame: "railing" },
    }),
  },
  {
    id: "castle_aerial", mode: "scene", group: "view_examples", label: "上空から城全体を見る", description: "城と周辺の街を遠景で",
    patch: scenePatch({
      subjectRelation: "background_only",
      place: { environmentType: "outdoor", category: "fortress", mainStage: "castle_exterior", stageState: [] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: [] },
      structures: { landmark: "castle_keep", secondary: ["castle_walls", "towers"], accents: [] },
      environment: { timeOfDay: "day", season: "summer", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "natural", secondarySource: "none", direction: "side", quality: "crisp" },
      atmosphere: { colorTone: "neutral", contrast: "medium", mood: ["majestic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "sky", altitude: "high", gaze: "down_diagonal", targets: ["main_stage", "surroundings"], distance: "far" },
    }),
  },
  {
    id: "sky_fall_city", mode: "scene", group: "view_examples", label: "空から都市へ落下", description: "真下のビル群が迫ってくる",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "skyscraper_district", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["skyscrapers"], accents: [], creatures: [] },
      environment: { timeOfDay: "day", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "top", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "high", mood: ["tense", "cinematic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
      view: { vantage: "sky", altitude: "mid", gaze: "straight_down", targets: ["main_stage"], distance: "mid", motion: "falling", motionEffects: ["converging_buildings", "strong_wind", "rushing_clouds"], lens: "wide" },
    }),
  },
  {
    id: "city_dive", mode: "scene", group: "view_examples", label: "都市へ急降下", description: "夕方のビル街へ斜めに突っ込む",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "skyscraper_district", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["skyscrapers"], accents: [], creatures: [] },
      environment: { timeOfDay: "sunset", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "reflected_light", direction: "side", quality: "dramatic" },
      atmosphere: { colorTone: "warm", contrast: "high", mood: ["tense", "cinematic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
      view: { vantage: "sky", altitude: "mid", gaze: "down_diagonal", targets: ["main_stage"], distance: "mid", motion: "dive", motionEffects: ["converging_buildings", "tilted_horizon"], lens: "wide" },
    }),
  },
  {
    id: "sea_glide", mode: "scene", group: "view_examples", label: "海上を滑空", description: "低空で水平線へ向かう",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "seaside", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: [], accents: ["gentle_waves", "water_sparkle"], creatures: ["birds"] },
      environment: { timeOfDay: "day", season: "summer", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "reflected_light", direction: "front", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["open_air"] },
      composition: { perspective: "", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "low_air", altitude: "low", gaze: "horizon_far", targets: ["sea", "horizon"], distance: "far", motion: "gliding", motionEffects: ["wind_streaks", "tilted_horizon"], lens: "wide" },
    }),
  },
  {
    id: "castle_tower_flyby", mode: "scene", group: "view_examples", label: "城の塔の横を飛行", description: "主塔のすぐ脇を高速でかすめる",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "fortress", mainStage: "castle_exterior", stageState: [] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: [] },
      structures: { landmark: "castle_keep", secondary: ["towers", "banners_heraldry"], accents: [], creatures: [] },
      environment: { timeOfDay: "morning", season: "spring", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "natural", secondarySource: "rim_light", direction: "side", quality: "crisp" },
      atmosphere: { colorTone: "neutral", contrast: "medium", mood: ["majestic", "cinematic"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "sky", altitude: "low", gaze: "forward", targets: ["main_stage"], distance: "near", motion: "fly_by", motionEffects: ["scale_contrast", "tilted_horizon"], lens: "wide" },
    }),
  },
  {
    id: "cloud_break_harbor", mode: "scene", group: "view_examples", label: "雲を抜けて下降", description: "雲の切れ間に港町と海",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "waterfront", mainStage: "harbor_town", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: [], accents: [], creatures: [] },
      environment: { timeOfDay: "morning", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["majestic", "open_air"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "sky", altitude: "high", gaze: "down_diagonal", targets: ["main_stage", "sea"], distance: "far", motion: "cloud_break", motionEffects: ["rushing_clouds"], lens: "" },
    }),
  },
  {
    id: "town_rapid_ascent", mode: "scene", group: "view_examples", label: "地上から急上昇", description: "住宅街が足元へ遠ざかる",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "residential_street", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["low_houses", "utility_poles"], accents: [], creatures: [] },
      environment: { timeOfDay: "day", season: "summer", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "top", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["open_air", "tense"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
      view: { vantage: "low_air", altitude: "low", gaze: "straight_down", targets: ["main_stage"], distance: "mid", motion: "rapid_ascent", motionEffects: ["scale_contrast"], lens: "wide" },
    }),
  },
  {
    id: "underwater_surface", mode: "scene", group: "view_examples", label: "海中から水面を見上げる", description: "揺らぐ光と浮遊粒子",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "underwater", mainStage: "underwater_scene", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["seaweed"], accents: ["suspended_particles", "bubbles"], creatures: [] },
      environment: { timeOfDay: "day", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "underwater_sunlight", secondarySource: "caustics", direction: "top", quality: "soft" },
      atmosphere: { colorTone: "teal_aqua", contrast: "low", mood: ["serene", "dreamlike"] },
      composition: { perspective: "", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "underwater", gaze: "straight_up", targets: ["water_surface", "sky_clouds"], motion: "floating", motionEffects: ["rising_bubbles"] },
    }),
  },
  {
    id: "window_sky_hall", mode: "scene", group: "view_examples", label: "城の中から窓越しに空", description: "アーチ窓の外に広がる空",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "palace", mainStage: "castle_corridor", stageState: [] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: ["gothic"] },
      structures: { landmark: "none", secondary: ["pointed_arches"], accents: [] },
      environment: { timeOfDay: "day", season: "spring", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "natural", secondarySource: "window_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "cool", contrast: "low", mood: ["serene", "quiet"] },
      composition: { perspective: "", depthLayers: "layered", density: "standard", fantasyEffects: [], blend: "soft_blur" },
      view: { vantage: "interior", gaze: "up_diagonal", targets: ["sky_clouds"], frame: "window", frameDetail: "arched" },
    }),
  },
  {
    id: "kitchen_morning", mode: "scene", group: "city_daily", label: "朝のキッチン", description: "生活感のある明るい台所",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "living", mainStage: "kitchen", stageState: ["lived_in"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["kitchen_counter", "refrigerator", "large_windows"], accents: ["lived_in_clutter"] },
      environment: { timeOfDay: "morning", season: "", weather: "clear", phenomena: ["steam"] },
      lighting: { primarySource: "natural", secondarySource: "window_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["cozy", "calm"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "living_evening", mode: "scene", group: "city_daily", label: "夜のリビング", description: "ソファと暖かな室内灯",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "living", mainStage: "living_room", stageState: ["lived_in"] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["sofa_set", "television", "houseplants"], accents: [] },
      environment: { timeOfDay: "night", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "warm_indoor", secondarySource: "monitor_glow", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["cozy", "quiet"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "midnight_konbini", mode: "scene", group: "city_daily", label: "深夜のコンビニ", description: "明るい店内と冷蔵ケース",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "public", mainStage: "convenience_store", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["store_shelves", "refrigerated_cases", "checkout_counter"], accents: [] },
      environment: { timeOfDay: "night", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "store_lighting", secondarySource: "none", direction: "top", quality: "crisp" },
      atmosphere: { colorTone: "neutral", contrast: "medium", mood: ["quiet", "nostalgic"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
    }),
  },
  {
    id: "residential_dusk", mode: "scene", group: "city_daily", label: "夕暮れの住宅街", description: "電柱と帰り道",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "residential_street", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["utility_poles", "low_houses", "vending_machines"], accents: [] },
      environment: { timeOfDay: "sunset", season: "summer", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["nostalgic", "quiet"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "standard", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "busy_crossing", mode: "scene", group: "city_daily", label: "交差点の昼", description: "信号と横断歩道のある都心",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "urban_street", mainStage: "intersection", stageState: [] },
      world: { worldType: "modern", era: "contemporary", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["traffic_lights", "crosswalk", "skyscrapers"], accents: [] },
      environment: { timeOfDay: "day", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "reflected_light", direction: "top", quality: "crisp" },
      atmosphere: { colorTone: "neutral", contrast: "medium", mood: ["open_air"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
    }),
  },
  {
    id: "shrine_dusk", mode: "scene", group: "japan", label: "夕暮れの神社", description: "鳥居と参道、石灯籠",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "japanese_outdoor", mainStage: "shinto_shrine", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: ["japanese"] },
      structures: { landmark: "none", secondary: ["torii", "shrine_approach", "stone_lanterns"], accents: ["shimenawa", "fallen_leaves"] },
      environment: { timeOfDay: "sunset", season: "autumn", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "lantern", direction: "back", quality: "soft" },
      atmosphere: { colorTone: "warm", contrast: "medium", mood: ["serene", "solemn"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "tatami_afternoon", mode: "scene", group: "japan", label: "障子越しの和室", description: "畳と床の間、やわらかな光",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "japanese_room", mainStage: "tatami_room", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: ["japanese"] },
      structures: { landmark: "none", secondary: ["tatami", "shoji", "tokonoma"], accents: ["zabuton"] },
      environment: { timeOfDay: "day", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "shoji_light", direction: "side", quality: "diffused" },
      atmosphere: { colorTone: "warm", contrast: "low", mood: ["serene", "quiet"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "zen_garden", mode: "scene", group: "japan", label: "日本庭園", description: "池・石組・苔と太鼓橋",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "japanese_outdoor", mainStage: "japanese_garden", stageState: ["pristine"] },
      world: { worldType: "", era: "", architectureStyle: ["japanese"] },
      structures: { landmark: "none", secondary: ["garden_pond", "rock_arrangement", "arched_bridge"], accents: ["moss"], creatures: ["koi"] },
      environment: { timeOfDay: "morning", season: "autumn", weather: "clear", phenomena: [] },
      lighting: { primarySource: "natural", secondarySource: "reflected_light", direction: "side", quality: "soft" },
      atmosphere: { colorTone: "neutral", contrast: "low", mood: ["serene", "calm"] },
      composition: { perspective: "eye_level", depthLayers: "layered", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "coral_reef_day", mode: "scene", group: "nature_water", label: "サンゴ礁の海中", description: "熱帯魚と水中の光",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "underwater", mainStage: "coral_reef", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["coral", "seaweed"], accents: ["suspended_particles"], creatures: ["tropical_fish"] },
      environment: { timeOfDay: "day", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "underwater_sunlight", secondarySource: "god_rays", direction: "top", quality: "soft" },
      atmosphere: { colorTone: "teal_aqua", contrast: "medium", mood: ["serene", "open_air"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "deep_sea_glow", mode: "scene", group: "nature_water", label: "深海の微光", description: "暗い海底と生物発光",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "underwater", mainStage: "deep_sea", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["underwater_rocks"], accents: ["suspended_particles"], creatures: ["jellyfish"] },
      environment: { timeOfDay: "", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "bioluminescence", secondarySource: "none", direction: "scattered", quality: "hazy" },
      atmosphere: { colorTone: "cool", contrast: "high", mood: ["mysterious", "eerie"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "minimal", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "mountain_dawn", mode: "scene", group: "nature_water", label: "夜明けの山岳", description: "高台から山並みを望む",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "mountain_terrain", mainStage: "mountain_range", stageState: ["snow_covered"] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["cliffs", "pine_trees"], accents: ["mist"] },
      environment: { timeOfDay: "dawn", season: "winter", weather: "clear", phenomena: ["drifting_clouds"] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "rim_light", direction: "side", quality: "crisp" },
      atmosphere: { colorTone: "cool", contrast: "medium", mood: ["majestic", "serene"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "cliff", gaze: "horizon_far", targets: ["main_stage"], distance: "very_far", lens: "panorama" },
    }),
  },
  {
    id: "desert_dunes", mode: "scene", group: "nature_water", label: "砂漠の夕景", description: "砂丘と陽炎",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "mountain_terrain", mainStage: "desert", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["sand_dunes"], accents: [] },
      environment: { timeOfDay: "sunset", season: "summer", weather: "clear", phenomena: ["heat_haze"] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "back", quality: "dramatic" },
      atmosphere: { colorTone: "warm", contrast: "high", mood: ["desolate", "majestic"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "minimal", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "canyon_overlook", mode: "scene", group: "nature_water", label: "峡谷を見下ろす", description: "岩壁と川の流れ",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "mountain_terrain", mainStage: "canyon", stageState: [] },
      world: { worldType: "", era: "", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["canyon_walls"], accents: [] },
      environment: { timeOfDay: "day", season: "", weather: "clear", phenomena: [] },
      lighting: { primarySource: "direct_sunlight", secondarySource: "none", direction: "side", quality: "crisp" },
      atmosphere: { colorTone: "warm", contrast: "high", mood: ["majestic", "wild"] },
      composition: { perspective: "", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "clear" },
      view: { vantage: "cliff", gaze: "down_diagonal", targets: ["main_stage", "lake_river"], distance: "far" },
    }),
  },
  {
    id: "haunted_hall", mode: "scene", group: "horror_ruin", label: "幽霊屋敷の廊下", description: "肖像画と蜘蛛の巣",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "indoor", category: "horror_interior", mainStage: "haunted_mansion", stageState: ["abandoned"] },
      world: { worldType: "", era: "victorian", architectureStyle: ["gothic"] },
      structures: { landmark: "spiral_staircase", secondary: ["ominous_portraits", "covered_furniture"], accents: ["cobwebs", "dust_layers"] },
      environment: { timeOfDay: "night", season: "", weather: "storm", phenomena: [] },
      lighting: { primarySource: "candlelight", secondarySource: "window_light", direction: "side", quality: "dramatic" },
      atmosphere: { colorTone: "desaturated", contrast: "high", mood: ["eerie", "tense"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "catacomb_candles", mode: "scene", group: "horror_ruin", label: "地下墓所", description: "棺と骨、揺れるろうそく",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "indoor", category: "horror_interior", mainStage: "catacombs", stageState: [] },
      world: { worldType: "", era: "medieval", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["bone_niches", "coffins"], accents: ["candles", "cobwebs"] },
      environment: { timeOfDay: "", season: "", weather: "", phenomena: ["dust"] },
      lighting: { primarySource: "candlelight", secondarySource: "none", direction: "scattered", quality: "dramatic" },
      atmosphere: { colorTone: "warm", contrast: "high", mood: ["eerie", "solemn"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "collapsed_city_dusk", mode: "scene", group: "horror_ruin", label: "崩壊都市", description: "廃車と遠くの火災",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "ruins", mainStage: "collapsed_city", stageState: ["abandoned"] },
      world: { worldType: "post_apocalyptic", era: "near_future", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["collapsed_buildings", "abandoned_vehicles", "barricades"], accents: ["debris", "faded_graffiti"] },
      environment: { timeOfDay: "dusk", season: "", weather: "cloudy", phenomena: ["smoke", "falling_ash"] },
      lighting: { primarySource: "fire_glow", secondarySource: "none", direction: "back", quality: "hazy" },
      atmosphere: { colorTone: "desaturated", contrast: "high", mood: ["desolate", "cinematic"] },
      composition: { perspective: "wide", depthLayers: "deep", density: "rich", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "shelter_red", mode: "scene", group: "horror_ruin", label: "非常灯のシェルター", description: "備蓄棚と赤い光",
    patch: scenePatch({
      subjectRelation: "character_focus",
      place: { environmentType: "indoor", category: "industrial", mainStage: "shelter_bunker", stageState: ["lived_in"] },
      world: { worldType: "post_apocalyptic", era: "near_future", architectureStyle: [] },
      structures: { landmark: "none", secondary: ["supply_shelves", "evacuation_signs", "wall_pipes"], accents: ["warning_tape"] },
      environment: { timeOfDay: "", season: "", weather: "", phenomena: [] },
      lighting: { primarySource: "emergency_red", secondarySource: "flashlight", direction: "scattered", quality: "dramatic" },
      atmosphere: { colorTone: "", contrast: "high", mood: ["tense"] },
      composition: { perspective: "eye_level", depthLayers: "moderate", density: "standard", fantasyEffects: [], blend: "soft_blur" },
    }),
  },
  {
    id: "neon_district_rain", mode: "scene", group: "scifi_special", label: "ネオン繁華街", description: "ホログラム広告と濡れた路面",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "outdoor", category: "cyber_city", mainStage: "neon_district", stageState: ["rainy"] },
      world: { worldType: "scifi", era: "near_future", architectureStyle: [] },
      structures: { landmark: "mega_billboard", secondary: ["holographic_ads", "led_billboards", "dense_cables"], accents: ["wet_ground", "neon_reflections"] },
      environment: { timeOfDay: "night", season: "", weather: "rain", phenomena: ["rain_haze"] },
      lighting: { primarySource: "neon", secondarySource: "none", direction: "scattered", quality: "diffused" },
      atmosphere: { colorTone: "blue_purple", contrast: "high", mood: ["cinematic"] },
      composition: { perspective: "eye_level", depthLayers: "deep", density: "intricate", fantasyEffects: [], blend: "atmospheric" },
    }),
  },
  {
    id: "multilevel_overlook", mode: "scene", group: "scifi_special", label: "多層高架都市の俯瞰", description: "高架と飛行車を見下ろす",
    patch: scenePatch({
      subjectRelation: "background_focus",
      place: { environmentType: "outdoor", category: "cyber_city", mainStage: "multilevel_city", stageState: [] },
      world: { worldType: "scifi", era: "far_future", architectureStyle: ["futuristic"] },
      structures: { landmark: "none", secondary: ["overpasses", "flying_cars", "holographic_ads"], accents: ["neon_reflections"] },
      environment: { timeOfDay: "night", season: "", weather: "", phenomena: ["rain_haze"] },
      lighting: { primarySource: "neon", secondarySource: "none", direction: "scattered", quality: "crisp" },
      atmosphere: { colorTone: "blue_purple", contrast: "high", mood: ["cinematic"] },
      composition: { perspective: "", depthLayers: "deep", density: "intricate", fantasyEffects: [], blend: "atmospheric" },
      view: { vantage: "rooftop", gaze: "down_diagonal", targets: ["main_stage"], distance: "far", frame: "railing", lens: "wide" },
    }),
  },
  {
    id: "magic_circle_room", mode: "scene", group: "fantasy_history", label: "魔法陣の間", description: "床に光る円環とルーン",
    patch: scenePatch({
      subjectRelation: "balanced",
      place: { environmentType: "indoor", category: "dungeon", mainStage: "magic_circle_chamber", stageState: ["ceremonial"] },
      world: { worldType: "fantasy", era: "medieval", architectureStyle: [] },
      structures: { landmark: "magic_circle", secondary: ["runes", "columns"], accents: ["candles"] },
      environment: { timeOfDay: "night", season: "", weather: "", phenomena: ["dust"] },
      lighting: { primarySource: "magic", secondarySource: "embers", direction: "scattered", quality: "dramatic" },
      atmosphere: { colorTone: "blue_purple", contrast: "high", mood: ["mysterious", "solemn"] },
      composition: { perspective: "high_angle", depthLayers: "moderate", density: "rich", fantasyEffects: ["ritual_rings"], blend: "atmospheric" },
    }),
  },
  // ===================== v2.0 追加：シンプル背景 =====================
  {
    id: "plain_white", mode: "simple", group: "recommended", label: "白背景", description: "LoRA・立ち絵向け",
    patch: simplePatch({ style: "plain", backgroundType: "solid", colors: { primary: "white", secondary: "", intensity: "very_light" }, rendering: ["flat"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "pink_purikura", mode: "simple", group: "recommended", label: "プリクラ風ピンク", description: "控えめなハートときらめき",
    patch: simplePatch({ style: "purikura", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "lavender", intensity: "soft" }, rendering: ["diagonal_gradient", "center_glow", "soft_glow"], decoration: { enabled: true, motifs: ["tiny_hearts", "subtle_sparkles"], placement: "", density: "" } }),
  },
  {
    id: "mint_soft", mode: "simple", group: "soft", label: "やわらかミント", description: "SNS・顔アップ向け",
    patch: simplePatch({ style: "soft", backgroundType: "soft_abstract", colors: { primary: "mint", secondary: "cream", intensity: "soft" }, rendering: ["subtle_variation", "center_glow", "gentle_blur"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "studio_gray", mode: "simple", group: "plain", label: "スタジオ風グレー", description: "端正でニュートラル",
    patch: simplePatch({ style: "plain", backgroundType: "studio", colors: { primary: "warm_gray", secondary: "white", intensity: "medium" }, rendering: ["vignette", "center_glow"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "pale_blue_gradient", mode: "simple", group: "soft", label: "淡いブルーグラデ", description: "軽やかな青の移ろい",
    patch: simplePatch({ style: "soft", backgroundType: "gradient", colors: { primary: "powder_blue", secondary: "white", intensity: "very_light" }, rendering: ["vertical_gradient", "center_glow", "gentle_blur"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "cream_solid", mode: "simple", group: "plain", label: "クリームの単色背景", description: "温かく控えめな無地",
    patch: simplePatch({ style: "plain", backgroundType: "solid", colors: { primary: "cream", secondary: "", intensity: "soft" }, rendering: ["flat", "subtle_variation"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "peach_purikura", mode: "simple", group: "purikura", label: "ピーチのプリクラ風", description: "小花を軽く添えたピーチ",
    patch: simplePatch({ subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "peach", secondary: "cream", intensity: "soft" }, rendering: ["radial_gradient", "center_glow"], decoration: { enabled: true, motifs: ["tiny_flowers"], placement: "", density: "" } }),
  },
  {
    id: "lavender_purikura", mode: "simple", group: "purikura", label: "ラベンダーのプリクラ風", description: "小さな星を控えめに配置",
    patch: simplePatch({ subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "lavender", secondary: "powder_blue", intensity: "soft" }, rendering: ["diagonal_gradient", "center_glow"], decoration: { enabled: true, motifs: ["small_stars"], placement: "", density: "" } }),
  },
  {
    id: "navy_studio", mode: "simple", group: "plain", label: "ネイビーのスタジオ背景", description: "深い色と中央の柔らかな光",
    patch: simplePatch({ style: "plain", backgroundType: "studio", colors: { primary: "deep_navy", secondary: "warm_gray", intensity: "dark" }, rendering: ["vignette", "center_glow"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "white_blue_soft", mode: "simple", group: "soft", label: "白と水色のソフト背景", description: "人物を包む淡い光",
    patch: simplePatch({ style: "soft", backgroundType: "soft_abstract", colors: { primary: "white", secondary: "powder_blue", intensity: "very_light" }, rendering: ["subtle_variation", "center_glow", "light_bloom"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "mint_grid", mode: "simple", group: "pattern", label: "ミントの格子柄", description: "細い格子で軽やかに",
    patch: simplePatch({ style: "plain", backgroundType: "pattern", pattern: "geometric_grid", colors: { primary: "mint", secondary: "white", intensity: "very_light" }, rendering: ["flat"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "seigaiha_navy", mode: "simple", group: "pattern", label: "青海波の和柄", description: "紺地に伝統文様",
    patch: simplePatch({ style: "plain", backgroundType: "pattern", pattern: "japanese_seigaiha", colors: { primary: "deep_navy", secondary: "gold", intensity: "deep" }, rendering: ["subtle_variation"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "cream_paper", mode: "simple", group: "pattern", label: "クリームの紙質感", description: "人物を邪魔しない紙の地",
    patch: simplePatch({ style: "soft", backgroundType: "texture", texture: "paper", colors: { primary: "cream", secondary: "", intensity: "soft" }, rendering: ["subtle_variation", "vignette"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "burgundy_velvet", mode: "simple", group: "pattern", label: "ボルドーのベルベット", description: "深い色と柔らかな艶",
    patch: simplePatch({ style: "plain", backgroundType: "texture", texture: "velvet", colors: { primary: "burgundy", secondary: "", intensity: "deep" }, rendering: ["vignette", "center_glow"], decoration: { enabled: false, motifs: [], placement: "", density: "" } }),
  },
  {
    id: "lace_ribbon_pink", mode: "simple", group: "purikura", label: "レースとリボンのピンク", description: "フチに沿った甘い装飾",
    patch: simplePatch({ subjectRelation: "character_focus", style: "purikura", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "white", intensity: "very_light" }, rendering: ["radial_gradient", "center_glow"], decoration: { enabled: true, motifs: ["lace_trim", "ribbons"], placement: "edges", density: "moderate" } }),
  },
  ...seasonalPresets(),
];

/**
 * v2.2 季節・イベントのプリセット（Manus提案20件をもとに整理）。
 * すべて人物重視・モチーフ1〜2種類・端か上側・まばら。似た配色が続かないように色と配置を散らしている。
 */
function seasonalPresets(): BackgroundPreset[] {
  type Values = Omit<Partial<BackgroundState["simple"]>, "decoration"> & { motifs: string[]; placement: string };
  const make = (id: string, group: SimplePresetGroup, label: string, description: string, eventTheme: string, designProfile: string, values: Values): BackgroundPreset => {
    const { motifs, placement, ...rest } = values;
    return { id, mode: "simple", group, label, description, patch: simplePatch({ subjectRelation: "character_focus", pattern: "", texture: "", ...rest, eventTheme, designProfile, decoration: { enabled: true, motifs, placement, density: "sparse" } }) };
  };
  return [
    // 季節
    make("sakura_milk", "season", "桜ミルクの記念日", "散る桜を上側に少量", "sakura", "pastel_pop", { style: "soft", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "cream", intensity: "very_light" }, rendering: ["diagonal_gradient", "center_glow", "gentle_blur"], motifs: ["scattered_cherry_blossom_petals"], placement: "upper" }),
    make("fresh_green_mint", "season", "新緑ミント", "若葉を四隅に置く軽い春", "fresh_green", "spring_botanical", { style: "soft", backgroundType: "soft_abstract", colors: { primary: "mint", secondary: "cream", intensity: "very_light" }, rendering: ["subtle_variation", "gentle_blur"], motifs: ["fresh_green_leaf_sprigs"], placement: "corners" }),
    make("summer_lantern_indigo", "season", "藍の夏祭り提灯", "藍の夜に小さな提灯だけ", "summer_festival", "festival_night", { style: "soft", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "gold", intensity: "dark" }, rendering: ["radial_gradient", "soft_glow", "light_bloom"], motifs: ["tiny_paper_lanterns"], placement: "upper" }),
    make("summer_firework_pop", "season", "桃色花火ポップ", "花火とうちわを四隅に", "summer_festival", "vivid_pop", { style: "purikura", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "peach", intensity: "medium" }, rendering: ["radial_gradient", "soft_glow"], motifs: ["tiny_firework_bursts", "tiny_uchiwa_fans"], placement: "corners" }),
    make("maple_cream", "season", "もみじクリーム", "紅葉をフチに、紙の地", "autumn_leaves", "autumn_harvest", { style: "soft", backgroundType: "texture", texture: "paper", colors: { primary: "cream", secondary: "burgundy", intensity: "very_light" }, rendering: ["subtle_variation", "vignette"], motifs: ["small_maple_leaves", "soft_dots"], placement: "edges" }),
    make("moon_pale_blue", "season", "淡い月夜のお月見", "月とススキを四隅に", "moon_viewing", "", { style: "soft", backgroundType: "gradient", colors: { primary: "powder_blue", secondary: "cream", intensity: "soft" }, rendering: ["vertical_gradient", "center_glow", "gentle_blur"], motifs: ["round_moon_ornament", "silver_grass_sprigs"], placement: "corners" }),
    make("snow_lavender", "season", "淡雪ラベンダー", "雪の結晶を四隅に少し", "winter_snow", "winter_crystal", { style: "soft", backgroundType: "gradient", colors: { primary: "lavender", secondary: "powder_blue", intensity: "very_light" }, rendering: ["vertical_gradient", "gentle_blur", "light_bloom"], motifs: ["snowflake_motifs"], placement: "corners" }),
    // 行事・記念日
    make("classic_christmas", "event", "クラシック・クリスマス", "ヒイラギとオーナメントを上端に", "christmas", "classic_holiday", { style: "plain", backgroundType: "texture", texture: "velvet", colors: { primary: "burgundy", secondary: "gold", intensity: "deep" }, rendering: ["vignette", "center_glow"], motifs: ["holly_sprigs", "bauble_ornaments"], placement: "upper" }),
    make("yume_christmas", "event", "ゆめかわクリスマス", "淡いラベンダーに結晶と玉飾り", "christmas", "yume_kawaii", { style: "purikura", backgroundType: "soft_abstract", colors: { primary: "lavender", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["center_glow", "gentle_blur", "light_bloom"], motifs: ["snowflake_motifs", "bauble_ornaments"], placement: "upper" }),
    make("pastel_halloween", "event", "パステルハロウィン", "黒を抑えたやわらかい秋", "halloween", "pastel_pop", { style: "purikura", backgroundType: "gradient", colors: { primary: "lavender", secondary: "peach", intensity: "soft" }, rendering: ["radial_gradient", "soft_glow"], motifs: ["smiling_jack_o_lantern", "tiny_bat_silhouettes"], placement: "upper" }),
    make("dark_halloween", "event", "ダークかわいいハロウィン", "暗い地にかぼちゃと黒猫", "halloween", "dark_kawaii", { style: "purikura", backgroundType: "gradient", colors: { primary: "black", secondary: "deep_navy", intensity: "dark" }, rendering: ["vignette", "center_glow", "soft_glow"], motifs: ["smiling_jack_o_lantern", "small_black_cat_silhouettes"], placement: "corners" }),
    make("valentine_lavender", "event", "ラベンダーのバレンタイン", "ハートとレースをフチに", "valentine", "yume_kawaii", { style: "purikura", backgroundType: "soft_abstract", colors: { primary: "lavender", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["center_glow", "gentle_blur", "light_bloom"], motifs: ["tiny_hearts", "lace_trim"], placement: "edges" }),
    make("white_day_candy", "event", "ホワイトデーのキャンディ", "白と水色の返礼スイーツ", "white_day", "candy_pastel", { style: "purikura", backgroundType: "gradient", colors: { primary: "white", secondary: "powder_blue", intensity: "very_light" }, rendering: ["diagonal_gradient", "center_glow"], motifs: ["tiny_wrapped_candy_motifs", "tiny_marshmallow_motifs"], placement: "corners" }),
    make("newyear_washi", "event", "和紙のお正月", "しめ縄だけを上側に", "new_year", "japanese_paper", { style: "plain", backgroundType: "texture", texture: "paper", colors: { primary: "cream", secondary: "gold", intensity: "very_light" }, rendering: ["subtle_variation"], motifs: ["shimenawa_rope_with_shide"], placement: "upper" }),
    make("tanabata_night", "event", "七夕の笹飾り", "笹と無地の短冊を上側に", "tanabata", "festival_night", { style: "soft", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "lavender", intensity: "dark" }, rendering: ["diagonal_gradient", "soft_glow"], motifs: ["bamboo_leaf_sprigs", "five_color_tanzaku_paper_strips"], placement: "upper" }),
    make("birthday_pennant", "event", "バースデーのペナント", "細いキャンドルと三角旗", "birthday", "pastel_pop", { style: "purikura", backgroundType: "gradient", colors: { primary: "cream", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["center_glow", "light_bloom"], motifs: ["tiny_triangular_pennant_bunting", "slim_lit_birthday_candles"], placement: "upper" }),
    make("school_sakura", "event", "桜の入学・卒業", "桜と無地の証書を四隅に", "school_milestone", "spring_botanical", { style: "soft", backgroundType: "gradient", colors: { primary: "white", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["vertical_gradient", "gentle_blur"], motifs: ["scattered_cherry_blossom_petals", "blank_diploma_scroll"], placement: "corners" }),
    // 海外・文化行事
    make("easter_egg_mint", "world", "ミントのイースター", "彩色卵と小花を四隅に", "easter", "yume_kawaii", { style: "purikura", backgroundType: "soft_abstract", colors: { primary: "mint", secondary: "cream", intensity: "very_light" }, rendering: ["center_glow", "gentle_blur"], motifs: ["painted_eggs", "tiny_flowers"], placement: "corners" }),
    make("lunar_new_year_red", "world", "春節の赤と金", "赤い提灯を上側に、文字なし", "lunar_new_year", "classic_holiday", { style: "plain", backgroundType: "gradient", colors: { primary: "burgundy", secondary: "gold", intensity: "deep" }, rendering: ["radial_gradient", "soft_glow"], motifs: ["small_red_chinese_lanterns"], placement: "upper" }),
    make("diwali_lamps", "world", "ディワリの灯り", "ディヤとランゴリをフチに", "diwali", "festival_night", { style: "soft", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "peach", intensity: "dark" }, rendering: ["center_glow", "soft_glow"], motifs: ["diya_lamps", "rangoli_motifs"], placement: "edges" }),
    make("pride_arc", "world", "淡色プライド・アーチ", "小さな虹を上側に1つ", "pride_month", "simple_elegant", { style: "soft", backgroundType: "solid", colors: { primary: "white", secondary: "", intensity: "very_light" }, rendering: ["subtle_variation"], motifs: ["small_rainbow_arc"], placement: "upper" }),
  ];
}

/** v1からある基本のモチーフ（イベントを選ばないときに並べる） */
export const basicMotifIds = ["tiny_hearts", "small_stars", "subtle_sparkles", "soft_dots", "tiny_flowers", "ribbons", "lace_trim", "tiny_bubbles", "little_clouds"];

export function optionById(list: Option[], id: string) {
  return list.find((item) => item.id === id);
}

export function optionsForGroup(list: Option[], group: string) {
  return list.filter((item) => item.group === group);
}
