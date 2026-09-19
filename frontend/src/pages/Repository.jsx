import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SCAM_TYPES } from "../data/questions.js";

export default function Repository() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SCAM_TYPES;
    return SCAM_TYPES.filter(
      (scam) =>
        scam.name.toLowerCase().includes(q) ||
        scam.summary.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <section className="repo-head">
      <p className="eyebrow">Threat intel</p>
      <h1>Pattern repository</h1>
      <p className="lede">
        Known patterns we score against. Search by name or how it shows up.
      </p>

      <input
        className="search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search patterns…"
        aria-label="Search scam patterns"
      />

      <ul className="scam-list">
        {filtered.length === 0 ? (
          <li className="placeholder-card">No patterns match that search.</li>
        ) : (
          filtered.map((scam) => (
            <li key={scam.id}>
              <Link className="scam-card" to={`/scams/${scam.id}`}>
                <strong>{scam.name}</strong>
                <p>{scam.summary}</p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
