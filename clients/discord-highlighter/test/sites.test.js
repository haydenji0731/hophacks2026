const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
require("../scorer.js");

function load(url, html) {
  const { window } = new JSDOM(html, { pretendToBeVisual: true, url });
  globalThis.window = window;
  globalThis.document = window.document;
  delete require.cache[require.resolve("../content.js")];
  return { document: window.document, api: require("../content.js") };
}

const IG_HTML = `<!doctype html><html><body>
  <div data-pagelet="IGDMessagesList" aria-label="Conversation with Sam">
    <div role="none">
      <div role="presentation">
        <div dir="auto">hey are we still on for pizza later?</div>
      </div>
    </div>
    <div role="none">
      <div role="presentation">
        <div dir="auto">Click to verify your account</div>
      </div>
    </div>
    <div role="none">
      <div role="presentation">
        <div dir="auto">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</div>
      </div>
    </div>
    <nav><div dir="auto">Home</div></nav>
  </div>
</body></html>`;

const REDDIT_HTML = `<!doctype html><html><body>
  <shreddit-post post-title="quote">
    <h1 slot="title">Anyone else get this DM?</h1>
    <div slot="text-body"><div class="md"><p>hey are we still on for pizza later?</p></div></div>
  </shreddit-post>
  <shreddit-comment author="scam">
    <div slot="comment">
      <div class="md">
        <p>IRS: pay overdue tax with Apple gift cards today, don't tell anyone</p>
      </div>
    </div>
  </shreddit-comment>
  <shreddit-comment author="phish">
    <div slot="comment">
      <div class="md">
        <p>Click to verify your account</p>
      </div>
    </div>
  </shreddit-comment>
  <aside><div class="md"><p>IRS: pay overdue tax with Apple gift cards today, don't tell anyone</p></div></aside>
</body></html>`;

{
  const { document, api } = load("https://www.instagram.com/direct/t/1/", IG_HTML);
  api.scan(document);
  const pizza = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
    el.textContent.includes("pizza"),
  );
  const verify = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
    el.textContent.includes("verify"),
  );
  const irs = Array.from(document.querySelectorAll('[dir="auto"]')).find((el) =>
    el.textContent.includes("IRS"),
  );
  const home = Array.from(document.querySelectorAll("nav [dir='auto']"))[0];
  assert.equal(pizza.querySelector("." + api.HIGHLIGHT_CLASS), null);
  const verifyMark = verify.querySelector("." + api.HIGHLIGHT_CLASS);
  const irsMark = irs.querySelector("." + api.HIGHLIGHT_CLASS);
  assert.ok(verifyMark);
  assert.equal(verifyMark.classList.contains("discord-hl-mark--high"), true);
  assert.ok(irsMark);
  assert.equal(irsMark.classList.contains("discord-hl-mark--high"), true);
  assert.equal(home.querySelector("." + api.HIGHLIGHT_CLASS), null);
}

const IG_FORM_SPLIT_HTML = `<!doctype html><html><body>
  <form>
    <div data-pagelet="IGDMessagesList" aria-label="Conversation with Sam">
      <div role="row">
        <div class="xhashed" role="none">
          <div role="presentation">
            <div>
              <span dir="auto">hey</span><span dir="auto">are</span><span dir="auto">we</span><span dir="auto">still</span><span dir="auto">on</span><span dir="auto">for</span><span dir="auto">pizza</span><span dir="auto">later?</span>
            </div>
          </div>
        </div>
      </div>
      <div role="row">
        <div class="xhashed" role="none">
          <div role="presentation">
            <div>
              <span dir="auto">Click</span><span dir="auto">to</span><span dir="auto">verify</span><span dir="auto">your</span><span dir="auto">account</span>
            </div>
          </div>
        </div>
      </div>
      <div role="row">
        <div class="xhashed" role="none">
          <div role="presentation">
            <div>
              <span dir="auto">IRS:</span><span dir="auto">pay</span><span dir="auto">overdue</span><span dir="auto">tax</span><span dir="auto">with</span><span dir="auto">Apple</span><span dir="auto">gift</span><span dir="auto">cards</span><span dir="auto">today,</span><span dir="auto">don't</span><span dir="auto">tell</span><span dir="auto">anyone</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </form>
</body></html>`;

function tightest(document, needle) {
  return Array.from(document.querySelectorAll("body *"))
    .filter((el) => (el.textContent || "").includes(needle))
    .sort((a, b) => (a.textContent || "").length - (b.textContent || "").length)[0];
}

function markFor(document, api, needle) {
  const el = tightest(document, needle);
  if (!el) return null;
  return (el.closest && el.closest("." + api.HIGHLIGHT_CLASS)) || el.querySelector("." + api.HIGHLIGHT_CLASS);
}

{
  const { document, api } = load("https://www.instagram.com/direct/t/9/", IG_FORM_SPLIT_HTML);
  api.scan(document);
  const pizzaMark = markFor(document, api, "pizza");
  const verifyMark = markFor(document, api, "verify");
  const irsMark = markFor(document, api, "IRS");
  assert.equal(pizzaMark, null, "benign word-split pizza DM should stay clean");
  assert.ok(verifyMark, "word-split verify line inside a form should highlight");
  assert.equal(verifyMark.classList.contains("discord-hl-mark--high"), true);
  assert.ok(irsMark, "word-split IRS line inside a form should highlight");
  assert.equal(irsMark.classList.contains("discord-hl-mark--high"), true);
  assert.equal(verifyMark.tagName, "SPAN");
  assert.notEqual(verifyMark.parentElement.getAttribute("role"), "row");
  assert.notEqual(irsMark.parentElement.getAttribute("role"), "row");
  const verifyRow = verifyMark.closest('[role="row"]');
  const chips = verifyRow.querySelectorAll('[dir="auto"]');
  assert.ok(chips.length >= 5, "word chips should stay separate so the bubble does not reflow");
  assert.equal(verifyRow.querySelectorAll(":scope > ." + api.HIGHLIGHT_CLASS).length, 0);
}

{
  const { document, api } = load("https://www.reddit.com/r/scams/comments/1/", REDDIT_HTML);
  api.scan(document);
  const pizza = Array.from(document.querySelectorAll("p")).find((el) => el.textContent.includes("pizza"));
  const irs = Array.from(document.querySelectorAll("shreddit-comment p")).find((el) =>
    el.textContent.includes("IRS"),
  );
  const verify = Array.from(document.querySelectorAll("shreddit-comment p")).find((el) =>
    el.textContent.includes("verify"),
  );
  const sidebar = document.querySelector("aside p");
  assert.equal(pizza.querySelector("." + api.HIGHLIGHT_CLASS), null);
  assert.ok(irs.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(
    irs.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"),
    true,
  );
  assert.equal(
    verify.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"),
    true,
  );
  assert.equal(sidebar.querySelector("." + api.HIGHLIGHT_CLASS), null);
}

const DOCS_HTML = `<!doctype html><html><body>
  <div id="docs-chrome"><button>Share</button></div>
  <div class="docos-replyview-body">hey are we still on for pizza later?</div>
  <div class="docos-replyview-body">Click to verify your account</div>
  <div data-comment-id="c1">
    <div class="docos-replyview-body">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</div>
  </div>
  <div class="docs-chat-message">Click to verify your account at <a href="https://evil.example/paypal">paypal.com/login</a></div>
  <textarea class="docos-input-textarea">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</textarea>
</body></html>`;

const SLIDES_HTML = `<!doctype html><html><body>
  <div class="punch-viewer-speakernotes-text" aria-label="Speaker notes">
    IRS: pay overdue tax with Apple gift cards today, don't tell anyone
  </div>
  <div class="sketchy-text-content">Click to verify your account</div>
  <div class="sketchy-text-content">hey are we still on for pizza later?</div>
</body></html>`;

{
  const { document, api } = load("https://docs.google.com/document/d/abc/edit", DOCS_HTML);
  api.scan(document);
  const pizza = Array.from(document.querySelectorAll(".docos-replyview-body")).find((el) =>
    el.textContent.includes("pizza"),
  );
  const verify = Array.from(document.querySelectorAll(".docos-replyview-body")).find((el) =>
    el.textContent.includes("verify"),
  );
  const irs = Array.from(document.querySelectorAll(".docos-replyview-body")).find((el) =>
    el.textContent.includes("IRS"),
  );
  const chat = document.querySelector(".docs-chat-message");
  const compose = document.querySelector(".docos-input-textarea");
  assert.equal(pizza.querySelector("." + api.HIGHLIGHT_CLASS), null);
  assert.ok(verify.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(verify.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"), true);
  assert.ok(irs.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(irs.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"), true);
  assert.ok(chat.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(compose.parentElement.querySelector("textarea." + api.HIGHLIGHT_CLASS), null);
  assert.equal(compose.classList.contains(api.HIGHLIGHT_CLASS), false);
}

{
  const { document, api } = load("https://docs.google.com/presentation/d/xyz/edit", SLIDES_HTML);
  api.scan(document);
  const notes = document.querySelector(".punch-viewer-speakernotes-text");
  const verify = Array.from(document.querySelectorAll(".sketchy-text-content")).find((el) =>
    el.textContent.includes("verify"),
  );
  const pizza = Array.from(document.querySelectorAll(".sketchy-text-content")).find((el) =>
    el.textContent.includes("pizza"),
  );
  assert.ok(notes.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(notes.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--high"), true);
  assert.ok(verify.querySelector("." + api.HIGHLIGHT_CLASS));
  assert.equal(pizza.querySelector("." + api.HIGHLIGHT_CLASS), null);
}

{
  const { document, api } = load(
    "https://docs.google.com/document/d/abc/edit",
    `<!doctype html><html><body>
      <div contenteditable="true" role="textbox" id="live">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</div>
    </body></html>`,
  );
  const live = document.getElementById("live");
  live.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  const bar = document.getElementById("sherpa-select-bar");
  assert.ok(bar, "Docs should score text as it is typed");
  assert.equal(bar.hidden, false);
  assert.match(bar.textContent, /SCAM LIKELY: AVOID LINKS/);
  const scored = api.scoreLiveText(document, "hey are we still on for pizza later?", "typed text");
  assert.equal(scored.band, "ok");
  assert.equal(document.getElementById("sherpa-select-bar").hidden, true);
}

{
  const { document, api } = load(
    "https://docs.google.com/document/d/abc/edit",
    `<!doctype html><html><body>
      <div class="kix-appview-editor"></div>
      <iframe class="docs-texteventtarget-iframe"></iframe>
    </body></html>`,
  );
  const sample = "IRS: pay overdue tax with Apple gift cards today, don't tell anyone";
  for (const key of sample) {
    document.dispatchEvent(
      new document.defaultView.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  }
  const bar = document.getElementById("sherpa-select-bar");
  assert.ok(bar, "canvas Docs typing should fill a live bar from keystrokes");
  assert.equal(bar.hidden, false);
  assert.match(bar.textContent, /SCAM LIKELY: AVOID LINKS/);
  const pizza = "hey are we still on for pizza later?";
  api.scoreLiveText(document, pizza, "typed text");
  assert.equal(document.getElementById("sherpa-select-bar").hidden, true);

  const again = "IRS: pay overdue tax with Apple gift cards today, don't tell anyone";
  api.scoreLiveText(document, again, "typed text");
  assert.equal(document.getElementById("sherpa-select-bar").hidden, false);
  document.dispatchEvent(new document.defaultView.KeyboardEvent("keyup", { key: "a", bubbles: true }));
  assert.equal(
    document.getElementById("sherpa-select-bar").hidden,
    false,
    "a stray keyup must not hide the live typing bar",
  );
  const ink = document.getElementById("sherpa-docs-ink");
  assert.ok(ink, "Docs should paint a live ink chip");
  assert.equal(ink.hidden, false);
}

{
  const { document, api } = load(
    "https://drive.google.com/drive/u/0/home",
    `<!doctype html><html><body>
      <div id="drive_main_page">
        <div class="docos-replyview-body">I need 3 ebay gift cards of $200 each. What's the closest store ?</div>
        <div class="docos-replyview-body">hey are we still on for pizza later?</div>
        <div role="button" aria-label="Comment">
          <div class="docos-docoview-content">IRS: pay overdue tax with Apple gift cards today, don't tell anyone</div>
        </div>
      </div>
    </body></html>`,
  );
  api.scan(document);
  const gift = Array.from(document.querySelectorAll(".docos-replyview-body")).find((el) =>
    el.textContent.includes("ebay"),
  );
  const pizza = Array.from(document.querySelectorAll(".docos-replyview-body")).find((el) =>
    el.textContent.includes("pizza"),
  );
  const clickable = document.querySelector(".docos-docoview-content");
  assert.ok(gift.querySelector("." + api.HIGHLIGHT_CLASS), "Drive comments should highlight");
  assert.equal(pizza.querySelector("." + api.HIGHLIGHT_CLASS), null);
  assert.ok(
    clickable.querySelector("." + api.HIGHLIGHT_CLASS),
    "Drive comments inside role=button cards should still highlight",
  );
}

{
  const { document, api } = load(
    "https://docs.google.com/document/d/abc/edit",
    `<!doctype html><html><body>
      <div id="docs-chrome"><button>Share</button></div>
      <div role="button" class="docos-anchoreddocoview">
        <div class="docos-replyview-body">Click to verify your account</div>
      </div>
    </body></html>`,
  );
  api.scan(document);
  const verify = document.querySelector(".docos-replyview-body");
  assert.ok(
    verify.querySelector("." + api.HIGHLIGHT_CLASS),
    "Docs comments inside clickable cards should highlight without a reload",
  );
}

console.log("ok");
process.exit(0);
