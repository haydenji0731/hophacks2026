const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { HIGHLIGHT_CLASS, isUserMessage, scan, start } = require("../content.js");

function fixture() {
  return new JSDOM(`<!doctype html><html><body>
    <ol data-list-id="chat-messages">
      <li id="chat-messages-1-111">
        <h3>Date separator</h3>
      </li>
      <li id="chat-messages-1-222">
        <div id="message-content-222">hello from a user</div>
      </li>
      <div id="not-a-message">noise</div>
    </ol>
  </body></html>`, { pretendToBeVisual: true });
}

const { window } = fixture();
const { document } = window;

const dateSep = document.getElementById("chat-messages-1-111");
const userMsg = document.getElementById("chat-messages-1-222");

assert.equal(isUserMessage(dateSep), false);
assert.equal(isUserMessage(userMsg), true);

scan(document);
assert.equal(userMsg.classList.contains(HIGHLIGHT_CLASS), true);
assert.equal(dateSep.classList.contains(HIGHLIGHT_CLASS), false);

start(document);

const incoming = document.createElement("li");
incoming.id = "chat-messages-1-333";
incoming.innerHTML = '<div id="message-content-333">new message</div>';
document.querySelector("ol").appendChild(incoming);

setImmediate(() => {
  assert.equal(incoming.classList.contains(HIGHLIGHT_CLASS), true);
  console.log("ok");
});
