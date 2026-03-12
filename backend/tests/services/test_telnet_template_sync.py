from types import SimpleNamespace

import pexpect

from app.services.backup_executor import (
    _get_telnet_sync_options,
    _should_telnet_sync_before_command,
)
from app.services.telnet_client import TelnetClientWrapper


class FakeTelnetChild:
    def __init__(self, reads=None):
        self.reads = list(reads or [])
        self.sent = []

    def send(self, data: str) -> None:
        self.sent.append(data)

    def read_nonblocking(self, size: int, timeout: float) -> str:
        if self.reads:
            next_item = self.reads.pop(0)
            if isinstance(next_item, Exception):
                raise next_item
            return next_item
        raise pexpect.TIMEOUT("idle")


def test_telnet_sync_options_are_opt_in_and_command_scoped():
    template = SimpleNamespace(
        transport_options={
            "telnet_sync": {
                "enabled": True,
                "after_login": True,
                "before_commands": [" enable ", "show running-config"],
                "enter_count": 2,
                "settle_ms": 500,
                "idle_ms": 400,
            }
        }
    )

    options = _get_telnet_sync_options(template)

    assert options["enabled"] is True
    assert options["after_login"] is True
    assert options["enter_count"] == 2
    assert options["settle_seconds"] == 0.5
    assert options["idle_seconds"] == 0.4
    assert _should_telnet_sync_before_command("enable", options) is True
    assert _should_telnet_sync_before_command("  SHOW   RUNNING-CONFIG ", options) is True
    assert _should_telnet_sync_before_command("show version", options) is False


def test_send_key_enter_uses_crlf_and_drains_output(monkeypatch):
    monkeypatch.setattr("app.services.telnet_client.time.sleep", lambda *_: None)

    client = TelnetClientWrapper(
        host="172.16.1.121",
        port=23,
        username="admin",
        password="secret",
        login_prompt="login:",
        password_prompt="password:",
        prompt_pattern=r"[>#]$",
    )
    client.child = FakeTelnetChild(reads=["audit-line", pexpect.TIMEOUT("idle")])

    drained = client.send_key("enter", settle_time=0, idle_seconds=0)

    assert client.child.sent == ["\r\n"]
    assert drained == "audit-line"


def test_sync_terminal_replays_the_expected_enter_drain_sequence(monkeypatch):
    monkeypatch.setattr("app.services.telnet_client.time.sleep", lambda *_: None)

    client = TelnetClientWrapper(
        host="172.16.1.121",
        port=23,
        username="admin",
        password="secret",
        login_prompt="login:",
        password_prompt="password:",
        prompt_pattern=r"[>#]$",
    )
    client.child = FakeTelnetChild(
        reads=[
            "prompt-1",
            pexpect.TIMEOUT("idle"),
            "prompt-2",
            pexpect.TIMEOUT("idle"),
        ]
    )

    drained = client.sync_terminal(enter_count=2, settle_time=0, idle_seconds=0)

    assert client.child.sent == ["\r\n", "\r\n"]
    assert drained == "prompt-1prompt-2"


def test_login_success_pattern_can_differ_from_command_prompt():
    client = TelnetClientWrapper(
        host="172.16.1.121",
        port=23,
        username="admin",
        password="secret",
        login_prompt="login:",
        password_prompt="password:",
        prompt_pattern=r"hostname[>#]\s*$",
        login_success_pattern=r"[>#]",
    )

    assert client.prompt_pattern == r"hostname[>#]\s*$"
    assert client.login_success_pattern == r"[>#]"
