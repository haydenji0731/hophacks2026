(() => {
  const titleEl = document.getElementById("status-title");
  const detailEl = document.getElementById("status-detail");
  const box = document.getElementById("status");
  const modeSwitch = document.getElementById("aggression");
  const themeSwitch = document.getElementById("theme");
  const copyEl = document.getElementById("agg-copy");
  const descBox = document.getElementById("descriptions");
  const reportBtn = document.getElementById("report");
  const prefs = globalThis.SherpaPrefs;

  const COPY = {
    warn: "Highlight flagged text. Links open normally.",
    block: "Highlighted links prompt to continue/go back when clicked.",
  };

  function setStatus(ok, title, detail) {
    box.dataset.ok = ok;
    titleEl.textContent = title;
    detailEl.textContent = detail;
  }

  function currentMode() {
    return modeSwitch.getAttribute("aria-checked") === "true" ? "block" : "warn";
  }

  function currentTheme() {
    return themeSwitch.getAttribute("aria-checked") === "true" ? "dark" : "light";
  }

  function paintTheme(theme) {
    prefs.applyTheme(document, theme);
  }

  function renderPrefs(value) {
    modeSwitch.setAttribute("aria-checked", value.aggression === "block" ? "true" : "false");
    themeSwitch.setAttribute("aria-checked", value.theme === "dark" ? "true" : "false");
    descBox.checked = value.descriptions;
    copyEl.textContent = COPY[value.aggression] || COPY.warn;
    paintTheme(value.theme);
  }

  function notifyTab(value) {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) return;
      const payload = { type: "sherpa-prefs", settings: value };
      const send = (frameId) => {
        const opts = Number.isInteger(frameId) ? { frameId } : undefined;
        chrome.tabs.sendMessage(tab.id, payload, opts, () => {
          void chrome.runtime.lastError;
        });
      };
      send();
      if (chrome.webNavigation && chrome.webNavigation.getAllFrames) {
        chrome.webNavigation.getAllFrames({ tabId: tab.id }, (frames) => {
          (frames || []).forEach((frame) => send(frame.frameId));
        });
      }
    });
  }

  function persist() {
    const next = {
      aggression: currentMode(),
      descriptions: Boolean(descBox.checked),
      theme: currentTheme(),
    };
    prefs.save(next, (value) => {
      renderPrefs(value);
      notifyTab(value);
    });
  }

  async function checkTab() {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      setStatus("maybe", "Toolbar popup is loaded", "Open this from the Chrome toolbar on Discord, Instagram, Reddit, or Drive.");
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus("no", "No active tab", "Click the icon while a page is open.");
      return;
    }
    const url = tab.url || "";
    const supported = /discord\.com|instagram\.com|reddit\.com|redd\.it|drive\.google\.com/.test(url);
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
      "This page is not Discord, Instagram, Reddit, or Drive. Open one of those to see highlights.",
    );
  }

  function openReport() {
    const href = prefs.reportHref({ site: "popup", text: "" });
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: href });
      return;
    }
    window.open(href, "_blank", "noopener");
  }

  modeSwitch.addEventListener("click", () => {
    const next = modeSwitch.getAttribute("aria-checked") !== "true";
    modeSwitch.setAttribute("aria-checked", next ? "true" : "false");
    persist();
  });
  themeSwitch.addEventListener("click", () => {
    const next = themeSwitch.getAttribute("aria-checked") !== "true";
    themeSwitch.setAttribute("aria-checked", next ? "true" : "false");
    persist();
  });
  // Only persist after the checkbox has toggled. A click listener fires
  // before activation and would write the old value, so the page kept the
  // previous hover-comment setting until reload.
  descBox.addEventListener("change", persist);
  reportBtn.addEventListener("click", openReport);
  prefs.load(renderPrefs);
  checkTab();
})();
