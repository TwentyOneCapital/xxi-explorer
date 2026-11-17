#!/bin/sh
# Build the Twenty One backend and frontend images from this checkout.
#   docker/build-twentyone.sh        -> twentyone/mempool-{backend,frontend}:<short commit>
set -eu
cd "$(dirname "$0")/.."

COMMIT="$(git rev-parse --short=9 HEAD)"
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "refusing to build: working tree has uncommitted changes" >&2; exit 1
fi

sh docker/init.sh
docker build -t "twentyone/mempool-backend:${COMMIT}"  --build-arg commitHash="${COMMIT}" backend
docker build -t "twentyone/mempool-frontend:${COMMIT}" --build-arg commitHash="${COMMIT}" \
  --build-arg CUSTOMIZATION=custom-twentyone-config.json frontend
git checkout -- . 2>/dev/null || true   # undo init.sh's in-tree copies
echo "built twentyone/mempool-backend:${COMMIT} and twentyone/mempool-frontend:${COMMIT}"
