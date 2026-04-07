import os
import subprocess
import sys


ROOT = os.path.dirname(os.path.dirname(__file__))
VENV_DIR = os.path.join(ROOT, ".venv_tradingagents")


def _run(cmd):
    p = subprocess.run(cmd, cwd=ROOT)
    if p.returncode != 0:
        raise SystemExit(p.returncode)


def main():
    py = sys.executable
    if not os.path.exists(VENV_DIR):
        _run([py, "-m", "venv", VENV_DIR])

    vpy = os.path.join(VENV_DIR, "bin", "python")
    _run([vpy, "-m", "pip", "install", "-U", "pip", "wheel", "setuptools"])

    candidates = [
        ["tradingagents"],
        ["trading-agents"],
    ]
    extra = (os.environ.get("TA_PIP_EXTRA") or "").strip()
    for pkg in candidates:
        try:
            cmd = [vpy, "-m", "pip", "install", "-U", *pkg]
            if extra:
                cmd.extend(extra.split())
            _run(cmd)
            break
        except SystemExit:
            continue

    need = [
        "pandas",
        "numpy",
        "requests",
        "yfinance",
        "stockstats",
    ]
    cmd = [vpy, "-m", "pip", "install", "-U", *need]
    if extra:
        cmd.extend(extra.split())
    _run(cmd)

    print("OK")
    print(VENV_DIR)


if __name__ == "__main__":
    main()

