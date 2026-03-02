#!/bin/bash

# Configuard System Manager
# Usage: ./system.sh [start|stop|status|restart]

PROJECT_DIR="/var/www/html/projetos/configuard"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
DB_DIR="$PROJECT_DIR/db"
LOG_DIR="$PROJECT_DIR/logs"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# PID files
BACKEND_PID_FILE="$PROJECT_DIR/.backend.pid"
FRONTEND_PID_FILE="$PROJECT_DIR/.frontend.pid"

start_database() {
    echo -e "${YELLOW}Iniciando banco de dados...${NC}"

    cd "$DB_DIR"

    # Check if already running
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "${YELLOW}Banco de dados já está rodando${NC}"
        return 0
    fi

    # Start container
    docker compose up -d

    # Wait for database to be ready
    echo -e "${YELLOW}Aguardando banco de dados ficar pronto...${NC}"
    for i in {1..30}; do
        if docker compose exec -T db mariadb -u configuard -pconfiguard123 -e "SELECT 1" configuard >/dev/null 2>&1; then
            echo -e "${GREEN}Banco de dados iniciado e pronto${NC}"
            return 0
        fi
        sleep 1
    done

    echo -e "${YELLOW}Banco de dados iniciado (aguarde alguns segundos para conexões)${NC}"
}

stop_database() {
    echo -e "${YELLOW}Parando banco de dados...${NC}"

    cd "$DB_DIR"
    docker compose down

    echo -e "${GREEN}Banco de dados parado${NC}"
}

start_backend() {
    echo -e "${YELLOW}Iniciando backend...${NC}"

    if [ -f "$BACKEND_PID_FILE" ] && kill -0 $(cat "$BACKEND_PID_FILE") 2>/dev/null; then
        echo -e "${YELLOW}Backend já está rodando (PID: $(cat $BACKEND_PID_FILE))${NC}"
        return 0
    fi

    cd "$BACKEND_DIR"
    source venv/bin/activate

    # Create logs directory if not exists
    mkdir -p "$LOG_DIR"

    # Start uvicorn in background
    nohup uvicorn main:app --host 0.0.0.0 --port 8000 --reload > "$LOG_DIR/backend.out" 2>&1 &
    echo $! > "$BACKEND_PID_FILE"

    sleep 2

    if kill -0 $(cat "$BACKEND_PID_FILE") 2>/dev/null; then
        echo -e "${GREEN}Backend iniciado (PID: $(cat $BACKEND_PID_FILE))${NC}"
        echo -e "${GREEN}API disponível em: http://localhost:8000${NC}"
    else
        echo -e "${RED}Falha ao iniciar backend${NC}"
        rm -f "$BACKEND_PID_FILE"
        return 1
    fi
}

start_frontend() {
    echo -e "${YELLOW}Iniciando frontend...${NC}"

    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 $(cat "$FRONTEND_PID_FILE") 2>/dev/null; then
        echo -e "${YELLOW}Frontend já está rodando (PID: $(cat $FRONTEND_PID_FILE))${NC}"
        return 0
    fi

    cd "$FRONTEND_DIR"

    # Create logs directory if not exists
    mkdir -p "$LOG_DIR"

    # Start vite in background
    nohup npm run dev > "$LOG_DIR/frontend.out" 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"

    sleep 3

    if kill -0 $(cat "$FRONTEND_PID_FILE") 2>/dev/null; then
        echo -e "${GREEN}Frontend iniciado (PID: $(cat $FRONTEND_PID_FILE))${NC}"
        echo -e "${GREEN}App disponível em: http://localhost:5173${NC}"
    else
        echo -e "${RED}Falha ao iniciar frontend${NC}"
        rm -f "$FRONTEND_PID_FILE"
        return 1
    fi
}

stop_backend() {
    echo -e "${YELLOW}Parando backend...${NC}"

    # Kill by PID file
    if [ -f "$BACKEND_PID_FILE" ]; then
        PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        fi
        rm -f "$BACKEND_PID_FILE"
    fi

    # Kill any remaining uvicorn processes for this project
    pkill -f "uvicorn main:app.*8000" 2>/dev/null

    # Kill any process using port 8000
    lsof -ti:8000 | xargs -r kill -9 2>/dev/null

    echo -e "${GREEN}Backend parado${NC}"
}

stop_frontend() {
    echo -e "${YELLOW}Parando frontend...${NC}"

    # Kill by PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            kill $PID 2>/dev/null
            sleep 1
            kill -9 $PID 2>/dev/null
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi

    # Kill any remaining vite processes for this project
    pkill -f "vite.*5173" 2>/dev/null
    pkill -f "node.*$FRONTEND_DIR" 2>/dev/null

    # Kill any process using port 5173
    lsof -ti:5173 | xargs -r kill -9 2>/dev/null

    echo -e "${GREEN}Frontend parado${NC}"
}

status() {
    echo -e "${YELLOW}=== Status do Sistema ===${NC}"
    echo ""

    # Backend status
    if [ -f "$BACKEND_PID_FILE" ] && kill -0 $(cat "$BACKEND_PID_FILE") 2>/dev/null; then
        echo -e "Backend:  ${GREEN}RODANDO${NC} (PID: $(cat $BACKEND_PID_FILE))"
        echo -e "          http://localhost:8000"
    else
        echo -e "Backend:  ${RED}PARADO${NC}"
        rm -f "$BACKEND_PID_FILE" 2>/dev/null
    fi

    echo ""

    # Frontend status
    if [ -f "$FRONTEND_PID_FILE" ] && kill -0 $(cat "$FRONTEND_PID_FILE") 2>/dev/null; then
        echo -e "Frontend: ${GREEN}RODANDO${NC} (PID: $(cat $FRONTEND_PID_FILE))"
        echo -e "          http://localhost:5173"
    else
        echo -e "Frontend: ${RED}PARADO${NC}"
        rm -f "$FRONTEND_PID_FILE" 2>/dev/null
    fi

    echo ""

    # Database status
    cd "$DB_DIR"
    if docker compose ps 2>/dev/null | grep -q "Up"; then
        echo -e "Database: ${GREEN}RODANDO${NC}"
        echo -e "          localhost:3306"
    else
        echo -e "Database: ${RED}PARADO${NC}"
    fi
}

start() {
    echo -e "${GREEN}=== Iniciando Configuard ===${NC}"
    echo ""
    start_database
    echo ""
    start_backend
    echo ""
    start_frontend
    echo ""
    echo -e "${GREEN}=== Sistema iniciado ===${NC}"
}

stop() {
    echo -e "${RED}=== Parando Configuard ===${NC}"
    echo ""
    stop_frontend
    stop_backend
    stop_database
    echo ""
    echo -e "${RED}=== Sistema parado ===${NC}"
}

restart() {
    stop
    echo ""
    sleep 2
    start
}

# Main
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    restart)
        restart
        ;;
    *)
        echo "Configuard System Manager"
        echo ""
        echo "Uso: $0 {start|stop|status|restart}"
        echo ""
        echo "  start   - Inicia backend e frontend"
        echo "  stop    - Para backend e frontend"
        echo "  status  - Mostra status dos serviços"
        echo "  restart - Reinicia todos os serviços"
        exit 1
        ;;
esac

exit 0
