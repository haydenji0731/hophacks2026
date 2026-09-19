import { useCallback, useEffect, useRef, useState } from "react";
import { ARTICLES, FEATURED } from "../data/news.js";

const COUNT = FEATURED.length;
const SLIDES = [...FEATURED, FEATURED[0]];

export default function NewsWidget() {
  const [offset, setOffset] = useState(0);
  const [snap, setSnap] = useState(false);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const busy = useRef(false);
  const offsetRef = useRef(0);
  const openRef = useRef(false);
  const pausedRef = useRef(false);

  offsetRef.current = offset;
  openRef.current = open;
  pausedRef.current = paused;

  const settle = useCallback(() => {
    busy.current = false;
  }, []);

  const goTo = useCallback(
    (next) => {
      if (busy.current) return;
      const current = offsetRef.current >= COUNT ? 0 : offsetRef.current;
      if (next === current) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSnap(true);
        setOffset(next);
        settle();
        return;
      }

      busy.current = true;
      setSnap(false);
      if (next === 0 && current === COUNT - 1) {
        setOffset(COUNT);
      } else {
        setOffset(next);
      }
    },
    [settle],
  );

  function onTrackEnd(event) {
    if (event.propertyName !== "transform") return;
    if (offset === COUNT) {
      setSnap(true);
      setOffset(0);
      settle();
      return;
    }
    settle();
  }

  useEffect(() => {
    if (!snap) return undefined;
    const id = window.requestAnimationFrame(() => setSnap(false));
    return () => window.cancelAnimationFrame(id);
  }, [snap]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(() => {
      if (openRef.current || pausedRef.current) return;
      const current = offsetRef.current >= COUNT ? 0 : offsetRef.current;
      goTo((current + 1) % COUNT);
    }, 6500);
    return () => window.clearInterval(id);
  }, [goTo]);

  const visual = offset >= COUNT ? 0 : offset;
  const stamp = `${String(visual + 1).padStart(2, "0")} of ${String(COUNT).padStart(2, "0")}`;

  return (
    <div
      className="product-stage reveal delay-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`product-window news-window${open ? " is-open" : ""}`}>
        <span className="hud-corner tl" aria-hidden="true" />
        <span className="hud-corner tr" aria-hidden="true" />
        <span className="hud-corner bl" aria-hidden="true" />
        <span className="hud-corner br" aria-hidden="true" />
        <div className="window-scan" aria-hidden="true" />

        <div className="window-bar news-bar">
          <span className="live-dot">{open ? "FILE" : "WIRE"}</span>
          <span className="news-slot">
            {open ? (
              "full catalogue"
            ) : (
              <>
                <span>feed / {stamp}</span>
                <span className="news-dots" role="tablist" aria-label="Top stories">
                  {FEATURED.map((article, i) => (
                    <button
                      key={article.id}
                      type="button"
                      role="tab"
                      aria-selected={i === visual}
                      className={i === visual ? "is-on" : ""}
                      onClick={() => goTo(i)}
                    >
                      <span className="sr-only">{article.title}</span>
                    </button>
                  ))}
                </span>
              </>
            )}
          </span>
          <button
            type="button"
            className="news-expand"
            aria-expanded={open}
            aria-controls="news-panel"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close" : "Expand"}
          </button>
        </div>

        <div className="window-body news-body" id="news-panel">
          {open ? (
            <ul className="news-catalogue">
              {ARTICLES.map((article) => (
                <li key={article.id}>
                  <ArticleLink article={article} className="news-card" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="news-viewport">
              <div
                className={`news-track${snap ? " is-snap" : ""}`}
                style={{
                  width: `${SLIDES.length * 100}%`,
                  transform: `translateX(-${(offset * 100) / SLIDES.length}%)`,
                }}
                onTransitionEnd={onTrackEnd}
              >
                {SLIDES.map((article, i) => (
                  <div
                    className="news-slide"
                    key={`${article.id}-${i}`}
                    aria-hidden={i !== offset}
                  >
                    <ArticleLink article={article} className="news-feature" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleLink({ article, className }) {
  return (
    <a
      className={className}
      href={article.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="news-meta">
        {article.source}
        <span aria-hidden="true"> · </span>
        {formatDate(article.date)}
      </span>
      <strong>{article.title}</strong>
      <p>{article.dek}</p>
      <span className="news-go">Open article ↗</span>
    </a>
  );
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
