/**
 * L1 — hostname Set lookup on new a[href].
 * Hit is a strong signal. No body read required.
 */

import { LINK_HIT_RULE_ID, LINK_HIT_SCORE } from "../shared/constants.js";

export function compileHosts(doc) {
  const set = new Set();
  const list = Array.isArray(doc?.hosts) ? doc.hosts : [];
  for (const raw of list) {
    const host = normalizeHost(raw);
    if (host) set.add(host);
  }
  return set;
}

export function normalizeHost(value) {
  if (!value) return "";
  let host = String(value).trim().toLowerCase();
  if (!host) return "";
  try {
    if (host.includes("://")) host = new URL(host).hostname;
  } catch {
    return "";
  }
  return host.replace(/^www\./, "");
}

export function hostnameFromHref(href) {
  if (!href) return "";
  try {
    return normalizeHost(new URL(href, location.href).hostname);
  } catch {
    return "";
  }
}

export function collectLinkHits(root, hostSet, seen) {
  if (!root || !hostSet?.size) return [];
  const hits = [];
  const anchors = root.querySelectorAll?.("a[href]") || [];
  for (const anchor of anchors) {
    const href = anchor.getAttribute("href");
    const host = hostnameFromHref(href);
    if (!host || seen.has(host)) continue;
    if (!hostSet.has(host)) continue;
    seen.add(host);
    hits.push({
      score: LINK_HIT_SCORE,
      matchedRuleIds: [LINK_HIT_RULE_ID],
      reasons: ["suspicious link host"],
      topScamId: "phishing_link",
      comboIds: [],
      source: "link",
    });
  }
  return hits;
}
