/** Thin Instagram DM / feed roots. */

export function getRoot(doc = document) {
  return (
    doc.querySelector("section main") ||
    doc.querySelector('[role="main"]') ||
    doc.querySelector("main") ||
    doc.body
  );
}
