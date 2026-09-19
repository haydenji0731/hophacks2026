import { useEffect, useRef, useState } from "react";

function useReveal(threshold = 0.2) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -80px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function Block({ direction = "up", children, className = "" }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`goal-block goal-block--${direction} ${visible ? "is-visible" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

/* ---------- live demo: types a message, then flags keywords ---------- */

const MESSAGE = [
  { t: "Hi hun, it's mom. My phone broke so I'm texting from a new number. " },
  {
    t: "I need you to send $400 right now",
    kind: "danger",
    label: "Urgent money request",
    note: "Demands for immediate payment from a new or unverified contact are the single most common opener in impersonation scams. Verify on a number you already have saved.",
  },
  { t: " — it's an emergency and I can't talk on the phone. " },
  {
    t: "Just use gift cards",
    kind: "danger",
    label: "Untraceable payment",
    note: "No real institution, family member or agency asks for gift cards. Once the codes are read out the money is gone and cannot be recovered.",
  },
  { t: ", it's faster. " },
  {
    t: "Don't tell dad",
    kind: "warn",
    label: "Isolation pressure",
    note: "Asking you to keep the request secret exists to stop a second person from spotting the scam. Genuine emergencies survive a phone call to someone you trust.",
  },
  { t: ", he'll worry. Details here: " },
  {
    t: "secure-familypay[.]link/verify",
    kind: "danger",
    label: "Malicious link",
    note: "Look-alike domain that does not belong to any payment provider. Pages like this harvest logins, card numbers and one-time codes.",
  },
  { t: " Also they said " },
  {
    t: "the bank will reverse it later",
    kind: "warn",
    label: "Likely misinformation",
    note: "A false reassurance used to lower your guard. Authorised push payments are rarely reversible, which is exactly why scammers make this promise.",
  },
  { t: " so it's totally safe." },
];

const FULL_LEN = MESSAGE.reduce((n, p) => n + p.t.length, 0);

function DemoMessage() {
  const { ref, visible } = useReveal(0.35);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setCount(FULL_LEN);
      return;
    }
    const id = window.setInterval(() => {
      setCount((c) => {
        if (c >= FULL_LEN) {
          window.clearInterval(id);
          return c;
        }
        return c + 2;
      });
    }, 18);
    return () => window.clearInterval(id);
  }, [visible]);

  const done = count >= FULL_LEN;
  let cursor = 0;
  let flagIndex = 0;

  return (
    <div className="sherpa-demo" ref={ref}>
      <div className="sherpa-demo-bar">
        <span className="sherpa-dot" aria-hidden="true" />
        <span>Sherpa · scanning locally</span>
        <span className="sherpa-demo-state">{done ? "3 risks · 2 warnings" : "reading…"}</span>
      </div>

      <p className="sherpa-demo-body">
        {MESSAGE.map((part, i) => {
          const start = cursor;
          cursor += part.t.length;
          const shown = part.t.slice(0, Math.max(0, Math.min(part.t.length, count - start)));
          if (!shown) return null;
          if (!part.kind) return <span key={i}>{shown}</span>;

          const delay = done ? `${flagIndex++ * 0.28}s` : "0s";
          return (
            <span
              key={i}
              tabIndex={0}
              className={`sherpa-flag is-${part.kind} ${done ? "is-lit" : ""}`}
              style={{ "--flag-delay": delay }}
            >
              {shown}
              <span className="sherpa-tip" role="tooltip">
                <strong>{part.label}</strong>
                {part.note}
              </span>
            </span>
          );
        })}
        {!done ? <span className="sherpa-caret" aria-hidden="true" /> : null}
      </p>

      <p className="sherpa-demo-hint">
        Hover or focus a highlight for the reason. Red = malicious. Yellow = shady, proceed carefully.
      </p>
    </div>
  );
}

/* ---------- cipher stat: scrambles then resolves to its real value ---------- */

const CIPHER_CHARS = "01#$%&01001101!?01";

function CipherStat({ value, label }) {
  const { ref, visible } = useReveal(0.7);
  const [display, setDisplay] = useState(value);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      setSettled(true);
      return;
    }

    const len = value.length;
    const settleAt = 46 + Math.floor(Math.random() * 8); // ticks before locking in
    let tick = 0;

    const id = window.setInterval(() => {
      tick += 1;
      if (tick >= settleAt) {
        setDisplay(value);
        setSettled(true);
        window.clearInterval(id);
        return;
      }
      let scrambled = "";
      for (let i = 0; i < len; i++) {
        // characters lock in left-to-right as the tick count climbs
        const lockThreshold = settleAt - (len - i) * 6;
        scrambled += tick >= lockThreshold
          ? value[i]
          : CIPHER_CHARS[Math.floor(Math.random() * CIPHER_CHARS.length)];
      }
      setDisplay(scrambled);
    }, 70);

    return () => window.clearInterval(id);
  }, [visible, value]);

  return (
    <div className="sherpa-stat" ref={ref}>
      <span className={`sherpa-stat-num ${settled ? "is-settled" : "is-ciphering"}`}>
        {display}
      </span>
      <span className="sherpa-stat-label">{label}</span>
    </div>
  );
}

/* ---------- page ---------- */

export default function Sherpa() {
  return (
    <section className="goal-page sherpa-page">
      <div className="goal-hero sherpa-hero">
        <p className="sherpa-parent reveal delay-1">YPNIR</p>
        <h1 className="reveal delay-2">
          Introducing <span className="sherpa-mark">Sherpa</span>
        </h1>
        <p className="lede reveal delay-3">
          A browser extension, bundled with YPNIR, that highlights risky text the moment
          it reaches you — money requests, malicious links and misinformation — before
          it costs you anything.
        </p>
        <p className="sherpa-privacy-flag reveal delay-4">
          Runs entirely on your device · nothing is uploaded · no account
        </p>
      </div>

      <Block direction="up">
        <DemoMessage />
      </Block>

      <Block direction="left">
        <div className="goal-section">
          <div>
            <h2>What it watches for</h2>
            <ul className="sherpa-list">
              <li>
                <span className="sherpa-swatch is-danger" aria-hidden="true" />
                <div>
                  <strong>Money and payment pressure</strong>
                  Requests for cash, gift cards, crypto or wire transfers, especially
                  urgent ones from a new contact.
                </div>
              </li>
              <li>
                <span className="sherpa-swatch is-danger" aria-hidden="true" />
                <div>
                  <strong>Malicious and look-alike links</strong>
                  Domains built to impersonate banks, couriers, employers and login
                  pages to harvest credentials and one-time codes.
                </div>
              </li>
              <li>
                <span className="sherpa-swatch is-warn" aria-hidden="true" />
                <div>
                  <strong>Misinformation and false reassurance</strong>
                  Claims engineered to lower your guard — "the bank will reverse it",
                  "this is a verified agent", "everyone gets this refund".
                </div>
              </li>
              <li>
                <span className="sherpa-swatch is-warn" aria-hidden="true" />
                <div>
                  <strong>Social pressure and secrecy</strong>
                  Isolation tactics, countdown deadlines and instructions to keep the
                  conversation from anyone else.
                </div>
              </li>
            </ul>
          </div>
        </div>
      </Block>

      <Block direction="right">
        <div className="goal-section goal-section--reverse">
          <div>
            <h2>Privacy is the product</h2>
            <p>
              Sherpa is our number one commitment before it is a feature. The model
              runs locally in your browser. Your messages, your contacts and the pages
              you read never leave your machine, because there is no server for them to
              leave to.
            </p>
            <div className="sherpa-privacy-grid">
              <div>
                <strong>Local only</strong>
                Detection happens on-device, offline-capable.
              </div>
              <div>
                <strong>Zero upload</strong>
                No message text, no metadata, no telemetry.
              </div>
              <div>
                <strong>No account</strong>
                Nothing to sign into, nothing to profile.
              </div>
              <div>
                <strong>You stay in control</strong>
                Sherpa flags and explains. It never blocks, sends or replies for you.
              </div>
            </div>
          </div>
        </div>
      </Block>

      <Block direction="up">
        <div className="goal-section">
          <div>
            <h2>How Sherpa reads a message</h2>
            <p>Three steps, all on-device, in the time it takes to read the line yourself.</p>

            <div className="sherpa-pipeline">
              <div className="sherpa-pipe-step">
                <span className="sherpa-pipe-num">01</span>
                <h3>Scan</h3>
                <p>Text is tokenized locally as it renders — nothing buffered, nothing sent out.</p>
              </div>
              <span className="sherpa-pipe-arrow" aria-hidden="true" />
              <div className="sherpa-pipe-step">
                <span className="sherpa-pipe-num">02</span>
                <h3>Flag</h3>
                <p>Risky spans are underlined in place, yellow for shady, red for malicious.</p>
              </div>
              <span className="sherpa-pipe-arrow" aria-hidden="true" />
              <div className="sherpa-pipe-step">
                <span className="sherpa-pipe-num">03</span>
                <h3>Explain</h3>
                <p>Hover any flag for a plain-language reason — no dashboard, no report to read later.</p>
              </div>
            </div>

            <div className="sherpa-stat-row">
              <CipherStat value="0" label="bytes leave your device" />
              <CipherStat value="<1s" label="to flag a message on-device" />
              <CipherStat value="2" label="signal levels — shady, malicious" />
            </div>
          </div>
        </div>
      </Block>
    </section>
  );
}
