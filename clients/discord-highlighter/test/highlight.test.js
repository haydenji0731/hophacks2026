const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
require("../scorer.js");
const {
  HIGHLIGHT_CLASS,
  isUserMessage,
  scan,
  start,
  clickWarning,
  popupPosition,
  showPop,
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

start(document);

const incoming = document.createElement("li");
incoming.id = "chat-messages-1-333";
incoming.innerHTML =
  '<img class="avatar" alt="ava" /><div id="message-content-333">Click to verify your account</div>';
document.querySelector("ol").appendChild(incoming);

assert.equal(clickWarning("high"), "DO NOT CLICK");
assert.equal(clickWarning("caution"), "BE CAREFUL BEFORE CLICKING THIS");

const below = popupPosition(
  { top: 40, bottom: 64, left: 20 },
  { width: 268, height: 120 },
  { width: 1280, height: 800 },
);
assert.equal(below.top, 72);

const flipped = popupPosition(
  { top: 700, bottom: 740, left: 20 },
  { width: 268, height: 120 },
  { width: 1280, height: 800 },
);
assert.equal(flipped.top, 572);
assert.ok(flipped.top >= 8);
assert.ok(flipped.top + 120 <= 800 - 8);

const tight = popupPosition(
  { top: 10, bottom: 790, left: 20 },
  { width: 268, height: 200 },
  { width: 400, height: 800 },
);
assert.ok(tight.top >= 8);
assert.ok(tight.top + 200 <= 800 - 8 || tight.top === 8);

const unmeasured = popupPosition(
  { top: 700, bottom: 740, left: 20 },
  { width: 268, height: 0 },
  { width: 1280, height: 800 },
);
assert.ok(unmeasured.top + 140 <= 800 - 8);
assert.ok(unmeasured.top < 700);

const ping = pingStatus(document);
assert.equal(ping.ok, true);
assert.match(String(ping.site), /discord/);
assert.ok(ping.marks >= 1);

showPop(document, scamMark);
const pop = document.getElementById("discord-hl-pop");
assert.ok(pop);
assert.equal(pop.hidden, false);
assert.match(pop.textContent, /DO NOT CLICK/);
assert.match(pop.textContent, /High risk signals/);

setTimeout(() => {
  const incomingMark = incoming.querySelector("." + HIGHLIGHT_CLASS);
  assert.ok(incomingMark);
  assert.equal(incomingMark.classList.contains("discord-hl-mark--caution"), true);
  showPop(document, incomingMark);
  assert.match(document.getElementById("discord-hl-pop").textContent, /BE CAREFUL BEFORE CLICKING THIS/);
  console.log("ok");
}, 20);
