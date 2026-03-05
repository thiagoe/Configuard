"""
Global in-memory lock to prevent concurrent backups on the same device.
Used by both the API routes (manual backup) and the scheduler.
"""

from threading import Lock

_running_backups: set = set()
_lock = Lock()


def acquire(device_id: str) -> bool:
    """Try to acquire the lock for a device. Returns True if acquired, False if already running."""
    with _lock:
        if device_id in _running_backups:
            return False
        _running_backups.add(device_id)
        return True


def release(device_id: str) -> None:
    """Release the lock for a device."""
    with _lock:
        _running_backups.discard(device_id)
