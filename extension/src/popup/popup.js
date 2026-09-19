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

async function load() {
  const res = await send(MSG.GET_STORAGE);
  render(res.value || {});
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
