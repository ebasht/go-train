#!/bin/sh
set -eu

url="${VITE_SUPABASE_URL:-}"
key="${VITE_SUPABASE_ANON_KEY:-}"

if [ -z "$url" ] || [ -z "$key" ]; then
  echo "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY on the container. The image build does not embed them." >&2
  exit 1
fi

case "$key" in
  sb_secret_*)
    echo "Refusing to start: VITE_SUPABASE_ANON_KEY is a secret key. Use the anon or publishable key." >&2
    exit 1
    ;;
esac

payload=$(printf '%s' "$key" | cut -d. -f2 | tr '_-' '/+')
case $((${#payload} % 4)) in
  2) payload="${payload}==" ;;
  3) payload="${payload}=" ;;
esac
if [ -n "$payload" ] && printf '%s' "$payload" | base64 -d 2>/dev/null | grep -q '"role"[[:space:]]*:[[:space:]]*"service_role"'; then
  echo "Refusing to start: VITE_SUPABASE_ANON_KEY is a service_role key." >&2
  exit 1
fi

js_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g'
}

{
  printf '%s\n' 'window.__GO_TRACKER_CONFIG__ = {'
  printf '  url: "%s",\n' "$(js_escape "$url")"
  printf '  anonKey: "%s"\n' "$(js_escape "$key")"
  printf '%s\n' '};'
} > /usr/share/nginx/html/config.js

exec /docker-entrypoint.sh "$@"
