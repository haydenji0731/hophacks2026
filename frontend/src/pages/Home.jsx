import { Link, useNavigate } from "react-router-dom";
import { QUESTIONS } from "../data/questions.js";

const first = QUESTIONS[0];

export default function Home() {
  const navigate = useNavigate();

  function startWith(value) {
    navigate("/questionnaire", { state: { preset: { [first.id]: value } } });
  }

  return (
    <section className="hero">
      <p className="eyebrow reveal delay-1">Threat check · inbound</p>
      <h1 className="reveal delay-2">
        You think you&apos;re
        <br />
        being scammed?
      </h1>
      <p className="lede reveal delay-3">
        Six questions. A live verdict. Built like a SOC console — usable if you
        just got a weird call, text, or DM.
      </p>
      <div className="cta-row reveal delay-4">
        <Link className="btn btn-primary" to="/questionnaire">
          Run check
        </Link>
        <Link className="btn btn-secondary" to="/scams">
          Open intel
        </Link>
      </div>

      <div className="product-stage reveal delay-5">
        <div className="product-window">
          <span className="hud-corner tl" aria-hidden="true" />
          <span className="hud-corner tr" aria-hidden="true" />
          <span className="hud-corner bl" aria-hidden="true" />
          <span className="hud-corner br" aria-hidden="true" />
          <div className="window-scan" aria-hidden="true" />
          <div className="window-bar">
            <span className="live-dot">LIVE</span>
            <span>check / 01 of {String(QUESTIONS.length).padStart(2, "0")}</span>
            <span>ETA 60s</span>
          </div>
          <div className="window-body">
            <h2>{first.prompt}</h2>
            <p className="muted">{first.help}</p>
            <div className="chip-row">
              {first.options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className="chip"
                  onClick={() => startWith(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="stats reveal delay-6">
        <div className="stat">
          <strong>6 probes</strong>
          <span>Channel, impersonation, money, pressure, voice.</span>
        </div>
        <div className="stat">
          <strong>Known TTPs</strong>
          <span>Family emergency, IRS, tech support, phishing.</span>
        </div>
        <div className="stat">
          <strong>Discord node</strong>
          <span>Run /scamcheck without leaving the chat.</span>
        </div>
      </div>
    </section>
  );
}
