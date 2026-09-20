(() => {
  const params = new URLSearchParams(location.search);
  if (params.get("sherpa_report") !== "1") return;

  const BOOT_MS = 2650;
  const AFTER_BOOT_MS = 1100;
  const MAX_WAIT_MS = 10000;

  function reportButton() {
    const named = document.querySelector(".report-scam");
    if (named) return named;
    return [...document.querySelectorAll("button")].find((button) =>
      /^\s*Report a scam\s*$/i.test(button.textContent || ""),
    );
  }

  function scrollToReport() {
    const el = reportButton();
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  const started = Date.now();

  function bootFinished() {
    return !document.querySelector(".boot") && Date.now() - started >= BOOT_MS;
  }

  function waitForBoot() {
    if (bootFinished() || Date.now() - started >= MAX_WAIT_MS) {
      window.setTimeout(scrollToReport, AFTER_BOOT_MS);
      return;
    }
    window.setTimeout(waitForBoot, 120);
  }

  window.setTimeout(waitForBoot, BOOT_MS);
})();
