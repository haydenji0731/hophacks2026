/** Shared detector client — same path as clients/mac_capture → /v1/process */

export async function processClip(blob, filename, { to, forceEscalate = true } = {}) {
  const data = new FormData();
  data.append("file", blob, filename);
  if (forceEscalate) data.append("force_escalate", "true");
  if (to) data.append("to", to);

  const resp = await fetch("/api/v1/process", { method: "POST", body: data });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const detail = body.detail?.detail || body.detail || body.error || resp.statusText;
    throw new Error(typeof detail === "string" ? detail : "Process failed.");
  }
  return body;
}

export function pct(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

/** Prefer Grok scam verdict when escalated; else ElevenLabs AI-voice. */
export function processVerdict(result) {
  if (!result) return null;
  const grok = result.grok;
  const score = result.elevenlabs_ai_score;
  const aiVoice = result.ai_voice_used;

  if (result.escalated && grok) {
    if (grok.is_scam) {
      return {
        kind: "yes",
        title: "Scam",
        reason: grok.reasoning || result.reason || "Scam patterns showed up in what was said.",
        scoreLabel: pct(result.scam_confidence ?? grok.confidence),
        scoreSuffix: "confidence",
      };
    }
    return {
      kind: "no",
      title: "Clear",
      reason: grok.reasoning || result.reason || "No scam pattern matched.",
      scoreLabel: pct(result.scam_confidence ?? grok.confidence),
      scoreSuffix: "confidence",
    };
  }

  if (aiVoice === "yes") {
    return {
      kind: "yes",
      title: "SYNTHETIC VOICE DETECTED",
      reason: result.reason || "ElevenLabs classified this clip as a generated voice.",
      scoreLabel: pct(score),
      scoreSuffix: "synthetic",
    };
  }
  if (aiVoice === "no") {
    return {
      kind: "no",
      title: "HUMAN VOICE",
      reason: result.reason || "The clip matches a live human voice, not a synthetic one.",
      scoreLabel: pct(score),
      scoreSuffix: "synthetic",
    };
  }
  if (!result.escalated) {
    return {
      kind: "unknown",
      title: "SCREEN ONLY",
      reason:
        result.reason ||
        "Not escalated — screen was not sensitive. Enable full scan to force STT + Grok.",
      scoreLabel: pct(score),
      scoreSuffix: "synthetic",
    };
  }
  return {
    kind: "unknown",
    title: "INCONCLUSIVE",
    reason: result.reason || "Escalated but STT/Grok did not return a verdict. Check detector keys.",
    scoreLabel: pct(score),
    scoreSuffix: "synthetic",
  };
}
