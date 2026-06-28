import requests
import hashlib
import re
import pickle
import sys
import os

# ============================================================
# 配置区 - 请修改为你的实际账号信息
# ============================================================
USER_ID = "YOUR_USER_ID"
PASSWORD = "YOUR_PASSWORD"
CONTEST_PASSWORD = "YOUR_CONTEST_PASSWORD"  # 如果比赛/实验需要密码
SESSION_FILE = "session.pkl"
TARGET_CONTESTS = ["3761", "3762"]  # 要访问的 Contest ID 列表

# ============================================================
# 加载第一步保存的 Session
# ============================================================
if not os.path.exists(SESSION_FILE):
    print(f"错误: 找不到 {SESSION_FILE}")
    print("请先运行 step1_get_captcha.py 获取验证码!")
    exit(1)

with open(SESSION_FILE, "rb") as f:
    data = pickle.load(f)

session = requests.Session()
for k, v in data["cookies"].items():
    session.cookies.set(k, v)
csrf = data["csrf"]
print(f"已加载 Session, CSRF: {csrf}")

# ============================================================
# 输入验证码
# ============================================================
captcha = sys.argv[1] if len(sys.argv) > 1 else input("请输入验证码: ").strip()

# ============================================================
# 登录
# ============================================================
password_hash = hashlib.md5(PASSWORD.encode()).hexdigest()

login_data = {
    "user_id": USER_ID,
    "password": password_hash,
    "vcode": captcha,
    "csrf": csrf
}
resp = session.post(
    "http://acm.hnust.edu.cn/login.php",
    data=login_data,
    allow_redirects=True
)

if "alert" in resp.text:
    m = re.search(r"alert\('([^']+)'\)", resp.text)
    if m:
        print(f"登录失败: {m.group(1)}")
    exit(1)

print("登录成功！")

# 更新 Session Cookie 到文件（登录后Cookie可能变化）
with open(SESSION_FILE, "wb") as f:
    pickle.dump({
        "cookies": session.cookies.get_dict(),
        "csrf": csrf
    }, f)
print(f"Session 已更新至 {SESSION_FILE}")

# ============================================================
# 访问 Contest 页面并保存
# ============================================================
for cid in TARGET_CONTESTS:
    print(f"\n{'='*60}")
    print(f"正在访问 Contest {cid}...")
    resp = session.get(f"http://acm.hnust.edu.cn/contest.php?cid={cid}")

    if "尚未开始" in resp.text or "私有" in resp.text:
        print("  比赛需要密码，正在提交...")
        pass_resp = session.post(
            f"http://acm.hnust.edu.cn/contest.php?cid={cid}",
            data={"password": CONTEST_PASSWORD},
            allow_redirects=True
        )
        resp_text = pass_resp.text
    else:
        resp_text = resp.text

    # 保存完整页面
    out_path = f"contest_{cid}.html"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(resp_text)
    print(f"  已保存至 {out_path} ({len(resp_text)} bytes)")

print("\n登录完成！接下来可以运行 extract_problems.py 爬取题目数据。")
