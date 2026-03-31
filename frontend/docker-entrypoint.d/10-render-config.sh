#!/bin/sh
set -eu

: "${ADMIN_API_KEY:?ADMIN_API_KEY is required}"
: "${STAGING_BASIC_AUTH_USER:?STAGING_BASIC_AUTH_USER is required}"
: "${STAGING_BASIC_AUTH_PASSWORD:?STAGING_BASIC_AUTH_PASSWORD is required}"

htpasswd_hash="$(openssl passwd -apr1 "${STAGING_BASIC_AUTH_PASSWORD}")"
printf '%s:%s\n' "${STAGING_BASIC_AUTH_USER}" "${htpasswd_hash}" > /etc/nginx/.htpasswd

cat > /etc/nginx/conf.d/default.conf <<EOF
server {
  listen 80;
  server_name _;
  server_tokens off;

  root /usr/share/nginx/html;
  index index.html;
  client_max_body_size 20m;

  auth_basic "Casino Sandbox Admin";
  auth_basic_user_file /etc/nginx/.htpasswd;

  location = /healthz {
    auth_basic off;
    access_log off;
    add_header Content-Type text/plain;
    add_header X-Content-Type-Options nosniff always;
    return 200 'ok';
  }

  location /api/ {
    proxy_pass http://backend:8080/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Admin-Key ${ADMIN_API_KEY};
    proxy_hide_header X-Powered-By;
  }

  location / {
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Content-Security-Policy "default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
    try_files \$uri \$uri/ /index.html;
  }
}
EOF
