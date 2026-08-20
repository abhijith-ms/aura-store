#!/bin/bash
# In-app askpass helper for Aura Store
# Bridges sudo password requests directly to the Aura Web UI

PORT=3001
PROMPT_TEXT="$1"

# Request password from Aura backend
RESP=$(curl -s -m 90 -X POST "http://localhost:${PORT}/api/auth/askpass" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\": \"${PROMPT_TEXT}\"}" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$RESP" ]; then
  PASS=$(echo "$RESP" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);if(j.password){process.stdout.write(j.password);process.exit(0);}else{process.exit(1);}}catch{process.exit(1);}});")
  if [ $? -eq 0 ] && [ -n "$PASS" ]; then
    echo "$PASS"
    exit 0
  fi
fi

# Fallback to desktop dialogs if backend is unreachable
if command -v kdialog >/dev/null 2>&1; then
  kdialog --password "Aura Store requires administrative privileges:" 2>/dev/null
elif command -v zenity >/dev/null 2>&1; then
  zenity --password --title="Aura Store Authentication" 2>/dev/null
else
  exit 1
fi
