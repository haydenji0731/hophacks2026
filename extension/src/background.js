import {
  DEFAULT_SITES_ENABLED,
  DEFAULT_STORAGE,
  MSG,
  QUESTIONNAIRE_URL,
  SITE_IDS,
  STORAGE_KEYS,
} from "./shared/constants.js";

const RULES_URL = chrome.runtime.getURL("rules/rules.json");
const HOSTS_URL = chrome.runtime.getURL("rules/hosts.json");
const FIXTURE_URL = chrome.runtime.getURL("testdata/fixtures.html");

let rulesCache = null;
let hostsCache = null;

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  return response.json();
}

async function getRules() {
  if (!rulesCache) rulesCache = await loadJson(RULES_URL);
  return rulesCache;
}

async function getHosts() {
  if (!hostsCache) hostsCache = await loadJson(HOSTS_URL);
  return hostsCache;
}

async function ensureDefaults() {
  const current = await chrome.storage.local.get(null);
  const next = {};
  if (typeof current[STORAGE_KEYS.enabled] !== "boolean") {
    next[STORAGE_KEYS.enabled] = DEFAULT_STORAGE.enabled;
  }
  const sites = current[STORAGE_KEYS.sitesEnabled];
  if (!sites || typeof sites !== "object" || "linkedin" in sites || SITE_IDS.some((id) => !(id in sites))) {
    const merged = { ...DEFAULT_SITES_ENABLED, ...(sites && typeof sites === "object" ? sites : {}) };
    next[STORAGE_KEYS.sitesEnabled] = {
      discord: merged.discord !== false,
      facebook: merged.facebook !== false,
      instagram: merged.instagram !== false,
    };
  }
  if (typeof current[STORAGE_KEYS.warningsShown] !== "number") {
    next[STORAGE_KEYS.warningsShown] = 0;
  }
  if (!Array.isArray(current[STORAGE_KEYS.userDisabledRuleIds])) {
    next[STORAGE_KEYS.userDisabledRuleIds] = [];
  }
  const rules = await getRules();
  if (current[STORAGE_KEYS.rulesVersion] !== rules.version) {
    next[STORAGE_KEYS.rulesVersion] = rules.version;
  }
  if (Object.keys(next).length) await chrome.storage.local.set(next);
}

function setBadge(tabId, count, hard) {
  const text = count > 0 ? String(Math.min(count, 99)) : "";
  const color = hard ? "#ff5c5c" : "#c9a227";
  const opts = { tabId };
  chrome.action.setBadgeText({ ...opts, text });
  chrome.action.setBadgeBackgroundColor({ ...opts, color });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaults().catch((err) => console.warn("defaults", err));
});

ensureDefaults().catch((err) => console.warn("defaults", err));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;

  if (type === MSG.GET_RULES) {
    getRules()
      .then((rules) => sendResponse({ ok: true, rules }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (type === MSG.GET_HOSTS) {
    getHosts()
      .then((hosts) => sendResponse({ ok: true, hosts }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (type === MSG.GET_STORAGE) {
    chrome.storage.local.get(null).then((value) => sendResponse({ ok: true, value }));
    return true;
  }

  if (type === MSG.SET_STORAGE && message.patch && typeof message.patch === "object") {
    const allowed = new Set(Object.values(STORAGE_KEYS));
    const patch = {};
    for (const [key, val] of Object.entries(message.patch)) {
      if (allowed.has(key)) patch[key] = val;
    }
    chrome.storage.local.set(patch).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (type === MSG.BADGE) {
    const tabId = sender.tab?.id;
    if (typeof tabId === "number") {
      setBadge(tabId, Number(message.count) || 0, Boolean(message.hard));
    }
    sendResponse({ ok: true });
    return false;
  }

  if (type === MSG.WARNING_SHOWN) {
    chrome.storage.local.get(STORAGE_KEYS.warningsShown).then((stored) => {
      const n = Number(stored[STORAGE_KEYS.warningsShown]) || 0;
      return chrome.storage.local.set({ [STORAGE_KEYS.warningsShown]: n + 1 });
    }).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (type === MSG.OPEN_QUESTIONNAIRE) {
    const hint = String(message.hint || "").replace(/[^a-z0-9_-]/gi, "");
    const url = hint
      ? `${QUESTIONNAIRE_URL}?hint=${encodeURIComponent(hint)}`
      : QUESTIONNAIRE_URL;
    chrome.tabs.create({ url });
    sendResponse({ ok: true });
    return false;
  }

  if (type === MSG.OPEN_FIXTURE) {
    chrome.tabs.create({ url: FIXTURE_URL });
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
