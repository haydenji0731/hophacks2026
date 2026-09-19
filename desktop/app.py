#!/usr/bin/env python3
"""Lighthouse desktop: one button starts the capture → POST loop."""

from __future__ import annotations

import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from listen import post_chunk, record_wav

DEFAULT_URL = "http://127.0.0.1:8000/v1/process"
SUPPORT = Path.home() / "Library" / "Application Support" / "Lighthouse"
CONFIG = SUPPORT / "listen.json"

WHITE = "#FFFFFF"
BLACK = "#111111"
GREY = "#8A8A8A"
PANEL = "#F6F6F6"
LINE = "#E2E2E2"
DIM = "#D0D0D0"
SCAM = "#E03A3A"
NORMAL = "#3F8F6E"
UI = "JetBrainsMono Nerd Font Mono"
ASSETS = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent)) / "assets"


def _pick_ui_font(root: tk.Misc) -> str:
    fams = {str(name) for name in root.tk.call("font", "families")}
    for name in (
        "JetBrainsMono Nerd Font Mono",
        "JetBrainsMonoNL Nerd Font Mono",
        "JetBrainsMono Nerd Font",
        "Menlo",
        "Helvetica Neue",
    ):
        if name in fams:
            return name
    return "TkFixedFont"


def _font(size: int, weight: str = "normal") -> tuple:
    return (UI, size, weight)


def load_asset(root: tk.Misc, name: str, height: int = 40) -> tk.PhotoImage | None:
    path = ASSETS / name
    if not path.is_file():
        return None
    try:
        from PIL import Image, ImageTk

        src = Image.open(path).convert("RGBA")
        ratio = max(1.0, float(root.winfo_fpixels("1i")) / 72.0)
        px_h = max(height, int(round(height * ratio)))
        px_w = max(1, int(round(px_h * src.width / src.height)))
        im = src.resize((px_w, px_h), Image.Resampling.LANCZOS)
        return ImageTk.PhotoImage(im, master=root)
    except Exception:
        return None


def _pct(value: object) -> str | None:
    if isinstance(value, (int, float)):
        return f"{round(float(value) * 100)}%"
    return None


def _chance(value: object) -> str | None:
    if isinstance(value, (int, float)):
        return f"{round(float(value) * 100)}% chance"
    return None


def _plain(value: object, *, skip: set[str] | None = None) -> str:
    text = str(value or "").replace("_", " ").strip()
    if not text or text.lower() in (skip or set()):
        return ""
    return text


def normalize_sms(raw: str) -> str:
    text = (raw or "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    if not text or text == "+":
        return "+1"
    if text.startswith("+") and not text.startswith("+1"):
        return "+" + digits if digits else text
    if digits.startswith("1"):
        return "+" + digits
    return "+1" + digits


def sms_destination(raw: str) -> str | None:
    filled = normalize_sms(raw)
    digits = "".join(ch for ch in filled if ch.isdigit())
    if len(digits) < 11:
        return None
    return filled


def parse_clip(seconds: float, levels: dict | None) -> str:
    peak = (levels or {}).get("peak")
    if isinstance(peak, (int, float)) and peak < 0.01:
        return f"{seconds:.0f}s captured · almost silent"
    if isinstance(peak, (int, float)) and peak < 0.05:
        return f"{seconds:.0f}s captured · very quiet"
    return f"{seconds:.0f}s captured"


def parse_ai_voice(body: dict) -> str:
    warns = " ".join(str(w) for w in (body.get("warnings") or []))
    used = body.get("ai_voice_used")
    pct = _pct(body.get("elevenlabs_ai_score"))
    if "ElevenLabs" in warns and used is None and pct is None:
        return "Couldn't check the voice"
    if used == "yes":
        return f"Sounds like a cloned voice ({pct})" if pct else "Sounds like a cloned voice"
    if used == "no":
        return f"Sounds like a real person ({pct})" if pct else "Sounds like a real person"
    if used == "unknown" and pct:
        return f"Not sure if the voice is real ({pct})"
    return "No voice reading yet"


def parse_phrases(body: dict) -> str:
    scored: list[tuple[float, str]] = []
    for hit in body.get("keyword_hits") or []:
        if not isinstance(hit, dict):
            continue
        label = _plain(hit.get("label"))
        if not label:
            continue
        score = hit.get("score")
        scored.append((float(score) if isinstance(score, (int, float)) else 0.0, label))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return "No scam phrases heard"
    return "  ·  ".join(label for _score, label in scored[:6])


def parse_transcript(body: dict) -> str:
    grok = body.get("grok") or {}
    if grok:
        conf = _chance(grok.get("confidence")) or _chance(body.get("scam_confidence"))
        kind = _plain(grok.get("scam_type"), skip={"none", "unknown"})
        method = _plain(grok.get("method"), skip={"none"})
        if grok.get("is_scam"):
            bits = [f"Looks like a {kind} scam" if kind else "Looks like a scam"]
            if method:
                bits.append(method)
            if conf:
                bits.append(conf)
            return "  ·  ".join(bits)
        extra = f"  ·  {conf}" if conf else ""
        return f"Conversation looks normal{extra}"
    text = " ".join((body.get("transcript") or "").split())
    if text:
        return text[:140] + ("…" if len(text) > 140 else "")
    if body.get("escalated"):
        return "Heard the clip, but no verdict came back"
    return "Nothing suspicious — skipped the transcript"


def parse_scam_check(body: dict) -> tuple[str, str]:
    grok = body.get("grok") or {}
    why = (grok.get("reasoning") or "").strip()
    if grok.get("is_scam"):
        return "Scam", why or "This clip matches a known scam pattern."
    if grok:
        return "Normal", why or "No scam pattern in what they said."
    if body.get("escalated"):
        return "Normal", "Transcribed the clip; nothing clear enough to flag."
    return "Normal", "Voice and phrasing in the first clip look ordinary."


class Pill(tk.Label):
    def __init__(
        self,
        master,
        *,
        text: str,
        command,
        bg: str,
        fg: str,
        hover: str | None = None,
        font=None,
        pady: int = 12,
    ) -> None:
        super().__init__(master, text=text, bg=bg, fg=fg, font=font or _font(13), cursor="hand2", pady=pady)
        self._command = command
        self._bg = bg
        self._fg = fg
        self._hover = hover or bg
        self._enabled = True
        self.bind("<Button-1>", self._click)
        self.bind("<Enter>", lambda _e: self.configure(bg=self._hover) if self._enabled else None)
        self.bind("<Leave>", lambda _e: self.configure(bg=self._bg if self._enabled else DIM))

    def _click(self, _event=None) -> None:
        if self._enabled:
            self._command()

    def set_enabled(self, on: bool) -> None:
        self._enabled = on
        if on:
            self.configure(bg=self._bg, fg=self._fg, cursor="hand2")
        else:
            self.configure(bg=DIM, fg=GREY, cursor="arrow")


def _load_config() -> dict:
    try:
        return json.loads(CONFIG.read_text())
    except (OSError, json.JSONDecodeError):
        return {}


def _save_config(data: dict) -> None:
    SUPPORT.mkdir(parents=True, exist_ok=True)
    CONFIG.write_text(json.dumps(data, indent=2) + "\n")


class ListenApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        global UI
        UI = _pick_ui_font(self)
        self.title("Lighthouse")
        self.minsize(680, 500)
        self.configure(bg=WHITE)

        cfg = _load_config()
        default_dir = cfg.get("recordings_dir") or str(Path.home() / "Documents" / "Lighthouse")
        self.recordings_dir = tk.StringVar(value=default_dir)
        self.url = tk.StringVar(value=cfg.get("url") or DEFAULT_URL)
        self.seconds = tk.StringVar(value=str(cfg.get("seconds") or 30))
        self.to = tk.StringVar(value=normalize_sms(str(cfg.get("to") or "")))
        self._sms_lock = False
        saved_sens = cfg.get("sensitivity")
        if saved_sens not in {"default", "high"}:
            saved_sens = "high" if cfg.get("force_escalate") else "default"
        self.sensitivity = tk.StringVar(value=saved_sens)
        self.phase = tk.StringVar(value="Standby")
        self.step_record = tk.StringVar(value="—")
        self.step_voice = tk.StringVar(value="—")
        self.step_phrases = tk.StringVar(value="—")
        self.step_transcript = tk.StringVar(value="—")
        self.reason = tk.StringVar(value="")
        self.loop = tk.BooleanVar(value=bool(cfg.get("loop")))
        self._stop = threading.Event()
        self._run_id = 0
        self._worker: threading.Thread | None = None
        self._halted = False
        self._pump_id: str | None = None
        self._ui_q: queue.Queue = queue.Queue()
        self._clip_elapsed = 0.0
        self._clip_total = 30.0
        self._clip_live = False
        self._audio_stream = None
        self._http_client = None
        self._done = {"record": False, "voice": False, "phrases": False, "transcript": False}

        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(".", background=WHITE, foreground=BLACK, font=_font(13))
        style.configure("TFrame", background=WHITE)
        style.configure("Panel.TFrame", background=PANEL)
        style.configure("TLabel", background=WHITE, foreground=BLACK, font=_font(13))
        style.configure("Mute.TLabel", background=WHITE, foreground=GREY, font=_font(10))
        style.configure("Brand.TLabel", background=WHITE, foreground=GREY, font=_font(11))
        style.configure("Phase.TLabel", background=WHITE, foreground=BLACK, font=_font(22, "bold"))
        style.configure(
            "TEntry",
            fieldbackground=WHITE,
            foreground=BLACK,
            bordercolor=LINE,
            lightcolor=LINE,
            darkcolor=LINE,
            padding=6,
        )

        root = ttk.Frame(self, padding=(24, 18))
        root.pack(fill=tk.BOTH, expand=True)

        top = ttk.Frame(root)
        top.pack(fill=tk.X, pady=(0, 14))
        self.phase_label = tk.Label(
            top, textvariable=self.phase, bg=WHITE, fg=BLACK, font=_font(22, "bold")
        )
        self.phase_label.pack(side=tk.LEFT, anchor="n")
        self.phase.trace_add("write", lambda *_a: self._paint_phase())
        self._mark = load_asset(self, "mono.png", 44)
        self._app_icon = load_asset(self, "icon.png", 64)
        if self._mark is not None:
            tk.Label(top, image=self._mark, bg=WHITE, bd=0).pack(side=tk.RIGHT, anchor="n")
        icon = self._app_icon or self._mark
        if icon is not None:
            try:
                self.iconphoto(True, icon)
            except tk.TclError:
                pass

        self.start_btn = Pill(
            root,
            text="Start listening",
            command=self.on_start_click,
            bg=BLACK,
            fg=WHITE,
            hover="#333333",
            font=_font(14, "bold"),
            pady=12,
        )
        self.start_btn.pack(fill=tk.X)
        self.stop_btn = Pill(
            root,
            text="Stop",
            command=self.stop,
            bg=PANEL,
            fg=BLACK,
            hover=LINE,
            font=_font(13),
            pady=9,
        )
        self.stop_btn.pack(fill=tk.X, pady=(8, 16))
        self.stop_btn.set_enabled(False)

        ttk.Label(root, text="SAVES TO", style="Mute.TLabel").pack(anchor="w")
        path_row = ttk.Frame(root)
        path_row.pack(fill=tk.X, pady=(4, 10))
        ttk.Entry(path_row, textvariable=self.recordings_dir).pack(side=tk.LEFT, fill=tk.X, expand=True)
        Pill(
            path_row,
            text="  Choose  ",
            command=self.choose_folder,
            bg=BLACK,
            fg=WHITE,
            hover="#333333",
            font=_font(11),
            pady=7,
        ).pack(side=tk.LEFT, padx=(8, 0))

        ttk.Label(root, text="DETECTOR URL", style="Mute.TLabel").pack(anchor="w")
        ttk.Entry(root, textvariable=self.url).pack(fill=tk.X, pady=(4, 10))

        ttk.Label(root, text="ALERT SMS", style="Mute.TLabel").pack(anchor="w")
        self.sms_entry = ttk.Entry(root, textvariable=self.to)
        self.sms_entry.pack(fill=tk.X, pady=(4, 10))
        self.to.trace_add("write", self._sms_autofill)
        self.sms_entry.bind("<FocusIn>", self._sms_focus)
        self.sms_entry.bind("<FocusOut>", lambda _e: self._persist())

        opt = ttk.Frame(root)
        opt.pack(fill=tk.X, pady=(0, 14))
        ttk.Label(opt, text="LISTENER INTERVAL", style="Mute.TLabel").pack(side=tk.LEFT)
        ttk.Entry(opt, textvariable=self.seconds, width=6).pack(side=tk.LEFT, padx=(8, 4))
        ttk.Label(opt, text="SEC", style="Mute.TLabel").pack(side=tk.LEFT)
        ttk.Label(opt, text="SENSITIVITY", style="Mute.TLabel").pack(side=tk.LEFT, padx=(20, 8))
        self.sens_default = Pill(
            opt,
            text="  Default  ",
            command=lambda: self._set_sensitivity("default"),
            bg=PANEL,
            fg=BLACK,
            hover=LINE,
            font=_font(11),
            pady=5,
        )
        self.sens_default.pack(side=tk.LEFT)
        self.sens_high = Pill(
            opt,
            text="  High  ",
            command=lambda: self._set_sensitivity("high"),
            bg=PANEL,
            fg=BLACK,
            hover=LINE,
            font=_font(11),
            pady=5,
        )
        self.sens_high.pack(side=tk.LEFT, padx=(6, 0))
        self._paint_sensitivity()

        loop_row = ttk.Frame(root)
        loop_row.pack(fill=tk.X, pady=(0, 14))
        ttk.Label(loop_row, text="LOOP", style="Mute.TLabel").pack(side=tk.LEFT)
        self.loop_off = Pill(
            loop_row,
            text="  Off  ",
            command=lambda: self._set_loop(False),
            bg=PANEL,
            fg=BLACK,
            hover=LINE,
            font=_font(11),
            pady=5,
        )
        self.loop_off.pack(side=tk.LEFT, padx=(8, 0))
        self.loop_on = Pill(
            loop_row,
            text="  On  ",
            command=lambda: self._set_loop(True),
            bg=PANEL,
            fg=BLACK,
            hover=LINE,
            font=_font(11),
            pady=5,
        )
        self.loop_on.pack(side=tk.LEFT, padx=(6, 0))
        self._paint_loop()

        holder = tk.Frame(root, bg=PANEL, highlightthickness=0)
        holder.pack(fill=tk.BOTH, expand=True)
        self._progress_canvas = tk.Canvas(holder, bg=PANEL, highlightthickness=0, bd=0)
        scroll = ttk.Scrollbar(holder, orient="vertical", command=self._progress_canvas.yview)
        inner = tk.Frame(self._progress_canvas, bg=PANEL)
        inner.bind(
            "<Configure>",
            lambda _e: self._progress_canvas.configure(scrollregion=self._progress_canvas.bbox("all")),
        )
        self._progress_win = self._progress_canvas.create_window((0, 0), window=inner, anchor="nw")
        self._progress_canvas.configure(yscrollcommand=scroll.set)
        self._progress_canvas.bind("<Configure>", self._on_progress_width)
        self._progress_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        for widget in (self._progress_canvas, inner):
            widget.bind("<MouseWheel>", self._on_progress_wheel)

        tk.Label(inner, text="PROGRESS", fg=GREY, bg=PANEL, font=_font(10), anchor="w").pack(
            fill=tk.X, pady=(12, 8), padx=16
        )

        self._mark_boxes: dict[str, tk.Canvas] = {}
        self._progress_values: list[tk.Label] = []
        for key, title, var in (
            ("record", "CLIP", self.step_record),
            ("voice", "AI VOICE", self.step_voice),
            ("phrases", "PHRASES", self.step_phrases),
            ("transcript", "TRANSCRIPT", self.step_transcript),
        ):
            row = tk.Frame(inner, bg=PANEL)
            row.pack(fill=tk.X, pady=3, padx=16)
            box = tk.Canvas(row, width=12, height=12, bg=PANEL, highlightthickness=0, bd=0)
            box.pack(side=tk.LEFT, padx=(0, 8))
            box.create_rectangle(1, 1, 11, 11, outline=GREY, fill="", width=1, tags="sq")
            self._mark_boxes[key] = box
            tk.Label(row, text=title, fg=GREY, bg=PANEL, font=_font(11), width=12, anchor="w").pack(side=tk.LEFT)
            value = tk.Label(
                row,
                textvariable=var,
                fg=BLACK,
                bg=PANEL,
                font=_font(12),
                anchor="w",
                wraplength=560,
                justify=tk.LEFT,
            )
            value.pack(side=tk.LEFT, fill=tk.X, expand=True)
            self._progress_values.append(value)
        self._paint_marks()

        self.reason_label = tk.Label(
            inner,
            textvariable=self.reason,
            fg=BLACK,
            bg=PANEL,
            font=_font(12),
            anchor="nw",
            justify=tk.LEFT,
            wraplength=680,
        )
        self.reason_label.pack(fill=tk.BOTH, expand=True, pady=(14, 16), padx=16)

        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self.lift()
        self.attributes("-topmost", True)
        self.after(300, lambda: self.attributes("-topmost", False))
        self.focus_force()
        self.after(40, self._fit_screen)
        if os.environ.get("LISTEN_SHOT"):
            self.after(1800, self._shot_and_quit)
        self._pump()

    def choose_folder(self) -> str | None:
        picked = filedialog.askdirectory(
            title="Choose a folder for recordings",
            initialdir=self.recordings_dir.get() or str(Path.home() / "Documents"),
        )
        if picked:
            self.recordings_dir.set(picked)
            self._persist()
        return picked or None

    def _set_sensitivity(self, value: str) -> None:
        self.sensitivity.set(value)
        self._paint_sensitivity()
        self._persist()

    def _set_loop(self, on: bool) -> None:
        self.loop.set(on)
        self._paint_loop()
        self._persist()

    def _paint_loop(self) -> None:
        on, off = (self.loop_on, self.loop_off) if self.loop.get() else (self.loop_off, self.loop_on)
        on.configure(bg=BLACK, fg=WHITE)
        on._bg, on._fg, on._hover = BLACK, WHITE, "#333333"
        off.configure(bg=PANEL, fg=BLACK)
        off._bg, off._fg, off._hover = PANEL, BLACK, LINE

    def _paint_sensitivity(self) -> None:
        high = self.sensitivity.get() == "high"
        on, off = (self.sens_high, self.sens_default) if high else (self.sens_default, self.sens_high)
        on.configure(bg=BLACK, fg=WHITE)
        on._bg, on._fg, on._hover = BLACK, WHITE, "#333333"
        off.configure(bg=PANEL, fg=BLACK)
        off._bg, off._fg, off._hover = PANEL, BLACK, LINE

    def _fit_screen(self) -> None:
        self.update_idletasks()
        menu = 28
        height = max(self.winfo_reqheight(), self.winfo_screenheight() - menu)
        width = max(760, self.winfo_reqwidth())
        self.geometry(f"{width}x{height}+80+{menu}")

    def _on_progress_width(self, event) -> None:
        self._progress_canvas.itemconfigure(self._progress_win, width=event.width)
        wrap = max(280, event.width - 180)
        for label in self._progress_values:
            label.configure(wraplength=wrap)
        self.reason_label.configure(wraplength=max(280, event.width - 48))

    def _on_progress_wheel(self, event) -> None:
        delta = event.delta
        if delta == 0:
            return
        steps = -1 if delta > 0 else 1
        if abs(delta) >= 120:
            steps = int(-delta / 120)
        self._progress_canvas.yview_scroll(steps, "units")

    def _paint_phase(self) -> None:
        fg = {
            "Scam": SCAM,
            "Normal": NORMAL,
            "Stopping": GREY,
            "Error": SCAM,
        }.get(self.phase.get(), BLACK)
        if hasattr(self, "phase_label"):
            self.phase_label.configure(fg=fg)

    def _sms_autofill(self, *_args) -> None:
        if self._sms_lock:
            return
        raw = self.to.get()
        filled = normalize_sms(raw)
        if filled == raw:
            return
        self._sms_lock = True
        try:
            self.to.set(filled)
            if hasattr(self, "sms_entry"):
                self.sms_entry.icursor("end")
        finally:
            self._sms_lock = False

    def _sms_focus(self, _event=None) -> None:
        if normalize_sms(self.to.get()) == "+1":
            self.to.set("+1")
            self.sms_entry.icursor("end")

    def _ui(self, fn) -> None:
        self._ui_q.put(fn)

    def _pump(self) -> None:
        while True:
            try:
                fn = self._ui_q.get_nowait()
            except queue.Empty:
                break
            fn()
        if self._clip_live:
            self.step_record.set(f"{self._clip_elapsed:.1f}s / {self._clip_total:.0f}s")
        self._pump_id = self.after(80, self._pump)

    def _bind_stream(self, stream) -> None:
        self._audio_stream = stream

    def _bind_http(self, client) -> None:
        self._http_client = client

    def _paint_marks(self) -> None:
        for key, box in self._mark_boxes.items():
            done = self._done.get(key, False)
            box.itemconfigure("sq", outline=BLACK if done else GREY, fill=BLACK if done else "")

    def _set_pipeline(
        self,
        *,
        status: str | None = None,
        record: str | None = None,
        voice: str | None = None,
        phrases: str | None = None,
        transcript: str | None = None,
        reason: str | None = None,
        done: dict[str, bool] | None = None,
    ) -> None:
        rid = self._run_id

        def _apply() -> None:
            if self._halted or rid != self._run_id:
                return
            if status is not None:
                self.phase.set(status)
            if record is not None:
                self.step_record.set(record)
            if voice is not None:
                self.step_voice.set(voice)
            if phrases is not None:
                self.step_phrases.set(phrases)
            if transcript is not None:
                self.step_transcript.set(transcript)
            if reason is not None:
                self.reason.set(reason)
            if done:
                self._done.update(done)
            self._paint_marks()

        self._ui(_apply)

    def _reset_stages(self, seconds: float) -> None:
        self._done = {"record": False, "voice": False, "phrases": False, "transcript": False}
        self._set_pipeline(
            status="Listening",
            record=f"0.0s / {seconds:.0f}s",
            voice="—",
            phrases="—",
            transcript="—",
            reason="",
            done=self._done.copy(),
        )

    def on_start_click(self) -> None:
        if self._worker is not None and self._worker.is_alive() and not self._halted:
            return
        folder = Path(self.recordings_dir.get().strip() or "")
        if not folder.exists():
            picked = self.choose_folder()
            if not picked:
                messagebox.showerror("Recordings folder", "Choose a folder for recordings.")
                return
            folder = Path(picked)
        folder.mkdir(parents=True, exist_ok=True)
        try:
            seconds = float(self.seconds.get())
        except ValueError:
            messagebox.showerror("Listener interval", "Interval must be a number of seconds.")
            return
        url = self.url.get().strip() or DEFAULT_URL
        self._persist()
        self._stop.set()
        self._cancel_io()
        self._run_id += 1
        run_id = self._run_id
        stop_event = threading.Event()
        self._stop = stop_event
        self._halted = False
        self._clip_elapsed = 0.0
        self._clip_total = seconds
        self._clip_live = True
        self.start_btn.set_enabled(False)
        self.stop_btn.set_enabled(True)
        self.phase.set("Listening")
        self._reset_stages(seconds)
        self._worker = threading.Thread(
            target=self._loop,
            kwargs={
                "folder": folder,
                "url": url,
                "seconds": seconds,
                "to": sms_destination(self.to.get()),
                "force": self.sensitivity.get() == "high",
                "run_id": run_id,
                "stop_event": stop_event,
            },
            daemon=True,
        )
        self._worker.start()

    def _cancel_io(self) -> None:
        client = self._http_client
        self._http_client = None
        self._audio_stream = None
        if client is None:
            return

        def _close() -> None:
            try:
                client.close()
            except Exception:
                pass

        threading.Thread(target=_close, daemon=True).start()

    def stop(self) -> None:
        self._halted = True
        self._run_id += 1
        self._stop.set()
        self._clip_live = False
        self._cancel_io()
        self.start_btn.set_enabled(True)
        self.stop_btn.set_enabled(False)
        self.phase.set("Standby")
        self.reason.set("")
        self._done = {"record": False, "voice": False, "phrases": False, "transcript": False}
        self.step_record.set("—")
        self.step_voice.set("—")
        self.step_phrases.set("—")
        self.step_transcript.set("—")
        self._paint_marks()

    def _loop(
        self,
        *,
        folder: Path,
        url: str,
        seconds: float,
        to: str | None,
        force: bool,
        run_id: int,
        stop_event: threading.Event,
    ) -> None:
        def active() -> bool:
            return run_id == self._run_id and not stop_event.is_set()

        while active():
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            wav_out = folder / f"{stamp}.wav"
            json_out = folder / f"{stamp}.json"
            tmp = folder / f".{stamp}.tmp.wav"
            try:
                self._clip_elapsed = 0.0
                self._clip_total = seconds
                self._clip_live = True
                self._reset_stages(seconds)
                levels = record_wav(
                    tmp,
                    seconds=seconds,
                    sample_rate=16000,
                    device=None,
                    stop_event=stop_event,
                    on_progress=self._on_record_progress,
                )
                self._clip_live = False
                if not active():
                    if tmp.exists():
                        tmp.unlink(missing_ok=True)
                    break
                shutil.move(str(tmp), wav_out)
                self._set_pipeline(
                    record=parse_clip(seconds, levels),
                    voice="Checking…",
                    phrases="Checking…",
                    transcript="—",
                    reason="",
                    done={"record": True, "voice": False, "phrases": False, "transcript": False},
                )

                def on_event(event, seconds=seconds, levels=levels, force=force):
                    if not active():
                        return
                    self._on_detector_event(event, seconds=seconds, levels=levels, force=force)

                body = post_chunk(
                    url,
                    wav_out,
                    to=to,
                    force_escalate=force,
                    timeout=180.0,
                    on_client=self._bind_http,
                    on_event=on_event,
                )
                if not active():
                    break
                json_out.write_text(json.dumps(body, indent=2) + "\n")
                transcript = (body.get("transcript") or "").strip()
                if transcript:
                    (folder / f"{stamp}.txt").write_text(transcript + "\n")
                headline = self._apply_result(body, seconds=seconds, levels=levels)
                if not active():
                    break
                if headline == "Scam":
                    if not self.loop.get():
                        stop_event.set()
                        break
                elif not self._ask_keep_listening(active):
                    stop_event.set()
                    break
            except Exception as exc:
                self._clip_live = False
                if tmp.exists():
                    tmp.unlink(missing_ok=True)
                if not active():
                    break
                self._set_pipeline(status="Error", reason=str(exc))
                time.sleep(1.0)
            if not active():
                break
        if run_id == self._run_id:
            self._ui(self._idle)

    def _ask_keep_listening(self, active) -> bool:
        box = {"keep": False}
        done = threading.Event()

        def _ask() -> None:
            if self._halted:
                done.set()
                return
            box["keep"] = bool(
                messagebox.askyesno(
                    "Lighthouse",
                    "This clip looks normal.\nKeep listening?",
                    parent=self,
                )
            )
            done.set()

        self._ui(_ask)
        while not done.wait(0.1):
            if not active():
                return False
        return bool(box["keep"]) and active()

    def _on_record_progress(self, elapsed: float, total: float) -> None:
        self._clip_elapsed = min(elapsed, total)
        self._clip_total = total

    def _on_detector_event(self, event: dict, *, seconds: float, levels: dict | None, force: bool) -> None:
        stage = event.get("stage")
        if stage == "screen":
            will = bool(event.get("escalate")) or force
            self._set_pipeline(
                record=parse_clip(seconds, levels),
                voice=parse_ai_voice(event),
                phrases=parse_phrases(event),
                transcript="Reading what they said…" if will else "Screen looks ordinary.",
                reason="",
                done={"record": True, "voice": True, "phrases": True, "transcript": False},
            )
            return
        if stage == "transcript":
            text = " ".join(str(event.get("transcript") or "").split())
            shown = text[:140] + ("…" if len(text) > 140 else "") if text else "Classifying the call…"
            self._set_pipeline(
                transcript=shown,
                reason="",
            )

    def _apply_result(self, body: dict, *, seconds: float, levels: dict | None) -> str:
        headline, why = parse_scam_check(body)
        self._set_pipeline(
            status=headline,
            record=parse_clip(seconds, levels),
            voice=parse_ai_voice(body),
            phrases=parse_phrases(body),
            transcript=parse_transcript(body),
            reason=why,
            done={"record": True, "voice": True, "phrases": True, "transcript": True},
        )
        return headline

    def _idle(self) -> None:
        self.start_btn.set_enabled(True)
        self.stop_btn.set_enabled(False)
        self._clip_live = False
        self._audio_stream = None
        self._http_client = None
        if self._halted:
            return
        if self.phase.get() in {"Listening", "Stopping"}:
            self.phase.set("Standby")
            self._done = {"record": False, "voice": False, "phrases": False, "transcript": False}
            self._set_pipeline(
                record="—",
                voice="—",
                phrases="—",
                transcript="—",
                reason="",
                done=self._done.copy(),
            )

    def _persist(self) -> None:
        try:
            secs = float(self.seconds.get())
        except ValueError:
            secs = 30.0
        _save_config(
            {
                "recordings_dir": self.recordings_dir.get(),
                "url": self.url.get().strip(),
                "seconds": secs,
                "to": normalize_sms(self.to.get()),
                "sensitivity": self.sensitivity.get(),
                "force_escalate": self.sensitivity.get() == "high",
                "loop": self.loop.get(),
            }
        )

    def _shot_and_quit(self) -> None:
        self.update_idletasks()
        self.update()
        out = Path(__file__).resolve().parent / "listen-preview.png"
        subprocess.run(["screencapture", "-x", "-R80,32,760,708", str(out)], check=False)
        self.destroy()

    def on_close(self) -> None:
        self._halted = True
        self._run_id += 1
        self._stop.set()
        self._clip_live = False
        if self._pump_id is not None:
            self.after_cancel(self._pump_id)
        self._cancel_io()
        self._persist()
        self.destroy()


def main() -> int:
    app = ListenApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
