"""
Launch the Vite dev server as a fully-detached daemon.
"""
import os
import sys
import time
import signal
from pathlib import Path

FRONTEND_DIR = Path("/home/z/my-project/erplite-frontend")
VENV_NPM = str(FRONTEND_DIR / "node_modules" / ".bin" / "vite")
LOG_FILE = "/home/z/my-project/frontend.log"
PID_FILE = "/home/z/my-project/frontend.pid"

if os.fork() != 0:
    time.sleep(0.5)
    sys.exit(0)

os.setsid()
signal.signal(signal.SIGHUP, signal.SIG_IGN)

if os.fork() != 0:
    os._exit(0)

os.chdir(str(FRONTEND_DIR))
os.umask(0)

sys.stdout.flush()
sys.stderr.flush()
log_fd = os.open(LOG_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
os.dup2(log_fd, 1)
os.dup2(log_fd, 2)
devnull_fd = os.open("/dev/null", os.O_RDONLY)
os.dup2(devnull_fd, 0)

with open(PID_FILE, "w") as f:
    f.write(str(os.getpid()))

os.execv(VENV_NPM, [VENV_NPM, "--port", "5173", "--host", "127.0.0.1"])
