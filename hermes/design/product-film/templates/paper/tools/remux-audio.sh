#!/bin/bash
# Audio-only recut: bash tools/remux-audio.sh vFrom vTo – re-mix the audio from the timeline and put it on the vFrom
# pictures (video streams copied bit for bit), so every picture check carries over. Use it after an SFX-only change.
set -e
F="$(cd "$(dirname "$0")/.." && pwd)"; cd "$F"; A=${1:?from}; B=${2:?to}; mkdir -p "out/$B"; rm -f "out/$B/checks.txt"
PY=$([ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
$PY sfx/mix.py "out/$B/sfx.wav"
read -r NAME FPS N < <(python3 -c "import json;d=json.load(open('film/timeline.json'));print(d['name'],d['fps'],round(d['duration']*d['fps']))")
for n in 16x9 9x16 16x9-nocap 4x5; do
  [ -f "out/$A/$NAME-$n-${A}_master.mov" ] || continue
  ffmpeg -nostdin -v error -y -i "out/$A/$NAME-$n-${A}_master.mov" -i "out/$B/sfx.wav" -map 0:v -map 1:a -c:v copy -c:a pcm_s24le -ar 48000 -shortest "out/$B/$NAME-$n-${B}_master.mov"
  ffmpeg -nostdin -v error -y -i "out/$A/$NAME-$n-${A}_h264.mp4" -i "out/$B/sfx.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "out/$B/$NAME-$n-${B}_h264.mp4"
  bash tools/check-master.sh "out/$B" "$NAME-$n-$B" "$N" "$FPS"
done
