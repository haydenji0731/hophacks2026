(() => {
  const titleEl = document.getElementById("status-title");
  const detailEl = document.getElementById("status-detail");
  const box = document.getElementById("status");
  const testOut = document.getElementById("self-test");
  const slider = document.getElementById("aggression");
  const copyEl = document.getElementById("agg-copy");
  const descBox = document.getElementById("descriptions");
  const prefs = globalThis.SherpaPrefs;

  const COPY = {
    point:
      "Point (Guide). Mark the text and stop there. Open a highlight for the reason. No click interrupts.",
    warn:
      "Warn (Guard). Same as Point, and high-risk or mismatched links ask Continue / Go back before they open.",
    block:
      "Block. Links inside highlighted text always stop first and show the real destination.",
  };

  function setStatus(ok, title, detail) {
    box.dataset.ok = ok;
    titleEl.textContent = title;
    detailEl.textContent = detail;
  }

  function renderPrefs(value) {
    slider.value = String(prefs.indexOf(value.aggression));
    descBox.checked = value.descriptions;
    copyEl.textContent = COPY[value.aggression] || COPY.point;
  }

  function persist() {
    const aggression = prefs.LEVELS[Number(slider.value)] || "point";
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
      setStatus("maybe", "Toolbar popup is loaded", "Open this from the Chrome toolbar on Discord, Instagram, or Reddit.");
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      setStatus("no", "No active tab", "Click the icon while a page is open.");
      return;
    }
    const url = tab.url || "";
    const supported = /discord\.com|instagram\.com|reddit\.com|redd\.it/.test(url);
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
      "This page is not Discord, Instagram, or Reddit. Open one of those to see highlights.",
    );
  }

  function runSelfTest() {
    const api = globalThis.ScamSmell;
    if (!api || typeof api.analyze !== "function") {
      testOut.textContent = "Self-test failed: scorer did not load.";
      return;
    }
    const safe = api.analyze("Your Amazon order has shipped");
    const scam = api.analyze("IRS: pay overdue tax with Apple gift cards today, don't tell anyone");
    if (safe.band === "ok" && scam.band === "high") {
      testOut.textContent = `Self-test passed. Safe sample ${safe.score}/100 · scam sample ${scam.score}/100.`;
      return;
    }
    testOut.textContent = `Self-test failed. Safe=${safe.band} scam=${scam.band}.`;
  }

  slider.addEventListener("input", persist);
  descBox.addEventListener("change", persist);
  document.getElementById("test-btn").addEventListener("click", runSelfTest);
  prefs.load(renderPrefs);
  checkTab();
})();
