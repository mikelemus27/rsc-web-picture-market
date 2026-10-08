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
# Must match the `external:` network name declared in the frontend compose file.
# The old fallback used `rsc-shared`, a network this stack never creates.
FRONTEND_NETWORK="01_rsc_wpm_backend_rsc-network"

usage() {
  echo "Usage: $0 <action>"
  echo ""
  echo "Actions:"
  echo "  start-all       Start backend + frontend (frontend joins $FRONTEND_NETWORK)"
  echo "  stop-all        Stop this project's containers"
  echo "  stop-running-containers  Stop all running containers in the active Docker context (with confirmation)"
  echo "  remove-all      Stop and remove all containers"
  echo "  rebuild-all     Rebuild images and restart (backend first, then frontend)"
  echo "  restart-frontend Restart frontend only (uses running backend at 4001)"
  echo "  test-frontend   Run frontend API integration tests inside the frontend container"
  echo "  test-backend [--container] Run backend tests locally or inside the backend container"
  echo "  help          Show this help message"
  exit 1
}

check_backend_running() {
  docker compose -f "$BACKEND_COMPOSE" ps --filter name=backend --format '{{.Status}}' 2>/dev/null | grep -q "Up" || {
    printf '%b\n' "${RED}❌ Backend not running.${NC} Run '$0 start-all' first."
    exit 1
  }
}

check_frontend_network() {
  docker compose -f "$BACKEND_COMPOSE" ps --filter name=backend --format '{{.Status}}' 2>/dev/null | grep -q "Up" || {
    printf '%b\n' "${RED}❌ Backend container not found or not running.${NC}"
    exit 1
  }
}

print_error() {
  echo "Error: $1"
  exit 1
}

# Keep the real exit status of a command while showing only its tail.
# `docker compose ... | tail -1` reports tail's status (always 0), so a failed
# build used to fall through to the next step as if it had succeeded.
# usage: run_show <tail lines when successful> <command...>
run_show() {
  _tail="$1"
  shift
  _out=$("$@" 2>&1)
  _rc=$?
  if [ "$_rc" -eq 0 ]; then
    [ -n "$_out" ] && printf '%s\n' "$_out" | tail -n "$_tail"
  else
    [ -n "$_out" ] && printf '%s\n' "$_out" | tail -n 30 >&2
    echo "Error: command exited with status $_rc" >&2
  fi
  return "$_rc"
}

# Fallback for when `compose up` cannot create the frontend (stale container
# attached to a deleted network, compose project not found, ...). It must use
# the same network as the compose file or the backend is unreachable.
frontend_fallback() {
  printf '%b\n' "${GREEN}compose up failed; falling back to docker run on $FRONTEND_NETWORK:${NC}"
  docker rm -f 02_rsc_wp_bun_vue_frontend 2>/dev/null
  run_show 1 docker run -d --name 02_rsc_wp_bun_vue_frontend \
    --network "$FRONTEND_NETWORK" \
    -v "$REPO_ROOT/_02_rsc_wp_frontend:/app" -w /app \
    --env-file "$ENV_FILE" 02_rsc_wp_frontend-frontend || {
    print_error "Frontend could not be started by compose or by docker run."
  }
  sleep 1
}

# The backend must be running. The frontend is not a daemon: its CMD runs the
# API test suite and exits, so requiring it to be Up would always fail.
verify_stack() {
  printf '%b\n' "${GREEN}=== Verifying ===${NC}"

  backend_id="$(docker compose -f "$BACKEND_COMPOSE" ps -q backend 2>/dev/null)"
  if [ -z "$backend_id" ] || [ "$(docker inspect -f '{{.State.Running}}' "$backend_id" 2>/dev/null)" != "true" ]; then
    print_error "Backend is not running."
  fi
  echo "backend: running"

  frontend_id="$(docker compose -f "$FRONTEND_COMPOSE" ps --all -q frontend 2>/dev/null)"
  if [ -z "$frontend_id" ]; then
    # Not managed by compose when it was created by the fallback `docker run`.
    frontend_id="$(docker inspect -f '{{.Id}}' 02_rsc_wp_bun_vue_frontend 2>/dev/null)"
  fi
  if [ -z "$frontend_id" ]; then
    print_error "Frontend container was not created."
  fi
  fe_running="$(docker inspect -f '{{.State.Running}}' "$frontend_id" 2>/dev/null)"
  fe_exit="$(docker inspect -f '{{.State.ExitCode}}' "$frontend_id" 2>/dev/null)"
  if [ "$fe_running" = "true" ]; then
    echo "frontend: running (one-shot job; it stops when its test suite finishes)"
  elif [ "$fe_exit" = "0" ]; then
    echo "frontend: exited 0 (its CMD is the frontend test suite)"
  else
    print_error "Frontend container exited with status ${fe_exit:-unknown}."
  fi
}

case "$1" in
  start-all)
    printf '%b\n' "${GREEN}=== Starting backend ===${NC}"
    run_show 1 docker compose -f "$BACKEND_COMPOSE" build backend || {
      print_error "Backend image build failed."
    }
    run_show 1 docker compose -f "$BACKEND_COMPOSE" up -d backend || {
      print_error "Backend did not start."
    }
    printf '%b\n' "${GREEN}=== Starting frontend ===${NC}"
    # --force-recreate: a frontend container left attached to a deleted network
    # makes plain `up` fail with "network ... not found". It is a one-shot job,
    # so recreating it costs nothing.
    run_show 2 docker compose -f "$FRONTEND_COMPOSE" up -d --force-recreate --no-deps frontend || {
      frontend_fallback
    }
    verify_stack
    ;;

  stop-all)
    printf '%b\n' "${GREEN}=== Stopping all ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" stop 2>/dev/null || true
    docker stop 02_rsc_wp_bun_vue_frontend 2>/dev/null || true
    ;;

  stop-running-containers)
    running_containers=$(docker ps --format '{{.ID}}\t{{.Names}}\t{{.Status}}') || {
      echo "Error: Could not list running Docker containers." >&2
      exit 1
    }
    if [ -z "$running_containers" ]; then
      echo "No running Docker containers."
      exit 0
    fi

    container_ids=$(printf '%s\n' "$running_containers" | cut -f1) || {
      echo "Error: Could not prepare the running container list." >&2
      exit 1
    }
    if [ -z "$container_ids" ]; then
      echo "Error: Docker returned running containers without IDs." >&2
      exit 1
    fi
    echo "The following running containers will be stopped:"
    printf 'ID\tNAME\tSTATUS\n'
    printf '%s\n' "$running_containers"
    echo "This includes containers outside this project. In-memory work may be lost."
    if [ ! -t 0 ]; then
      echo "Refusing to stop containers without an interactive confirmation." >&2
      exit 1
    fi
    printf "Type 'stop' to continue: "
    IFS= read -r confirmation || {
      echo "Confirmation was not received; no containers were stopped." >&2
      exit 1
    }
    if [ "$confirmation" != "stop" ]; then
      echo "Confirmation did not match; no containers were stopped."
      exit 1
    fi

    # Docker returns one ID per line; pass each ID as a separate argument.
    set -- $container_ids
    docker stop "$@" || {
      echo "Error: Docker could not stop every container in the captured list." >&2
      exit 1
    }
    ;;

  remove-all)
    printf '%b\n' "${GREEN}=== Removing all ===${NC}"
    docker compose -f "$BACKEND_COMPOSE" rm -f 2>/dev/null || true
    docker rm -f 02_rsc_wp_bun_vue_frontend 2>/dev/null || true
    printf '%b\n' "${GREEN}=== Done ===${NC}"
    ;;

  rebuild-all)
    printf '%b\n' "${GREEN}=== Rebuild backend ===${NC}"
    # One action, one build mode: both services rebuild with --no-cache.
    # (No `docker rmi` before the build: it fails for in-use images and does
    # not clear BuildKit's cache — --no-cache is the real lever.)
    run_show 1 docker compose -f "$BACKEND_COMPOSE" build --no-cache backend || {
      print_error "Backend image build failed."
    }
    run_show 1 docker compose -f "$BACKEND_COMPOSE" up -d --force-recreate backend || {
      print_error "Backend did not start after rebuild."
    }
    sleep 2
    printf '%b\n' "${GREEN}=== Rebuild frontend ===${NC}"
    run_show 1 docker compose -f "$FRONTEND_COMPOSE" build --no-cache frontend || {
      print_error "Frontend image build failed."
    }
    run_show 2 docker compose -f "$FRONTEND_COMPOSE" up -d --force-recreate --no-deps frontend || {
      frontend_fallback
    }
    verify_stack
    ;;

  test-frontend)
    printf '%b\n' "${GREEN}=== Running frontend tests ===${NC}"
    docker compose -f "$FRONTEND_COMPOSE" run --rm frontend bun test ./tests/usuarios.frontend.api.test.ts 2>&1
    ;;

  test-backend)
    shift
    if [ "$#" -gt 1 ]; then
      usage
    fi
    case "${1:-}" in
      "")
        printf '%b\n' "${GREEN}=== Running backend tests locally ===${NC}"
        cd "$REPO_ROOT/_01_rsc_wpm_backend" && bun run test:all 2>&1
        ;;
      --container)
        printf '%b\n' "${GREEN}=== Running backend tests inside the container ===${NC}"
        cd "$REPO_ROOT/_01_rsc_wpm_backend" && bun run test:all -- --container 2>&1
        ;;
      *)
        usage
        ;;
    esac
    ;;

  help|*) usage ;;
esac
