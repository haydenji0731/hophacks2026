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

  const INSTAGRAM = {
    name: "instagram",
    matchHost: (host) => /(?:^|\.)instagram\.com$/.test(host),
    skip(el) {
      if (!el || el.nodeType !== 1 || !el.closest) return true;
      if (el.closest("nav, header, footer, aside, [role='navigation'], [role='banner'], [role='tablist']")) {
        return true;
      }
      if (el.closest("textarea, [contenteditable='true'], svg, img, video")) return true;
      return false;
    },
    isThread(el) {
      return Boolean(el && el.matches && el.matches(IG_THREAD));
    },
    joinedText(el) {
      if (!el) return "";
      const pieces = [];
      const visit = (node, depth) => {
        if (!node || depth > 14 || pieces.length > 240) return;
        if (node.nodeType === 3) {
          const trimmed = String(node.nodeValue || "").replace(/\s+/g, " ").trim();
          if (trimmed) pieces.push(trimmed);
          return;
        }
        if (node.nodeType !== 1) return;
        if (node.tagName === "BR") {
          pieces.push("\n");
          return;
        }
        const children = node.childNodes;
        if (!children || !children.length) return;
        const onlyText = Array.from(children).every(
          (child) => child.nodeType === 3 || (child.nodeType === 1 && child.tagName === "BR"),
        );
        if (onlyText) {
          const text = String(node.textContent || "").replace(/\s+/g, " ").trim();
          if (text) pieces.push(text);
          return;
        }
        Array.from(children).forEach((child) => visit(child, depth + 1));
      };
      visit(el, 0);
      return pieces.join(" ").replace(/\s+/g, " ").trim();
    },
    visibleText(el) {
      if (!el) return "";
      const joined = this.joinedText(el);
      const fallback = String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (!joined) return fallback;
      if (!fallback) return joined;
      return joined.split(/\s+/).length >= fallback.split(/\s+/).length ? joined : fallback;
    },
    isSentence(text) {
      if (!text || text.length < 8 || text.length > 1500) return false;
      if (HANDLE_ONLY.test(text) && !/\s/.test(text)) return false;
      if (IG_UI.test(text)) return false;
      return true;
    },
    pieces(el) {
      if (!el || !el.children) return [];
      return Array.from(el.children).filter((kid) => {
        if (this.skip(kid) || this.isThread(kid)) return false;
        const text = this.visibleText(kid);
        return Boolean(text) && text.length <= 80;
      });
    },
    isBubble(el) {
      if (!el || el.nodeType !== 1 || this.skip(el) || this.isThread(el)) return false;
      const kids = this.pieces(el);
      if (kids.length < 2 || kids.length > 80) return false;
      const texts = kids.map((kid) => this.visibleText(kid));
      const combined = texts.join(" ").replace(/\s+/g, " ").trim();
      if (!this.isSentence(combined)) return false;
      const wordish = texts.filter((text) => text.length <= 40 && !/\s/.test(text)).length;
      return wordish >= texts.length * 0.6;
    },
    isLeafMessage(el) {
      if (!el || el.nodeType !== 1 || this.skip(el) || this.isThread(el)) return false;
      const nested = el.querySelectorAll ? el.querySelectorAll('[dir="auto"]') : [];
      const hasDirChild = Array.from(nested).some((kid) => kid !== el);
      if (el.getAttribute && el.getAttribute("dir") === "auto" && !hasDirChild) {
        return this.isSentence(this.visibleText(el));
      }
      if (el.matches && el.matches("span, p") && !hasDirChild && !this.isBubble(el)) {
        return this.isSentence(this.visibleText(el));
      }
      return false;
    },
    ancestorBubble(el) {
      let node = el && el.parentElement;
      for (let i = 0; i < 5 && node; i += 1) {
        if (this.isThread(node)) return null;
        if (this.isBubble(node)) return node;
        node = node.parentElement;
      }
      return null;
    },
    isHost(el) {
      if (this.isBubble(el)) {
        return !Array.from(el.children || []).some((kid) => this.isBubble(kid));
      }
      if (!this.isLeafMessage(el)) return false;
      return !this.ancestorBubble(el);
    },
    closestHost(el) {
      let node = el && el.nodeType === 1 ? el : el && el.parentElement;
      while (node) {
        if (this.isHost(node)) return node;
        node = node.parentElement;
      }
      return null;
    },
    hostsIn(root) {
      if (!root || !root.querySelectorAll) return [];
      const scopes = [];
      const scopeSel =
        '[data-pagelet="IGDMessagesList"], [aria-label^="Conversation" i], [aria-label^="conversation"], article';
      if (root.matches && root.matches(scopeSel)) scopes.push(root);
      if (root.querySelectorAll) root.querySelectorAll(scopeSel).forEach((el) => scopes.push(el));
      const search = unique(scopes.length ? scopes : [root]);
      const found = [];
      for (const scope of search) {
        if (this.isHost(scope)) found.push(scope);
        if (!scope.querySelectorAll) continue;
        const parents = new Set();
        scope.querySelectorAll('[dir="auto"]').forEach((el) => {
          if (this.isHost(el)) found.push(el);
          let parent = el.parentElement;
          for (let i = 0; i < 4 && parent && parent !== scope && !this.isThread(parent); i += 1) {
            parents.add(parent);
            parent = parent.parentElement;
          }
        });
        parents.forEach((el) => {
          if (this.isHost(el)) found.push(el);
        });
      }
      return unique(found);
    },
    contentOf(host) {
      return host;
    },
    textOf(el) {
      return this.visibleText(el);
    },
  };

  const REDDIT = {
    name: "reddit",
    matchHost: (host) => /(?:^|\.)reddit\.com$/.test(host) || host === "redd.it",
    bodyFrom(el) {
      if (!el) return [];
      const md =
        el.querySelector &&
        (el.querySelector('[slot="comment"] .md') ||
          el.querySelector('[slot="text-body"] .md') ||
          el.querySelector('[slot="comment"]') ||
          el.querySelector('[slot="text-body"]') ||
          el.querySelector(".md") ||
          el.querySelector('[data-click-id="text"]') ||
          el.querySelector('[data-testid="post-content"]'));
      const title =
        el.querySelector &&
        (el.querySelector('[slot="title"]') || el.querySelector("h1"));
      const out = [];
      const addLeaves = (node) => {
        if (!node || skipChrome(node)) return;
        if (node.matches && node.matches("p, h1, a[slot='title'], [slot='title']")) {
          out.push(node);
          return;
        }
        const ps = node.querySelectorAll ? node.querySelectorAll("p") : [];
        if (ps.length) {
          ps.forEach((p) => {
            if (!skipChrome(p)) out.push(p);
          });
          return;
        }
        out.push(node);
      };
      if (md) addLeaves(md);
      if (title && (el.tagName || "").toLowerCase() === "shreddit-post") addLeaves(title);
      return unique(out);
    },
    isHost(el) {
      if (!el || el.nodeType !== 1) return false;
      const tag = (el.tagName || "").toLowerCase();
      if (tag === "shreddit-comment" || tag === "shreddit-profile-comment" || tag === "shreddit-post") {
        return this.bodyFrom(el).length > 0;
      }
      if (el.classList && el.classList.contains("usertext-body")) return true;
      if (el.getAttribute && el.getAttribute("data-testid") === "comment") return true;
      if (el.getAttribute && el.getAttribute("data-testid") === "message") return true;
      return false;
    },
    closestHost(el) {
      const host =
        el && el.closest
          ? el.closest(
              "shreddit-comment, shreddit-profile-comment, shreddit-post, .usertext-body, [data-testid='comment'], [data-testid='message']",
            )
          : null;
      return host && this.isHost(host) ? host : null;
    },
    hostsIn(root) {
      if (!root || !root.querySelectorAll) return [];
      const found = [];
      if (this.isHost(root)) found.push(root);
      root
        .querySelectorAll(
          "shreddit-comment, shreddit-profile-comment, shreddit-post, .usertext-body, [data-testid='comment'], [data-testid='message']",
        )
        .forEach((el) => {
          if (this.isHost(el)) found.push(el);
        });
      return unique(found);
    },
    contentOf(host) {
      const bodies = this.bodyFrom(host);
      return bodies[0] || host;
    },
    contentsOf(host) {
      const bodies = this.bodyFrom(host);
      return bodies.length ? bodies : [host];
    },
  };

  const GOOGLE_UI =
    "nav, header, [role='navigation'], [role='banner'], [role='menubar'], [role='menu'], button, [role='button'], textarea, svg, img, video, .docs-title-input, .docs-title-widget, #docs-chrome, .goog-menuitem, .menu-button";
  const GOOGLE_COMPOSE =
    ".docos-input, .docos-input-textarea, .docos-replyview-replybox, [aria-label='Join the discussion'], [aria-label^='New comment' i]";
  const GOOGLE_HOST_SEL = [
    ".docos-replyview-body",
    ".docos-replyview-comment",
    ".docs-chat-message",
    "[data-comment-id]",
    "[data-purpose='speaker-notes']",
    ".punch-viewer-speakernotes-text",
    ".sketchy-speakernotes",
    "[aria-label='Speaker notes']",
    ".sketchy-text-content",
  ].join(",");

  const GOOGLE = {
    name: "google",
    matchHost: (host) => /(?:^|\.)docs\.google\.com$|(?:^|\.)slides\.google\.com$/.test(host),
    skip(el) {
      if (!el || el.nodeType !== 1 || !el.closest) return true;
      if (el.closest(GOOGLE_UI)) return true;
      if (el.closest(GOOGLE_COMPOSE)) return true;
      return false;
    },
    isHost(el) {
      if (!el || el.nodeType !== 1 || this.skip(el)) return false;
      if (!(el.matches && el.matches(GOOGLE_HOST_SEL))) return false;
      if (el.matches("[data-comment-id]") && el.querySelector && el.querySelector(".docos-replyview-body")) {
        return false;
      }
      const text = String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      return text.length >= 8 && text.length <= 4000;
    },
    closestHost(el) {
      if (!el || !el.closest) return null;
      const found = el.closest(GOOGLE_HOST_SEL);
      return found && this.isHost(found) ? found : null;
    },
    hostsIn(root) {
      if (!root || !root.querySelectorAll) return [];
      const found = [];
      if (this.isHost(root)) found.push(root);
      root.querySelectorAll(GOOGLE_HOST_SEL).forEach((el) => {
        if (this.isHost(el)) found.push(el);
      });
      return unique(found);
    },
    contentOf(host) {
      if (!host) return host;
      if (host.matches && host.matches("[data-comment-id]")) {
        return host.querySelector(".docos-replyview-body") || host;
      }
      return host;
    },
  };

  const ALL_ADAPTERS = [DISCORD, INSTAGRAM, REDDIT, GOOGLE];

  function adaptersFor(doc) {
    const host = hostnameOf(doc);
    const matched = ALL_ADAPTERS.filter((a) => a.matchHost(host));
    if (matched.length) return matched;
    return ALL_ADAPTERS;
  }

  function isUserMessage(el) {
    return ALL_ADAPTERS.some((adapter) => adapter.isHost(el));
  }

  function hostFor(el) {
    if (!el) return null;
    if (el.nodeType === 3) el = el.parentElement;
    if (!el || el.nodeType !== 1) return null;
    const adapters = adaptersFor(el.ownerDocument);
    for (const adapter of adapters) {
      if (adapter.isHost(el)) return { host: el, adapter };
      const closest = adapter.closestHost(el);
      if (closest) return { host: closest, adapter };
    }
    return null;
  }

  function contentsFor(host, adapter) {
    if (adapter.contentsOf) return adapter.contentsOf(host).filter(Boolean);
    const one = adapter.contentOf(host);
    return one ? [one] : [];
  }

  function messageText(contentEl, adapter) {
    const raw =
      adapter && typeof adapter.textOf === "function"
        ? adapter.textOf(contentEl)
        : (contentEl.innerText || contentEl.textContent || "").trim();
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    const hrefs = Array.from(contentEl.querySelectorAll ? contentEl.querySelectorAll("a[href]") : [])
      .map((a) => a.getAttribute("href") || "")
      .filter(Boolean);
    return hrefs.length ? `${text}\n${hrefs.join(" ")}` : text;
  }

  function unwrap(contentEl) {
    contentEl.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
      parent.removeChild(mark);
    });
    contentEl.normalize();
    delete contentEl.dataset.scamKey;
    const sibling = contentEl.nextElementSibling;
    if (sibling && sibling.classList && sibling.classList.contains(WHY_CLASS)) sibling.remove();
    contentEl.querySelectorAll("." + WHY_CLASS).forEach((panel) => panel.remove());
  }

  function wrapInlineRuns(contentEl, result) {
    const doc = contentEl.ownerDocument;
    const kids = Array.from(contentEl.childNodes);
    let run = [];

    const flush = () => {
      if (!run.length) return;
      if (
        run.length === 1 &&
        run[0].nodeType === 1 &&
        run[0].classList &&
        run[0].classList.contains(HIGHLIGHT_CLASS)
      ) {
        applyResult(run[0], result);
        run = [];
        return;
      }
      const mark = doc.createElement("span");
      mark.className = HIGHLIGHT_CLASS;
      applyResult(mark, result);
      run[0].parentNode.insertBefore(mark, run[0]);
      for (const node of run) mark.appendChild(node);
      run = [];
    };

    for (const node of kids) {
      if (node.nodeType === 1 && node.classList.contains(HIGHLIGHT_CLASS)) {
        flush();
        applyResult(node, result);
        continue;
      }
      if (node.nodeType === 1 && BLOCK_TAGS.test(node.tagName)) {
        flush();
        continue;
      }
      if (node.nodeType === 3 && !node.nodeValue.trim() && !run.length) continue;
      run.push(node);
    }
    flush();
  }

  function wrapTextLeaves(contentEl, result) {
    const doc = contentEl.ownerDocument;
    const showText = (typeof NodeFilter !== "undefined" && NodeFilter.SHOW_TEXT) || 4;
    const walker = doc.createTreeWalker(contentEl, showText);
    const texts = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue || !String(node.nodeValue).trim()) continue;
      if (node.parentElement && node.parentElement.closest("." + HIGHLIGHT_CLASS)) continue;
      texts.push(node);
    }
    const tight = texts.length > 1;
    for (const text of texts) {
      const mark = doc.createElement("span");
      mark.className = tight ? HIGHLIGHT_CLASS + " discord-hl-mark--tight" : HIGHLIGHT_CLASS;
      applyResult(mark, result);
      text.parentNode.insertBefore(mark, text);
      mark.appendChild(text);
    }
  }

  function hasWordChips(contentEl) {
    const kids = Array.from(contentEl.children || []);
    if (kids.length < 2) return false;
    return kids.every(
      (kid) =>
        kid.nodeType === 1 &&
        !BLOCK_TAGS.test(kid.tagName) &&
        String(kid.textContent || "").trim().length <= 80,
    );
  }

  function wrapInlineDeep(contentEl, result) {
    if (hasWordChips(contentEl)) {
      wrapTextLeaves(contentEl, result);
      if (contentEl.querySelector && contentEl.querySelector("." + HIGHLIGHT_CLASS)) return;
    }
    wrapInlineRuns(contentEl, result);
    if (contentEl.querySelector && contentEl.querySelector("." + HIGHLIGHT_CLASS)) return;
    Array.from(contentEl.children || []).forEach((child) => {
      if (child.nodeType === 1 && BLOCK_TAGS.test(child.tagName)) {
        wrapInlineDeep(child, result);
      }
    });
  }

  function applyResult(mark, result) {
    mark.classList.remove("discord-hl-mark--caution", "discord-hl-mark--high");
    mark.classList.add(
      result.band === "high" ? "discord-hl-mark--high" : "discord-hl-mark--caution",
    );
    mark.dataset.band = result.band;
    mark.dataset.score = String(result.score);
    mark.dataset.category = result.category || "other";
    mark.dataset.reasons = JSON.stringify(result.reasons || []);
    wireMarkHover(mark);
  }

  function wireMarkHover(mark) {
    if (!mark || mark.dataset.sherpaHover === "1") return;
    mark.dataset.sherpaHover = "1";
    mark.addEventListener("pointerenter", () => {
      showPop(mark.ownerDocument, mark);
    });
    mark.addEventListener("pointerleave", (event) => {
      const next = event.relatedTarget;
      if (next && next.closest && next.closest(".discord-hl-pop")) return;
      hidePop(mark.ownerDocument);
    });
  }

  function clickWarning(band) {
    return band === "high" ? "SCAM LIKELY: AVOID LINKS" : "SUSPICIOUS";
  }

  function applySettings(next) {
    settings = prefsApi ? prefsApi.normalize(next) : { aggression: "warn", descriptions: true };
    if (typeof document !== "undefined") {
      if (!settings.descriptions) hidePop(document);
      document.querySelectorAll &&
        document.querySelectorAll("." + WHY_CLASS + ", ." + SELECT_BAR).forEach((panel) => {
          if (!settings.descriptions) panel.hidden = true;
        });
    }
    return settings;
  }

  function resolveHref(anchor, baseHref) {
    const href = (anchor && anchor.getAttribute && anchor.getAttribute("href")) || "";
    if (!href || href.charAt(0) === "#" || /^javascript:/i.test(href)) return null;
    try {
      return new URL(href, baseHref || "https://example.com/");
    } catch {
      return null;
    }
  }

  function claimedHosts(text) {
    const matches = String(text || "").match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) || [];
    return matches.map((host) => host.replace(/^www\./i, "").toLowerCase());
  }

  const BRAND_HOST = [
    ["discord", /(?:^|\.)discord\.com$|(?:^|\.)discord\.gg$/],
    ["steam", /(?:^|\.)steampowered\.com$|(?:^|\.)steamcommunity\.com$/],
    ["paypal", /(?:^|\.)paypal\.com$/],
    ["instagram", /(?:^|\.)instagram\.com$/],
    ["facebook", /(?:^|\.)facebook\.com$|(?:^|\.)fb\.com$/],
    ["google", /(?:^|\.)google\.com$/],
    ["microsoft", /(?:^|\.)microsoft\.com$|(?:^|\.)live\.com$|(?:^|\.)office\.com$/],
    ["apple", /(?:^|\.)apple\.com$|(?:^|\.)icloud\.com$/],
    ["amazon", /(?:^|\.)amazon\.com$/],
    ["irs", /(?:^|\.)irs\.gov$/],
  ];

  function linkMismatch(anchor, baseHref) {
    const url = resolveHref(anchor, baseHref);
    if (!url) return false;
    const actual = url.hostname.replace(/^www\./i, "").toLowerCase();
    const text = ((anchor && (anchor.innerText || anchor.textContent)) || "").trim();
    const claimed = claimedHosts(text);
    for (const host of claimed) {
      if (actual === host || actual.endsWith("." + host) || host.endsWith("." + actual)) continue;
      return true;
    }
    const lower = text.toLowerCase();
    for (const [name, re] of BRAND_HOST) {
      if (lower.includes(name) && !re.test(actual)) return true;
    }
    return false;
  }

  function shouldIntercept(aggression, ctx) {
    return aggression === "block" && Boolean(ctx && ctx.inHighlight);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function parseReasons(mark) {
    try {
      return JSON.parse((mark && mark.dataset && mark.dataset.reasons) || "[]");
    } catch {
      return [];
    }
  }

  function popupPosition(markRect, popSize, viewport, gap = 8, margin = 8) {
    const maxWidth = Math.max(0, viewport.width - margin * 2);
    const width = Math.min(popSize.width || 268, maxWidth);
    const height = popSize.height > 1 ? popSize.height : 140;
    let left = markRect.left;
    left = Math.min(Math.max(margin, left), viewport.width - width - margin);
    if (!Number.isFinite(left) || left < margin) left = margin;

    const below = markRect.bottom + gap;
    const above = markRect.top - height - gap;
    const fitsBelow = below + height <= viewport.height - margin;
    const fitsAbove = above >= margin;
    let top;
    if (fitsBelow) top = below;
    else if (fitsAbove) top = above;
    else top = Math.max(margin, viewport.height - height - margin);

    return { top, left };
  }

  function ensurePop(doc) {
    let pop = doc.getElementById(POP_ID);
    if (pop) return pop;
    pop = doc.createElement("div");
    pop.id = POP_ID;
    pop.className = "discord-hl-pop";
    pop.hidden = true;
    pop.setAttribute("popover", "manual");
    (doc.documentElement || doc.body).appendChild(pop);
    return pop;
  }

  function hidePop(doc) {
    const pop = doc && doc.getElementById && doc.getElementById(POP_ID);
    if (!pop) return;
    pop.hidden = true;
    if (typeof pop.hidePopover === "function") {
      try {
        pop.hidePopover();
      } catch {
        // already closed
      }
    }
  }

  function showPop(doc, mark) {
    if (!settings.descriptions || !doc || !mark) return null;
    const pop = ensurePop(doc);
    const band = mark.dataset.band || "caution";
    const category = CATEGORY_LABEL[mark.dataset.category] || "Suspicious message";
    const reasons = parseReasons(mark);
    const title = band === "high" ? "High risk signals" : "Caution";
    pop.dataset.band = band;
    pop.innerHTML =
      `<p class="discord-hl-warn">${clickWarning(band)}</p>` +
      `<strong>${title} · ${category}</strong>` +
      (reasons.length
        ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
        : `<p>This wording matches common scam pressure tactics. It is a warning, not a verdict.</p>`);
    pop.hidden = false;
    if (typeof pop.showPopover === "function") {
      try {
        pop.showPopover();
      } catch {
        // already open
      }
    }
    pop.style.top = "0px";
    pop.style.left = "0px";
    void pop.offsetHeight;
    const view = doc.defaultView;
    if (!view) return pop;
    const pos = popupPosition(
      mark.getBoundingClientRect(),
      pop.getBoundingClientRect(),
      { width: view.innerWidth, height: view.innerHeight },
    );
    pop.style.top = `${pos.top}px`;
    pop.style.left = `${pos.left}px`;
    const r = pop.getBoundingClientRect();
    const margin = 8;
    if (r.bottom > view.innerHeight - margin || r.top < margin || r.right > view.innerWidth - margin) {
      const fixed = popupPosition(
        mark.getBoundingClientRect(),
        { width: r.width, height: r.height },
        { width: view.innerWidth, height: view.innerHeight },
      );
      pop.style.top = `${fixed.top}px`;
      pop.style.left = `${fixed.left}px`;
    }
    return pop;
  }

  function bindPop(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.dataset.sherpaPop === "1") return;
    doc.documentElement.dataset.sherpaPop = "1";
    let hideTimer = 0;
    const view = doc.defaultView;
    const clearHide = () => {
      if (view && view.clearTimeout) view.clearTimeout(hideTimer);
    };
    const onOver = (event) => {
      if (!event.target || !event.target.closest) return;
      const mark = event.target.closest("." + HIGHLIGHT_CLASS);
      if (!mark) return;
      clearHide();
      showPop(doc, mark);
    };
    const onOut = (event) => {
      if (!event.target || !event.target.closest) return;
      const mark = event.target.closest("." + HIGHLIGHT_CLASS);
      if (!mark) return;
      const next = event.relatedTarget;
      if (next && next.closest && (next.closest("." + HIGHLIGHT_CLASS) || next.closest(".discord-hl-pop"))) {
        return;
      }
      hideTimer = (view && view.setTimeout ? view.setTimeout : setTimeout)(() => hidePop(doc), 120);
    };
    doc.addEventListener("pointerover", onOver, true);
    doc.addEventListener("mouseover", onOver, true);
    doc.addEventListener("pointerout", onOut, true);
    doc.addEventListener("mouseout", onOut, true);
  }

  function highlightContext(anchor, baseHref) {
    const mark = anchor && anchor.closest ? anchor.closest("." + HIGHLIGHT_CLASS) : null;
    return {
      inHighlight: Boolean(mark),
      band: mark ? mark.dataset.band || "caution" : "ok",
      mismatch: linkMismatch(anchor, baseHref),
      mark,
    };
  }

  function hideGate(doc) {
    if (!doc || !doc.querySelectorAll) return;
    doc.querySelectorAll("." + GATE_CLASS).forEach((node) => node.remove());
  }

  function gateCopy(info) {
    if (info && info.mismatch) {
      return {
        title: "This link does not match its destination",
        body: "The words on the link do not match the site it actually opens.",
      };
    }
    if (info && info.band === "high") {
      return {
        title: clickWarning("high"),
        body: "This link sits in a high-risk highlight.",
      };
    }
    return {
      title: clickWarning("caution"),
      body: "This link sits in highlighted text.",
    };
  }

  function showGate(doc, info, onContinue) {
    hideGate(doc);
    const root = doc.createElement("div");
    root.className = GATE_CLASS;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    const copy = gateCopy(info);
    const href = (info && info.href) || "";
    root.innerHTML =
      `<div class="sherpa-gate-card">` +
      `<p class="discord-hl-warn">${escapeHtml(copy.title)}</p>` +
      `<p>${escapeHtml(copy.body)}</p>` +
      `<p>You are being redirected to:</p>` +
      `<p class="sherpa-gate-url">${escapeHtml(href)}</p>` +
      `<div class="sherpa-gate-actions">` +
      `<button type="button" data-act="back">Go back</button>` +
      `<button type="button" data-act="go">Continue</button>` +
      `</div></div>`;
    const finish = (go) => {
      hideGate(doc);
      if (go && typeof onContinue === "function") onContinue();
    };
    root.addEventListener("click", (event) => {
      const act = event.target && event.target.getAttribute && event.target.getAttribute("data-act");
      if (act === "back") finish(false);
      if (act === "go") finish(true);
      if (event.target === root) finish(false);
    });
    (doc.body || doc.documentElement).appendChild(root);
    return root;
  }

  function bindIntercepts(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.dataset.sherpaGate === "1") return;
    doc.documentElement.dataset.sherpaGate = "1";
    const allowed = new WeakSet();
    doc.addEventListener(
      "click",
      (event) => {
        if (!event.target || !event.target.closest) return;
        const anchor = event.target.closest("a[href]");
        if (!anchor || allowed.has(anchor) || anchor.closest("." + GATE_CLASS)) return;
        const view = doc.defaultView;
        const baseHref = view && view.location ? view.location.href : "";
        const url = resolveHref(anchor, baseHref);
        if (!url) return;
        const ctx = highlightContext(anchor, baseHref);
        if (!shouldIntercept(settings.aggression, ctx)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        showGate(doc, { href: url.href, ...ctx }, () => {
          allowed.add(anchor);
          if (!view) return;
          if (anchor.target === "_blank" && typeof view.open === "function") {
            view.open(url.href, "_blank", "noopener");
            return;
          }
          try {
            view.location.href = url.href;
          } catch {
            if (typeof view.open === "function") view.open(url.href, "_self");
          }
        });
      },
      true,
    );
  }

  function paintContent(content, text) {
    if (!content || content.nodeType !== 1) return;
    const key = text;
    const result = analyze(text);
    const hasMark = Boolean(content.querySelector && content.querySelector("." + HIGHLIGHT_CLASS));
    if (content.dataset.scamKey === key) {
      if (result.band === "ok") return;
      if (hasMark) return;
    }
    unwrap(content);
    content.dataset.scamKey = key;
    if (result.band === "ok") return;
    wrapInlineDeep(content, result);
  }

  function mark(el) {
    const found = hostFor(el);
    if (!found) return;
    const { host, adapter } = found;
    const contents = contentsFor(host, adapter);
    if (adapter.contentsOf) {
      contents.forEach((content) => paintContent(content, messageText(content, adapter)));
      return;
    }
    const content = contents[0];
    if (!content) return;
    paintContent(content, messageText(content, adapter));
    const view = (el.ownerDocument && el.ownerDocument.defaultView) || (host.ownerDocument && host.ownerDocument.defaultView);
    scheduleDiscordRepaint(host, view);
  }

  function scan(root = document) {
    if (!root) return;
    const doc = root.ownerDocument || root;
    const adapters = adaptersFor(doc);
    if (root.nodeType === 1) mark(root);
    if (!root.querySelectorAll) return;
    adapters.forEach((adapter) => {
      adapter.hostsIn(root).forEach((host) => mark(host));
    });
  }

  function isOurPaint(node) {
    if (!node) return false;
    if (node.nodeType === 3) {
      return Boolean(node.parentElement && node.parentElement.closest("." + HIGHLIGHT_CLASS));
    }
    if (node.nodeType !== 1) return false;
    if (
      node.classList &&
      (node.classList.contains(HIGHLIGHT_CLASS) ||
        node.classList.contains(WHY_CLASS) ||
        node.classList.contains(GATE_CLASS) ||
        node.classList.contains(SELECT_BAR) ||
        node.classList.contains("discord-hl-pop"))
    ) {
      return true;
    }
    return Boolean(
      node.closest &&
        (node.closest("." + HIGHLIGHT_CLASS) ||
          node.closest("." + WHY_CLASS) ||
          node.closest("." + GATE_CLASS) ||
          node.closest("." + SELECT_BAR) ||
          node.closest(".discord-hl-pop")),
    );
  }

  function isGoogleSurface(doc) {
    const host = hostnameOf(doc);
    if (GOOGLE.matchHost(host)) return true;
    return Boolean(doc.querySelector && doc.querySelector("[data-sherpa-google]"));
  }

  function ensureSelectBar(doc) {
    let bar = doc.getElementById(SELECT_BAR);
    if (bar) return bar;
    bar = doc.createElement("div");
    bar.id = SELECT_BAR;
    bar.className = SELECT_BAR;
    bar.hidden = true;
    bar.setAttribute("role", "status");
    (doc.body || doc.documentElement).appendChild(bar);
    return bar;
  }

  function fillSelectBar(bar, result, source) {
    const band = result.band || "caution";
    const title = band === "high" ? "High risk signals" : "Caution";
    const reasons = (result.reasons || []).slice(0, 3);
    bar.dataset.band = band;
    bar.dataset.source = source || "selected text";
    bar.innerHTML =
      `<p class="discord-hl-warn">${clickWarning(band)}</p>` +
      `<strong>${title} · ${escapeHtml(source || "selected text")}</strong>` +
      (settings.descriptions && reasons.length
        ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
        : "");
  }

  function scoreLiveText(doc, text, source) {
    const view = doc && doc.defaultView;
    if (view && view.parent && view.parent !== view) {
      try {
        view.parent.postMessage({ type: "sherpa-live", text: String(text || ""), source: source || "typed text" }, view.location.origin);
        return analyze(String(text || ""));
      } catch {
        // stay in this frame
      }
    }
    const bar = ensureSelectBar(doc);
    const cleaned = String(text || "").replace(/\s+/g, " ").trim();
    if (cleaned.length < 8) {
      bar.hidden = true;
      return { score: 0, band: "ok", reasons: [] };
    }
    const result = analyze(cleaned);
    if (result.band === "ok") {
      bar.hidden = true;
      return result;
    }
    fillSelectBar(bar, result, source || "typed text");
    bar.hidden = false;
    return result;
  }

  function bindGoogleTyping(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.dataset.sherpaType === "1") return;
    if (!isGoogleSurface(doc)) return;
    doc.documentElement.dataset.sherpaType = "1";
    const view = doc.defaultView;
    const wired = new WeakSet();
    let typed = "";

    const fromEditor = (el) => String((el && (el.value || el.innerText || el.textContent)) || "").replace(/\s+/g, " ").trim();

    const scoreEditor = (el) => {
      const live = fromEditor(el);
      scoreLiveText(doc, live.length >= 8 ? live : typed, "typed text");
    };

    const attach = (el) => {
      if (!el || wired.has(el)) return;
      if (el.closest && el.closest("." + SELECT_BAR + ", ." + GATE_CLASS + ", .discord-hl-pop")) return;
      wired.add(el);
      const bump = () => scoreEditor(el);
      el.addEventListener("input", bump, true);
      el.addEventListener("keyup", bump, true);
    };

    const bindIframe = (iframe) => {
      if (!iframe || wired.has(iframe)) return;
      wired.add(iframe);
      const hook = () => {
        let idoc = null;
        try {
          idoc = iframe.contentDocument;
        } catch {
          return;
        }
        if (!idoc || !idoc.documentElement || idoc.documentElement.dataset.sherpaType === "1") return;
        idoc.documentElement.dataset.sherpaType = "1";
        const read = () => {
          const body = idoc.body ? String(idoc.body.innerText || idoc.body.textContent || "").trim() : "";
          scoreLiveText(doc, body.length >= 8 ? body : typed, "typed text");
        };
        idoc.addEventListener("input", read, true);
        idoc.addEventListener("keyup", read, true);
        idoc.addEventListener(
          "keydown",
          (event) => {
            if (event.key === "Enter") typed += " ";
            else if (event.key === "Backspace") typed = typed.slice(0, -1);
            else if (event.key && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
              typed += event.key;
            }
            if (typed.length > 2000) typed = typed.slice(-2000);
            read();
          },
          true,
        );
      };
      iframe.addEventListener("load", hook);
      hook();
    };

    const scanEditors = (root) => {
      if (!root || !root.querySelectorAll) return;
      root.querySelectorAll('[contenteditable="true"], textarea, [role="textbox"]').forEach(attach);
      root.querySelectorAll("iframe.docs-texteventtarget-iframe, iframe[class*='texteventtarget']").forEach(bindIframe);
    };

    scanEditors(doc);
    if (view && typeof view.addEventListener === "function") {
      view.addEventListener("message", (event) => {
        if (!event || !event.data || event.data.type !== "sherpa-live") return;
        if (event.origin && view.location && event.origin !== view.location.origin) return;
        scoreLiveText(doc, event.data.text, event.data.source || "typed text");
      });
    }
    const ua = (view && view.navigator && view.navigator.userAgent) || "";
    if (view && typeof view.setInterval === "function" && !/jsdom/i.test(ua)) {
      view.setInterval(() => scanEditors(doc), 900);
    }
  }

  function bindGoogleSelection(doc) {
    if (!doc || !doc.documentElement || doc.documentElement.dataset.sherpaSelect === "1") return;
    if (!isGoogleSurface(doc)) return;
    doc.documentElement.dataset.sherpaSelect = "1";
    const view = doc.defaultView;
    let timer = 0;
    const update = () => {
      timer = 0;
      const bar = ensureSelectBar(doc);
      const sel = doc.getSelection ? doc.getSelection() : null;
      const text = sel ? String(sel).replace(/\s+/g, " ").trim() : "";
      if (!settings.descriptions || !text || text.length < 12) {
        bar.hidden = true;
        return;
      }
      const anchor = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
      if (anchor && anchor.closest && (anchor.closest("." + SELECT_BAR) || anchor.closest("." + GATE_CLASS))) {
        return;
      }
      const result = analyze(text);
      if (result.band === "ok") {
        bar.hidden = true;
        return;
      }
      fillSelectBar(bar, result);
      bar.hidden = false;
    };
    const schedule = () => {
      if (timer) return;
      timer = (view && view.setTimeout ? view.setTimeout : setTimeout)(update, 40);
    };
    doc.addEventListener("mouseup", schedule, true);
    doc.addEventListener("keyup", schedule, true);
  }

  function processAddedNode(node) {
    if (isOurPaint(node)) return;
    if (node.nodeType === 3) {
      mark(node);
      return;
    }
    if (node.nodeType !== 1) return;
    mark(node);
    scan(node);
  }

  function scheduleDiscordRepaint(host, view) {
    if (!host || !view || typeof view.setTimeout !== "function") return;
    const ua = (view.navigator && view.navigator.userAgent) || "";
    if (/jsdom/i.test(ua)) return;
    const found = hostFor(host);
    if (!found || found.adapter.name !== "discord") return;
    const content = contentsFor(found.host, found.adapter)[0];
    const text = content ? messageText(content, found.adapter) : "";
    if (text && content && content.querySelector("." + HIGHLIGHT_CLASS)) return;
    if (found.host.dataset.scamRetry === "1") return;
    found.host.dataset.scamRetry = "1";
    const delays = [80, 280, 900];
    delays.forEach((ms, index) => {
      view.setTimeout(() => {
        const again = hostFor(found.host) || found;
        const next = contentsFor(again.host, again.adapter)[0];
        if (next) paintContent(next, messageText(next, again.adapter));
        if (index === delays.length - 1) delete found.host.dataset.scamRetry;
      }, ms);
    });
  }

  function start(doc = document) {
    if (prefsApi) {
      prefsApi.load(applySettings);
      prefsApi.subscribe(applySettings);
    }
    bindPop(doc);
    bindIntercepts(doc);
    bindGoogleSelection(doc);
    bindGoogleTyping(doc);
    scan(doc);
    const view = doc.defaultView;
    const Observer =
      (view && view.MutationObserver) ||
      (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (!Observer) return null;
    let timer = 0;
    const pending = new Set();
    const flush = () => {
      timer = 0;
      const batch = Array.from(pending);
      pending.clear();
      batch.forEach((node) => processAddedNode(node));
    };
    const queue = (node) => {
      if (!node || isOurPaint(node)) return;
      pending.add(node);
      if (timer) return;
      timer = (view && view.setTimeout ? view.setTimeout : setTimeout)(flush, 32);
    };
    const observer = new Observer((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          queue(mutation.target);
          continue;
        }
        if (mutation.type === "attributes") {
          queue(mutation.target);
          continue;
        }
        for (const added of mutation.addedNodes) {
          queue(added);
        }
        if (mutation.removedNodes && mutation.removedNodes.length) {
          let wiped = false;
          for (const removed of mutation.removedNodes) {
            if (isOurPaint(removed)) {
              wiped = true;
              break;
            }
          }
          if (wiped) queue(mutation.target);
        }
      }
    });
    observer.observe(doc.documentElement || doc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id", "aria-label", "href"],
      characterData: true,
    });
    const ua = (view && view.navigator && view.navigator.userAgent) || "";
    if (view && typeof view.setInterval === "function" && !/jsdom/i.test(ua)) {
      let href = "";
      try {
        href = view.location.href;
      } catch {
        href = "";
      }
      view.setInterval(() => {
        let next = href;
        try {
          next = view.location.href;
        } catch {
          return;
        }
        if (next === href) return;
        href = next;
        scan(doc);
      }, 400);
    }
    return observer;
  }

  function pingStatus(doc = document) {
    const host = hostnameOf(doc);
    const adapters = adaptersFor(doc);
    return {
      ok: true,
      host,
      site: adapters.length === 1 ? adapters[0].name : adapters.map((a) => a.name).join(","),
      marks: doc.querySelectorAll ? doc.querySelectorAll("." + HIGHLIGHT_CLASS).length : 0,
    };
  }

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === "sherpa-ping" || msg.type === "scam-smell-ping") {
        sendResponse(pingStatus(document));
        return;
      }
      if (msg.type === "sherpa-prefs") {
        if (msg.settings) applySettings(msg.settings);
        else if (prefsApi) {
          prefsApi.load((value) => {
            applySettings(value);
            sendResponse({ ok: true, settings });
          });
          return true;
        }
        sendResponse({ ok: true, settings });
      }
    });
  }

  const api = {
    HIGHLIGHT_CLASS,
    WHY_CLASS,
    GATE_CLASS,
    isUserMessage,
    mark,
    scan,
    processAddedNode,
    start,
    analyze,
    clickWarning,
    applySettings,
    resolveHref,
    linkMismatch,
    shouldIntercept,
    highlightContext,
    popupPosition,
    showPop,
    hidePop,
    showGate,
    hideGate,
    scoreLiveText,
    adaptersFor,
    pingStatus,
  };
  globalThis.Sherpa = api;

  if (typeof document !== "undefined" && document.documentElement) {
    start(document);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
