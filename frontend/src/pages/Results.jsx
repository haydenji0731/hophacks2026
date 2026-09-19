import { Link } from "react-router-dom";

export default function Results() {
  // TODO: read ranked candidates returned from the API (rules + embeddings + DB).
  return (
    <section className="page">
      <h1>Your results</h1>

      <div className="result-primary placeholder-card">
        Most likely scam goes here.
      </div>

      <h2>Other possibilities</h2>
      <div className="placeholder-card">Ranked alternatives go here.</div>

      <div className="cta-row">
        <button className="btn btn-primary">This is what happened to me</button>
        <Link className="btn btn-secondary" to="/scams">
          Browse the repository
        </Link>
      </div>
    </section>
  );
}
