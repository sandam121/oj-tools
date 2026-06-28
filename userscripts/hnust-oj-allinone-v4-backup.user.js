// ==UserScript==
// @name         HNUST OJ 全能助手 (爬取+AI做题)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  一键爬取HNUST OJ题目 + AI自动生成代码并提交。支持单题/批量爬取，DeepSeek/OpenAI/Claude。
// @author       Mao
// @match        http://acm.hnust.edu.cn/*
// @match        https://acm.hnust.edu.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ============ 全局状态 ============
    const SETTINGS = {
        api_url: GM_getValue('oj_api_url', 'https://api.deepseek.com/chat/completions'),
        api_key: GM_getValue('oj_api_key', ''),
        model: GM_getValue('oj_model', 'deepseek-chat'),
        lang: GM_getValue('oj_lang', '1'),
    };
    function saveSetting(k, v) { SETTINGS[k] = v; GM_setValue('oj_' + k, v); }

    // 当前在爬取/解题的上下文
    let currentCid = '', currentPid = '';

    // ============ CSS ============
    const CSS = `
:root {
    --accent: #7c3aed;
    --accent2: #a855f7;
    --red: #e74c3c;
    --green: #27ae60;
    --blue: #3498db;
}
#oj-btn {
    position: fixed; bottom: 30px; right: 30px; z-index: 99998;
    width: 52px; height: 52px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    border: none; color: #fff; font-size: 22px; cursor: pointer;
    box-shadow: 0 4px 18px rgba(124, 58, 237, 0.4);
    transition: all 0.2s; display: flex; align-items: center; justify-content: center;
}
#oj-btn:hover { transform: scale(1.1); }
.oj-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.45); z-index: 99999; display: none; }
.oj-overlay.show { display: block; }

.oj-panel {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 100000; width: 750px; max-height: 88vh;
    background: #fff; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.35);
    display: none; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
}
.oj-panel.show { display: flex; }

.oj-hdr {
    background: linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%);
    color: #fff; padding: 14px 20px; display: flex;
    justify-content: space-between; align-items: center;
}
.oj-hdr h2 { margin: 0; font-size: 16px; font-weight: 600; }
.oj-hdr .oj-close { background: rgba(255,255,255,0.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; cursor: pointer; font-size: 15px; line-height: 1; }

.oj-nav { display: flex; border-bottom: 2px solid #eee; padding: 0 16px; background: #fafafa; }
.oj-nav-item { padding: 10px 18px; cursor: pointer; font-size: 13px; font-weight: 600; color: #999; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.oj-nav-item.active { color: var(--accent); border-bottom-color: var(--accent); }

.oj-body { padding: 16px 20px; overflow-y: auto; flex: 1; max-height: 62vh; }
.oj-page { display: none; }
.oj-page.active { display: block; }

.oj-body label { display: block; font-weight: 600; margin: 10px 0 4px; font-size: 12px; color: #555; }
.oj-body input[type=text],
.oj-body input[type=password],
.oj-body textarea,
.oj-body select {
    width: 100%; padding: 8px 10px; border: 2px solid #e0e0e0;
    border-radius: 8px; font-size: 13px; box-sizing: border-box;
    transition: border-color 0.2s; font-family: inherit;
}
.oj-body input:focus, .oj-body textarea:focus, .oj-body select:focus { outline: none; border-color: var(--accent); }
.oj-body textarea { resize: vertical; min-height: 80px; font-family: 'Consolas', 'Monaco', monospace; }
.oj-body select { background: #fff; }
.oj-row { display: flex; gap: 10px; }
.oj-row > * { flex: 1; }

.oj-btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.oj-btn2 {
    padding: 8px 16px; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: all 0.15s; white-space: nowrap;
}
.oj-btn2:hover { opacity: 0.85; transform: translateY(-1px); }
.oj-btn2:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.oj-btn2-a { background: var(--accent); color: #fff; }
.oj-btn2-g { background: var(--green); color: #fff; }
.oj-btn2-b { background: var(--blue); color: #fff; }
.oj-btn2-r { background: var(--red); color: #fff; }
.oj-btn2-o { background: #fff; color: var(--accent); border: 2px solid var(--accent); }

.oj-log {
    margin-top: 8px; max-height: 180px; overflow-y: auto;
    font-size: 11px; color: #555; line-height: 1.7;
    background: #f9f9f9; padding: 8px 12px; border-radius: 8px;
    font-family: 'Consolas', 'Monaco', monospace;
}
.oj-log .ok { color: var(--green); }
.oj-log .err { color: var(--red); }
.oj-log .warn { color: #f39c12; }
.oj-log .info { color: var(--blue); }

.oj-progress { margin-top: 8px; display: none; }
.oj-progress .bar { height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; }
.oj-progress .fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width 0.3s; width: 0%; }
.oj-progress .txt { font-size: 11px; color: #666; margin-bottom: 3px; }

.oj-vcode { display: flex; gap: 10px; align-items: center; padding: 10px; background: #fff3cd; border-radius: 8px; margin-top: 8px; }
.oj-vcode input { flex: 1; }
.oj-vcode img { height: 34px; border-radius: 4px; cursor: pointer; border: 1px solid #ddd; }

.oj-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
.oj-tag-ok { background: #d4edda; color: #155724; }
.oj-tag-err { background: #f8d7da; color: #721c24; }
.oj-tag-pend { background: #d1ecf1; color: #0c5460; }

.oj-sel { background: #f3e8ff; border: 1px solid #d8b4fe; border-radius: 8px; padding: 8px 12px; margin: 4px 0; cursor: pointer; transition: all 0.15s; display: flex; justify-content: space-between; align-items: center; font-size: 12px; }
.oj-sel:hover { background: #ede9fe; }
.oj-sel.active { background: #ddd6fe; border-color: var(--accent); font-weight: 600; }
.oj-sel .id { color: var(--accent); font-weight: 700; min-width: 45px; }
`;

    // ============ 注入样式 ============
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // ============ DOM ============
    const overlay = document.createElement('div'); overlay.className = 'oj-overlay';
    const btn = document.createElement('button'); btn.id = 'oj-btn'; btn.title = 'OJ全能助手 (爬取+AI做题)'; btn.innerHTML = '🚀';
    document.body.append(overlay, btn);

    const panel = document.createElement('div'); panel.className = 'oj-panel';
    panel.innerHTML = `
<div class="oj-hdr">
    <h2>🚀 OJ 全能助手</h2>
    <button class="oj-close">✕</button>
</div>
<div class="oj-nav">
    <div class="oj-nav-item active" data-page="crawl">📥 爬取题目</div>
    <div class="oj-nav-item" data-page="solve">🤖 AI解题</div>
    <div class="oj-nav-item" data-page="settings">⚙️ 设置</div>
    <div class="oj-nav-item" data-page="status">📊 提交记录</div>
</div>
<div class="oj-body">

    <!-- ====== 爬取页面 ====== -->
    <div class="oj-page active" id="page-crawl">
        <label>📋 比赛ID (多个用逗号分隔，范围用 - 连接)</label>
        <input type="text" id="cr-cids" placeholder="例如: 3761,3762,3763  或  3761-3765">
        <div class="oj-row">
            <div><label>比赛密码 (可选)</label><input type="text" id="cr-pwd" placeholder="如比赛需密码"></div>
            <div><label>导出格式</label><select id="cr-fmt"><option value="both">JSON + TXT</option><option value="json">仅JSON</option><option value="txt">仅TXT</option></select></div>
        </div>
        <div class="oj-btn-row">
            <button class="oj-btn2 oj-btn2-a" id="cr-start">📥 开始爬取</button>
            <button class="oj-btn2 oj-btn2-o" id="cr-clear-log">清空日志</button>
        </div>
        <div class="oj-progress" id="cr-progress"><div class="txt">准备中...</div><div class="bar"><div class="fill"></div></div></div>
        <div class="oj-log" id="cr-log"></div>
    </div>

    <!-- ====== AI解题页面 ====== -->
    <div class="oj-page" id="page-solve">
        <div style="padding:6px 10px; background:#d1ecf1; border-radius:8px; font-size:12px; color:#0c5460; margin-bottom:8px;">
            📋 当前: <b id="ai-ctx"></b>
        </div>
        <label>📝 题目描述 (自动提取，可编辑补充)</label>
        <textarea id="ai-desc" rows="4" placeholder="进入题目页面会自动提取..."></textarea>
        <div class="oj-row">
            <div><label>语言</label><select id="ai-lang"><option value="1">C++</option><option value="0">C</option><option value="6">Python</option><option value="3">Java</option><option value="17">Go</option></select></div>
            <div><label>模型</label><select id="ai-model"><option value="deepseek-chat">DeepSeek</option><option value="gpt-4o">GPT-4o</option><option value="claude-sonnet-4-6">Claude</option></select></div>
        </div>
        <button class="oj-btn2 oj-btn2-a" id="ai-gen" style="width:100%;margin-top:8px;">🤖 AI 生成代码</button>
        <label style="margin-top:10px;">💻 生成的代码 <span style="font-weight:400;color:#999;">(可手动修改)</span></label>
        <textarea id="ai-code" rows="10" placeholder="AI生成的代码会显示在这里..." style="font-family:'Consolas','Monaco',monospace;"></textarea>
        <div id="ai-submit-area" style="display:none;">
            <div class="oj-vcode">
                <span style="font-size:12px;font-weight:600;">🔐 验证码:</span>
                <input type="text" id="ai-vcode" size="6" placeholder="输入验证码">
                <img id="ai-vcode-img" src="vcode.php" alt="验证码">
                <span style="font-size:10px;color:#999;">点图刷新</span>
            </div>
            <div class="oj-btn-row">
                <button class="oj-btn2 oj-btn2-g" id="ai-submit">🚀 提交</button>
                <button class="oj-btn2 oj-btn2-b" id="ai-query">🔍 查结果</button>
                <button class="oj-btn2 oj-btn2-r" id="ai-retry">🔄 换个思路</button>
            </div>
        </div>
        <div class="oj-log" id="ai-log"></div>
    </div>

    <!-- ====== 设置页面 ====== -->
    <div class="oj-page" id="page-settings">
        <label>🔑 API Key</label>
        <input type="password" id="st-api-key" placeholder="sk-...">
        <div style="font-size:10px;color:#999;">仅保存在浏览器本地</div>
        <label>🌐 API地址</label>
        <input type="text" id="st-api-url">
        <div class="oj-row">
            <div><label>默认模型</label><input type="text" id="st-model"></div>
            <div><label>默认语言</label><select id="st-lang"><option value="1">C++</option><option value="0">C</option><option value="6">Python</option><option value="3">Java</option><option value="17">Go</option></select></div>
        </div>
        <div class="oj-btn-row">
            <button class="oj-btn2 oj-btn2-g" id="st-save">💾 保存</button>
            <button class="oj-btn2 oj-btn2-b" id="st-test">🔗 测试API</button>
        </div>
    </div>

    <!-- ====== 提交记录页面 ====== -->
    <div class="oj-page" id="page-status">
        <button class="oj-btn2 oj-btn2-b" id="su-refresh">🔄 加载我最近的提交</button>
        <div id="su-list" style="margin-top:8px; font-size:11px;"></div>
    </div>

</div>`;
    document.body.appendChild(panel);

    // ============ 简易日志 ============
    function logger(id) {
        const el = document.getElementById(id);
        return {
            log(msg, cls) {
                const t = new Date().toLocaleTimeString();
                el.innerHTML += `<span class="${cls || ''}">[${t}] ${msg}</span><br>`;
                el.scrollTop = el.scrollHeight;
            },
            clear() { el.innerHTML = ''; }
        };
    }
    const crLog = logger('cr-log');
    const aiLog = logger('ai-log');

    // ============ 工具函数 ============
    function getCtx() {
        const p = new URLSearchParams(location.search);
        return {
            cid: p.get('cid') || currentCid || '',
            pid: p.get('pid') || currentPid || '',
            title: (document.querySelector('h3')?.textContent || '').trim(),
            url: location.href,
        };
    }
    function updateCtxDisplay() {
        const c = getCtx();
        currentCid = c.cid; currentPid = c.pid;
        document.getElementById('ai-ctx').textContent = `CID=${c.cid}, PID=${c.pid} 「${c.title}」`;
    }

    async function fetchHTML(url) {
        const r = await fetch(url, { credentials: 'include' });
        return await r.text();
    }

    function parseCids(input) {
        if (!input.trim()) return [];
        const result = [];
        const parts = input.split(/[,;\s]+/);
        for (const part of parts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            if (trimmed.includes('-')) {
                const [from, to] = trimmed.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(from) && !isNaN(to) && from <= to) {
                    for (let i = from; i <= to; i++) result.push(String(i));
                }
            } else if (/^\d+$/.test(trimmed)) {
                result.push(trimmed);
            }
        }
        return [...new Set(result)];
    }

    function downloadBlob(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============ 爬取逻辑 ============
    function extractSection(html, name) {
        const re = new RegExp(`<h4[^>]*>\\s*${name}\\s*</h4>\\s*(.*?)(?=<h4[^>]*>|</div>\\s*</div>)`, 's');
        const m = html.match(re);
        if (!m) return '';
        let c = m[1];
        c = c.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
        c = c.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
        c = c.replace(/<pre[^>]*>/g, '\n').replace(/<\/pre>/g, '\n');
        c = c.replace(/<br\s*\/?>/gi, '\n');
        c = c.replace(/<[^>]+>/g, ' ');
        c = c.replace(/&nbsp;/g, ' ');
        c = c.replace(/&lt;/g, '<');
        c = c.replace(/&gt;/g, '>');
        c = c.replace(/&amp;/g, '&');
        c = c.replace(/\n\s*\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
        return c;
    }

    function extractSample(html) {
        const pres = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
        let si = '', so = '';
        for (let i = 0; i < pres.length; i++) {
            const before = html.substring(Math.max(0, html.indexOf(pres[i]) - 200), html.indexOf(pres[i]));
            if (before.includes('样例输入') || before.includes('sampleinput') || before.includes('Sample Input')) {
                si = pres[i];
                if (i + 1 < pres.length) so = pres[i + 1];
                break;
            }
        }
        if (!si && pres.length >= 2) { si = pres[0]; so = pres[1]; }
        return { si, so };
    }

    async function accessContest(cid, password) {
        let html = await fetchHTML(`contest.php?cid=${cid}`);
        if (html.includes('尚未开始或私有') || html.includes('密码')) {
            if (!password) {
                password = prompt(`比赛 ${cid} 需要密码：`);
                if (!password) return null;
            }
            const fd = new URLSearchParams(); fd.append('password', password);
            const r = await fetch(`contest.php?cid=${cid}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd, credentials: 'include' });
            html = await r.text();
        }
        if (html.includes('尚未开始或私有') || html.includes('Not Invited')) return null;
        return html;
    }

    function parseProblemList(html, cid) {
        const re = new RegExp(`problem\\.php\\?cid=${cid}&pid=(\\d+)[^>]*>([^<]+)`, 'g');
        const probs = [];
        let m;
        while ((m = re.exec(html)) !== null) probs.push({ pid: parseInt(m[1]), name: m[2].trim() });
        return probs;
    }

    async function scrapeOneProblem(cid, pid) {
        const html = await fetchHTML(`problem.php?cid=${cid}&pid=${pid}`);
        if (html.length < 500 || html.includes('Not Invited')) return null;
        const h3 = html.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
        if (!h3) return null;
        const title = h3[1].trim();
        const timeM = html.match(/<span[^>]*fd=['"]time_limit['"]\s*[^>]*>\s*(\d+)\s*<\/span>/);
        const timeLimit = (timeM ? timeM[1] : '1') + ' Sec';
        const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+\s*\w+)/);
        const memLimit = memM ? memM[1] : '32 MB';
        const { si, so } = extractSample(html);
        return {
            pid, title, time_limit: timeLimit, memory_limit: memLimit,
            description: extractSection(html, '题目描述') || extractSection(html, 'Description'),
            input: extractSection(html, '输入') || extractSection(html, 'Input'),
            output: extractSection(html, '输出') || extractSection(html, 'Output'),
            sample_input: si, sample_output: so,
            hint: extractSection(html, '提示') || extractSection(html, 'Hint'),
        };
    }

    function problemToTXT(p) {
        return [
            `Title: ${p.title}`, `Time Limit: ${p.time_limit}`, `Memory Limit: ${p.memory_limit}`,
            '', '='.repeat(60), 'Description:', p.description, '',
            '='.repeat(60), 'Input:', p.input, '',
            '='.repeat(60), 'Output:', p.output, '',
            '='.repeat(60), 'Sample Input:', p.sample_input, '',
            '='.repeat(60), 'Sample Output:', p.sample_output, '',
            '='.repeat(60), 'Hint:', p.hint,
        ].join('\n');
    }

    // ============ AI 解题逻辑 ============
    const SYSTEM_PROMPT = `You are an expert competitive programmer. Write a COMPLETE, COMPILABLE solution.

RULES:
1. Output ONLY the code. No explanations or markdown formatting.
2. Include ALL necessary headers, imports, and a main function.
3. Read from stdin, write to stdout.
4. Match the EXACT output format (spaces, newlines matter).
5. Use efficient algorithms for the constraints.
6. For sorting problems: implement the SPECIFIC algorithm requested.
7. NEVER output Chinese prompts like "请输入" - only the required data.
8. Use int main() not void main() for C/C++. Return 0.
9. For C++ with n≥100000, use scanf/printf or ios::sync_with_stdio(false).
10. Put a newline after the last output line.`;

    function buildPrompt(desc, lang) {
        const names = { '0': 'C', '1': 'C++', '3': 'Java', '6': 'Python', '17': 'Go' };
        return `${desc}\n\n请用${names[lang] || 'C++'}编写解题代码。\n只输出完整代码，不要解释。`;
    }

    async function callAI(apiKey, apiUrl, model, messages, maxTokens = 4000) {
        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1, stream: false }),
        });
        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`API ${resp.status}: ${err.substring(0, 200)}`);
        }
        const data = await resp.json();
        return data.choices[0].message.content;
    }

    function extractCode(response) {
        const m = response.match(/```[\w]*\n([\s\S]*?)```/) || response.match(/```[\w]*([\s\S]*?)```/);
        return m ? m[1].trim() : response.trim();
    }

    async function extractProblemDesc(cid, pid) {
        if (!cid || pid === '') return '';
        try {
            const html = await fetchHTML(`problem.php?cid=${cid}&pid=${pid}`);
            const h3 = html.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
            const title = h3 ? h3[1].trim() : '';
            const desc = extractSection(html, '题目描述') || extractSection(html, 'Description');
            const inp = extractSection(html, '输入') || extractSection(html, 'Input');
            const outp = extractSection(html, '输出') || extractSection(html, 'Output');
            const hint = extractSection(html, '提示') || extractSection(html, 'Hint');
            const { si, so } = extractSample(html);
            const timeM = html.match(/<span[^>]*fd=['"]time_limit['"]\s*[^>]*>\s*(\d+)\s*<\/span>/);
            const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+\s*\w+)/);
            return [
                `【题目】${title}`,
                `【时间限制】${(timeM ? timeM[1] : '1')} Sec  【内存限制】${memM ? memM[1] : '32 MB'}`,
                `【题目描述】${desc || ''}`,
                `【输入格式】${inp || ''}`,
                `【输出格式】${outp || ''}`,
                `【样例输入】\n${si}`,
                `【样例输出】\n${so}`,
                `【提示】${hint || '无'}`,
            ].join('\n\n');
        } catch (e) { return ''; }
    }

    // ============ 提交记录 ============
    async function loadStatus(cid) {
        const el = document.getElementById('su-list');
        el.innerHTML = '<span style="color:#999;">加载中...</span>';
        try {
            const html = await fetchHTML(cid ? `status.php?cid=${cid}` : 'status.php');
            const rows = [];
            const trRe = /<tr[^>]*>(.*?)<\/tr>/gs;
            let m;
            while ((m = trRe.exec(html)) !== null) {
                const tds = m[1].match(/<td[^>]*>(.*?)<\/td>/gs);
                if (tds && tds.length >= 8) {
                    const cells = tds.map(td => td.replace(/<[^>]+>/g, '').trim());
                    if (cells[0] && /^\d+$/.test(cells[0])) rows.push(cells);
                }
            }
            if (!rows.length) { el.innerHTML = '<span style="color:#999;">暂无记录</span>'; return; }
            let tbl = '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
            tbl += '<tr style="background:#f5f5f5;"><th style="padding:6px;">RunID</th><th>用户</th><th>结果</th><th>内存</th><th>时间</th><th>语言</th><th>提交时间</th></tr>';
            for (const r of rows.slice(0, 25)) {
                const cls = (r[2] && (r[2].includes('正确') || r[2].includes('Accepted'))) ? 'oj-tag-ok'
                    : (r[2] && (r[2].includes('Wrong') || r[2].includes('错误'))) ? 'oj-tag-err' : 'oj-tag-pend';
                tbl += `<tr style="border-top:1px solid #eee;"><td style="padding:4px;">${r[0]||''}</td><td>${r[1]||''}</td><td><span class="oj-tag ${cls}">${r[2]||'?'}</span></td><td>${r[3]||''}</td><td>${r[4]||''}</td><td>${r[5]||''}</td><td>${r[8]||''}</td></tr>`;
            }
            tbl += '</table>';
            el.innerHTML = tbl;
        } catch (e) { el.innerHTML = '<span style="color:red;">加载失败: ' + e.message + '</span>'; }
    }

    // ============ 事件绑定 ============
    btn.onclick = () => {
        updateCtxDisplay();
        panel.classList.add('show'); overlay.classList.add('show');
        // 自动提取题目描述
        const c = getCtx();
        if (c.cid && c.pid !== '' && !document.getElementById('ai-desc').value.trim()) {
            extractProblemDesc(c.cid, c.pid).then(d => { if (d) document.getElementById('ai-desc').value = d; });
        }
        // 爬取：自动填入cid
        if (c.cid && !document.getElementById('cr-cids').value.trim()) {
            document.getElementById('cr-cids').value = c.cid;
        }
    };
    document.querySelector('.oj-close').onclick = overlay.onclick = () => { panel.classList.remove('show'); overlay.classList.remove('show'); };
    panel.querySelector('.oj-body').onclick = e => e.stopPropagation();

    // 导航
    document.querySelectorAll('.oj-nav-item').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.oj-nav-item').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.oj-page').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('page-' + tab.dataset.page).classList.add('active');
            if (tab.dataset.page === 'solve') updateCtxDisplay();
        };
    });

    // 加载设置
    document.getElementById('st-api-key').value = SETTINGS.api_key;
    document.getElementById('st-api-url').value = SETTINGS.api_url;
    document.getElementById('st-model').value = SETTINGS.model;
    document.getElementById('st-lang').value = SETTINGS.lang;
    document.getElementById('ai-lang').value = SETTINGS.lang;
    document.getElementById('ai-model').value = SETTINGS.model;

    // ===== 爬取 =====
    document.getElementById('cr-start').onclick = async () => {
        const cids = parseCids(document.getElementById('cr-cids').value);
        const pwd = document.getElementById('cr-pwd').value.trim();
        const fmt = document.getElementById('cr-fmt').value;
        if (!cids.length) { crLog.log('请输入比赛ID', 'err'); return; }

        crLog.clear();
        document.getElementById('cr-progress').style.display = 'block';
        const progressFill = document.getElementById('cr-progress').querySelector('.fill');
        const progressTxt = document.getElementById('cr-progress').querySelector('.txt');
        crLog.log(`🚀 爬取 ${cids.length} 个比赛: [${cids.join(', ')}]`, 'info');

        const all = {};
        let total = 0, done = 0;

        // 第一阶段：获取题目列表
        const contests = {};
        for (const cid of cids) {
            crLog.log(`📋 获取比赛 ${cid}...`, 'info');
            const html = await accessContest(cid, pwd);
            if (!html) { crLog.log(`比赛 ${cid}: 无法访问`, 'err'); continue; }
            const probs = parseProblemList(html, cid);
            if (!probs.length) { crLog.log(`比赛 ${cid}: 无题目`, 'err'); continue; }
            contests[cid] = probs;
            total += probs.length;
            crLog.log(`比赛 ${cid}: ${probs.length} 题`, 'ok');
        }

        if (!total) { crLog.log('没找到题目', 'err'); return; }
        progressTxt.textContent = `0 / ${total}`;

        // 第二阶段：逐个爬取
        for (const cid of cids) {
            const probs = contests[cid];
            if (!probs) continue;
            all[cid] = [];
            for (const p of probs) {
                const detail = await scrapeOneProblem(cid, p.pid);
                if (detail) {
                    all[cid].push(detail);
                    crLog.log(`  ✅ [${cid}] #${p.pid}: ${detail.title}`, 'ok');
                    if (fmt === 'txt' || fmt === 'both') {
                        const fn = `contest_${cid}_problem_${p.pid}.txt`;
                        downloadBlob(problemToTXT(detail), fn, 'text/plain;charset=utf-8');
                        await new Promise(r => setTimeout(r, 200));
                    }
                } else { crLog.log(`  ⚠️ [${cid}] #${p.pid}: 失败`, 'warn'); }
                done++;
                const pct = Math.round((done / total) * 100);
                progressFill.style.width = pct + '%';
                progressTxt.textContent = `${done} / ${total}`;
            }
        }

        if ((fmt === 'json' || fmt === 'both') && Object.keys(all).length) {
            const fn = `oj_problems_${cids.join('_')}.json`;
            downloadBlob(JSON.stringify(all, null, 2), fn, 'application/json;charset=utf-8');
            crLog.log(`📦 已导出: ${fn}`, 'ok');
        }
        progressTxt.textContent = `✅ 完成 ${done}/${total}`;
        crLog.log(`🎉 爬取完毕!`, 'ok');
    };
    document.getElementById('cr-clear-log').onclick = () => { crLog.clear(); document.getElementById('cr-progress').style.display = 'none'; };

    // ===== AI 解题 =====
    document.getElementById('ai-gen').onclick = async () => {
        const apiKey = document.getElementById('st-api-key').value.trim() || SETTINGS.api_key;
        const apiUrl = document.getElementById('st-api-url').value.trim() || SETTINGS.api_url;
        const model = document.getElementById('ai-model').value || SETTINGS.model;
        const lang = document.getElementById('ai-lang').value || SETTINGS.lang;

        if (!apiKey) { aiLog.log('请先在设置中填写API Key', 'err'); return; }
        const desc = document.getElementById('ai-desc').value.trim();
        if (!desc || desc.length < 10) { aiLog.log('题目描述太短', 'err'); return; }

        aiLog.log('🤖 调用AI生成代码...', 'info');
        document.getElementById('ai-gen').disabled = true;
        document.getElementById('ai-gen').textContent = '⏳ 生成中...';
        try {
            const resp = await callAI(apiKey, apiUrl, model, [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: buildPrompt(desc, lang) }
            ]);
            const code = extractCode(resp);
            document.getElementById('ai-code').value = code;
            document.getElementById('ai-submit-area').style.display = 'block';
            document.getElementById('ai-vcode-img').src = 'vcode.php?' + Math.random();
            aiLog.log(`✅ 代码生成完毕 (${code.length} 字符)`, 'ok');
        } catch (e) { aiLog.log('❌ ' + e.message, 'err'); }
        finally { document.getElementById('ai-gen').disabled = false; document.getElementById('ai-gen').textContent = '🤖 AI 生成代码'; }
    };
    document.getElementById('ai-retry').onclick = () => document.getElementById('ai-gen').click();

    document.getElementById('ai-submit').onclick = async () => {
        const code = document.getElementById('ai-code').value.trim();
        const vcode = document.getElementById('ai-vcode').value.trim();
        const c = getCtx();
        const lang = document.getElementById('ai-lang').value || SETTINGS.lang;
        if (!code) { aiLog.log('没有代码', 'err'); return; }
        if (!vcode) { aiLog.log('请输入验证码', 'err'); return; }
        if (!c.cid || c.pid === '') { aiLog.log('请在题目页面使用', 'err'); return; }

        aiLog.log('🚀 提交中...', 'info');
        const fd = new URLSearchParams();
        fd.append('cid', c.cid); fd.append('pid', c.pid);
        fd.append('language', lang); fd.append('source', code); fd.append('vcode', vcode);
        try {
            const r = await fetch('submit.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd, credentials: 'include' });
            const html = await r.text();
            const sidM = html.match(/solution[_ ]?id[=: ]*(\d+)/i);
            const sid = sidM ? sidM[1] : '?';
            aiLog.log(`✅ 提交成功! Solution ID: ${sid}`, 'ok');
            document.getElementById('ai-vcode-img').src = 'vcode.php?' + Math.random();
            document.getElementById('ai-vcode').value = '';
        } catch (e) { aiLog.log('❌ 提交失败: ' + e.message, 'err'); }
    };
    document.getElementById('ai-query').onclick = () => {
        const c = getCtx();
        aiLog.log('🔍 查询中...', 'info');
        // 切换到状态页
        document.querySelectorAll('.oj-nav-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.oj-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="status"]').classList.add('active');
        document.getElementById('page-status').classList.add('active');
        loadStatus(c.cid);
    };

    // ===== 设置 =====
    document.getElementById('st-save').onclick = () => {
        saveSetting('api_key', document.getElementById('st-api-key').value.trim());
        saveSetting('api_url', document.getElementById('st-api-url').value.trim());
        saveSetting('model', document.getElementById('st-model').value.trim());
        saveSetting('lang', document.getElementById('st-lang').value);
        document.getElementById('ai-lang').value = SETTINGS.lang;
        document.getElementById('ai-model').value = SETTINGS.model;
        alert('✅ 设置已保存!');
    };
    document.getElementById('st-test').onclick = async () => {
        const key = document.getElementById('st-api-key').value.trim();
        const url = document.getElementById('st-api-url').value.trim();
        if (!key || !url) { alert('请先填写API Key和地址'); return; }
        try {
            await callAI(key, url, 'deepseek-chat', [{ role: 'user', content: 'say ok' }], 20);
            alert('✅ API 连接成功!');
        } catch (e) { alert('❌ 失败: ' + e.message); }
    };

    // ===== 提交记录 =====
    document.getElementById('su-refresh').onclick = () => loadStatus(getCtx().cid);

    // ===== 快捷键 =====
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); document.getElementById('ai-gen').click(); }
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); document.getElementById('ai-submit').click(); }
    });

    // 页面加载时自动提取上下文
    updateCtxDisplay();
    const cInit = getCtx();
    if (cInit.cid && cInit.pid !== '') {
        extractProblemDesc(cInit.cid, cInit.pid).then(d => { if (d) document.getElementById('ai-desc').value = d; });
        document.getElementById('cr-cids').value = cInit.cid;
    }

    console.log('✅ HNUST OJ 全能助手已就绪');
    console.log('   🚀 点右下角按钮打开 | Ctrl+Shift+G 生成代码 | Ctrl+Shift+Enter 提交');
    console.log('   🛡️ API Key 仅存于浏览器本地 | ⚠️ 提交需手动输验证码');
})();
