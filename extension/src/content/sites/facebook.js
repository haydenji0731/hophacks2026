/** Thin Facebook / Messenger conversation roots. */

export function getRoot(doc = document) {
  return (
    doc.querySelector('[data-pagelet="MWThreadList"]') ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector("div[data-pagelet='Feed']") ||
    doc.body
  );
}
