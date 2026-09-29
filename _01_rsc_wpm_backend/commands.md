Levanta solo Postgres usando tu docker-compose.yml (que sí tiene ports: "5432:5432"):
bash

docker compose up -d postgres

-------------------------------------------------
Mira qué contenedores existen ahora:
bash

docker ps -a
Localiza el de Postgres (imagen postgres:16-alpine) y copia su NOMBRE o ID.

Saca la IP con ese nombre/ID (ejemplo usando el nombre que te salga en NAMES):

bash

docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' NOMBRE_DEL_CONTENEDOR_POSTGRES

---------------------------------------------------
ejecutar  todo los  servicios de  docker compose.yml
sudo docker compose up --build
------------------------------------------------------------
ver las  redes 

sudo docker network ls

----------------------------- 
ver todos los  volumes

sudo docker volume ls

----------------------------


postgress

crear la bd: 
sudo docker exec -i 06_practica-microservicio-bun_hexa_userapi_ok-postgres-1 psql -U admin -d escuela

conectarse a la bd escuela
$ sudo docker exec -it 06_practica-microservicio-bun_hexa_userapi_ok-postgres-1 psql -U admin -d escuela


escuela=# CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);
CREATE TABLE
escuela=# \dt
        List of relations
 Schema |  Name   | Type  | Owner
--------+---------+-------+-------
 public | usuario | table | admin
(1 row)

escuela=# INSERT INTO usuario (nombre, email) VALUES
escuela-#     ('Juan Pérez', 'juan@example.com'),
escuela-#     ('María Gómez', 'maria@example.com'),
escuela-#     ('Carlos Ruiz', 'carlos@example.com'),
escuela-#     ('Ana López', 'ana@example.com'),
escuela-#     ('Luis Fernández', 'luis@example.com');
INSERT 0 5
escuela=# select * from usuarios;
ERROR:  relation "usuarios" does not exist
LINE 1: select * from usuarios;
                      ^
escuela=# select * from usuario;
 id |     nombre     |       email
----+----------------+--------------------
  1 | Juan Pérez     | juan@example.com
  2 | María Gómez    | maria@example.com
  3 | Carlos Ruiz    | carlos@example.com
  4 | Ana López      | ana@example.com
  5 | Luis Fernández | luis@example.com


  curl

  mgl@mgl-HP-lap:~/26Aprogweb/ts/_06_practica-microservicio-bun_Hexa_UserApi_ok$ curl -X POST http://localhost:3000/usuarios \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  }'
{
  "id": 6,
  "nombre": "{\"nombre\":\"Juan Pérez\",\"email\":\"juan@example.com\"}",
  "email": "{}"
mgl@mgl-HP-lap:~/26Aprogweb/ts/_06_practica-microservicio-bun_Hexa_UserApi_ok$ curl -v http://localhost:3000/usuarioss
* Host localhost:3000 was resolved.
* IPv6: ::1
* IPv4: 127.0.0.1
*   Trying [::1]:3000...
* Connected to localhost (::1) port 3000
> GET /usuarios HTTP/1.1
> Host: localhost:3000
> User-Agent: curl/8.5.0
> Accept: */*
>
< HTTP/1.1 200 OK
< Content-Type: application/json
< Date: Thu, 21 May 2026 03:53:46 GMT
< Content-Length: 541
<
[
  {
    "id": 1,
    "nombre": "Juan Pérez",
    "email": "juan@example.com"
  },
  {
    "id": 2,
    "nombre": "María Gómez",
    "email": "maria@example.com"
  },
  {
    "id": 3,
    "nombre": "Carlos Ruiz",
    "email": "carlos@example.com"
  },
  {
    "id": 4,
    "nombre": "Ana López",
    "email": "ana@example.com"
  },
  {
    "id": 5,
    "nombre": "Luis Fernández",
    "email": "luis@example.com"
  },
  {
    "id": 6,
    "nombre": "{\"nombre\":\"Juan Pérez\",\"email\":\"juan@example.com\"}",
    "email": "{}"
  }
* Connection #0 to host localhost left intact

update usuario-----------------------------------------------
mgl@mgl-HP-lap:~/26Aprogweb/ts/_06_practica-microservicio-bun_Hexa_UserApi_ok$ curl -X PUT http://localhost:3000/usuarios/1   -H "Content-Type: application/json"   -d '{
    "nombre": "Juan Pérez Actualizado",
    "email": "juan.actualizado@example.com"
  }'
{
  "id": 1,
  "nombre": "Juan Pérez Actualizado",
  "email": "juan.actualizado@example.com"}

  Delete usuario

  mgl@mgl-HP-lap:~/26Aprogweb/ts/_06_practica-microservicio-bun_Hexa_UserApi_ok$ curl -X DELETE http://localhost:3000/usuarios/7
{
  "message": "Usuario eliminado",
  "usuario": {
    "id": 7,
    "nombre": "Juan Pérez",
    "email": "juan@perez.com"
  }
}