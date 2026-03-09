"""
Backup scheduling service using APScheduler.
"""

from datetime import datetime, time
from app.core.timezone import now, get_timezone
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.database import SessionLocal
from app.core.logging import get_backup_logger
from app.core import backup_lock
from app.models.schedule import BackupSchedule, ScheduleType
from app.services.backup_executor import execute_backup
from app.services.email import send_notification


backup_logger = get_backup_logger()
_scheduler: Optional[BackgroundScheduler] = None


def _parse_time_of_day(value: Optional[time]) -> tuple[int, int]:
    if not value:
        return 2, 0
    return value.hour, value.minute


def _build_trigger(schedule: BackupSchedule) -> CronTrigger:
    hour, minute = _parse_time_of_day(schedule.time_of_day)
    tz = get_timezone()

    if schedule.schedule_type == ScheduleType.DAILY:
        return CronTrigger(hour=hour, minute=minute, timezone=tz)
    if schedule.schedule_type == ScheduleType.WEEKLY:
        return CronTrigger(day_of_week=schedule.day_of_week, hour=hour, minute=minute, timezone=tz)
    if schedule.schedule_type == ScheduleType.MONTHLY:
        return CronTrigger(day=schedule.day_of_month, hour=hour, minute=minute, timezone=tz)
    if schedule.schedule_type == ScheduleType.CRON:
        if not schedule.cron_expression:
            raise ValueError("Cron expression is required")
        parts = schedule.cron_expression.split()
        if len(parts) != 5:
            raise ValueError("Cron expression must have 5 fields")
        minute, hour, day, month, day_of_week = parts
        return CronTrigger(minute=minute, hour=hour, day=day, month=month, day_of_week=day_of_week, timezone=tz)

    raise ValueError("Unsupported schedule type")


def _run_schedule(schedule_id: str) -> None:
    db = SessionLocal()
    try:
        schedule = db.query(BackupSchedule).filter(BackupSchedule.id == schedule_id).first()
        if not schedule or not schedule.is_active:
            return

        schedule.last_run_at = now()
        db.commit()

        # Collect all devices: direct devices + devices from categories
        device_ids_seen = set()
        devices_to_backup = []

        # Add directly associated devices
        for device in schedule.devices:
            if device.id not in device_ids_seen:
                device_ids_seen.add(device.id)
                devices_to_backup.append(device)

        # Add devices from associated categories
        for category in schedule.categories:
            for device in category.devices:
                if device.id not in device_ids_seen:
                    device_ids_seen.add(device.id)
                    devices_to_backup.append(device)

        backup_logger.info(
            "Running scheduled backup",
            schedule_id=schedule_id,
            schedule_name=schedule.name,
            total_devices=len(devices_to_backup),
            direct_devices=len(schedule.devices),
            categories=len(schedule.categories),
        )

        for device in devices_to_backup:
            if device.status != "active":
                backup_logger.debug(
                    "Skipping device (device inactive)",
                    schedule_id=schedule_id,
                    device_id=device.id,
                    device_name=device.name,
                    device_status=device.status,
                )
                continue

            if not backup_lock.acquire(device.id):
                backup_logger.warning(
                    "Skipping device (backup already running)",
                    schedule_id=schedule_id,
                    device_id=device.id,
                    device_name=device.name,
                )
                continue

            try:
                execute_backup(db, device, schedule.user_id, scheduled=True, schedule_id=schedule_id)
                send_notification(db, "backup_success", {"device_name": device.name})
            except Exception as exc:
                backup_logger.error(
                    "Scheduled backup failed",
                    schedule_id=schedule_id,
                    device_id=device.id,
                    device_name=device.name,
                    error=str(exc),
                )
                send_notification(db, "backup_failed", {
                    "device_name": device.name,
                    "error": str(exc),
                })
            finally:
                backup_lock.release(device.id)

        # Update next_run_at from scheduler
        job = _scheduler.get_job(schedule_id) if _scheduler else None
        if job and job.next_run_time:
            schedule.next_run_at = job.next_run_time
            db.commit()
    finally:
        db.close()


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone=get_timezone())
    return _scheduler


def start_scheduler() -> None:
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        backup_logger.info("Scheduler started")

    db = SessionLocal()
    try:
        schedules = db.query(BackupSchedule).filter(BackupSchedule.is_active == True).all()
        backup_logger.info(f"Loading {len(schedules)} active schedules")
        for schedule in schedules:
            add_or_update_schedule(schedule.id, db)
            backup_logger.info(
                f"Registered schedule: {schedule.name}",
                schedule_id=schedule.id,
                next_run=str(schedule.next_run_at),
            )
    finally:
        db.close()


def shutdown_scheduler() -> None:
    scheduler = get_scheduler()
    if scheduler.running:
        scheduler.shutdown(wait=False)


def add_or_update_schedule(schedule_id: str, db=None) -> None:
    scheduler = get_scheduler()
    owns_session = False
    if db is None:
        db = SessionLocal()
        owns_session = True

    try:
        schedule = db.query(BackupSchedule).filter(BackupSchedule.id == schedule_id).first()
        if not schedule:
            return

        if scheduler.get_job(schedule_id):
            scheduler.remove_job(schedule_id)

        if not schedule.is_active:
            schedule.next_run_at = None
            db.commit()
            return

        trigger = _build_trigger(schedule)
        job = scheduler.add_job(
            _run_schedule,
            trigger=trigger,
            id=schedule_id,
            replace_existing=True,
            args=[schedule_id],
        )

        schedule.next_run_at = job.next_run_time
        db.commit()
    finally:
        if owns_session:
            db.close()


def remove_schedule(schedule_id: str) -> None:
    scheduler = get_scheduler()
    if scheduler.get_job(schedule_id):
        scheduler.remove_job(schedule_id)
