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
                idx2 = self.child.expect([self.password_prompt, self.prompt_pattern])
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

        try:
            # After sending password, check for prompt OR login failure
            idx = self.child.expect([
                self.prompt_pattern,         # 0 - success
                r"(?i)login failed",         # 1 - login failed
                r"(?i)authentication failed", # 2 - auth failed
                r"(?i)access denied",        # 3 - access denied
                r"(?i)incorrect",            # 4 - incorrect password
                r"(?i)invalid",              # 5 - invalid credentials
                self.login_prompt,           # 6 - login prompt again = failed
            ])
            if idx == 0:
                # Login successful
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
        # Telnet NVT requires CRLF — normalize line ending regardless of template setting
        effective_ending = line_ending if "\r" in line_ending else line_ending.replace("\n", "\r\n")
        self.child.send(command + effective_ending)

        pagination_count = 0
        while True:
            patterns = [prompt_pattern]
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
                on_debug(f"Telnet prompt detectado (pattern='{prompt_pattern}') — comando concluído")
            break

        return output
