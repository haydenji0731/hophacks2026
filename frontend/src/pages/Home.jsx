import { Link } from "react-router-dom";
import NewsWidget from "../components/NewsWidget.jsx";

export default function Home() {
  return (
    <section className="hero">
      <h1 className="reveal delay-1">Being scammed?</h1>
      <p className="lede reveal delay-2">Six questions. A live Verdict</p>
      <div className="cta-row reveal delay-3">
        <Link className="btn btn-primary" to="/questionnaire">
          Run check
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Open intel
        </Link>
      </div>

      <NewsWidget />

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
