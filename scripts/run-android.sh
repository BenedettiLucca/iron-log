#!/usr/bin/env bash
set -euo pipefail

# Respect existing ANDROID_HOME or ANDROID_SDK_ROOT if explicitly defined
if [ -z "${ANDROID_HOME:-}" ]; then
  if [ -n "${ANDROID_SDK_ROOT:-}" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
  elif [ -d "$HOME/Android/Sdk" ]; then
    export ANDROID_HOME="$HOME/Android/Sdk"
  elif [ -d "/opt/android-sdk" ]; then
    export ANDROID_HOME="/opt/android-sdk"
  elif [ -d "$PWD/android-sdk" ]; then
    export ANDROID_HOME="$PWD/android-sdk"
  fi
fi

if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "Error: ANDROID_HOME is not set or directory does not exist." >&2
  echo "Please set ANDROID_HOME or install the Android SDK." >&2
  exit 1
fi

export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$PATH"

if ! command -v adb >/dev/null 2>&1; then
  echo "Error: adb not found at $ANDROID_HOME/platform-tools/adb or in PATH." >&2
  exit 1
fi

echo "Using Android SDK at: $ANDROID_HOME"

if [ "${1:-}" = "--dry-run" ]; then
  echo "Dry run successful: adb resolved at $(command -v adb)"
  exit 0
fi

exec npx expo run:android "$@"
