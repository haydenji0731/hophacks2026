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

const IG_FORM_SPLIT_HTML = `<!doctype html><html><body>
  <form>
    <div data-pagelet="IGDMessagesList" aria-label="Conversation with Support">
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
              <span dir="auto">Hi,</span><span dir="auto">this</span><span dir="auto">is</span><span dir="auto">Instagram</span><span dir="auto">Support.</span><span dir="auto">Your</span><span dir="auto">account</span><span dir="auto">will</span><span dir="auto">be</span><span dir="auto">disabled.</span><span dir="auto">Pay</span><span dir="auto">a</span><span dir="auto">$49</span><span dir="auto">verification</span><span dir="auto">fee</span><span dir="auto">to</span><span dir="auto">keep</span><span dir="auto">your</span><span dir="auto">Meta</span><span dir="auto">Verified</span><span dir="auto">badge.</span>
            </div>
          </div>
        </div>
      </div>
      <div role="row">
        <div role="presentation">
          <span>Your reel received a copyright strike. Pay the appeal fee immediately to remove the strike.</span>
        </div>
      </div>
    </div>
  </form>
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
  assert.equal(verifyMark.classList.contains("discord-hl-mark--caution"), true);
  assert.ok(irsMark);
  assert.equal(irsMark.classList.contains("discord-hl-mark--high"), true);
  assert.equal(home.querySelector("." + api.HIGHLIGHT_CLASS), null);
}

{
  const { document, api } = load("https://www.instagram.com/direct/t/9/", IG_FORM_SPLIT_HTML);
  api.scan(document);
  const pizzaMark = markFor(document, api, "pizza");
  const verifyMark = markFor(document, api, "verification");
  const strikeMark = markFor(document, api, "copyright");
  assert.equal(pizzaMark, null, "benign word-split pizza DM should stay clean");
  assert.ok(verifyMark, "word-split Instagram Support verification fee should highlight");
  assert.equal(verifyMark.classList.contains("discord-hl-mark--high"), true);
  assert.ok(strikeMark, "copyright-strike bubble without dir=auto should highlight");
  assert.equal(strikeMark.classList.contains("discord-hl-mark--high"), true);
  assert.match(verifyMark.closest('[role="row"]').textContent, /InstagramSupport|Instagram Support/);
  assert.match(verifyMark.closest("[data-scam-key]").dataset.scamKey, /Instagram Support/);
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
    verify.querySelector("." + api.HIGHLIGHT_CLASS).classList.contains("discord-hl-mark--caution"),
    true,
  );
  assert.equal(sidebar.querySelector("." + api.HIGHLIGHT_CLASS), null);
}

console.log("ok");
process.exit(0);
