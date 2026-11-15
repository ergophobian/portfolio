"""Download CC0 models from Poly Pizza into <outdir>. Usage: fetch-polypizza.py <outdir> name:id ..."""
import os, re, subprocess, sys
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
def curl(url, out=None):
    args = ["curl", "-sL", "-A", UA, "--max-time", "90", url]
    if out:
        args += ["-o", out]
    return subprocess.run(args, capture_output=True).stdout.decode("utf8", "ignore")
outdir = sys.argv[1]
os.makedirs(outdir, exist_ok=True)
for pair in sys.argv[2:]:
    name, mid = pair.split(":")
    html = curl(f"https://poly.pizza/m/{mid}")
    url = re.search(r"https://static\.poly\.pizza/[a-f0-9-]+\.glb", html)
    lic = re.search(r'"Licence":"([^"]*)"', html)
    title = re.search(r"<title>([^<]*)</title>", html)
    if not url:
        print(name, "NO URL"); continue
    out = os.path.join(outdir, name + ".glb")
    curl(url.group(0), out)
    print(name, mid, url.group(0), lic.group(1) if lic else "?", title.group(1) if title else "", os.path.getsize(out))
