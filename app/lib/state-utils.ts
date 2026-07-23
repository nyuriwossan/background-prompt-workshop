import { createDefaultState } from "./background-data.ts";
import type { BackgroundMode, BackgroundState } from "./background-data.ts";

export function resetConfirmationMessage(mode: BackgroundMode) {
  return `${mode === "scene" ? "空間背景" : "シンプル背景"}の設定を初期状態に戻しますか？`;
}

export function resetActiveMode(state: BackgroundState, confirmed = true): BackgroundState {
  if (!confirmed) return state;
  const defaults = createDefaultState();

  if (state.backgroundMode === "scene") {
    return { ...state, scene: defaults.scene };
  }

  return { ...state, simple: defaults.simple };
}
