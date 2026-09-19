import { Link } from "react-router-dom";

export default function Home() {
  return (
    <section className="hero">
      <p className="eyebrow">You think you're being scammed?</p>
      <h1>Find out here.</h1>
      <p className="lede">
        Answer a few questions and we'll tell you the most likely scam and why —
        or browse a living repository of how scams actually work.
      </p>
      <div className="cta-row">
        <Link className="btn btn-primary" to="/questionnaire">
          Am I being scammed?
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Browse the repository
        </Link>
      </div>
    </section>
  );
}
