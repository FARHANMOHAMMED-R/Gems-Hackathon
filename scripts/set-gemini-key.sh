#!/usr/bin/env bash
# Configure Gemini for local dev (backend .env + frontend bootstrap).
# Usage: ./scripts/set-gemini-key.sh "AIzaSy..."
set -euo pipefail

KEY="${1:-}"
if [ -z "$KEY" ] || [ "${#KEY}" -lt 20 ]; then
  echo "Usage: ./scripts/set-gemini-key.sh \"YOUR_GEMINI_API_KEY\""
  echo "Get a free key at https://aistudio.google.com/apikey"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

# Update or append GEMINI_API_KEY in backend .env
if grep -q '^GEMINI_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=\"$KEY\"|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
else
  echo "GEMINI_API_KEY=\"$KEY\"" >> "$ENV_FILE"
fi

# Frontend auto-seed on page load
cat > "$FRONTEND_ENV" <<EOF
# Local only — gitignored. Auto-loads Gemini into all AI tools.
VITE_GEMINI_API_KEY=$KEY
EOF

echo "✓ Gemini key saved to .env and frontend/.env.local"
echo "  Restart backend: npm run dev"
echo "  Hard refresh: http://localhost:5173"
