import { useEffect, useRef, useState } from "react";
import { pct, processClip, processVerdict } from "../lib/detectorProcess.js";

const CLIP_SECONDS = 15;
const BARS = 36;

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pickRecorderMime() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((t) => window.MediaRecorder?.isTypeSupported(t)) || "";
}

function prefersReduce() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function roundBar(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  if (h < 1) return;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rad);
  } else {
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
  }
  ctx.fill();
}

function idleHeights(now, count) {
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const n =
      0.12 +
      0.08 * Math.abs(Math.sin(now / 900 + i * 0.33)) +
      0.05 * Math.abs(Math.sin(now / 1400 + i * 0.11));
    out.push(n);
  }
  return out;
}

export default function MicWaveform() {
  const [phase, setPhase] = useState("standby");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const recRef = useRef(null);
  const listeningRef = useRef(false);
  const freqRef = useRef(null);
  const abortedRef = useRef(false);

  const recording = phase === "record";
  const uploading = phase === "upload";
  const hits = result?.keyword_hits || [];
  const score = result?.elevenlabs_ai_score;
  const grok = result?.grok;
  const isScam = Boolean(grok?.is_scam);
  const synthetic = result?.ai_voice_used === "yes" || isScam;
  const verdict = processVerdict(result);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const reduce = prefersReduce();

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth || 640;
      const h = 148;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(wrap);

    const draw = (now) => {
      const width = wrap.clientWidth || 640;
      const height = 148;
      ctx.clearRect(0, 0, width, height);
      const color = getComputedStyle(canvas).color || "#fff";
      ctx.fillStyle = color;

      const gap = 5;
      const bw = (width - gap * (BARS - 1)) / BARS;
      const radius = Math.min(4, bw / 2);
      let heights;
      const freq = freqRef.current;
      const live = listeningRef.current && freq;
      if (live) {
        heights = [];
        const binW = Math.max(1, Math.floor(freq.length / (BARS + 8)));
        for (let i = 0; i < BARS; i += 1) {
          const start = 2 + i * binW;
          let sum = 0;
          for (let j = 0; j < binW; j += 1) sum += freq[start + j] || 0;
          heights.push(clamp((sum / binW / 255) ** 0.72, 0.04, 1));
        }
      } else if (reduce) {
        heights = Array.from({ length: BARS }, (_, i) => 0.1 + (i % 5) * 0.03);
      } else {
        heights = idleHeights(now, BARS);
      }

      for (let i = 0; i < BARS; i += 1) {
        const h = Math.max(6, heights[i] * (height - 16));
        const x = i * (bw + gap);
        const y = (height - h) / 2;
        roundBar(ctx, x, y, bw, h, radius);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    abortedRef.current = false;
    return () => {
      abortedRef.current = true;
      recRef.current?.waitResolve?.();
      teardownHardware();
    };
  }, []);

  function teardownHardware() {
    const rec = recRef.current;
    listeningRef.current = false;
    freqRef.current = null;
    if (!rec) return;
    if (rec.timerId) window.clearInterval(rec.timerId);
    rec.timerId = 0;
    if (rec.raf) cancelAnimationFrame(rec.raf);
    rec.raf = 0;
    rec.stream?.getTracks().forEach((t) => t.stop());
    try {
      rec.ctx?.close?.();
    } catch {
      /* already closed */
    }
  }

  function stopRecorder(recorder) {
    if (!recorder || recorder.state === "inactive") return Promise.resolve();
    return new Promise((resolve) => {
      recorder.addEventListener("stop", resolve, { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  function requestStop() {
    recRef.current?.waitResolve?.();
  }

  function onListenClick() {
    if (uploading) return;
    if (phase === "record" || listeningRef.current) {
      requestStop();
      return;
    }
    startListening();
  }

  async function startListening() {
    setError("");
    setResult(null);
    setElapsed(0);
    const mime = pickRecorderMime();
    if (!window.MediaRecorder || !mime) {
      setError("This browser cannot record audio.");
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
    if (abortedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.72;
    source.connect(analyser);
    const freq = new Uint8Array(analyser.frequencyBinCount);
    freqRef.current = freq;

    const chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorder.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };

    const rec = {
      stream,
      ctx,
      analyser,
      recorder,
      raf: 0,
      timerId: 0,
      waitResolve: null,
    };
    recRef.current = rec;
    listeningRef.current = true;

    const poll = () => {
      analyser.getByteFrequencyData(freq);
      rec.raf = requestAnimationFrame(poll);
    };
    rec.raf = requestAnimationFrame(poll);

    setPhase("record");
    recorder.start(200);

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
    rec.timerId = 0;
    rec.waitResolve = null;

    if (!abortedRef.current) setPhase("upload");

    await stopRecorder(recorder);
    teardownHardware();
    recRef.current = null;

    if (abortedRef.current) return;

    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    if (blob.size < 256) {
      setPhase("standby");
      setError("Clip was too short — press Start listening, talk, then Stop listening.");
      return;
    }
    await uploadClip(blob, mime.includes("mp4") ? "clip.m4a" : "clip.webm");
  }

  async function uploadClip(blob, filename) {
    setPhase("upload");
    try {
      const body = await processClip(blob, filename, { forceEscalate: true });
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
      "Start listening and speak normally — or play a call through your speakers. We’ll check if it sounds like a scam.",
    record: `Listening… ${elapsed.toFixed(1)}s / ${CLIP_SECONDS}s — press Stop listening to send the clip.`,
    upload: "Checking the clip for scam signals…",
    done: verdict?.title || "Done",
  }[phase];

  const label = {
    standby: "Standby",
    record: "Listening",
    upload: "Processing",
    done: verdict?.title || "Done",
  }[phase];

  const chipKind =
    phase === "done" ? verdict?.kind : phase === "record" ? "listening" : "";

  return (
    <div
      className={`mic-wave live-monitor is-${phase}${synthetic ? " is-alert" : ""}`}
      ref={wrapRef}
    >
      <div className="live-top">
        <p className="eyebrow live-brand">
          <img src="/outpost.png" alt="" className="live-outpost-mark" width="18" height="18" />
          Live · Outpost
        </p>
        <p
          className={`verdict ${
            chipKind === "yes" ? "danger" : chipKind === "no" ? "safe" : ""
          }`}
        >
          <span className="verdict-dot" />
          {label}
        </p>
      </div>

      <h2 className="mic-wave-title">Voice scam detector</h2>
      <p className="lede live-hint">{hint}</p>

      <canvas ref={canvasRef} className="mic-wave-canvas" aria-hidden="true" />
      <div className="mic-wave-meta">
        <span>
          {recording
            ? `mic · up to ${CLIP_SECONDS}s`
            : phase === "upload"
              ? "checking"
              : "mic off"}
        </span>
      </div>

      {phase === "done" && verdict ? (
        <div className={`live-banner is-${verdict.kind}`} role="status">
          <p className="live-banner-score">
            {verdict.scoreLabel} {verdict.scoreSuffix}
          </p>
          <p className="live-banner-reason">{verdict.reason}</p>
        </div>
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
              ? grok?.scam_type?.replaceAll("_", " ") || "checked"
              : "screen"}
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

      <div className="live-waiting">
        {phase === "standby" &&
          "Mic is off. Start listening, we'll monitor if it sounds like a scam."}
        {phase === "record" &&
          "Press Stop listening to analyze now, or wait until 15 seconds."}
        {phase === "upload" && "Listening for scam patterns in the clip…"}
        {phase === "done" && null}
      </div>

      {error ? <p className="live-mic-error">{error}</p> : null}

      <div className="cta-row live-actions">
        <button
          type="button"
          className={`btn mic-wave-start ${recording ? "btn-secondary" : "btn-primary"}`}
          onClick={onListenClick}
          disabled={uploading}
        >
          {phase === "record"
            ? "Stop listening"
            : phase === "upload"
              ? "Processing…"
              : "Start listening"}
        </button>
      </div>
    </div>
  );
}
