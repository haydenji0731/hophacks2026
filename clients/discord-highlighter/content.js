(() => {
  const HIGHLIGHT_CLASS = "discord-user-msg-highlight";

  function isUserMessage(el) {
    if (!el || el.nodeType !== 1) return false;
    const id = el.id || "";
    if (!id.startsWith("chat-messages-")) return false;
    // Real chat text. Date separators and most system events do not have this.
    return Boolean(el.querySelector('[id^="message-content-"]'));
  }

  function mark(el) {
    if (isUserMessage(el)) el.classList.add(HIGHLIGHT_CLASS);
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
        for (const node of mutation.addedNodes) {
          processAddedNode(node);
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
