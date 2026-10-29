/**
 * 季節・イベント装飾（v2.2）
 *
 * 4つの層を分けて持つ。
 * 1. SeasonalMotif  … 形・物体。一度だけ定義し、複数のイベントから参照する（雪の結晶は冬とクリスマスで共有）
 * 2. EventTheme     … 何の行事か。候補モチーフと、人物を邪魔しない既定（位置・量）だけを持つ。見た目は固定しない
 * 3. DesignProfile  … どういう見た目か。色・背景タイプ・質感の初期値。イベントとは独立
 * 4. 人物を邪魔しない判定は advisor.ts（端に寄せる・中央を空ける・競合する組み合わせ）
 *
 * 既存の9モチーフ（ハート・星・きらきら・ドット・小花・リボン・レース・しゃぼん玉・小さな雲）は複製せず、
 * EventTheme.reuse から既存IDのまま参照する。
 *
 * 英語表現はすべて「PIXAI・NovelAIでの実生成は未検証」（validation: "unverified"）。
 * 実画像で確かめたものから "tested" に書き換える。
 *
 * このファイルは background-data.ts から読み込まれるため、background-data.ts を実行時に import しない（循環を避ける）。
 */

export type Placement = "scattered" | "edges" | "corners" | "upper";

export type MotifFamily = "spring" | "summer" | "autumn" | "winter" | "celebration" | "world";

export type SeasonalMotif = {
  /** 保存データにも残る安定ID（変更しない） */
  id: string;
  label: string;
  /** 自然文向け。密度の語（sparse など）を前に付けても読めるよう、冠詞なしの複数形にする */
  en: string;
  /** タグ系向けの短い句。丸かっこはPIXAI（SD系）で強調として読まれるため使わない */
  tag: string;
  kw?: string;
  family: MotifFamily;
  /** 人物を邪魔しにくい置き場所。先頭がいちばんのおすすめ */
  prefer: Placement[];
  /** 同時に使うと見分けにくい・文化が混ざるモチーフ（既存IDも可） */
  conflicts?: string[];
  /** 文字・ロゴが入りやすい（ネガティブで「文字・ロゴ」を外すのがおすすめ） */
  textRisk?: boolean;
  /** 文化固有のモチーフ。別の文化の行事と自動では混ぜない */
  culture?: "japan" | "china" | "india";
  /** 画面に出す短い注意 */
  note?: string;
  validation: "unverified" | "tested";
};

export type EventGroup = "spring" | "summer" | "autumn" | "winter" | "allyear" | "world";

export type EventTheme = {
  id: string;
  label: string;
  kw?: string;
  group: EventGroup;
  period: string;
  /** このイベントのために追加したモチーフ */
  motifs: string[];
  /** 再利用する既存モチーフ（simpleData.motifs の元からあるID） */
  reuse: string[];
  /** イベントを選んだときに入れるおすすめ（1〜2種類） */
  starter: string[];
  /** 人物を邪魔しにくい既定の置き場所 */
  placement: Placement;
  /** おすすめの見た目（DesignProfile のID） */
  profiles: string[];
  /** 選んだときに見せる短い注意（文化・文字・配置） */
  note?: string;
};

export type DesignProfile = {
  id: string;
  label: string;
  description: string;
  /** 選んだときに上書きする見た目（装飾・人物との比重は変えない） */
  patch: {
    style: string;
    backgroundType: string;
    colors: { primary: string; secondary: string; intensity: string };
    rendering: string[];
    pattern?: string;
    texture?: string;
  };
  /** 既存の項目では表せない見た目の一言（自然文）。空なら出力に足さない */
  en: string;
  /** タグ系向け */
  tag: string;
  /** 装飾についての一言なので、モチーフがないときは出力しない */
  decorationOnly?: boolean;
};

const m = (id: string, label: string, en: string, tag: string, family: MotifFamily, prefer: Placement[], extra: Partial<SeasonalMotif> = {}): SeasonalMotif => ({ id, label, en, tag, family, prefer, validation: "unverified", ...extra });

/* ------------------------------------------------------------------ */
/* 1. 新規モチーフ（既存9件とは役割が重ならないものだけ）                     */
/* ------------------------------------------------------------------ */

export const seasonalMotifs: SeasonalMotif[] = [
  // 春
  m("scattered_cherry_blossom_petals", "桜の花びら", "scattered cherry blossom petals", "cherry blossoms, petals", "spring", ["upper", "edges", "corners"], { kw: "さくら 桜 はなびら 花見 はなみ" }),
  m("fresh_green_leaf_sprigs", "若葉の小枝", "small sprigs of fresh green leaves", "fresh green leaves, leaf sprigs", "spring", ["corners", "upper", "edges"], { kw: "わかば 新緑 しんりょく 葉 は" }),
  // 夏
  m("tiny_paper_lanterns", "提灯", "tiny Japanese paper lanterns", "paper lanterns", "summer", ["upper", "edges"], { kw: "ちょうちん 夏祭り なつまつり", culture: "japan", conflicts: ["small_red_chinese_lanterns"] }),
  m("tiny_firework_bursts", "花火", "tiny stylized firework bursts", "fireworks", "summer", ["upper", "corners"], { kw: "はなび 夏祭り", conflicts: ["small_stars", "subtle_sparkles"], note: "星・きらきらと一緒だと光の点が混ざりやすいので、花火だけがおすすめです。" }),
  m("tiny_uchiwa_fans", "うちわ", "tiny uchiwa fans", "uchiwa", "summer", ["corners", "edges"], { kw: "うちわ 団扇 夏", note: "人物が手に持つ小物として描かれることがあります。" }),
  m("bamboo_leaf_sprigs", "笹", "slender bamboo grass sprigs", "bamboo leaves", "summer", ["upper", "edges", "corners"], { kw: "ささ 笹 たなばた 七夕 竹" }),
  m("five_color_tanzaku_paper_strips", "短冊", "blank five-color tanzaku paper strips", "tanzaku", "summer", ["upper", "edges"], { kw: "たんざく 七夕", textRisk: true }),
  // 秋
  m("small_maple_leaves", "もみじ", "small red maple leaves", "maple leaves, autumn leaves", "autumn", ["edges", "corners", "upper"], { kw: "もみじ 紅葉 こうよう 葉" }),
  m("round_moon_ornament", "月", "small round moon motifs", "moon", "autumn", ["upper", "corners"], { kw: "つき 月 お月見 おつきみ 十五夜 満月" }),
  m("silver_grass_sprigs", "ススキ", "slender Japanese silver grass sprigs", "silver grass", "autumn", ["edges", "corners"], { kw: "すすき ススキ 芒 お月見", note: "ススキは英語で Japanese silver grass。pampas grass は別の植物です。" }),
  m("tsukimi_dango", "月見団子", "small stacks of white tsukimi dango", "tsukimi dango", "autumn", ["corners"], { kw: "つきみだんご 団子 だんご お月見" }),
  m("smiling_jack_o_lantern", "ジャック・オ・ランタン", "small smiling jack-o'-lanterns", "jack-o'-lantern", "autumn", ["corners", "upper"], { kw: "じゃっくおらんたん かぼちゃ カボチャ ハロウィン" }),
  m("tiny_bat_silhouettes", "コウモリ", "tiny bat silhouettes", "tiny bats, silhouette", "autumn", ["upper", "edges"], { kw: "こうもり 蝙蝠 ハロウィン" }),
  m("small_black_cat_silhouettes", "黒猫", "small black cat silhouettes", "black cat silhouette", "autumn", ["corners"], { kw: "くろねこ 猫 ねこ ハロウィン", note: "大きく描かれると人物のペットのように見えることがあります。まばらがおすすめです。" }),
  // 冬
  m("snowflake_motifs", "雪の結晶", "six-branched snowflake motifs", "snowflakes", "winter", ["corners", "upper", "scattered"], { kw: "ゆきのけっしょう 雪 ゆき 冬 結晶", conflicts: ["small_stars"] }),
  m("icicle_trim", "つらら", "short icicle trim", "icicles", "winter", ["upper", "edges"], { kw: "つらら 氷 こおり 冬", conflicts: ["lace_trim"] }),
  m("holly_sprigs", "ヒイラギ", "small holly sprigs with red berries", "holly", "winter", ["corners", "upper"], { kw: "ひいらぎ 柊 クリスマス" }),
  m("bauble_ornaments", "オーナメント", "tiny round bauble ornaments", "christmas ornaments", "winter", ["upper", "edges"], { kw: "おーなめんと クリスマス 飾り 玉" }),
  m("shimenawa_rope_with_shide", "しめ縄", "shimenawa rope trim with zigzag paper streamers", "shimenawa, shide", "winter", ["upper"], { kw: "しめなわ 注連縄 紙垂 しで お正月 正月", culture: "japan", conflicts: ["small_kadomatsu"], note: "しめ縄は上側、門松は四隅向きです。置く場所は全体で1つなので、どちらか1つがおすすめです。" }),
  m("small_kadomatsu", "門松", "small kadomatsu ornaments of pine and bamboo", "kadomatsu", "winter", ["corners"], { kw: "かどまつ 門松 お正月 正月", culture: "japan", conflicts: ["shimenawa_rope_with_shide"] }),
  // お祝い・通年
  m("tiny_wrapped_candy_motifs", "キャンディ", "tiny wrapped candy motifs", "wrapped candy", "celebration", ["corners", "scattered"], { kw: "きゃんでぃ あめ 飴 ホワイトデー お菓子" }),
  m("tiny_marshmallow_motifs", "マシュマロ", "tiny marshmallow motifs", "marshmallow", "celebration", ["corners"], { kw: "ましゅまろ ホワイトデー お菓子", conflicts: ["little_clouds"], note: "小さな雲と一緒だと見分けにくくなります。" }),
  m("slim_lit_birthday_candles", "キャンドル", "slim lit birthday candles", "candles", "celebration", ["upper", "corners"], { kw: "きゃんどる ろうそく 誕生日 たんじょうび バースデー", textRisk: true, note: "ケーキや文字入りカードに寄ることがあります。" }),
  m("tiny_triangular_pennant_bunting", "ペナント", "tiny triangular pennant bunting", "bunting, pennant", "celebration", ["upper"], { kw: "ぺなんと ガーランド 三角旗 誕生日 パーティー", textRisk: true }),
  m("tiny_paper_confetti_pieces", "紙吹雪", "tiny paper confetti pieces", "confetti", "celebration", ["upper", "edges", "scattered"], { kw: "かみふぶき 紙ふぶき お祝い パーティー" }),
  m("blank_diploma_scroll", "卒業証書", "small blank diploma scrolls", "diploma", "celebration", ["corners"], { kw: "そつぎょうしょうしょ 卒業 そつぎょう 証書", textRisk: true }),
  // 海外・文化行事
  m("painted_eggs", "イースターエッグ", "small pastel painted eggs", "easter egg", "world", ["corners"], { kw: "いーすたー たまご 卵 エッグ" }),
  m("small_red_chinese_lanterns", "赤い提灯（春節）", "small red Chinese lanterns with gold tassels", "red lantern, chinese lantern", "world", ["upper", "corners"], { kw: "あかいちょうちん 春節 しゅんせつ 旧正月", culture: "china", conflicts: ["tiny_paper_lanterns"] }),
  m("small_red_chinese_knot_ornaments", "中国結び", "small red Chinese knot ornaments", "chinese knot", "world", ["edges", "corners"], { kw: "ちゅうごくむすび 結び 春節", culture: "china", note: "髪飾りやアクセサリーとして描かれることがあります。" }),
  m("diya_lamps", "ディヤ（灯明）", "small diya oil lamps with soft flames", "diya, oil lamp", "world", ["edges", "corners"], { kw: "でぃや ランプ 灯り ディワリ", culture: "india" }),
  m("rangoli_motifs", "ランゴリ模様", "small symmetrical rangoli motifs", "rangoli", "world", ["corners", "edges"], { kw: "らんごり 模様 ディワリ", culture: "india" }),
  m("small_rainbow_arc", "小さな虹", "small rainbow arc motifs", "rainbow", "world", ["upper", "corners"], { kw: "にじ 虹 レインボー プライド" }),
];

export const motifFamilies: { id: MotifFamily; label: string }[] = [
  { id: "spring", label: "春" },
  { id: "summer", label: "夏" },
  { id: "autumn", label: "秋" },
  { id: "winter", label: "冬・お正月" },
  { id: "celebration", label: "お祝い・記念日" },
  { id: "world", label: "海外・文化行事" },
];

/* ------------------------------------------------------------------ */
/* 2. 季節・イベント                                                    */
/* ------------------------------------------------------------------ */

const TEXT_NOTE = "文字が入りやすいモチーフがあります。ネガティブの「文字・ロゴ」を入れると安定します。";

export const eventThemes: EventTheme[] = [
  // 春
  { id: "sakura", label: "桜", kw: "さくら はなみ 花見 春", group: "spring", period: "3〜4月", motifs: ["scattered_cherry_blossom_petals"], reuse: ["tiny_flowers", "subtle_sparkles"], starter: ["scattered_cherry_blossom_petals"], placement: "upper", profiles: ["pastel_pop", "yume_kawaii", "spring_botanical", "simple_elegant"] },
  { id: "fresh_green", label: "新緑", kw: "しんりょく わかば 若葉 春 初夏", group: "spring", period: "4〜5月", motifs: ["fresh_green_leaf_sprigs"], reuse: ["tiny_flowers", "soft_dots"], starter: ["fresh_green_leaf_sprigs"], placement: "corners", profiles: ["spring_botanical", "pastel_pop", "simple_elegant"] },
  { id: "school_milestone", label: "入学・卒業", kw: "にゅうがく そつぎょう 入学式 卒業式", group: "spring", period: "3〜4月", motifs: ["scattered_cherry_blossom_petals", "blank_diploma_scroll"], reuse: ["tiny_flowers", "ribbons"], starter: ["scattered_cherry_blossom_petals", "ribbons"], placement: "corners", profiles: ["spring_botanical", "celebration_clean", "simple_elegant"], note: "卒業をはっきり見せたいときだけ「卒業証書」を足してください。" + TEXT_NOTE },
  { id: "white_day", label: "ホワイトデー", kw: "ほわいとでー 3月14日", group: "spring", period: "3月14日", motifs: ["tiny_wrapped_candy_motifs", "tiny_marshmallow_motifs"], reuse: ["ribbons", "tiny_hearts"], starter: ["tiny_wrapped_candy_motifs", "ribbons"], placement: "corners", profiles: ["candy_pastel", "pastel_pop", "holographic_sparkle"] },
  // 夏
  { id: "tanabata", label: "七夕", kw: "たなばた 星祭り ほしまつり 7月7日", group: "summer", period: "7月7日（地域により8月）", motifs: ["bamboo_leaf_sprigs", "five_color_tanzaku_paper_strips"], reuse: ["small_stars"], starter: ["bamboo_leaf_sprigs", "five_color_tanzaku_paper_strips"], placement: "upper", profiles: ["festival_night", "japanese_paper", "yume_kawaii"], note: "短冊は文字なしの紙として出力します。" + TEXT_NOTE },
  { id: "summer_festival", label: "夏祭り", kw: "なつまつり 花火 はなび 縁日", group: "summer", period: "7〜8月", motifs: ["tiny_paper_lanterns", "tiny_firework_bursts", "tiny_uchiwa_fans"], reuse: [], starter: ["tiny_paper_lanterns"], placement: "upper", profiles: ["festival_night", "vivid_pop", "retro_pop", "sticker_seal"] },
  // 秋
  { id: "autumn_leaves", label: "紅葉", kw: "こうよう もみじ 秋", group: "autumn", period: "10〜12月", motifs: ["small_maple_leaves"], reuse: ["soft_dots"], starter: ["small_maple_leaves"], placement: "edges", profiles: ["autumn_harvest", "japanese_paper", "retro_pop"] },
  { id: "moon_viewing", label: "お月見", kw: "おつきみ 十五夜 じゅうごや 月", group: "autumn", period: "9〜10月頃（十五夜）", motifs: ["round_moon_ornament", "silver_grass_sprigs", "tsukimi_dango"], reuse: ["little_clouds", "small_stars"], starter: ["round_moon_ornament", "silver_grass_sprigs"], placement: "corners", profiles: ["simple_elegant", "japanese_paper", "festival_night"] },
  { id: "halloween", label: "ハロウィン", kw: "はろうぃん 10月31日 かぼちゃ", group: "autumn", period: "10月31日", motifs: ["smiling_jack_o_lantern", "tiny_bat_silhouettes", "small_black_cat_silhouettes"], reuse: ["small_stars"], starter: ["smiling_jack_o_lantern", "tiny_bat_silhouettes"], placement: "corners", profiles: ["dark_kawaii", "pastel_pop", "vivid_pop", "retro_pop", "sticker_seal"] },
  // 冬
  { id: "winter_snow", label: "冬・雪", kw: "ふゆ ゆき 雪 冬", group: "winter", period: "12〜2月", motifs: ["snowflake_motifs", "icicle_trim"], reuse: ["subtle_sparkles"], starter: ["snowflake_motifs"], placement: "corners", profiles: ["winter_crystal", "holographic_sparkle", "dark_kawaii"] },
  { id: "christmas", label: "クリスマス", kw: "くりすます 12月25日 ホリデー", group: "winter", period: "12月", motifs: ["holly_sprigs", "bauble_ornaments", "snowflake_motifs"], reuse: ["subtle_sparkles", "ribbons", "small_stars"], starter: ["holly_sprigs", "bauble_ornaments"], placement: "upper", profiles: ["classic_holiday", "pastel_pop", "dark_kawaii", "simple_elegant", "yume_kawaii", "sticker_seal", "winter_crystal"] },
  { id: "new_year", label: "お正月", kw: "おしょうがつ 正月 新年 しんねん 元日", group: "winter", period: "12月末〜1月上旬", motifs: ["shimenawa_rope_with_shide", "small_kadomatsu"], reuse: ["tiny_flowers"], starter: ["shimenawa_rope_with_shide"], placement: "upper", profiles: ["japanese_paper", "simple_elegant", "classic_holiday"], note: "しめ縄は上側、門松は四隅向きです。置く場所は全体で1つなので、どちらか1つがおすすめです。" },
  { id: "valentine", label: "バレンタイン", kw: "ばれんたいん 2月14日", group: "winter", period: "2月14日", motifs: [], reuse: ["tiny_hearts", "lace_trim", "ribbons"], starter: ["tiny_hearts", "lace_trim"], placement: "edges", profiles: ["pastel_pop", "yume_kawaii", "candy_pastel", "classic_holiday", "simple_elegant"] },
  // 通年
  { id: "birthday", label: "誕生日・記念日", kw: "たんじょうび バースデー 記念日 きねんび お祝い", group: "allyear", period: "通年", motifs: ["slim_lit_birthday_candles", "tiny_triangular_pennant_bunting", "tiny_paper_confetti_pieces"], reuse: ["subtle_sparkles", "ribbons"], starter: ["tiny_triangular_pennant_bunting", "slim_lit_birthday_candles"], placement: "upper", profiles: ["celebration_clean", "pastel_pop", "retro_pop", "sticker_seal", "holographic_sparkle"], note: TEXT_NOTE },
  // 海外・文化行事（別パック扱い。ほかの文化の記号を自動では混ぜない）
  { id: "easter", label: "イースター", kw: "いーすたー 復活祭 春", group: "world", period: "春（年により移動）", motifs: ["painted_eggs"], reuse: ["tiny_flowers"], starter: ["painted_eggs", "tiny_flowers"], placement: "corners", profiles: ["pastel_pop", "yume_kawaii", "sticker_seal", "spring_botanical"] },
  { id: "lunar_new_year", label: "春節", kw: "しゅんせつ 旧正月 ルナニューイヤー", group: "world", period: "1〜2月頃（旧暦の新年）", motifs: ["small_red_chinese_lanterns", "small_red_chinese_knot_ornaments"], reuse: [], starter: ["small_red_chinese_lanterns"], placement: "upper", profiles: ["classic_holiday", "simple_elegant"], note: "春節の飾りだけにしています。日本の提灯・正月飾りとは混ぜず、文字の入る飾り（春聯・福の字）は入れていません。" },
  { id: "diwali", label: "ディワリ", kw: "でぃわり ディーパバリ 光の祭り", group: "world", period: "10〜11月頃", motifs: ["diya_lamps", "rangoli_motifs"], reuse: ["tiny_flowers"], starter: ["diya_lamps"], placement: "edges", profiles: ["festival_night", "dark_kawaii"], note: "宗教的な行事です。神像や宗教画は入れず、灯り（ディヤ）と模様（ランゴリ）だけにしています。" },
  { id: "pride_month", label: "プライド月間", kw: "ぷらいど 6月 レインボー", group: "world", period: "6月", motifs: ["small_rainbow_arc"], reuse: ["tiny_hearts", "subtle_sparkles"], starter: ["small_rainbow_arc"], placement: "upper", profiles: ["simple_elegant", "celebration_clean", "holographic_sparkle"], note: "虹は小さなアーチ1つから。旗・文字・ロゴは入れていません。" },
];

export const eventGroups: { id: EventGroup; label: string }[] = [
  { id: "spring", label: "春" },
  { id: "summer", label: "夏" },
  { id: "autumn", label: "秋" },
  { id: "winter", label: "冬" },
  { id: "allyear", label: "通年" },
  { id: "world", label: "海外" },
];

/* ------------------------------------------------------------------ */
/* 3. デザインのテイスト（イベントとは独立）                               */
/* ------------------------------------------------------------------ */

export const designProfiles: DesignProfile[] = [
  { id: "pastel_pop", label: "パステルポップ", description: "淡いピンクとクリーム", patch: { style: "purikura", backgroundType: "gradient", colors: { primary: "pastel_pink", secondary: "cream", intensity: "very_light" }, rendering: ["diagonal_gradient", "center_glow", "gentle_blur"] }, en: "", tag: "" },
  { id: "vivid_pop", label: "ビビッドポップ", description: "濃い地に明るい差し色", patch: { style: "purikura", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "peach", intensity: "medium" }, rendering: ["radial_gradient", "soft_glow"] }, en: "bright pop accent colors", tag: "colorful" },
  { id: "yume_kawaii", label: "ゆめかわ", description: "ラベンダーの淡い光", patch: { style: "purikura", backgroundType: "soft_abstract", colors: { primary: "lavender", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["center_glow", "gentle_blur", "light_bloom"] }, en: "a dreamy iridescent pastel sheen", tag: "pastel colors, dreamy" },
  { id: "retro_pop", label: "レトロポップ", description: "水玉と温かい色", patch: { style: "purikura", backgroundType: "pattern", pattern: "polka_dots", colors: { primary: "peach", secondary: "cream", intensity: "medium" }, rendering: ["flat", "subtle_variation"] }, en: "a retro print feel", tag: "retro style" },
  { id: "holographic_sparkle", label: "ホログラム", description: "水色とラベンダーの反射", patch: { style: "purikura", backgroundType: "gradient", colors: { primary: "powder_blue", secondary: "lavender", intensity: "soft" }, rendering: ["diagonal_gradient", "soft_glow", "light_bloom"] }, en: "a subtle holographic shimmer", tag: "holographic" },
  { id: "simple_elegant", label: "シンプルで上品", description: "クリームに金を少し", patch: { style: "plain", backgroundType: "solid", colors: { primary: "cream", secondary: "gold", intensity: "very_light" }, rendering: ["subtle_variation", "vignette"] }, en: "", tag: "" },
  { id: "dark_kawaii", label: "ダークかわいい", description: "濃紺に淡い差し色", patch: { style: "purikura", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "lavender", intensity: "dark" }, rendering: ["vignette", "center_glow", "soft_glow"] }, en: "soft pastel accents against the dark backdrop", tag: "" },
  { id: "sticker_seal", label: "ステッカー風", description: "白地にシール風の装飾", patch: { style: "purikura", backgroundType: "solid", colors: { primary: "white", secondary: "pastel_pink", intensity: "very_light" }, rendering: ["flat"] }, en: "decorations drawn as sticker-like cutouts with white outlines", tag: "sticker, white outline", decorationOnly: true },
  { id: "japanese_paper", label: "和紙・和モダン", description: "紙の質感に金", patch: { style: "plain", backgroundType: "texture", texture: "paper", colors: { primary: "cream", secondary: "gold", intensity: "very_light" }, rendering: ["subtle_variation"] }, en: "a washi paper feel", tag: "washi" },
  { id: "festival_night", label: "夜祭りの灯り", description: "紺に暖かな光", patch: { style: "soft", backgroundType: "gradient", colors: { primary: "deep_navy", secondary: "gold", intensity: "dark" }, rendering: ["radial_gradient", "soft_glow", "light_bloom"] }, en: "a warm lantern-like glow", tag: "warm glow" },
  { id: "winter_crystal", label: "氷晶・淡雪", description: "水色と白の澄んだ冬", patch: { style: "soft", backgroundType: "gradient", colors: { primary: "powder_blue", secondary: "white", intensity: "very_light" }, rendering: ["vertical_gradient", "gentle_blur", "light_bloom"] }, en: "a faint frosted shimmer", tag: "frost" },
  { id: "candy_pastel", label: "キャンディパステル", description: "白とミントの甘い色", patch: { style: "purikura", backgroundType: "gradient", colors: { primary: "white", secondary: "mint", intensity: "very_light" }, rendering: ["diagonal_gradient", "center_glow"] }, en: "a glossy candy-like sheen", tag: "candy colors" },
  { id: "classic_holiday", label: "クラシックホリデー", description: "ボルドーのベルベットに金", patch: { style: "plain", backgroundType: "texture", texture: "velvet", colors: { primary: "burgundy", secondary: "gold", intensity: "deep" }, rendering: ["vignette", "center_glow"] }, en: "subtle gold foil accents", tag: "gold trim" },
  { id: "spring_botanical", label: "植物の淡彩", description: "セージとクリームの淡い地", patch: { style: "soft", backgroundType: "soft_abstract", colors: { primary: "sage", secondary: "cream", intensity: "very_light" }, rendering: ["subtle_variation", "gentle_blur"] }, en: "", tag: "" },
  { id: "autumn_harvest", label: "秋色の紙もの", description: "クリームの紙にボルドー", patch: { style: "plain", backgroundType: "texture", texture: "paper", colors: { primary: "cream", secondary: "burgundy", intensity: "very_light" }, rendering: ["subtle_variation", "vignette"] }, en: "", tag: "" },
  { id: "celebration_clean", label: "クリーンなお祝い", description: "白いスタジオ地", patch: { style: "plain", backgroundType: "studio", colors: { primary: "white", secondary: "powder_blue", intensity: "very_light" }, rendering: ["flat", "center_glow"] }, en: "", tag: "" },
];

/* ------------------------------------------------------------------ */
/* 補助                                                                */
/* ------------------------------------------------------------------ */

export const seasonalMotifIds = new Set(seasonalMotifs.map((item) => item.id));
export const isSeasonalMotif = (id: string) => seasonalMotifIds.has(id);
export const seasonalMotifById = (id: string) => seasonalMotifs.find((item) => item.id === id);
export const eventById = (id: string | undefined) => (id ? eventThemes.find((item) => item.id === id) : undefined);
export const profileById = (id: string | undefined) => (id ? designProfiles.find((item) => item.id === id) : undefined);

/** イベントのおすすめモチーフ（新規 → 既存の順） */
export const eventMotifIds = (event: EventTheme) => [...event.motifs, ...event.reuse];

/**
 * Manus提案データのIDを、実装の正規IDへ読み替える表（記録と、提案JSONを読み込むときのため）。
 * 左が提案データ側、右が実装側。
 */
export const proposalIdAliases: Record<string, string> = {
  // 既存モチーフ（英語句をIDにしていたもの）
  tiny_floral_motifs: "tiny_flowers",
  tiny_heart_motifs: "tiny_hearts",
  small_star_motifs: "small_stars",
  soft_dot_accents: "soft_dots",
  delicate_ribbon_motifs: "ribbons",
  lace_trim_details: "lace_trim",
  // 提案JSONとCSVで食い違っていたもの
  tiny_japanese_festival_paper_lanterns: "tiny_paper_lanterns",
  // 英語の誤り・言い換え
  pampas_grass_sprigs: "silver_grass_sprigs",
  stacked_white_rice_dumplings: "tsukimi_dango",
  small_kadomatsu_pine_and_bamboo: "small_kadomatsu",
  // イベントID
  "spring-cherry-fresh-greenery": "sakura",
  "summer-festival-night": "summer_festival",
  autumn_foliage: "autumn_leaves",
  "otsukimi-simple-pop": "moon_viewing",
  "winter-snow-ice": "winter_snow",
  "halloween-simple-pop": "halloween",
  "christmas-winter-holidays-simple-pop": "christmas",
  "valentines-day-simple-pop": "valentine",
  "white-day": "white_day",
  new_year_japan_simple_pop: "new_year",
  "tanabata-simple-pop": "tanabata",
  "birthday-anniversary-candle-bunting-confetti": "birthday",
  "school-milestone-sakura": "school_milestone",
  lunar_new_year_spring_festival_simple_pop: "lunar_new_year",
  // ネガティブ：logo は独立項目ではなく「文字・ロゴ（text）」に含まれる
  logo: "text",
};
