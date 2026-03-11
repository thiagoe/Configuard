"""
Telnet client wrapper using pexpect.
"""

import re
import time
from typing import Optional, Callable

import pexpect


class TelnetClientWrapper:
    """Telnet client with prompt/pagination handling."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        login_prompt: str,
        password_prompt: str,
        prompt_pattern: str,
        timeout: int = 30,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.login_prompt = login_prompt
        self.password_prompt = password_prompt
        self.prompt_pattern = prompt_pattern
        self.timeout = timeout
        self.child = None

    def _normalize_line_ending(self, line_ending: str) -> str:
        """Telnet NVT expects CRLF for newline-oriented input."""
        return line_ending if "\r" in line_ending else line_ending.replace("\n", "\r\n")

    def _drain_until_idle(
        self,
        idle_seconds: float = 0.4,
        read_timeout: float = 0.1,
        poll_interval: float = 0.1,
        max_wait: Optional[float] = None,
        on_debug: Optional[Callable[[str], None]] = None,
    ) -> str:
        """Drain pending Telnet output until the channel stays idle for a period."""
        if not self.child:
            raise RuntimeError("Telnet session not connected")

        drained_chunks: list[str] = []
        idle_started_at = time.monotonic()
        started_at = idle_started_at

        while True:
            got_data = False
            try:
                chunk = self.child.read_nonblocking(size=4096, timeout=read_timeout)
                if chunk:
                    drained_chunks.append(chunk)
                    got_data = True
            except (pexpect.TIMEOUT, pexpect.EOF):
                pass

            now = time.monotonic()
            if got_data:
                idle_started_at = now
            elif now - idle_started_at >= idle_seconds:
                break

            if max_wait is not None and now - started_at >= max_wait:
                break

            time.sleep(poll_interval)

        drained = "".join(drained_chunks)
        if on_debug and drained:
            on_debug(f"Telnet drained {len(drained)} bytes while waiting for idle")
        return drained

    def send_key(
        self,
        key: str,
        settle_time: float = 0.5,
        idle_seconds: float = 0.4,
        on_debug: Optional[Callable[[str], None]] = None,
        line_ending: str = "\n",
    ) -> str:
        """Send a raw key sequence and optionally drain buffered output afterwards."""
        if not self.child:
            raise RuntimeError("Telnet session not connected")

        key_name = (key or "").lower().strip()
        if key_name == "enter":
            raw_key = self._normalize_line_ending(line_ending)
        else:
            key_map = {
                "space": " ",
                "tab": "\t",
                "escape": "\x1b",
                "ctrl+c": "\x03",
                "ctrl+z": "\x1a",
            }
            raw_key = key_map.get(key_name, key)

        self.child.send(raw_key)
        if on_debug:
            on_debug(f"Telnet send key {key!r} as {raw_key!r}")

        if settle_time > 0:
            time.sleep(settle_time)

        return self._drain_until_idle(
            idle_seconds=idle_seconds,
            on_debug=on_debug,
        )

    def sync_terminal(
        self,
        enter_count: int = 2,
        settle_time: float = 0.5,
        idle_seconds: float = 0.4,
        on_debug: Optional[Callable[[str], None]] = None,
        line_ending: str = "\n",
    ) -> str:
        """Resynchronize interactive terminal state using ENTER + idle drains."""
        drained_chunks = []
        for _ in range(max(0, enter_count)):
            drained_chunks.append(
                self.send_key(
                    "enter",
                    settle_time=settle_time,
                    idle_seconds=idle_seconds,
                    on_debug=on_debug,
                    line_ending=line_ending,
                )
            )
        return "".join(drained_chunks)

    def connect(
        self,
        on_debug: Optional[Callable[[str], None]] = None,
        on_event: Optional[Callable[[str, str], None]] = None,
    ) -> None:
        self.child = pexpect.spawn(
            f"telnet {self.host} {self.port}",
            timeout=self.timeout,
            encoding="utf-8",
        )
        # Use case-insensitive matching for login prompts
        self.child.ignorecase = True
        if on_debug:
            on_debug(f"Telnet connect {self.host}:{self.port} user={self.username}")

        # Detect first prompt: some devices ask username first, others skip straight to password
        try:
            idx = self.child.expect([self.login_prompt, self.password_prompt])
        except (pexpect.TIMEOUT, pexpect.EOF) as exc:
            raise RuntimeError(f"Telnet: não foi possível detectar prompt de login") from exc

        if idx == 0:
            # Normal flow: username prompt appeared first
            if on_debug:
                before_text = (self.child.before or "").replace("\r", "").replace("\n", "\\n")
                after_text = (self.child.after or "").replace("\r", "").replace("\n", "\\n") if isinstance(self.child.after, str) else ""
                on_debug(f"Telnet login prompt detected (before='{before_text[:200]}', matched='{after_text}')")
            self.child.send(self.username + "\r\n")
            try:
                # Also accept prompt_pattern in case device logs in without asking for password
                idx2 = self.child.expect([self.password_prompt, re.compile(self.prompt_pattern, re.MULTILINE | re.IGNORECASE)])
            except (pexpect.TIMEOUT, pexpect.EOF) as exc:
                if on_debug:
                    before_text = (self.child.before or "").replace("\r", "").replace("\n", "\\n")
                    on_debug(f"Telnet password prompt timeout (buffer='{before_text[:200]}', pattern='{self.password_prompt}')")
                if on_event:
                    on_event("login_failed", f"Telnet: usuário '{self.username}' não aceito pelo dispositivo")
                raise RuntimeError(f"Falha no login Telnet: usuário '{self.username}' não aceito") from exc
            if idx2 == 1:
                # Device accepted username and went straight to shell (no password needed)
                if on_debug:
                    on_debug("Telnet prompt detectado após username (sem senha necessária)")
                if on_event:
                    on_event("login_success", f"Login Telnet realizado com sucesso (usuário: {self.username})")
                return
            if on_debug:
                on_debug("Telnet password prompt detected")
        else:
            # Device skipped username prompt — only password required
            if on_debug:
                on_debug("Telnet password-only login (sem prompt de usuário)")

        self.child.send(self.password + "\r\n")

        compiled_prompt = re.compile(self.prompt_pattern, re.MULTILINE | re.IGNORECASE)
        try:
            # After sending password, check for prompt OR login failure
            idx = self.child.expect([
                compiled_prompt,            # 0 - success
                r"(?i)login failed",         # 1 - login failed
                r"(?i)authentication failed", # 2 - auth failed
                r"(?i)access denied",        # 3 - access denied
                r"(?i)incorrect",            # 4 - incorrect password
                r"(?i)invalid",              # 5 - invalid credentials
                self.login_prompt,           # 6 - login prompt again = failed
            ])
            if idx == 0:
                if on_event:
                    on_event("login_success", f"Login Telnet realizado com sucesso (usuário: {self.username})")
                if on_debug:
                    on_debug("Telnet prompt matched")
            elif idx == 6:
                # Login prompt appeared again - credentials rejected
                if on_event:
                    on_event("login_failed", f"Autenticação Telnet falhou para usuário '{self.username}': credenciais recusadas")
                raise RuntimeError(f"Falha no login Telnet: autenticação recusada para usuário '{self.username}'")
            else:
                # Error message detected
                if on_event:
                    on_event("login_failed", f"Autenticação Telnet falhou para usuário '{self.username}'")
                raise RuntimeError(f"Falha no login Telnet: autenticação recusada para usuário '{self.username}'")
        except pexpect.TIMEOUT:
            if on_event:
                on_event("login_failed", f"Telnet: timeout aguardando resposta após envio de senha para usuário '{self.username}'")
            raise RuntimeError(f"Falha no login Telnet: timeout aguardando resposta após envio de senha")
        except pexpect.EOF:
            if on_event:
                on_event("login_failed", f"Telnet: conexão fechada após envio de senha para usuário '{self.username}'")
            raise RuntimeError(f"Falha no login Telnet: conexão fechada pelo dispositivo após envio de senha")

    def close(self) -> None:
        if self.child:
            try:
                self.child.sendline("exit")
            except Exception:
                pass
            self.child.close()

    def send_command(
        self,
        command: str,
        prompt_pattern: str,
        pagination_pattern: Optional[str] = None,
        pagination_key: str = " ",
        timeout: int = 60,
        on_data: Optional[Callable[[str], None]] = None,
        on_debug: Optional[Callable[[str], None]] = None,
        line_ending: str = "\n",
    ) -> str:
        if not self.child:
            raise RuntimeError("Telnet session not connected")

        output = ""
        self.child.timeout = timeout
        if on_debug:
            on_debug(f"Telnet send command, timeout={timeout}s")
            on_debug(f"Telnet aguardando prompt pattern='{prompt_pattern}'")
        # Telnet NVT requires CRLF — normalize line ending regardless of template setting.
        effective_ending = self._normalize_line_ending(line_ending)
        self.child.send(command + effective_ending)

        pagination_count = 0
        # Compile prompt pattern with MULTILINE so $ matches end-of-line, not just end-of-buffer.
        compiled_prompt = re.compile(prompt_pattern, re.MULTILINE | re.IGNORECASE)
        while True:
            patterns = [compiled_prompt]
            if pagination_pattern:
                patterns.append(pagination_pattern)

            idx = self.child.expect(patterns)
            output += self.child.before
            if on_data and self.child.before:
                on_data(self.child.before)
            if on_debug and self.child.before:
                on_debug(f"Telnet recv {len(self.child.before)} bytes")

            if pagination_pattern and idx == 1:
                pagination_count += 1
                self.child.send(pagination_key)
                if on_debug:
                    on_debug(f"Telnet paginação detectada (pattern='{pagination_pattern}'), enviando tecla [{pagination_count}x]")
                time.sleep(0.05)
                continue

            if on_debug:
                prompt_matched = (self.child.after or "").strip() if isinstance(self.child.after, str) else ""
                on_debug(f"Telnet prompt detectado: {command!r} → {prompt_matched!r}")
            break

        return output
