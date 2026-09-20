import { useEffect, useRef, useState } from "react";
import ReportScamForm from "../components/ReportScamForm.jsx";

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
          Not a report you read after your money is gone, but a signal to get
          out while the call is still live.
        </p>
      </div>

      <GoalBlock direction="left">
        <div className="goal-section">
          <span className="goal-index">01</span>
          <div>
            <h2>Privacy is key</h2>
            <p>
              We like our privacy. We know you do too.
            </p>
            <ul className="goal-list">
              <li>
                When we built YPINR, Sherpa, and Outpost, we kept your information
                out of the hands of advertisers and data brokers.
              </li>
              <li>
                Nothing personal is ever stored — only patterns of scammers&apos;
                behavior. No accounts needed.
              </li>
              <li>
                Audio and transcriptions are stored only for analysis. Every time
                we listen in, we&apos;ll let you know by text.
              </li>
            </ul>
          </div>
        </div>
      </GoalBlock>

      <GoalBlock direction="right">
        <div className="goal-section">
          <span className="goal-index">02</span>
          <div>
            <h2>Stories change. But the goal is the same.</h2>
            <p>
              While scammers will change what they say, they&apos;re always after
              one thing: taking advantage of you, financially or otherwise.
            </p>
            <div className="goal-compare">
              <div className="goal-compare-col">
                <span className="goal-compare-tag muted">The old way</span>
                <p>
                  The victim realizes they&apos;ve been scammed after the fact.
                  They have no recourse.
                </p>
              </div>
              <div className="goal-compare-col goal-compare-col--accent">
                <span className="goal-compare-tag">The new way</span>
                <p>
                  AI doesn&apos;t listen to you — it listens to the patterns that
                  all scammers share. And when it&apos;s confident, it&apos;s going
                  to let you know before it&apos;s too late.
                </p>
              </div>
            </div>
          </div>
        </div>
      </GoalBlock>

      <GoalBlock direction="up">
        <div className="goal-closing">
          <h2>What&apos;s next?</h2>
          <p className="lede" style={{ margin: "0 auto" }}>
            Every experience you share with us lowers the chance that a scammer
            will be able to take advantage of somebody else. Our goal isn&apos;t
            a big list of scams — it&apos;s peace of mind from them.
          </p>
          <ReportScamForm />
        </div>
      </GoalBlock>
    </section>
  );
}
