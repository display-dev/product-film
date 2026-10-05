#!/bin/bash
# Assemble one output from its frames: bash <film>/film/assemble.sh <fmt> <cap 1|0> <version>
# → out/vN/<name>-<fmt>[-nocap]-vN_master.mov (ProRes 422 HQ, 10-bit, BT.709, PCM SFX) + _h264.mp4 (upload copy) + checks.
# One ffmpeg pass over numbered frames: no chunks to join, so no dropped frames and no audio drift.
set -e
F="$(cd "$(dirname "$0")/.." && pwd)"; cd "$F"
FMT=${1:-16x9}; CAP=${2:-1}; V=${3:?version}; SUF=$([ "$CAP" = 0 ] && echo "-nocap" || true)
case $FMT in 16x9) WH=1920:1080;; 9x16) WH=1080:1920;; 4x5) WH=1080:1350;; esac
read -r NAME FPS N < <(python3 -c "import json;d=json.load(open('film/timeline.json'));print(d['name'],d['fps'],round(d['duration']*d['fps']))")
PY=$([ -x .venv/bin/python ] && echo .venv/bin/python || echo python3)
FR="frames/$FMT$SUF"; OUT="out/$V"; mkdir -p "$OUT"; BASE="$NAME-$FMT$SUF-$V"
COUNT=$(ls "$FR" | grep -c '^f_.*\.jpg$'); [ "$COUNT" = "$N" ] || { echo "frame count $COUNT != $N"; exit 1; }
[ -f "$OUT/sfx.wav" ] || $PY sfx/mix.py "$OUT/sfx.wav" > /dev/null
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
# master: sRGB frames → RGB → lanczos downscale → BT.709 limited-range 4:2:2 10-bit, tags matching the pixels
ffmpeg -nostdin -v error -y -framerate "$FPS" -i "$FR/f_%05d.jpg" -i "$OUT/sfx.wav" \
  -vf "format=gbrp,scale=$WH:flags=lanczos+accurate_rnd+full_chroma_int,scale=out_color_matrix=bt709:out_range=tv,format=yuv422p10le" \
  -c:v prores_ks -profile:v 3 -vendor apl0 $COLOR -c:a pcm_s24le -ar 48000 -shortest -map 0:v -map 1:a "$OUT/${BASE}_master.mov"
# upload copy: H.264 High, level 4.1, CRF 18, faststart, AAC
ffmpeg -nostdin -v error -y -i "$OUT/${BASE}_master.mov" -c:v libx264 -preset slow -crf 18 -profile:v high -level:v 4.1 -pix_fmt yuv420p \
  -x264-params "colorprim=bt709:transfer=bt709:colormatrix=bt709" $COLOR -c:a aac -b:a 192k -movflags +faststart "$OUT/${BASE}_h264.mp4"
bash "$F/tools/check-master.sh" "$OUT" "$BASE" "$N" "$FPS"
