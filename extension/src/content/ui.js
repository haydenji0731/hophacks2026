/**
 * L4 — badge always cheap; banner only on high confidence.
 * Never paint the user's message into the banner.
 */

import { BANNER_SUPPRESS_MS, MSG } from "../shared/constants.js";

const BANNER_ID = "whs-banner";
let bannerSuppressedUntil = 0;
let burstBannerShown = false;

export function resetBurst() {
  burstBannerShown = false;
}

export function escalate(result, thresholds) {
  const score = result?.score || 0;
  const soft = thresholds.soft;
  const hard = thresholds.hard;
  const strongCombo = Array.isArray(result?.comboIds) && result.comboIds.length > 0 && score >= soft;

  if (score < soft) return "none";
  if (score >= hard || strongCombo) return "hard";
  return "soft";
}

export function applyBadge(softCount, hardCount) {
  const count = softCount + hardCount;
  chrome.runtime.sendMessage({
    type: MSG.BADGE,
    count,
    hard: hardCount > 0,
  });
}

export function showBanner(result) {
  const now = Date.now();
  if (now < bannerSuppressedUntil || burstBannerShown) return false;
  if (document.getElementById(BANNER_ID)) return false;

  burstBannerShown = true;

  const banner = document.createElement("aside");
  banner.id = BANNER_ID;
  banner.setAttribute("role", "status");
  banner.setAttribute("data-whs", "banner");

  const reasons = (result.reasons || []).slice(0, 3);
  const hint = result.topScamId || "";

  banner.innerHTML = `
    <div class="whs-banner__bar">
      <strong>Possible scam pattern</strong>
      <span>On-device flag. Nothing from this page was stored or uploaded.</span>
    </div>
    <ul class="whs-banner__reasons">${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>
    <div class="whs-banner__actions">
      <button type="button" data-whs="open">Check this pattern</button>
      <button type="button" data-whs="dismiss">Dismiss</button>
    </div>
  `;

  injectStyles();
  document.documentElement.appendChild(banner);

  banner.querySelector('[data-whs="open"]')?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: MSG.OPEN_QUESTIONNAIRE, hint });
  });
  banner.querySelector('[data-whs="dismiss"]')?.addEventListener("click", () => {
    banner.remove();
    bannerSuppressedUntil = Date.now() + BANNER_SUPPRESS_MS;
  });

  chrome.runtime.sendMessage({ type: MSG.WARNING_SHOWN });
  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function injectStyles() {
  if (document.getElementById("whs-banner-style")) return;
  const style = document.createElement("style");
  style.id = "whs-banner-style";
  style.textContent = `
    #${BANNER_ID} {
      position: fixed;
      z-index: 2147483646;
      right: 16px;
      bottom: 16px;
      max-width: min(360px, calc(100vw - 24px));
      padding: 14px 16px;
      border: 1px solid rgb(255 92 92 / 0.4);
      border-radius: 8px;
      background: #140a0c;
      color: #f6ecec;
      font: 13px/1.45 ui-sans-serif, system-ui, sans-serif;
      box-shadow: 0 16px 40px rgb(0 0 0 / 0.45);
    }
    #${BANNER_ID} strong { color: #ff5c5c; display: block; font-size: 14px; }
    #${BANNER_ID} span { color: #b39a9a; display: block; margin-top: 4px; }
    #${BANNER_ID} ul { margin: 10px 0; padding-left: 18px; color: #f6ecec; }
    #${BANNER_ID} .whs-banner__actions { display: flex; gap: 8px; flex-wrap: wrap; }
    #${BANNER_ID} button {
      min-height: 36px;
      border-radius: 4px;
      border: 1px solid rgb(255 92 92 / 0.35);
      background: #ff5c5c;
      color: #14080a;
      font-weight: 600;
      cursor: pointer;
      padding: 0 10px;
    }
    #${BANNER_ID} button[data-whs="dismiss"] {
      background: transparent;
      color: #f6ecec;
    }
  `;
  document.documentElement.appendChild(style);
}
