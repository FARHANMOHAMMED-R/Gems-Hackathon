#!/usr/bin/env bash
# Configure OpenAI for local dev (backend .env + frontend bootstrap).
# Usage: ./scripts/set-openai-key.sh "sk-..."
set -euo pipefail

KEY="${1:-}"
if [ -z "$KEY" ] || [ "${#KEY}" -lt 20 ]; then
  echo "Usage: ./scripts/set-openai-key.sh \"YOUR_OPENAI_API_KEY\""
  echo "Get a key at https://platform.openai.com/api-keys"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
FRONTEND_ENV="$ROOT/frontend/.env.local"

if grep -q '^OPENAI_API_KEY=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=\"$KEY\"|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
else
  echo "OPENAI_API_KEY=\"$KEY\"" >> "$ENV_FILE"
fi

if grep -q '^LLM_DEFAULT_PROVIDER=' "$ENV_FILE" 2>/dev/null; then
  sed -i.bak 's|^LLM_DEFAULT_PROVIDER=.*|LLM_DEFAULT_PROVIDER="openai"|' "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
fi

GEMINI_LINE=""
if [ -f "$FRONTEND_ENV" ] && grep -q '^VITE_GEMINI_API_KEY=' "$FRONTEND_ENV" 2>/dev/null; then
  GEMINI_LINE=$(grep '^VITE_GEMINI_API_KEY=' "$FRONTEND_ENV")
fi

cat > "$FRONTEND_ENV" <<EOF
# Local only — gitignored. Auto-loads OpenAI into all AI tools.
VITE_OPENAI_API_KEY=$KEY
${GEMINI_LINE}
EOF

echo "✓ OpenAI key saved to .env and frontend/.env.local"
echo "  Restart backend: npm run dev"
echo "  Hard refresh: http://localhost:5173"
