async function loadCompassPng() {
  const res = await fetch(chrome.runtime.getURL("icons/icon128.png.b64"));
  const b64 = (await res.text()).replace(/\s/g, "");
  const blob = await (await fetch("data:image/png;base64," + b64)).blob();
  return createImageBitmap(blob);
}

async function applyCompassIcon() {
  try {
    const bitmap = await loadCompassPng();
    const imageData = {};
    for (const size of [16, 32, 48, 128]) {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, size, size);
      imageData[size] = ctx.getImageData(0, 0, size, size);
    }
    await chrome.action.setIcon({ imageData });
  } catch (err) {
    console.warn("Sherpa compass icon", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  applyCompassIcon();
});
chrome.runtime.onStartup.addListener(() => {
  applyCompassIcon();
});
applyCompassIcon();
