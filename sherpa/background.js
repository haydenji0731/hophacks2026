function drawCompass(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 1024;

  ctx.fillStyle = "#0B1F3A";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, size * 0.2);
  ctx.fill();

  ctx.strokeStyle = "#F3E6C8";
  ctx.lineWidth = Math.max(2, size * 0.085);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  const pt = (x, y) => [x * s, y * s];

  ctx.fillStyle = "#A9B8DC";
  ctx.beginPath();
  ctx.moveTo(...pt(512, 300));
  ctx.lineTo(...pt(600, 560));
  ctx.lineTo(...pt(512, 524));
  ctx.lineTo(...pt(424, 560));
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#E6D5B3";
  ctx.beginPath();
  ctx.moveTo(...pt(512, 724));
  ctx.lineTo(...pt(424, 560));
  ctx.lineTo(...pt(512, 524));
  ctx.lineTo(...pt(600, 560));
  ctx.closePath();
  ctx.fill();

  return ctx.getImageData(0, 0, size, size);
}

function setToolbarIcon() {
  chrome.action.setIcon({
    imageData: {
      16: drawCompass(16),
      24: drawCompass(24),
      32: drawCompass(32),
      48: drawCompass(48),
      128: drawCompass(128),
    },
  });
}

chrome.runtime.onInstalled.addListener(setToolbarIcon);
chrome.runtime.onStartup.addListener(setToolbarIcon);
setToolbarIcon();
