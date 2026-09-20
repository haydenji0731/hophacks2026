import { useNavigate } from "react-router-dom";
import { useState } from "react";
import NewsWidget from "../components/NewsWidget.jsx";
import CompatMarquee from "../components/CompatMarquee.jsx";
import OurGoal from "./OurGoal.jsx";

export default function Home() {
  const navigate = useNavigate();
  const [locking, setLocking] = useState(false);

  function handleRunCheck() {
    if (locking) return;
    setLocking(true);
    window.setTimeout(() => navigate("/questionnaire"), 780);
  }

  return (
    <>
      <section className="hero">
        <h1 className="reveal delay-1">Let's <span>Debrief</span></h1>
        <p className="lede reveal delay-2">Six questions. A live verdict.</p>
        <div className="cta-row reveal delay-3">
          <button
            type="button"
            className={`btn btn-primary btn-hero btn-lock ${locking ? "is-locking" : ""}`}
            onClick={handleRunCheck}
            disabled={locking}
          >
            <span className="btn-lock-label">Run check</span>
            <svg className="btn-lock-icon" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">
              <rect className="btn-lock-body" x="14" y="28" width="36" height="28" rx="6" />
              <path
                className="btn-lock-shackle"
                d="M22 28 V20 a10 10 0 0 1 20 0 V28"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle className="btn-lock-dot" cx="32" cy="40" r="3.4" />
              <rect className="btn-lock-slot" x="30" y="42" width="4" height="7" rx="1.5" />
            </svg>
          </button>
        </div>

        <NewsWidget />

        <CompatMarquee />
      </section>

      <div className="home-goal">
        <OurGoal />
      </div>
    </>
  );
}
