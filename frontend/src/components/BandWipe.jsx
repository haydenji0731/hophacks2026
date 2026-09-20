import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

const STRIPS = 11;
const PLAY_MS = 1180;
const NAV_MS = Math.round(PLAY_MS * 0.46);
const CLEAR_MS = PLAY_MS + 40;

function gapTopSkew(i) {
  const last = STRIPS - 2;
  if (i > last) return 0;
  const t = 1 - i / last;
  const start = 0.48;
  const u = Math.max(0, (t - start) / (1 - start));
  return 46 * u * u;
}

function growTopSkew(i) {
  const t = i / (STRIPS - 1);
  return 0.22 + 0.9 * t * t;
}

function gapBottomSkew(i) {
  const last = STRIPS - 2;
  if (i > last) return 0;
  return gapTopSkew(last - i);
}

function growBottomSkew(i) {
  return growTopSkew(STRIPS - 1 - i);
}

export default function BandWipe() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const [playing, setPlaying] = useState(false);
  const [label, setLabel] = useState("YPINR");
  const phaseRef = useRef(null);
  const timers = useRef([]);

  navigateRef.current = navigate;

  // Reset scroll on every route change, so pages that open without a wipe still start at the top.
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    function clearTimers() {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    }

    function onClick(event) {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      if (phaseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const hit = event.target.closest("button, a");
      if (!hit) return;
      // Only the top bar and the home-page Run check button trigger the wipe.
      if (!hit.closest(".site-header, .hero .cta-row")) return;
      if (hit.closest(".theme-toggle")) return;
      if (hit.matches("[disabled]") || hit.getAttribute("aria-disabled") === "true") return;

      const brand = hit.closest(".brand");
      const path = brand ? "/" : internalPath(hit.closest("a"));
      if (path) {
        event.preventDefault();
        event.stopPropagation();
      }

      setLabel(labelFrom(hit));
      phaseRef.current = "play";
      setPlaying(true);
      clearTimers();

      timers.current.push(
        window.setTimeout(() => {
          if (path) {
            window.scrollTo(0, 0);
            navigateRef.current(path);
          }
        }, NAV_MS),
      );
      timers.current.push(
        window.setTimeout(() => {
          phaseRef.current = null;
          setPlaying(false);
        }, CLEAR_MS),
      );
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, []);

  if (!playing) return null;

  return createPortal(
    <div className="band-wipe" data-phase="play" aria-hidden="true">
      {Array.from({ length: STRIPS }, (_, i) => (
        <span
          key={i}
          className="band-wipe-strip"
          style={{
            background: "var(--wipe)",
            "--grow-a": growBottomSkew(i),
            "--grow-b": growTopSkew(i),
            "--gap-a": `${gapBottomSkew(i)}px`,
            "--gap-b": `${gapTopSkew(i)}px`,
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
  if (anchor.closest(".brand")) return "/";
  const raw = (anchor.getAttribute("href") || "").trim();
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
  if (el.closest(".brand")) return "Home";
  const href = el.getAttribute("href") || "";
  if (href === "/") return "Home";
  if (href.includes("questionnaire")) return "Check";
  if (href.includes("scams")) return "Intel";
  if (href.includes("live")) return "Live";
  if (href.includes("our-goal")) return "Our Goal";
  if (href.includes("results")) return "Verdict";

  const raw = (el.getAttribute("aria-label") || el.textContent || "YPINR")
    .replace(/\s+/g, " ")
    .trim();
  return raw.slice(0, 24) || "YPINR";
}
