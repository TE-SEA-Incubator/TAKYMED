#!/bin/bash
DOMAIN="dev.takymed.com"
TARGET_PORT="3500"

ssh root@82.165.150.150 << EOF
    apt-get install -y caddy
    systemctl stop nginx
    systemctl disable nginx

    echo "$DOMAIN {
        reverse_proxy localhost:$TARGET_PORT
    }" > /etc/caddy/Caddyfile

    systemctl restart caddy
    systemctl enable caddy
EOF
