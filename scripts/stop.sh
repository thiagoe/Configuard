#!/bin/bash

# Configuard - Stop Script
# Usage: ./scripts/stop.sh [service]
# Services: all, db, backend, frontend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Stop database
stop_db() {
    log_info "Stopping database..."
    cd "$PROJECT_DIR/db"

    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose down 2>/dev/null || true
    else
        docker-compose down 2>/dev/null || true
    fi

    log_success "Database stopped"
}

# Stop backend
stop_backend() {
    log_info "Stopping backend..."
    cd "$PROJECT_DIR/backend"

    if [ -f .pid ]; then
        PID=$(cat .pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null || true
            sleep 1
            # Force kill if still running
            kill -9 $PID 2>/dev/null || true
        fi
        rm -f .pid
    fi

    # Also kill any uvicorn processes for this project
    pkill -f "uvicorn main:app.*8000" 2>/dev/null || true

    log_success "Backend stopped"
}

# Stop frontend
stop_frontend() {
    log_info "Stopping frontend..."
    cd "$PROJECT_DIR/frontend"

    if [ -f .pid ]; then
        PID=$(cat .pid)
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null || true
            sleep 1
            kill -9 $PID 2>/dev/null || true
        fi
        rm -f .pid
    fi

    # Also kill any vite processes for this project
    pkill -f "vite.*5173" 2>/dev/null || true

    log_success "Frontend stopped"
}

# Main
SERVICE=${1:-all}

echo ""
echo "======================================"
echo "   Configuard - Stop Script    "
echo "======================================"
echo ""

case $SERVICE in
    all)
        stop_frontend
        stop_backend
        stop_db
        echo ""
        log_success "All services stopped!"
        echo ""
        ;;
    db)
        stop_db
        ;;
    backend)
        stop_backend
        ;;
    frontend)
        stop_frontend
        ;;
    *)
        echo "Usage: $0 [all|db|backend|frontend]"
        exit 1
        ;;
esac
