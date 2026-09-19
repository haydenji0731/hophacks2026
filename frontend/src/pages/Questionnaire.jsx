import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { QUESTIONS } from "../data/questions.js";

export default function Questionnaire() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState("");

  const question = QUESTIONS[step];
  const onLast = step >= QUESTIONS.length;

  function goResults() {
    navigate("/results", { state: { answers: { ...answers, details } } });
  }

  function pickOption(value) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));
    setStep((s) => s + 1);
  }

  return (
    <section className="page a11y-large">
      <p className="muted">
        {onLast
          ? "Last step"
          : `Question ${step + 1} of ${QUESTIONS.length}`}
      </p>
      {!onLast ? (
        <>
          <h1>{question.prompt}</h1>
          {question.help ? <p className="lede" style={{ marginLeft: 0 }}>{question.help}</p> : null}
          <div className="option-stack">
            {question.options.map((opt) => (
              <button
                key={opt.value}
                className={`btn btn-secondary btn-xl option ${answers[question.id] === opt.value ? "option-picked" : ""}`}
                type="button"
                onClick={() => pickOption(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {step > 0 ? (
            <button className="btn btn-secondary" type="button" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          ) : null}
        </>
      ) : (
        <form
          className="questionnaire"
          onSubmit={(e) => {
            e.preventDefault();
            goResults();
          }}
        >
          <h1>Anything else we should know?</h1>
          <label className="field">
            <span>Optional. Names and account numbers are not needed.</span>
            <textarea
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What happened, in your own words…"
            />
          </label>
          <button className="btn btn-primary btn-xl" type="submit">
            See results
          </button>
        </form>
      )}
    </section>
  );
}
