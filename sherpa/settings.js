(() => {
  // Live report form at the bottom of the YPINR homepage.
  const REPORT_URL = "http://yourprinceisnotreal.net/#:~:text=Report%20a%20scam";

  const THEMES = {
    light: {
      bg: "#F2E8CF",
      highlight: "#BC4749",
      h1: "#011627",
      h2: "#658E9C",
      h3: "#99B2DD",
    },
    dark: {
      bg: "#0F1020",
      highlight: "#EFC3F5",
      h1: "#2F195F",
      h2: "#7353BA",
      h3: "#FAA6FF",
    },
  };

  const DEFAULTS = { aggression: "warn", descriptions: true, theme: "dark" };
  const LEVELS = ["warn", "block"];
  const THEME_NAMES = ["dark", "light"];

  function normalize(raw) {
    let aggression = raw && raw.aggression;
    if (aggression === "point") aggression = "warn";
    if (!LEVELS.includes(aggression)) aggression = DEFAULTS.aggression;
    const theme = raw && raw.theme === "light" ? "light" : "dark";
    return {
      aggression,
      descriptions: raw && raw.descriptions === false ? false : true,
      theme,
    };
  }

  function load(done) {
    const finish = (value) => done(normalize(value));
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(DEFAULTS, (got) => finish(got));
      return;
    }
    finish(globalThis.SherpaSettings || DEFAULTS);
  }

  function save(next, done) {
    const value = normalize(next);
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(value, () => {
        if (done) done(value);
      });
      return;
    }
    globalThis.SherpaSettings = value;
    if (done) done(value);
  }

  function subscribe(listener) {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const patch = {};
        if (Object.prototype.hasOwnProperty.call(changes, "aggression")) {
          patch.aggression = changes.aggression.newValue;
        }
        if (Object.prototype.hasOwnProperty.call(changes, "descriptions")) {
          patch.descriptions = changes.descriptions.newValue;
        }
        if (Object.prototype.hasOwnProperty.call(changes, "theme")) {
          patch.theme = changes.theme.newValue;
        }
        load((current) => listener(normalize({ ...current, ...patch })));
      });
    }
  }

  function indexOf(aggression) {
    const i = LEVELS.indexOf(aggression);
    return i < 0 ? 0 : i;
  }

  function applyTheme(doc, theme) {
    if (!doc || !doc.documentElement) return THEMES.dark;
    const name = theme === "light" ? "light" : "dark";
    const t = THEMES[name];
    const root = doc.documentElement;
    root.dataset.sherpaTheme = name;
    root.style.setProperty("--sherpa-bg", t.bg);
    root.style.setProperty("--sherpa-hl", t.highlight);
    root.style.setProperty("--sherpa-h1", t.h1);
    root.style.setProperty("--sherpa-h2", t.h2);
    root.style.setProperty("--sherpa-h3", t.h3);
    return t;
  }

  function reportHref(details) {
    const params = new URLSearchParams();
    const text = details && details.text ? String(details.text) : "";
    const site = details && details.site ? String(details.site) : "";
    const band = details && details.band ? String(details.band) : "";
    if (text) params.set("text", text.slice(0, 2000));
    if (site) params.set("site", site);
    if (band) params.set("band", band);
    if (REPORT_URL) {
      const url = new URL(REPORT_URL);
      params.forEach((value, key) => url.searchParams.set(key, value));
      return url.toString();
    }
    const page =
      typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL
        ? chrome.runtime.getURL("report.html")
        : "report.html";
    const qs = params.toString();
    return qs ? `${page}?${qs}` : page;
  }

  const api = {
    DEFAULTS,
    LEVELS,
    THEMES,
    THEME_NAMES,
    REPORT_URL,
    normalize,
    load,
    save,
    subscribe,
    indexOf,
    applyTheme,
    reportHref,
  };
  globalThis.SherpaPrefs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
