#!/usr/bin/env bash
# Encode a plan's clips from frames/<plan>/<clip> at 60 fps and join them with the plan's dissolve.
# Usage, from any directory: bash <film>/assemble.sh plan-A.json
#   -> film-A_master.mp4, film-A.mp4 (1080p60, for a video-host upload), film-A_720.mp4, poster-A.jpg, sheet-A.jpg
set -euo pipefail
cd "$(dirname "$0")"
PLAN=${1:-plan-A.json}; FPS=${FPS:-60}
[ -f "$PLAN" ] || PLAN="$OLDPWD/$PLAN"
read -r NAME XF PW PH <<<"$(python3 -c "import json,sys;p=json.load(open(sys.argv[1]));print(p['name'],p['xf'],p.get('w',1920),p.get('h',1080))" "$PLAN")"
IDS=($(python3 -c "import json,sys;print(' '.join(c['id'] for c in json.load(open(sys.argv[1]))['clips']))" "$PLAN"))
mkdir -p "seg/$NAME"
for id in "${IDS[@]}"; do
  ffmpeg -v error -y -framerate "$FPS" -i "frames/$NAME/$id/f_%05d.jpg" -vf "scale=${PW}:${PH}:flags=lanczos,format=yuv420p" -c:v libx264 -preset medium -crf 15 -an -video_track_timescale 60000 "seg/$NAME/$id.mp4"
done
inputs=(); filter=""; off=0; prev="[0:v]"
for i in "${!IDS[@]}"; do inputs+=(-i "seg/$NAME/${IDS[$i]}.mp4"); done
for ((i=1; i<${#IDS[@]}; i++)); do   # not seq: on macOS `seq 1 0` counts down
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "seg/$NAME/${IDS[$((i-1))]}.mp4")
  off=$(python3 -c "print(round($off + $d - $XF, 4))")
  filter+="${prev}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${off}[v${i}];"
  prev="[v${i}]"
done
if [ ${#IDS[@]} -eq 1 ]; then fc=(); map="0:v"; else fc=(-filter_complex "${filter%;}"); map="$prev"; fi   # one clip: no dissolves
ffmpeg -v error -y "${inputs[@]}" ${fc[@]+"${fc[@]}"} -map "$map" -c:v libx264 -preset medium -crf 14 -pix_fmt yuv420p -r "$FPS" -an "film-${NAME}_master.mp4"
ffmpeg -v error -y -i "film-${NAME}_master.mp4" -c:v libx264 -preset slow -crf 18 -maxrate 14000k -bufsize 28000k -pix_fmt yuv420p -movflags +faststart -an "film-${NAME}.mp4"
ffmpeg -v error -y -i "film-${NAME}_master.mp4" -vf "scale=$((PW*2/3)):$((PH*2/3))" -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart -an "film-${NAME}_720.mp4"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "film-${NAME}_master.mp4")
ffmpeg -v error -y -ss "$(python3 -c "print(max(0, round($D-2.2,2)))")" -i "film-${NAME}_master.mp4" -frames:v 1 -q:v 2 "poster-${NAME}.jpg"
ffmpeg -v error -y -i "film-${NAME}_master.mp4" -vf "fps=1,scale=240:-1,tile=8x9" -frames:v 1 "sheet-${NAME}.jpg"
for f in "film-${NAME}.mp4" "film-${NAME}_720.mp4"; do printf "%s  %ss  %sMB\n" "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" "$(( $(wc -c < "$f") / 1048576 ))"; done
echo "in $(pwd)"
