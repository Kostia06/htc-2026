#!/usr/bin/env bash
# Two ways to get demo footage out of the Quest into vr/recordings/:
#
#   npm run record          live capture over USB (left eye + the headset's sound). Ctrl+C stops.
#   npm run record -- pull  copy the Quest's own recordings (Meta button > Camera > Record video;
#                           turn on "Record mic audio" there to get your voice too).
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p recordings
adb get-state >/dev/null 2>&1 || { echo "No Quest over USB. Plug it in and allow USB debugging."; exit 1; }

if [ "${1:-}" = "pull" ]; then
  adb shell 'ls /sdcard/Oculus/VideoShots/*.mp4 2>/dev/null' | tr -d '\r' | while read -r file; do
    [ -n "$file" ] || continue
    name=$(basename "$file")
    [ -f "recordings/$name" ] || adb pull "$file" "recordings/$name" >/dev/null && echo "  $name"
  done
  echo "Done. Files are in vr/recordings/"
  exit 0
fi

# Keep the display on while nobody wears it (the proximity sensor would blank it).
adb shell input keyevent KEYCODE_WAKEUP
adb shell am broadcast -a com.oculus.vrpowermanager.prox_close >/dev/null
trap 'adb shell am broadcast -a com.oculus.vrpowermanager.automation_disable >/dev/null 2>&1 || true' EXIT

name="recordings/skillit-vr-$(date +%Y%m%d-%H%M%S)"
# mkv survives Ctrl+C; it is remuxed to mp4 afterwards
raw="$name.mkv"; out="$name.mp4"
# Quest 3 draws both eyes side by side (4128x2208); keep the left eye so the video isn't doubled.
echo "Recording to $out. Press Ctrl+C to stop."
scrcpy --no-window --crop="${CROP:-2064:2208:0:0}" --max-fps=60 --video-bit-rate=16M \
  --audio-source=playback --audio-dup --no-audio-playback --record="$raw" || true
ffmpeg -loglevel error -y -i "$raw" -c copy "$out" && rm -f "$raw" || out="$raw"
echo "Saved $out"
