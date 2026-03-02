# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Configuard is a web application for centralized management of network device configurations (routers, switches, firewalls). It enables automated backups via SSH/Telnet, configuration versioning with diff comparison, encrypted credential management, and complete audit logging.

## Project Structure

```
configuard/
├── frontend/                # Production React frontend
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── pages/           # Page components
│       ├── services/        # API service layer
│       ├── hooks/           # Custom React hooks
│       └── contexts/        # React contexts (Auth, etc.)
├── backend/                 # Python API backend
│   ├── app/
│   │   ├── api/routes/      # FastAPI route handlers
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic schemas
│   │   ├── services/        # Business logic services
│   │   └── core/            # Core utilities (config, db, logging)
│   └── logs/                # Application logs directory
├── db/                      # MariaDB Docker container
│   ├── docker-compose.yml   # Database container configuration
│   ├── init/                # SQL initialization scripts (001-006)
│   └── data/                # Persistent database data (gitignored)
└── documentacao/            # Project documentation
```

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite as bundler
- Tailwind CSS + shadcn/ui (Radix UI based)
- React Router for navigation
- React Query (@tanstack/react-query) for state/cache
- Recharts for graphs, Lucide React for icons, Sonner for toasts
- react-hook-form + zod for form validation
- date-fns for date formatting

### Backend
- Python 3.12+
- FastAPI framework
- SQLAlchemy ORM
- MariaDB/MySQL database
- Paramiko (SSH), Telnetlib (Telnet) for device connections
- python-jose for JWT, bcrypt for password hashing
- cryptography for AES-256-GCM credential encryption
- Loguru for structured logging (logs stored in `logs/` directory)
- APScheduler for automated backup scheduling

## Build Commands

### Frontend
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Development server (Vite)
npm run build        # Production build
npm run lint         # ESLint
npm run preview      # Preview production build
```

### Backend
```bash
cd backend
python -m venv venv           # Create virtual environment
source venv/bin/activate      # Activate (Linux/Mac)
pip install -r requirements.txt
uvicorn main:app --reload     # Development server
```

### Database (Docker)
```bash
cd db
docker-compose up -d          # Start MariaDB container
docker-compose down           # Stop container
docker-compose logs -f        # View logs

# Apply new migrations manually:
docker-compose exec -T mariadb mysql -u configuard -pconfiguard123 configuard < init/006_backup_executions.sql
```

## Database Schema

Key tables with UUID primary keys:

- **users** / **user_roles**: Authentication with role-based access (admin, moderator, user)
- **credentials**: SSH/Telnet credentials (AES-256-GCM encrypted passwords)
- **devices**: Network devices with IP, port, OS type, brand, category associations
- **device_models**: Hardware models linked to brands/categories
- **configurations**: Version-controlled config backups with SHA-256 hash for change detection
- **backup_executions**: Audit trail of all backup attempts (success/failure) - supports hybrid storage
- **backup_templates** / **template_steps**: Flexible backup command templates with configurable line_ending
- **backup_schedules** / **schedule_devices** / **schedule_categories**: Automated backup scheduling
- **brands** / **categories**: Device organization
- **audit_logs**: Complete action logging
- **refresh_tokens**: JWT authentication tokens

## Hybrid Backup Storage

The system uses a hybrid approach for backup storage:

- **configurations**: Only stores configs when changes are detected (saves storage)
- **backup_executions**: Records every backup attempt for complete audit trail

| Scenario | Configuration | BackupExecution |
|----------|---------------|-----------------|
| First backup | Created (v1) | Created (config_changed=true) |
| Backup with changes | Created (v+1) | Created (config_changed=true) |
| Backup without changes | NOT created | Created (config_changed=false) |
| Failed backup | NOT created | Created (status=failed) |

## Logging System

All logs are stored in the `logs/` directory with the following structure:

```
logs/
├── app.log           # General application logs
├── api.log           # API request/response logs
├── auth.log          # Authentication events (login, logout, token refresh)
├── backup.log        # Backup execution logs (SSH/Telnet connections, commands)
├── audit.log         # Security audit trail
└── error.log         # Error-only logs for quick debugging
```

Log features:
- Rotation: Daily rotation with 30-day retention
- Format: JSON structured logs with timestamp, level, module, message, context
- Levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
- Request ID tracking for tracing requests across services

## Security Requirements

- Credentials encrypted with AES-256-GCM (format: `v1:aes256gcm:<base64>`)
- Passwords hashed with bcrypt (salt rounds >= 12)
- Roles stored ONLY in user_roles table (never in localStorage or users table)
- JWT with short access tokens (15min) and longer refresh tokens (7 days)
- Owner check middleware on all sensitive routes
- Parameterized queries for SQL injection prevention

## Inactivity Timeout

Frontend implements automatic logout after inactivity:

- **Configuration**: `VITE_INACTIVITY_TIMEOUT_MINUTES` in `.env` (default: 30, 0 to disable)
- **Warning**: Shows dialog 60 seconds before logout
- **Components**: `useInactivityTimeout` hook + `InactivityWarningDialog` component
- **Integration**: AuthContext handles logout and cleanup

## Timezone Configuration

All timestamps use configurable timezone via environment variable:

- **Configuration**: Set `TIMEZONE` in `.env` (default: `America/Sao_Paulo`)
- **Module**: `app/core/timezone.py` provides `now()`, `get_timezone()`, `to_local()`, `to_utc()`
- **Models**: All models import `from app.core.timezone import now` for consistent timestamps
- **Docker**: Container uses `TZ` environment variable and `/etc/localtime` mount

## Backup Templates

Templates support configurable parameters:

- **line_ending**: `\\n` (Unix/Cisco) or `\\r\\n` (MikroTik/Windows) - stored as escaped string
- **prompt_pattern**: Regex to detect command prompt (e.g., `#|>|$`)
- **pagination_pattern**: Regex for "More" prompts (e.g., `--More--|<--- More --->`)
- **output_cleanup_patterns**: Regex patterns to remove from output (one per line)
- **connection_timeout**: Seconds to wait for connection
- **command_timeout**: Seconds to wait for command output
- **use_steps**: Boolean to enable step-based execution vs simple command list

## Supported Network OS Types

cisco_ios, cisco_nxos, juniper_junos, arista_eos, mikrotik_routeros, fortinet_fortios, paloalto_panos, huawei_vrp, other

## User Roles

- **Admin**: Full system access, user management, audit logs
- **Moderator**: Device, template, backup management
- **User**: View devices, execute manual backups on own devices

## API Endpoints

```
# Authentication
POST   /api/auth/register     - User registration
POST   /api/auth/login        - Login (returns access + refresh token)
POST   /api/auth/refresh      - Refresh access token
POST   /api/auth/logout       - Invalidate refresh token

# Users
GET    /api/users/me          - Current user profile
PUT    /api/users/me          - Update profile
GET    /api/admin/users       - List users (admin only)
PUT    /api/admin/users/:id   - Update user role (admin only)

# Devices
GET    /api/devices           - List devices
GET    /api/devices/paginated - List devices with pagination
POST   /api/devices           - Create device
GET    /api/devices/:id       - Get device
PATCH  /api/devices/:id       - Update device
DELETE /api/devices/:id       - Delete device
POST   /api/devices/:id/backup - Execute manual backup
GET    /api/devices/:id/backup/stream - SSE backup with real-time logs

# Configurations
GET    /api/configurations              - List configurations (paginated)
GET    /api/devices/:id/configurations  - Device backup history
GET    /api/configurations/:id          - Get configuration detail
GET    /api/configurations/:id/diff/:id2 - Compare versions

# Backup Executions (audit trail)
GET    /api/backup-executions           - List executions (paginated, filters)
GET    /api/backup-executions/stats     - Statistics (success rate, change rate)
GET    /api/backup-executions/:id       - Get execution detail
GET    /api/backup-executions/device/:id - Device execution history

# Resources
GET    /api/templates         - List templates (+ POST, PUT, DELETE)
GET    /api/credentials       - List credentials (+ POST, PUT, DELETE)
GET    /api/brands            - List brands (+ POST, PUT, DELETE)
GET    /api/categories        - List categories (+ POST, PUT, DELETE)
GET    /api/device-models     - List device models (+ POST, PUT, DELETE)
GET    /api/schedules         - List schedules (+ POST, PUT, DELETE)

# Admin
GET    /api/audit             - Audit logs (admin only)
GET    /api/search?q=term     - Search configurations
GET    /api/health            - Health check
```

## Frontend Routes

- `/auth` - Login/Register
- `/` - Dashboard (stats, recent executions, alerts)
- `/devices` - Device list with filters and bulk actions
- `/devices/:id` - Device details
- `/devices/:id/history` - Device backup history
- `/backups` - All backups list
- `/templates` - Backup templates management
- `/brands` - Brand management
- `/categories` - Category management
- `/device-models` - Device model management
- `/schedules` - Backup scheduling
- `/versions` - Version selection for comparison
- `/diff` - Diff viewer
- `/search` - Configuration search
- `/audit` - Audit logs
- `/admin` - Admin panel (users, credentials, settings, about)

## Key Frontend Components

### Layout
- `LayoutWrapper` - Main layout with sidebar
- `AppSidebar` - Navigation sidebar with collapsible sections

### Pages
- `Dashboard` - Stats cards (executions, success rate, change rate), recent jobs, alerts
- `Devices` - Device CRUD with filters, bulk activate/deactivate
- `BackupTemplates` - Template CRUD with step editor, import/export
- `Admin` - Tabbed admin panel (users, credentials, database, logs, security, settings, about)
- `Auth` - Login/Register form

### Reusable Components
- `DeviceList` - Table with search, filters, bulk actions
- `ConfigDiffViewer` - Side-by-side config comparison
- `TemplateStepEditor` - Advanced template step configuration
- `InactivityWarningDialog` - Logout warning with countdown

### Hooks
- `useDevices` - Device CRUD with React Query
- `useInactivityTimeout` - Tracks user activity for auto-logout

### Contexts
- `AuthContext` - Authentication state, login/logout, inactivity handling

## Template Export Format

```json
{
  "version": "1.0",
  "exported_at": "ISO timestamp",
  "template": { ... template fields ... },
  "steps": [ ... step objects ... ]
}
```

## Environment Variables

### Backend (.env)
```bash
# Application
APP_NAME=Configuard
APP_VERSION=1.0.0
DEBUG=true
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8000

# Database (MariaDB)
DB_HOST=localhost
DB_PORT=3306
DB_USER=configuard
DB_PASSWORD=configuard123
DB_NAME=configuard
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20

# JWT Authentication
JWT_SECRET_KEY=your-secret-key-min-32-characters
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Encryption Key (32 bytes hex = 64 characters)
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# CORS
CORS_ORIGINS_STR=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=INFO
LOG_DIR=logs
LOG_RETENTION_DAYS=30

# Timezone
TIMEZONE=America/Sao_Paulo
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8000/api
VITE_INACTIVITY_TIMEOUT_MINUTES=30
```

## Key Backend Services

- **backup_executor.py**: Executes SSH/Telnet backups, handles pagination, cleans ANSI codes, implements hybrid storage (BackupResult with execution + optional configuration)
- **ssh_client.py**: SSH wrapper with dual-mode (Paramiko primary + pexpect fallback)
- **telnet_client.py**: Pexpect-based Telnet wrapper with multi-pattern login validation
- **encryption.py**: AES-256-GCM encryption for credentials
- **scheduler.py**: APScheduler-based automated backup scheduling
- **jwt.py**: Token creation/verification with configurable expiration
- **auth.py**: Authentication service with login, logout, token refresh
- **diff.py**: Unified diff generation for configuration comparison
- **audit.py**: Audit logging for CRUD operations

## SSH Dual-Mode Architecture

`ssh_client.py` uses Paramiko as primary SSH transport with automatic pexpect fallback for legacy devices:

1. **Paramiko mode** (primary): Direct channel-based SSH with interactive shell. Configures legacy algorithms (ssh-rsa, diffie-hellman-group1-sha1) before attempting connection.
2. **Fallback detection**: Catches exceptions containing markers like "unknown cipher", "no acceptable host key", "no matching cipher", "no matching key exchange" and automatically switches to pexpect.
3. **Pexpect mode** (fallback): Spawns system SSH with full algorithm negotiation (`ssh -Q cipher`), supports legacy ciphers (aes128-cbc, 3des-cbc). Uses regex prompt detection.

Both modes emit `on_event("login_success"|"login_failed", message)` and `on_debug(message)` callbacks.

## Telnet Login Validation

`telnet_client.py` validates login after sending password by expecting multiple patterns:

- Index 0: prompt_pattern (success)
- Index 1-5: Error patterns (login failed, authentication failed, access denied, incorrect, invalid)
- Index 6: Login prompt reappearing (credentials rejected)

Emits `on_event("login_success"|"login_failed", message)` callbacks.

## Backup Step Execution

When `use_steps=true`, the executor processes template steps sequentially:

| Step Type     | Behavior |
| ------------- | -------- |
| `command` | Send command, wait for prompt (supports `expect_pattern` override), optionally capture output |
| `expect` | Wait for pattern without sending anything (`line_ending=""`), optionally capture output |
| `pause` | Sleep for `timeout` seconds |
| `set_prompt` | Dynamically change `prompt_pattern` mid-execution |
| `send_key` | Send special key (enter, space, tab, escape, ctrl+c, ctrl+z) with optional delay |
| `conditional` | Execute based on `condition` evaluated against `variables` dict |

Steps support: `on_failure` (stop/continue/retry), `max_retries`, `capture_output`, `variable_name` for variable capture.

## SSE Backup Streaming

Endpoint: `GET /api/devices/{id}/backup/stream?token=...&log_level=info|verbose|debug`

**Architecture (Queue + Thread):**
- Daemon thread runs `execute_backup()` with its own DB session (thread-local)
- Events serialized as `event: {type}\ndata: {json}\n\n` into a `Queue[str | None]`
- Generator yields queued items until `None` sentinel signals completion
- Authentication via query param token or Authorization header

**Event types emitted:**
- `status` - State transitions (connecting, executing, saving)
- `command` - Command sent with timeout metadata
- `output` - Raw device output chunks (via `on_data` callback)
- `verbose` - Template details, pattern matching info
- `debug` - SSH/Telnet communication details (conditional on log_level)
- `error` - Exceptions and login failures
- `done` - Completion with `config_changed` flag

## Config Output Cleanup Pipeline

`_clean_output()` in `backup_executor.py` processes raw device output in order:

1. Strip ANSI escape codes (terminal colors/controls)
2. Normalize line endings (`\r\n` and `\r` → `\n`)
3. Right-strip whitespace per line
4. Remove leading/trailing blank lines
5. Remove prompt-only lines at output boundaries
6. Remove command echo lines (lines starting with `/`, length < 50)
7. Apply custom regex patterns from `template.output_cleanup_patterns` (one per line, matches from start of output)

## Middleware Stack

Registered in `main.py` (reverse execution order):
1. **CORSMiddleware** - Standard CORS configuration
2. **RequestLoggingMiddleware** - Generates 8-char UUID request ID, logs method/path/duration/status, adds `X-Request-ID` response header

Note: `AuditLoggingMiddleware` exists in `app/middleware/audit.py` but is **not currently registered**.

## Key Backend Models

- **BackupExecution**: Records every backup attempt (success/failure) with timing, method, and optional configuration reference
- **Configuration**: Stores actual config content only when changes detected
- **Device**: Network device with relationships to brand, category, model, credential, template
- **BackupTemplate**: Flexible command templates with steps support
- **BackupSchedule**: Cron-based scheduling with device and category associations

## Database Migrations

SQL files in `db/init/` are applied in order:
1. `001_schema.sql` - Core schema
2. `002_seed.sql` - Initial data (admin user, default brands/templates)
3. `003_device_models.sql` - Device model support
4. `004_schedule_categories.sql` - Schedule-category relationships
5. `005_device_model_id.sql` - Device model foreign key
6. `006_backup_executions.sql` - Backup execution audit table
