#!/bin/bash
# reload.sh — Rebuild completo do sistema containerizado (backend + frontend)
# Uso:
#   ./scripts/reload.sh          # rebuild tudo (frontend build + restart containers)
#   ./scripts/reload.sh frontend # só rebuild do frontend
#   ./scripts/reload.sh backend  # só restart do backend
#   ./scripts/reload.sh all      # igual ao padrão

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()    { echo -e "${BLUE}[→]${NC} $1"; }
ok()      { echo -e "${GREEN}[✓]${NC} $1"; }
section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

cd "$PROJECT_DIR"

reload_frontend() {
    section "Frontend"
    info "Buildando frontend (npm run build)..."
    cd "$PROJECT_DIR/frontend" && npm run build --silent
    ok "Build concluído → dist/ atualizado"

    info "Recarregando nginx..."
    docker compose exec frontend nginx -s reload
    ok "Nginx recarregado"
    cd "$PROJECT_DIR"
}

reload_backend() {
    section "Backend"
    info "Reiniciando container do backend..."
    docker compose restart backend
    ok "Backend reiniciado (uvicorn --reload detecta mudanças automaticamente)"
}

TARGET="${1:-all}"

echo ""
echo "╔══════════════════════════════╗"
echo "║   Configuard — Reload Dev    ║"
echo "╚══════════════════════════════╝"

case "$TARGET" in
    frontend)
        reload_frontend
        ;;
    backend)
        reload_backend
        ;;
    all|"")
        reload_frontend
        reload_backend
        ;;
    *)
        echo "Uso: $0 [all|frontend|backend]"
        exit 1
        ;;
esac

section "Pronto"
ok "Frontend:  http://localhost:8080"
ok "Backend:   http://localhost:8000/api/health"
echo ""
