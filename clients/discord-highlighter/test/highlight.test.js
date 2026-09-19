const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
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
          <div id="message-content-222">hello from a user</div>
        </div>
      </li>
      <div id="not-a-message">noise</div>
    </ol>
  </body></html>`, { pretendToBeVisual: true });
}

const { window } = fixture();
const { document } = window;

const dateSep = document.getElementById("chat-messages-1-111");
const userMsg = document.getElementById("chat-messages-1-222");
const avatar = userMsg.querySelector(".avatar");
const textbox = userMsg.querySelector(".textbox");
const content = document.getElementById("message-content-222");

assert.equal(isUserMessage(dateSep), false);
assert.equal(isUserMessage(userMsg), true);

scan(document);

const mark = content.querySelector("." + HIGHLIGHT_CLASS);
assert.ok(mark);
assert.equal(mark.textContent, "hello from a user");
assert.equal(userMsg.classList.contains(HIGHLIGHT_CLASS), false);
assert.equal(avatar.classList.contains(HIGHLIGHT_CLASS), false);
assert.equal(textbox.classList.contains(HIGHLIGHT_CLASS), false);
assert.equal(dateSep.querySelector("." + HIGHLIGHT_CLASS), null);

start(document);

const incoming = document.createElement("li");
incoming.id = "chat-messages-1-333";
incoming.innerHTML =
  '<img class="avatar" alt="ava" /><div id="message-content-333">new message</div>';
document.querySelector("ol").appendChild(incoming);

setImmediate(() => {
  const incomingMark = incoming.querySelector("." + HIGHLIGHT_CLASS);
  assert.ok(incomingMark);
  assert.equal(incomingMark.textContent, "new message");
  assert.equal(incoming.classList.contains(HIGHLIGHT_CLASS), false);
  console.log("ok");
});
