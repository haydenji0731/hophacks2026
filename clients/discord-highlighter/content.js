(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const WHY_CLASS = "sherpa-why-panel";
  const GATE_CLASS = "sherpa-gate";
  const SELECT_BAR = "sherpa-select-bar";
  const POP_ID = "sherpa-hl-pop";
  const prefsApi = globalThis.SherpaPrefs;
  let settings = prefsApi ? prefsApi.normalize(prefsApi.DEFAULTS) : { aggression: "warn", descriptions: true };
  const BLOCK_TAGS = /^(PRE|UL|OL|BLOCKQUOTE|DIV|TABLE|H[1-6]|HR)$/;
  const SKIP_CHROME = "nav, header, footer, aside, [role='navigation'], [role='banner'], [role='tablist'], button, [role='button'], time, textarea, [contenteditable='true'], form";
  const IG_UI =
    /^(liked by|view all(?: \d+ comments?)?|follow|following|suggested for you|see translation|sent|home|search|reels|shop|messages|notifications|create|more)$/i;
  const IG_THREAD =
    "form, main, article, nav, header, footer, aside, [role='log'], [role='navigation'], [data-pagelet], [aria-label^='Conversation' i], [aria-label^='conversation'], [aria-label*='essages' i]";
  const HANDLE_ONLY = /^@?[a-zA-Z0-9._]{1,30}$/;
  const CATEGORY_LABEL = {
    phishing: "Phishing",
    romance: "Romance scam",
    advance_fee: "Advance-fee scam",
    job: "Job / mule scam",
    giveaway: "Giveaway scam",
    tech_support: "Tech-support scam",
    investment: "Investment scam",
    other: "Suspicious message",
  };

  function analyze(text) {
    const api = globalThis.ScamSmell;
    if (!api || typeof api.analyze !== "function") {
      return { score: 0, band: "ok", reasons: [], highlights: [], category: "other" };
    }
    return api.analyze(text);
  }

  function hostnameOf(doc) {
    try {
      return ((doc.defaultView && doc.defaultView.location) || {}).hostname || "";
    } catch {
      return "";
    }
  }

  function skipChrome(el) {
    return Boolean(el && el.closest && el.closest(SKIP_CHROME));
  }

  function innermost(nodes, childSel) {
    return Array.from(nodes).filter((el) => !el.querySelector(childSel));
  }

  function unique(list) {
    return Array.from(new Set(list.filter(Boolean)));
  }

  const DISCORD = {
    name: "discord",
    matchHost: (host) => /(?:^|\.)discord\.com$/.test(host),
    isHost(el) {
      if (!el || el.nodeType !== 1) return false;
      const id = el.id || "";
      if (id.startsWith("message-content-")) return true;
      if (!id.startsWith("chat-messages-")) return false;
      return Boolean(el.querySelector('[id^="message-content-"]'));
    },
    closestHost(el) {
      if (!el || !el.closest) return null;
      const row = el.closest('[id^="chat-messages-"]');
      if (row && this.isHost(row)) return row;
      const content = el.closest('[id^="message-content-"]');
      return content && this.isHost(content) ? content : null;
    },
    hostsIn(root) {
      if (!root || !root.querySelectorAll) return [];
      const found = [];
      if (this.isHost(root)) found.push(root);
      root.querySelectorAll('[id^="chat-messages-"], [id^="message-content-"]').forEach((el) => {
        if (this.isHost(el)) found.push(el);
      });
      return unique(found);
    },
    contentOf(host) {
      if ((host.id || "").startsWith("message-content-")) return host;
      return host.querySelector('[id^="message-content-"]');
    },
  };
