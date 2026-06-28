import requests
import hashlib
import re
from PIL import Image
from io import BytesIO

# ============================================================
# 配置区 - 请修改为你的实际账号信息
# ============================================================
USER_ID = "YOUR_USER_ID"
PASSWORD = "YOUR_PASSWORD"
CONTEST_PASSWORD = "YOUR_CONTEST_PASSWORD"

# ============================================================
# 一体化登录脚本：获取验证码 → 识别 → 登录 → 访问Contest
# ============================================================

session = requests.Session()

# Step 1: 获取 CSRF
csrf_resp = session.get("http://acm.hnust.edu.cn/csrf.php")
m = re.search(r'value="([^"]+)"', csrf_resp.text)
csrf = m.group(1) if m else ""
print(f"CSRF: {csrf}")

# Step 2: 获取验证码 (只取一次，登录时必须用同一个session!)
captcha_resp = session.get("http://acm.hnust.edu.cn/vcode.php")
img = Image.open(BytesIO(captcha_resp.content))
img.save("vcode_final.png")

# Step 3: ASCII 预览验证码
img_gray = img.convert("L")
w, h = img_gray.size
values = {}
for y in range(1, h - 1):
    for x in range(1, w - 1):
        p = img_gray.getpixel((x, y))
        values[p] = values.get(p, 0) + 1
bg_val = max(values, key=values.get)
text_vals = [v for v in values if v < bg_val - 5]
t = (max(text_vals) + bg_val) // 2 if text_vals else bg_val - 20

print(f"bg={bg_val}, threshold={t}\n")
for y in range(h):
    row = ""
    for x in range(w):
        p = img_gray.getpixel((x, y))
        row += "##" if (p != 0 and p <= t) else "  "
    print(row)

captcha = input("\n请输入验证码: ").strip()

# Step 4: 登录
password_hash = hashlib.md5(PASSWORD.encode()).hexdigest()
resp = session.post("http://acm.hnust.edu.cn/login.php", data={
    "user_id": USER_ID,
    "password": password_hash,
    "vcode": captcha,
    "csrf": csrf
}, allow_redirects=True)

if "alert" in resp.text:
    m = re.search(r"alert\('([^']+)'\)", resp.text)
    print(f"\n登录失败: {m.group(1) if m else '未知错误'}")
    exit(1)

print("\n登录成功!")

# Step 5: 访问 Contest
for cid in ["3761", "3762"]:
    print(f"\n{'='*60}")
    print(f"Contest {cid}:")
    resp = session.get(f"http://acm.hnust.edu.cn/contest.php?cid={cid}")

    if "尚未开始" in resp.text or "私有" in resp.text:
        print("  比赛需要密码，正在提交...")
        pass_resp = session.post(
            f"http://acm.hnust.edu.cn/contest.php?cid={cid}",
            data={"password": CONTEST_PASSWORD},
            allow_redirects=True
        )
        resp_text = pass_resp.text
    elif "Not Invited" in resp.text:
        print("  无访问权限 (Not Invited)!")
        continue
    else:
        resp_text = resp.text

    # 保存页面
    with open(f"contest_{cid}.html", "w", encoding="utf-8") as f:
        f.write(resp_text)
    print(f"  已保存 contest_{cid}.html ({len(resp_text)} bytes)")

    # 尝试读取单个题目
    for pid in range(0, 20):
        prob_resp = session.get(f"http://acm.hnust.edu.cn/problem.php?cid={cid}&pid={pid}")
        if prob_resp.status_code == 200 and "Not Invited" not in prob_resp.text and len(prob_resp.text) > 1000:
            print(f"  找到题目 pid={pid}")
            break
