# Configuard

> Network device configuration backup, versioning and search — because "I saved it, I swear" is not a valid backup strategy.

Configuard is a self-hosted web application for centralized management of network device configurations. It collects, organizes, versions and schedules backups of routers, switches, firewalls and any device accessible via SSH or Telnet.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [Docker (recommended)](#docker-recommended)
  - [Local development](#local-development)
- [Configuration](#configuration)
- [Database migrations](#database-migrations)
- [User roles](#user-roles)
- [Backup templates](#backup-templates)
- [Schedules](#schedules)
- [Search](#search)
- [Scripts reference](#scripts-reference)
- [Project structure](#project-structure)
- [API](#api)
- [Security notes](#security-notes)
- [Contributing](#contributing)
- [Português](#português)

---

## Features

| Area | What it does |
| --- | --- |
| **Device inventory** | Register devices with IP, port, OS type, brand, model and category |
| **Credentials** | Encrypted SSH/Telnet credentials (AES-256-GCM), shared across devices |
| **Backup templates** | Vendor-specific command sequences with prompt detection, pagination and output cleanup |
| **SSH / Telnet** | Dual-mode SSH (Paramiko + pexpect fallback for legacy devices), Telnet via pexpect |
| **Versioning** | Every changed backup creates a new version; unchanged configs are not stored again |
| **Diff viewer** | Side-by-side unified diff between any two versions |
| **Schedules** | Daily, weekly, monthly or arbitrary cron expressions; per-device or per-category |
| **Global search** | Full-text search using PostgreSQL FTS (GIN index); supports partial IPs, CIDR, regex |
| **Dashboard** | Success rate, change rate, recent backup jobs, alerts for failed or disabled devices |
| **Audit logs** | Every CRUD action is logged with user, timestamp and affected record |
| **Email notifications** | SMTP alerts on backup success or failure; configurable per event type |
| **LDAP / Active Directory** | Optional LDAP authentication alongside local accounts |
| **Multi-language UI** | Portuguese (pt-BR) and English (en); toggle in the Admin panel |
| **Inactivity timeout** | Automatic logout after configurable idle period |
| **Role-based access** | Admin, Moderator and User roles with granular permissions |

---

## Architecture

```text
┌─────────────────────┐     HTTP / nginx      ┌──────────────────────┐
│   Browser (React)   │ ────────────────────▶ │  nginx  (port 8080)  │
│  Vite + TypeScript  │                       │  SPA + /api proxy    │
└─────────────────────┘                       └──────────┬───────────┘
                                                         │ /api/*
                                              ┌──────────▼───────────┐
                                              │  FastAPI (port 8000)  │
                                              │  SQLAlchemy + Pydantic│
                                              │  APScheduler          │
                                              │  Paramiko / pexpect   │
                                              └──────────┬───────────┘
                                                         │
                                              ┌──────────▼───────────┐
                                              │   PostgreSQL 16       │
                                              │  (Docker container)   │
                                              └──────────────────────┘
```

### Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI), React Query, react-i18next |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, Loguru |
| Scheduler | APScheduler |
| SSH | Paramiko (primary) + pexpect (fallback for legacy devices) |
| Telnet | pexpect |
| Database | PostgreSQL 16 |
| Auth | JWT (access 15 min + refresh 7 days), bcrypt, AES-256-GCM for credentials |
| LDAP | ldap3 |
| Email | smtplib (Python standard library) |
| Containers | Docker Compose |

---

## Requirements

### Docker mode (recommended)

- Docker Engine 24+
- Docker Compose v2
- Node.js 18+ and npm *(only needed to rebuild the frontend after code changes)*

### Local development mode

- Docker *(for PostgreSQL)*
- Python 3.12+
- Node.js 18+ and npm

---

## Quick Start

### Docker (recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/configuard.git
cd configuard

# 2. Start everything
#    Builds images, starts containers, applies migrations and seeds initial data
docker compose up -d --build

# 3. Open the browser
#    Frontend:  http://localhost:8080
#    API docs:  http://localhost:8000/api/docs
```

Default credentials — **change immediately in production:**

| Field | Value |
| --- | --- |
| Email | `admin@configuard.com` |
| Password | `Admin@123` |

Stop all containers:

```bash
docker compose down
```

Rebuild after code changes:

```bash
./scripts/reload.sh            # full rebuild: frontend build + restart containers
./scripts/reload.sh frontend   # frontend only (npm run build + nginx reload)
./scripts/reload.sh backend    # backend only (picks up new Python dependencies)
```

> The backend container runs `uvicorn --reload`, so Python code changes are picked up automatically without a restart. Use `reload.sh backend` only when you add/remove Python dependencies.

---

### Local development

Useful when you want live hot-reload for both frontend and backend without rebuilding Docker images.

```bash
# 1. Start only the database
docker compose up -d postgresql

# 2. Backend (new terminal)
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # edit DB_HOST=localhost and secrets
uvicorn main:app --reload --port 8000

# 3. Frontend (new terminal)
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev                 # http://localhost:5173
```

Alternatively, the helper script automates all of the above:

```bash
./scripts/start.sh all        # starts db + backend + frontend
./scripts/start.sh frontend   # frontend only
./scripts/stop.sh all
./scripts/status.sh
```

---

## Configuration

### Backend — `backend/.env`

```bash
# Application
APP_NAME=Configuard
DEBUG=false                          # true → verbose SSH/Telnet session logs
ENVIRONMENT=production

# Server
HOST=0.0.0.0
PORT=8000

# Database (PostgreSQL)
DB_HOST=postgresql                   # service name in docker-compose; use localhost for local dev
DB_PORT=5432
DB_USER=configuard
DB_PASSWORD=configuard123            # change in production
DB_NAME=configuard

# JWT — MUST be changed in production
JWT_SECRET_KEY=your-secret-key-min-32-characters
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Encryption key for stored credentials (64 hex chars = 32 bytes)
# Generate with: python -c "import secrets; print(secrets.token_hex(32))"
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# CORS (comma-separated; in Docker mode the nginx proxy handles this)
CORS_ORIGINS_STR=http://localhost:5173,http://localhost:8080

# Timezone — affects all stored timestamps
TIMEZONE=America/Sao_Paulo

# Logging
LOG_LEVEL=INFO
LOG_DIR=logs
LOG_RETENTION_DAYS=30
```

### Frontend — `frontend/.env`

```bash
# Development (direct to backend)
VITE_API_URL=http://localhost:8000/api

# Docker mode (nginx proxy — already set in frontend/.env.production)
# VITE_API_URL=/api

# Auto-logout after N minutes of inactivity (0 to disable)
VITE_INACTIVITY_TIMEOUT_MINUTES=30
```

> In Docker mode, `frontend/.env.production` already sets `VITE_API_URL=/api`. You do not need to change it.

---

## Database migrations

SQL migration files live in `db/init/` and are applied automatically in numerical order when the PostgreSQL container starts for the first time.

To apply a new migration to an already-running container:

```bash
docker compose exec -T postgresql psql -U configuard -d configuard \
  < db/init/NNN_migration_name.sql
```

| File | Description |
| --- | --- |
| `001_schema.sql` | Core schema (users, devices, credentials, configurations, templates) |
| `002_seed.sql` | Initial data: admin user, default brands and templates |
| `003_device_models.sql` | Hardware model support |
| `004_schedule_categories.sql` | Schedule ↔ category many-to-many |
| `005_device_model_id.sql` | Foreign key device → device_model |
| `006_backup_executions.sql` | Backup execution audit table (hybrid storage) |
| `007_email_settings.sql` | SMTP / email notification settings |
| `008_ldap_settings.sql` | LDAP / Active Directory integration settings |
| `009_remove_unused_columns.sql` | Drop columns never used by the UI |
| `010_remove_category_template_fk.sql` | Remove legacy backup_template_id from categories |

---

## User roles

| Role | Capabilities |
| --- | --- |
| **Admin** | Full access: user management, audit logs, system settings, LDAP, email, database stats |
| **Moderator** | Devices, templates, credentials, brands, categories, schedules, backups |
| **User** | View devices; execute manual backups on devices they own |

Role assignment is done in **Admin → Users**.

---

## Backup templates

A template defines how Configuard connects to a device and what commands to run to collect its configuration.

### Key settings

| Setting | Description |
| --- | --- |
| `prompt_pattern` | Regex to detect the device shell prompt (e.g. `[#>$]`) |
| `login_prompt` | String to wait for during the login sequence |
| `password_prompt` | String to wait for when the device asks for the password |
| `pagination_pattern` | Regex for "press space for more" prompts (e.g. `--More--`) |
| `line_ending` | `\n` for Cisco/Linux devices; `\r\n` for MikroTik/Windows |
| `use_steps` | Enable step-based execution (advanced mode) |
| `output_cleanup_patterns` | Regex patterns (one per line) to strip from the final output |
| `connection_timeout` | Seconds to wait for the SSH/Telnet connection |
| `command_timeout` | Seconds to wait for each command response |

### Step types (advanced mode — `use_steps = true`)

| Type | Behavior |
| --- | --- |
| `command` | Send a command, wait for the prompt (or a custom `expect_pattern`) |
| `expect` | Wait for a pattern without sending anything |
| `pause` | Sleep for N seconds |
| `set_prompt` | Change the active prompt pattern mid-session |
| `send_key` | Send a special key: `enter`, `space`, `tab`, `escape`, `ctrl+c`, `ctrl+z` |
| `conditional` | Execute the step only if a captured variable matches a condition |

Steps support `on_failure` (`stop` / `continue` / `retry`), `max_retries`, `capture_output` and `variable_name` for storing output into variables used by later conditional steps.

Templates can be **exported and imported** as JSON files — useful for sharing between environments or teams.

---

## Schedules

Schedules run backups automatically against a set of devices or entire categories.

- **Frequencies:** hourly, daily, weekly, monthly, or a custom cron expression
- **Targets:** individual devices, all devices in one or more categories, or both
- **On failure:** email notification sent if SMTP is configured
- **History:** every execution is recorded in the backup executions table (success, failure, config changed or unchanged)

Enable or disable a schedule at any time without deleting it.

---

## Search

The search page performs full-text search across all stored configuration snapshots.

### Search modes

| Mode | How it works |
| --- | --- |
| Default | PostgreSQL `plainto_tsquery` with GIN index — fast, ranked results |
| Partial token | Automatic `ILIKE` fallback for partial IPs (e.g. `192.168`) and CIDR prefixes |
| **Regex** | PostgreSQL `~*` operator (case-insensitive); enable with the Regex toggle |

### Filters

| Filter | Description |
| --- | --- |
| Device | Restrict to one or more specific devices |
| Category | Restrict to all devices in a category |
| Period | Last 7, 30, 90 days or one year |
| Latest only | Search only the most recent version per device (faster, less noise) |

Results display matched lines with syntax highlighting and links to the device page and full version history.

> **Tip:** The search input accepts regular expressions when the **Regex** toggle is on. Example: `interface GigabitEthernet\d+`

---

## Scripts reference

All scripts live in `scripts/` and are run from the project root.

| Command | Description |
| --- | --- |
| `./scripts/start.sh [all\ | db\ | backend\ | frontend]` | Start services in local dev mode |
| `./scripts/stop.sh [all\ | db\ | backend\ | frontend]` | Stop local dev services |
| `./scripts/status.sh` | Show running status and URLs |
| `./scripts/reload.sh [all\ | frontend\ | backend]` | Rebuild and reload in Docker container mode |

---

## Project structure

```text
configuard/
├── frontend/                      # React application
│   ├── src/
│   │   ├── components/            # Reusable UI components
│   │   │   └── admin/             # Admin panel sub-components
│   │   ├── pages/                 # Route-level pages
│   │   ├── services/              # API calls (axios)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── contexts/              # Auth context
│   │   ├── locales/               # i18n translation files
│   │   │   ├── pt-BR/             # Portuguese strings
│   │   │   └── en/                # English strings
│   │   └── i18n/                  # i18next configuration
│   ├── Dockerfile                 # nginx:alpine serving dist/
│   └── nginx.conf                 # SPA routing + /api proxy to backend
│
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── api/routes/            # Route handlers
│   │   ├── models/                # SQLAlchemy ORM models
│   │   ├── schemas/               # Pydantic request / response schemas
│   │   ├── services/
│   │   │   ├── backup_executor.py # SSH/Telnet execution engine
│   │   │   ├── ssh_client.py      # Paramiko + pexpect dual-mode SSH
│   │   │   ├── telnet_client.py   # pexpect Telnet client
│   │   │   ├── scheduler.py       # APScheduler job management
│   │   │   ├── email.py           # SMTP notification service
│   │   │   ├── ldap_service.py    # LDAP / AD authentication
│   │   │   └── encryption.py      # AES-256-GCM credential encryption
│   │   └── core/                  # Config, DB session, deps, logging, timezone
│   ├── logs/                      # Log files (rotated daily, 30-day retention)
│   ├── main.py                    # FastAPI app entry point
│   ├── Dockerfile
│   └── requirements.txt
│
├── db/
│   ├── docker-compose.yml         # Standalone PostgreSQL (for local dev)
│   ├── init/                      # SQL migration files (001–010)
│   └── data/                      # Persistent PostgreSQL data (gitignored)
│
├── scripts/                       # Helper shell scripts
├── docker-compose.yml             # Full stack: postgresql + backend + frontend
└── README.md
```

---

## API

Interactive API documentation:

- **Swagger UI:** `http://localhost:8000/api/docs`
- **ReDoc:** `http://localhost:8000/api/redoc`

All protected endpoints require `Authorization: Bearer <access_token>`.

### Key endpoint groups

| Endpoint | Description |
| --- | --- |
| `POST /api/auth/login` | Login — returns access token + refresh token |
| `POST /api/auth/refresh` | Refresh the access token |
| `POST /api/auth/logout` | Invalidate the refresh token |
| `GET /api/devices` | List devices (with pagination and filters) |
| `POST /api/devices/{id}/backup` | Trigger a manual backup |
| `GET /api/devices/{id}/backup/stream` | SSE stream with real-time backup logs |
| `GET /api/configurations/{id}/diff/{id2}` | Unified diff between two versions |
| `GET /api/backup-executions` | Paginated backup execution history |
| `GET /api/backup-executions/stats` | Success rate and change rate statistics |
| `GET /api/search?q=term` | Full-text search across all configurations |
| `GET /api/audit` | Audit log — admin only |
| `GET/PATCH /api/admin/settings/email` | Email notification settings |
| `GET/PATCH /api/admin/settings/ldap` | LDAP / AD settings |
| `GET /api/health` | Health check |

---

## Security notes

- **Credentials** are encrypted with AES-256-GCM before storage. The `ENCRYPTION_KEY` in `backend/.env` must be kept secret and backed up — losing it means losing access to all stored credentials.
- **JWT secret** (`JWT_SECRET_KEY`) must be at least 32 characters and changed from the example value before any production deployment.
- **Default admin password** (`Admin@123`) must be changed immediately after the first login.
- **LDAP bind password** is also stored encrypted with the same key.
- **Roles** are stored only in the `user_roles` table — never in JWT tokens or `localStorage`.
- All SQL queries use parameterized statements; user input is never interpolated into raw SQL.
- CORS is restricted to the origins defined in `CORS_ORIGINS_STR`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes following [Conventional Commits](https://www.conventionalcommits.org/)
4. Open a pull request describing what changed and why

Bug reports and feature requests are welcome via [Issues](../../issues).

---

> *If a backup failed, it's the network's fault until proven otherwise.*
> *If the diff is huge, breathe and hunt for the `+` lines.*
> *Do not confuse "backup" with "hope".*

---

## Português

> Backup de configuração de rede com versionamento, diff e busca — porque "eu salvei, juro" não é estratégia de backup.

O Configuard é uma aplicação web auto-hospedada para gerenciamento centralizado de configurações de dispositivos de rede. Ele coleta, organiza, versiona e agenda backups de roteadores, switches, firewalls e qualquer dispositivo acessível via SSH ou Telnet.

---

### Índice

- [Recursos](#recursos)
- [Arquitetura](#arquitetura)
- [Requisitos](#requisitos)
- [Início rápido](#início-rápido)
  - [Docker (recomendado)](#docker-recomendado)
  - [Desenvolvimento local](#desenvolvimento-local)
- [Configuração](#configuração)
- [Migrações de banco de dados](#migrações-de-banco-de-dados)
- [Papéis de usuário](#papéis-de-usuário)
- [Templates de backup](#templates-de-backup)
- [Agendamentos](#agendamentos)
- [Busca](#busca)
- [Referência dos scripts](#referência-dos-scripts)
- [Estrutura do projeto](#estrutura-do-projeto)
- [API](#api-1)
- [Segurança](#segurança)
- [Contribuindo](#contribuindo)

---

### Recursos

| Área | O que faz |
| --- | --- |
| **Inventário de dispositivos** | Cadastro com IP, porta, tipo de OS, marca, modelo e categoria |
| **Credenciais** | Credenciais SSH/Telnet criptografadas (AES-256-GCM), compartilhadas entre dispositivos |
| **Templates de backup** | Sequências de comandos por fabricante com detecção de prompt, paginação e limpeza de saída |
| **SSH / Telnet** | SSH dual-mode (Paramiko + pexpect para dispositivos legados), Telnet via pexpect |
| **Versionamento** | Cada backup com mudança gera uma nova versão; configs sem alteração não são re-armazenadas |
| **Diff** | Comparação lado a lado entre quaisquer duas versões |
| **Agendamentos** | Diário, semanal, mensal ou cron customizado; por dispositivo ou por categoria |
| **Busca global** | Full-text search em todas as configurações (GIN index); suporte a IPs parciais, CIDR e regex |
| **Dashboard** | Taxa de sucesso, taxa de mudança, jobs recentes e alertas |
| **Auditoria** | Toda ação CRUD é registrada com usuário, timestamp e registro afetado |
| **Notificações por email** | Alertas SMTP em sucesso ou falha de backup; configurável por tipo de evento |
| **LDAP / Active Directory** | Autenticação LDAP opcional ao lado de contas locais |
| **Interface multi-idioma** | Português (pt-BR) e Inglês (en); alternável no painel Admin |
| **Timeout de inatividade** | Logout automático após período de inatividade configurável |
| **Controle de acesso** | Papéis Admin, Moderador e Usuário com permissões granulares |

---

### Arquitetura

```text
┌─────────────────────┐     HTTP / nginx      ┌──────────────────────┐
│   Navegador (React) │ ────────────────────▶ │  nginx  (porta 8080) │
│  Vite + TypeScript  │                       │  SPA + proxy /api    │
└─────────────────────┘                       └──────────┬───────────┘
                                                         │ /api/*
                                              ┌──────────▼───────────┐
                                              │  FastAPI (porta 8000) │
                                              │  SQLAlchemy + Pydantic│
                                              │  APScheduler          │
                                              │  Paramiko / pexpect   │
                                              └──────────┬───────────┘
                                                         │
                                              ┌──────────▼───────────┐
                                              │   PostgreSQL 16       │
                                              │  (container Docker)   │
                                              └──────────────────────┘
```

#### Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix UI), React Query, react-i18next |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic v2, Loguru |
| Agendador | APScheduler |
| SSH | Paramiko (primário) + pexpect (fallback para dispositivos legados) |
| Telnet | pexpect |
| Banco de dados | PostgreSQL 16 |
| Autenticação | JWT (access 15 min + refresh 7 dias), bcrypt, AES-256-GCM para credenciais |
| LDAP | ldap3 |
| Email | smtplib (biblioteca padrão do Python) |
| Containers | Docker Compose |

---

### Requisitos

#### Modo Docker (recomendado)

- Docker Engine 24+
- Docker Compose v2
- Node.js 18+ e npm *(apenas para rebuild do frontend após mudanças no código)*

#### Modo desenvolvimento local

- Docker *(para o PostgreSQL)*
- Python 3.12+
- Node.js 18+ e npm

---

### Início rápido

#### Docker (recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/your-org/configuard.git
cd configuard

# 2. Suba tudo
#    Constrói imagens, inicia containers, aplica migrações e popula dados iniciais
docker compose up -d --build

# 3. Abra no navegador
#    Frontend:  http://localhost:8080
#    API docs:  http://localhost:8000/api/docs
```

Credenciais padrão — **altere imediatamente em produção:**

| Campo | Valor |
| --- | --- |
| Email | `admin@configuard.com` |
| Senha | `Admin@123` |

Parar todos os containers:

```bash
docker compose down
```

Rebuild após mudanças no código:

```bash
./scripts/reload.sh            # rebuild completo: frontend build + restart dos containers
./scripts/reload.sh frontend   # só frontend (npm run build + nginx reload)
./scripts/reload.sh backend    # só backend (necessário ao adicionar dependências Python)
```

> O container do backend roda `uvicorn --reload`, então mudanças no código Python são detectadas automaticamente sem reiniciar. Use `reload.sh backend` apenas ao adicionar/remover dependências Python.

---

#### Desenvolvimento local

Útil quando você quer hot-reload ao vivo no frontend e backend sem rebuild das imagens Docker.

```bash
# 1. Sobe só o banco de dados
docker compose up -d postgresql

# 2. Backend (novo terminal)
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # edite DB_HOST=localhost e os segredos
uvicorn main:app --reload --port 8000

# 3. Frontend (novo terminal)
cd frontend
npm install
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api
npm run dev                 # http://localhost:5173
```

Alternativamente, o script auxiliar automatiza tudo isso:

```bash
./scripts/start.sh all        # inicia db + backend + frontend
./scripts/start.sh frontend   # só frontend
./scripts/stop.sh all
./scripts/status.sh
```

---

### Configuração

#### Backend — `backend/.env`

```bash
# Aplicação
APP_NAME=Configuard
DEBUG=false                          # true → logs detalhados da sessão SSH/Telnet
ENVIRONMENT=production

# Servidor
HOST=0.0.0.0
PORT=8000

# Banco de dados (PostgreSQL)
DB_HOST=postgresql                   # nome do serviço no docker-compose; use localhost para dev local
DB_PORT=5432
DB_USER=configuard
DB_PASSWORD=configuard123            # altere em produção
DB_NAME=configuard

# JWT — DEVE ser alterado em produção
JWT_SECRET_KEY=sua-chave-secreta-minimo-32-caracteres
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# Chave de criptografia para credenciais armazenadas (64 hex chars = 32 bytes)
# Gerar com: python -c "import secrets; print(secrets.token_hex(32))"
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# CORS (separado por vírgula; no modo Docker o proxy nginx cuida disso)
CORS_ORIGINS_STR=http://localhost:5173,http://localhost:8080

# Fuso horário — afeta todos os timestamps armazenados
TIMEZONE=America/Sao_Paulo

# Logs
LOG_LEVEL=INFO
LOG_DIR=logs
LOG_RETENTION_DAYS=30
```

#### Frontend — `frontend/.env`

```bash
# Desenvolvimento (direto ao backend)
VITE_API_URL=http://localhost:8000/api

# Modo Docker (proxy nginx — já definido em frontend/.env.production)
# VITE_API_URL=/api

# Logout automático após N minutos de inatividade (0 para desativar)
VITE_INACTIVITY_TIMEOUT_MINUTES=30
```

> No modo Docker, `frontend/.env.production` já define `VITE_API_URL=/api`. Não é necessário alterar.

---

### Migrações de banco de dados

Os arquivos de migração SQL ficam em `db/init/` e são aplicados automaticamente em ordem numérica quando o container PostgreSQL inicia pela primeira vez.

Para aplicar uma nova migração em um container já em execução:

```bash
docker compose exec -T postgresql psql -U configuard -d configuard \
  < db/init/NNN_nome_da_migracao.sql
```

| Arquivo | Descrição |
| --- | --- |
| `001_schema.sql` | Schema principal (usuários, dispositivos, credenciais, configurações, templates) |
| `002_seed.sql` | Dados iniciais: usuário admin, marcas e templates padrão |
| `003_device_models.sql` | Suporte a modelos de hardware |
| `004_schedule_categories.sql` | Relação muitos-para-muitos agendamento ↔ categoria |
| `005_device_model_id.sql` | Chave estrangeira dispositivo → modelo de dispositivo |
| `006_backup_executions.sql` | Tabela de auditoria de execuções de backup (armazenamento híbrido) |
| `007_email_settings.sql` | Configurações de notificação por email / SMTP |
| `008_ldap_settings.sql` | Configurações de integração LDAP / Active Directory |
| `009_remove_unused_columns.sql` | Remove colunas nunca usadas pela interface |
| `010_remove_category_template_fk.sql` | Remove backup_template_id legado das categorias |

---

### Papéis de usuário

| Papel | Permissões |
| --- | --- |
| **Admin** | Acesso total: gestão de usuários, auditoria, configurações do sistema, LDAP, email, stats do banco |
| **Moderador** | Dispositivos, templates, credenciais, marcas, categorias, agendamentos, backups |
| **Usuário** | Visualizar dispositivos; executar backups manuais nos próprios dispositivos |

A atribuição de papéis é feita em **Admin → Usuários**.

---

### Templates de backup

Um template define como o Configuard se conecta a um dispositivo e quais comandos executar para coletar a configuração.

#### Configurações principais

| Configuração | Descrição |
| --- | --- |
| `prompt_pattern` | Regex para detectar o prompt do dispositivo (ex: `[#>$]`) |
| `login_prompt` | String a aguardar durante a sequência de login |
| `password_prompt` | String a aguardar quando o dispositivo pede a senha |
| `pagination_pattern` | Regex para prompts de paginação (ex: `--More--`) |
| `line_ending` | `\n` para Cisco/Linux; `\r\n` para MikroTik/Windows |
| `use_steps` | Ativa execução por etapas (modo avançado) |
| `output_cleanup_patterns` | Padrões regex (um por linha) para remover da saída final |
| `connection_timeout` | Segundos para aguardar a conexão SSH/Telnet |
| `command_timeout` | Segundos para aguardar a resposta de cada comando |

#### Tipos de etapa (modo avançado — `use_steps = true`)

| Tipo | Comportamento |
| --- | --- |
| `command` | Envia um comando e aguarda o prompt (ou um `expect_pattern` customizado) |
| `expect` | Aguarda um padrão sem enviar nada |
| `pause` | Dorme por N segundos |
| `set_prompt` | Altera o padrão de prompt durante a sessão |
| `send_key` | Envia uma tecla especial: `enter`, `space`, `tab`, `escape`, `ctrl+c`, `ctrl+z` |
| `conditional` | Executa a etapa apenas se uma variável capturada corresponder a uma condição |

As etapas suportam `on_failure` (`stop` / `continue` / `retry`), `max_retries`, `capture_output` e `variable_name` para armazenar a saída em variáveis usadas por etapas condicionais posteriores.

Templates podem ser **exportados e importados** como arquivos JSON — útil para compartilhar entre ambientes ou equipes.

---

### Agendamentos

Os agendamentos executam backups automaticamente em um conjunto de dispositivos ou categorias inteiras.

- **Frequências:** horária, diária, semanal, mensal ou expressão cron customizada
- **Alvos:** dispositivos individuais, todos os dispositivos de uma ou mais categorias, ou ambos
- **Em caso de falha:** notificação por email enviada se o SMTP estiver configurado
- **Histórico:** toda execução é registrada na tabela de execuções de backup (sucesso, falha, config alterada ou inalterada)

Ative ou desative um agendamento a qualquer momento sem excluí-lo.

---

### Busca

A tela de busca realiza full-text search em todos os snapshots de configuração armazenados.

#### Modos de busca

| Modo | Como funciona |
| --- | --- |
| Padrão | PostgreSQL `plainto_tsquery` com índice GIN — resultados rápidos e ranqueados |
| Token parcial | Fallback automático para `ILIKE` em IPs parciais (ex: `192.168`) e prefixos CIDR |
| **Regex** | Operador `~*` do PostgreSQL (case-insensitive); ative com o botão Regex |

#### Filtros

| Filtro | Descrição |
| --- | --- |
| Dispositivo | Restringir a um ou mais dispositivos específicos |
| Categoria | Restringir a todos os dispositivos de uma categoria |
| Período | Últimos 7, 30, 90 dias ou um ano |
| Versão atual | Buscar apenas na versão mais recente por dispositivo (mais rápido, menos ruído) |

Os resultados exibem as linhas correspondentes com destaque de sintaxe e links para a página do dispositivo e o histórico completo de versões.

> **Dica:** O campo de busca aceita expressões regulares quando o botão **Regex** está ativo. Exemplo: `interface GigabitEthernet\d+`

---

### Referência dos scripts

Todos os scripts ficam em `scripts/` e são executados a partir da raiz do projeto.

| Comando | Descrição |
| --- | --- |
| `./scripts/start.sh [all\|db\|backend\|frontend]` | Inicia os serviços em modo dev local |
| `./scripts/stop.sh [all\|db\|backend\|frontend]` | Para os serviços em modo dev local |
| `./scripts/status.sh` | Exibe o status dos serviços e as URLs |
| `./scripts/reload.sh [all\|frontend\|backend]` | Rebuild e reload no modo container Docker |

---

### Estrutura do projeto

```text
configuard/
├── frontend/                      # Aplicação React
│   ├── src/
│   │   ├── components/            # Componentes de UI reutilizáveis
│   │   │   └── admin/             # Sub-componentes do painel Admin
│   │   ├── pages/                 # Páginas por rota
│   │   ├── services/              # Chamadas de API (axios)
│   │   ├── hooks/                 # Custom React hooks
│   │   ├── contexts/              # Auth context
│   │   ├── locales/               # Arquivos de tradução i18n
│   │   │   ├── pt-BR/             # Strings em português
│   │   │   └── en/                # Strings em inglês
│   │   └── i18n/                  # Configuração do i18next
│   ├── Dockerfile                 # nginx:alpine servindo dist/
│   └── nginx.conf                 # Roteamento SPA + proxy /api para o backend
│
├── backend/                       # Aplicação FastAPI
│   ├── app/
│   │   ├── api/routes/            # Handlers de rotas
│   │   ├── models/                # Modelos ORM SQLAlchemy
│   │   ├── schemas/               # Schemas Pydantic (request / response)
│   │   ├── services/
│   │   │   ├── backup_executor.py # Motor de execução SSH/Telnet
│   │   │   ├── ssh_client.py      # SSH dual-mode Paramiko + pexpect
│   │   │   ├── telnet_client.py   # Cliente Telnet pexpect
│   │   │   ├── scheduler.py       # Gerenciamento de jobs APScheduler
│   │   │   ├── email.py           # Serviço de notificação SMTP
│   │   │   ├── ldap_service.py    # Autenticação LDAP / AD
│   │   │   └── encryption.py      # Criptografia AES-256-GCM
│   │   └── core/                  # Config, sessão DB, deps, logging, timezone
│   ├── logs/                      # Arquivos de log (rotação diária, retenção 30 dias)
│   ├── main.py                    # Ponto de entrada FastAPI
│   ├── Dockerfile
│   └── requirements.txt
│
├── db/
│   ├── docker-compose.yml         # PostgreSQL standalone (para dev local)
│   ├── init/                      # Arquivos de migração SQL (001–010)
│   └── data/                      # Dados persistentes do PostgreSQL (gitignored)
│
├── scripts/                       # Scripts shell auxiliares
├── docker-compose.yml             # Stack completa: postgresql + backend + frontend
└── README.md
```

---

### API

Documentação interativa da API:

- **Swagger UI:** `http://localhost:8000/api/docs`
- **ReDoc:** `http://localhost:8000/api/redoc`

Todos os endpoints protegidos exigem `Authorization: Bearer <access_token>`.

#### Principais grupos de endpoints

| Endpoint | Descrição |
| --- | --- |
| `POST /api/auth/login` | Login — retorna access token + refresh token |
| `POST /api/auth/refresh` | Renova o access token |
| `POST /api/auth/logout` | Invalida o refresh token |
| `GET /api/devices` | Lista dispositivos (com paginação e filtros) |
| `POST /api/devices/{id}/backup` | Dispara um backup manual |
| `GET /api/devices/{id}/backup/stream` | Stream SSE com logs do backup em tempo real |
| `GET /api/configurations/{id}/diff/{id2}` | Diff unificado entre duas versões |
| `GET /api/backup-executions` | Histórico paginado de execuções de backup |
| `GET /api/backup-executions/stats` | Taxa de sucesso e taxa de mudança |
| `GET /api/search?q=termo` | Full-text search em todas as configurações |
| `GET /api/audit` | Log de auditoria — somente admin |
| `GET/PATCH /api/admin/settings/email` | Configurações de notificação por email |
| `GET/PATCH /api/admin/settings/ldap` | Configurações LDAP / AD |
| `GET /api/health` | Health check |

---

### Segurança

- **Credenciais** são criptografadas com AES-256-GCM antes do armazenamento. A `ENCRYPTION_KEY` em `backend/.env` deve ser mantida em segredo e ter backup — perdê-la significa perder o acesso a todas as credenciais armazenadas.
- **Segredo JWT** (`JWT_SECRET_KEY`) deve ter pelo menos 32 caracteres e ser alterado do valor de exemplo antes de qualquer deploy em produção.
- **Senha padrão do admin** (`Admin@123`) deve ser alterada imediatamente após o primeiro login.
- **Senha de bind LDAP** também é armazenada criptografada com a mesma chave.
- **Papéis** são armazenados apenas na tabela `user_roles` — nunca em tokens JWT ou `localStorage`.
- Todas as queries SQL usam statements parametrizados; entradas do usuário nunca são interpoladas em SQL cru.
- CORS é restrito às origens definidas em `CORS_ORIGINS_STR`.

---

### Contribuindo

1. Faça um fork do repositório
2. Crie uma branch de feature: `git checkout -b feature/minha-feature`
3. Faça commit das suas mudanças seguindo [Conventional Commits](https://www.conventionalcommits.org/)
4. Abra um pull request descrevendo o que mudou e por quê

Reportes de bugs e solicitações de features são bem-vindos via [Issues](../../issues).

---

> *Se um backup falhou, a culpa é da rede até que se prove o contrário.*
> *Se o diff ficou grande, respire fundo e procure as linhas com `+`.*
> *Não confunda "backup" com "torcer para dar certo".*
