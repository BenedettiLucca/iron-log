#!/bin/bash
export ANDROID_HOME=$(pwd)/android-sdk
export PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$PATH

echo "Using Android SDK at: $ANDROID_HOME"

if ! command -v adb &> /dev/null; then
    echo "Error: adb not found in path. Please check SDK installation."
    exit 1
fi

npx expo run:android
