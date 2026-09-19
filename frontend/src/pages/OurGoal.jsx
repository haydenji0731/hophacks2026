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
    </section>
  );
}
