import { useEffect, useState } from "react";

export default function RelevanceMeter({ score, delay = 0 }) {
  const pct = Math.round(Math.max(0, Math.min(1, Number(score) || 0)) * 100);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setOn(true);
      return undefined;
    }
    setOn(false);
    const id = window.setTimeout(() => setOn(true), 40 + delay);
    return () => window.clearTimeout(id);
  }, [score, delay]);

  return (
    <span className="relevance" title={`Cosine similarity ${pct}%`}>
      <span className="relevance-track" aria-hidden="true">
        <span
          className="relevance-fill"
          style={{ width: on ? `${pct}%` : 0 }}
        />
      </span>
      <span className="relevance-label">relevance {pct}%</span>
    </span>
  );
}
