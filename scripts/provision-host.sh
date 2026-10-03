#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="aiemployee.btcpay.exchange"
SITE="/etc/nginx/sites-available/${DOMAIN}"
ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
WEBROOT="/var/www/letsencrypt"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@btcpay.exchange}"
PRODUCTION_CONFIG="/home/sven/.config/ai-employee-os/production.env"

if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo --preserve-env=CERTBOT_EMAIL "$0" "$@"
fi

python3 - "$DOMAIN" <<'PY'
import ipaddress, socket, subprocess, sys
domain = sys.argv[1]
try:
    dns = {ipaddress.ip_address(item[4][0].split('%')[0].replace('::ffff:', '')) for item in socket.getaddrinfo(domain, None, type=socket.SOCK_STREAM)}
except (OSError, ValueError) as error:
    raise SystemExit(f"DNS check failed: {domain} does not resolve ({error}). No Nginx files were changed.")
result = subprocess.run(['ip', '-o', 'addr', 'show', 'scope', 'global'], capture_output=True, text=True, check=False)
host = set()
for line in result.stdout.splitlines():
    for field in line.split():
        if '/' in field:
            try:
                host.add(ipaddress.ip_interface(field).ip)
            except ValueError:
                pass
if not dns or not dns.issubset(host):
    raise SystemExit(f"DNS check failed: {domain} resolves to {sorted(map(str, dns))}, but this host has global addresses {sorted(map(str, host))}. Confirm the A/AAAA records before provisioning. No Nginx files were changed.")
print(f"DNS check passed: {domain} -> {', '.join(sorted(map(str, dns)))} (local host address match)")
PY

if [[ ! -f "$PRODUCTION_CONFIG" ]]; then
  echo "Full app proxy not configured: ${PRODUCTION_CONFIG} is missing. Use scripts/install-domain-certificate.sh for certificate-only HTTPS until the production app is ready." >&2
  exit 1
fi
set -a
source "$PRODUCTION_CONFIG"
set +a
if [[ "${DEMO_MODE:-true}" != false ]]; then
  echo "Full app proxy blocked: production.env must set DEMO_MODE=false." >&2
  exit 1
fi
configured_jwt_secret="${JWT_SECRET:-}"
if [[ "${#configured_jwt_secret}" -lt 32 || "$configured_jwt_secret" == *replace* ]]; then
  echo "Full app proxy blocked: production.env must contain a unique JWT_SECRET of at least 32 characters." >&2
  exit 1
fi
for service in aios-api aios-worker aios-voice aios-web; do
  if ! systemctl is-active --quiet "${service}.service"; then
    echo "Full app proxy blocked: ${service}.service is not active. Deploy the app first." >&2
    exit 1
  fi
done

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y certbot
fi

if ! nginx -T 2>&1 | grep -i ngx_http_brotli >/dev/null; then
  apt-get update
  if apt-cache show libnginx-mod-http-brotli-filter >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
  fi
fi

mkdir -p "$WEBROOT/.well-known/acme-challenge"
if [[ -e "$SITE" && ! -e "${SITE}.aios-backup" ]]; then cp -a "$SITE" "${SITE}.aios-backup"; fi

write_site() {
  local with_tls="$1"
  local brotli=""
  if nginx -T 2>&1 | grep -i ngx_http_brotli >/dev/null; then
    brotli=$'    brotli on;\n    brotli_comp_level 5;\n    brotli_types text/plain text/css text/xml application/javascript application/json application/xml image/svg+xml;'
  fi
  if [[ "$with_tls" == yes ]]; then
    cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 100M;
    location ^~ /.well-known/acme-challenge/ { root ${WEBROOT}; default_type text/plain; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};
    client_max_body_size 100M;
    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:AIOS_TLS:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' wss: https:; media-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_vary on;
    gzip_types text/plain text/css text/xml application/javascript application/json application/xml image/svg+xml;
${brotli}

    location /api/v1/live {
        proxy_pass http://127.0.0.1:34000/api/v1/live;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 3600s;
    }
    location /voice/ {
        proxy_pass http://127.0.0.1:34100/voice/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 3600s;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:34000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 120s;
    }
    location / {
        proxy_pass http://127.0.0.1:33000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
    }
}
NGINX
  else
    cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 100M;
    location ^~ /.well-known/acme-challenge/ { root ${WEBROOT}; default_type text/plain; }
    location / { return 200 'AI Employee OS certificate bootstrap'; add_header Content-Type text/plain; }
}
NGINX
  fi
  chmod 0644 "$SITE"
}

if [[ -s "${CERT_DIR}/fullchain.pem" && -s "${CERT_DIR}/privkey.pem" ]]; then write_site yes; else write_site no; fi
ln -sfn "$SITE" "$ENABLED"
nginx -t
systemctl reload nginx

if [[ ! -s "${CERT_DIR}/fullchain.pem" ]]; then
  if [[ -n "$CERTBOT_EMAIL" ]]; then
    certbot certonly --webroot -w "$WEBROOT" --non-interactive --agree-tos --email "$CERTBOT_EMAIL" -d "$DOMAIN"
  else
    certbot certonly --webroot -w "$WEBROOT" --non-interactive --agree-tos --register-unsafely-without-email -d "$DOMAIN"
  fi
fi

write_site yes
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
systemctl status certbot.timer --no-pager
certbot renew --dry-run

headers="$(curl --fail --silent --show-error --http2 --head "https://${DOMAIN}/")"
printf '%s\n' "$headers"
if ! grep -qE '^HTTP/2 200' <<<"$headers"; then echo "HTTPS verification failed: expected HTTP/2 200 from /" >&2; exit 1; fi
health="$(curl --fail --silent --show-error "https://${DOMAIN}/api/health")"
printf '%s\n' "$health"
if [[ "$health" != '{"status":"ok"}' ]]; then echo "API health verification failed: ${health}" >&2; exit 1; fi
echo "Provisioning complete: https://${DOMAIN}"
