import { useEffect, useRef, useState } from "react";
import RiskGauge from "../components/RiskGauge.jsx";

const CLIP_SECONDS = 15;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function pickRecorderMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => window.MediaRecorder?.isTypeSupported(t)) || "";
}

function verdictCopy(aiVoice, score) {
  if (aiVoice === "yes") {
    return {
      kind: "yes",
      title: "SYNTHETIC VOICE DETECTED",
      reason: "ElevenLabs classified this clip as a generated voice.",
    };
  }
  if (aiVoice === "no") {
    return {
      kind: "no",
      title: "HUMAN VOICE",
      reason: "The clip matches a live human voice, not a synthetic one.",
    };
  }
  if (score == null) {
    return {
      kind: "unknown",
      title: "INCONCLUSIVE",
      reason: "No synthetic-voice score came back. Try another clip.",
    };
  }
  return {
    kind: "unknown",
    title: "INCONCLUSIVE",
    reason: "The score sits in the uncertain band. Use a clearer clip (up to 15 seconds).",
  };
}

export default function Live() {
  const [phase, setPhase] = useState("standby");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const levelRef = useRef(0);
  const alertRef = useRef(false);
  const recRef = useRef(null);

  const recording = phase === "record";
  const uploading = phase === "upload";
  const busy = uploading;
  const hits = result?.keyword_hits || [];
  const aiVoice = result?.ai_voice_used || null;
  const score = result?.elevenlabs_ai_score;
  const synthetic = aiVoice === "yes";
  const sensitivity = result?.sensitivity || (recording ? "low" : "cold");
  const verdict = result ? verdictCopy(aiVoice, score) : null;

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
    const data = new FormData();
    data.append("file", blob, filename);

    try {
      const resp = await fetch("/api/v1/screen", { method: "POST", body: data });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = body.detail?.detail || body.detail || body.error || resp.statusText;
        throw new Error(typeof detail === "string" ? detail : "Screen failed.");
      }
      setResult(body);
      setPhase("done");
    } catch (err) {
      setPhase("standby");
      setError(
        err.message?.includes("fetch")
          ? "Could not reach the detector. Is it running on port 8000?"
          : err.message || "Screen failed.",
      );
    }
  }

  const hint = {
    standby: "Click Start listening, allow the mic, then talk — or play an AI voicemail into it. Stop anytime, or wait 15 seconds.",
    record: `Listening… ${elapsed.toFixed(1)}s / ${CLIP_SECONDS}s — press Stop listening to send the clip.`,
    upload: "Analyzing audio for a synthetic voice…",
    done: verdict?.title || "Done",
  }[phase];

  const label = {
    standby: "Standby",
    record: "Listening",
    upload: "Analyzing",
    done: verdict?.title || "Done",
  }[phase];

  const chipKind =
    phase === "done" ? verdict?.kind : phase === "record" ? "listening" : "";

  return (
    <section className={`live-monitor is-${phase}${synthetic ? " is-alert" : ""}`}>
      <div className="live-top">
        <p className="eyebrow">Live intercept · AI voice</p>
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
                ? "analyzing"
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
          <p className="live-banner-score">{pct(score)} synthetic</p>
          <p className="live-banner-reason">{verdict.reason}</p>
        </div>
      ) : null}

      {phase === "done" && score != null ? (
        <RiskGauge
          value={Math.round(score * 100)}
          max={100}
          label="Synthetic voice"
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
          <span>Alarm</span>
          <strong>{pct(result?.alarm_score)}</strong>
          <em>{sensitivity === "not_sensitive" ? "cold" : sensitivity || "—"}</em>
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

      <div className="live-waiting">
        {phase === "standby" && "Mic is off. Start listening, then talk or play an AI voicemail into the mic."}
        {phase === "record" && "Press Stop listening to analyze now, or wait until 15 seconds."}
        {phase === "upload" && "Checking the clip for a synthetic voice."}
        {phase === "done" && verdict?.reason}
      </div>

      {error ? <p className="live-mic-error">{error}</p> : null}

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
          {recording ? "Stop listening" : busy ? "Analyzing…" : "Start listening"}
        </button>
      </div>
    </section>
  );
}
