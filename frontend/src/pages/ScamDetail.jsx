import { useParams, Link } from "react-router-dom";

export default function ScamDetail() {
  const { id } = useParams();

  // TODO: fetch the scam record by id from the API.
  return (
    <section className="page">
      <Link className="back-link" to="/scams">
        ← Back to repository
      </Link>

      <h1>Scam detail</h1>
      <p className="muted">Record: {id}</p>

      <div className="placeholder-card">
        How it works, signals, methods, and what to do go here.
      </div>
    </section>
  );
}
