"""
BackupTemplate schemas (Pydantic models)
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator


StepTypeEnum = Literal["command", "expect", "pause", "set_prompt", "conditional", "send_key"]
OnFailureEnum = Literal["stop", "continue", "retry"]


class TemplateStepBase(BaseModel):
    """Base template step schema"""
    order: int = Field(..., ge=1)
    step_type: StepTypeEnum = "command"
    content: str = Field(..., min_length=1)
    timeout: Optional[int] = Field(None, ge=1, le=600)
    expect_pattern: Optional[str] = Field(None, max_length=200)
    on_failure: OnFailureEnum = "stop"
    max_retries: int = Field(0, ge=0, le=5)
    condition: Optional[str] = None
    capture_output: bool = True
    variable_name: Optional[str] = Field(None, max_length=50)


class TemplateStepCreate(TemplateStepBase):
    """Template step creation schema"""
    pass


class TemplateStepUpdate(BaseModel):
    """Template step update schema"""
    order: Optional[int] = Field(None, ge=1)
    step_type: Optional[StepTypeEnum] = None
    content: Optional[str] = Field(None, min_length=1)
    timeout: Optional[int] = Field(None, ge=1, le=600)
    expect_pattern: Optional[str] = Field(None, max_length=200)
    on_failure: Optional[OnFailureEnum] = None
    max_retries: Optional[int] = Field(None, ge=0, le=5)
    condition: Optional[str] = None
    capture_output: Optional[bool] = None
    variable_name: Optional[str] = Field(None, max_length=50)


class TemplateStepResponse(TemplateStepBase):
    """Template step response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    template_id: str
    created_at: datetime


class TelnetSyncOptions(BaseModel):
    """Template-scoped Telnet terminal resync options."""
    enabled: bool = False
    after_login: bool = False
    before_commands: list[str] = Field(default_factory=list)
    enter_count: int = Field(2, ge=0, le=5)
    settle_ms: int = Field(500, ge=0, le=5000)
    idle_ms: int = Field(400, ge=100, le=5000)


class TransportOptions(BaseModel):
    """Transport-specific template options."""
    telnet_sync: Optional[TelnetSyncOptions] = None


LineEndingEnum = Literal["\\n", "\\r\\n"]


def _normalize_line_ending(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    if value in ["\\n", "\\r\\n"]:
        return value
    if value == "\n":
        return "\\n"
    if value == "\r\n":
        return "\\r\\n"
    return value


class BackupTemplateBase(BaseModel):
    """Base backup template schema"""
    @field_validator("line_ending", mode="before")
    @classmethod
    def normalize_line_ending(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_line_ending(value)
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    commands: Optional[str] = None  # Newline-separated commands
    use_steps: bool = False
    prompt_pattern: Optional[str] = Field(None, max_length=100)
    login_success_pattern: Optional[str] = Field(None, max_length=100)
    login_prompt: Optional[str] = Field(None, max_length=100)
    password_prompt: Optional[str] = Field(None, max_length=100)
    enable_prompt: Optional[str] = Field(None, max_length=100)
    enable_required: bool = False
    enable_password_required: bool = False
    pagination_pattern: Optional[str] = Field(None, max_length=100)
    pagination_key: Optional[str] = Field(None, max_length=10)
    connection_timeout: int = Field(30, ge=5, le=300)
    command_timeout: int = Field(60, ge=5, le=600)
    pre_commands: Optional[str] = None
    post_commands: Optional[str] = None
    line_ending: LineEndingEnum = "\\n"  # Line ending for commands (\n or \r\n)
    output_cleanup_patterns: Optional[str] = None  # Regex patterns (one per line) to remove from output
    error_patterns: Optional[str] = None
    transport_options: Optional[TransportOptions] = None
    is_default: bool = False


class BackupTemplateCreate(BackupTemplateBase):
    """Backup template creation schema"""
    steps: Optional[list[TemplateStepCreate]] = None


class BackupTemplateUpdate(BaseModel):
    """Backup template update schema"""
    @field_validator("line_ending", mode="before")
    @classmethod
    def normalize_line_ending(cls, value: Optional[str]) -> Optional[str]:
        return _normalize_line_ending(value)
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    commands: Optional[str] = None
    use_steps: Optional[bool] = None
    prompt_pattern: Optional[str] = Field(None, max_length=100)
    login_success_pattern: Optional[str] = Field(None, max_length=100)
    login_prompt: Optional[str] = Field(None, max_length=100)
    password_prompt: Optional[str] = Field(None, max_length=100)
    enable_prompt: Optional[str] = Field(None, max_length=100)
    enable_required: Optional[bool] = None
    enable_password_required: Optional[bool] = None
    pagination_pattern: Optional[str] = Field(None, max_length=100)
    pagination_key: Optional[str] = Field(None, max_length=10)
    connection_timeout: Optional[int] = Field(None, ge=5, le=300)
    command_timeout: Optional[int] = Field(None, ge=5, le=600)
    pre_commands: Optional[str] = None
    post_commands: Optional[str] = None
    line_ending: Optional[LineEndingEnum] = None
    output_cleanup_patterns: Optional[str] = None
    error_patterns: Optional[str] = None
    transport_options: Optional[TransportOptions] = None
    is_default: Optional[bool] = None
    steps: Optional[list[TemplateStepCreate]] = None


class BackupTemplateResponse(BackupTemplateBase):
    """Backup template response schema"""
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime
    updated_at: datetime
    steps: list[TemplateStepResponse] = []

    @property
    def commands_list(self) -> list[str]:
        """Get commands as a list"""
        if not self.commands:
            return []
        return [cmd.strip() for cmd in self.commands.split("\n") if cmd.strip()]


class BackupTemplateListResponse(BaseModel):
    """Paginated backup template list response"""
    items: list[BackupTemplateResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
