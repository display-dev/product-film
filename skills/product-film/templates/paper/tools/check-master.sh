#!/bin/bash
# check-master.sh <outdir> <base name> <expected frames> [fps 30]: exact frame count, constant timing, colour tags,
# VMAF (upload copy vs master), loudness and true peak. Appends one line to <outdir>/checks.txt.
OUT=$1; NAME=$2; N=$3; FPS=${4:-30}
MF=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$OUT/${NAME}_master.mov")
HF=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of default=nw=1:nk=1 "$OUT/${NAME}_h264.mp4")
JUMPS=$(ffprobe -v error -select_streams v:0 -show_entries frame=pts_time -of default=nw=1:nk=1 "$OUT/${NAME}_h264.mp4" | python3 -c "import sys;t=[float(x) for x in sys.stdin if x.strip()];d=[b-a for a,b in zip(t,t[1:])];print(sum(1 for x in d if abs(x-1/$FPS)>0.002), 'of', len(d))")
AD=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of default=nw=1:nk=1 "$OUT/${NAME}_h264.mp4")
VD=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of default=nw=1:nk=1 "$OUT/${NAME}_h264.mp4")
TAGS=$(ffprobe -v error -select_streams v:0 -show_entries stream=color_space,color_primaries,color_transfer,color_range,profile,level -of compact=p=0 "$OUT/${NAME}_h264.mp4")
# VMAF needs an ffmpeg built with libvmaf. Without it the line says "VMAF not measured" and gates.py reports it.
if ffmpeg -hide_banner -filters 2>/dev/null | grep -q libvmaf; then
  VMAF=$(ffmpeg -nostdin -hide_banner -i "$OUT/${NAME}_h264.mp4" -i "$OUT/${NAME}_master.mov" -lavfi "[0:v]setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS,format=yuv420p[b];[a][b]libvmaf=n_threads=8" -f null - 2>&1 | grep -o "VMAF score: [0-9.]*" | tail -1)
  [ -n "$VMAF" ] || VMAF="VMAF not measured (libvmaf failed)"
else VMAF="VMAF not measured (this ffmpeg has no libvmaf)"; fi
LOUD=$(ffmpeg -nostdin -hide_banner -nostats -i "$OUT/${NAME}_h264.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E " I:|Peak:" | tr -s ' ' | tr '\n' ' ')
echo "$NAME | frames master $MF, h264 $HF (expected $N) | timing jumps $JUMPS | video ${VD}s audio ${AD}s | $TAGS | $VMAF | audio $LOUD" | tee -a "$OUT/checks.txt"
