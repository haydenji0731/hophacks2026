import { useEffect, useRef, useState } from "react";

function useReveal() {
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
      { threshold: 0.2, rootMargin: "0px 0px -80px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function GoalBlock({ direction = "up", children, className = "" }) {
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

const PLATFORMS = [
  {
    name: "Discord",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="14" width="36" height="24" rx="10" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="18" cy="27" r="2.6" fill="currentColor" />
        <circle cx="30" cy="27" r="2.6" fill="currentColor" />
        <path d="M16 14 L19 9 M32 14 L29 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Windows",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="15" height="15" fill="currentColor" opacity="0.85" />
        <rect x="25" y="6" width="17" height="15" fill="currentColor" opacity="0.55" />
        <rect x="6" y="25" width="15" height="17" fill="currentColor" opacity="0.55" />
        <rect x="25" y="25" width="17" height="17" fill="currentColor" opacity="0.85" />
      </svg>
    ),
  },
  {
    name: "macOS",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="10" width="32" height="21" rx="2.5" stroke="currentColor" strokeWidth="2.4" />
        <path d="M18 37 H30" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M24 31 V37" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    ),
  },
  {
    name: "Chrome",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="24" cy="24" r="6.5" stroke="currentColor" strokeWidth="2.4" />
        <path d="M24 7 V17.5 M11 30.5 L19.5 25.5 M37 30.5 L28.5 25.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "iOS",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="15" y="4" width="18" height="40" rx="4" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="24" cy="37" r="2" fill="currentColor" />
      </svg>
    ),
  },
  {
    name: "Android",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 20 H35 V33 a4 4 0 0 1-4 4 H17 a4 4 0 0 1-4-4 Z" stroke="currentColor" strokeWidth="2.4" />
        <path d="M13 20 a11 11 0 0 1 22 0" stroke="currentColor" strokeWidth="2.4" />
        <path d="M9 22 V31 M39 22 V31" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M18 12 L15.5 8 M30 12 L32.5 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    name: "Instagram",
    icon: (
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="36" height="36" rx="10" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="24" cy="24" r="8.5" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="34" cy="14" r="2" fill="currentColor" />
      </svg>
    ),
  },
];

export default function OurGoal() {
  return (
    <section className="goal-page">
      <div className="goal-hero">
        <p className="eyebrow reveal delay-1">Our goal</p>
        <h1 className="reveal delay-2">
          Catch it
          <br />
          while it&apos;s happening.
        </h1>
        <p className="lede reveal delay-3">
          Not a report you file after the money is gone. A signal while the
          call is still live.
        </p>
      </div>

      <GoalBlock direction="left">
        <div className="goal-section">
          <span className="goal-index">01</span>
          <div>
            <h2>Privacy is the whole foundation</h2>
            <p>
              We built this assuming people would only trust it if it never
              became one more thing watching them. Audio is processed for
              signal, not stored for surveillance. What leaves your device is
              a pattern match, not a recording.
            </p>
            <ul className="goal-list">
              <li>No permanent audio storage — analysis happens, then it's gone.</li>
              <li>The public repository only ever holds anonymized scam patterns, never personal data.</li>
              <li>Nothing is sold, brokered, or handed to advertisers. Ever.</li>
              <li>You can run the detector fully local if you don't want anything leaving your machine.</li>
            </ul>
          </div>
        </div>
      </GoalBlock>

      <GoalBlock direction="right">
        <div className="goal-section goal-section--reverse">
          <span className="goal-index">02</span>
          <div>
            <h2>Live detection, not after-the-fact reports</h2>
            <p>
              Most tools tell you what already happened to someone else. We
              want to tell you what's happening to you, right now, before you
              hang up and wire the money.
            </p>
            <div className="goal-compare">
              <div className="goal-compare-col">
                <span className="goal-compare-tag muted">The old way</span>
                <p>Victim reports it days later. Pattern gets logged. The next caller uses a new script.</p>
              </div>
              <div className="goal-compare-col goal-compare-col--accent">
                <span className="goal-compare-tag">Our way</span>
                <p>Voice cadence, pressure language, and known TTPs are scored mid-call — while you can still hang up.</p>
              </div>
            </div>
          </div>
        </div>
      </GoalBlock>

      <GoalBlock direction="up">
        <div className="goal-closing">
          <h2>Where this goes next</h2>
          <p className="lede" style={{ margin: "0 auto" }}>
            Every call we screen makes the corpus smarter for the next person.
            The goal isn't a bigger encyclopedia of scams — it's fewer people
            ever needing to look one up.
          </p>
        </div>
      </GoalBlock>

      <GoalBlock direction="up">
        <div className="compat compat--goal">
          <span className="compat-label">Compatible with</span>
          <div className="compat-logo-row">
            {PLATFORMS.map((p) => (
              <div key={p.name} className="compat-logo" title={p.name}>
                <span className="compat-logo-icon">{p.icon}</span>
                <span className="compat-logo-name">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </GoalBlock>
    </section>
  );
}
