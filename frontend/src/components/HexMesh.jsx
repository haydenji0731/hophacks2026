import { useId } from "react";

const HEX =
  "50,4 93,27 93,73 50,96 7,73 7,27";

export function HexPattern({ className = "" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`hex-pattern ${className}`} aria-hidden="true">
      <defs>
        <pattern
          id={`hex-tile-${id}`}
          width="56"
          height="97"
          patternUnits="userSpaceOnUse"
          patternTransform="scale(1)"
        >
          <path
            d="M28 2 L54 17 L54 47 L28 62 L2 47 L2 17 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path
            d="M56 49.5 L82 64.5 L82 94.5 L56 109.5 L30 94.5 L30 64.5 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#hex-tile-${id})`} />
    </svg>
  );
}

export function HexLock({ className = "" }) {
  return (
    <svg className={`hex-lock ${className}`} viewBox="0 0 100 100" aria-hidden="true">
      <polygon className="hex-ring r1" points={HEX} />
      <polygon className="hex-ring r2" points={HEX} />
      <polygon className="hex-ring r3" points={HEX} />
      <polygon className="hex-core" points="50,32 68,42 68,58 50,68 32,58 32,42" />
    </svg>
  );
}

const SCATTER = [
  { x: 8, y: 12, s: 0.14, d: "0s" },
  { x: 78, y: 8, s: 0.18, d: "0.12s" },
  { x: 18, y: 72, s: 0.12, d: "0.08s" },
  { x: 86, y: 64, s: 0.2, d: "0.2s" },
  { x: 42, y: 18, s: 0.1, d: "0.28s" },
  { x: 62, y: 80, s: 0.16, d: "0.16s" },
  { x: 4, y: 48, s: 0.11, d: "0.32s" },
  { x: 70, y: 36, s: 0.13, d: "0.05s" },
  { x: 30, y: 88, s: 0.12, d: "0.24s" },
  { x: 90, y: 22, s: 0.15, d: "0.18s" },
  { x: 52, y: 6, s: 0.09, d: "0.4s" },
  { x: 12, y: 30, s: 0.14, d: "0.36s" },
];

export function HexBurst() {
  return (
    <svg className="hex-burst" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {SCATTER.map((hex) => (
        <polygon
          key={`${hex.x}-${hex.y}`}
          className="hex-shard"
          points={HEX}
          style={{
            transformOrigin: `${hex.x}px ${hex.y}px`,
            transform: `translate(${hex.x - 50}px, ${hex.y - 50}px) scale(${hex.s})`,
            animationDelay: hex.d,
          }}
        />
      ))}
    </svg>
  );
}
