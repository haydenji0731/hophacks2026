/** Thin LinkedIn messaging / feed roots. */

export function getRoot(doc = document) {
  return (
    doc.querySelector(".msg-s-message-list-container") ||
    doc.querySelector(".msg-overlay-list-bubble") ||
    doc.querySelector(".scaffold-layout__main") ||
    doc.querySelector("main") ||
    doc.body
  );
}
