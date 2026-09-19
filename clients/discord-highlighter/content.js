(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const WHY_CLASS = "sherpa-why-panel";
  const GATE_CLASS = "sherpa-gate";
  const SELECT_BAR = "sherpa-select-bar";
  const POP_ID = "sherpa-hl-pop";
  const prefsApi = globalThis.SherpaPrefs;
  let settings = prefsApi
    ? prefsApi.normalize(prefsApi.DEFAULTS)
    : { aggression: "warn", descriptions: true, theme: "dark" };
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

  function parentHostname(doc) {
    try {
      const view = doc && doc.defaultView;
      const parent = view && view.parent;
      if (!parent || parent === view) return "";
      return parent.location.hostname || "";
    } catch {
      return "";
    }
  }

  function effectiveHost(doc) {
    return hostnameOf(doc) || parentHostname(doc) || "";
  }

  function queryAllDeep(root, selector) {
    const out = [];
    const seen = new Set();
    const add = (el) => {
      if (!el || seen.has(el)) return;
      seen.add(el);
      out.push(el);
    };
    const walk = (node) => {
      if (!node) return;
      if (node.nodeType === 1 && node.matches) {
        try {
          if (node.matches(selector)) add(node);
        } catch {
          // invalid selector in this root
        }
      }
      let matches = [];
      try {
        matches = node.querySelectorAll ? node.querySelectorAll(selector) : [];
      } catch {
        matches = [];
      }
      Array.from(matches).forEach(add);
      const all = node.querySelectorAll ? node.querySelectorAll("*") : [];
      for (const el of all) {
        if (el.shadowRoot) walk(el.shadowRoot);
      }
      if (node.shadowRoot) walk(node.shadowRoot);
    };
    walk(root);
    return out;
  }

  function eachSameOriginDoc(doc, visit) {
    if (!doc || typeof visit !== "function") return;
    const seen = new Set();
    const walk = (node) => {
      if (!node || seen.has(node)) return;
      seen.add(node);
      visit(node);
      const frames = node.querySelectorAll ? node.querySelectorAll("iframe") : [];
      Array.from(frames).forEach((iframe) => {
        try {
          if (iframe.contentDocument) walk(iframe.contentDocument);
        } catch {
          // cross-origin child
        }
      });
    };
    walk(doc);
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
          let rootParent = el.parentElement;
          for (let i = 0; i < 4 && rootParent && rootParent !== scope && !this.isThread(rootParent); i += 1) {
            parents.add(rootParent);
            rootParent = rootParent.parentElement;
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

  const GOOGLE_CHROME =
    "nav, header, [role='navigation'], [role='banner'], [role='menubar'], [role='menu'], textarea, svg, img, video, .goog-menuitem, .menu-button";
  const GOOGLE_COMPOSE =
    ".docos-input, .docos-input-textarea, .docos-replyview-replybox, .docos-replyview-edit-pane, [aria-label='Join the discussion'], [aria-label^='New comment' i], [aria-label^='Reply' i][contenteditable='true']";
  const GOOGLE_HOST_SEL = [
    ".docos-replyview-body",
    ".docos-replyview-comment",
    ".docos-replyview-content",
    ".docos-docoview-content",
    ".docos-collapsible-replyview",
    "[data-comment-id]",
    "[aria-label='Comments'] [role='article']",
    "[aria-label='Comments'] [role='listitem']",
    "[aria-label*='comment' i] .docos-replyview-body",
    "[aria-label*='Comments' i] p",
    ".drive-viewer-paginated-page .textLayer",
    ".drive-viewer-paginated-page [role='document']",
    "[data-target='doc'] .docos-replyview-body",
    ".docos-anchoreddocoview .docos-docoview-content",
    ".docos-streamdocoview .docos-docoview-content",
  ].join(",");

  const GOOGLE = {
    name: "google",
    matchHost: (host) => /(?:^|\.)drive\.google\.com$/.test(host),
    skip(el) {
      if (!el || el.nodeType !== 1 || !el.closest) return true;
      if (el.closest(GOOGLE_COMPOSE)) return true;
      // Comment cards on Drive are often role=button. Still highlight them.
      if (el.closest(GOOGLE_HOST_SEL) || (el.matches && el.matches(GOOGLE_HOST_SEL))) return false;
      if (el.closest(GOOGLE_CHROME)) return true;
      return false;
    },
    isHost(el) {
      if (!el || el.nodeType !== 1 || this.skip(el)) return false;
      if (!(el.matches && el.matches(GOOGLE_HOST_SEL))) return false;
      if (
        el.matches("[data-comment-id], .docos-replyview-comment, .docos-collapsible-replyview") &&
        el.querySelector &&
        el.querySelector(".docos-replyview-body, .docos-replyview-content, .docos-docoview-content")
      ) {
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
      if (!root) return [];
      const found = [];
      if (this.isHost(root)) found.push(root);
      queryAllDeep(root, GOOGLE_HOST_SEL).forEach((el) => {
        if (this.isHost(el)) found.push(el);
      });
      return unique(found);
    },
    contentOf(host) {
      if (!host) return host;
      if (host.matches && host.matches("[data-comment-id], .docos-replyview-comment, .docos-collapsible-replyview")) {
        return (
          host.querySelector(".docos-replyview-body, .docos-replyview-content, .docos-docoview-content") || host
        );
      }
      return host;
    },
  };

  const ALL_ADAPTERS = [DISCORD, INSTAGRAM, REDDIT, GOOGLE];

  function adaptersFor(doc) {
    const host = effectiveHost(doc);
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

  function paintDocSettings(doc) {
    if (!doc || !doc.documentElement) return;
    doc.documentElement.dataset.sherpaDesc = settings.descriptions ? "1" : "0";
    doc.documentElement.dataset.sherpaHl = "on";
    if (prefsApi && prefsApi.applyTheme) prefsApi.applyTheme(doc, settings.theme);
    if (!settings.descriptions) hidePop(doc);
    if (doc.querySelectorAll) {
      doc.querySelectorAll("." + WHY_CLASS).forEach((panel) => {
        if (!settings.descriptions) panel.hidden = true;
      });
    }
  }

  function applySettings(next, origin) {
    settings = prefsApi
      ? prefsApi.normalize(next)
      : { aggression: "warn", descriptions: true, theme: "dark" };
    if (typeof document !== "undefined") {
      eachSameOriginDoc(document, paintDocSettings);
    }
    if (origin !== "message") {
      try {
        const view = typeof document !== "undefined" ? document.defaultView : null;
        if (view && view.location) {
          const payload = { type: "sherpa-prefs", settings };
          if (view.parent && view.parent !== view) {
            view.parent.postMessage(payload, view.location.origin);
          }
          const frames = view.frames || [];
          for (let i = 0; i < frames.length; i += 1) {
            try {
              frames[i].postMessage(payload, view.location.origin);
            } catch {
              // cross-origin child
            }
          }
        }
      } catch {
        // ignore
      }
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

  function popupGapFor(doc) {
    return /(?:^|\.)instagram\.com$/.test(effectiveHost(doc)) ? 22 : 8;
  }

  function popupPosition(markRect, popSize, viewport, gap = 8, margin = 8, preferAbove = false) {
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
    if (preferAbove && fitsAbove) top = above;
    else if (!preferAbove && fitsBelow) top = below;
    else if (fitsAbove) top = above;
    else if (fitsBelow) top = below;
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
    const snippet = String((mark && mark.textContent) || "").replace(/\s+/g, " ").trim();
    pop.innerHTML =
      `<p class="discord-hl-warn">${clickWarning(band)}</p>` +
      `<strong>${title} · ${category}</strong>` +
      (reasons.length
        ? `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>`
        : `<p>This wording matches common scam pressure tactics. It is a warning, not a verdict.</p>`;
