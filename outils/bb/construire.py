# python3 outils/bb/construire.py  → écrit socle/bb/*.json et ajoute le niveau « bb » à socle/index.json
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import francais, maths, histoire, sciences

root = os.path.join(os.path.dirname(__file__), "..", "..")
toutes = francais.F + maths.F + histoire.F + histoire.E + sciences.S + sciences.T
par_mat, index = {}, []
for fid, d in toutes:
    sid = fid.split("-")[2]
    par_mat.setdefault(sid, {})[fid] = d
    index.append({"id": fid, "sid": sid, "title": d["title"], "difficulty": d["difficulty"], "n": int(fid.split("-")[3])})
os.makedirs(os.path.join(root, "socle", "bb"), exist_ok=True)
for sid, fiches in par_mat.items():
    with open(os.path.join(root, "socle", "bb", sid + ".json"), "w", encoding="utf-8") as f:
        json.dump({"fiches": fiches}, f, ensure_ascii=False, separators=(",", ":"))
p = os.path.join(root, "socle", "index.json")
idx = json.load(open(p, encoding="utf-8"))
idx["levels"]["bb"] = index
json.dump(idx, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(toutes), "fiches ·", {k: len(v) for k, v in par_mat.items()}, "·", sum(len(d["quiz"]) for _, d in toutes), "questions")
