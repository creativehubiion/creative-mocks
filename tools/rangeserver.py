import os, re, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class RangeHandler(SimpleHTTPRequestHandler):
    def _range_head(self):
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.exists(path):
            return super().send_head()
        rng = self.headers.get('Range')
        size = os.path.getsize(path)
        ctype = self.guess_type(path)
        if not rng:
            self.send_response(200)
            self.send_header('Content-Type', ctype)
            self.send_header('Content-Length', str(size))
            self.send_header('Accept-Ranges', 'bytes')
            self.end_headers()
            return open(path, 'rb')
        m = re.match(r'bytes=(\d*)-(\d*)', rng)
        start = int(m.group(1)) if m.group(1) else 0
        end = int(m.group(2)) if m.group(2) else size - 1
        end = min(end, size - 1)
        self.send_response(206)
        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        f = open(path, 'rb'); f.seek(start)
        self._range_len = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        n = getattr(self, '_range_len', None)
        if n is None:
            return super().copyfile(source, outputfile)
        while n > 0:
            chunk = source.read(min(65536, n))
            if not chunk: break
            outputfile.write(chunk); n -= len(chunk)

    def log_message(self, *a): pass

    # never serve private files when the server is reachable on the LAN
    BLOCK = ('/.git', '/claude.md', '/_work/shrek-5-gemini-pack', '/_work/shrek-5-unused', '/.claude')
    def send_head(self):
        p = self.path.split('?', 1)[0].lower()
        if any(p == b or p.startswith(b + '/') or p.startswith(b) for b in self.BLOCK):
            self.send_error(404); return None
        return self._range_head()

if __name__ == '__main__':
    # usage: python rangeserver.py <root> <port> [host]   (host 0.0.0.0 = reachable from other devices on the LAN)
    os.chdir(sys.argv[1]); port = int(sys.argv[2]); host = sys.argv[3] if len(sys.argv) > 3 else '127.0.0.1'
    ThreadingHTTPServer((host, port), RangeHandler).serve_forever()
