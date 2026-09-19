/**
 * L0 gate + wire L1–L4.
 * If master or site is off: no observer work.
 */

import { MSG, STORAGE_KEYS, DEFAULT_SITES_ENABLED } from "../shared/constants.js";
import { compileRules } from "../shared/compileRules.js";
import { createScanner } from "./scan.js";
import { collectLinkHits, compileHosts } from "./links.js";
import { applyBadge, escalate, resetBurst, showBanner } from "./ui.js";
import { getRoot as genericRoot, siteIdFromHost } from "./sites/generic.js";
import { getRoot as linkedinRoot } from "./sites/linkedin.js";
import { getRoot as facebookRoot } from "./sites/facebook.js";
import { getRoot as instagramRoot } from "./sites/instagram.js";

const ROOTS = {
  linkedin: linkedinRoot,
  facebook: facebookRoot,
  instagram: instagramRoot,
  generic: genericRoot,
};

const siteId = siteIdFromHost(location.hostname);
const seenLinkHosts = new Set();

let scanner = null;
let compiled = null;
let hostSet = new Set();
let thresholds = { soft: 4, hard: 8 };
let softCount = 0;
let hardCount = 0;

function send(type, extra = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...extra }, (response) => {
      resolve(response || { ok: false });
    });
  });
}

function siteEnabled(storage) {
  if (storage[STORAGE_KEYS.enabled] === false) return false;
  if (siteId === "generic") return true;
  const sites = storage[STORAGE_KEYS.sitesEnabled] || DEFAULT_SITES_ENABLED;
  return sites[siteId] !== false;
}

function pickRoot() {
  const fn = ROOTS[siteId] || genericRoot;
  return fn(document);
}

function onResult(result) {
  const level = escalate(result, thresholds);
  if (level === "none") return;
  if (level === "soft") {
    softCount += 1;
    applyBadge(softCount, hardCount);
    return;
  }
  hardCount += 1;
  applyBadge(softCount, hardCount);
  showBanner(result);
}

function stop() {
  if (scanner) {
    scanner.disconnect();
    scanner = null;
  }
  applyBadge(0, 0);
}

async function start() {
  const stored = await send(MSG.GET_STORAGE);
  const storage = stored.value || {};
  if (!siteEnabled(storage)) {
    stop();
    return;
  }

  if (!compiled) {
    const [rulesRes, hostsRes] = await Promise.all([
      send(MSG.GET_RULES),
      send(MSG.GET_HOSTS),
    ]);
    if (!rulesRes.ok) return;
    compiled = compileRules(rulesRes.rules, {
      disabledRuleIds: storage[STORAGE_KEYS.userDisabledRuleIds] || [],
    });
    thresholds = {
      soft: compiled.thresholdSoft,
      hard: compiled.thresholdHard,
    };
    hostSet = compileHosts(hostsRes.hosts || { hosts: [] });
  }

  resetBurst();
  softCount = 0;
  hardCount = 0;
  applyBadge(0, 0);

  scanner = createScanner({
    compiled,
    disabledRuleIds: storage[STORAGE_KEYS.userDisabledRuleIds] || [],
    onResult,
  });
  const root = pickRoot();
  scanner.attach(root);

  const linkHits = collectLinkHits(root, hostSet, seenLinkHosts);
  for (const hit of linkHits) onResult(hit);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (
    STORAGE_KEYS.enabled in changes ||
    STORAGE_KEYS.sitesEnabled in changes ||
    STORAGE_KEYS.userDisabledRuleIds in changes
  ) {
    compiled = null;
    start();
  }
});

start();
