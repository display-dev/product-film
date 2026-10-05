#!/usr/bin/env bash
# Product film (Routes A and B): cuts footage segments from footage/ and joins them with the product beats render.js
# wrote to seg/, in the order of the cut list below.
# Footage: put each licensed clip in footage/ named <id>_<anything> (stock libraries usually start the file name
# with the clip id). Edit the IN column (seconds into the source clip) after looking at each clip; durations come
# from the storyboard.
# Usage, from any directory: bash <film>/assemble.sh
#   -> film_master.mp4, film.mp4 (web, 1080p), film_720.mp4 (review), poster.jpg (at POSTER_AT s), sheet.jpg (1 fps)
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p cuts
POSTER_AT=${POSTER_AT:-3.9}
V=(-c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r 25 -an)
: > list.txt   # the concat list; its paths resolve relative to the list file
next(){ printf "c%02d.mp4" "$(wc -l < list.txt | tr -d ' ')"; }
src(){ ls footage/"$1"_* 2>/dev/null | grep -v crdownload | head -1 || true; }
# footage cut: id in dur [zoom]. A static zoom factor here does nothing after the refit; for a real push-in render
#   the segment through zoompan on an 8K upscale: scale=7680:-2,zoompan=z='1.15+0.07*on/25':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=25
cut(){
  f=$(src "$1"); [ -n "$f" ] || { echo "MISSING footage for $1 (expected footage/$1_*)"; exit 1; }
  z=${4:-1.0}; o=$(next)
  ffmpeg -v error -ss "$2" -t "$3" -i "$f" \
    -vf "scale=iw/$z:ih/$z:flags=lanczos,crop=iw/$z*$z:ih/$z*$z,scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos,crop=1920:1080,setsar=1,eq=saturation=0.92:contrast=1.03,format=yuv420p" \
    "${V[@]}" "cuts/$o" -y
  echo "file 'cuts/$o'" >> list.txt
  printf "%-8s footage %-10s in=%-5s dur=%-4s zoom=%s\n" "$o" "$1" "$2" "$3" "$z"
}
# product beat: id (seg/<id>.mp4 from render.js)
prod(){
  [ -f "seg/$1.mp4" ] || { echo "MISSING seg/$1.mp4 (run render.js)"; exit 1; }
  o=$(next); ffmpeg -v error -i "seg/$1.mp4" -vf "scale=1920:1080,setsar=1,format=yuv420p" "${V[@]}" "cuts/$o" -y
  echo "file 'cuts/$o'" >> list.txt; printf "%-8s product %s\n" "$o" "$1"
}

# ---------- cut list, in film order ----------
# Route A alternates footage and product beats (short–short–long); Route B keeps only prod lines.
#     id         IN    DUR   ZOOM    shot
# cut ext-wide   15.0  1.5   1.0   # wide exterior opener
# cut arrive     2.0   1.5   1.0   # the protagonist arrives
prod b1                            # the agent publishes the page
prod b2                            # a comment, the reply, v2
prod b3                            # shared with the client
# cut ext-wide   1.5   1.75  1.0   # wide exterior closer: the loop seams

ffmpeg -v error -f concat -safe 0 -i list.txt -vf "setsar=1,fps=25" -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -an -video_track_timescale 25000 film_master.mp4 -y
ffmpeg -v error -i film_master.mp4 -c:v libx264 -preset slow -crf 22 -maxrate 3500k -bufsize 7000k -pix_fmt yuv420p -movflags +faststart -an film.mp4 -y
ffmpeg -v error -i film_master.mp4 -vf scale=1280:720 -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart -an film_720.mp4 -y
ffmpeg -v error -ss "$POSTER_AT" -i film_master.mp4 -frames:v 1 -q:v 3 poster.jpg -y
ffmpeg -v error -i film_master.mp4 -vf "fps=1,scale=240:-1,tile=8x5" -frames:v 1 sheet.jpg -y
echo; echo "built in $(pwd):"; for f in film.mp4 film_720.mp4; do printf "%s  %ss  %sMB\n" "$f" "$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")" "$(( $(wc -c < "$f") / 1048576 ))"; done
