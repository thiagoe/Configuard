#!/bin/bash

# Configuard - Status Script
# Usage: ./scripts/status.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================"
echo "  Configuard - Service Status  "
echo "======================================"
echo ""

# Check database
echo -n "Database (MariaDB):  "
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "configuard_db"; then
    echo -e "${GREEN}RUNNING${NC}"

    # Check if accepting connections
    if docker exec configuard_db mariadb -u configuard -pconfiguard123 -e "SELECT 1" &> /dev/null; then
        echo -e "  └─ Connection:     ${GREEN}OK${NC}"
    else
        echo -e "  └─ Connection:     ${YELLOW}NOT READY${NC}"
    fi
else
    echo -e "${RED}STOPPED${NC}"
fi

# Check backend
echo -n "Backend (FastAPI):   "
if [ -f "$PROJECT_DIR/backend/.pid" ]; then
    PID=$(cat "$PROJECT_DIR/backend/.pid")
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}RUNNING${NC} (PID: $PID)"

        # Check if responding
        if curl -s http://localhost:8000/api/health > /dev/null 2>&1; then
            echo -e "  └─ Health check:   ${GREEN}OK${NC}"
        else
            echo -e "  └─ Health check:   ${YELLOW}NOT RESPONDING${NC}"
        fi
    else
        echo -e "${RED}STOPPED${NC} (stale PID file)"
    fi
else
    # Check if running without PID file
    if pgrep -f "uvicorn main:app.*8000" > /dev/null; then
        echo -e "${YELLOW}RUNNING${NC} (no PID file)"
    else
        echo -e "${RED}STOPPED${NC}"
    fi
fi

# Check frontend
echo -n "Frontend (Vite):     "
if [ -f "$PROJECT_DIR/frontend/.pid" ]; then
    PID=$(cat "$PROJECT_DIR/frontend/.pid")
    if kill -0 $PID 2>/dev/null; then
        echo -e "${GREEN}RUNNING${NC} (PID: $PID)"

        # Check if responding
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e "  └─ Health check:   ${GREEN}OK${NC}"
        else
            echo -e "  └─ Health check:   ${YELLOW}NOT RESPONDING${NC}"
        fi
    else
        echo -e "${RED}STOPPED${NC} (stale PID file)"
    fi
else
    if pgrep -f "vite.*5173" > /dev/null; then
        echo -e "${YELLOW}RUNNING${NC} (no PID file)"
    else
        echo -e "${RED}STOPPED${NC}"
    fi
fi

echo ""
echo "URLs:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/api/docs"
echo ""
