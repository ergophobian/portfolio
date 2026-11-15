"""Download Poly Haven (CC0) glTF models at a given resolution into tools/raw/<id>/.
Usage: python3 -I fetch-polyhaven.py <outdir> <res> <id> [<id> ...]"""
import json, os, subprocess, sys
UA = "Mozilla/5.0 asset-fetch"
def curl(url, out=None):
    args = ["curl", "-sL", "-A", UA, "--max-time", "180", url]
    if out:
        args += ["-o", out]
    r = subprocess.run(args, capture_output=True)
    return r.stdout
outdir, res = sys.argv[1], sys.argv[2]
for aid in sys.argv[3:]:
    files = json.loads(curl(f"https://api.polyhaven.com/files/{aid}"))
    g = files["gltf"].get(res) or files["gltf"]["1k"]
    g = g["gltf"]
    d = os.path.join(outdir, aid)
    os.makedirs(d, exist_ok=True)
    curl(g["url"], os.path.join(d, aid + ".gltf"))
    total = g.get("size", 0)
    for rel, inc in g.get("include", {}).items():
        p = os.path.join(d, rel)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        if not os.path.exists(p):
            curl(inc["url"], p)
        total += inc.get("size", 0)
    print(aid, round(total / 1e6, 2), "MB", len(g.get("include", {})), "files")
