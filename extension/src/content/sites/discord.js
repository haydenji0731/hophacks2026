/**
 * Discord web (discord.com) only — the desktop Electron app cannot run
 * this extension. Observe the stable #app-mount; score message nodes.
 */

export function getObserveRoot(doc = document) {
  return doc.querySelector("#app-mount") || doc.body;
}

export function getRoot(doc = document) {
  return (
    doc.querySelector('ol[data-list-id="chat-messages"]') ||
    doc.querySelector('[data-list-id="chat-messages"]') ||
    doc.querySelector('[class*="messagesWrapper"]') ||
    doc.querySelector('[class*="chatContent"]') ||
    getObserveRoot(doc)
  );
}

export function messageTarget(node) {
  if (!node) return null;
  const el = node.nodeType === 1 ? node : node.parentElement;
  if (!el) return null;
  return (
    el.closest?.('[id^="message-content-"]') ||
    el.closest?.('[id^="chat-messages-"]') ||
    el.closest?.("li") ||
    el
  );
}

export function existingMessages(root) {
  if (!root?.querySelectorAll) return [];
  const found = root.querySelectorAll(
    '[id^="message-content-"], [id^="chat-messages-"] li, ol[data-list-id="chat-messages"] > li',
  );
  return [...found];
}
