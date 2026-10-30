/**
 * v2.4 試験機能：実画像テストの記録（端末内だけに保存。保存一覧・JSON書き出しとは別）
 *
 * 1枚の画像ごとに、生成先・背景キーワードの方式・人物指定の厚さ・seed と、6つの評価項目を残す。
 * 同じ条件の記録をまとめて数え、1枚の成功・失敗で方式を決めないようにする。
 */

export type LabModel = "tsubaki" | "pixai_sdxl" | "novelai" | "other";
export type PersonPrompt = "thin" | "rich" | "other";
export type LabCheckId = "person" | "face" | "decor" | "noFusion" | "size" | "season";

export const labModels: { id: LabModel; label: string }[] = [
  { id: "tsubaki", label: "PIXAI Tsubaki.2" },
  { id: "pixai_sdxl", label: "PIXAI SDXL系" },
  { id: "novelai", label: "NovelAI" },
  { id: "other", label: "その他" },
];
export const personPrompts: { id: PersonPrompt; label: string; example: string }[] = [
  { id: "thin", label: "人物指定：少なめ", example: "1boy" },
  { id: "rich", label: "人物指定：厚め", example: "1boy, solo, portrait, upper body, looking at viewer, casual clothes" },
  { id: "other", label: "その他", example: "" },
];
/** 「はい」が良い結果になるように並べる */
export const labChecks: { id: LabCheckId; label: string }[] = [
  { id: "person", label: "人物がいる" },
  { id: "face", label: "顔・頭部が正常" },
  { id: "decor", label: "背景に季節装飾がある" },
  { id: "noFusion", label: "衣装・髪・顔・目に混ざっていない" },
  { id: "size", label: "装飾が大きすぎない" },
  { id: "season", label: "季節感がある" },
];
/** 方式：A〜E は背景キーワード、T は Tsubaki 系など比較対象外の既定出力 */
export const labVariantCodes = ["A", "B", "C", "D", "E", "T"] as const;
export type LabVariantCode = (typeof labVariantCodes)[number];

export type LabRecord = {
  id: string;
  createdAt: string;
  model: LabModel;
  person: PersonPrompt;
  variant: LabVariantCode;
  decorForm: string;
  placeWording: string;
  eventTheme: string;
  seed: string;
  checks: Record<LabCheckId, boolean>;
  note: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const oneOf = <T extends string>(value: unknown, list: readonly T[], fallback: T): T => (typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback);
const text = (value: unknown, max = 200) => (typeof value === "string" ? value.slice(0, max) : "");

/** 端末に残った記録を読む。壊れた1件があっても他は残す */
export function parseLabRecords(raw: unknown): LabRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!isObject(item)) return [];
    const checks = isObject(item.checks) ? item.checks : {};
    return [{
      id: text(item.id, 80) || `lab-${index}`,
      createdAt: text(item.createdAt, 40) || new Date(0).toISOString(),
      model: oneOf(item.model, labModels.map((m) => m.id), "other"),
      person: oneOf(item.person, personPrompts.map((m) => m.id), "other"),
      variant: oneOf(item.variant, labVariantCodes, "A"),
      decorForm: text(item.decorForm, 40) || "default",
      placeWording: text(item.placeWording, 40) || "border",
      eventTheme: text(item.eventTheme, 60),
      seed: text(item.seed, 60),
      checks: Object.fromEntries(labChecks.map((check) => [check.id, checks[check.id] === true])) as Record<LabCheckId, boolean>,
      note: text(item.note, 500),
    }];
  });
}

export type LabSummary = { key: string; model: LabModel; variant: LabVariantCode; person: PersonPrompt; decorForm: string; placeWording: string; eventTheme: string; count: number; allGood: number; byCheck: Record<LabCheckId, number> };

/** 同じ条件（生成先・方式・人物指定・装飾の書き方・位置の書き方・イベント）ごとに数える */
export function summarizeLab(records: LabRecord[]): LabSummary[] {
  const groups = new Map<string, LabSummary>();
  for (const record of records) {
    const key = [record.model, record.variant, record.person, record.decorForm, record.placeWording, record.eventTheme].join("|");
    const group = groups.get(key) || { key, model: record.model, variant: record.variant, person: record.person, decorForm: record.decorForm, placeWording: record.placeWording, eventTheme: record.eventTheme, count: 0, allGood: 0, byCheck: Object.fromEntries(labChecks.map((check) => [check.id, 0])) as Record<LabCheckId, number> };
    group.count += 1;
    if (labChecks.every((check) => record.checks[check.id])) group.allGood += 1;
    for (const check of labChecks) if (record.checks[check.id]) group.byCheck[check.id] += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const csvCell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** 表計算ソフトで開けるCSV（先頭にBOMを付けるとExcelでも文字化けしない） */
export function labRecordsToCsv(records: LabRecord[], labelOf: { event: (id: string) => string } = { event: (id) => id }): string {
  const header = ["日時", "生成先", "人物指定", "方式", "装飾の書き方", "位置の書き方", "イベント", "seed", ...labChecks.map((check) => check.label), "メモ"];
  const rows = records.map((record) => [
    record.createdAt,
    labModels.find((m) => m.id === record.model)?.label || record.model,
    personPrompts.find((m) => m.id === record.person)?.label || record.person,
    record.variant,
    record.decorForm,
    record.placeWording,
    labelOf.event(record.eventTheme),
    record.seed,
    ...labChecks.map((check) => (record.checks[check.id] ? "○" : "×")),
    record.note,
  ]);
  return [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(",")).join("\n");
}
