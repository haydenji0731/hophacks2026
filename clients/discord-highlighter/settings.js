(() => {
  const DEFAULTS = { aggression: "point", descriptions: true };
  const LEVELS = ["point", "warn", "block"];

  function normalize(raw) {
    const aggression = LEVELS.includes(raw && raw.aggression) ? raw.aggression : DEFAULTS.aggression;
    return {
      aggression,
      descriptions: raw && raw.descriptions === false ? false : true,
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
        load(listener);
      });
    }
  }

  function indexOf(aggression) {
    const i = LEVELS.indexOf(aggression);
    return i < 0 ? 0 : i;
  }

  const api = { DEFAULTS, LEVELS, normalize, load, save, subscribe, indexOf };
  globalThis.SherpaPrefs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
