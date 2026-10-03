#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="aiemployee.btcpay.exchange"
SITE="/etc/nginx/sites-available/${DOMAIN}"
ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"
WEBROOT="/var/www/letsencrypt"
STATUS_ROOT="/var/www/aiemployee"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
RENEWAL_HOOK="/etc/letsencrypt/renewal-hooks/deploy/reload-aiemployee-nginx"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@btcpay.exchange}"

if [[ "$(id -u)" -ne 0 ]]; then
  exec sudo --preserve-env=CERTBOT_EMAIL "$0" "$@"
fi

python3 - "$DOMAIN" <<'PY'
import ipaddress, socket, subprocess, sys
domain = sys.argv[1]
try:
    dns = {ipaddress.ip_address(item[4][0].split('%')[0].replace('::ffff:', '')) for item in socket.getaddrinfo(domain, None, type=socket.SOCK_STREAM)}
except (OSError, ValueError) as error:
    raise SystemExit(f"DNS check failed: {domain} does not resolve ({error}). Nginx was not changed.")
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
    raise SystemExit(f"DNS check failed: {domain} resolves to {sorted(map(str, dns))}, but this host has global addresses {sorted(map(str, host))}. Confirm A/AAAA before provisioning. Nginx was not changed.")
print(f"DNS check passed: {domain} -> {', '.join(sorted(map(str, dns)))}")
PY

command -v certbot >/dev/null 2>&1 || { echo "Certbot is missing; install it before running this certificate-only installer." >&2; exit 1; }
if ! nginx -T 2>&1 | grep -i ngx_http_brotli >/dev/null; then
  if apt-cache show libnginx-mod-http-brotli-filter >/dev/null 2>&1 && apt-cache show libnginx-mod-http-brotli-static >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y libnginx-mod-http-brotli-filter libnginx-mod-http-brotli-static
  fi
fi
mkdir -p "$WEBROOT/.well-known/acme-challenge" "$STATUS_ROOT"
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
    server_tokens off;
    client_max_body_size 100M;
    location ^~ /.well-known/acme-challenge/ { root ${WEBROOT}; default_type text/plain; try_files \$uri =404; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name ${DOMAIN};
    server_tokens off;
    client_max_body_size 100M;
    ssl_certificate ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:AIOS_TLS:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self' wss:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;

    gzip on;
    gzip_comp_level 5;
    gzip_min_length 256;
    gzip_vary on;
    gzip_types text/plain text/css text/xml application/javascript application/json application/xml image/svg+xml;
${brotli}

    location = /api/health {
        proxy_pass http://127.0.0.1:14000/api/health;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
    }
    location ^~ /api/ { return 503; }
    location / { root ${STATUS_ROOT}; try_files \$uri /index.html; }
}
NGINX
  else
    cat > "$SITE" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    server_tokens off;
    client_max_body_size 100M;
    location ^~ /.well-known/acme-challenge/ { root ${WEBROOT}; default_type text/plain; try_files \$uri =404; }
    location / { return 503 'AI Employee OS TLS setup in progress'; add_header Content-Type text/plain; }
}
NGINX
  fi
  chmod 0644 "$SITE"
}

cat > "${STATUS_ROOT}/index.html" <<'HTML'
<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Employee OS</title><main><h1>AI Employee OS</h1><p>The secure application workspace is being prepared.</p></main></html>
HTML
chmod 0644 "${STATUS_ROOT}/index.html"

if [[ -s "${CERT_DIR}/fullchain.pem" && -s "${CERT_DIR}/privkey.pem" ]]; then
  write_site yes
else
  write_site no
fi
ln -sfn "$SITE" "$ENABLED"
nginx -t
systemctl reload nginx

if [[ ! -s "${CERT_DIR}/fullchain.pem" || ! -s "${CERT_DIR}/privkey.pem" ]]; then
  certbot certonly --webroot -w "$WEBROOT" --non-interactive --agree-tos --email "$CERTBOT_EMAIL" --cert-name "$DOMAIN" -d "$DOMAIN"
fi

mkdir -p "$(dirname "$RENEWAL_HOOK")"
cat > "$RENEWAL_HOOK" <<'HOOK'
#!/usr/bin/env bash
set -Eeuo pipefail
case " ${RENEWED_DOMAINS:-} " in
  *" aiemployee.btcpay.exchange "*) ;;
  *) exit 0 ;;
esac
nginx -t
systemctl reload nginx
HOOK
chmod 0755 "$RENEWAL_HOOK"

write_site yes
nginx -t
systemctl reload nginx
systemctl enable --now certbot.timer
systemctl status certbot.timer --no-pager
certbot renew --cert-name "$DOMAIN" --dry-run --no-random-sleep-on-renew

headers="$(curl --fail --silent --show-error --http2 --head "https://${DOMAIN}/")"
printf '%s\n' "$headers"
grep -qE '^HTTP/2 200' <<<"$headers" || { echo "HTTPS check failed: expected HTTP/2 200." >&2; exit 1; }
health="$(curl --fail --silent --show-error "https://${DOMAIN}/api/health")"
printf '%s\n' "$health"
[[ "$health" == '{"status":"ok"}' ]] || { echo "API health check failed: ${health}" >&2; exit 1; }
echo "Certificate installed for ${DOMAIN}; public app routes remain closed until production authentication is ready."
