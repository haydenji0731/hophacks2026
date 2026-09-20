(() => {
  const img = document.getElementById("sherpa-mark");
  if (!img) return;
  fetch("icons/icon32.png.b64")
    .then((res) => {
      if (!res.ok) throw new Error(res.statusText);
      return res.text();
    })
    .then((b64) => {
      img.src = "data:image/png;base64," + b64.replace(/\s/g, "");
    })
    .catch(() => {});
})();
