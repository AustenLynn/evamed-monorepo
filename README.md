# EVAMED Deploy

Guía de despliegue con Docker para Windows, macOS y Linux.

## Requisitos

- Git
- Docker
  - **Windows:** Docker Desktop con **WSL 2** habilitado.
  - **macOS:** Docker Desktop (contenedores Linux).
  - **Linux:** Docker Engine + plugin de Docker Compose.

## Clonado del repositorio (con submódulos)

Opción recomendada:

```bash
git clone --recurse-submodules https://github.com/AustenLynn/EVAMED-deploy
cd EVAMED-deploy
```

Si ya clonaste sin submódulos:

```bash
git submodule update --init --recursive
```

## Levantar la aplicación

```bash
docker compose up --build
```

- **Frontend:** http://localhost:8080
- **API:** http://localhost:8000

## Base de datos (restore automático en primer arranque)

El dump se restaura automáticamente **solo en el primer arranque**, usando `backup`.
Si la base ya existe, Postgres no ejecuta el script de inicialización.

Para forzar la restauración (esto borra los datos actuales):

```bash
docker compose down -v
docker compose up --build
```

## Parar servicios

```bash
docker compose down
```

## Troubleshooting

### Submódulos vacíos

```bash
git submodule sync --recursive
git submodule update --init --recursive --force
```

### Puertos ocupados (8000/8080)

Detén el proceso que usa el puerto o cambia el mapeo en `docker-compose.yml`.

### El dump no se restaura

- Asegúrate de que el volumen esté vacío (ver sección de restauración).
- Si estás en Windows y editaste el script, usa LF y permisos de ejecución:

```bash
dos2unix backend/evamed-api/docker/postgres/initdb/01-restore.sh
chmod +x backend/evamed-api/docker/postgres/initdb/01-restore.sh
```
