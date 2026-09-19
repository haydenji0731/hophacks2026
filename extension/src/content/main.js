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
import {
  existingMessages,
  getObserveRoot as discordObserveRoot,
  getRoot as discordRoot,
  messageTarget,
} from "./sites/discord.js";
import { getRoot as facebookRoot } from "./sites/facebook.js";
import { getRoot as instagramRoot } from "./sites/instagram.js";

const ROOTS = {
  discord: discordRoot,
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
let lastError = "";

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
    lastError = "site or master disabled";
    stop();
    return;
  }

  if (!compiled) {
    const [rulesRes, hostsRes] = await Promise.all([
      send(MSG.GET_RULES),
      send(MSG.GET_HOSTS),
    ]);
    if (!rulesRes.ok) {
      lastError = "rules failed to load";
      return;
    }
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

  const isDiscord = siteId === "discord";
  scanner = createScanner({
    compiled,
    disabledRuleIds: storage[STORAGE_KEYS.userDisabledRuleIds] || [],
    onResult,
    scanRootOnAttach: !isDiscord,
    normalizeNode: isDiscord ? messageTarget : (node) => node,
    expandNode: isDiscord
      ? (node) => {
          const messages = existingMessages(node);
          if (messages.length) return messages;
          const target = messageTarget(node);
          return target ? [target] : [];
        }
      : (node) => [node],
  });
  const root = isDiscord ? discordObserveRoot(document) : pickRoot();
  scanner.attach(root);
  lastError = scanner.isAttached() ? "" : "no root";
  if (isDiscord) {
    const chat = discordRoot(document);
    const existing = existingMessages(chat);
    if (existing.length) scanner.queue(existing);
  }

  const linkHits = collectLinkHits(root, hostSet, seenLinkHosts);
  for (const hit of linkHits) onResult(hit);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== MSG.GET_TAB_STATUS) return false;
  sendResponse({
    ok: true,
    siteId,
    hostname: location.hostname,
    attached: Boolean(scanner?.isAttached()),
    softCount,
    hardCount,
    error: lastError,
  });
  return false;
});

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
if (siteId === "discord") {
  for (const ms of [800, 2500, 6000]) {
    setTimeout(() => {
      if (!scanner?.isAttached()) {
        start();
        return;
      }
      const existing = existingMessages(discordRoot(document));
      if (existing.length) scanner.queue(existing);
    }, ms);
  }
}
