#!/bin/sh
# Reinstall the Skillit Quest app over USB. Its content is vr.skillit.study, so a normal VR deploy needs no reinstall.
APK="$HOME/Projects/skillit-quest/app-release-signed.apk"
[ -f "$APK" ] || { echo "No APK at $APK; build it first with ~/Projects/skillit-quest/build-install.sh"; exit 1; }
adb install -r "$APK" && adb shell monkey -p study.skillit.vr -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1 && echo "Skillit is open on the Quest"
