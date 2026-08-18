#!/bin/bash
if command -v kdialog >/dev/null 2>&1; then
  kdialog --password "Aura Store requires administrative privileges:" 2>/dev/null
elif command -v zenity >/dev/null 2>&1; then
  zenity --password --title="Aura Store Authentication" 2>/dev/null
else
  exit 1
fi
