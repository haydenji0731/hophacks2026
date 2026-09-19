(() => {
  const HIGHLIGHT_CLASS = "discord-hl-mark";
  const BLOCK_TAGS = /^(PRE|UL|OL|BLOCKQUOTE|DIV|TABLE|H[1-6]|HR)$/;

  function isUserMessage(el) {
    if (!el || el.nodeType !== 1) return false;
    const id = el.id || "";
    if (!id.startsWith("chat-messages-")) return false;
    // Real chat text. Date separators and most system events do not have this.
    return Boolean(el.querySelector('[id^="message-content-"]'));
  }

  function wrapInlineRuns(contentEl) {
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
        run = [];
        return;
      }
      const mark = doc.createElement("span");
      mark.className = HIGHLIGHT_CLASS;
      run[0].parentNode.insertBefore(mark, run[0]);
      for (const node of run) mark.appendChild(node);
      run = [];
    };

    for (const node of kids) {
      if (node.nodeType === 1 && node.classList.contains(HIGHLIGHT_CLASS)) {
        flush();
        continue;
      }
      if (node.nodeType === 1 && BLOCK_TAGS.test(node.tagName)) {
        flush();
        continue;
      }
      if (node.nodeType === 3 && !node.nodeValue.trim() && !run.length) {
        continue;
      }
      run.push(node);
    }
    flush();
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
    wrapInlineRuns(content);
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
  };

  if (typeof document !== "undefined" && document.documentElement) {
    start(document);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
