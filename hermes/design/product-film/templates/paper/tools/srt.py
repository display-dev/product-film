# Write the .srt from the same timeline the film renders from: python3 tools/srt.py [out.srt]
import json, os, sys
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); tl = json.load(open(f'{F}/film/timeline.json'))
def ts(t): ms = round(t * 1000); return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'
out = sys.argv[1] if len(sys.argv) > 1 else f'{F}/out/{tl["name"]}.srt'
os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, 'w') as f:
    for i, c in enumerate(tl['captions'], 1): f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
print('wrote', out, len(tl['captions']), 'cues')
