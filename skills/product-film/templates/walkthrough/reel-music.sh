#!/usr/bin/env bash
# Lay a music track under a reel, edited on the track's own bar grid (references/reel-style.md § Fitting the track).
# Usage, from any directory: BPM=127.5 DROP=30.44 KEEP="-2:9,12:17" TEMPO=0.95 bash <film>/reel-music.sh <track> [R]
#   BPM    the track's tempo (beatmap.py prints it)
#   DROP   track seconds of the downbeat the reveal lands on; bar n of the track starts at DROP + n bars
#   KEEP   track bar ranges to keep, inclusive, relative to the drop: "-2:9,12:17" starts two bars before the drop, plays
#          through bar 9, cuts bars 10-11, then plays bars 12-17 (so a breakdown and a re-hit land on the film's bars).
#          Default "-2:999": two bars of lead-in, no cuts.
#   TEMPO  1 by default; 0.95 plays the edit 5 % slower with the pitch kept (set BPM in reel.html to BPM × TEMPO)
#   LUFS   -16 by default (two-pass loudnorm, true peak -1.5 dBTP); FADE seconds of fade-out at the end, 1.6 by default
# Writes music/reel-music.m4a and film-<NAME>-music.mp4, film-<NAME>-music_720.mp4, film-<NAME>-music_master.mp4;
# the video streams are copied untouched. The audio is padded to the film's length, so -shortest never drops a frame.
set -euo pipefail
cd "$(dirname "$0")"
TRACK=${1:?track file}; NAME=${2:-R}
[ -f "$TRACK" ] || TRACK="$OLDPWD/$TRACK"
: "${BPM:?BPM of the track}" "${DROP:?track seconds of the drop}"
KEEP=${KEEP:--2:999}; TEMPO=${TEMPO:-1}; LUFS=${LUFS:--16}; FADE=${FADE:-1.6}
MASTER="film-${NAME}_master.mp4"; [ -f "$MASTER" ] || { echo "no $MASTER: run assemble.sh first"; exit 1; }
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$MASTER")
TD=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$TRACK")
mkdir -p music
# the filter: one trimmed segment per KEEP range, 12 ms fades at every splice, joined, then the tempo change
FC=$(python3 - "$BPM" "$DROP" "$KEEP" "$TEMPO" "$TD" <<'PY'
import sys
bpm, drop, keep, tempo, td = float(sys.argv[1]), float(sys.argv[2]), sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
bar = 240 / bpm; parts = []; labels = []
rs = [tuple(int(x) for x in r.split(':')) for r in keep.split(',')]
for i, (a, b) in enumerate(rs):
    t0, t1 = max(0, drop + a * bar), min(td, drop + (b + 1) * bar)
    f = f'[0:a]atrim={t0:.4f}:{t1:.4f},asetpts=PTS-STARTPTS'
    if i: f += ',afade=t=in:d=0.012'
    if i < len(rs) - 1: f += f',afade=t=out:st={t1 - t0 - 0.012:.4f}:d=0.012'
    parts.append(f + f'[s{i}]'); labels.append(f'[s{i}]')
tail = f'concat=n={len(rs)}:v=0:a=1' + (f',atempo={tempo}' if tempo != 1 else '')
print(';'.join(parts) + ';' + ''.join(labels) + tail + '[m]')
PY
)
ffmpeg -v error -y -i "$TRACK" -filter_complex "$FC" -map "[m]" -c:a pcm_s16le music/edit.wav
M=$(ffmpeg -hide_banner -i music/edit.wav -af "loudnorm=I=$LUFS:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | python3 -c "import sys,re,json; m=json.loads(re.findall(r'\{[^{}]*\}', sys.stdin.read())[-1]); print(f\"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}\")")
ffmpeg -v error -y -i music/edit.wav -af "loudnorm=I=$LUFS:TP=-1.5:LRA=11:$M:linear=true,afade=t=in:d=0.02,afade=t=out:st=$(python3 -c "print(f'{max(0, $D - $FADE):.3f}')"):d=$FADE,aresample=48000,apad" -t "$D" -c:a aac -b:a 256k music/reel-music.m4a
for f in "film-${NAME}" "film-${NAME}_720" "film-${NAME}_master"; do [ -f "$f.mp4" ] || continue
  out="${f/film-${NAME}/film-${NAME}-music}.mp4"
  ffmpeg -v error -y -i "$f.mp4" -i music/reel-music.m4a -map 0:v -map 1:a -c:v copy -c:a copy -shortest -movflags +faststart "$out"; echo "$out"; done
echo "music $(python3 -c "print(f'{$TD:.1f}')") s track → $(python3 -c "print(f'{$D:.2f}')") s film; check the splices by ear"
