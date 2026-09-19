import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function BootScreen({ onDone }) {
  const [phase, setPhase] = useState("light");

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onDone();
      return undefined;
    }

    const timers = [
      window.setTimeout(() => setPhase("close"), 850),
      window.setTimeout(() => setPhase("open"), 1750),
      window.setTimeout(onDone, 2650),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [onDone]);

  return createPortal(
    <div className={`boot phase-${phase}`} role="status" aria-live="polite">
      <div className="boot-grid" aria-hidden="true" />
      <div className="boot-lid top" aria-hidden="true" />
      <div className="boot-lid bottom" aria-hidden="true" />
      <p className="boot-mark" aria-label="WHS, We Hate Scammers">
        <span>W</span>
        <span>H</span>
        <span>S</span>
      </p>
      <button className="boot-skip" type="button" onClick={onDone}>
        Skip intro
      </button>
    </div>,
    document.body,
  );
}
