"""
BackupTemplate model - Templates for device configuration backup
"""

from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean, Integer, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.timezone import now


class BackupTemplate(Base):
    """Backup template with commands or steps for configuration collection"""

    __tablename__ = "backup_templates"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)

    # Simple mode: newline-separated commands
    commands = Column(Text, nullable=True)

    # Advanced mode: use template_steps relationship
    use_steps = Column(Boolean, default=False, nullable=False)

    # Connection settings
    prompt_pattern = Column(String(100), nullable=True)  # Regex for prompt detection
    login_prompt = Column(String(100), nullable=True)
    password_prompt = Column(String(100), nullable=True)
    enable_prompt = Column(String(100), nullable=True)
    enable_required = Column(Boolean, default=False, nullable=False)
    enable_password_required = Column(Boolean, default=False, nullable=False)
    pagination_pattern = Column(String(100), nullable=True)  # --More-- pattern
    pagination_key = Column(String(10), default=" ", nullable=True)
    connection_timeout = Column(Integer, default=30, nullable=False)  # seconds
    command_timeout = Column(Integer, default=60, nullable=False)  # seconds

    # Pre/post commands
    pre_commands = Column(Text, nullable=True)  # Commands to run before main commands
    post_commands = Column(Text, nullable=True)  # Commands to run after main commands

    # Line ending for commands (default \n, MikroTik uses \r\n)
    line_ending = Column(String(10), default="\\n", nullable=False)

    # Output cleanup patterns - regex patterns (one per line) to remove from output
    # Used to strip metadata headers, vendor-specific lines, etc.
    output_cleanup_patterns = Column(Text, nullable=True)
    error_patterns = Column(Text, nullable=True)

    # Flags
    is_default = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=now, nullable=False)
    updated_at = Column(DateTime, default=now, onupdate=now, nullable=False)

    # Relationships
    user = relationship("User", backref="backup_templates")
    steps = relationship("TemplateStep", back_populates="template", cascade="all, delete-orphan", order_by="TemplateStep.order")
    devices = relationship("Device", back_populates="backup_template")

    @property
    def commands_list(self) -> list:
        """Get commands as a list"""
        if not self.commands:
            return []
        return [cmd.strip() for cmd in self.commands.split("\n") if cmd.strip()]

    def __repr__(self):
        return f"<BackupTemplate {self.name}>"


class TemplateStep(Base):
    """Individual step in a backup template (for advanced mode)"""

    __tablename__ = "template_steps"

    id = Column(String(36), primary_key=True)
    template_id = Column(String(36), ForeignKey("backup_templates.id", ondelete="CASCADE"), nullable=False)

    # Step order (1-based)
    order = Column(Integer, nullable=False)

    # Step type: command, expect, pause, set_prompt, conditional
    step_type = Column(String(20), nullable=False, default="command")

    # Step content
    content = Column(Text, nullable=False)  # Command text or expect pattern

    # Additional settings
    timeout = Column(Integer, nullable=True)  # Override default timeout
    expect_pattern = Column(String(200), nullable=True)  # Pattern to wait for after command
    on_failure = Column(String(20), default="stop")  # stop, continue, retry
    max_retries = Column(Integer, default=0)

    # Conditional execution
    condition = Column(Text, nullable=True)  # Expression to evaluate

    # Output handling
    capture_output = Column(Boolean, default=True)  # Include in final output
    variable_name = Column(String(50), nullable=True)  # Store output in variable

    created_at = Column(DateTime, default=now, nullable=False)

    # Relationships
    template = relationship("BackupTemplate", back_populates="steps")

    def __repr__(self):
        return f"<TemplateStep {self.order}: {self.step_type}>"
