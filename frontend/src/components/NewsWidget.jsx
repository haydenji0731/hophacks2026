import { useEffect, useState } from "react";
import { ARTICLES, FEATURED } from "../data/news.js";

export default function NewsWidget() {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (open || paused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % FEATURED.length),
      6500,
    );
    return () => window.clearInterval(id);
  }, [open, paused]);

  const current = FEATURED[index];
  const stamp = `${String(index + 1).padStart(2, "0")} of ${String(FEATURED.length).padStart(2, "0")}`;

  return (
    <div
      className="product-stage reveal delay-5"
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
                      aria-selected={i === index}
                      className={i === index ? "is-on" : ""}
                      onClick={() => setIndex(i)}
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
            <>
              <ArticleLink article={current} className="news-feature" />
            </>
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
