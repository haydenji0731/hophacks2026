const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
require("../scorer.js");
require("../settings.js");

function load(url, html) {
  const { window } = new JSDOM(html, { pretendToBeVisual: true, url });
  globalThis.window = window;
  globalThis.document = window.document;
  delete require.cache[require.resolve("../settings.js")];
  delete require.cache[require.resolve("../content.js")];
  require("../settings.js");
  return { window, document: window.document, prefs: require("../settings.js"), api: require("../content.js") };
}

const HTML = `<!doctype html><html><body>
  <ol data-list-id="chat-messages">
    <li id="chat-messages-1-1">
      <div id="message-content-1">Click to verify your account at <a href="https://evil.example/paypal">paypal.com/login</a></div>
    </li>
    <li id="chat-messages-1-2">
      <div id="message-content-2">IRS: pay overdue tax with Apple gift cards today, don't tell anyone <a href="https://not-irs.example/pay">click here</a></div>
    </li>
    <li id="chat-messages-1-3">
      <div id="message-content-3">Your Amazon order has shipped. See <a href="https://www.amazon.com/orders">amazon.com/orders</a></div>
    </li>
  </ol>
</body></html>`;

const { document, prefs, api } = load("https://discord.com/channels/1/2", HTML);
api.scan(document);

const verify = document.getElementById("message-content-1");
const irs = document.getElementById("message-content-2");
const amazon = document.getElementById("message-content-3");
const mismatchLink = verify.querySelector("a");
const highLink = irs.querySelector("a");
const safeLink = amazon.querySelector("a");

assert.ok(verify.querySelector("." + api.HIGHLIGHT_CLASS));
assert.ok(irs.querySelector("." + api.HIGHLIGHT_CLASS));
assert.equal(amazon.querySelector("." + api.HIGHLIGHT_CLASS), null);

assert.deepEqual(prefs.normalize({}), { aggression: "warn", descriptions: true, theme: "dark" });
assert.equal(prefs.normalize({ aggression: "point" }).aggression, "warn");
assert.equal(prefs.normalize({ aggression: "block", descriptions: false }).aggression, "block");
assert.equal(prefs.normalize({ aggression: "nope" }).aggression, "warn");
assert.equal(prefs.normalize({ theme: "light" }).theme, "light");
assert.equal(prefs.normalize({ theme: "neon" }).theme, "dark");
assert.equal(prefs.indexOf("warn"), 0);
assert.equal(prefs.indexOf("block"), 1);
assert.equal(prefs.THEMES.light.bg, "#F2E8CF");
assert.equal(prefs.THEMES.light.h3, "#99B2DD");
assert.equal(prefs.THEMES.dark.highlight, "#EFC3F5");
assert.equal(prefs.THEMES.dark.h3, "#FAA6FF");
assert.match(prefs.reportHref({ text: "gift cards", site: "discord.com", band: "high" }), /report\.html\?/);
assert.match(prefs.reportHref({ text: "gift cards", site: "discord.com", band: "high" }), /text=gift\+cards/);
assert.match(prefs.reportHref({ text: "gift cards", site: "discord.com", band: "high" }), /site=discord\.com/);

prefs.applyTheme(document, "light");
assert.equal(document.documentElement.dataset.sherpaTheme, "light");
assert.equal(document.documentElement.style.getPropertyValue("--sherpa-bg"), "#F2E8CF");
assert.equal(document.documentElement.style.getPropertyValue("--sherpa-hl"), "#BC4749");
prefs.applyTheme(document, "dark");
assert.equal(document.documentElement.dataset.sherpaTheme, "dark");
assert.equal(document.documentElement.style.getPropertyValue("--sherpa-bg"), "#0F1020");

assert.equal(api.linkMismatch(mismatchLink, "https://discord.com/"), true);
assert.equal(api.linkMismatch(safeLink, "https://discord.com/"), false);

assert.equal(api.shouldIntercept("warn", { inHighlight: true, band: "high", mismatch: true }), false);
assert.equal(api.shouldIntercept("warn", { inHighlight: true, band: "caution", mismatch: false }), false);
assert.equal(api.shouldIntercept("block", { inHighlight: true, band: "caution", mismatch: false }), true);
assert.equal(api.shouldIntercept("block", { inHighlight: false, band: "ok", mismatch: true }), false);

api.applySettings({ aggression: "warn", descriptions: true });
mismatchLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(document.querySelector("." + api.GATE_CLASS), null, "Warn never interrupts a click");

safeLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(document.querySelector("." + api.GATE_CLASS), null, "ordinary links stay free");

api.applySettings({ aggression: "block", descriptions: true });
safeLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(document.querySelector("." + api.GATE_CLASS), null, "Block ignores links outside highlights");

highLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
const blockGate = document.querySelector("." + api.GATE_CLASS);
assert.ok(blockGate, "Block stops a link inside highlighted text");
assert.match(blockGate.textContent, /SCAM LIKELY: AVOID LINKS|highlighted text/);
assert.match(blockGate.textContent, /not-irs\.example/);
assert.match(blockGate.textContent, /Continue/);
assert.match(blockGate.textContent, /Go back/);
assert.match(blockGate.textContent, /Report a scam/);
blockGate.querySelector('[data-act="back"]').click();

api.applySettings({ aggression: "warn", descriptions: true });
const mark = irs.querySelector("." + api.HIGHLIGHT_CLASS);
mark.dispatchEvent(new document.defaultView.MouseEvent("pointerenter", { bubbles: true }));
const pop = document.getElementById("sherpa-hl-pop");
assert.ok(pop, "hover should open a floating description");
assert.equal(pop.hidden, false);
assert.match(pop.textContent, /SCAM LIKELY: AVOID LINKS/);
assert.match(pop.textContent, /Report a scam/);
const opened = [];
document.defaultView.open = (href) => {
  opened.push(href);
  return { closed: false };
};
pop.querySelector(".sherpa-report").click();
assert.equal(opened.length, 1);
assert.match(opened[0], /report\.html/);
assert.match(opened[0], /band=high/);

const overlay = document.createElement("div");
overlay.id = "hover-blocker";
overlay.style.cssText = "position:fixed;inset:0;";
document.body.appendChild(overlay);
document.elementsFromPoint = () => [overlay, mark];
overlay.dispatchEvent(
  new document.defaultView.MouseEvent("pointermove", { bubbles: true, clientX: 24, clientY: 24 }),
);
assert.equal(document.getElementById("sherpa-hl-pop").hidden, false, "hover must work through an overlay");
assert.match(document.getElementById("sherpa-hl-pop").textContent, /SCAM LIKELY: AVOID LINKS/);

api.applySettings({ aggression: "warn", descriptions: false });
overlay.dispatchEvent(
  new document.defaultView.MouseEvent("pointermove", { bubbles: true, clientX: 24, clientY: 24 }),
);
mark.dispatchEvent(new document.defaultView.MouseEvent("pointerenter", { bubbles: true }));
assert.equal(api.showPop(document, mark), null);
assert.equal(document.getElementById("sherpa-hl-pop").hidden, true, "hover comments off must hide the hover box");
assert.equal(document.documentElement.dataset.sherpaHl, "on");
assert.equal(document.documentElement.dataset.sherpaDesc, "0");
assert.ok(irs.querySelector("." + api.HIGHLIGHT_CLASS), "unchecking hover comments must leave highlights");

console.log("ok");
process.exit(0);
