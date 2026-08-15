#!/usr/bin/env python3
"""IPTV 直播播放器 - 本地服务器（可选）

两种用法:
  1. 纯静态（不开代理）: 双击 player/index.html 即可，无法直连的源会自动走公共转发
  2. 本机代理（最稳）  : 运行本脚本，再打开 http://127.0.0.1:<端口>/player/
                        页面自动识别本机代理，转发 m3u8/TS 请求解决跨域与防盗链。

用法:
    python player/server.py [端口]
"""
import os
import re
import sys
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8000
PROXY_UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
URI_RE = re.compile(r'(?m)^([^\s#][^\s]*?)\s*$')
KEY_URI_RE = re.compile(r'URI="([^"]+)"')


def is_playlist(url: str, ctype: str) -> bool:
    path = urllib.parse.urlparse(url).path.lower()
    return path.endswith('.m3u8') or 'mpegurl' in ctype.lower()


def rewrite_playlist(text: str, base: str) -> str:
    """将 m3u8 内所有相对/绝对 URI 改写为本地代理地址"""
    def resolve(uri: str) -> str:
        uri = uri.strip()
        if not uri or uri.startswith('#') or uri.startswith('data:'):
            return uri
        if uri.startswith('/proxy?url='):
            return uri
        if uri.startswith(('http://', 'https://')):
            full = uri
        else:
            full = urllib.parse.urljoin(base, uri)
        return '/proxy?url=' + urllib.parse.quote(full, safe='')

    text = URI_RE.sub(lambda m: resolve(m.group(1)), text)
    return KEY_URI_RE.sub(lambda m: 'URI="' + resolve(m.group(1)) + '"', text)


class PlayerHandler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _send(self, status: int, body: bytes, ctype: str):
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache')
        self.end_headers()
        try:
            self.wfile.write(body)
        except Exception:
            pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != '/proxy':
            return super().do_GET()

        qs = urllib.parse.parse_qs(parsed.query)
        url = (qs.get('url') or [''])[0]
        if not url.startswith(('http://', 'https://')):
            self._send(400, b'bad url', 'text/plain; charset=utf-8')
            return

        referer = (qs.get('ref') or [''])[0] or (
            urllib.parse.urlparse(url).scheme + '://' +
            urllib.parse.urlparse(url).netloc + '/'
        )
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': PROXY_UA, 'Referer': referer
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                ctype = resp.headers.get('Content-Type', 'application/octet-stream')
                data = resp.read()
        except Exception as e:
            self._send(502, str(e).encode('utf-8', 'replace'), 'text/plain; charset=utf-8')
            return

        if is_playlist(url, ctype):
            base = url[:url.rfind('/') + 1] if '/' in url else url
            try:
                text = data.decode('utf-8', 'ignore')
                data = rewrite_playlist(text, base).encode('utf-8', 'ignore')
            except Exception:
                pass
            ctype = 'application/vnd.apple.mpegurl'

        self._send(200, data, ctype)

    def log_message(self, fmt, *args):
        sys.stderr.write('[server] %s\n' % (fmt % args))


def main():
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass
    httpd = ThreadingHTTPServer(('0.0.0.0', port), PlayerHandler)
    print('=' * 56)
    print('  IPTV 播放器本地服务器')
    print('  本机代理播放: http://127.0.0.1:%d/' % port)
    print('  停止: Ctrl + C')
    print('=' * 56)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n服务器已停止')


if __name__ == '__main__':
    main()