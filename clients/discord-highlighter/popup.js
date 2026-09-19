(() => {
  const titleEl = document.getElementById("status-title");
  const detailEl = document.getElementById("status-detail");
  const box = document.getElementById("status");
  const modeSwitch = document.getElementById("aggression");
  const copyEl = document.getElementById("agg-copy");
  const descBox = document.getElementById("descriptions");
  const prefs = globalThis.SherpaPrefs;

  const COPY = {
    warn: "Highlight flagged text. Links open normally.",
    block: "Highlighted links ask Continue / Go back first.",
  };

  function setStatus(ok, title, detail) {
    box.dataset.ok = ok;
    titleEl.textContent = title;
    detailEl.textContent = detail;
  }

  function currentMode() {
    return modeSwitch.getAttribute("aria-checked") === "true" ? "block" : "warn";
  }

  function renderPrefs(value) {
    modeSwitch.setAttribute("aria-checked", value.aggression === "block" ? "true" : "false");
    descBox.checked = value.descriptions;
    copyEl.textContent = COPY[value.aggression] || COPY.warn;
  }

  function persist() {
    const next = { aggression: currentMode(), descriptions: descBox.checked };
    prefs.save(next, (value) => {
      renderPrefs(value);
      if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) return;
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        if (!tab || !tab.id) return;
        chrome.tabs.sendMessage(tab.id, { type: "sherpa-prefs", settings: value }, () => {
          void chrome.runtime.lastError;
        });
      });
    });
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

  modeSwitch.addEventListener("click", () => {
    const next = modeSwitch.getAttribute("aria-checked") !== "true";
    modeSwitch.setAttribute("aria-checked", next ? "true" : "false");
    persist();
  });
  descBox.addEventListener("change", persist);
  prefs.load(renderPrefs);
  checkTab();
})();
