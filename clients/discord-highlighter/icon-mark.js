(() => {
  const img = document.getElementById("sherpa-mark");
  if (!img) return;
  const src = img.getAttribute("src") || "icons/icon128.png";
  const match = src.match(/icon(\d+)\.png$/);
  const size = match ? match[1] : "128";
  fetch(`icons/icon${size}.png.b64`)
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    })
    .then((b64) => {
      img.src = "data:image/png;base64," + b64.replace(/\s/g, "");
    })
    .catch(() => {});
})();
