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

assert.deepEqual(prefs.normalize({}), { aggression: "point", descriptions: true });
assert.equal(prefs.normalize({ aggression: "block", descriptions: false }).aggression, "block");
assert.equal(prefs.normalize({ aggression: "nope" }).aggression, "point");
assert.equal(prefs.indexOf("warn"), 1);

assert.equal(api.linkMismatch(mismatchLink, "https://discord.com/"), true);
assert.equal(api.linkMismatch(safeLink, "https://discord.com/"), false);
assert.equal(api.linkMismatch(highLink, "https://discord.com/"), false);

assert.equal(api.shouldIntercept("point", { inHighlight: true, band: "high", mismatch: true }), false);
assert.equal(api.shouldIntercept("warn", { inHighlight: true, band: "high", mismatch: false }), true);
assert.equal(api.shouldIntercept("warn", { inHighlight: false, band: "ok", mismatch: true }), true);
assert.equal(api.shouldIntercept("warn", { inHighlight: true, band: "caution", mismatch: false }), false);
assert.equal(api.shouldIntercept("block", { inHighlight: true, band: "caution", mismatch: false }), true);
assert.equal(api.shouldIntercept("block", { inHighlight: false, band: "ok", mismatch: true }), false);

api.applySettings({ aggression: "point", descriptions: true });
mismatchLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
assert.equal(document.querySelector("." + api.GATE_CLASS), null, "Point never interrupts a click");

api.applySettings({ aggression: "warn", descriptions: true });
mismatchLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
const warnGate = document.querySelector("." + api.GATE_CLASS);
assert.ok(warnGate, "Warn stops a mismatched link");
assert.match(warnGate.textContent, /does not match/i);
assert.match(warnGate.textContent, /evil\.example/);
assert.match(warnGate.textContent, /Continue/);
assert.match(warnGate.textContent, /Go back/);
warnGate.querySelector('[data-act="back"]').click();
assert.equal(document.querySelector("." + api.GATE_CLASS), null);

api.applySettings({ aggression: "block", descriptions: true });
highLink.dispatchEvent(new document.defaultView.MouseEvent("click", { bubbles: true, cancelable: true }));
const blockGate = document.querySelector("." + api.GATE_CLASS);
assert.ok(blockGate, "Block stops a link inside highlighted text");
assert.match(blockGate.textContent, /DO NOT CLICK ANY LINKS|highlighted text/);
assert.match(blockGate.textContent, /not-irs\.example/);
blockGate.querySelector('[data-act="back"]').click();

api.applySettings({ aggression: "point", descriptions: true });
const why = api.toggleWhy(irs.querySelector("." + api.HIGHLIGHT_CLASS), true);
assert.ok(why);
assert.match(why.textContent, /DO NOT CLICK ANY LINKS/);
api.applySettings({ aggression: "point", descriptions: false });
assert.equal(why.hidden, true);

console.log("ok");
process.exit(0);
