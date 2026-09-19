import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const STRIPS = 11;
const STAGGER_MS = 48;
const IN_MS = 340;
const OUT_MS = 320;
const COVER_MS = (STRIPS - 1) * STAGGER_MS + IN_MS + 40;
const CLEAR_MS = COVER_MS + (STRIPS - 1) * STAGGER_MS + OUT_MS + 40;

export default function BandWipe() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState(null);
  const [label, setLabel] = useState("WHS");
  const phaseRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    function clearTimers() {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    }

    function onClick(event) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (phaseRef.current) return;

      const hit = event.target.closest("button, a");
      if (!hit) return;
      if (hit.closest(".boot, .band-wipe, .skip-link, .news-dots, .theme-toggle, .news-expand")) {
        return;
      }
      if (hit.matches("[disabled]") || hit.getAttribute("aria-disabled") === "true") return;

      const path = internalPath(hit.closest("a"));
      if (path) {
        event.preventDefault();
        event.stopPropagation();
      }

      setLabel(labelFrom(hit));
      phaseRef.current = "in";
      setPhase("in");
      clearTimers();

      timers.current.push(
        window.setTimeout(() => {
          if (path) {
            window.scrollTo(0, 0);
            navigate(path);
          }
          phaseRef.current = "out";
          setPhase("out");
        }, COVER_MS),
      );
      timers.current.push(
        window.setTimeout(() => {
          phaseRef.current = null;
          setPhase(null);
        }, CLEAR_MS),
      );
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, [navigate]);

  if (!phase) return null;

  return createPortal(
    <div className="band-wipe" data-phase={phase} aria-hidden="true">
      {Array.from({ length: STRIPS }, (_, i) => (
        <span
          key={i}
          className="band-wipe-strip"
          style={{
            background: "var(--accent)",
            "--d": `${(i * STAGGER_MS) / 1000}s`,
          }}
        />
      ))}
      <p className="band-wipe-mark">{label}</p>
    </div>,
    document.body,
  );
}

function internalPath(anchor) {
  if (!anchor || anchor.tagName !== "A") return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  const raw = anchor.getAttribute("href");
  if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) {
    return null;
  }
  try {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function labelFrom(el) {
  const href = el.getAttribute("href") || "";
  if (href === "/") return "Home";
  if (href.includes("questionnaire")) return "Check";
  if (href.includes("scams")) return "Intel";
  if (href.includes("our-goal")) return "Our Goal";
  if (href.includes("results")) return "Verdict";

  const raw = (el.getAttribute("aria-label") || el.textContent || "WHS")
    .replace(/\s+/g, " ")
    .trim();
  return raw.slice(0, 24) || "WHS";
}
