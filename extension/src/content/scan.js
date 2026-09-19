/**
 * L2/L3 — narrow MutationObserver, debounce, char cap, hash skip cache.
 * Clears the text variable after scoring. Passes metadata only to UI.
 */

import {
  DEBOUNCE_MS,
  HASH_LRU_SIZE,
  MAX_SCAN_CHARS,
} from "../shared/constants.js";
import { score } from "../shared/score.js";
import { skipNode } from "./sites/generic.js";

export function cheapHash(text) {
  let h = 5381;
  const n = Math.min(text.length, 1024);
  for (let i = 0; i < n; i += 1) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
  }
  return h >>> 0;
}

class HashLru {
  constructor(limit = HASH_LRU_SIZE) {
    this.limit = limit;
    this.map = new Map();
  }

  has(key) {
    if (!this.map.has(key)) return false;
    const value = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, value);
    return true;
  }

  add(key) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, 1);
    if (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}

export function createScanner(options) {
  const {
    compiled,
    disabledRuleIds = [],
    onResult,
    debounceMs = DEBOUNCE_MS,
    normalizeNode = (node) => node,
    expandNode = (node) => [node],
    scanRootOnAttach = true,
  } = options;

  let observer = null;
  let timer = null;
  let pending = new Set();
  const seenHashes = new HashLru();
  let attached = false;

  function disconnect() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    pending.clear();
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    attached = false;
  }

  function flush() {
    timer = null;
    const nodes = [...pending];
    pending.clear();
    for (const node of nodes) {
      if (!node.isConnected || skipNode(node)) continue;
      const raw = node.innerText || node.textContent || "";
      if (!raw.trim()) continue;
      const text = raw.slice(0, MAX_SCAN_CHARS);
      const hash = cheapHash(text);
      if (seenHashes.has(hash)) {
        continue;
      }
      seenHashes.add(hash);
      const result = score(text, compiled, { disabledRuleIds });
      // Drop the scan buffer. UI gets metadata only.
      const payload = {
        score: result.score,
        matchedRuleIds: result.matchedRuleIds,
        reasons: result.reasons,
        topScamId: result.topScamId,
        comboIds: result.comboIds,
        source: "text",
      };
      onResult(payload);
    }
  }

  function queue(nodes) {
    for (const node of nodes) {
      const expanded = expandNode(node) || [node];
      for (const raw of expanded) {
        const target = normalizeNode(raw) || raw;
        if (skipNode(target)) continue;
        pending.add(target);
      }
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, debounceMs);
  }

  function attach(root) {
    disconnect();
    if (!root) return false;
    attached = true;
    if (scanRootOnAttach) queue([root]);
    observer = new MutationObserver((mutations) => {
      const added = [];
      for (const mutation of mutations) {
        if (mutation.type === "characterData" && mutation.target?.parentElement) {
          added.push(mutation.target.parentElement);
        }
        for (const node of mutation.addedNodes) {
          if (node.nodeType === 1) added.push(node);
          else if (node.nodeType === 3 && node.parentElement) added.push(node.parentElement);
        }
      }
      if (added.length) queue(added);
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return true;
  }

  return {
    attach,
    disconnect,
    isAttached: () => attached,
    queue,
  };
}
