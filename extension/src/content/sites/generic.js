/** Fallback roots: conversation-ish main, never the entire document if avoidable. */

const SKIP_SELECTOR = "script,style,noscript,svg,canvas,link,meta,iframe,#whs-banner";

export function skipNode(node) {
  if (!node || node.nodeType !== 1) return true;
  return node.matches?.(SKIP_SELECTOR) || Boolean(node.closest?.(SKIP_SELECTOR));
}

export function getRoot(doc = document) {
  return (
    doc.querySelector("[data-whs-root]") ||
    doc.querySelector("main") ||
    doc.querySelector("[role='main']") ||
    doc.querySelector("article") ||
    doc.body
  );
}

export function siteIdFromHost(hostname) {
  const host = String(hostname || "").replace(/^www\./, "");
  if (host === "discord.com" || host === "discordapp.com" || host.endsWith(".discord.com")) {
    return "discord";
  }
  if (host === "facebook.com" || host === "messenger.com") return "facebook";
  if (host === "instagram.com") return "instagram";
  return "generic";
}
