(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const POP_ID = "discord-hl-pop";
  const BLOCK_TAGS = /^(PRE|UL|OL|BLOCKQUOTE|DIV|TABLE|H[1-6]|HR)$/;
  const SKIP_CHROME = "nav, header, footer, aside, [role='navigation'], [role='banner'], [role='tablist'], button, [role='button'], time, textarea, [contenteditable='true'], form";
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
    isUseful(el) {
      if (!el || el.nodeType !== 1) return false;
      if (skipChrome(el)) return false;
      if (el.closest && el.closest("svg, img, video")) return false;
      const text = (el.innerText || el.textContent || "").trim();
      if (!text) return false;
      if (HANDLE_ONLY.test(text) && !/\s/.test(text)) return false;
      if (/^(liked by|view all|follow|following|suggested for you|see translation|sent)$/i.test(text)) {
        return false;
      }
      return true;
    },
    isHost(el) {
      if (!el || el.getAttribute("dir") !== "auto") return false;
      if (el.querySelector('[dir="auto"]')) return false;
      return this.isUseful(el);
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
      if (root.matches) {
        if (
          root.matches(
            '[data-pagelet="IGDMessagesList"], [aria-label^="Conversation"], [aria-label^="conversation"], article, main, [role="row"]',
          )
        ) {
          scopes.push(root);
        }
      }
      if (root.querySelectorAll) {
        root
          .querySelectorAll(
            '[data-pagelet="IGDMessagesList"], [aria-label^="Conversation"], [aria-label^="conversation"], article, [role="row"], [role="none"], [role="presentation"]',
          )
          .forEach((el) => scopes.push(el));
      }
      const search = scopes.length ? unique(scopes) : [root];
      const found = [];
      for (const scope of search) {
        const nodes = scope.querySelectorAll ? scope.querySelectorAll('[dir="auto"]') : [];
        innermost(nodes, '[dir="auto"]').forEach((el) => {
          if (this.isHost(el)) found.push(el);
        });
        if (this.isHost(scope)) found.push(scope);
      }
      return unique(found);
    },
    contentOf(host) {
      return host;
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

  function messageText(contentEl) {
    const text = (contentEl.innerText || contentEl.textContent || "").trim();
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
    wrapInlineRuns(content, result);
  }

  function mark(el) {
    const found = hostFor(el);
    if (!found) return;
    const { host, adapter } = found;
    const contents = contentsFor(host, adapter);
    if (adapter.contentsOf) {
      contents.forEach((content) => paintContent(content, messageText(content)));
      return;
    }
    const content = contents[0];
    if (!content) return;
    paintContent(content, messageText(content));
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
  };

  if (typeof document !== "undefined" && document.documentElement) {
    start(document);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
