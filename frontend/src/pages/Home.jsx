import { Link } from "react-router-dom";
import NewsWidget from "../components/NewsWidget.jsx";

export default function Home() {
  return (
    <section className="hero">
      <h1 className="reveal delay-1">
        You think you&apos;re
        <br />
        being scammed?
      </h1>
      <p className="lede reveal delay-2">
        Six questions. A live verdict. Built like a SOC console — usable if you
        just got a weird call, text, or DM.
      </p>
      <div className="cta-row reveal delay-3">
        <Link className="btn btn-primary" to="/questionnaire">
          Run check
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Open intel
        </Link>
      </div>

      <NewsWidget />

      <div className="stats reveal delay-5">
        <div className="stat">
          <strong>6 probes</strong>
          <span>Channel, impersonation, money, pressure, voice.</span>
        </div>
        <div className="stat">
          <strong>Known TTPs</strong>
          <span>Family emergency, IRS, tech support, phishing.</span>
        </div>
        <div className="stat">
          <strong>Discord node</strong>
          <span>Run /scamcheck without leaving the chat.</span>
        </div>
      </div>

      <div className="compat reveal delay-6">
        <span className="compat-label">Compatible with</span>
        <div className="compat-row">
          <span className="compat-badge">Discord</span>
          <span className="compat-badge">Windows</span>
          <span className="compat-badge">macOS</span>
          <span className="compat-badge">Chrome</span>
          <span className="compat-badge">iOS</span>
          <span className="compat-badge">Android</span>
          <span className="compat-badge">Instagram</span>
        </div>
      </div>
    </section>
  );
}
