/** Thin Discord channel / DM message list roots. */

export function getRoot(doc = document) {
  return (
    doc.querySelector('ol[data-list-id="chat-messages"]') ||
    doc.querySelector('[data-list-id="chat-messages"]') ||
    doc.querySelector('[class*="messagesWrapper"]') ||
    doc.querySelector('[class*="chatContent"]') ||
    doc.querySelector("main") ||
    doc.body
  );
}
