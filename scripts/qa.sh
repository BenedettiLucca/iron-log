#!/usr/bin/env bash
# qa.sh — single entrypoint for Android agent QA (Iron Log)
# Usage: scripts/qa.sh <command>
#   boot | install | app | stop | reset | logs | smoke | status | snap
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=android-qa.env
source "$REPO/scripts/android-qa.env"
ADB="$ANDROID_HOME/platform-tools/adb"

cmd="${1:-status}"

serial_alive() { [ "$("$ADB" -s "$DEVICE_SERIAL" get-state 2>/dev/null)" = "device" ]; }

wait_boot() {
  local deadline=$((SECONDS + BOOT_TIMEOUT))
  while [ "$("$ADB" -s "$DEVICE_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '[:space:]')" != "1" ]; do
    if [ $SECONDS -gt $deadline ]; then
      echo "TIMEOUT waiting for boot ($DEVICE_SERIAL) after ${BOOT_TIMEOUT}s"
      return 1
    fi
    # emulator process may die mid-boot — surface it instead of sleeping forever
    # (pattern covers both the launcher binary and the re-exec'd qemu-system process)
    if ! pgrep -f "(emulator|qemu).*${AVD_NAME}" >/dev/null 2>&1 && ! serial_alive; then
      echo "emulator died during boot — see $EVIDENCE_DIR/emulator.log"
      return 1
    fi
    sleep 2
  done
}

case "$cmd" in
  boot)
    mkdir -p "$REPO/$EVIDENCE_DIR"
    if serial_alive; then echo "ONLINE (already booted): $DEVICE_SERIAL"; exit 0; fi
    # ensure adb server exists; never kill-server — it disrupts other concurrent sessions
    "$ADB" start-server >/dev/null 2>&1 || true
    export ANDROID_HOME JAVA_HOME
    # quick boot by default (warm restore in seconds); COLD_BOOT=1 forces -no-snapshot
    nohup "$ANDROID_HOME/emulator/emulator" -avd "$AVD_NAME" \
      -port "$EMU_PORT" -no-window -no-audio -no-boot-anim -gpu swiftshader_indirect \
      ${COLD_BOOT:+-no-snapshot} \
      > "$REPO/$EVIDENCE_DIR/emulator.log" 2>&1 &
    echo "booting $AVD_NAME on port $EMU_PORT (pid $!)"
    wait_boot
    # kill animations for deterministic QA
    "$ADB" -s "$DEVICE_SERIAL" shell settings put global window_animation_scale 0
    "$ADB" -s "$DEVICE_SERIAL" shell settings put global transition_animation_scale 0
    "$ADB" -s "$DEVICE_SERIAL" shell settings put global animator_duration_scale 0
    echo "ONLINE: $DEVICE_SERIAL"
    ;;

  install)
    serial_alive || { echo "emulator offline — run: scripts/qa.sh boot"; exit 1; }
    APK="$(ls -t "$REPO"/android/app/build/outputs/apk/debug/*.apk 2>/dev/null | head -1 || true)"
    if [ -z "$APK" ]; then
      "$0" build
      APK="$(ls -t "$REPO"/android/app/build/outputs/apk/debug/*.apk | head -1)"
    fi
    "$ADB" -s "$DEVICE_SERIAL" install -r "$APK"
    echo "INSTALLED: $APK"
    ;;

  build)
    echo "building assembleDebug (several minutes on first run)..."
    (cd "$REPO/android" && JAVA_HOME="$JAVA_HOME" ./gradlew assembleDebug -x lint --console=plain -q)
    echo "BUILD OK"
    ;;

  metro)
    # debug builds load JS from Metro; also exposes Hermes CDP targets
    if curl -sf http://localhost:8081/status >/dev/null 2>&1; then
      echo "METRO: already running"
    else
      echo "starting Metro (log: $EVIDENCE_DIR/metro.log)..."
      (cd "$REPO" && CI=1 nohup npx expo start --dev-client --port 8081 \
        > "$REPO/$EVIDENCE_DIR/metro.log" 2>&1 & echo $! > "$REPO/$EVIDENCE_DIR/metro.pid")
      local_deadline=$((SECONDS + 120))
      until curl -sf http://localhost:8081/status >/dev/null 2>&1; do
        [ $SECONDS -gt $local_deadline ] && { echo "TIMEOUT waiting for Metro — see $EVIDENCE_DIR/metro.log"; exit 1; }
        sleep 2
      done
      echo "METRO: ready on :8081"
    fi
    ;;

  app)
    serial_alive || { echo "emulator offline — run: scripts/qa.sh boot"; exit 1; }
    if [ "$("$ADB" -s "$DEVICE_SERIAL" shell pm list packages 2>/dev/null | grep -c "$APP_ID" || true)" -eq 0 ]; then
      echo "app not installed — run: scripts/qa.sh install"
      exit 1
    fi
    # debug builds fetch JS from Metro — ensure it before launch
    if "$ADB" -s "$DEVICE_SERIAL" shell pm path "$APP_ID" 2>/dev/null | grep -q "debug\|base.apk"; then
      "$0" metro
      "$ADB" -s "$DEVICE_SERIAL" reverse tcp:8081 tcp:8081
    fi
    "$ADB" -s "$DEVICE_SERIAL" shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
    echo "LAUNCHED: $APP_ID"
    ;;

  stop)
    if serial_alive; then
      "$ADB" -s "$DEVICE_SERIAL" emu kill >/dev/null 2>&1 || pkill -f "qemu.*$AVD_NAME" || true
      echo "stopped: $DEVICE_SERIAL"
    else
      echo "emulator already offline"
    fi
    ;;

  reset)
    serial_alive || { echo "emulator offline — run: scripts/qa.sh boot"; exit 1; }
    "$ADB" -s "$DEVICE_SERIAL" shell pm clear "$APP_ID" >/dev/null
    echo "RESET: $APP_ID data cleared"
    ;;

  logs)
    serial_alive || { echo "emulator offline"; exit 1; }
    # RN + app + crash signals only, not the firehose
    "$ADB" -s "$DEVICE_SERIAL" logcat -d -t 500 ReactNativeJS:V ReactNative:V "*:S" \
      AndroidRuntime:E ActivityManager:I CRASH:E libc:F DEBUG 2>/dev/null \
    || "$ADB" -s "$DEVICE_SERIAL" logcat -d -t 300
    ;;

  snap)
    serial_alive || { echo "emulator offline"; exit 1; }
    mkdir -p "$REPO/$EVIDENCE_DIR"
    OUT="$REPO/$EVIDENCE_DIR/screenshot-$(date +%Y%m%d-%H%M%S).png"
    "$ADB" -s "$DEVICE_SERIAL" exec-out screencap -p > "$OUT"
    echo "saved: $OUT"
    ;;

  smoke)
    serial_alive || { echo "emulator offline — run: scripts/qa.sh boot"; exit 1; }
    cd "$REPO"
    maestro test "$MAESTRO_FLOWS_DIR/smoke-app-launch.yaml"
    ;;

  status)
    if serial_alive; then
      echo "emulator: ONLINE ($DEVICE_SERIAL)"
      echo "boot_completed: $("$ADB" -s "$DEVICE_SERIAL" shell getprop sys.boot_completed 2>/dev/null)"
      if "$ADB" -s "$DEVICE_SERIAL" shell pm path "$APP_ID" >/dev/null 2>&1; then
        echo "app: installed ($APP_ID)"
        PID="$("$ADB" -s "$DEVICE_SERIAL" shell pidof "$APP_ID" 2>/dev/null | tr -d '[:space:]')"
        [ -n "$PID" ] && echo "app: RUNNING (pid $PID)" || echo "app: not running"
      else
        echo "app: NOT installed"
      fi
      pgrep -f "qemu.*$AVD_NAME" >/dev/null 2>&1 && echo "qemu process: alive" || echo "qemu process: none"
    else
      pgrep -f "qemu.*$AVD_NAME" >/dev/null 2>&1 && echo "emulator: BOOTING/DEGRADED (process alive, adb not ready)" \
        || echo "emulator: OFFLINE"
    fi
    ;;

  *)
    echo "unknown command: $cmd"
    echo "usage: scripts/qa.sh {boot|install|app|stop|reset|logs|snap|smoke|status}"
    exit 2
    ;;
esac
