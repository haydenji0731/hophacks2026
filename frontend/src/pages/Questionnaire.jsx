import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { QUESTIONS } from "../data/questions.js";

export default function Questionnaire() {
  const navigate = useNavigate();
  const location = useLocation();
  const preset = location.state?.preset || {};
  const presetKeys = Object.keys(preset);
  const startStep = presetKeys.length
    ? Math.min(
        QUESTIONS.findIndex((q) => !preset[q.id]),
        QUESTIONS.length,
      )
    : 0;

  const [step, setStep] = useState(startStep === -1 ? QUESTIONS.length : startStep);
  const [answers, setAnswers] = useState(preset);
  const [details, setDetails] = useState("");
  const [swap, setSwap] = useState("in");

  const question = QUESTIONS[step];
  const onLast = step >= QUESTIONS.length;
  const progress = Math.min(step, QUESTIONS.length) / QUESTIONS.length;
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function goTo(next) {
    if (reduce) {
      setStep(next);
      return;
    }
    setSwap("out");
    window.setTimeout(() => {
      setStep(next);
      setSwap("in");
    }, 220);
  }

  function goResults() {
    navigate("/results", { state: { answers: { ...answers, details } } });
  }

  function pickOption(value) {
    if (swap === "out") return;
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    goTo(step + 1);
  }

  return (
    <section className="check-shell">
      <p className="eyebrow">
        {onLast ? "Last step" : `Question ${step + 1} of ${QUESTIONS.length}`}
      </p>
      <div className="progress" aria-hidden="true">
        <span style={{ width: `${Math.max(progress, 0.08) * 100}%` }} />
      </div>

      <div key={onLast ? "tail" : question.id} className={`step-swap is-${swap}`}>
        <div className="step-scan" aria-hidden="true" />
        {!onLast ? (
          <>
            <h1>{question.prompt}</h1>
            {question.help ? <p className="lede">{question.help}</p> : null}
            <div className="option-stack">
              {question.options.map((opt) => (
                <button
                  key={opt.value}
                  className={`option ${answers[question.id] === opt.value ? "option-picked" : ""}`}
                  type="button"
                  onClick={() => pickOption(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {step > 0 ? (
              <button className="ghost-link" type="button" onClick={() => goTo(step - 1)}>
                ← Back
              </button>
            ) : null}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              goResults();
            }}
          >
            <h1>Anything else we should know?</h1>
            <label className="field">
              <span>Optional. Skip names, account numbers, and codes.</span>
              <textarea
                rows={5}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What happened, in your own words…"
              />
            </label>
            <div className="cta-row" style={{ justifyContent: "flex-start" }}>
              <button className="btn btn-primary" type="submit">
                See results
              </button>
              <button className="ghost-link" type="button" onClick={() => goTo(QUESTIONS.length - 1)}>
                ← Back
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
