import requests
import hashlib
import re
import pickle
from PIL import Image
from io import BytesIO

# ============================================================
# 配置区 - 请修改为你的实际账号信息
# ============================================================
USER_ID = "YOUR_USER_ID"
PASSWORD = "YOUR_PASSWORD"
SESSION_FILE = "session.pkl"

session = requests.Session()

# Step 1: 访问登录页，建立初始Cookie
session.get("http://acm.hnust.edu.cn/loginpage.php")

# Step 2: 获取 CSRF Token
csrf_resp = session.get("http://acm.hnust.edu.cn/csrf.php")
m = re.search(r'value="([^"]+)"', csrf_resp.text)
csrf = m.group(1) if m else ""
print(f"CSRF Token: {csrf}")

# Step 3: 获取验证码图片（重要：保存session，后面登录要用同一个session!）
captcha_resp = session.get("http://acm.hnust.edu.cn/vcode.php")

# 保存验证码图片
with open("vcode_ready.png", "wb") as f:
    f.write(captcha_resp.content)
print("验证码已保存至 vcode_ready.png")

# 保存 Session（包含Cookie和CSRF）
with open(SESSION_FILE, "wb") as f:
    pickle.dump({
        "cookies": session.cookies.get_dict(),
        "csrf": csrf
    }, f)
print(f"Session 已保存至 {SESSION_FILE}")

# Step 4: ASCII 预览验证码（终端内快速查看）
img = Image.open(BytesIO(captcha_resp.content)).convert("L")
w, h = img.size
vals = {}
for y in range(1, h - 1):
    for x in range(1, w - 1):
        p = img.getpixel((x, y))
        vals[p] = vals.get(p, 0) + 1
bg_val = max(vals, key=vals.get)
text_vals = [v for v in vals if v < bg_val - 5]
t = (max(text_vals) + bg_val) // 2 if text_vals else bg_val - 20

print(f"\nASCII 预览 (bg={bg_val}, threshold={t}):\n")
for y in range(h):
    row = ""
    for x in range(w):
        p = img.getpixel((x, y))
        row += "##" if (p != 0 and p <= t) else "  "
    print(row)

print("\n" + "=" * 50)
print("请查看 vcode_ready.png 或上面的 ASCII 预览，然后运行 step2_login.py")
