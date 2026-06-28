import requests
import pickle
import re
import json
import os

# ============================================================
# 配置区 - 请修改为你的实际路径和账号信息
# ============================================================
SESSION_FILE = "session.pkl"  # step2_login.py 生成的会话文件
OUTDIR = "./problems"         # 题目输出目录

# ============================================================
# 加载已登录的 Session
# ============================================================
if not os.path.exists(SESSION_FILE):
    print(f"错误: 找不到 {SESSION_FILE}")
    print("请先运行 step1_get_captcha.py 和 step2_login.py 完成登录!")
    exit(1)

with open(SESSION_FILE, "rb") as f:
    data = pickle.load(f)

session = requests.Session()
for k, v in data["cookies"].items():
    session.cookies.set(k, v)

os.makedirs(OUTDIR, exist_ok=True)


def extract_section(html, section_name):
    """从HTML中提取指定section的内容"""
    pat = re.compile(
        r'<h4[^>]*>\s*' + re.escape(section_name) + r'\s*</h4>\s*(.*?)(?=<h4[^>]*>|</div>\s*</div>)',
        re.S
    )
    m = pat.search(html)
    if not m:
        return ""
    content = m.group(1)
    # 清理 HTML 标签
    content = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.S)
    content = re.sub(r'<style[^>]*>.*?</style>', '', content, flags=re.S)
    content = re.sub(r'<[^>]+>', ' ', content)
    content = re.sub(r'&nbsp;', ' ', content)
    content = re.sub(r'&lt;', '<', content)
    content = re.sub(r'&gt;', '>', content)
    content = re.sub(r'&amp;', '&', content)
    content = re.sub(r'\s+', ' ', content).strip()
    return content


def crawl_contests(cids):
    """爬取指定contest的所有题目"""
    all_results = {}

    for cid in cids:
        problems = []
        for pid in range(10):
            url = f"http://acm.hnust.edu.cn/problem.php?cid={cid}&pid={pid}"
            resp = session.get(url)

            if len(resp.text) < 1000:
                break

            resp.encoding = "utf-8"
            html = resp.text

            # 标题
            h3_m = re.search(r'<h3[^>]*>\s*([^<]+?)\s*</h3>', html)
            if not h3_m:
                break
            title = h3_m.group(1).strip()

            # 时间/内存限制
            time_m = re.search(r'时间限制</span>\s*<[^>]+>\s*([^<]+)\s*</', html)
            mem_m = re.search(r'内存限制</span>\s*<[^>]+>\s*([^<]+)\s*</', html)
            time_limit = time_m.group(1).strip() if time_m else ""
            mem_limit = mem_m.group(1).strip() if mem_m else ""

            # 各Section
            description = extract_section(html, "题目描述")
            input_spec = extract_section(html, "输入")
            output_spec = extract_section(html, "输出")
            hint = extract_section(html, "提示")

            # 样例输入输出
            sample_inputs = re.findall(
                r'<span[^>]*id="?sampleinput"?[^>]*>(.*?)</span>',
                html, re.S
            )
            sample_outputs = re.findall(
                r'<span[^>]*id="?sampleoutput"?[^>]*>(.*?)</span>',
                html, re.S
            )
            sample_input = sample_inputs[0].strip() if sample_inputs else ""
            sample_output = sample_outputs[0].strip() if sample_outputs else ""

            problem = {
                "pid": pid,
                "title": title,
                "time_limit": time_limit,
                "memory_limit": mem_limit,
                "description": description,
                "input": input_spec,
                "output": output_spec,
                "sample_input": sample_input,
                "sample_output": sample_output,
                "hint": hint,
            }
            problems.append(problem)

            # 保存单题 TXT
            txt_path = f"{OUTDIR}/contest_{cid}_problem_{pid}.txt"
            with open(txt_path, "w", encoding="utf-8") as f:
                f.write(f"Title: {title}\n")
                f.write(f"Time Limit: {time_limit}\n")
                f.write(f"Memory Limit: {mem_limit}\n")
                f.write(f"\n{'='*60}\n")
                f.write(f"Description:\n{description}\n\n")
                f.write(f"{'='*60}\n")
                f.write(f"Input:\n{input_spec}\n\n")
                f.write(f"{'='*60}\n")
                f.write(f"Output:\n{output_spec}\n\n")
                f.write(f"{'='*60}\n")
                f.write(f"Sample Input:\n{sample_input}\n\n")
                f.write(f"{'='*60}\n")
                f.write(f"Sample Output:\n{sample_output}\n\n")
                f.write(f"{'='*60}\n")
                f.write(f"Hint:\n{hint}\n")

            print(f"[{cid}] pid={pid}: {title}")

        all_results[cid] = problems
        print(f"  -> 共 {len(problems)} 道题")

    # 保存 JSON
    json_path = f"{OUTDIR}/all_problems.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)

    print(f"\n全部数据已保存至 {OUTDIR}/")
    return all_results


if __name__ == "__main__":
    # 修改这里来爬取不同的 Contest
    CONTESTS_TO_CRAWL = ["3761", "3762"]
    crawl_contests(CONTESTS_TO_CRAWL)
