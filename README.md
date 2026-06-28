# OJ Tools

 ACM 在线评测系统的辅助工具集。

包含：**题目爬取**、**AI 自动解题**、**验证码 OCR 识别**。

---

## 📁 项目结构

```
hnust-oj-tools/
├── step1_get_captcha.py          # 第一步：获取验证码 + 保存 Session
├── step2_login.py                # 第二步：登录 + 访问 Contest
├── login_captcha.py              # 一体化登录脚本（验证码→登录→访问）
├── extract_problems.py           # 题目爬取脚本（需先登录）
├── captcha_server.py             # 本地 OCR 验证码识别服务
├── label_captcha.html            # 验证码标注工具（浏览器打开）
├── .gitignore
├── README.md
├── problems/                     # 已爬取的题目数据
│   ├── all_problems.json         #   结构化 JSON（所有题目）
│   └── contest_*_problem_*.txt   #   单题 TXT 格式
├── captcha_samples/              # 验证码训练样本（20张）
│   └── sample_*.png
└── userscripts/                  # 油猴脚本（浏览器端）
    ├── oj-scraper.user.js          # 纯爬取：一键导出题目
    ├── oj-ai-solver.user.js        # AI 做题：自动生成代码并提交
    ├── oj-allinone-v5.user.js      # 全能版 v5：爬取 + AI + OCR
    └── oj-allinone-v4-backup.user.js  # 稳定版 v4：手动输入验证码
```

---

## 🚀 快速开始

### 方式一：Python 脚本（推荐用于批量爬取）

#### 环境要求

```bash
pip install requests Pillow
```

#### 1. 配置账号

编辑 `step1_get_captcha.py`、`step2_login.py`（或 `login_captcha.py`），修改顶部配置：

```python
USER_ID = "你的学号"
PASSWORD = "你的密码"
CONTEST_PASSWORD = "比赛/实验密码"  # 如有
```

#### 2. 登录（二步法）

```bash
# 第一步：获取验证码，保存 Session
python step1_get_captcha.py
# → 打开 vcode_ready.png 查看验证码（终端也有 ASCII 预览）

# 第二步：输入验证码，完成登录
python step2_login.py
# 或: python step2_login.py ABCD    （直接传验证码）
```

> 也可以使用一体化脚本：`python login_captcha.py`

#### 3. 爬取题目

```bash
# 修改 extract_problems.py 底部的 CONTESTS_TO_CRAWL 列表
python extract_problems.py
```

题目数据保存到 `problems/` 目录：
- `all_problems.json` — 结构化 JSON
- `contest_{cid}_problem_{pid}.txt` — 单题可读文本

---

### 方式二：油猴脚本（推荐用于日常使用）

#### 安装步骤

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展
2. 打开 Tampermonkey 管理面板 → **新建脚本**
3. 将 `userscripts/` 下的 `.user.js` 文件内容粘贴进去
4. 保存，访问 OJ 页面即可看到功能按钮

#### 三个脚本对比

| 脚本 | 功能 | 适用场景 |
|------|------|----------|
| `oj-scraper.user.js` | 一键爬取题目、导出 JSON/TXT | 只需要下载题目 |
| `oj-ai-solver.user.js` | AI 自动生成代码并提交 | 刷题 + 需要手动输验证码 |
| `oj-allinone-v5.user.js` | 爬取 + AI 做题 + 本地 OCR | **推荐**，功能最全 |

#### 配置 AI API（v5 / ai-solver）

在脚本面板中填入：

| 设置项 | 说明 |
|--------|------|
| API URL | `https://api.deepseek.com/chat/completions` |
| API Key | 你的 API Key（如 DeepSeek `sk-...`） |
| Model | `deepseek-chat`（或其他模型） |
| Language | 生成代码的语言（1=C, 2=C++, 3=Java） |

---

## 🤖 验证码 OCR（目前尚未实现，v5 专属）

如果使用 v5 全能脚本，可以启动本地 OCR 服务自动识别验证码：

```bash
pip install Pillow
python captcha_server.py
```

然后在 v5 脚本面板中：
- 勾选 **"使用本地OCR"**

> **准确率**：当前基于 20 个样本训练的模板匹配，约 75%。OCR 结果会显示在面板上，你可以快速确认/修正。

### 提高 OCR 准确率

1. 浏览器打开 `label_captcha.html`
2. 标注更多验证码图片
3. 将标注结果添加到 `captcha_server.py` 的 `TEMPLATES` 字典中

---

## 📊 已爬取数据

`problems/` 目录中包含两个 Contest 的题目：

| 题目 | 内容 |
|------|------|
| 4 道 | 直接插入排序、希尔排序、快速排序、简单选择排序 |
| 3 道 | 堆排序、归并排序、基数排序 |

---

## ⚠️ 注意事项
- 本工具仅供学习交流使用，请遵守学校相关规定

---

## 📄 License

MIT License
