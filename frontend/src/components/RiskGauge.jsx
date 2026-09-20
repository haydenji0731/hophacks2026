import { useEffect, useId, useState } from "react";

const SIZE = 200;
const CX = 100;
const CY = 108;
const R = 74;
const TRACK = 12;
const SWEEP = 270;
const START = 225;
const DURATION = 1250;

function polar(cx, cy, r, deg) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function arcPath(cx, cy, r, startDeg, sweepDeg) {
  const [x1, y1] = polar(cx, cy, r, startDeg);
  const [x2, y2] = polar(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const n = hex.replace("#", "");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function rgbToCss([r, g, b]) {
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}

function lerpHex(from, to, t) {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToCss([mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]);
}

/** Green → amber → red as the score climbs. */
export function colorForScore(t) {
  const u = Math.max(0, Math.min(1, t));
  if (u < 0.42) return lerpHex("#22c55e", "#eab308", u / 0.42);
  return lerpHex("#eab308", "#e23d3d", (u - 0.42) / 0.58);
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

export default function RiskGauge({ value = 0, max = 10, label = "Risk score" }) {
  const uid = useId();
  const target = Math.max(0, Math.min(max, Number(value) || 0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(target);
      return undefined;
    }
    setShown(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / DURATION);
      setShown(target * easeOutCubic(t));
      if (t < 1) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target]);

  const t = max === 0 ? 0 : shown / max;
  const color = colorForScore(t);
  const track = arcPath(CX, CY, R, START, SWEEP);
  const fill = arcPath(CX, CY, R, START, SWEEP * t);
  const display = Math.round(shown);
  const titleId = `${uid}-label`;

  return (
    <div className="risk-gauge">
      <svg
        className="risk-gauge-svg"
        viewBox={`0 0 ${SIZE} 188`}
        role="meter"
        aria-labelledby={titleId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${display} out of ${max}`}
      >
        <path className="risk-gauge-track" d={track} fill="none" strokeWidth={TRACK} />
        {t > 0.002 ? (
          <path
            className="risk-gauge-fill"
            d={fill}
            fill="none"
            stroke={color}
            strokeWidth={TRACK}
            strokeLinecap="round"
          />
        ) : null}
      </svg>
      <div className="risk-gauge-readout" aria-hidden="true">
        <b style={{ color }}>{display}</b>
        <em>/ {max}</em>
      </div>
      <span id={titleId} className="risk-gauge-label">
        {label}
      </span>
    </div>
  );
}
