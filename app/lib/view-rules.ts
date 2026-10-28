import { optionById, sceneData } from "./background-data.ts";
import type { BackgroundState } from "./background-data.ts";
import { altitudeByVantage, dynamicMotions, viewData } from "./view-data.ts";
import type { ViewLevel, ViewState } from "./view-data.ts";

/**
 * 見え方の矛盾制御。
 * - disabled : 明らかに成立しない組み合わせ。ボタンを非活性にし、理由を日本語で返す
 * - warning  : 成立はするが特殊な組み合わせ。出力はそのまま行い、注意だけ出す
 * - ignored  : 保存されている値が今の設定では使えない状態。値は消さず、出力からだけ外す
 *
 * どの場合も、利用者の選んだ値を勝手に別の値へ書き換えない。
 */

export type ViewNotice = { id: string; kind: "ignored" | "warning"; text: string };
type ReasonMap = Record<string, string>;
export type ViewAvailability = {
  disabled: { vantage: ReasonMap; gaze: ReasonMap; motion: ReasonMap; altitude: ReasonMap };
  altitudeActive: boolean;
  effectsActive: boolean;
  /** 出力に使う見え方。標準の見え方なら null */
  active: ViewState | null;
  notices: ViewNotice[];
};

export function stageProfile(state: BackgroundState) {
  const stage = optionById(sceneData.stages, state.scene.place.mainStage);
  const category = optionById(sceneData.categories, stage?.group || state.scene.place.category);
  const env = category?.group || state.scene.place.environmentType;
  const underwater = category?.id === "underwater";
  const water = underwater || category?.id === "waterfront";
  const fantasy = state.scene.world.worldType === "fantasy" || env === "special";
  return { stage, category, env, underwater, water, fantasy, indoor: env === "indoor" };
}

const levelOf = (vantage: string): ViewLevel => viewData.vantages.find((item) => item.id === vantage)?.level || "ground";
const label = (list: { id: string; label: string }[], id: string) => list.find((item) => item.id === id)?.label || id;

const INDOOR_BLOCKED = ["street", "cliff", "bridge", "ship", "low_air", "sky", "above_clouds"];
const LEVEL_FOR_STRAIGHT_DOWN_BLOCK: ViewLevel[] = ["ground", "interior"];

export function getViewAvailability(state: BackgroundState): ViewAvailability {
  const view = state.scene.view;
  const profile = stageProfile(state);
  const disabled: ViewAvailability["disabled"] = { vantage: {}, gaze: {}, motion: {}, altitude: {} };
  const notices: ViewNotice[] = [];

  // ---- どこから見る？ ----
  if (!profile.water && !profile.fantasy) disabled.vantage.underwater = "水辺・海中の舞台で選べます";
  if (profile.underwater) {
    disabled.vantage.ground = "海中の舞台では地上からの視点は使えません";
    disabled.vantage.street = "海中の舞台では道路からの視点は使えません";
  }
  if (profile.indoor) for (const id of INDOOR_BLOCKED) disabled.vantage[id] = "屋内の舞台です。外を見るなら「窓辺」「バルコニー」から";

  const vantageBlocked = Boolean(disabled.vantage[view.vantage]);
  const fallbackVantage = profile.underwater ? "underwater" : profile.indoor ? "interior" : "ground";
  const vantage = vantageBlocked ? fallbackVantage : view.vantage;
  const level = levelOf(vantage);

  // ---- 高さ ----
  const allowedAltitudes = altitudeByVantage[vantage] || [];
  const altitudeActive = allowedAltitudes.length > 0;
  for (const item of viewData.altitudes) {
    if (!item.id) continue;
    if (!allowedAltitudes.includes(item.id)) disabled.altitude[item.id] = altitudeActive ? "この位置では選べない高さです" : "空中の視点でだけ使います";
  }

  // ---- どの方向を見る？ ----
  if (LEVEL_FOR_STRAIGHT_DOWN_BLOCK.includes(level)) disabled.gaze.straight_down = "地上や室内からは「足元を見る」を使います";
  if (level === "aerial") disabled.gaze.feet = "空中では足元に地面がありません（「真下を見る」を使います）";

  // ---- 動き ----
  if (level === "underwater") {
    disabled.motion.falling = "水中では「降下中」を使います";
    disabled.motion.flying = "水中では「浮遊中」「移動中」を使います";
    disabled.motion.gliding = "水中では「浮遊中」「移動中」を使います";
  } else if (level !== "elevated" && level !== "aerial") {
    disabled.motion.falling = "落下には、高台・塔・空中など高さのある位置が必要です";
  }

  if (view.mode !== "custom") {
    return { disabled, altitudeActive, effectsActive: false, active: null, notices };
  }

  // ---- 使えなくなった値は出力から外し、理由を伝える ----
  if (vantageBlocked) notices.push({ id: "ignored-vantage", kind: "ignored", text: `見る位置「${label(viewData.vantages, view.vantage)}」は今の舞台では使えないため、「${label(viewData.vantages, vantage)}」として出力しています。` });
  let altitude = view.altitude;
  if (altitude && disabled.altitude[altitude]) {
    notices.push({ id: "ignored-altitude", kind: "ignored", text: `高さ「${label(viewData.altitudes, altitude)}」は${altitudeActive ? "この位置では選べない" : "空中の視点でだけ使う"}ため、出力していません。` });
    altitude = "";
  }
  let gaze = view.gaze;
  if (disabled.gaze[gaze]) {
    notices.push({ id: "ignored-gaze", kind: "ignored", text: `視線「${label(viewData.gazes, gaze)}」は今の位置では使えないため、正面として出力しています。` });
    gaze = "forward";
  }
  let motion = view.motion;
  if (disabled.motion[motion]) {
    notices.push({ id: "ignored-motion", kind: "ignored", text: `動き「${label(viewData.motions, motion)}」は今の位置では使えないため、出力していません。` });
    motion = "still";
  }
  const effectsActive = dynamicMotions.includes(motion);
  const motionEffects = effectsActive ? view.motionEffects : [];
  if (!effectsActive && view.motionEffects.length) notices.push({ id: "ignored-effects", kind: "ignored", text: "動きの演出は、動きが「静止」のあいだは出力しません。" });

  // ---- 成立するが特殊な組み合わせ（警告のみ） ----
  if (view.vantage === "underwater" && !profile.water && profile.fantasy && !vantageBlocked) notices.push({ id: "fantasy-underwater", kind: "warning", text: "水辺でない舞台を水中から見る設定です。幻想的な表現として出力します。" });
  if (vantage === "ship" && !profile.water) notices.push({ id: "ship-dry", kind: "warning", text: "船上からの視点ですが、舞台が水辺ではありません。見えるものに「海」や「港町」を加えると自然です。" });
  if ((motion === "flying" || motion === "gliding") && level === "interior") notices.push({ id: "indoor-flight", kind: "warning", text: "屋内を飛ぶ視点です。幻想的な場面として扱われやすくなります。" });
  if (view.targets.includes("seafloor") && level !== "underwater" && level !== "surface") notices.push({ id: "seafloor-dry", kind: "warning", text: "海底は、水中や船上から見ると自然です。" });
  if (view.targets.includes("water_surface") && level === "underwater" && (gaze === "down_diagonal" || gaze === "straight_down")) notices.push({ id: "surface-below", kind: "warning", text: "水中から見ると水面は上にあります。視線を上向きにすると自然です。" });
  if (level === "aerial" && gaze === "straight_up" && !view.targets.every((id) => id === "sky_clouds")) notices.push({ id: "aerial-up", kind: "warning", text: "空中から真上を見ると、地上の景色はほとんど写りません。" });
  if (view.frame === "water_surface" && level !== "underwater" && level !== "surface") notices.push({ id: "frame-water", kind: "warning", text: "「水面越し」は水中か船上から見るときに自然です。" });
  if (view.frame === "window" && level === "aerial") notices.push({ id: "aerial-window", kind: "warning", text: "空中で窓越しの設定です。乗り物や飛行船の窓として描かれやすくなります。" });

  return {
    disabled,
    altitudeActive,
    effectsActive,
    notices,
    active: {
      ...view,
      vantage,
      altitude,
      gaze,
      motion,
      motionEffects,
      frameDetail: view.frame === "window" ? view.frameDetail : "",
      targets: view.targets.length ? view.targets : ["main_stage"],
    },
  };
}

/** 見え方の短い日本語要約（例：上空から 港町・海 を斜め下に見る（飛行中）） */
export function viewSummary(state: BackgroundState): string {
  const availability = getViewAvailability(state);
  const view = availability.active;
  if (!view) {
    const perspective = optionById(sceneData.perspectives, state.scene.composition.perspective)?.label;
    return `標準の見え方${perspective ? `（${perspective}）` : ""}`;
  }
  const stage = optionById(sceneData.stages, state.scene.place.mainStage)?.label || "";
  const targets = view.targets.map((id) => (id === "main_stage" ? stage : label(viewData.viewTargets, id))).join("・");
  const gaze = view.gaze === "feet" ? "足元を見る" : `${targets}を${{ forward: "正面に見る", up_diagonal: "見上げる", straight_up: "真上に見上げる", down_diagonal: "見下ろす", straight_down: "真下に見る", horizon_far: "遠く眺める" }[view.gaze] || "見る"}`;
  const motion = view.motion !== "still" ? `（${label(viewData.motions, view.motion)}）` : "";
  const frame = view.frame ? `${label(viewData.frames, view.frame)}に` : "";
  return `${label(viewData.vantages, view.vantage)}から ${frame}${gaze}${motion}`;
}
