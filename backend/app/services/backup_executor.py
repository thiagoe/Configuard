"""
Backup execution service for devices.
"""

import hashlib
import re
import uuid
from typing import Optional, Callable

from sqlalchemy.orm import Session

from app.models.device import Device
from app.models.credential import Credential
from app.models.backup_template import BackupTemplate
from app.models.configuration import Configuration
from app.models.backup_execution import BackupExecution
from app.services.encryption import decrypt, is_encrypted
from app.services.ssh_client import SSHClientWrapper
from app.services.telnet_client import TelnetClientWrapper
from app.core.logging import get_backup_logger
from app.core.timezone import now


backup_logger = get_backup_logger()


class BackupError(RuntimeError):
    """Backup execution error."""


# Regex to match ANSI escape sequences (terminal colors, cursor movement, etc.)
ANSI_ESCAPE_PATTERN = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def _strip_ansi_codes(text: str) -> str:
    """Remove ANSI escape codes from text (terminal colors, etc.)."""
    return ANSI_ESCAPE_PATTERN.sub('', text)


def _clean_output(text: str, prompt_pattern: str, cleanup_patterns: Optional[str] = None) -> str:
    """
    Clean command output by removing prompts, echo, and control characters.

    Args:
        text: Raw output from device
        prompt_pattern: Regex pattern for device prompt
        cleanup_patterns: Optional newline-separated regex patterns to remove from output
    """
    # Remove NUL bytes (0x00) — common in Telnet padding; PostgreSQL rejects them in TEXT
    text = text.replace('\x00', '')

    # Remove ANSI codes
    text = _strip_ansi_codes(text)

    # Remove carriage returns and normalize line endings
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Remove inline pagination markers left in output by interactive CLIs.
    # These appear mid-line mixed with content; strip them and surrounding whitespace.
    # Also removes orphaned "(Q to quit)" fragments left after the marker is split across chunks.
    text = re.sub(r'\s*Press any key to continue[^\n]*(?:\(Q to quit\)[^\n]*)?', '', text)
    text = re.sub(r'[ \t]*\(Q to quit\)[ \t]*', '', text)

    # Remove trailing spaces from each line
    lines = [line.rstrip() for line in text.split('\n')]

    # Remove empty lines at start/end
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()

    # Try to remove prompt lines at start and end using the pattern
    try:
        prompt_regex = re.compile(prompt_pattern)
        # Remove leading lines that are just prompts or command echo
        while lines:
            line = lines[0].strip()
            # Empty line
            if not line:
                lines.pop(0)
                continue
            # Line is just a prompt
            if prompt_regex.search(line) and len(line) < 100:
                lines.pop(0)
                continue
            # Line starts with / (command echo like "/export") and is short
            if line.startswith('/') and len(line) < 50 and not line.startswith('# '):
                lines.pop(0)
                continue
            break
        # Remove trailing lines that are just prompts or partial prompts (e.g. hostname without #)
        hostname_re = re.compile(r'^[\w][\w.\-]*$')
        while lines:
            line = lines[-1].strip()
            if not line:
                lines.pop()
                continue
            if prompt_regex.search(line) and len(line) < 100:
                lines.pop()
                continue
            # Remove orphan hostname lines when a prompt fragment is left without its trailing marker.
            if hostname_re.match(line) and len(line) < 60 and '-' in line:
                lines.pop()
                continue
            break
    except re.error:
        pass

    # Collapse runs of blank lines in the middle of the output (max 1 consecutive blank line)
    collapsed = []
    prev_blank = False
    for line in lines:
        is_blank = not line.strip()
        if is_blank and prev_blank:
            continue
        collapsed.append(line)
        prev_blank = is_blank
    lines = collapsed

    # Apply custom cleanup patterns from template
    if cleanup_patterns:
        lines = _apply_cleanup_patterns(lines, cleanup_patterns)

    return '\n'.join(lines)


def _apply_cleanup_patterns(lines: list, cleanup_patterns: str) -> list:
    """
    Remove lines matching cleanup patterns anywhere in the output.

    The cleanup_patterns is a newline-separated string of regex patterns.
    Any line that matches one of these patterns is removed, regardless of position.

    Example patterns for Cisco IOS (volatile lines that change every backup):
        ^! Last configuration change at .*
        ^! NVRAM config last updated at .*
        ^ntp clock-period \\d+

    Example patterns for MikroTik header:
        ^#\\s+\\w{3}/\\d{1,2}/\\d{4}.*by\\s+RouterOS
        ^#\\s+software\\s+id\\s*=
        ^#\\s+model\\s*=
        ^#\\s+serial\\s+number\\s*=
        ^#\\s*$
    """
    if not lines or not cleanup_patterns:
        return lines

    # Parse patterns from the template field
    patterns = []
    for pattern_str in cleanup_patterns.split('\n'):
        pattern_str = pattern_str.strip()
        if pattern_str:
            try:
                patterns.append(re.compile(pattern_str))
            except re.error as e:
                backup_logger.warning(f"Invalid cleanup pattern '{pattern_str}': {e}")

    if not patterns:
        return lines

    # Remove any line that matches any cleanup pattern (full file scan)
    cleaned_lines = [
        line for line in lines
        if not any(pattern.match(line.strip()) for pattern in patterns)
    ]

    # Remove leading empty lines after cleanup
    while cleaned_lines and not cleaned_lines[0].strip():
        cleaned_lines.pop(0)

    return cleaned_lines


def _decrypt_if_needed(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return decrypt(value) if is_encrypted(value) else value


def _normalize_command_name(command: Optional[str]) -> str:
    """Normalize a command string for template-scoped matching."""
    return " ".join((command or "").strip().lower().split())


def _get_telnet_sync_options(template: BackupTemplate) -> dict:
    """Read template-scoped Telnet sync options without affecting global behavior."""
    transport_options = template.transport_options or {}
    telnet_sync = transport_options.get("telnet_sync") or {}
    enabled = bool(telnet_sync.get("enabled"))
    return {
        "enabled": enabled,
        "after_login": enabled and bool(telnet_sync.get("after_login")),
        "before_commands": {
            _normalize_command_name(command)
            for command in telnet_sync.get("before_commands", [])
            if isinstance(command, str) and command.strip()
        },
        "enter_count": max(0, min(int(telnet_sync.get("enter_count", 2)), 5)) if enabled else 0,
        "settle_seconds": max(0.0, min(float(telnet_sync.get("settle_ms", 500)) / 1000.0, 5.0)) if enabled else 0.0,
        "idle_seconds": max(0.1, min(float(telnet_sync.get("idle_ms", 400)) / 1000.0, 5.0)) if enabled else 0.1,
    }


def _should_telnet_sync_before_command(command: str, telnet_sync_options: dict) -> bool:
    """Return True when the template opted into a terminal resync before the command."""
    if not telnet_sync_options.get("enabled"):
        return False
    return _normalize_command_name(command) in telnet_sync_options["before_commands"]


def _get_device_template(db: Session, device: Device) -> BackupTemplate:
    """Get the backup template directly assigned to the device."""
    if not device.backup_template_id:
        raise BackupError("Device has no backup template assigned")

    template = db.query(BackupTemplate).filter(
        BackupTemplate.id == device.backup_template_id,
    ).first()

    if not template:
        raise BackupError("Backup template not found")

    return template


def _get_latest_config(db: Session, device_id: str) -> Optional[Configuration]:
    return db.query(Configuration).filter(
        Configuration.device_id == device_id
    ).order_by(Configuration.version.desc()).first()


class BackupResult:
    """Result of a backup execution."""

    def __init__(
        self,
        execution: BackupExecution,
        configuration: Optional[Configuration] = None,
    ):
        self.execution = execution
        self.configuration = configuration
        self.config_changed = execution.config_changed

    @property
    def success(self) -> bool:
        return self.execution.status == "success"


def execute_backup(
    db: Session,
    device: Device,
    user_id: str,
    event_callback: Optional[Callable[[str, dict], None]] = None,
    log_level: str = "info",
    scheduled: bool = False,
    schedule_id: Optional[str] = None,
) -> BackupResult:
    """
    Execute a backup for a device.

    This function implements a hybrid approach:
    - Always records a BackupExecution for audit trail
    - Only creates a new Configuration if the config changed (or first backup)
    - Returns BackupResult with both execution record and optional configuration

    Args:
        db: Database session
        device: Device to backup
        user_id: User who initiated the backup
        event_callback: Optional callback for streaming events
        log_level: Log level (info, verbose, debug)
        scheduled: Whether this backup was triggered by a schedule
        schedule_id: Optional schedule ID if triggered by schedule

    Returns:
        BackupResult containing execution record and optional new configuration
    """
    level_rank = {"info": 0, "verbose": 1, "debug": 2}
    effective_level = log_level if log_level in level_rank else "info"

    def emit(event: str, message: Optional[str] = None, **data) -> None:
        if not event_callback:
            return
        if event == "debug" and level_rank[effective_level] < level_rank["debug"]:
            return
        if event == "verbose" and level_rank[effective_level] < level_rank["verbose"]:
            return
        payload = {"message": message} if message else {}
        payload.update(data)
        event_callback(event, payload)

    template = _get_device_template(db, device)

    credential = None
    if device.credential_id:
        credential = db.query(Credential).filter(
            Credential.id == device.credential_id,
        ).first()

    if not credential:
        raise BackupError("Device has no credential assigned")

    # Determine protocol based on device port (23=Telnet, otherwise SSH)
    is_telnet = device.port == 23

    username = credential.username
    password = _decrypt_if_needed(credential.password_encrypted)
    private_key = _decrypt_if_needed(credential.private_key_encrypted)
    passphrase = _decrypt_if_needed(credential.passphrase_encrypted)

    prompt_pattern = template.prompt_pattern or r"#|>|$"
    login_success_pattern = template.login_success_pattern or prompt_pattern
    # Only use pagination if explicitly set in template (empty string = disabled)
    pagination_pattern = template.pagination_pattern if template.pagination_pattern else None
    pagination_key = template.pagination_key or " "
    login_prompt = template.login_prompt or r"Username:|Login:"
    password_prompt = template.password_prompt or r"Password:"
    # Get line_ending from template, interpreting escaped sequences
    raw_line_ending = template.line_ending or "\\n"
    line_ending = raw_line_ending.replace("\\r", "\r").replace("\\n", "\n")
    telnet_sync_options = _get_telnet_sync_options(template)
    emit("status", "Configurações do template carregadas")
    emit(
        "verbose",
        "Detalhes do template",
        prompt_pattern=prompt_pattern,
        login_success_pattern=login_success_pattern,
        pagination_pattern=pagination_pattern,
        connection_timeout=template.connection_timeout,
        command_timeout=template.command_timeout,
        telnet_sync_enabled=telnet_sync_options["enabled"],
    )

    port = device.port
    if credential.port:
        try:
            port = int(credential.port)
        except ValueError:
            port = device.port

    outputs = []
    variables = {}

    # Determine collection method: scheduled or manual (ssh/telnet)
    if scheduled:
        collection_method = "scheduled"
    else:
        collection_method = "telnet" if is_telnet else "ssh"

    # Record execution start time
    execution_started_at = now()

    backup_logger.info(
        "Backup started",
        device_id=device.id,
        template_id=template.id,
        credential_id=credential.id,
    )
    emit("status", f"Iniciando backup do dispositivo {device.name}", device_id=device.id)

    def on_login_event(event_type: str, message: str) -> None:
        """Handle login success/failure events from SSH/Telnet clients."""
        if event_type == "login_success":
            emit("status", message)
        elif event_type == "login_failed":
            emit("error", message)

    def sync_telnet_terminal(reason: str) -> None:
        """Run the opt-in Telnet terminal resync sequence for templates that need it."""
        if not is_telnet or not telnet_sync_options["enabled"]:
            return
        emit("debug", f"Telnet sync: {reason}")
        client.sync_terminal(
            enter_count=telnet_sync_options["enter_count"],
            settle_time=telnet_sync_options["settle_seconds"],
            idle_seconds=telnet_sync_options["idle_seconds"],
            on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
            line_ending=line_ending,
        )

    try:
        if is_telnet:
            if not password:
                raise BackupError("Telnet requires password")

            emit("status", "Conectando via Telnet", host=device.ip_address, port=port)
            emit("debug", "Inicializando cliente Telnet", host=device.ip_address, port=port)
            client = TelnetClientWrapper(
                host=device.ip_address,
                port=port,
                username=username,
                password=password,
                login_prompt=login_prompt,
                password_prompt=password_prompt,
                prompt_pattern=prompt_pattern,
                login_success_pattern=login_success_pattern,
                timeout=template.connection_timeout,
            )
            client.connect(
                on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                on_event=on_login_event,
            )
            emit("status", "Conexão Telnet estabelecida")
            if telnet_sync_options["after_login"]:
                sync_telnet_terminal("ressincronizando sessão após login")
        else:
            if not password and not private_key:
                raise BackupError("SSH requires password or private key")

            emit("status", "Conectando via SSH", host=device.ip_address, port=port)
            emit("debug", "Inicializando cliente SSH", host=device.ip_address, port=port)
            client = SSHClientWrapper(
                host=device.ip_address,
                port=port,
                username=username,
                password=password,
                private_key=private_key,
                passphrase=passphrase,
                timeout=template.connection_timeout,
            )
            client.connect(
                on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                on_event=on_login_event,
            )
            emit("status", "Conexão SSH estabelecida")

        # Enable mode (no password): just send 'enable' and wait for privileged prompt
        if template.enable_required and not template.enable_password_required:
            emit("status", "Entrando no modo enable")
            emit("debug", f"Enable: enviando comando 'enable', aguardando prompt='{prompt_pattern}'")
            if _should_telnet_sync_before_command("enable", telnet_sync_options):
                sync_telnet_terminal("preparando terminal antes do comando 'enable'")
            client.send_command(
                "enable",
                prompt_pattern=prompt_pattern,
                timeout=template.command_timeout,
                on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                line_ending=line_ending,
            )
            emit("status", "Modo enable ativado")

        # Enable mode with password: send 'enable', wait for password prompt, send password
        if template.enable_password_required:
            enable_prompt = template.enable_prompt or r"[Pp]assword:"
            emit("status", "Entrando no modo enable")
            emit("debug", f"Enable: enviando comando 'enable', aguardando prompt='{enable_prompt}'")
            if _should_telnet_sync_before_command("enable", telnet_sync_options):
                sync_telnet_terminal("preparando terminal antes do comando 'enable'")
            client.send_command(
                "enable",
                prompt_pattern=enable_prompt,
                timeout=template.command_timeout,
                on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                line_ending=line_ending,
            )
            # Send the enable password (reuses credential password)
            emit("debug", "Enable: enviando senha")
            client.send_command(
                password or "",
                prompt_pattern=prompt_pattern,
                timeout=template.command_timeout,
                on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                line_ending=line_ending,
            )
            emit("status", "Modo enable ativado")

        if template.pre_commands:
            for command in [c.strip() for c in template.pre_commands.split("\n") if c.strip()]:
                if _should_telnet_sync_before_command(command, telnet_sync_options):
                    sync_telnet_terminal(f"preparando terminal antes de {command!r}")
                emit("command", f"Executando: {command}", command=command, timeout=template.command_timeout)
                output = client.send_command(
                    command,
                    prompt_pattern=prompt_pattern,
                    pagination_pattern=pagination_pattern,
                    pagination_key=pagination_key,
                    timeout=template.command_timeout,
                    on_data=lambda chunk: emit("output", chunk=chunk),
                    on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                    line_ending=line_ending,
                )
                outputs.append(output)

        if template.use_steps:
            steps = sorted(template.steps, key=lambda s: s.order)
            for step in steps:
                if step.condition and not variables.get(step.condition):
                    continue
                if step.step_type == "pause":
                    time_to_sleep = step.timeout or 1
                    import time as _time
                    _time.sleep(time_to_sleep)
                    continue
                if step.step_type == "send_key":
                    emit("command", f"Enviando tecla: {step.content}", command=step.content)
                    if is_telnet and telnet_sync_options["enabled"] and hasattr(client, "send_key"):
                        client.send_key(
                            step.content,
                            settle_time=step.timeout or telnet_sync_options["settle_seconds"],
                            idle_seconds=telnet_sync_options["idle_seconds"],
                            on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                            line_ending=line_ending,
                        )
                    else:
                        key_map = {
                            "enter": "\n",
                            "space": " ",
                            "tab": "\t",
                            "escape": "\x1b",
                            "ctrl+c": "\x03",
                            "ctrl+z": "\x1a",
                        }
                        raw_key = key_map.get(step.content.lower().strip(), step.content)
                        if hasattr(client, 'channel') and client.channel:
                            client.channel.send(raw_key)
                        elif hasattr(client, 'child') and client.child:
                            client.child.send(raw_key)
                        import time as _time
                        _time.sleep(step.timeout or 1)
                        # Drain any residual echo/control data from the interactive channel.
                        if hasattr(client, 'child') and client.child:
                            try:
                                while True:
                                    if not client.child.read_nonblocking(size=4096, timeout=0.3):
                                        break
                            except Exception:
                                pass
                    continue
                if step.step_type == "set_prompt":
                    prompt_pattern = step.content or prompt_pattern
                    continue
                if step.step_type == "expect":
                    emit("verbose", f"Aguardando padrão: {step.expect_pattern or prompt_pattern}")
                    output = client.send_command(
                        "",
                        prompt_pattern=step.expect_pattern or prompt_pattern,
                        pagination_pattern=pagination_pattern,
                        pagination_key=pagination_key,
                        timeout=step.timeout or template.command_timeout,
                        on_data=lambda chunk: emit("output", chunk=chunk),
                        line_ending="",  # Don't send any line ending for expect steps
                    )
                    if step.capture_output:
                        outputs.append(output)
                    if step.variable_name:
                        variables[step.variable_name] = output
                    continue

                emit(
                    "command",
                    f"Executando: {step.content}",
                    command=step.content,
                    timeout=step.timeout or template.command_timeout,
                )
                if _should_telnet_sync_before_command(step.content, telnet_sync_options):
                    sync_telnet_terminal(f"preparando terminal antes de {step.content!r}")
                output = client.send_command(
                    step.content,
                    prompt_pattern=step.expect_pattern or prompt_pattern,
                    pagination_pattern=pagination_pattern,
                    pagination_key=pagination_key,
                    timeout=step.timeout or template.command_timeout,
                    on_data=lambda chunk: emit("output", chunk=chunk),
                    on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                    line_ending=line_ending,
                )
                if step.capture_output:
                    outputs.append(output)
                if step.variable_name:
                    variables[step.variable_name] = output
        else:
            for command in template.commands_list:
                if _should_telnet_sync_before_command(command, telnet_sync_options):
                    sync_telnet_terminal(f"preparando terminal antes de {command!r}")
                emit("command", f"Executando: {command}", command=command, timeout=template.command_timeout)
                output = client.send_command(
                    command,
                    prompt_pattern=prompt_pattern,
                    pagination_pattern=pagination_pattern,
                    pagination_key=pagination_key,
                    timeout=template.command_timeout,
                    on_data=lambda chunk: emit("output", chunk=chunk),
                    on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                    line_ending=line_ending,
                )
                outputs.append(output)

        if template.post_commands:
            for command in [c.strip() for c in template.post_commands.split("\n") if c.strip()]:
                if _should_telnet_sync_before_command(command, telnet_sync_options):
                    sync_telnet_terminal(f"preparando terminal antes de {command!r}")
                emit("command", f"Executando: {command}", command=command, timeout=template.command_timeout)
                output = client.send_command(
                    command,
                    prompt_pattern=prompt_pattern,
                    pagination_pattern=pagination_pattern,
                    pagination_key=pagination_key,
                    timeout=template.command_timeout,
                    on_data=lambda chunk: emit("output", chunk=chunk),
                    on_debug=(lambda msg: emit("debug", msg)) if effective_level == "debug" else None,
                    line_ending=line_ending,
                )
                outputs.append(output)

        client.close()
    except Exception as exc:
        execution_completed_at = now()
        duration = int((execution_completed_at - execution_started_at).total_seconds())

        # Create failed execution record
        execution = BackupExecution(
            id=str(uuid.uuid4()),
            device_id=device.id,
            user_id=user_id,
            status="failed",
            error_message=str(exc),
            configuration_id=None,
            config_changed=False,
            config_hash=None,
            collection_method=collection_method,
            started_at=execution_started_at,
            completed_at=execution_completed_at,
            duration_seconds=duration,
            triggered_by="scheduled" if scheduled else "manual",
            schedule_id=schedule_id,
        )
        db.add(execution)

        device.last_backup_at = execution_completed_at
        device.last_backup_status = "failed"
        device.last_backup_error = str(exc)
        db.commit()

        backup_logger.error(
            "Backup failed",
            device_id=device.id,
            execution_id=execution.id,
            error=str(exc),
        )
        emit("error", str(exc))
        raise

    # Join outputs and clean up (ANSI codes, prompts, control chars, custom patterns)
    config_data = "\n".join(outputs).strip()
    config_data = _clean_output(config_data, prompt_pattern, template.output_cleanup_patterns)
    if not config_data:
        raise BackupError("Backup produced empty configuration data")

    execution_completed_at = now()
    duration = int((execution_completed_at - execution_started_at).total_seconds())

    config_hash = hashlib.sha256(config_data.encode()).hexdigest()
    latest = _get_latest_config(db, device.id)
    changes_detected = latest is None or latest.config_hash != config_hash

    configuration = None

    # Only create new configuration if changes detected (or first backup)
    if changes_detected:
        next_version = 1 if latest is None else latest.version + 1

        configuration = Configuration(
            id=str(uuid.uuid4()),
            device_id=device.id,
            version=next_version,
            config_data=config_data,
            config_hash=config_hash,
            collection_method=collection_method,
            collected_at=execution_completed_at,
            collected_by=user_id,
            changes_detected=True,
            previous_config_id=latest.id if latest else None,
            size_bytes=len(config_data.encode()),
            lines_count=len(config_data.splitlines()),
        )
        db.add(configuration)

    # Always create execution record for audit trail
    execution = BackupExecution(
        id=str(uuid.uuid4()),
        device_id=device.id,
        user_id=user_id,
        status="success",
        error_message=None,
        configuration_id=configuration.id if configuration else None,
        config_changed=changes_detected,
        config_hash=config_hash,
        collection_method=collection_method,
        started_at=execution_started_at,
        completed_at=execution_completed_at,
        duration_seconds=duration,
        triggered_by="scheduled" if scheduled else "manual",
        schedule_id=schedule_id,
    )
    db.add(execution)

    # Update device status
    device.last_backup_at = execution_completed_at
    device.last_backup_status = "success"
    device.last_backup_error = None
    device.last_config_hash = config_hash
    db.commit()

    if configuration:
        db.refresh(configuration)
    db.refresh(execution)

    backup_logger.info(
        "Backup completed",
        device_id=device.id,
        execution_id=execution.id,
        configuration_id=configuration.id if configuration else None,
        changes_detected=changes_detected,
    )

    if changes_detected:
        emit("done", "Backup concluído - Alterações detectadas", configuration_id=configuration.id, changes_detected=True)
    else:
        emit("done", "Backup concluído - Sem alterações", configuration_id=latest.id if latest else None, changes_detected=False)

    return BackupResult(execution=execution, configuration=configuration)
