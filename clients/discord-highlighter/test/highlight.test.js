const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
require("../scorer.js");
const { HIGHLIGHT_CLASS, isUserMessage, scan, start } = require("../content.js");

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

setTimeout(() => {
  const incomingMark = incoming.querySelector("." + HIGHLIGHT_CLASS);
  assert.ok(incomingMark);
  assert.equal(incomingMark.classList.contains("discord-hl-mark--caution"), true);
  console.log("ok");
}, 20);
