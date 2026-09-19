import { useNavigate } from "react-router-dom";

export default function Questionnaire() {
  const navigate = useNavigate();

  // TODO: load questions from the API and drive the Akinator-style flow.
  // For now this is a shell that routes to the results page.
  function handleSubmit(e) {
    e.preventDefault();
    navigate("/results");
  }

  return (
    <section className="page">
      <h1>Am I being scammed?</h1>
      <p className="lede">
        Adaptive questions + optional free-text details narrow down the most
        likely scam.
      </p>

      <form className="questionnaire" onSubmit={handleSubmit}>
        {/* TODO: render adaptive questions from the scam database */}
        <div className="placeholder-card">Questionnaire steps go here.</div>

        <label className="field">
          <span>Anything important we should know?</span>
          <textarea rows={4} placeholder="Describe what happened…" />
        </label>

        <button className="btn btn-primary" type="submit">
          See results
        </button>
      </form>
    </section>
  );
}
