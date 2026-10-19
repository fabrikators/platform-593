#!/bin/zsh
# candsheet.sh <gs.json> <outDir> id...   the global search's best 4 candidates per photo as one 2x2 sheet (reading order = rank)
S=${0:A:h}
gs=$1; out=$2; shift 2
mkdir -p $out
python3 -I - "$gs" "$out/cands.json" "$@" <<'PY'
import json, sys
gs, out, *ids = sys.argv[1:]
G = json.load(open(gs))
json.dump({f"{i}#{k}": c for i in ids for k, c in enumerate(G[i][:4])}, open(out, 'w'))
PY
keys=(); for id in "$@"; do for k in 0 1 2 3; do keys+="$id#$k"; done; done
node $S/overlay.cjs $out/cands.json - $out ${(j:,:)keys} > /dev/null
for id in "$@"; do
  magick \( $out/o-${id}_0.jpg $out/o-${id}_1.jpg -resize 480x +append \) \( $out/o-${id}_2.jpg $out/o-${id}_3.jpg -resize 480x +append \) -append $out/sheet-$id.jpg
done
