"""
Launch the FastAPI backend as a fully-detached daemon.
Uses double-fork to truly detach from the parent process.
"""
import os
import sys
import time
import signal
from pathlib import Path

BACKEND_DIR = Path("/home/z/my-project/erplite-backend")
VENV_PYTHON = str(BACKEND_DIR / ".venv" / "bin" / "python")
LOG_FILE = "/home/z/my-project/backend.log"
PID_FILE = "/home/z/my-project/backend.pid"

# Detach via double-fork
if os.fork() != 0:
    # Parent: wait a bit then check the daemon started
    time.sleep(0.5)
    sys.exit(0)

os.setsid()
signal.signal(signal.SIGHUP, signal.SIG_IGN)

if os.fork() != 0:
    os._exit(0)

# Now in the daemon
os.chdir(str(BACKEND_DIR))
os.umask(0)

# Redirect stdio
sys.stdout.flush()
sys.stderr.flush()
log_fd = os.open(LOG_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
os.dup2(log_fd, 1)
os.dup2(log_fd, 2)
devnull_fd = os.open("/dev/null", os.O_RDONLY)
os.dup2(devnull_fd, 0)

# Write pid file
with open(PID_FILE, "w") as f:
    f.write(str(os.getpid()))

# Exec uvicorn
os.execv(VENV_PYTHON, [
    VENV_PYTHON,
    "-m",
    "uvicorn",
    "app.main:app",
    "--host", "127.0.0.1",
    "--port", "8000",
    "--log-level", "info",
])
