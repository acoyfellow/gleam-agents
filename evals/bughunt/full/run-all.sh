#!/bin/bash
cd /Users/jcoeyman/cloudflare/gleam-agents
export LLM_URL=http://127.0.0.1:9 LLM_TOKEN_FILE=/tmp/fleet-token.txt
for i in 1 2 3 4; do
  bash scripts/smoke.sh evals/bughunt/full/plan-b$i.json proof/bughunt-full-b$i > proof-bughunt-full-b$i.log 2>&1
  echo "batch $i done $(date +%H:%M)" >> proof-bughunt-full.log
done
python3 - <<'PY'
import json,glob,os
out={}
for i in range(1,5):
    for f in glob.glob(f'proof/bughunt-full-b{i}/work/*/review.md'):
        cid=os.path.basename(os.path.dirname(f)).replace('rev-','')
        out[cid]=open(f).read()
json.dump(out, open('/Users/jcoeyman/cloudflare/review-lab-data/bughunt-full-reviews.json','w'))
print('reviews',len(out))
PY
cd /Users/jcoeyman/cloudflare/review-lab-data && LAB_JOBS=10 python3 /Users/jcoeyman/cloudflare/review-lab/lab/judge.py bughunt-full-reviews.json judge-bughunt-full > bughunt-judge.log 2>&1
echo "ALLDONE $(date +%H:%M)" >> /Users/jcoeyman/cloudflare/gleam-agents/proof-bughunt-full.log
