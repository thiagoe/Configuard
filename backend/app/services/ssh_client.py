"""
SSH client wrapper for executing interactive commands.
"""

import io
import re
import socket
import subprocess
import tempfile
import os
import time
from typing import Optional, Callable

import paramiko


class SSHClientWrapper:
    """SSH client using an interactive shell to capture command output."""

    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: Optional[str] = None,
        private_key: Optional[str] = None,
        passphrase: Optional[str] = None,
        timeout: int = 30,
    ) -> None:
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.private_key = private_key
        self.passphrase = passphrase
        self.timeout = timeout
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.channel = None
        self.child = None
        self._tmp_key_file = None
        self._use_pexpect = False

    def _parse_private_key(self) -> paramiko.PKey:
        """Parse private key string into a Paramiko key object.

        Supports OpenSSH PEM format. Tries all key types: RSA, Ed25519, ECDSA, DSA.
        """
        key_text = self.private_key.strip()

        # Ensure the key has proper PEM boundaries
        if not key_text.startswith("-----"):
            raise RuntimeError(
                "Chave privada em formato inválido. "
                "A chave deve estar no formato OpenSSH (-----BEGIN ... PRIVATE KEY-----)."
            )

        # Try all Paramiko key types
        key_classes = [
            paramiko.RSAKey,
            paramiko.Ed25519Key,
            paramiko.ECDSAKey,
            paramiko.DSSKey,
        ]
        last_error = None
        for key_class in key_classes:
            try:
                key_stream = io.StringIO(key_text)
                return key_class.from_private_key(key_stream, password=self.passphrase)
            except Exception as e:
                last_error = e
                continue

        raise RuntimeError(
            f"Não foi possível carregar a chave privada: {last_error}"
        )

    def connect(
        self,
        on_debug: Optional[Callable[[str], None]] = None,
        on_event: Optional[Callable[[str, str], None]] = None,
    ) -> None:
        pkey = None
        if self.private_key:
            pkey = self._parse_private_key()

        if on_debug:
            on_debug(f"SSH connect {self.host}:{self.port} user={self.username} (legacy algorithms enabled: ssh-dss, dh-group1)")

        sock = None
        transport = None
        try:
            sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
            transport = paramiko.Transport(sock)
            transport.banner_timeout = self.timeout
            transport.auth_timeout = self.timeout

            # Configure security options for legacy device support
            security = transport.get_security_options()

            # Add legacy host key algorithms including ssh-dss (DSA) for old devices like ZTE OLTs
            key_types = list(security.key_types)
            for algo in ("ssh-rsa", "ssh-dss"):
                if algo not in key_types:
                    key_types.append(algo)
            security.key_types = tuple(key_types)

            # Add legacy KEX algorithms
            kex_algos = list(security.kex)
            for algo in ("diffie-hellman-group1-sha1", "diffie-hellman-group14-sha1", "diffie-hellman-group-exchange-sha1"):
                if algo not in kex_algos:
                    kex_algos.append(algo)
            security.kex = tuple(kex_algos)

            if on_debug:
                on_debug(f"SSH host key algorithms: {', '.join(security.key_types[:5])}...")
                on_debug(f"SSH KEX algorithms: {', '.join(security.kex[:5])}...")

            # Suppress paramiko's stderr output during connection attempt
            # Paramiko writes directly to stderr when transport thread encounters errors
            import sys
            old_stderr = sys.stderr
            sys.stderr = io.StringIO()
            try:
                if pkey:
                    # Key-based auth: use only the private key, do not attempt password
                    transport.connect(username=self.username, pkey=pkey)
                else:
                    # Password auth: try password first, then keyboard-interactive
                    try:
                        transport.connect(username=self.username, password=self.password)
                    except paramiko.AuthenticationException:
                        # Try keyboard-interactive (used by TP-LINK and similar devices)
                        def _kbd_handler(title, instructions, prompt_list):
                            return [self.password or "" for _ in prompt_list]
                        transport.auth_interactive(self.username, _kbd_handler)
            except paramiko.AuthenticationException as auth_exc:
                if on_event:
                    on_event("login_failed", f"Autenticação SSH falhou para usuário '{self.username}': {auth_exc}")
                raise RuntimeError(f"Falha no login SSH: autenticação recusada para usuário '{self.username}'") from auth_exc
            finally:
                sys.stderr = old_stderr

            if on_event:
                on_event("login_success", f"Login SSH realizado com sucesso (usuário: {self.username})")

            self.client._transport = transport
            self._use_pexpect = False
        except RuntimeError:
            raise
        except Exception as exc:
            message = str(exc).lower()
            if on_debug:
                on_debug(f"SSH paramiko error: {message}")

            # Check for authentication failure markers
            auth_markers = ("authentication failed", "auth failed", "no valid credentials", "bad password")
            if any(marker in message for marker in auth_markers):
                if on_event:
                    on_event("login_failed", f"Autenticação SSH falhou para usuário '{self.username}': {exc}")
                raise RuntimeError(f"Falha no login SSH: autenticação recusada para usuário '{self.username}'") from exc

            # Markers that indicate we need legacy algorithm support via system SSH
            legacy_markers = (
                "unknown cipher",
                "no acceptable host key",
                "no matching cipher",
                "no matching key exchange",
                "no matching host key type",
                "incompatible ssh peer",
                "incompatible peer",
            )
            if not any(marker in message for marker in legacy_markers):
                # Clean up and re-raise non-legacy errors
                if transport:
                    try:
                        transport.close()
                    except Exception:
                        pass
                if sock:
                    try:
                        sock.close()
                    except Exception:
                        pass
                raise

            if on_debug:
                on_debug("Falling back to system SSH for legacy cipher/hostkey support (ssh-dss, old ciphers).")

            # Clean up paramiko resources
            if transport:
                try:
                    transport.close()
                except Exception:
                    pass
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass

            self._use_pexpect = True
            self._connect_pexpect(on_debug=on_debug, on_event=on_event)
            return
        self.channel = self.client.invoke_shell()
        self.channel.settimeout(self.timeout)
        time.sleep(0.3)
        if self.channel.recv_ready():
            banner = self.channel.recv(4096)
            if on_debug and banner:
                on_debug(f"SSH banner {len(banner)} bytes")
        if on_debug:
            on_debug("SSH shell ready")

    def _connect_pexpect(self, on_debug: Optional[Callable[[str], None]] = None, on_event: Optional[Callable[[str, str], None]] = None) -> None:
        import pexpect

        # Query what this system's SSH client actually supports
        supported_ciphers = self._get_supported_ciphers()
        supported_key_types = self._get_supported_key_types()
        supported_kex = self._get_supported_kex()

        # Desired host key algorithms (legacy-inclusive), filtered to what SSH supports
        desired_host_keys = [
            "ssh-ed25519", "ecdsa-sha2-nistp256", "ecdsa-sha2-nistp384",
            "ecdsa-sha2-nistp521", "rsa-sha2-512", "rsa-sha2-256",
            "ssh-rsa", "ssh-dss",
        ]
        host_key_list = [k for k in desired_host_keys if k in supported_key_types]
        if not host_key_list:
            host_key_list = desired_host_keys[:6]  # fallback: modern only

        # Desired KEX algorithms (legacy-inclusive), filtered to what SSH supports
        desired_kex = [
            "curve25519-sha256", "curve25519-sha256@libssh.org",
            "ecdh-sha2-nistp256", "ecdh-sha2-nistp384",
            "diffie-hellman-group16-sha512", "diffie-hellman-group14-sha256",
            "diffie-hellman-group14-sha1", "diffie-hellman-group1-sha1",
            "diffie-hellman-group-exchange-sha256", "diffie-hellman-group-exchange-sha1",
        ]
        kex_list = [k for k in desired_kex if k in supported_kex]
        if not kex_list:
            kex_list = desired_kex[:6]

        # Build cipher list: all system-supported ciphers (includes legacy if available)
        cipher_list = [c for c in supported_ciphers if c]

        args = [
            "ssh",
            "-tt",
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            "-o", f"ConnectTimeout={self.timeout}",
            "-o", "BatchMode=no",
            "-o", f"HostKeyAlgorithms={','.join(host_key_list)}",
            "-o", f"PubkeyAcceptedAlgorithms={','.join(host_key_list)}",
            "-o", f"KexAlgorithms={','.join(kex_list)}",
            "-p", str(self.port),
        ]
        if self.password and not self.private_key:
            args.extend(["-o", "PreferredAuthentications=password,keyboard-interactive", "-o", "PubkeyAuthentication=no"])
        if cipher_list:
            args.extend(["-o", f"Ciphers={','.join(cipher_list)}"])
        if on_debug:
            on_debug(f"SSH pexpect host keys: {','.join(host_key_list)}")
            on_debug(f"SSH pexpect kex: {','.join(kex_list[:4])}... ({len(kex_list)} total)")
            on_debug(f"SSH pexpect ciphers: {','.join(cipher_list[:5])}... ({len(cipher_list)} total)")

        if self.private_key:
            key_fd, key_path = tempfile.mkstemp(prefix="cfg-ssh-", text=True)
            os.write(key_fd, self.private_key.encode())
            os.close(key_fd)
            os.chmod(key_path, 0o600)
            self._tmp_key_file = key_path
            args.extend(["-i", key_path])

        args.append(f"{self.username}@{self.host}")
        if on_debug:
            on_debug(f"SSH pexpect command: {args[0]} ... {self.username}@{self.host}")

        # Use spawn with args list directly (no shell escaping issues)
        child = pexpect.spawn(args[0], args[1:], timeout=self.timeout, encoding="utf-8")
        self.child = child

        while True:
            idx = child.expect(
                [
                    "Are you sure you want to continue connecting",  # 0
                    "Enter passphrase for key",                      # 1
                    "(?i)user(?:name)?:",                            # 2 - "User:" (TP-LINK) or "Username:"
                    "(?i)login:",                                    # 3
                    "(?i)password:",                                 # 4
                    "(?i)senha:",                                    # 5
                    "(?i)press any key",                             # 6
                    "(?i)permission denied",                         # 7
                    "(?i)connection closed by",                      # 8
                    "(?i)connection refused",                        # 9
                    "(?i)connection timed out",                      # 10
                    "(?i)no matching cipher",                        # 11
                    "(?i)unknown cipher",                            # 12
                    "(?i)no matching key exchange",                  # 13
                    "(?i)no matching host key type",                 # 14
                    "(?i)unable to negotiate",                       # 15
                    r"[#>$\]%]",                                     # 16 - prompt (common endings)
                    pexpect.EOF,                                     # 17 - EOF
                    pexpect.TIMEOUT,                                 # 18 - Timeout
                ],
                timeout=self.timeout,
            )
            if idx == 0:  # Are you sure you want to continue connecting
                child.sendline("yes")
                continue
            if idx == 1:  # Enter passphrase for key
                if not self.passphrase:
                    raise RuntimeError("SSH key requires passphrase")
                child.sendline(self.passphrase)
                continue
            if idx in (2, 3):  # username/login prompt
                child.sendline(self.username)
                continue
            if idx in (4, 5):  # password/senha prompt
                if not self.password:
                    raise RuntimeError("SSH password required but not provided")
                child.sendline(self.password)
                continue
            if idx == 6:  # press any key
                child.sendline("")
                continue
            if idx == 7:  # Permission denied - login failure
                if on_event:
                    on_event("login_failed", f"Autenticação SSH falhou para usuário '{self.username}': permissão negada")
                raise RuntimeError(f"Falha no login SSH: autenticação recusada para usuário '{self.username}'")
            if idx in (8, 9, 10, 11, 12, 13, 14, 15):  # Other error conditions
                before = (child.before or "").strip()
                after = child.after if isinstance(child.after, str) else ""
                error_msg = (before + " " + after).strip() or "Unknown error"
                if on_debug:
                    on_debug(f"SSH pexpect error at idx={idx}: before={repr(before[:200])}")
                raise RuntimeError(f"SSH connection failed: {error_msg}")
            if idx == 16:  # Prompt detected - success
                if on_event:
                    on_event("login_success", f"Login SSH realizado com sucesso (usuário: {self.username})")
                break
            if idx == 17:  # EOF
                error_msg = child.before.strip() if child.before else "Connection closed"
                # Check if EOF is due to authentication failure
                if error_msg and "permission denied" in error_msg.lower():
                    if on_event:
                        on_event("login_failed", f"Autenticação SSH falhou para usuário '{self.username}': {error_msg}")
                    raise RuntimeError(f"Falha no login SSH: autenticação recusada para usuário '{self.username}'")
                raise RuntimeError(f"SSH connection closed unexpectedly: {error_msg}")
            if idx == 18:  # Timeout
                error_msg = child.before.strip() if child.before else "No response"
                raise RuntimeError(f"SSH connection timed out: {error_msg}")

        if on_debug:
            on_debug("SSH pexpect shell ready")

    @staticmethod
    def _get_supported_ciphers() -> list[str]:
        try:
            output = subprocess.check_output(["ssh", "-Q", "cipher"], text=True)
            return [line.strip() for line in output.splitlines() if line.strip()]
        except Exception:
            return []

    @staticmethod
    def _get_supported_key_types() -> list[str]:
        try:
            output = subprocess.check_output(["ssh", "-Q", "key"], text=True)
            return [line.strip() for line in output.splitlines() if line.strip()]
        except Exception:
            return []

    @staticmethod
    def _get_supported_kex() -> list[str]:
        try:
            output = subprocess.check_output(["ssh", "-Q", "kex"], text=True)
            return [line.strip() for line in output.splitlines() if line.strip()]
        except Exception:
            return []

    def close(self) -> None:
        if self.channel:
            self.channel.close()
        if self.child:
            try:
                self.child.sendline("exit")
            except Exception:
                pass
            self.child.close()
        if self._tmp_key_file:
            try:
                os.remove(self._tmp_key_file)
            except OSError:
                pass
        self.client.close()

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
        if self._use_pexpect:
            return self._send_command_pexpect(
                command=command,
                prompt_pattern=prompt_pattern,
                pagination_pattern=pagination_pattern,
                pagination_key=pagination_key,
                timeout=timeout,
                on_data=on_data,
                on_debug=on_debug,
                line_ending=line_ending,
            )

        if not self.channel:
            raise RuntimeError("SSH channel not connected")

        prompt_regex = re.compile(prompt_pattern)
        pagination_regex = re.compile(pagination_pattern) if pagination_pattern else None

        # Drain any pending output (old prompt/banner) before sending a new command.
        drained = 0
        while self.channel.recv_ready():
            chunk = self.channel.recv(4096).decode(errors="ignore")
            drained += len(chunk)
        if on_debug and drained:
            on_debug(f"SSH drained {drained} bytes before command")

        if on_debug:
            on_debug(
                f"SSH send command, timeout={timeout}s, line_ending={repr(line_ending)}"
            )
            on_debug(f"SSH aguardando prompt pattern='{prompt_pattern}'")
        self.channel.send(command + line_ending)
        buffer = ""
        start = time.monotonic()
        last_debug = start
        last_recv_time = start  # Track when we last received data
        idle_threshold = 1.0  # Wait 1s of no data before checking prompt

        while True:
            if time.monotonic() - start > timeout:
                tail = buffer[-500:] if buffer else ""
                raise TimeoutError(f"Command timed out. Last output: {tail}")

            if self.channel.recv_ready():
                chunk = self.channel.recv(4096).decode(errors="ignore")
                buffer += chunk
                last_recv_time = time.monotonic()  # Reset idle timer
                if on_data:
                    on_data(chunk)
                if on_debug and chunk:
                    on_debug(f"SSH recv {len(chunk)} bytes")

                if pagination_regex and pagination_regex.search(buffer):
                    buffer = pagination_regex.sub("", buffer)
                    self.channel.send(pagination_key)
                    if on_debug:
                        on_debug(f"SSH paginação detectada (pattern='{pagination_pattern}'), enviando tecla")
                    continue
            else:
                # Only check for prompt after a period of no data (device finished sending)
                idle_time = time.monotonic() - last_recv_time
                if idle_time >= idle_threshold and buffer:
                    # Check for prompt only in the last line of the buffer
                    # This prevents false matches in the middle of command output
                    last_line = buffer.rstrip().rsplit("\n", 1)[-1]
                    if prompt_regex.search(last_line):
                        if on_debug:
                            on_debug(f"SSH prompt detectado (pattern='{prompt_pattern}') após {idle_time:.2f}s idle — comando concluído")
                        break

                if on_debug and time.monotonic() - last_debug > 5:
                    on_debug(f"SSH waiting for data... elapsed={int(time.monotonic() - start)}s")
                    last_debug = time.monotonic()
                time.sleep(0.05)

        return buffer

    def _send_command_pexpect(
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
            raise RuntimeError("SSH pexpect session not connected")

        output = ""
        self.child.timeout = timeout
        if on_debug:
            on_debug(f"SSH pexpect send command, timeout={timeout}s")
            on_debug(f"SSH pexpect aguardando prompt pattern='{prompt_pattern}'")
        self.child.send(command + line_ending)

        pagination_count = 0
        while True:
            patterns = [prompt_pattern]
            if pagination_pattern:
                patterns.append(pagination_pattern)

            idx = self.child.expect(patterns)
            output += self.child.before
            if on_data and self.child.before:
                on_data(self.child.before)

            if pagination_pattern and idx == 1:
                pagination_count += 1
                self.child.send(pagination_key)
                if on_debug:
                    on_debug(f"SSH pexpect paginação detectada (pattern='{pagination_pattern}'), enviando tecla [{pagination_count}x]")
                time.sleep(0.05)
                continue

            if on_debug:
                on_debug(f"SSH pexpect prompt detectado (pattern='{prompt_pattern}') — comando concluído")
            break

        return output
