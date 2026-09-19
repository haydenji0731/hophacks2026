import { Link } from "react-router-dom";
import NewsWidget from "../components/NewsWidget.jsx";
import CompatMarquee from "../components/CompatMarquee.jsx";
import OurGoal from "./OurGoal.jsx";

export default function Home() {
  return (
    <>
      <section className="hero">
        <h1 className="reveal delay-1">Being scammed?</h1>
        <p className="lede reveal delay-2">Six questions. A live Verdict</p>
        <div className="cta-row reveal delay-3">
          <Link className="btn btn-primary" to="/questionnaire">
            Run check
          </Link>
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
