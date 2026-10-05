#!/bin/bash
# Final deliverables from a version's masters: bash tools/deliver.sh vN <poster-seconds>
# → deliver/: masters, upload copies, .srt, the website MP4 (one click-to-play H.264/AAC file to hand to the site's
# video pipeline with the poster), an AV1 → HEVC → H.264 set (smallest first), posters.
# AV1 goes in MP4, not WebM: a WebM's 1 ms timebase made VMAF misalign frames. Check each web file with VMAF ≥ 96.
# VMAF needs an ffmpeg built with libvmaf; without it vmaf.txt says "not measured" for every file.
set -e
F="$(cd "$(dirname "$0")/.." && pwd)"; cd "$F"; V=${1:?version}; PT=${2:?poster seconds}; O="deliver"; mkdir -p "$O/web"
NAME=$(python3 -c "import json;print(json.load(open('film/timeline.json'))['name'])")
for n in 16x9 9x16 16x9-nocap 4x5; do
  [ -f "out/$V/$NAME-$n-${V}_master.mov" ] || continue
  cp "out/$V/$NAME-$n-${V}_master.mov" "$O/$NAME-${n}_master.mov"
  cp "out/$V/$NAME-$n-${V}_h264.mp4" "$O/$NAME-${n}_upload.mp4"
done
python3 tools/srt.py "$O/$NAME.srt"
M="out/$V/$NAME-16x9-${V}_master.mov"; C="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"
X264="colorprim=bt709:transfer=bt709:colormatrix=bt709"
ffmpeg -nostdin -v error -y -i "$M" -c:v libx264 -preset veryslow -crf 20 -profile:v high -level:v 4.1 -pix_fmt yuv420p -x264-params "$X264" $C -c:a aac -b:a 160k -movflags +faststart "$O/web/$NAME-web.mp4"
SVT_LOG=1 ffmpeg -nostdin -v error -y -i "$M" -c:v libsvtav1 -preset 4 -crf 40 -pix_fmt yuv420p10le $C -c:a aac -b:a 96k -movflags +faststart "$O/web/$NAME-av1.mp4"
ffmpeg -nostdin -v error -y -i "$M" -c:v libx265 -preset slow -crf 27 -tag:v hvc1 -pix_fmt yuv420p -x265-params "$X264:log-level=error" $C -c:a aac -b:a 96k -movflags +faststart "$O/web/$NAME-hevc.mp4"
ffmpeg -nostdin -v error -y -i "$M" -c:v libx264 -preset veryslow -crf 23 -profile:v high -level:v 4.1 -pix_fmt yuv420p -x264-params "$X264" $C -c:a aac -b:a 128k -movflags +faststart "$O/web/$NAME-h264.mp4"
ffmpeg -nostdin -v error -y -ss "$PT" -i "$M" -frames:v 1 -vf "scale=out_color_matrix=bt709:out_range=pc" "$O/web/$NAME-poster.png"
ffmpeg -nostdin -v error -y -i "$O/web/$NAME-poster.png" -q:v 3 "$O/web/$NAME-poster.jpg"
ffmpeg -nostdin -v error -y -ss 0 -i "$M" -frames:v 1 -vf "scale=out_color_matrix=bt709:out_range=pc" "$O/$NAME-frame0.png"
rm -f "$O/web/vmaf.txt"
HAS_VMAF=$(ffmpeg -hide_banner -filters 2>/dev/null | grep -q libvmaf && echo 1 || true)
for w in web av1 hevc h264; do
  if [ -n "$HAS_VMAF" ]; then S=$(ffmpeg -nostdin -hide_banner -i "$O/web/$NAME-$w.mp4" -i "$M" -lavfi "[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS,format=yuv420p[b];[a][b]libvmaf=n_threads=8" -f null - 2>&1 | grep -o "VMAF score: [0-9.]*" | tail -1)
  else S="VMAF not measured (this ffmpeg has no libvmaf)"; fi
  echo "$NAME-$w.mp4 $(du -h "$O/web/$NAME-$w.mp4" | cut -f1) $S" | tee -a "$O/web/vmaf.txt"
done
