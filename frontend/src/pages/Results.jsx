import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import RiskGauge from "../components/RiskGauge.jsx";
import { diagnose, headline, lede, reportPayload } from "../data/questions.js";

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
        <p className="eyebrow">Results</p>
        <h1>Start a check first</h1>
        <p className="lede">Answer a few questions so we can score what happened.</p>
        <Link className="btn btn-primary" to="/questionnaire">
          Find out
        </Link>
      </section>
    );
  }

  if (result.insufficient) {
    return (
      <section className="page">
        <p className="verdict">
          <span className="verdict-dot" />
          Incomplete
        </p>
        <h1>Not enough to call it yet</h1>
        <p className="lede">
          We need a few more answers before we can say whether this is a scam.
        </p>
        <div className="result-primary">
          <p>
            If you feel pressured, hang up. Call the real organization on a number
            you already trust — not the one in the message.
          </p>
        </div>
        <div className="cta-row" style={{ justifyContent: "flex-start" }}>
          <Link className="btn btn-primary" to="/questionnaire">
            Answer more
          </Link>
          <Link className="btn btn-secondary" to="/scams">
            Browse patterns
          </Link>
        </div>
      </section>
    );
  }

  const isLikely = result.likely;

  return (
    <section className="page">
      <p className={`verdict ${isLikely ? "danger" : "safe"}`}>
        <span className="verdict-dot" />
        {isLikely ? "Likely a scam" : "Unlikely a scam"}
      </p>
      <h1>{headline(result)}</h1>
      <p className="lede">{lede(result)}</p>

      <div className="risk-block">
        <RiskGauge value={result.riskScore} />
        <div className="metric-row metric-row--pair">
          <div className="metric">
            <b>{result.flags.length}</b>
            <span>Warning signs</span>
          </div>
          <div className="metric">
            <b>{result.answeredCount}</b>
            <span>Answers used</span>
          </div>
        </div>
      </div>

      <div className="result-primary">
        <h2>{isLikely ? "Why we say this" : "What we noticed"}</h2>
        {result.flags.length > 0 ? (
          <ul>
            {result.flags.map((flag) => (
              <li key={flag}>{flag}</li>
            ))}
          </ul>
        ) : (
          <p>
            You did not describe the usual asks: payment, a link or code, pressure
            to act fast, or a voice that sounded off.
          </p>
        )}
        {!isLikely && result.flags.length > 0 ? (
          <p className="muted">These alone are not enough to call it a scam.</p>
        ) : null}
      </div>

      {isLikely && result.primary ? (
        <>
          <h2>Most likely match</h2>
          <div className="result-primary">
            <h2>{result.primary.name}</h2>
            <p>{result.primary.summary}</p>
            <Link to={`/scams/${result.primary.id}`}>Open pattern →</Link>
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
        </>
      ) : null}

      {isLikely && !result.primary ? (
        <p className="muted">
          No single pattern scored high enough, but the warning signs still apply.
        </p>
      ) : null}

      {reportMessage ? (
        <p className={reportState === "error" ? "report-status error" : "report-status"}>
          {reportMessage}
        </p>
      ) : null}

      <div className="cta-row" style={{ justifyContent: "flex-start" }}>
        {isLikely && result.primary ? (
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
                : "This happened to me"}
          </button>
        ) : null}
        <Link className="btn btn-secondary" to="/questionnaire">
          Check again
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Repository
        </Link>
      </div>
    </section>
  );
}
