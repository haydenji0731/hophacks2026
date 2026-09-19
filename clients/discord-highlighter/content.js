(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const POP_ID = "discord-hl-pop";
  const BLOCK_TAGS = /^(PRE|UL|OL|BLOCKQUOTE|DIV|TABLE|H[1-6]|HR)$/;
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

  function isUserMessage(el) {
    if (!el || el.nodeType !== 1) return false;
    const id = el.id || "";
    if (!id.startsWith("chat-messages-")) return false;
    return Boolean(el.querySelector('[id^="message-content-"]'));
  }

  function messageText(contentEl) {
    const text = (contentEl.innerText || contentEl.textContent || "").trim();
    const hrefs = Array.from(contentEl.querySelectorAll("a[href]"))
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

  function mark(el) {
    const host =
      el && el.nodeType === 1
        ? el.id && el.id.startsWith("chat-messages-")
          ? el
          : el.closest
            ? el.closest('[id^="chat-messages-"]')
            : null
        : null;
    if (!isUserMessage(host)) return;
    const content = host.querySelector('[id^="message-content-"]');
    if (!content) return;
    const text = messageText(content);
    const key = text;
    if (content.dataset.scamKey === key) return;
    const result = analyze(text);
    unwrap(content);
    content.dataset.scamKey = key;
    if (result.band === "ok") return;
    wrapInlineRuns(content, result);
  }

  function scan(root = document) {
    if (!root || !root.querySelectorAll) return;
    mark(root);
    root.querySelectorAll('[id^="chat-messages-"]').forEach(mark);
  }

  function processAddedNode(node) {
    if (node.nodeType !== 1) return;
    mark(node);
    if (node.querySelectorAll) {
      node.querySelectorAll('[id^="chat-messages-"]').forEach(mark);
    }
  }

  function start(doc = document) {
    bindPop(doc);
    scan(doc);
    const Observer =
      (doc.defaultView && doc.defaultView.MutationObserver) ||
      (typeof MutationObserver !== "undefined" ? MutationObserver : null);
    if (!Observer) return null;
    const observer = new Observer((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          mark(mutation.target);
          continue;
        }
        for (const added of mutation.addedNodes) {
          processAddedNode(added);
        }
      }
    });
    observer.observe(doc.documentElement || doc, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["id"],
    });
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
  };

  if (typeof document !== "undefined" && document.documentElement) {
    start(document);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
