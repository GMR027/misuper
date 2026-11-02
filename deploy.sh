#!/usr/bin/env bash
# ===========================================================================
# deploy.sh — construye, publica y despliega una actualización de Mi Súper.
#
# Uso:
#   ./deploy.sh            # tag auto-incremental (último + 1)
#   ./deploy.sh 7          # usar un tag concreto
#
# Flujo:
#   1. Verifica docker, helm, kubectl y sesión de Docker Hub
#   2. Genera helm/misuper/values.local.yaml si no existe (secretos aleatorios)
#   3. docker build  → gmr27/misuper:<tag> (+ :latest)
#   4. docker push
#   5. helm upgrade --install en el namespace misuper
#   6. Espera el rollout de MySQL y de la app
#
# La base de datos y los uploads viven en PVCs: no se tocan en los upgrades.
# Las migraciones se aplican solas en el initContainer de la app.
# ===========================================================================
set -euo pipefail

# --- Configuración ---------------------------------------------------------
REPO="gmr27/misuper"
NAMESPACE="misuper"
RELEASE="misuper"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHART_DIR="$ROOT_DIR/helm/misuper"
VALUES_LOCAL="$CHART_DIR/values.local.yaml"
TAG_FILE="$ROOT_DIR/.deploy-tag"

# --- Colores ---------------------------------------------------------------
verde()    { printf '\033[32m%s\033[0m\n' "$*"; }
amarillo() { printf '\033[33m%s\033[0m\n' "$*"; }
rojo()     { printf '\033[31m%s\033[0m\n' "$*" >&2; }

# --- Tag -------------------------------------------------------------------
if [[ $# -ge 1 ]]; then
    TAG="$1"
    [[ "$TAG" =~ ^[A-Za-z0-9._-]+$ ]] || { rojo "Tag inválido: $TAG"; exit 1; }
else
    ULTIMO=0
    [[ -f "$TAG_FILE" ]] && ULTIMO="$(cat "$TAG_FILE")"
    [[ "$ULTIMO" =~ ^[0-9]+$ ]] || ULTIMO=0
    TAG=$((ULTIMO + 1))
fi
verde "==> Tag de esta versión: $TAG"

# --- Requisitos -------------------------------------------------------------
for cmd in docker helm kubectl; do
    command -v "$cmd" >/dev/null 2>&1 || { rojo "Falta '$cmd' en el PATH."; exit 1; }
done

if ! grep -q '"auths"' "$HOME/.docker/config.json" 2>/dev/null \
   || grep -q '"auths"[[:space:]]*:[[:space:]]*{}' "$HOME/.docker/config.json" 2>/dev/null; then
    rojo "No hay credenciales de Docker Hub. Ejecuta primero:  docker login"
    exit 1
fi

# --- Secretos locales -------------------------------------------------------
if [[ ! -f "$VALUES_LOCAL" ]]; then
    command -v openssl >/dev/null 2>&1 || { rojo "Falta openssl para generar secretos."; exit 1; }

    DB_PASSWORD="${MISUPER_DB_PASSWORD:-$(openssl rand -hex 24)}"
    MYSQL_ROOT_PASSWORD="${MISUPER_MYSQL_ROOT_PASSWORD:-$(openssl rand -hex 24)}"

    umask 077
    cat > "$VALUES_LOCAL" <<EOF
# Generado por deploy.sh — NO se versiona.
# Consérvalo: cambiarlo después de inicializar MySQL rompe la conexión.
secrets:
  dbPassword: "$DB_PASSWORD"
  mysqlRootPassword: "$MYSQL_ROOT_PASSWORD"
EOF

    verde "==> Creado $VALUES_LOCAL con contraseñas aleatorias."
    amarillo "    Guarda una copia segura de este archivo."
fi

chmod 600 "$VALUES_LOCAL"

# --- Build ------------------------------------------------------------------
COMMIT="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo desconocido)"
FECHA_BUILD="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

verde "==> Construyendo imagen $REPO:$TAG (commit $COMMIT)..."
docker build \
    --label "org.opencontainers.image.revision=$COMMIT" \
    --label "org.opencontainers.image.created=$FECHA_BUILD" \
    --label "org.opencontainers.image.title=misuper" \
    -t "$REPO:$TAG" \
    -t "$REPO:latest" \
    "$ROOT_DIR"

# --- Push -------------------------------------------------------------------
verde "==> Subiendo a Docker Hub..."
docker push "$REPO:$TAG"
docker push "$REPO:latest"

# --- Deploy -----------------------------------------------------------------
verde "==> Desplegando con Helm en el namespace '$NAMESPACE'..."
helm upgrade --install "$RELEASE" "$CHART_DIR" \
    --namespace "$NAMESPACE" \
    --create-namespace \
    -f "$CHART_DIR/values.yaml" \
    -f "$VALUES_LOCAL" \
    --set image.tag="$TAG" \
    --timeout 10m

echo "$TAG" > "$TAG_FILE"

# --- Verificación -------------------------------------------------------------
verde "==> Esperando a que MySQL esté listo..."
kubectl rollout status deployment/misuper-mysql -n "$NAMESPACE" --timeout=300s

verde "==> Esperando a que la app esté lista..."
kubectl rollout status deployment/misuper -n "$NAMESPACE" --timeout=300s

echo
verde "==> Despliegue completado. Estado actual:"
kubectl get pods,svc,ingress -n "$NAMESPACE"
echo
verde "URL: https://misuper.iguzman.com.mx"
