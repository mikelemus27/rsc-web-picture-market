# Fix para ContainerConfig (docker-compose v1 + imagen sin metadata)

Comando exacto (ejecutar en orden):

  sudo DOCKER_HOST=unix:///var/run/docker.sock docker-compose rm -f
  sudo DOCKER_HOST=unix:///var/run/docker.sock docker-compose build --no-cache
  sudo DOCKER_HOST=unix:///var/run/docker.sock docker-compose up --build -d

O usar docker v2 (recomendado, sin este error):

  sudo DOCKER_HOST=unix:///var/run/docker.sock docker compose up --build --force-recreate -d
