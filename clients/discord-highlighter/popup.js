(() => {
  const titleEl = document.getElementById("status-title");
  const detailEl = document.getElementById("status-detail");
  const box = document.getElementById("status");
  const slider = document.getElementById("aggression");
  const copyEl = document.getElementById("agg-copy");
  const descBox = document.getElementById("descriptions");
  const prefs = globalThis.SherpaPrefs;

  const COPY = {
    warn: "Warn. Highlight suspicious text. Hover for the reason when descriptions are on. Links open normally.",
    block: "Block. Same highlights, and a click on a highlighted link always asks Continue / Go back with the real destination.",
  };

  function setStatus(ok, title, detail) {
    box.dataset.ok = ok;
    titleEl.textContent = title;
    detailEl.textContent = detail;
  }

  function renderPrefs(value) {
    slider.value = String(prefs.indexOf(value.aggression));
    descBox.checked = value.descriptions;
    copyEl.textContent = COPY[value.aggression] || COPY.warn;
  }

  function persist() {
    const aggression = prefs.LEVELS[Number(slider.value)] || "warn";
    prefs.save({ aggression, descriptions: descBox.checked }, renderPrefs);
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { type: "sherpa-prefs" }, () => {
          void chrome.runtime.lastError;
        });
      });
    }
  }

  async function checkTab() {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      setStatus("maybe", "Toolbar popup is loaded", "Open this from the Chrome toolbar on Discord, Instagram, Reddit, Docs, or Slides.");
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus("no", "No active tab", "Click the icon while a page is open.");
      return;
    }
    const url = tab.url || "";
    const supported = /discord\.com|instagram\.com|reddit\.com|redd\.it|docs\.google\.com|slides\.google\.com/.test(url);
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: "sherpa-ping" });
      if (res && res.ok) {
        const site = res.site || "this page";
        const marks = typeof res.marks === "number" ? res.marks : 0;
        setStatus(
          "yes",
          "Working on this tab",
          `Sherpa is injected (${site}). ${marks} highlighted ${marks === 1 ? "span" : "spans"} right now.`,
        );
        return;
      }
    } catch {
      // content script not present
    }
    if (supported) {
      setStatus(
        "no",
        "Not injected on this tab",
        "Reload the page, or open chrome://extensions and click Reload on Sherpa.",
      );
      return;
    }
    setStatus(
      "maybe",
      "Extension is loaded",
      "This page is not Discord, Instagram, Reddit, Docs, or Slides. Open one of those to see highlights.",
    );
  }

  slider.addEventListener("input", persist);
  descBox.addEventListener("change", persist);
  prefs.load(renderPrefs);
  checkTab();
})();
