#!/bin/bash
# stills.sh <master> <outdir> [step s 2.5] [width 1280]: full-frame stills every <step> seconds, for looking at
# changed beats at full size (clipping at the frame edge and soft text show here, not on the phone sheet).
M=$1; O=$2; S=${3:-2.5}; WD=${4:-1280}; mkdir -p "$O"
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$M")
python3 -c "
import subprocess
d=float('$D'); t=0.3
while t<d:
    subprocess.run(['ffmpeg','-nostdin','-v','error','-y','-ss',f'{t:.2f}','-i','$M','-frames:v','1','-vf','scale=$WD:-2:flags=lanczos:out_color_matrix=bt709:out_range=pc','-q:v','3',f'$O/still-{t:05.1f}s.jpg'])
    t+=$S
"
ls "$O" | wc -l
