#!/bin/sh
set -eu

case "$PORT" in
    ''|*[!0-9]*) echo "PORT must be a numeric TCP port" >&2; exit 1 ;;
esac
if [ "$PORT" -le 1023 ] || [ "$PORT" -gt 65535 ] || [ "$PORT" -eq 5002 ]; then
    echo "PORT must be between 1024 and 65535 and different from the internal API port 5002" >&2
    exit 1
fi

envsubst '${PORT}' < /app/deploy/nginx.conf.template > /tmp/application-maker-nginx.conf
nginx -t -c /tmp/application-maker-nginx.conf
exec supervisord -c /app/deploy/supervisord.conf
