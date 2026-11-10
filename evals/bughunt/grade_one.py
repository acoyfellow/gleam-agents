#!/usr/bin/env python3
import hashlib, json, os, re, subprocess, sys

CASE = sys.argv[1]
HERE = "/Users/jcoeyman/cloudflare/review-lab/lab"
PROMPT = open(os.path.join(HERE, "judge-prompt.txt")).read()
VERDICT = re.compile(r"CAUGHT:\s*(ALARM|LOW|NO)")
bench = {c["id"]: c for c in json.load(open(os.path.join(HERE, "bench.json")))}
review = open("review.md").read() if os.path.exists("review.md") else ""
case = bench[CASE]
grades = []
for i, bug in enumerate(case["bugs"]):
    if not review.strip():
        grades.append("NO")
        continue
    text = PROMPT.replace("{truth}", bug["truth"]).replace("{review}", review[:60000])
    key = "/tmp/bughunt-grade-" + hashlib.sha1(text.encode()).hexdigest()[:16]
    if not os.path.exists(key + ".out") or os.path.getsize(key + ".out") == 0:
        open(key + ".task", "w").write(text)
        with open(key + ".out", "w") as f:
            subprocess.run(["perl", "-e", "alarm 300; exec @ARGV", "pi", "-p", "--no-session", "--no-tools", "--model", "claude-opus-5-5", "@" + key + ".task", "Do the task in the attached file."], stdout=f, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL)
    found = VERDICT.findall(open(key + ".out").read())
    grades.append(found[-1] if found else "NO")
alarms = grades.count("ALARM")
print(f"{CASE}: {alarms}/{len(grades)} ALARM, grades={grades}")
sys.exit(0 if alarms >= 1 else 1)
