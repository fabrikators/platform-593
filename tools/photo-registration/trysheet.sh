#!/bin/zsh
# trysheet.sh <outDir> <id> '<json array of 4 poses>'   four poses of one photo as a 2x2 overlay sheet (reading order)
S=${0:A:h}
out=$1; id=$2; arr=$3
mkdir -p $out
python3 -I -c "
import json,sys
a=json.loads(sys.argv[2]); json.dump({f'{sys.argv[1]}#{k}': v for k, v in enumerate(a)}, open(sys.argv[3],'w'))
" $id "$arr" $out/try.json
node $S/overlay.cjs $out/try.json - $out "$id#0,$id#1,$id#2,$id#3" > /dev/null
magick \( $out/o-${id}_0.jpg $out/o-${id}_1.jpg -resize 480x +append \) \( $out/o-${id}_2.jpg $out/o-${id}_3.jpg -resize 480x +append \) -append $out/try-$id.jpg
