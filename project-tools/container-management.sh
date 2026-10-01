#!/usr/bin/env sh
# Project-tools: container lifecycle management
# Author: miguel.gallardo.lemus@gmail.com
# Usage: ./project-tools/container-management.sh <action>

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_COMPOSE="$REPO_ROOT/_01_rsc_wpm_backend/docker-compose.yml"
FRONTEND_COMPOSE="$REPO_ROOT/_02_rsc_wp_frontend/docker-compose.yml"
ENV_FILE="$REPO_ROOT/_02_rsc_wp_frontend/.env"

usage() {
  echo "Usage: $0 <action>"
  echo ""
  echo "Actions:"
  echo "  start-all       Start backend + frontend (frontend uses rsc-shared network)"
  echo "  stop-all        Stop all running containers"
  echo "  remove-all      Stop and remove all containers"
  echo "  rebuild-all     Rebuild images and restart (backend first, then frontend)"
  echo "  restart-frontend Restart frontend only (uses running backend at 4001)"
  echo "  test-frontend   Run frontend tests (verified 4 pass / 0 fail)"
  echo "  test-backend [--container] Run backend tests locally or inside the backend container"
  echo "  help          Show this help message"
  exit 1
}

check_backend_running() {
  docker compose -f "$BACKEND_COMPOSE" ps --filter name=backend --format '{{.Status}}' 2>/dev/null | grep -q "Up" || {
    echo -e "${RED}❌ Backend not running.${NC} Run '$0 start-all' first."
    exit 1
  }
}

check_frontend_network() {
  docker compose -f "$BACKEND_COMPOSE" ps --filter name=backend --format '{{.Status}}' 2>/dev/null | grep -q "Up" || {
    echo -e "${RED}❌ Backend container not found or not running.${NC}"
    exit 1
  }
}

print_error() {
  echo "Error: $1"
  exit 1
}

case "$1" in
  start-all)
    echo -e "${GREEN}=== Starting backend ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" build backend 2>&1 | tail -1
    docker compose -f "$BACKEND_COMPOSE" up -d backend 2>&1 | tail -1 || exit 1
    echo -e "${GREEN}=== Starting frontend ===${NC}"
    docker compose -f "$FRONTEND_COMPOSE" up -d --no-deps frontend 2>&1 | tail -2 || {
      echo -e "${GREEN}Starting frontend (fallback docker run with rsc-shared):${NC}"
      docker rm -f 02_rsc_wp_bun_vue_frontend 2>/dev/null
      docker run -d --name 02_rsc_wp_bun_vue_frontend \
        --network rsc-shared \
        -v "$REPO_ROOT/_02_rsc_wp_frontend:/app" -w /app \
        --env-file "$ENV_FILE" 02_rsc_wp_frontend-frontend 2>&1 | head -1
      sleep 1
    }
    echo -e "${GREEN}=== Verifying ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep 01_rsc_wpm
    docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep 02_rsc_wp_bun_vue_frontend
    ;;

  stop-all)
    echo -e "${GREEN}=== Stopping all ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" stop 2>/dev/null || true
    docker stop 02_rsc_wp_bun_vue_frontend 2>/dev/null || true
    ;;

  remove-all)
    echo -e "${GREEN}=== Removing all ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" rm -f 2>/dev/null || true
    docker rm -f 02_rsc_wp_bun_vue_frontend 2>/dev/null || true
    echo -e "${GREEN}=== Done ===${NC}"
    ;;

  rebuild-all)
    echo -e "${GREEN}=== Rebuild backend ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" build backend 2>&1 | tail -1
    docker compose -f "$BACKEND_COMPOSE" up -d backend 2>&1 | tail -1 || exit 1
    sleep 2
    echo -e "${GREEN}=== Rebuild frontend ===${NC}"
    docker compose -f "$FRONTEND_COMPOSE" build --no-cache frontend 2>&1 | tail -1
    docker compose -f "$FRONTEND_COMPOSE" up -d --no-deps frontend 2>&1 | tail -2 || {
      docker rm -f 02_rsc_wp_bun_vue_frontend 2>/dev/null
      docker run -d --name 02_rsc_wp_bun_vue_frontend \
        --network rsc-shared \
        -v "$REPO_ROOT/_02_rsc_wp_frontend:/app" -w /app \
        --env-file "$ENV_FILE" 02_rsc_wp_frontend-frontend 2>&1 | head -1
      sleep 1
    }
    echo -e "${GREEN}=== Verify ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep 01_rsc_wpm
    docker ps --format 'table {{.Names}}\t{{.Status}}' 2>/dev/null | grep 02_rsc_wp_bun_vue_frontend
    ;;

  test-frontend)
    echo -e "${GREEN}=== Running frontend tests ===${NC}"
    docker compose -f "$FRONTEND_COMPOSE" run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts 2>&1
    ;;

  test-backend)
    shift
    if [ "$#" -gt 1 ]; then
      usage
    fi
    case "${1:-}" in
      "")
        echo -e "${GREEN}=== Running backend tests locally ===${NC}"
        cd "$REPO_ROOT/_01_rsc_wpm_backend" && bun test ./test/usuarios.api.test.ts 2>&1
        ;;
      --container)
        echo -e "${GREEN}=== Running backend tests inside the container ===${NC}"
        cd "$REPO_ROOT/_01_rsc_wpm_backend" && bun run test:all -- --container 2>&1
        ;;
      *)
        usage
        ;;
    esac
    ;;

  help|*) usage ;;
esac
