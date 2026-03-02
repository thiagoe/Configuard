#!/bin/bash

# Configuard - Start Script
# Usage: ./scripts/start.sh [service]
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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env files exist, create from examples if not
check_env_files() {
    log_info "Checking environment files..."

    if [ ! -f "$PROJECT_DIR/db/.env" ]; then
        if [ -f "$PROJECT_DIR/db/.env.example" ]; then
            cp "$PROJECT_DIR/db/.env.example" "$PROJECT_DIR/db/.env"
            log_warn "Created db/.env from example. Please review and update."
        fi
    fi

    if [ ! -f "$PROJECT_DIR/backend/.env" ]; then
        if [ -f "$PROJECT_DIR/backend/.env.example" ]; then
            cp "$PROJECT_DIR/backend/.env.example" "$PROJECT_DIR/backend/.env"
            log_warn "Created backend/.env from example. Please review and update."
        fi
    fi

    if [ ! -f "$PROJECT_DIR/frontend/.env" ]; then
        if [ -f "$PROJECT_DIR/frontend/.env.example" ]; then
            cp "$PROJECT_DIR/frontend/.env.example" "$PROJECT_DIR/frontend/.env"
            log_warn "Created frontend/.env from example. Please review and update."
        fi
    fi
}

# Start database
start_db() {
    log_info "Starting database..."
    cd "$PROJECT_DIR/db"

    if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Use docker compose (v2) or docker-compose (v1)
    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        docker compose up -d
    else
        docker-compose up -d
    fi

    log_success "Database started"

    # Wait for database to be ready
    log_info "Waiting for database to be ready..."
    sleep 5

    for i in {1..30}; do
        if docker exec configuard_db mariadb -u configuard -pconfiguard123 -e "SELECT 1" &> /dev/null; then
            log_success "Database is ready"
            return 0
        fi
        sleep 1
    done

    log_warn "Database may not be fully ready yet"
}

# Start backend
start_backend() {
    log_info "Starting backend..."
    cd "$PROJECT_DIR/backend"

    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        log_info "Creating virtual environment..."
        python3 -m venv venv
    fi

    # Activate virtual environment
    source venv/bin/activate

    # Install dependencies
    log_info "Installing backend dependencies..."
    pip install -q -r requirements.txt

    # Create logs directory
    mkdir -p logs

    # Start uvicorn in background
    log_info "Starting FastAPI server..."
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > logs/uvicorn.log 2>&1 &
    echo $! > .pid

    sleep 2

    if [ -f .pid ] && kill -0 $(cat .pid) 2>/dev/null; then
        log_success "Backend started on http://localhost:8000"
        log_info "API docs: http://localhost:8000/api/docs"
    else
        log_error "Failed to start backend. Check logs/uvicorn.log"
        exit 1
    fi
}

# Start frontend
start_frontend() {
    log_info "Starting frontend..."
    cd "$PROJECT_DIR/frontend"

    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install Node.js first."
        exit 1
    fi

    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies..."
        npm install
    fi

    # Start Vite dev server in background
    log_info "Starting Vite dev server..."
    nohup npm run dev > .vite.log 2>&1 &
    echo $! > .pid

    sleep 3

    if [ -f .pid ] && kill -0 $(cat .pid) 2>/dev/null; then
        log_success "Frontend started on http://localhost:5173"
    else
        log_error "Failed to start frontend. Check .vite.log"
        exit 1
    fi
}

# Main
SERVICE=${1:-all}

echo ""
echo "======================================"
echo "   Configuard - Start Script   "
echo "======================================"
echo ""

check_env_files

case $SERVICE in
    all)
        start_db
        start_backend
        start_frontend
        echo ""
        log_success "All services started!"
        echo ""
        echo "  Database:  localhost:3306"
        echo "  Backend:   http://localhost:8000"
        echo "  Frontend:  http://localhost:5173"
        echo "  API Docs:  http://localhost:8000/api/docs"
        echo ""
        ;;
    db)
        start_db
        ;;
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    *)
        echo "Usage: $0 [all|db|backend|frontend]"
        exit 1
        ;;
esac
