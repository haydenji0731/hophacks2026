const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
require("../scorer.js");
require("../settings.js");
const {
  HIGHLIGHT_CLASS,
  isUserMessage,
  scan,
  start,
  clickWarning,
  applySettings,
  showPop,
  hidePop,
  popupPosition,
  pingStatus,
} = require("../content.js");

function fixture() {
  return new JSDOM(`<!doctype html><html><body>
    <ol data-list-id="chat-messages">
      <li id="chat-messages-1-111">
        <img class="avatar" alt="ava" />
        <h3>Date separator</h3>
      </li>
      <li id="chat-messages-1-222">
        <img class="avatar" alt="ava" />
        <div class="textbox">
          <div id="message-content-222">hey are we still on for pizza later?</div>
        </div>
      </li>
      <li id="chat-messages-1-444">
        <img class="avatar" alt="ava" />
        <div id="message-content-444">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</div>
      </li>
    </ol>
  </body></html>`, { pretendToBeVisual: true, url: "https://discord.com/channels/1/2" });
}

const { window } = fixture();
const { document } = window;
globalThis.window = window;
globalThis.document = document;

const dateSep = document.getElementById("chat-messages-1-111");
const normalMsg = document.getElementById("chat-messages-1-222");
const scamMsg = document.getElementById("chat-messages-1-444");

assert.equal(isUserMessage(dateSep), false);
assert.equal(isUserMessage(normalMsg), true);
assert.equal(isUserMessage(scamMsg), true);

scan(document);

assert.equal(normalMsg.querySelector("." + HIGHLIGHT_CLASS), null);
const scamMark = scamMsg.querySelector("." + HIGHLIGHT_CLASS);
assert.ok(scamMark);
assert.equal(scamMark.classList.contains("discord-hl-mark--high"), true);

const outgoingContent = document.getElementById("message-content-444");
const outgoingText = outgoingContent.textContent;
outgoingContent.innerHTML = outgoingText;
assert.equal(outgoingContent.querySelector("." + HIGHLIGHT_CLASS), null);
scan(outgoingContent);
assert.ok(outgoingContent.querySelector("." + HIGHLIGHT_CLASS));
assert.equal(
  outgoingContent.querySelector("." + HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"),
  true,
);

start(document);

const incoming = document.createElement("li");
incoming.id = "chat-messages-1-333";
incoming.innerHTML =
  '<img class="avatar" alt="ava" /><div id="message-content-333">Click to verify your account</div>';
document.querySelector("ol").appendChild(incoming);

const pending = document.createElement("li");
pending.id = "chat-messages-1-666";
pending.innerHTML = '<img class="avatar" alt="ava" /><div id="message-content-666"></div>';
document.querySelector("ol").appendChild(pending);
setTimeout(() => {
  document.getElementById("message-content-666").textContent = "Click to verify your account";
}, 5);

assert.equal(clickWarning("high"), "SCAM LIKELY: AVOID LINKS");
assert.equal(clickWarning("caution"), "SUSPICIOUS");

const below = popupPosition(
  { top: 40, bottom: 64, left: 20 },
  { width: 268, height: 120 },
  { width: 1280, height: 800 },
);
assert.equal(below.top, 72);

const igAbove = popupPosition(
  { top: 500, bottom: 524, left: 20 },
  { width: 268, height: 120 },
  { width: 1280, height: 800 },
  22,
  8,
  true,
);
assert.equal(igAbove.top, 500 - 120 - 22, "Instagram hover cards should sit above late-thread highlights");

const ping = pingStatus(document);
assert.equal(ping.ok, true);
assert.match(String(ping.site), /discord/);
assert.ok(ping.marks >= 1);

applySettings({ aggression: "warn", descriptions: true });
const pop = showPop(document, scamMsg.querySelector("." + HIGHLIGHT_CLASS));
assert.ok(pop);
assert.equal(pop.hidden, false);
assert.match(pop.textContent, /SCAM LIKELY: AVOID LINKS/);
assert.match(pop.textContent, /High risk signals/);
assert.match(pop.textContent, /Report a scam/);

applySettings({ aggression: "warn", descriptions: false });
assert.equal(showPop(document, scamMsg.querySelector("." + HIGHLIGHT_CLASS)), null);
const hidden = document.getElementById("sherpa-hl-pop");
assert.ok(hidden);
assert.equal(hidden.hidden, true);
assert.ok(scamMsg.querySelector("." + HIGHLIGHT_CLASS), "hover comments off must leave the highlight");

setTimeout(() => {
  const incomingMark = incoming.querySelector("." + HIGHLIGHT_CLASS);
  assert.ok(incomingMark);
  assert.equal(incomingMark.classList.contains("discord-hl-mark--high"), true);
  applySettings({ aggression: "warn", descriptions: true });
  const incomingPop = showPop(document, incomingMark);
  assert.match(incomingPop.textContent, /SCAM LIKELY: AVOID LINKS/);
  hidePop(document);
  const pendingMark = pending.querySelector("." + HIGHLIGHT_CLASS);
  assert.ok(pendingMark, "outgoing message should highlight after Discord fills the node");
  assert.equal(pendingMark.classList.contains("discord-hl-mark--high"), true);
  console.log("ok");
  process.exit(0);
}, 40);
