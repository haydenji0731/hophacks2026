import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { diagnose, reportPayload } from "../data/questions.js";

export default function Results() {
  const location = useLocation();
  const answers = location.state?.answers;
  const result = answers ? diagnose(answers) : null;
  const [reportState, setReportState] = useState("idle");
  const [reportMessage, setReportMessage] = useState("");

  async function submitReport() {
    if (!result?.primary || reportState === "saving" || reportState === "done") return;
    setReportState("saving");
    setReportMessage("");
    try {
      const response = await fetch("/api/v1/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload(result)),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.detail?.detail || body.detail || "Could not save this report.");
      }
      const action = body.db?.action;
      if (action === "created" || action === "updated") {
        setReportState("done");
        setReportMessage(
          action === "created"
            ? "Saved. This pattern is now in the public repository."
            : `Saved. This pattern has been seen ${body.db.frequency} times.`,
        );
      } else {
        setReportState("error");
        setReportMessage(
          (body.warnings && body.warnings[0]) ||
            "Saved on this page, but the database skipped the write. Is Postgres running?",
        );
      }
    } catch (err) {
      setReportState("error");
      setReportMessage(
        err.message?.includes("fetch")
          ? "Could not reach the detector. Start backend/detector on port 8000."
          : err.message || "Could not save this report.",
      );
    }
  }

  if (!result) {
    return (
      <section className="page">
        <h1>Your results</h1>
        <p className="lede" style={{ marginLeft: 0 }}>
          Start with the questionnaire so we can match what happened to a known pattern.
        </p>
        <Link className="btn btn-primary" to="/questionnaire">
          Am I being scammed?
        </Link>
      </section>
    );
  }

  if (result.insufficient) {
    return (
      <section className="page a11y-large">
        <h1>Not enough information yet</h1>
        <p className="lede" style={{ marginLeft: 0 }}>
          We need a few more answers before we can suggest a scam type. Nothing you
          told us so far is enough to match a pattern.
        </p>
        <div className="result-primary">
          <p>
            Hang up if you feel pressured, and call the real organization on a number
            you already trust — not a number from the message or caller.
          </p>
        </div>
        <div className="cta-row" style={{ justifyContent: "flex-start" }}>
          <Link className="btn btn-primary" to="/questionnaire">
            Answer a few more questions
          </Link>
          <Link className="btn btn-secondary" to="/scams">
            Browse the repository
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="page a11y-large">
      <h1>This looks most like</h1>
      <p className="muted">
        This is a guide, not a guarantee. When in doubt, hang up and call the real
        organization on a number you already trust.
      </p>

      <div className="result-primary">
        <h2>{result.primary.name}</h2>
        <p>{result.primary.summary}</p>
      </div>

      {result.alternatives.length > 0 ? (
        <>
          <h2>Other possibilities</h2>
          <ul className="scam-list">
            {result.alternatives.map((s) => (
              <li key={s.id} className="result-alt">
                <strong>{s.name}</strong>
                <p className="muted">{s.summary}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {reportMessage ? (
        <p className={reportState === "error" ? "report-status error" : "report-status"}>
          {reportMessage}
        </p>
      ) : null}

      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={submitReport}
          disabled={reportState === "saving" || reportState === "done"}
        >
          {reportState === "saving"
            ? "Saving…"
            : reportState === "done"
              ? "Reported"
              : "This is what happened to me"}
        </button>
        <Link className="btn btn-secondary" to="/questionnaire">
          Answer again
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Browse the repository
        </Link>
      </div>
    </section>
  );
}
