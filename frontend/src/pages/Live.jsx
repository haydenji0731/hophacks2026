import { useEffect, useRef, useState } from "react";

const CLIP_SECONDS = 30;

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

export default function Live() {
  const [phase, setPhase] = useState("standby");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [to, setTo] = useState("");
  const [forceEscalate, setForceEscalate] = useState(true);
  const [result, setResult] = useState(null);

  const canvasRef = useRef(null);
  const levelRef = useRef(0);
  const alertRef = useRef(false);
  const recRef = useRef(null);

  const recording = phase === "record";
  const busy = phase === "record" || phase === "upload";
  const hits = result?.keyword_hits || [];
  const grok = result?.grok;
  const isScam = Boolean(grok?.is_scam);
  const sms = result?.notify?.body || (isScam ? result?.reason : "");
  const sensitivity = result?.sensitivity || (recording ? "low" : "cold");

  useEffect(() => {
    alertRef.current = isScam;
  }, [isScam]);

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

    const rec = { stream, ctx, analyser, recorder, raf: 0, listening: true };
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
      const id = window.setInterval(() => {
        const sec = Math.min(CLIP_SECONDS, (performance.now() - t0) / 1000);
        setElapsed(sec);
        if (sec >= CLIP_SECONDS) {
          window.clearInterval(id);
          resolve();
        }
      }, 100);
    });

    if (recorder.state !== "inactive") recorder.stop();
    await new Promise((resolve) => {
      recorder.onstop = resolve;
    });
    stopCapture();

    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    await uploadClip(blob, mime.includes("mp4") ? "clip.m4a" : "clip.webm");
  }

  async function uploadClip(blob, filename) {
    setPhase("upload");
    const data = new FormData();
    data.append("file", blob, filename);
    if (to.trim()) data.append("to", to.trim());
    if (forceEscalate) data.append("force_escalate", "true");

    try {
      const resp = await fetch("/api/v1/process", { method: "POST", body: data });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        const detail = body.detail?.detail || body.detail || body.error || resp.statusText;
        throw new Error(typeof detail === "string" ? detail : "Process failed.");
      }
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
    standby: "Click Start listening. Allow the mic, play the call or demo.mp3. 30s clip → /v1/process.",
    record: `Recording ${elapsed.toFixed(1)}s / ${CLIP_SECONDS}s · same path as desktop/listen.py`,
    upload: "Posted clip · screen → STT → Grok…",
    done: result?.escalated ? "Escalated · Grok returned" : "Screen only · not escalated",
  }[phase];

  const label = {
    standby: "Standby",
    record: "Listening",
    upload: "Processing",
    done: isScam ? "Scam" : grok ? "Clear" : result?.sensitivity || "Done",
  }[phase];

  return (
    <section className={`live-monitor is-${phase}${isScam ? " is-alert" : ""}`}>
      <div className="live-top">
        <p className="eyebrow">Live intercept · /v1/process</p>
        <p className={`verdict ${isScam ? "danger" : phase === "done" ? "safe" : ""}`}>
          <span className="verdict-dot" />
          {label}
        </p>
      </div>

      <h1>Inbound line</h1>
      <p className="lede live-hint">{hint}</p>

      <div className="live-scope" aria-hidden="true">
        <canvas ref={canvasRef} width={960} height={140} />
        <div className="live-scope-meta">
          <span>{recording ? "mic · 30s clip" : phase === "upload" ? "uploading" : "mic off"}</span>
          <span className={`live-sens is-${sensitivity === "not_sensitive" ? "cold" : sensitivity}`}>
            sensitivity {sensitivity === "not_sensitive" ? "cold" : sensitivity}
          </span>
        </div>
      </div>

      <div className="live-metrics">
        <article>
          <span>AI voice</span>
          <strong>{pct(result?.elevenlabs_ai_score)}</strong>
          <em>ElevenLabs</em>
        </article>
        <article>
          <span>Phrases</span>
          <strong>{hits.length}</strong>
          <em>CLAP hits</em>
        </article>
        <article>
          <span>Grok</span>
          <strong>{pct(grok?.confidence ?? (result && !result.escalated ? 0 : result?.scam_confidence))}</strong>
          <em>{result?.escalated ? grok?.scam_type || "scam detect" : "gated"}</em>
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

      {isScam && sms ? (
        <div className="live-alert" role="status">
          <p className="live-sms">{sms}</p>
          <p className="live-sms-sub">
            Textbelt · {result?.notify?.dry_run ? "dry-run" : "sent"}
            {result?.notify?.to ? ` · ${result.notify.to}` : ""}
          </p>
        </div>
      ) : (
        <div className="live-waiting">
          {phase === "standby" && "Mic is off. Start listening to capture 30s and POST /v1/process."}
          {phase === "record" && "Keep the scam audio playing until the bar fills."}
          {phase === "upload" && "Detector running on Linux (via tunnel)."}
          {phase === "done" && !isScam && (result?.reason || "No scam flag from Grok.")}
        </div>
      )}

      {error ? <p className="live-mic-error">{error}</p> : null}

      <label className="live-to">
        SMS to (optional)
        <input
          type="tel"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="+18575551234"
          disabled={busy}
        />
      </label>
      <label className="live-force">
        <input
          type="checkbox"
          checked={forceEscalate}
          onChange={(e) => setForceEscalate(e.target.checked)}
          disabled={busy}
        />
        Force escalate (STT + Grok even if screen is cold)
      </label>

      <div className="cta-row live-actions">
        <button type="button" className="btn btn-primary" onClick={startListening} disabled={busy}>
          {busy ? "Working…" : "Start listening"}
        </button>
      </div>
    </section>
  );
}
