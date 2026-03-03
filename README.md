# Configuard

Configuard is a self-hosted web application for centralized management of network device configurations. It collects, organizes, versions and schedules backups of routers, switches, firewalls and any device accessible via SSH or Telnet.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick Start](#quick-start)
  - [Docker (recommended)](#docker-recommended)
  - [Local development](#local-development)
- [Configuration](#configuration)
- [User roles](#user-roles)
- [Backup templates](#backup-templates)
- [Schedules](#schedules)
- [Search](#search)
- [Scripts reference](#scripts-reference)
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
git clone https://github.com/thiagoe/configuard.git
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
| `./scripts/start.sh [all\|db\|backend\|frontend]` | Start services in local dev mode |
| `./scripts/stop.sh [all\|db\|backend\|frontend]` | Stop local dev services |
| `./scripts/status.sh` | Show running status and URLs |
| `./scripts/reload.sh [all\|frontend\|backend]` | Rebuild and reload in Docker container mode |

---

## API

Interactive API documentation:

- **Swagger UI:** `http://localhost:8000/api/docs`
- **ReDoc:** `http://localhost:8000/api/redoc`

All protected endpoints require `Authorization: Bearer <access_token>`.

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

## Sample templates

The `templates/` directory contains ready-to-use backup templates that can be imported directly in the **Backup Templates** page.

| File | Device |
| --- | --- |
| `template-cisco.yaml` | Cisco |
| `template-mikrotik-routeros---full-backup.yaml` | MikroTik RouterOS |
| `template-mk_v2_1.yaml` | MikroTik (v2) |
| `template-huawei-ne8k.yaml` | Huawei NE8K |
| `template-huawei-sw-6730.yaml` | Huawei SW-6730 |
| `template-olt-huawei.yaml` | OLT Huawei |
| `template-olts-zte.yaml` | OLT ZTE |
| `template-olts-zte-titan.yaml` | OLT ZTE Titan |
| `template-hillstone.yaml` | Hillstone |
| `template-a10-th1040.yaml` | A10 TH1040 |
| `template-sw-datacom.yaml` | Switch Datacom |
| `template-sw-tp-link.yaml` | Switch TP-Link |

To import: go to **Backup Templates → Import** and select the desired file.

---

## Contributing

Bug reports and feature requests are welcome via [Issues](../../issues).

---

## Português

> Backup de configuração de rede com versionamento, diff e busca.

O Configuard é uma aplicação web auto-hospedada para gerenciamento centralizado de configurações de dispositivos de rede. Ele coleta, organiza, versiona e agenda backups de roteadores, switches, firewalls e qualquer dispositivo acessível via SSH ou Telnet.

---

### Índice

- [Recursos](#recursos)
- [Requisitos](#requisitos)
- [Início rápido](#início-rápido)
- [Configuração](#configuração)
- [Papéis de usuário](#papéis-de-usuário)
- [Templates de backup](#templates-de-backup)
- [Agendamentos](#agendamentos)
- [Busca](#busca)
- [Referência dos scripts](#referência-dos-scripts)
- [API](#api-1)
- [Templates de exemplo](#templates-de-exemplo)
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
git clone https://github.com/thiagoe/configuard.git
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

### API

Documentação interativa da API:

- **Swagger UI:** `http://localhost:8000/api/docs`
- **ReDoc:** `http://localhost:8000/api/redoc`

Todos os endpoints protegidos exigem `Authorization: Bearer <access_token>`.

---

### Templates de exemplo

O diretório `templates/` contém templates de backup prontos para uso, importáveis diretamente na página **Templates de Backup**.

| Arquivo | Dispositivo |
| --- | --- |
| `template-cisco.yaml` | Cisco |
| `template-mikrotik-routeros---full-backup.yaml` | MikroTik RouterOS |
| `template-mk_v2_1.yaml` | MikroTik (v2) |
| `template-huawei-ne8k.yaml` | Huawei NE8K |
| `template-huawei-sw-6730.yaml` | Huawei SW-6730 |
| `template-olt-huawei.yaml` | OLT Huawei |
| `template-olts-zte.yaml` | OLT ZTE |
| `template-olts-zte-titan.yaml` | OLT ZTE Titan |
| `template-hillstone.yaml` | Hillstone |
| `template-a10-th1040.yaml` | A10 TH1040 |
| `template-sw-datacom.yaml` | Switch Datacom |
| `template-sw-tp-link.yaml` | Switch TP-Link |

Para importar: acesse **Templates de Backup → Importar** e selecione o arquivo desejado.

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

Reportes de bugs e solicitações de features são bem-vindos via [Issues](../../issues).
