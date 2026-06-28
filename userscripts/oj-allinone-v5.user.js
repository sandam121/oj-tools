// ==UserScript==
// @name         HNUST OJ 全能助手 v5
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  HNUST OJ 一键爬取题目 + AI自动解题。v5新增：本地OCR自动识别验证码（可选）
// @author       Mao
// @match        http://acm.hnust.edu.cn/*
// @match        https://acm.hnust.edu.cn/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ============ 配置 ============
    const OCR_SERVER = GM_getValue('oj_ocr_server', 'http://127.0.0.1:8765');
    const SETTINGS = {
        api_url: GM_getValue('oj_api_url', 'https://api.deepseek.com/chat/completions'),
        api_key: GM_getValue('oj_api_key', ''),
        model: GM_getValue('oj_model', 'deepseek-chat'),
        lang: GM_getValue('oj_lang', '1'),
        use_ocr: GM_getValue('oj_use_ocr', true),
    };
    function save(k, v) { SETTINGS[k] = v; GM_setValue('oj_' + k, v); }

    let currentCid = '', currentPid = '';

    // ============ CSS ============
    const CSS = `
:root { --accent: #7c3aed; --accent2: #a855f7; --red: #e74c3c; --green: #27ae60; --blue: #3498db; }
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
.oj-body input[type=text], .oj-body input[type=password], .oj-body textarea, .oj-body select {
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
.oj-log .ok { color: var(--green); } .oj-log .err { color: var(--red); }
.oj-log .warn { color: #f39c12; } .oj-log .info { color: var(--blue); }

.oj-progress { margin-top: 8px; display: none; }
.oj-progress .bar { height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden; }
.oj-progress .fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 3px; transition: width 0.3s; width: 0%; }
.oj-progress .txt { font-size: 11px; color: #666; margin-bottom: 3px; }

.oj-vcode { display: flex; gap: 10px; align-items: center; padding: 10px; background: #fff3cd; border-radius: 8px; margin-top: 8px; }
.oj-vcode input { flex: 1; }
.oj-vcode img { height: 34px; border-radius: 4px; cursor: pointer; border: 1px solid #ddd; }

.oj-auto-tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
.oj-auto-tag.on { background: #d4edda; color: #155724; }
.oj-auto-tag.off { background: #f8d7da; color: #721c24; }
.oj-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; }
.oj-tag-ok { background: #d4edda; color: #155724; }
.oj-tag-err { background: #f8d7da; color: #721c24; }
.oj-tag-pend { background: #d1ecf1; color: #0c5460; }
`;

    // ============ 注入 ============
    const styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
    const overlay = document.createElement('div'); overlay.className = 'oj-overlay';
    const btn = document.createElement('button'); btn.id = 'oj-btn'; btn.title = 'OJ全能助手'; btn.innerHTML = '🚀';
    document.body.append(overlay, btn);

    const panelHTML = `
<div class="oj-panel" id="oj-panel">
<div class="oj-hdr"><h2>🚀 OJ 全能助手 <span class="oj-auto-tag" id="ocr-status">--</span></h2><button class="oj-close">✕</button></div>
<div class="oj-nav">
    <div class="oj-nav-item active" data-page="crawl">📥 爬取题目</div>
    <div class="oj-nav-item" data-page="solve">🤖 AI解题</div>
    <div class="oj-nav-item" data-page="settings">⚙️ 设置</div>
    <div class="oj-nav-item" data-page="status">📊 记录</div>
</div>
<div class="oj-body">

    <div class="oj-page active" id="page-crawl">
        <label>📋 比赛ID</label>
        <input type="text" id="cr-cids" placeholder="3761  或  3761,3762  或  3761-3765">
        <div class="oj-row">
            <div><label>密码</label><input type="text" id="cr-pwd"></div>
            <div><label>导出</label><select id="cr-fmt"><option value="both">JSON+TXT</option><option value="json">JSON</option><option value="txt">TXT</option></select></div>
        </div>
        <div class="oj-btn-row">
            <button class="oj-btn2 oj-btn2-a" id="cr-start">📥 开始爬取</button>
            <button class="oj-btn2 oj-btn2-o" id="cr-clear-log">清空</button>
        </div>
        <div class="oj-progress" id="cr-progress"><div class="txt"></div><div class="bar"><div class="fill"></div></div></div>
        <div class="oj-log" id="cr-log"></div>
    </div>

    <div class="oj-page" id="page-solve">
        <div style="padding:6px 10px; background:#d1ecf1; border-radius:8px; font-size:12px; color:#0c5460; margin-bottom:8px;">
            📋 <b id="ai-ctx"></b>
        </div>
        <label>📝 题目描述 <span style="font-weight:400;color:#999;font-size:10px;">(自动提取)</span></label>
        <textarea id="ai-desc" rows="4"></textarea>
        <div class="oj-row">
            <div><label>语言</label><select id="ai-lang"><option value="1">C++</option><option value="0">C</option><option value="6">Python</option><option value="3">Java</option><option value="17">Go</option></select></div>
            <div><label>模型</label><select id="ai-model"><option value="deepseek-chat">DeepSeek</option><option value="gpt-4o">GPT-4o</option><option value="claude-sonnet-4-6">Claude</option></select></div>
        </div>
        <button class="oj-btn2 oj-btn2-a" id="ai-gen" style="width:100%;margin-top:8px;">🤖 AI 生成代码</button>
        <label style="margin-top:10px;">💻 代码 <span style="font-weight:400;color:#999;">(可手动修改)</span></label>
        <textarea id="ai-code" rows="10" style="font-family:'Consolas',monospace;"></textarea>
        <div id="ai-submit-area" style="display:none;">
            <div class="oj-vcode">
                <span style="font-size:12px;font-weight:600;">🔐 验证码:</span>
                <input type="text" id="ai-vcode" size="6" placeholder="手动输入">
                <img id="ai-vcode-img" src="vcode.php" alt="验证码">
                <button class="oj-btn2 oj-btn2-b" id="ai-ocr-btn" style="font-size:11px;padding:4px 8px;">🤖 自动识别</button>
            </div>
            <div class="oj-btn-row">
                <button class="oj-btn2 oj-btn2-g" id="ai-submit">🚀 提交</button>
                <button class="oj-btn2 oj-btn2-b" id="ai-query">🔍 查结果</button>
                <button class="oj-btn2 oj-btn2-r" id="ai-retry">🔄 换思路</button>
            </div>
        </div>
        <div class="oj-log" id="ai-log"></div>
    </div>

    <div class="oj-page" id="page-settings">
        <label>🔑 API Key</label>
        <input type="password" id="st-api-key" placeholder="sk-...">
        <label>🌐 API地址</label>
        <input type="text" id="st-api-url">
        <div class="oj-row">
            <div><label>模型</label><input type="text" id="st-model"></div>
            <div><label>默认语言</label><select id="st-lang"><option value="1">C++</option><option value="0">C</option><option value="6">Python</option><option value="3">Java</option><option value="17">Go</option></select></div>
        </div>
        <label>🔐 OCR服务</label>
        <div class="oj-row">
            <input type="text" id="st-ocr-url" placeholder="http://127.0.0.1:8765">
            <button class="oj-btn2 oj-btn2-b" id="st-ocr-test">测试OCR</button>
        </div>
        <div style="margin-top:6px;font-size:11px;color:#999;">
            启动方式: python captcha_server.py (需安装Pillow: pip install Pillow)
        </div>
        <div class="oj-btn-row">
            <button class="oj-btn2 oj-btn2-g" id="st-save">💾 保存</button>
            <button class="oj-btn2 oj-btn2-b" id="st-test">🔗 测试API</button>
        </div>
    </div>

    <div class="oj-page" id="page-status">
        <button class="oj-btn2 oj-btn2-b" id="su-refresh">🔄 加载最近的提交</button>
        <div id="su-list" style="margin-top:8px; font-size:11px;"></div>
    </div>

</div></div>`;
    document.body.insertAdjacentHTML('beforeend', panelHTML);

    const panel = document.getElementById('oj-panel');

    // ============ OCR 状态 ============
    async function checkOCR() {
        try {
            const r = await fetch(OCR_SERVER + '/health');
            if (r.ok) {
                document.getElementById('ocr-status').textContent = 'OCR✅';
                document.getElementById('ocr-status').className = 'oj-auto-tag on';
                return true;
            }
        } catch (e) {}
        document.getElementById('ocr-status').textContent = 'OCR❌';
        document.getElementById('ocr-status').className = 'oj-auto-tag off';
        return false;
    }

    async function autoOCR() {
        try {
            const img = document.getElementById('ai-vcode-img');
            // 将img绘制到canvas获取base64
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || 60;
            canvas.height = img.naturalHeight || 24;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const b64 = canvas.toDataURL('image/png');

            const r = await fetch(OCR_SERVER + '/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: b64 }),
            });
            if (!r.ok) return null;
            const data = await r.json();
            return data.code || '';
        } catch (e) {
            return null;
        }
    }

    // ============ 工具 ============
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

    function getCtx() {
        const p = new URLSearchParams(location.search);
        return {
            cid: p.get('cid') || currentCid || '',
            pid: p.get('pid') || currentPid || '',
            title: (document.querySelector('h3')?.textContent || '').trim(),
        };
    }
    function updateCtx() {
        const c = getCtx();
        currentCid = c.cid; currentPid = c.pid;
        document.getElementById('ai-ctx').textContent = `CID=${c.cid}, PID=${c.pid} 「${c.title}」`;
        document.getElementById('cr-cids').value = document.getElementById('cr-cids').value || c.cid;
    }

    async function fetchHTML(url) {
        const r = await fetch(url, { credentials: 'include' });
        return await r.text();
    }

    function downloadBlob(content, filename, mime) {
        const blob = new Blob([content], { type: mime });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    function parseCids(input) {
        if (!input.trim()) return [];
        const result = [];
        for (const part of input.split(/[,;\s]+/)) {
            const t = part.trim();
            if (!t) continue;
            if (t.includes('-')) {
                const [f, to] = t.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(f) && !isNaN(to) && f <= to) for (let i = f; i <= to; i++) result.push(String(i));
            } else if (/^\d+$/.test(t)) result.push(t);
        }
        return [...new Set(result)];
    }

    // ============ 爬取 ============
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
        c = c.replace(/&nbsp;/g, ' '); c = c.replace(/&lt;/g, '<'); c = c.replace(/&gt;/g, '>'); c = c.replace(/&amp;/g, '&');
        c = c.replace(/\n\s*\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
        return c;
    }

    function extractSample(html) {
        const pres = [...html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/g)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
        let si = '', so = '';
        for (let i = 0; i < pres.length; i++) {
            const before = html.substring(Math.max(0, html.indexOf(pres[i]) - 200), html.indexOf(pres[i]));
            if (before.includes('样例输入') || before.includes('sampleinput')) { si = pres[i]; if (i + 1 < pres.length) so = pres[i + 1]; break; }
        }
        if (!si && pres.length >= 2) { si = pres[0]; so = pres[1]; }
        return { si, so };
    }

    async function accessContest(cid, password) {
        let html = await fetchHTML(`contest.php?cid=${cid}`);
        if (html.includes('尚未开始或私有') || html.includes('密码')) {
            if (!password) { password = prompt(`比赛 ${cid} 需要密码：`); if (!password) return null; }
            const fd = new URLSearchParams(); fd.append('password', password);
            const r = await fetch(`contest.php?cid=${cid}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd, credentials: 'include' });
            html = await r.text();
        }
        if (html.includes('尚未开始或私有') || html.includes('Not Invited')) return null;
        return html;
    }

    function parseProblemList(html, cid) {
        const re = new RegExp(`problem\\.php\\?cid=${cid}&pid=(\\d+)[^>]*>([^<]+)`, 'g');
        const probs = []; let m;
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
        const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+\s*\w+)/);
        const { si, so } = extractSample(html);
        return {
            pid, title,
            time_limit: (timeM ? timeM[1] : '1') + ' Sec',
            memory_limit: memM ? memM[1] : '32 MB',
            description: extractSection(html, '题目描述') || extractSection(html, 'Description'),
            input: extractSection(html, '输入') || extractSection(html, 'Input'),
            output: extractSection(html, '输出') || extractSection(html, 'Output'),
            sample_input: si, sample_output: so,
            hint: extractSection(html, '提示') || extractSection(html, 'Hint'),
        };
    }

    function problemToTXT(p) {
        return `Title: ${p.title}\nTime Limit: ${p.time_limit}\nMemory Limit: ${p.memory_limit}\n\n${'='.repeat(60)}\nDescription:\n${p.description}\n\n${'='.repeat(60)}\nInput:\n${p.input}\n\n${'='.repeat(60)}\nOutput:\n${p.output}\n\n${'='.repeat(60)}\nSample Input:\n${p.sample_input}\n\n${'='.repeat(60)}\nSample Output:\n${p.sample_output}\n\n${'='.repeat(60)}\nHint:\n${p.hint}`;
    }

    // ============ AI ============
    const SYSTEM_PROMPT = `You are an expert competitive programmer. Write a COMPLETE compilable solution.
RULES:
1. Output ONLY code. No explanations.
2. Include all headers/imports and a main function.
3. Read from stdin, write to stdout. Match EXACT output format.
4. Use efficient algorithms for constraints.
5. For sorting problems, implement the SPECIFIC algorithm described.
6. NO Chinese prompts - only output required data.
7. Use int main() not void main() for C/C++. Return 0.
8. For C++ with n>=100000, use scanf/printf or fast I/O.`;

    function buildPrompt(desc, lang) {
        const names = { '0': 'C', '1': 'C++', '3': 'Java', '6': 'Python', '17': 'Go' };
        return `${desc}\n\n请用${names[lang] || 'C++'}编写解题代码。\n只输出完整代码，不要任何解释和markdown格式。`;
    }

    async function callAI(apiKey, apiUrl, model, messages, maxTokens = 4000) {
        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature: 0.1, stream: false }),
        });
        if (!resp.ok) throw new Error(`API ${resp.status}: ${(await resp.text()).substring(0, 200)}`);
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
            const timeM = html.match(/<span[^>]*fd=['"]time_limit['"]\s*[^>]*>\s*(\d+)\s*<\/span>/);
            const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+\s*\w+)/);
            const { si, so } = extractSample(html);
            return [
                `【题目】${h3 ? h3[1].trim() : ''}`,
                `【时间】${timeM ? timeM[1] : '1'} Sec  【内存】${memM ? memM[1] : '32 MB'}`,
                `【描述】${extractSection(html, '题目描述') || extractSection(html, 'Description')}`,
                `【输入】${extractSection(html, '输入') || extractSection(html, 'Input')}`,
                `【输出】${extractSection(html, '输出') || extractSection(html, 'Output')}`,
                `【样例输入】\n${si}`,
                `【样例输出】\n${so}`,
                `【提示】${extractSection(html, '提示') || extractSection(html, 'Hint') || '无'}`,
            ].join('\n\n');
        } catch (e) { return ''; }
    }

    // ============ 提交记录 ============
    async function loadStatus(cid) {
        const el = document.getElementById('su-list');
        el.innerHTML = '<span style="color:#999;">加载中...</span>';
        try {
            const html = await fetchHTML(`status.php?cid=${cid}`);
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
                const cls = (r[2] && (r[2].includes('正确') || r[2].includes('Accepted'))) ? 'oj-tag-ok' : (r[2] && (r[2].includes('Wrong') || r[2].includes('错误'))) ? 'oj-tag-err' : 'oj-tag-pend';
                tbl += `<tr style="border-top:1px solid #eee;"><td style="padding:4px;">${r[0]||''}</td><td>${r[1]||''}</td><td><span class="oj-tag ${cls}">${r[2]||'?'}</span></td><td>${r[3]||''}</td><td>${r[4]||''}</td><td>${r[5]||''}</td><td>${r[8]||''}</td></tr>`;
            }
            tbl += '</table>';
            el.innerHTML = tbl;
        } catch (e) { el.innerHTML = '<span style="color:red;">加载失败</span>'; }
    }

    // ============ 事件 ============
    btn.onclick = () => {
        updateCtx();
        panel.classList.add('show'); overlay.classList.add('show');
        checkOCR();
        const c = getCtx();
        if (c.cid && c.pid !== '' && !document.getElementById('ai-desc').value.trim()) {
            extractProblemDesc(c.cid, c.pid).then(d => { if (d) document.getElementById('ai-desc').value = d; });
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
            if (tab.dataset.page === 'solve') updateCtx();
        };
    });

    // 加载设置
    document.getElementById('st-api-key').value = SETTINGS.api_key;
    document.getElementById('st-api-url').value = SETTINGS.api_url;
    document.getElementById('st-model').value = SETTINGS.model;
    document.getElementById('st-lang').value = SETTINGS.lang;
    document.getElementById('st-ocr-url').value = OCR_SERVER;
    document.getElementById('ai-lang').value = SETTINGS.lang;
    document.getElementById('ai-model').value = SETTINGS.model;

    // 爬取
    document.getElementById('cr-start').onclick = async () => {
        const cids = parseCids(document.getElementById('cr-cids').value);
        const pwd = document.getElementById('cr-pwd').value.trim();
        const fmt = document.getElementById('cr-fmt').value;
        if (!cids.length) { crLog.log('请输入比赛ID', 'err'); return; }
        crLog.clear();
        const progressEl = document.getElementById('cr-progress');
        const fill = progressEl.querySelector('.fill');
        const txt = progressEl.querySelector('.txt');
        progressEl.style.display = 'block';
        crLog.log(`🚀 爬取 ${cids.length} 个比赛: [${cids.join(', ')}]`, 'info');

        const all = {}; let total = 0, done = 0;
        const contests = {};
        for (const cid of cids) {
            crLog.log(`📋 ${cid}...`, 'info');
            const html = await accessContest(cid, pwd);
            if (!html) { crLog.log(`${cid}: 无法访问`, 'err'); continue; }
            const probs = parseProblemList(html, cid);
            if (!probs.length) { crLog.log(`${cid}: 无题目`, 'err'); continue; }
            contests[cid] = probs; total += probs.length;
            crLog.log(`${cid}: ${probs.length}题`, 'ok');
        }
        if (!total) { crLog.log('没找到题目', 'err'); return; }
        txt.textContent = `0 / ${total}`;

        for (const cid of cids) {
            const probs = contests[cid]; if (!probs) continue;
            all[cid] = [];
            for (const p of probs) {
                const detail = await scrapeOneProblem(cid, p.pid);
                if (detail) {
                    all[cid].push(detail);
                    crLog.log(`  ✅ [${cid}] #${p.pid}: ${detail.title}`, 'ok');
                    if (fmt === 'txt' || fmt === 'both') {
                        downloadBlob(problemToTXT(detail), `contest_${cid}_problem_${p.pid}.txt`, 'text/plain;charset=utf-8');
                        await new Promise(r => setTimeout(r, 200));
                    }
                } else { crLog.log(`  ⚠️ [${cid}] #${p.pid}: 失败`, 'warn'); }
                done++;
                fill.style.width = Math.round((done / total) * 100) + '%';
                txt.textContent = `${done} / ${total}`;
            }
        }
        if ((fmt === 'json' || fmt === 'both') && Object.keys(all).length) {
            downloadBlob(JSON.stringify(all, null, 2), `oj_problems_${cids.join('_')}.json`, 'application/json;charset=utf-8');
            crLog.log(`📦 JSON已导出`, 'ok');
        }
        txt.textContent = `✅ 完成 ${done}/${total}`;
        crLog.log(`🎉 爬取完毕!`, 'ok');
    };
    document.getElementById('cr-clear-log').onclick = () => { crLog.clear(); document.getElementById('cr-progress').style.display = 'none'; };

    // AI生成
    document.getElementById('ai-gen').onclick = async () => {
        const apiKey = document.getElementById('st-api-key').value.trim() || SETTINGS.api_key;
        const apiUrl = document.getElementById('st-api-url').value.trim() || SETTINGS.api_url;
        const model = document.getElementById('ai-model').value || SETTINGS.model;
        const lang = document.getElementById('ai-lang').value || SETTINGS.lang;
        if (!apiKey) { aiLog.log('请先设置API Key', 'err'); return; }
        const desc = document.getElementById('ai-desc').value.trim();
        if (!desc || desc.length < 10) { aiLog.log('题目描述太短', 'err'); return; }

        aiLog.log('🤖 调用AI...', 'info');
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

            // 自动OCR
            if (SETTINGS.use_ocr && (await checkOCR())) {
                aiLog.log('🔍 自动识别验证码...', 'info');
                const result = await autoOCR();
                if (result && result.length === 4 && /^\d{4}$/.test(result)) {
                    document.getElementById('ai-vcode').value = result;
                    aiLog.log(`🤖 OCR识别: ${result}`, 'ok');
                } else {
                    aiLog.log('⚠️ OCR识别失败，请手动输入', 'warn');
                }
            }
        } catch (e) { aiLog.log('❌ ' + e.message, 'err'); }
        finally { document.getElementById('ai-gen').disabled = false; document.getElementById('ai-gen').textContent = '🤖 AI 生成代码'; }
    };

    document.getElementById('ai-ocr-btn').onclick = async () => {
        await checkOCR();
        const result = await autoOCR();
        if (result && result.length === 4 && /^\d{4}$/.test(result)) {
            document.getElementById('ai-vcode').value = result;
            aiLog.log(`🤖 OCR: ${result}`, 'ok');
        } else {
            aiLog.log('❌ OCR失败', 'err');
        }
    };

    document.getElementById('ai-retry').onclick = () => document.getElementById('ai-gen').click();

    // 提交
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
        fd.append('language', lang); fd.append('source', code);
        fd.append('vcode', vcode);
        try {
            const r = await fetch('submit.php', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd, credentials: 'include' });
            const html = await r.text();
            const sidM = html.match(/solution[_ ]?id[=: ]*(\d+)/i);
            aiLog.log(`✅ 提交成功! Solution ID: ${sidM ? sidM[1] : '?'}`, 'ok');
            document.getElementById('ai-vcode-img').src = 'vcode.php?' + Math.random();
            document.getElementById('ai-vcode').value = '';
        } catch (e) { aiLog.log('❌ 提交失败: ' + e.message, 'err'); }
    };

    document.getElementById('ai-query').onclick = () => {
        document.querySelectorAll('.oj-nav-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.oj-page').forEach(p => p.classList.remove('active'));
        document.querySelector('[data-page="status"]').classList.add('active');
        document.getElementById('page-status').classList.add('active');
        loadStatus(getCtx().cid);
    };

    // 设置
    document.getElementById('st-save').onclick = () => {
        save('api_key', document.getElementById('st-api-key').value.trim());
        save('api_url', document.getElementById('st-api-url').value.trim());
        save('model', document.getElementById('st-model').value.trim());
        save('lang', document.getElementById('st-lang').value);
        GM_setValue('oj_ocr_server', document.getElementById('st-ocr-url').value.trim());
        document.getElementById('ai-lang').value = SETTINGS.lang;
        document.getElementById('ai-model').value = SETTINGS.model;
        alert('✅ 已保存!');
    };

    document.getElementById('st-test').onclick = async () => {
        const key = document.getElementById('st-api-key').value.trim() || SETTINGS.api_key;
        const url = document.getElementById('st-api-url').value.trim() || SETTINGS.api_url;
        if (!key || !url) { alert('请填写API Key和地址'); return; }
        try {
            await callAI(key, url, 'deepseek-chat', [{ role: 'user', content: 'say ok' }], 20);
            alert('✅ API 连接成功!');
        } catch (e) { alert('❌: ' + e.message); }
    };

    document.getElementById('st-ocr-test').onclick = async () => {
        const url = document.getElementById('st-ocr-url').value.trim();
        GM_setValue('oj_ocr_server', url);
        try {
            const r = await fetch(url + '/health');
            if (r.ok) { alert('✅ OCR服务连接成功!'); checkOCR(); }
            else { alert('❌ 服务返回异常'); }
        } catch (e) { alert('❌ 无法连接: ' + e.message); }
    };

    // 提交记录
    document.getElementById('su-refresh').onclick = () => loadStatus(getCtx().cid);

    // 快捷键
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') { e.preventDefault(); document.getElementById('ai-gen').click(); }
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') { e.preventDefault(); document.getElementById('ai-submit').click(); }
    });

    // 初始化
    updateCtx();
    const cInit = getCtx();
    if (cInit.cid && cInit.pid !== '') {
        extractProblemDesc(cInit.cid, cInit.pid).then(d => { if (d) document.getElementById('ai-desc').value = d; });
    }
    checkOCR();

    console.log('✅ HNUST OJ 全能助手 v5 已就绪');
    console.log('   OCR:', OCR_SERVER);
    console.log('   Ctrl+Shift+G → 生成 | Ctrl+Shift+Enter → 提交');
})();
