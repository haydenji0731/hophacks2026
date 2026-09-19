/** Shared constants. No DOM. Safe for Node tests and Chrome. */

export const QUESTIONNAIRE_URL = "https://wehatescammers.com/questionnaire";

export const STORAGE_KEYS = Object.freeze({
  enabled: "enabled",
  sitesEnabled: "sitesEnabled",
  rulesVersion: "rulesVersion",
  warningsShown: "warningsShown",
  userDisabledRuleIds: "userDisabledRuleIds",
});

/** Only these keys may ever be written to chrome.storage. */
export const ALLOWED_STORAGE_KEYS = Object.freeze(Object.values(STORAGE_KEYS));

export const SITE_IDS = Object.freeze([
  "discord",
  "facebook",
  "instagram",
]);

export const SITE_HOSTS = Object.freeze({
  discord: ["discord.com", "ptb.discord.com", "canary.discord.com", "discordapp.com"],
  facebook: ["www.facebook.com", "facebook.com", "www.messenger.com", "messenger.com"],
  instagram: ["www.instagram.com", "instagram.com"],
});

export const DEFAULT_SITES_ENABLED = Object.freeze({
  discord: true,
  facebook: true,
  instagram: true,
});

export const DEFAULT_STORAGE = Object.freeze({
  enabled: true,
  sitesEnabled: { ...DEFAULT_SITES_ENABLED },
  rulesVersion: 0,
  warningsShown: 0,
  userDisabledRuleIds: [],
});

export const THRESHOLD_SOFT = 4;
export const THRESHOLD_HARD = 8;

export const DEBOUNCE_MS = 300;
export const MAX_SCAN_CHARS = 3000;
export const PHRASE_CHAR_CAP = 4000;
export const HASH_LRU_SIZE = 32;
export const BANNER_SUPPRESS_MS = 15 * 60 * 1000;

/** L1 hostname hit is a strong standalone signal (no body read). */
export const LINK_HIT_SCORE = 6;
export const LINK_HIT_RULE_ID = "suspicious_link_host";

export const MSG = Object.freeze({
  GET_RULES: "GET_RULES",
  GET_HOSTS: "GET_HOSTS",
  BADGE: "BADGE",
  OPEN_QUESTIONNAIRE: "OPEN_QUESTIONNAIRE",
  WARNING_SHOWN: "WARNING_SHOWN",
  GET_STORAGE: "GET_STORAGE",
  SET_STORAGE: "SET_STORAGE",
  OPEN_FIXTURE: "OPEN_FIXTURE",
});
