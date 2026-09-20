import { useEffect, useRef, useState } from "react";
import RiskGauge from "../components/RiskGauge.jsx";
import { pct, processClip, processVerdict } from "../lib/detectorProcess.js";

const CLIP_SECONDS = 15;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pickRecorderMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => window.MediaRecorder?.isTypeSupported(t)) || "";
}

export default function Live() {
  const [phase, setPhase] = useState("standby");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [forceEscalate, setForceEscalate] = useState(true);
  const [notifyTo, setNotifyTo] = useState("");

  const canvasRef = useRef(null);
  const levelRef = useRef(0);
  const alertRef = useRef(false);
  const recRef = useRef(null);

  const recording = phase === "record";
  const uploading = phase === "upload";
  const busy = uploading;
  const hits = result?.keyword_hits || [];
  const score = result?.elevenlabs_ai_score;
  const grok = result?.grok;
  const isScam = Boolean(grok?.is_scam);
  const synthetic = result?.ai_voice_used === "yes" || isScam;
  const sensitivity = result?.sensitivity || (recording ? "low" : "cold");
  const verdict = processVerdict(result);

  useEffect(() => {
    alertRef.current = synthetic;
  }, [synthetic]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const bars = 42;
    const draw = (now) => {
      const { width, height } = canvas;
      const live = recRef.current?.listening;
      const intensity = live ? clamp(0.05 + levelRef.current * 2.4, 0.05, 1) : 0.06;
      ctx.clearRect(0, 0, width, height);
      const gap = 3;
      const bw = (width - gap * (bars - 1)) / bars;
      const accent =
        getComputedStyle(document.documentElement).getPropertyValue("--highlight").trim() ||
        "#EFC3F5";
      for (let i = 0; i < bars; i += 1) {
        const n =
          0.15 +
          0.55 * Math.abs(Math.sin(now / 180 + i * 0.37)) +
          0.3 * Math.abs(Math.sin(now / 90 + i * 0.11));
        const h = Math.max(3, n * intensity * (height - 8));
        ctx.fillStyle = i % 7 === 0 ? accent : "rgba(239,195,245,0.45)";
        ctx.globalAlpha = 0.3 + intensity * 0.7;
        ctx.fillRect(i * (bw + gap), (height - h) / 2, bw, h);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(
    () => () => {
      stopCapture();
    },
    [],
  );

  function stopCapture() {
    const rec = recRef.current;
    if (!rec) return;
    rec.listening = false;
    if (rec.timerId) window.clearInterval(rec.timerId);
    if (rec.raf) cancelAnimationFrame(rec.raf);
    rec.stream?.getTracks().forEach((t) => t.stop());
    rec.ctx?.close?.();
    if (rec.recorder && rec.recorder.state !== "inactive") rec.recorder.stop();
    recRef.current = null;
    levelRef.current = 0;
  }

  async function startListening() {
    setError("");
    setResult(null);
    setElapsed(0);
    const mime = pickRecorderMime();
    if (!window.MediaRecorder || !mime) {
      setError("This browser cannot record audio (need MediaRecorder / webm).");
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      setError("Mic blocked — allow microphone for this site, then try again.");
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const time = new Uint8Array(analyser.fftSize);

    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };

    const rec = { stream, ctx, analyser, recorder, raf: 0, listening: true, timerId: 0, waitResolve: null };
    recRef.current = rec;

    const poll = () => {
      analyser.getByteTimeDomainData(time);
      let sum = 0;
      for (let i = 0; i < time.length; i += 1) {
        const v = (time[i] - 128) / 128;
        sum += v * v;
      }
      levelRef.current = Math.sqrt(sum / time.length);
      rec.raf = requestAnimationFrame(poll);
    };
    rec.raf = requestAnimationFrame(poll);

    setPhase("record");
    recorder.start(250);

    const t0 = performance.now();
    await new Promise((resolve) => {
      rec.waitResolve = resolve;
      rec.timerId = window.setInterval(() => {
        const sec = Math.min(CLIP_SECONDS, (performance.now() - t0) / 1000);
        setElapsed(sec);
        if (sec >= CLIP_SECONDS) resolve();
      }, 100);
    });
    if (rec.timerId) window.clearInterval(rec.timerId);

    const blobType = mime.split(";")[0];
    await new Promise((resolve) => {
      if (recorder.state === "inactive") {
        resolve();
        return;
      }
      recorder.addEventListener("stop", resolve, { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
    stopCapture();

    const blob = new Blob(chunks, { type: blobType });
    await uploadClip(blob, mime.includes("mp4") ? "clip.m4a" : "clip.webm");
  }

  async function uploadClip(blob, filename) {
    setPhase("upload");
    try {
      const body = await processClip(blob, filename, {
        forceEscalate,
        to: notifyTo.trim() || undefined,
      });
      setResult(body);
      setPhase("done");
    } catch (err) {
      setPhase("standby");
      setError(
        err.message?.includes("fetch")
          ? "Could not reach the detector. Tunnel + uvicorn on :8000?"
          : err.message || "Process failed.",
      );
    }
  }

  const hint = {
    standby:
      "Same path as the Mac capture client: mic clip → /v1/process (screen → STT → Grok when escalated).",
    record: `Listening… ${elapsed.toFixed(1)}s / ${CLIP_SECONDS}s — press Stop to send.`,
    upload: forceEscalate
      ? "Screen → STT → Grok (full process)…"
      : "Screen first; escalates only if sensitive…",
    done: verdict?.title || "Done",
  }[phase];

  const label = {
    standby: "Standby",
    record: "Listening",
    upload: "Processing",
    done: isScam ? "Scam" : verdict?.title || "Done",
  }[phase];

  const chipKind =
    phase === "done" ? verdict?.kind : phase === "record" ? "listening" : "";

  const gaugeValue =
    result?.scam_confidence != null
      ? Math.round(result.scam_confidence * 100)
      : score != null
        ? Math.round(score * 100)
        : null;

  return (
    <section className={`live-monitor is-${phase}${synthetic ? " is-alert" : ""}`}>
      <div className="live-top">
        <p className="eyebrow">Live intercept · /v1/process</p>
        <p
          className={`verdict ${
            chipKind === "yes" ? "danger" : chipKind === "no" ? "safe" : ""
          }`}
        >
          <span className="verdict-dot" />
          {label}
        </p>
      </div>

      <h1>Phone intercept</h1>
      <p className="lede live-hint">{hint}</p>

      <div className="live-scope" aria-hidden="true">
        <canvas ref={canvasRef} width={960} height={140} />
        <div className="live-scope-meta">
          <span>
            {recording
              ? `mic · ${CLIP_SECONDS}s clip`
              : phase === "upload"
                ? result?.escalated || forceEscalate
                  ? "process"
                  : "screen"
                : "mic off"}
          </span>
          <span className={`live-sens is-${sensitivity === "not_sensitive" ? "cold" : sensitivity}`}>
            sensitivity {sensitivity === "not_sensitive" ? "cold" : sensitivity}
          </span>
        </div>
      </div>

      {phase === "done" && verdict ? (
        <div className={`live-banner is-${verdict.kind}`} role="status">
          <p className="live-banner-title">{verdict.title}</p>
          <p className="live-banner-score">
            {verdict.scoreLabel} {verdict.scoreSuffix}
          </p>
          <p className="live-banner-reason">{verdict.reason}</p>
        </div>
      ) : null}

      {phase === "done" && gaugeValue != null ? (
        <RiskGauge
          value={gaugeValue}
          max={100}
          label={result?.escalated && grok ? "Scam confidence" : "Synthetic voice"}
        />
      ) : null}

      <div className="live-metrics">
        <article>
          <span>AI voice</span>
          <strong>{pct(score)}</strong>
          <em>ElevenLabs</em>
        </article>
        <article>
          <span>Phrases</span>
          <strong>{hits.length}</strong>
          <em>keyword hits</em>
        </article>
        <article>
          <span>{result?.escalated && grok ? "Scam" : "Alarm"}</span>
          <strong>
            {result?.escalated && grok
              ? pct(result.scam_confidence ?? grok.confidence)
              : pct(result?.alarm_score)}
          </strong>
          <em>
            {result?.escalated
              ? grok?.scam_type || "escalated"
              : sensitivity === "not_sensitive"
                ? "cold"
                : sensitivity || "—"}
          </em>
        </article>
      </div>

      <div className="live-phrases">
        {hits.length
          ? hits.map((h) => (
              <span key={h.label} className="on">
                {String(h.label).replaceAll("_", " ")}
              </span>
            ))
          : ["waiting for clip"].map((p) => <span key={p}>{p}</span>)}
      </div>

      {phase === "done" && result?.transcript ? (
        <div className="live-transcript">
          <span>Transcript</span>
          <p>{result.transcript}</p>
        </div>
      ) : null}

      <div className="live-waiting">
        {phase === "standby" &&
          "Mic off. Start listening, then talk or play a voicemail into the mic — posts to /v1/process like mac_capture."}
        {phase === "record" && "Press Stop listening to analyze now, or wait until 15 seconds."}
        {phase === "upload" &&
          (forceEscalate
            ? "Running full process (screen → STT → Grok)…"
            : "Screening; will escalate only if sensitive…")}
        {phase === "done" && verdict?.reason}
      </div>

      {error ? <p className="live-mic-error">{error}</p> : null}

      <div className="live-options">
        <label className="live-check">
          <input
            type="checkbox"
            checked={forceEscalate}
            onChange={(e) => setForceEscalate(e.target.checked)}
            disabled={busy || recording}
          />
          Full scan (force STT + Grok)
        </label>
        <label className="live-to">
          <span>SMS to (optional)</span>
          <input
            type="tel"
            placeholder="+14105551234"
            value={notifyTo}
            onChange={(e) => setNotifyTo(e.target.value)}
            disabled={busy || recording}
            autoComplete="tel"
          />
        </label>
      </div>

      <div className="cta-row live-actions">
        <button
          type="button"
          className={`btn ${recording ? "btn-secondary" : "btn-primary"}`}
          onClick={() => {
            if (recording) recRef.current?.waitResolve?.();
            else if (!busy) startListening();
          }}
          disabled={busy}
        >
          {recording ? "Stop listening" : busy ? "Processing…" : "Start listening"}
        </button>
      </div>
    </section>
  );
}
