import os
import subprocess
import sys


ROOT = os.path.dirname(os.path.dirname(__file__))
VENV_DIR = os.path.join(ROOT, ".venv_tradingagents")
VENDOR_DIR = os.path.join(ROOT, "vendor", "TradingAgents")
REPO_URL = "https://github.com/TauricResearch/TradingAgents.git"


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

    os.makedirs(os.path.dirname(VENDOR_DIR), exist_ok=True)
    extra = (os.environ.get("TA_PIP_EXTRA") or "").strip()

    if not os.path.exists(VENDOR_DIR):
        _run(["git", "clone", "--depth", "1", REPO_URL, VENDOR_DIR])
    else:
        _run(["git", "-C", VENDOR_DIR, "fetch", "--depth", "1", "origin"])
        _run(["git", "-C", VENDOR_DIR, "reset", "--hard", "origin/HEAD"])

    cmd = [vpy, "-m", "pip", "install", "-U", "-e", VENDOR_DIR]
    if extra:
        cmd.extend(extra.split())
    _run(cmd)

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
    print(VENDOR_DIR)


if __name__ == "__main__":
    main()
