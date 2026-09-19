import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ARTICLES } from "../data/news.js";

const POLL_MS = 20_000;

function featuredOf(articles) {
  const marked = articles.filter((article) => article.featured);
  return marked.length ? marked : articles.slice(0, 3);
}

export default function NewsWidget() {
  const [articles, setArticles] = useState(ARTICLES);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const featured = featuredOf(articles);

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
    setIndex((i) => (featured.length ? i % featured.length : 0));
  }, [featured.length]);

  useEffect(() => {
    if (open || paused || featured.length < 2) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % featured.length),
      6500,
    );
    return () => window.clearInterval(id);
  }, [open, paused, featured.length]);

  const current = featured[index] || featured[0];
  if (!current) return null;
  const stamp = `${String(index + 1).padStart(2, "0")} of ${String(featured.length).padStart(2, "0")}`;

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
                  {featured.map((article, i) => (
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
              {articles.map((article) => (
                <li key={article.id}>
                  <ArticleLink article={article} className="news-card" />
                </li>
              ))}
            </ul>
          ) : (
            <ArticleLink article={current} className="news-feature" />
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
