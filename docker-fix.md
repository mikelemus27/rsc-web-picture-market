# Docker — Tutorial de uso, diagnóstico y corrección (rsc-web-picture-market)

Proyecto: TypeScript + Bun (backend REST) + Vue + Tailwind v4 (frontend), arquitectura hexagonal, contenedores separados.

---

## 1. Uso básico (sin problemas)

```bash
# Limpiar contenedores previos del proyecto (evita errores de metadata)
docker-compose rm -f

# Reconstruir sin caché (evita KeyError: ContainerConfig con imagen Bun)
docker-compose build --no-cache

# Levantar (puertos ya cambiados a 4001 / 3001 en docker-compose.yml)
docker-compose up -d
```

URLs locales tras levantamiento:
- Backend REST: `http://localhost:4001/api/media`
- Frontend Vue + Tailwind v4: `http://localhost:3002/`

---

## 2. Diagnóstico: síntomas y evidencia

### 2.1 "Cannot connect to Docker daemon" / `permission denied`
- **Síntoma:** `docker ps` falla sin `sudo`; `sudo docker ps` funciona.
- **Causa:** Usuario no pertenece al grupo `docker`; socket `/var/run/docker.sock` es `root:docker` (`srw-rw----`).
- **Evidencia:**
  ```bash
  groups          # falta 'docker'
  ls -la /var/run/docker.sock   # root docker
  ```
- **Corrección:**
  ```bash
  sudo usermod -aG docker $USER   # $USER = usuario actual (mgl)
  newgrp docker                    # renueva grupos en esta sesión
  docker ps                        # sin sudo
  ```

### 2.2 `KeyError: 'ContainerConfig'` en `docker-compose up`
- **Síntoma:** `Recreating rsc-backend ... ERROR ... ContainerConfig` (con imagen `oven/bun` o nueva).
- **Causa:** `docker-compose` v1.29 no lee la metadata de imagen nueva que omite `ContainerConfig`; el contenedor anterior tiene volumen corrupto.
- **Evidencia:** Log muestra `get_container_data_volumes` fallando exactamente en `'ContainerConfig'`.
- **Corrección:**
  ```bash
  docker-compose rm -f
  docker-compose build --no-cache
  docker-compose up -d
  # O usar v2 (sin este bug):
  docker compose up --build --force-recreate -d
  ```

### 2.3 `failed to bind host port 0.0.0.0:4000/tcp: address already in use`
- **Síntoma:** El backend no arranca porque 4000 está ocupado.
- **Causa:** Otro servicio (o contenedor anterior) usa 4000; `open-webui` usa `3000`.
- **Evidencia:** `ss -tlnp | grep ':4000'`; `docker ps` muestra `open-webui` en `3000`.
- **Corrección:** Ya aplicado en `docker-compose.yml`; puertos cambiados a `4001:4000` y `3002:80`. Si choca de nuevo, cambiar en compose.

### 2.4 `DOCKER_HOST` / socket de Desktop roto
- **Síntoma:** `docker-compose` busca `~/.docker/desktop/docker.sock` y da `Connection refused`; daemon está en `/var/run/docker.sock`.
- **Causa:** Configuración de Desktop activa en este entorno; `env | grep DOCKER` podría estar vacío pero `docker` resuelve al Desktop.
- **Evidencia:**
  ```bash
  ls -la ~/.docker/desktop/docker.sock    # existe
  ls -la /var/run/docker.sock             # existe y funciona
  systemctl status docker                 # active (running)
  ```
- **Corrección temporal:**
  ```bash
  DOCKER_HOST=unix:///var/run/docker.sock docker-compose up --build -d
  # O permanente para esta sesión:
  export DOCKER_HOST=unix:///var/run/docker.sock
  ```

---

## 3. Comandos de verificación (después de levantar)

```bash
docker ps                        # Ver contenedores rsc-backend / rsc-frontend
docker-compose logs -f backend    # Log REST
docker-compose logs -f frontend   # Log Nginx / build

curl -s http://localhost:4001/api/media | head -c 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/
```

---

## 4. Archivos clave del proyecto

- `Dockerfile.backend` — imagen `oven/bun:1.2-debian`, expone 4000
- `Dockerfile.frontend` — build `node:20-alpine` + `nginx:alpine`, expone 80 (mapeado a 3001)
- `nginx.conf` — reemplaza default, sirve `/usr/share/nginx/html`
- `docker-compose.yml` — red `rsc-net`, puertos `4001:4000`, `3002:80`
- `docker-fix.md` — este documento

---

## 5. Notas de arquitectura preservadas

- Hexagonal: `src/domain/`, `src/application/`, `src/adapters/`
- SOLID: repositorios abstractos (`MediaRepository`, `CartRepository`, `OrderRepository`)
- Tailwind v4 (`@import "tailwindcss"`, tokens OKLCH, `@theme`)
- Vue 3 + Vite + TypeScript + Bun
