(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const POP_ID = "discord-hl-pop";
  const BLOCK_TAGS = /^(PRE|UL|OL|BLOCKQUOTE|DIV|TABLE|H[1-6]|HR)$/;
  const SKIP_CHROME = "nav, header, footer, aside, [role='navigation'], [role='banner'], [role='tablist'], time, textarea, [contenteditable='true']";
  const IG_UI =
    /^(liked by|view all(?: \d+ comments?)?|follow|following|suggested for you|see translation|sent|home|search|reels|shop|messages|notifications|create|more|log in|sign up|see all|liked your|started following|\d+[kmb]?\s*(?:likes?|comments?|views?))$/i;
  const IG_HOST_SEL =
    '[dir="auto"], [role="none"], [role="presentation"], [role="row"], [role="listitem"], span, p, h1';
  const IG_NOT_BUBBLE =
    "form, main, article, nav, header, footer, aside, [role='log'], [role='navigation'], [role='banner'], [data-pagelet], [aria-label*='onversation' i], [aria-label*='essages' i]";
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
      if (!id.startsWith("chat-messages-")) return false;
      return Boolean(el.querySelector('[id^="message-content-"]'));
    },
    closestHost(el) {
      const host = el && el.closest ? el.closest('[id^="chat-messages-"]') : null;
      return host && this.isHost(host) ? host : null;
    },
    hostsIn(root) {
      if (!root || !root.querySelectorAll) return [];
      const found = [];
      if (this.isHost(root)) found.push(root);
      root.querySelectorAll('[id^="chat-messages-"]').forEach((el) => {
        if (this.isHost(el)) found.push(el);
      });
      return unique(found);
    },
    contentOf(host) {
      return host.querySelector('[id^="message-content-"]');
    },
  };

  const INSTAGRAM = {
    name: "instagram",
    matchHost: (host) => /(?:^|\.)instagram\.com$/.test(host),
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
    skip(el) {
      if (!el || el.nodeType !== 1 || !el.closest) return true;
      if (el.closest("nav, [role='navigation'], [role='tablist'], [role='banner'], footer, aside")) return true;
      if (el.closest("textarea, [contenteditable='true'], svg")) return true;
      return false;
    },
    isNotBubble(el) {
      return Boolean(el && el.matches && el.matches(IG_NOT_BUBBLE));
    },
    isFragment(el) {
      if (!el || !el.matches || !el.matches(IG_HOST_SEL)) return false;
      if (this.skip(el) || this.isNotBubble(el)) return false;
      const text = this.visibleText(el);
      if (!text || text.length > 1500) return false;
      if (IG_UI.test(text)) return false;
      return true;
    },
    isTextLeaf(el) {
      if (!el || el.nodeType !== 1 || this.skip(el) || this.isNotBubble(el)) return false;
      const text = this.visibleText(el);
      if (!text || text.length > 80) return false;
      if (IG_UI.test(text)) return false;
      const childCount = el.children ? el.children.length : 0;
      return childCount <= 2;
    },
    isCandidate(el) {
      if (!this.isFragment(el)) return false;
      const text = this.visibleText(el);
      if (text.length < 8) return false;
      if (HANDLE_ONLY.test(text) && !/\s/.test(text)) return false;
      return true;
    },
    pieceNodes(el) {
      if (!el || !el.children) return [];
      const usable = (node) => this.isFragment(node) || this.isTextLeaf(node);
      const direct = Array.from(el.children).filter(usable);
      if (direct.length >= 2) return direct;
      const nested = [];
      Array.from(el.children).forEach((wrap) => {
        if (this.skip(wrap) || this.isNotBubble(wrap)) return;
        const kids = Array.from(wrap.children || []).filter(usable);
        if (kids.length) nested.push(...kids);
        else if (usable(wrap)) nested.push(wrap);
      });
      return nested.length >= 2 ? nested : direct;
    },
    isSplitParent(el) {
      if (!el || el.nodeType !== 1 || this.skip(el) || this.isNotBubble(el)) return false;
      const pieces = this.pieceNodes(el);
      if (pieces.length < 2 || pieces.length > 80) return false;
      const texts = pieces.map((node) => this.visibleText(node)).filter(Boolean);
      if (texts.length < 2) return false;
      const combined = texts.join(" ").replace(/\s+/g, " ").trim();
      if (combined.length < 8 || combined.length > 800) return false;
      if (IG_UI.test(combined)) return false;
      const wordLike = texts.filter((text) => text.length <= 40 && !/\s/.test(text)).length;
      if (wordLike >= texts.length * 0.6) return true;
      const shortish = texts.filter((text) => text.length <= 80).length;
      if (texts.length <= 8 && shortish === texts.length) {
        const longest = Math.max(...texts.map((text) => text.length));
        return longest < combined.length * 0.7;
      }
      return false;
    },
    ancestorSplit(el) {
      let node = el && el.parentElement;
      for (let i = 0; i < 6 && node; i += 1) {
        if (this.isNotBubble(node)) return null;
        if (this.isSplitParent(node)) return node;
        node = node.parentElement;
      }
      return null;
    },
    isHost(el) {
      if (this.isSplitParent(el)) {
        const outer = this.ancestorSplit(el);
        return !outer;
      }
      if (!this.isCandidate(el)) return false;
      if (this.ancestorSplit(el)) return false;
      const text = this.visibleText(el);
      const kids = el.querySelectorAll ? el.querySelectorAll(IG_HOST_SEL) : [];
      for (const kid of kids) {
        if (kid === el) continue;
        if (!this.isCandidate(kid) && !this.isSplitParent(kid)) continue;
        if (this.visibleText(kid).length >= text.length * 0.7) return false;
      }
      return true;
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
        '[data-pagelet="IGDMessagesList"], [aria-label*="onversation" i], [aria-label*="essages" i], [role="log"], article';
      if (root.matches && root.matches(scopeSel + ", main, form")) scopes.push(root);
      root.querySelectorAll(scopeSel).forEach((el) => scopes.push(el));
      if (root.querySelectorAll) {
        root.querySelectorAll("form").forEach((el) => {
          if (el.querySelector && el.querySelector('[aria-label*="onversation" i], [data-pagelet="IGDMessagesList"]')) {
            scopes.push(el);
          }
        });
      }
      const search = unique(scopes.length ? scopes : [root]);
      const found = [];
      for (const scope of search) {
        if (this.isHost(scope)) found.push(scope);
        if (!scope.querySelectorAll) continue;
        const parents = new Set();
        scope.querySelectorAll(IG_HOST_SEL).forEach((el) => {
          if (this.isHost(el)) found.push(el);
          let parent = el.parentElement;
          for (let i = 0; i < 5 && parent && parent !== scope; i += 1) {
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

  const ALL_ADAPTERS = [DISCORD, INSTAGRAM, REDDIT];

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

  function wrapDeep(contentEl, result) {
    wrapInlineRuns(contentEl, result);
    if (contentEl.querySelector && contentEl.querySelector("." + HIGHLIGHT_CLASS)) return;
    const blocks = Array.from(contentEl.children || []).filter(
      (node) =>
        node.nodeType === 1 &&
        BLOCK_TAGS.test(node.tagName) &&
        !(node.classList && node.classList.contains(HIGHLIGHT_CLASS)),
    );
    if (blocks.length) {
      blocks.forEach((block) => wrapDeep(block, result));
      if (contentEl.querySelector && contentEl.querySelector("." + HIGHLIGHT_CLASS)) return;
    }
    const text = String(contentEl.textContent || "").trim();
    if (!text) return;
    const doc = contentEl.ownerDocument;
    const mark = doc.createElement("span");
    mark.className = HIGHLIGHT_CLASS;
    applyResult(mark, result);
    while (contentEl.firstChild) mark.appendChild(contentEl.firstChild);
    contentEl.appendChild(mark);
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
  }

  function ensurePop(doc) {
    let pop = doc.getElementById(POP_ID);
    if (pop) return pop;
    pop = doc.createElement("div");
    pop.id = POP_ID;
    pop.className = "discord-hl-pop";
    pop.hidden = true;
    doc.body.appendChild(pop);
    return pop;
  }

  function clickWarning(band) {
    return band === "high" ? "DO NOT CLICK" : "BE CAREFUL BEFORE CLICKING THIS";
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

  function showPop(doc, mark) {
    const pop = ensurePop(doc);
    const band = mark.dataset.band || "caution";
    const category = CATEGORY_LABEL[mark.dataset.category] || "Suspicious message";
    let reasons = [];
    try {
      reasons = JSON.parse(mark.dataset.reasons || "[]");
    } catch {
      reasons = [];
    }
    const title = band === "high" ? "High risk signals" : "Caution";
    pop.dataset.band = band;
    pop.innerHTML =
      `<p class="discord-hl-warn">${clickWarning(band)}</p>` +
      `<strong>${title} · ${category}</strong>` +
      (reasons.length
        ? `<ul>${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
        : `<p>This wording matches common scam pressure tactics. It is a warning, not a verdict.</p>`);
    pop.hidden = false;
    pop.style.top = "0px";
    pop.style.left = "0px";
    void pop.offsetHeight;
    const view = doc.defaultView;
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
  }

  function hidePop(doc) {
    const pop = doc.getElementById(POP_ID);
    if (pop) pop.hidden = true;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function bindPop(doc) {
    if (doc.documentElement.dataset.discordHlPop === "1") return;
    doc.documentElement.dataset.discordHlPop = "1";
    let hideTimer = 0;
    doc.addEventListener(
      "mouseover",
      (event) => {
        const mark = event.target.closest ? event.target.closest("." + HIGHLIGHT_CLASS) : null;
        if (!mark) return;
        doc.defaultView.clearTimeout(hideTimer);
        showPop(doc, mark);
      },
      true,
    );
    doc.addEventListener(
      "mouseout",
      (event) => {
        const mark = event.target.closest ? event.target.closest("." + HIGHLIGHT_CLASS) : null;
        if (!mark) return;
        hideTimer = doc.defaultView.setTimeout(() => hidePop(doc), 120);
      },
      true,
    );
  }

  function paintContent(content, text) {
    if (!content || content.nodeType !== 1) return;
    const key = text;
    if (content.dataset.scamKey === key) return;
    const result = analyze(text);
    unwrap(content);
    content.dataset.scamKey = key;
    if (result.band === "ok") return;
    wrapDeep(content, result);
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

  function processAddedNode(node) {
    if (node.nodeType === 3) {
      mark(node);
      return;
    }
    if (node.nodeType !== 1) return;
    mark(node);
    scan(node);
  }

  function start(doc = document) {
    bindPop(doc);
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
      pending.add(node);
      if (timer) return;
      timer = (view && view.setTimeout ? view.setTimeout : setTimeout)(flush, 16);
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
      if (!msg || msg.type !== "scam-smell-ping") return;
      sendResponse(pingStatus(document));
    });
  }

  const api = {
    HIGHLIGHT_CLASS,
    isUserMessage,
    mark,
    scan,
    processAddedNode,
    start,
    analyze,
    clickWarning,
    popupPosition,
    showPop,
    adaptersFor,
    pingStatus,
  };

  if (typeof document !== "undefined" && document.documentElement) {
    start(document);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
