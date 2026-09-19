import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ARTICLES } from "../data/news.js";

const POLL_MS = 20_000;

function featuredOf(articles) {
  const mixed = articles.filter((a) => a.tag === "new" || a.tag === "hot");
  if (mixed.length) return mixed;
  const marked = articles.filter((article) => article.featured);
  return marked.length ? marked : articles.slice(0, 3);
}

export default function NewsWidget() {
  const [articles, setArticles] = useState(ARTICLES);
  const featured = featuredOf(articles);
  const count = featured.length;
  const slides = count ? [...featured, featured[0]] : [];

  const [offset, setOffset] = useState(0);
  const [snap, setSnap] = useState(false);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const busy = useRef(false);
  const offsetRef = useRef(0);
  const openRef = useRef(false);
  const pausedRef = useRef(false);
  const countRef = useRef(count);

  offsetRef.current = offset;
  openRef.current = open;
  pausedRef.current = paused;
  countRef.current = count;

  useEffect(() => {
    let cancelled = false;
    const apply = (payload) => {
      const next = Array.isArray(payload?.articles)
        ? payload.articles.filter((a) => a?.title && a?.dek)
        : [];
      if (!cancelled && next.length) setArticles(next);
    };
    const load = () => {
      fetch("/api/v1/news")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(apply)
        .catch(() => {});
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setOffset((o) => (count ? o % count : 0));
    busy.current = false;
  }, [count]);

  const settle = useCallback(() => {
    busy.current = false;
  }, []);

  const goTo = useCallback(
    (next) => {
      const total = countRef.current;
      if (!total || busy.current) return;
      const current = offsetRef.current >= total ? 0 : offsetRef.current;
      if (next === current) return;

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setSnap(true);
        setOffset(next);
        settle();
        return;
      }

      busy.current = true;
      setSnap(false);
      if (next === 0 && current === total - 1) {
        setOffset(total);
      } else {
        setOffset(next);
      }
    },
    [settle],
  );

  function onTrackEnd(event) {
    if (event.propertyName !== "transform") return;
    if (offset === countRef.current) {
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
      const total = countRef.current;
      if (total < 2) return;
      const current = offsetRef.current >= total ? 0 : offsetRef.current;
      goTo((current + 1) % total);
    }, 6500);
    return () => window.clearInterval(id);
  }, [goTo]);

  if (!count) return null;

  const visual = offset >= count ? 0 : offset;
  const stamp = `${String(visual + 1).padStart(2, "0")} of ${String(count).padStart(2, "0")}`;

  return (
    <div
      className="product-stage reveal delay-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <h2 className="news-heading">
        Recent News
        <span className="news-heading-rule" aria-hidden="true" />
      </h2>
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
                  {featured.map((article, i) => (
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
              {articles.map((article) => (
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
                  width: `${slides.length * 100}%`,
                  transform: `translateX(-${(offset * 100) / slides.length}%)`,
                }}
                onTransitionEnd={onTrackEnd}
              >
                {slides.map((article, i) => (
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

function isInternal(href) {
  return typeof href === "string" && href.startsWith("/") && !href.startsWith("//");
}

function ArticleLink({ article, className }) {
  const go = isInternal(article.href) ? "Open intel →" : "Open article ↗";
  const inner = (
    <>
      <span className="news-meta">
        {article.source}
        <span aria-hidden="true"> · </span>
        {formatDate(article.date)}
        {article.tag === "new" ? <span className="news-tag is-new">New</span> : null}
        {article.tag === "hot" ? <span className="news-tag is-hot">Hot</span> : null}
      </span>
      <strong>{article.title}</strong>
      <p>{article.dek}</p>
      <span className="news-go">{go}</span>
    </>
  );
  if (isInternal(article.href)) {
    return (
      <Link className={className} to={article.href}>
        {inner}
      </Link>
    );
  }
  return (
    <a
      className={className}
      href={article.href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {inner}
    </a>
  );
}

function formatDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return iso || "";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
