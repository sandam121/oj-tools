import base64
import io
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

try: from PIL import Image
except ImportError: print("pip install Pillow"); exit(1)

# 来自真实验证码训练的模板 (7行 x 4列)
TEMPLATES = {
    '0': [0.0,0.2,0.2,0.0, 0.2,0.05,0.05,0.2, 0.2,0.0,0.0,0.2, 0.2,0.0,0.0,0.2, 0.2,0.0,0.0,0.2, 0.2,0.05,0.05,0.2, 0.0,0.2,0.2,0.0],
    '1': [0.5,0.75,0.5,0.0, 0.19,0.5,0.5,0.0, 0.0,0.5,0.5,0.0, 0.0,0.5,0.5,0.0, 0.0,0.5,0.5,0.0, 0.0,0.5,0.5,0.0, 0.67,0.83,0.83,0.67],
    '2': [0.25,0.63,0.71,0.08, 0.25,0.33,0.33,0.58, 0.17,0.06,0.06,0.67, 0.13,0.0,0.25,0.5, 0.08,0.28,0.71,0.14, 0.25,0.67,0.13,0.0, 0.58,0.67,0.67,0.61],
    '3': [0.33,0.94,1.0,0.5, 0.33,0.06,0.06,0.83, 0.0,0.0,0.06,0.72, 0.11,0.33,0.89,0.48, 0.0,0.11,0.11,0.67, 0.0,0.06,0.06,0.72, 0.5,0.67,0.67,0.52],
    '4': [0.0,0.0,1.0,0.17, 0.0,0.67,0.83,0.33, 0.0,0.5,0.83,0.0, 0.25,0.67,0.67,0.17, 0.75,0.17,0.67,0.17, 1.0,1.0,1.0,0.67, 0.33,0.11,0.67,0.11],
    '5': [0.5,1.0,1.0,0.67, 0.5,0.5,0.0,0.0, 0.5,0.75,0.5,0.17, 0.5,0.5,0.75,0.67, 0.0,0.0,0.0,0.83, 0.0,0.0,0.0,0.67, 0.67,0.67,0.67,0.56],
    '6': [0.08,0.46,1.0,0.44, 0.63,0.71,0.08,0.15, 0.5,0.42,0.0,0.06, 0.58,0.79,1.0,0.44, 0.58,0.54,0.0,0.73, 0.54,0.33,0.0,0.58, 0.22,0.61,0.72,0.67],
    '7': [0.7,0.7,0.7,0.7, 0.1,0.1,0.1,0.7, 0.1,0.1,0.1,0.7, 0.1,0.1,0.7,0.5, 0.1,0.7,0.5,0.1, 0.7,0.5,0.1,0.1, 0.7,0.1,0.1,0.1],
    '8': [0.25,0.75,1.0,0.33, 0.75,0.0,0.0,0.5, 0.75,0.0,0.0,0.5, 0.0,1.0,1.0,0.33, 0.75,0.0,0.0,0.5, 1.0,0.0,0.0,0.67, 0.33,0.5,0.67,0.33],
    '9': [0.25,0.75,0.88,0.17, 0.63,0.0,0.0,0.42, 0.88,0.0,0.0,0.42, 0.5,0.5,0.5,0.67, 0.0,0.38,0.13,0.58, 0.0,0.0,0.0,0.42, 0.17,0.5,0.42,0.28],
}


def binarize(img):
    w, h = img.size
    counts = {}
    for y in range(h):
        for x in range(w):
            c = img.getpixel((x, y))
            if c != (0,0,0): counts[c] = counts.get(c, 0) + 1

    bg = max(counts, key=counts.get)
    bg_r, bg_g, bg_b = bg

    # 计算每个像素到背景的RGB距离
    dists = []
    for y in range(1, h-1):
        for x in range(1, w-1):
            r,g,b = img.getpixel((x, y))
            if r==0 and g==0 and b==0: continue
            d = ((r-bg_r)**2+(g-bg_g)**2+(b-bg_b)**2) ** 0.5
            if d > 0: dists.append(d)

    if not dists:
        return None

    dists.sort()

    # 遍历所有阈值，选连通域数在3-6之间的最小阈值（避免太碎/太粗）
    best_binary, best_valid = None, []
    for pct in range(25, 90, 5):
        t = dists[min(int(len(dists)*pct/100), len(dists)-1)]

        binary = [[0]*w for _ in range(h)]
        for y in range(1, h-1):
            for x in range(1, w-1):
                r,g,b = img.getpixel((x,y))
                if r==0 and g==0 and b==0: continue
                d = ((r-bg_r)**2+(g-bg_g)**2+(b-bg_b)**2) ** 0.5
                binary[y][x] = 1 if d > t else 0

        # 去噪
        for _ in range(2):
            cleaned = [row[:] for row in binary]
            for y in range(1, h-1):
                for x in range(1, w-1):
                    if binary[y][x]:
                        nb = sum(binary[ny][nx] for ny in (y-1,y,y+1) for nx in (x-1,x,x+1)) - binary[y][x]
                        if nb < 2: cleaned[y][x] = 0
            binary = cleaned

        # 连通域
        visited = [[False]*w for _ in range(h)]
        comps = []
        for y in range(1, h-1):
            for x in range(1, w-1):
                if binary[y][x] and not visited[y][x]:
                    stack = [(y,x)]; l,r,t2,b = x,x,y,y; sz=0
                    while stack:
                        cy,cx = stack.pop()
                        if visited[cy][cx]: continue
                        visited[cy][cx]=True; sz+=1
                        l=min(l,cx);r=max(r,cx); t2=min(t2,cy);b=max(b,cy)
                        for ny,nx in [(cy-1,cx-1),(cy-1,cx),(cy-1,cx+1),(cy,cx-1),(cy,cx+1),(cy+1,cx-1),(cy+1,cx),(cy+1,cx+1)]:
                            if 0<=ny<h and 0<=nx<w and binary[ny][nx] and not visited[ny][nx]:
                                stack.append((ny,nx))
                    comps.append({'l':l,'r':r,'t':t2,'b':b,'w':r-l+1,'h':b-t2+1,'sz':sz,'cx':(l+r)/2})

        valid = [c for c in comps if c['w']>=4 and c['h']>=10 and c['sz']>15]

        if 3 <= len(valid) <= 6:
            best_binary, best_valid = binary, valid
            break
        elif not best_binary and valid:
            best_binary, best_valid = binary, valid

    if not best_binary:
        return None

    return {'binary': best_binary, 'comps': best_valid}


def features(binary, c):
    w = len(binary[0]); h = len(binary)
    feats = []
    for rb in range(7):
        for cb in range(4):
            r0 = c['t'] + rb*c['h']//7; r1 = c['t'] + (rb+1)*c['h']//7
            c0 = c['l'] + cb*c['w']//4; c1 = c['l'] + (cb+1)*c['w']//4
            area = max(1, (r1-r0)*(c1-c0))
            px = sum(binary[y][x] for x in range(c0, min(c1,w)) for y in range(r0, min(r1,h)))
            feats.append(px/area)
    return feats


def ocr_captcha(image_bytes: bytes) -> str:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size

    result = binarize(img)
    if not result or len(result['comps']) < 4:
        # fallback: 等宽分割
        cw = w//4
        r = ""
        for i in range(4):
            l = 3+i*cw; ri = min(w-3, l+cw-2)
            px = sum(result['binary'][y][x] for y in range(3,h-3) for x in range(l,ri+1)) if result else 0
            area = max(1,(h-6)*(ri-l+1))
            dens = px/area
            if dens>0.4: d='8'
            elif dens>0.35: d='0'
            elif dens>0.3: d='6'
            elif dens>0.25: d='9'
            elif dens>0.2: d='5'
            elif dens>0.17: d='2'
            elif dens>0.12: d='3'
            elif dens>0.07: d='7'
            elif dens>0.02: d='1'
            else: d='4'
            r += d
        return r

    comps = sorted(result['comps'], key=lambda c: c['cx'])[:4]
    r = ""
    for c in comps:
        feats = features(result['binary'], c)
        best_digit = '0'
        best_dist = float('inf')
        for digit, tpl in TEMPLATES.items():
            dist = sum((f-v)**2 for f,v in zip(feats, tpl))
            if dist < best_dist:
                best_dist = dist
                best_digit = digit
        r += best_digit
    return r


class CaptchaHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/ocr": self.send_error(404); return
        try:
            body = self.rfile.read(int(self.headers.get("Content-Length",0)))
            data = json.loads(body)
            b64 = data.get("image","")
            if "," in b64: b64 = b64.split(",",1)[1]
            result = ocr_captcha(base64.b64decode(b64))
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            self.wfile.write(json.dumps({"code":result}).encode())
        except Exception as e:
            self.send_response(400)
            self.send_header("Content-Type","application/json")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            self.wfile.write(json.dumps({"error":str(e)}).encode())

    def do_OPTIONS(self):
        self.send_response(200)
        for h,v in [("Access-Control-Allow-Origin","*"),("Access-Control-Allow-Methods","POST,OPTIONS"),("Access-Control-Allow-Headers","Content-Type")]:
            self.send_header(h,v)
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type","application/json")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            self.wfile.write(json.dumps({"status":"ok"}).encode())
        else:
            self.send_error(404)

    def log_message(self,*a): pass


if __name__ == "__main__":
    print(f"OCR v5 @ http://127.0.0.1:8765")
    HTTPServer(("127.0.0.1",8765), CaptchaHandler).serve_forever()
