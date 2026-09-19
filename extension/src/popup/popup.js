import { MSG, STORAGE_KEYS, DEFAULT_SITES_ENABLED } from "../shared/constants.js";

const master = document.getElementById("master");
const versionEl = document.getElementById("rules-version");
const warningsEl = document.getElementById("warnings-shown");
const status = document.getElementById("status");
const siteBoxes = [...document.querySelectorAll("[data-site]")];

function send(type, extra = {}) {
  return new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      resolve({});
      return;
    }
    chrome.runtime.sendMessage({ type, ...extra }, (response) => resolve(response || {}));
  });
}

function render(storage) {
  master.checked = storage[STORAGE_KEYS.enabled] !== false;
  const sites = storage[STORAGE_KEYS.sitesEnabled] || DEFAULT_SITES_ENABLED;
  for (const box of siteBoxes) {
    box.checked = sites[box.dataset.site] !== false;
  }
  versionEl.textContent = `v${storage[STORAGE_KEYS.rulesVersion] ?? "—"}`;
  warningsEl.textContent = String(storage[STORAGE_KEYS.warningsShown] || 0);
}

async function loadTabStatus() {
  const tabLine = document.getElementById("tab-status");
  if (!tabLine) return;
  if (!chrome.tabs?.query) {
    tabLine.textContent = "Open discord.com in Chromium — not the Discord desktop app.";
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || "";
  if (!/^https:\/\/(ptb\.|canary\.)?discord(app)?\.com\//.test(url)) {
    tabLine.textContent =
      "This tab is not discord.com. The desktop Discord app cannot run extensions. Open a channel on https://discord.com then reload that tab.";
    return;
  }
  try {
    const status = await chrome.tabs.sendMessage(tab.id, { type: MSG.GET_TAB_STATUS });
    if (status?.attached) {
      tabLine.textContent = `Scanner attached on Discord. Soft ${status.softCount || 0} · hard ${status.hardCount || 0}. Paste a hard-hit line from testdata/HOW_TO_TEST.md.`;
    } else {
      tabLine.textContent = `On Discord but scanner is off (${status?.error || "reload this tab"}).`;
    }
  } catch {
    tabLine.textContent =
      "On discord.com but the content script is not injected. Reload the extension, then reload this Discord tab.";
  }
}

async function load() {
  const res = await send(MSG.GET_STORAGE);
  render(res.value || {});
  await loadTabStatus();
}

master.addEventListener("change", async () => {
  await send(MSG.SET_STORAGE, { patch: { [STORAGE_KEYS.enabled]: master.checked } });
  status.hidden = false;
  status.textContent = master.checked
    ? "Scanning enabled on allowed sites."
    : "Master off. No observer work.";
});

for (const box of siteBoxes) {
  box.addEventListener("change", async () => {
    const res = await send(MSG.GET_STORAGE);
    const sites = { ...(res.value?.[STORAGE_KEYS.sitesEnabled] || DEFAULT_SITES_ENABLED) };
    sites[box.dataset.site] = box.checked;
    await send(MSG.SET_STORAGE, { patch: { [STORAGE_KEYS.sitesEnabled]: sites } });
  });
}

document.getElementById("open-fixture").addEventListener("click", () => {
  send(MSG.OPEN_FIXTURE);
});

document.getElementById("open-guide")?.addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("testdata/HOW_TO_TEST.md") });
});

document.getElementById("privacy").addEventListener("click", (event) => {
  event.preventDefault();
  chrome.tabs.create({ url: chrome.runtime.getURL("privacy.md") });
});

if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
  status.hidden = false;
  status.textContent = "Preview only. Load unpacked from extension/ to use toggles.";
  versionEl.textContent = "v1";
} else {
  load();
}
