#!/usr/bin/env python3
"""Upload a playable or hybrid to Cloudflare R2, the copy viewers load. Run it before pushing to GitHub.

  python tools/upload-mock.py playable/<name>            upload what is new or changed
  python tools/upload-mock.py playable/<name> --dry-run  only show what it would upload

It writes only to mocks/<format>/<name>/ and never deletes anything. Files already identical are skipped and
mock.html goes last, so a new page never points at a file that isn't there yet. Left out: the review page
(index.html beside mock.html), SOURCES.md, CLAUDE.md, dotfiles, node_modules and anything git-ignored.

Credentials, never in this repo: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, from the environment or from
a file outside the repo, ~/cloudflare-creative-mocks.env, one KEY=value per line.
"""
import datetime, hashlib, hmac, json, os, re, subprocess, sys, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

BUCKET = "campaign-creatives"
DOMAIN = "https://campaign-creatives.iion.media"
REPO = Path(__file__).resolve().parent.parent
ENV_FILE = Path.home() / "cloudflare-creative-mocks.env"
TYPES = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
         ".json": "application/json", ".txt": "text/plain; charset=utf-8", ".glb": "model/gltf-binary",
         ".hdr": "application/octet-stream", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg",
         ".jpeg": "image/jpeg", ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".wav": "audio/wav",
         ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "video/mp4", ".webm": "video/webm", ".woff2": "font/woff2",
         ".woff": "font/woff", ".ttf": "font/ttf", ".otf": "font/otf"}


def credentials():
    vals = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                vals[key.strip()] = value.strip().strip('"')
    token = os.environ.get("CLOUDFLARE_API_TOKEN") or vals.get("CLOUDFLARE_API_TOKEN")
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID") or vals.get("CLOUDFLARE_ACCOUNT_ID")
    if not token or not account:
        sys.exit(f"STOP: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in {ENV_FILE} or in the environment")
    return token, account


class R2:
    """R2's S3 API: the access key is the token's id, the secret is the SHA-256 of the token."""

    def __init__(self):
        token, account = credentials()
        req = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{account}/tokens/verify",
                                     headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                self.key_id = json.load(resp)["result"]["id"]
        except urllib.error.HTTPError as e:
            sys.exit(f"STOP: Cloudflare refused the token ({e.code})")
        self.secret = hashlib.sha256(token.encode()).hexdigest()
        self.host = f"{account}.r2.cloudflarestorage.com"

    def call(self, method, key="", query=None, body=b"", headers=None):
        now = datetime.datetime.now(datetime.timezone.utc)
        stamp, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
        path = "/" + BUCKET + ("/" + urllib.parse.quote(key, safe="/-_.~") if key else "")
        canon_query = "&".join(f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(v, safe='-_.~')}"
                               for k, v in sorted((query or {}).items()))
        body_hash = hashlib.sha256(body).hexdigest()
        signed_headers = {"host": self.host, "x-amz-content-sha256": body_hash, "x-amz-date": stamp,
                          **{k.lower(): v for k, v in (headers or {}).items()}}
        names = sorted(signed_headers)
        signed = ";".join(names)
        canon = "\n".join([method, path, canon_query, "".join(f"{n}:{signed_headers[n]}\n" for n in names), signed, body_hash])
        scope = f"{day}/auto/s3/aws4_request"
        to_sign = f"AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{hashlib.sha256(canon.encode()).hexdigest()}"
        k = ("AWS4" + self.secret).encode()
        for part in (day, "auto", "s3", "aws4_request"):
            k = hmac.new(k, part.encode(), hashlib.sha256).digest()
        signature = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
        send = {n: v for n, v in signed_headers.items() if n != "host"}
        send["Authorization"] = f"AWS4-HMAC-SHA256 Credential={self.key_id}/{scope}, SignedHeaders={signed}, Signature={signature}"
        url = f"https://{self.host}{path}" + (f"?{canon_query}" if canon_query else "")
        req = urllib.request.Request(url, data=body if method == "PUT" else None, method=method, headers=send)
        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                return resp.status, resp.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", "replace")

    def listing(self, prefix):
        """{key: md5} of everything under the prefix."""
        found, query = {}, {"list-type": "2", "max-keys": "1000", "prefix": prefix}
        while True:
            status, xml = self.call("GET", query=query)
            if status != 200:
                sys.exit(f"STOP: could not list {prefix}: {status} {xml[:250]}")
            root = ET.fromstring(xml)
            ns = root.tag[:root.tag.index("}") + 1] if root.tag.startswith("{") else ""
            for item in root.findall(f"{ns}Contents"):
                found[item.findtext(f"{ns}Key")] = item.findtext(f"{ns}ETag", "").strip('"')
            next_token = root.findtext(f"{ns}NextContinuationToken")
            if not next_token:
                return found
            query = {**query, "continuation-token": next_token}

    def put(self, key, data):
        if not key.startswith("mocks/"):
            sys.exit(f"STOP: {key} is outside mocks/")
        status, resp = self.call("PUT", key, body=data, headers={"Content-Type": TYPES[Path(key).suffix.lower()],
                                                                  "Cache-Control": "public, max-age=600"})
        if status != 200:
            sys.exit(f"STOP at {key}: {status} {resp[:250]}")


def mock_files(mock):
    out = subprocess.check_output(["git", "-C", str(REPO), "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", mock])
    files = []
    for rel in sorted(set(f for f in out.decode().split("\0") if f)):
        inner = rel[len(mock) + 1:]
        parts = inner.split("/")
        if inner == "index.html" or parts[-1] in ("SOURCES.md", "CLAUDE.md") or "node_modules" in parts or any(p.startswith(".") for p in parts):
            continue
        if (REPO / rel).is_file():
            files.append(inner)
    return files


def main():
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry = "--dry-run" in sys.argv[1:]
    mock = args[0].strip("/").replace("\\", "/") if len(args) == 1 else ""
    if not re.fullmatch(r"(playable|hybrid)/[A-Za-z0-9][A-Za-z0-9_-]*", mock):
        sys.exit("usage: python tools/upload-mock.py playable/<name> or hybrid/<name> [--dry-run]")
    if not (REPO / mock / "mock.html").is_file():
        sys.exit(f"STOP: {mock}/mock.html not found")
    files = mock_files(mock)
    unknown = sorted(f for f in files if Path(f).suffix.lower() not in TYPES)
    if unknown:
        sys.exit(f"STOP: no file type set for {unknown}; add it to TYPES or remove the file. Nothing uploaded")

    r2, prefix = R2(), f"mocks/{mock}/"
    remote = r2.listing(prefix)
    changed = [f for f in files if remote.get(prefix + f) != hashlib.md5((REPO / mock / f).read_bytes()).hexdigest()]
    changed.sort(key=lambda f: f == "mock.html")
    for f in changed:
        print(("would upload " if dry else "upload ") + prefix + f)
        if not dry:
            r2.put(prefix + f, (REPO / mock / f).read_bytes())
    print(f"{len(changed)} of {len(files)} files {'would be ' if dry else ''}uploaded, the rest are already identical")

    extra = sorted(k[len(prefix):] for k in remote if k[len(prefix):] not in files)
    if extra:
        print("on Cloudflare but not in this folder (left alone):", ", ".join(extra))
    url = f"{DOMAIN}/{prefix}mock.html"
    print("game:", url)
    page = REPO / mock / "index.html"
    if page.is_file() and url not in page.read_text(encoding="utf-8"):
        print("NOTE: index.html doesn't load this URL yet: set the iframe src and data-full to it, and remove data-ripple")
    if "../" in (REPO / mock / "mock.html").read_text(encoding="utf-8"):
        print("NOTE: mock.html has a ../ path: anything outside this folder isn't on Cloudflare, so check it still loads")
    if changed and not dry:
        print("Cloudflare can keep the old files for up to 10 minutes. A new ?v= on the link doesn't skip that for code files.")


if __name__ == "__main__":
    main()
