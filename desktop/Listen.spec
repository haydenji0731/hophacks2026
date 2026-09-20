# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs

datas = collect_data_files("sounddevice") + collect_data_files("soundfile") + [
    ("assets/outpost.png", "assets"),
]
binaries = collect_dynamic_libs("sounddevice") + collect_dynamic_libs("soundfile")

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=[
        "listen",
        "sounddevice",
        "_sounddevice_data",
        "soundfile",
        "numpy",
        "httpx",
        "cffi",
        "tkinter",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="Outpost",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="Outpost",
)
app = BUNDLE(
    coll,
    name="Outpost.app",
    icon="assets/outpost.icns",
    bundle_identifier="club.wehatescammers.outpost",
    info_plist={
        "CFBundleName": "Outpost",
        "CFBundleDisplayName": "Outpost",
        "CFBundleShortVersionString": "0.1.0",
        "NSHighResolutionCapable": True,
        "NSMicrophoneUsageDescription": (
            "Outpost records a short call clip on this Mac, saves it in the folder you choose, "
            "and sends it to the detector. Audio is not processed on this laptop."
        ),
    },
)
