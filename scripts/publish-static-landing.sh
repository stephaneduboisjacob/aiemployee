#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${AIOS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SOURCE_ROOT="${AIOS_PUBLIC_ROOT:-${REPO_ROOT}/apps/web/public}"
WEB_ROOT="${AIOS_WEB_ROOT:?Set AIOS_WEB_ROOT to the target static-site directory}"

if [[ ! -s "${SOURCE_ROOT}/index.html" || ! -s "${SOURCE_ROOT}/landing.css" ]]; then
  echo "Static landing source is missing from ${SOURCE_ROOT}." >&2
  exit 1
fi
if [[ ! -d "${WEB_ROOT}" ]]; then
  echo "Configured web root does not exist; create and verify it before publishing." >&2
  exit 1
fi

cp -a "${SOURCE_ROOT}/." "${WEB_ROOT}/"
find "${WEB_ROOT}" -type d -exec chmod 0755 {} +
find "${WEB_ROOT}" -type f -exec chmod 0644 {} +

if [[ "${RELOAD_NGINX:-false}" == "true" ]]; then
  nginx -t
  systemctl reload nginx
fi

if [[ -n "${AIOS_SITE_URL:-}" ]]; then
  curl --fail --silent --show-error "${AIOS_SITE_URL%/}/" -o /dev/null
fi

echo "Static landing files copied to ${WEB_ROOT}."
