import { useParams, Link } from "react-router-dom";
import { SCAM_TYPES } from "../data/questions.js";

export default function ScamDetail() {
  const { id } = useParams();
  const scam = SCAM_TYPES.find((item) => item.id === id);

  if (!scam) {
    return (
      <section className="page">
        <Link className="back-link" to="/scams">
          ← Repository
        </Link>
        <h1>Pattern not found</h1>
        <p className="muted">That record is not in the catalog yet.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <Link className="back-link" to="/scams">
        ← Repository
      </Link>
      <p className="eyebrow">Pattern</p>
      <h1>{scam.name}</h1>
      <p className="lede">{scam.summary}</p>
      <div className="result-primary">
        <h2>What to do</h2>
        <p>
          Stop the conversation. Do not send money, gift cards, crypto, or
          verification codes. Call the real organization on a number you already
          have — not the one in the message.
        </p>
      </div>
      <Link className="btn btn-primary" to="/questionnaire">
        Check a case
      </Link>
    </section>
  );
}
