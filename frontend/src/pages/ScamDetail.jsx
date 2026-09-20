import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { SCAM_TYPES } from "../data/questions.js";
import { apiUrl } from "../lib/api.js";

export default function ScamDetail() {
  const { id } = useParams();
  const fallback = SCAM_TYPES.find((item) => item.id === id);
  const [scam, setScam] = useState(
    fallback
      ? {
          id: fallback.id,
          name: fallback.id,
          title: fallback.name,
          description: fallback.summary,
          platforms: [],
          demands: [],
          victim_roles: [],
          frequency: 0,
        }
      : null,
  );
  const [status, setStatus] = useState(fallback ? "fallback" : "loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(apiUrl(`/v1/intel/${encodeURIComponent(id)}`), { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("missing");
        return res.json();
      })
      .then((data) => {
        setScam(data);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        if (fallback) {
          setScam({
            id: fallback.id,
            name: fallback.id,
            title: fallback.name,
            description: fallback.summary,
            platforms: [],
            demands: [],
            victim_roles: [],
            frequency: 0,
          });
          setStatus("fallback");
          return;
        }
        setScam(null);
        setStatus("missing");
      });
    return () => controller.abort();
  }, [id, fallback]);

  if (status === "loading") {
    return (
      <section className="page">
        <Link className="back-link" to="/scams">
          ← Repository
        </Link>
        <p className="muted">Loading pattern…</p>
      </section>
    );
  }

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
      <h1>{scam.title || scam.name}</h1>
      <p className="lede">{scam.description}</p>
      {(scam.platforms?.length > 0 || scam.demands?.length > 0) && (
        <p className="muted">
          {scam.frequency > 0 ? `${scam.frequency} reports. ` : null}
          {scam.platforms?.length ? `Platforms: ${scam.platforms.join(", ")}. ` : null}
          {scam.demands?.length ? `Asks for: ${scam.demands.join(", ")}.` : null}
        </p>
      )}
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
