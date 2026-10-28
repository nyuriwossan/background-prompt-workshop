import type { ViewState } from "../lib/view-data.ts";
import { viewData } from "../lib/view-data.ts";

/**
 * 見え方の模式図。観測者の位置（高さ）と視線の向き、見える対象を1枚で示す。
 * 場所（舞台）と見えるものが別であることを、言葉より先に目で分かるようにする。
 */
const LEVEL_Y: Record<string, number> = { ground: 92, interior: 92, surface: 96, elevated: 62, aerial: 30, underwater: 128 };
const GAZE_VECTOR: Record<string, [number, number]> = {
  forward: [1, 0], up_diagonal: [0.78, -0.62], straight_up: [0, -1], down_diagonal: [0.78, 0.62], straight_down: [0, 1], horizon_far: [1, 0], feet: [0.25, 1],
};

export function ViewDiagram({ view, stageLabel }: { view: ViewState; stageLabel: string }) {
  const vantage = viewData.vantages.find((item) => item.id === view.vantage);
  const level = vantage?.level || "ground";
  const altitudeLift = { ground_level: 20, low: 10, mid: 0, high: -8, above_clouds: -14 }[view.altitude] || 0;
  const y = (LEVEL_Y[level] ?? 92) + (level === "aerial" ? altitudeLift : 0);
  const x = 64;
  const [dx, dy] = GAZE_VECTOR[view.gaze] || [1, 0];
  const length = view.gaze === "horizon_far" ? 190 : view.gaze === "feet" ? 26 : 112;
  const tx = Math.min(300, Math.max(16, x + dx * length));
  const ty = Math.min(150, Math.max(10, y + dy * length));
  const targetNames = view.targets.map((id) => (id === "main_stage" ? stageLabel : viewData.viewTargets.find((item) => item.id === id)?.label || "")).filter(Boolean).join("・");
  const showWater = level === "underwater" || level === "surface" || view.targets.some((id) => ["sea", "water_surface", "seafloor", "harbor_town"].includes(id));
  const indoors = level === "interior";
  const moving = view.motion && view.motion !== "still";
  const labelAnchor = tx > 220 ? "end" : "start";

  return (
    <figure className="view-diagram" aria-label={`${vantage?.label || ""}から${targetNames}を見る模式図`}>
      <svg viewBox="0 0 320 160" role="img">
        <defs>
          <marker id="gaze-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="vd-gaze-head" />
          </marker>
        </defs>
        {showWater
          ? <rect x="0" y="108" width="320" height="52" className="vd-water" />
          : <rect x="0" y="108" width="320" height="52" className="vd-ground" />}
        <line x1="0" y1="108" x2="320" y2="108" className="vd-horizon" />
        {level === "aerial" && <g className="vd-cloud"><ellipse cx="236" cy="38" rx="34" ry="9" /><ellipse cx="262" cy="30" rx="20" ry="8" /></g>}
        {(level === "elevated") && <rect x={x - 12} y={y + 6} width="24" height={108 - y - 6} className="vd-tower" />}
        {indoors && <path d={`M${x - 26} 108 V54 H${x + 34} V108`} className="vd-room" />}
        {view.frame === "window" && <rect x={x + 22} y="62" width="14" height="26" rx="7" className="vd-window" />}
        <line x1={x} y1={y} x2={tx} y2={ty} className="vd-gaze" markerEnd="url(#gaze-head)" strokeDasharray={moving ? "6 5" : undefined} />
        <circle cx={x} cy={y} r="7" className="vd-eye" />
        <circle cx={x} cy={y} r="2.6" className="vd-pupil" />
        {targetNames && <text x={tx + (labelAnchor === "end" ? -4 : 6)} y={Math.max(16, Math.min(150, ty + (dy > 0.5 ? -8 : 4)))} textAnchor={labelAnchor} className="vd-target">{targetNames}</text>}
      </svg>
      <figcaption><span className="vd-legend-eye" />見ている位置：{vantage?.label}<span className="vd-legend-line" />視線の先：{targetNames || "—"}</figcaption>
    </figure>
  );
}
