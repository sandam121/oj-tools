// ==UserScript==
// @name         HNUST OJ AI做题助手
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  AI帮你自动生成代码并提交到HNUST OJ。支持DeepSeek、OpenAI等API。提交时需手动输入验证码。
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

    // ============ 配置存储 ============
    const SETTINGS = {
        api_url: GM_getValue('oj_ai_api_url', 'https://api.deepseek.com/chat/completions'),
        api_key: GM_getValue('oj_ai_api_key', ''),
        model: GM_getValue('oj_ai_model', 'deepseek-chat'),
        lang: GM_getValue('oj_ai_lang', '1'),           // 默认C++
        auto_submit: GM_getValue('oj_ai_auto_submit', false),
    };

    function saveSetting(k, v) { SETTINGS[k] = v; GM_setValue('oj_ai_' + k, v); }

    // ============ CSS ============
    const STYLE = `
.ojai-btn {
    position: fixed; bottom: 30px; right: 100px; z-index: 99999;
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, #e74c3c 0%, #f39c12 100%);
    border: none; color: #fff; font-size: 22px; cursor: pointer;
    box-shadow: 0 4px 15px rgba(231, 76, 60, 0.4);
    transition: transform 0.2s;
    display: flex; align-items: center; justify-content: center;
}
.ojai-btn:hover { transform: scale(1.1); }

.ojai-panel {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 100001; width: 700px; max-height: 90vh;
    background: #fff; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    display: none; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
}
.ojai-panel.show { display: flex; }

.ojai-header {
    background: linear-gradient(135deg, #e74c3c 0%, #f39c12 100%);
    color: #fff; padding: 16px 20px;
    display: flex; justify-content: space-between; align-items: center;
}
.ojai-header h2 { margin: 0; font-size: 17px; font-weight: 600; }
.ojai-close { background: rgba(255,255,255,0.2); border: none; color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px; }

.ojai-tabs { display: flex; border-bottom: 2px solid #eee; padding: 0 16px; background: #fafafa; }
.ojai-tab { padding: 10px 18px; cursor: pointer; font-size: 13px; font-weight: 600; color: #999; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.ojai-tab.active { color: #e74c3c; border-bottom-color: #e74c3c; }

.ojai-body { padding: 16px 20px; overflow-y: auto; flex: 1; max-height: 55vh; }
.ojai-tab-content { display: none; }
.ojai-tab-content.active { display: block; }

.ojai-body label { display: block; font-weight: 600; margin: 10px 0 4px; font-size: 12px; color: #555; }
.ojai-body input[type=text],
.ojai-body input[type=password],
.ojai-body textarea,
.ojai-body select {
    width: 100%; padding: 8px 10px; border: 2px solid #e0e0e0;
    border-radius: 8px; font-size: 13px; box-sizing: border-box;
    transition: border-color 0.2s; font-family: inherit;
}
.ojai-body input:focus, .ojai-body textarea:focus, .ojai-body select:focus {
    outline: none; border-color: #e74c3c;
}
.ojai-body textarea { resize: vertical; min-height: 100px; font-family: 'Consolas', 'Monaco', monospace; }

.ojai-row { display: flex; gap: 10px; }
.ojai-row > * { flex: 1; }

.ojai-btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
.ojai-btn2 {
    padding: 8px 16px; border: none; border-radius: 8px;
    font-size: 13px; font-weight: 600; cursor: pointer;
    transition: opacity 0.2s;
}
.ojai-btn2:hover { opacity: 0.85; }
.ojai-btn2:disabled { opacity: 0.5; cursor: not-allowed; }
.ojai-btn2-red { background: #e74c3c; color: #fff; }
.ojai-btn2-green { background: #27ae60; color: #fff; }
.ojai-btn2-blue { background: #3498db; color: #fff; }
.ojai-btn2-gray { background: #95a5a6; color: #fff; }
.ojai-btn2-outline { background: #fff; color: #e74c3c; border: 2px solid #e74c3c; }

#ojai-log {
    margin-top: 10px; max-height: 180px; overflow-y: auto;
    font-size: 12px; color: #555; line-height: 1.6;
    background: #f9f9f9; padding: 8px 12px; border-radius: 8px;
}
#ojai-log .ok { color: #27ae60; }
#ojai-log .err { color: #e74c3c; }
#ojai-log .warn { color: #f39c12; }
#ojai-log .info { color: #3498db; }

.ojai-vcode-box {
    display: flex; gap: 8px; align-items: center; margin-top: 8px;
    padding: 10px; background: #fff3cd; border-radius: 8px;
}
.ojai-vcode-box input { flex: 1; }
.ojai-vcode-box img { height: 36px; border-radius: 4px; cursor: pointer; border: 1px solid #ddd; }

.ojai-status-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
.ojai-status-ac { background: #d4edda; color: #155724; }
.ojai-status-wa { background: #f8d7da; color: #721c24; }
.ojai-status-pending { background: #d1ecf1; color: #0c5460; }

.ojai-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.4); z-index: 100000; display: none;
}
.ojai-overlay.show { display: block; }
`;

    // ============ 注入样式 ============
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    // ============ 获取当前页面上下文 ============
    function getCurrentContext() {
        const url = new URL(window.location.href);
        const params = url.searchParams;

        // 尝试从标题获取问题信息
        const h3 = document.querySelector('h3');
        const title = h3 ? h3.textContent.trim() : '';

        let cid = params.get('cid') || '';
        let pid = params.get('pid') || '';

        // 如果不是题目页，尝试从页面内容中提取
        if (!cid || pid === '') {
            // 从页面链接提取
            const links = document.querySelectorAll('a[href*="cid="]');
            for (const a of links) {
                const href = a.getAttribute('href');
                if (href && href.includes('cid=')) {
                    const lp = new URLSearchParams(href.split('?')[1] || '');
                    if (!cid) cid = lp.get('cid') || '';
                    if (pid === '') {
                        const pp = lp.get('pid');
                        if (pp !== null) pid = pp;
                    }
                }
            }
        }

        return { cid, pid, title, url: url.href };
    }

    // ============ DOM ============
    const overlay = document.createElement('div');
    overlay.className = 'ojai-overlay';
    document.body.appendChild(overlay);

    const btn = document.createElement('button');
    btn.className = 'ojai-btn';
    btn.title = 'AI做题助手';
    btn.innerHTML = '🤖';
    document.body.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'ojai-panel';
    panel.innerHTML = `
<div class="ojai-header">
    <h2>🤖 AI做题助手</h2>
    <div>
        <button class="ojai-close" id="ojai-close">✕</button>
    </div>
</div>
<div class="ojai-tabs">
    <div class="ojai-tab active" data-tab="solve">🎯 自动解题</div>
    <div class="ojai-tab" data-tab="settings">⚙️ 设置</div>
    <div class="ojai-tab" data-tab="history">📊 提交记录</div>
</div>
<div class="ojai-body">
    <!-- 解题 Tab -->
    <div class="ojai-tab-content active" id="tab-solve">
        <div style="padding: 6px 10px; background: #d1ecf1; border-radius: 8px; font-size:12px; color: #0c5460; margin-bottom:10px;">
            📋 当前题目: <b id="ojai-ctx"></b>
        </div>

        <label>📝 题目描述 (可编辑补充)</label>
        <textarea id="ojai-desc" rows="4" placeholder="题目描述会自动提取..."></textarea>

        <div class="ojai-row">
            <div><label>语言</label>
                <select id="ojai-lang">
                    <option value="1">C++</option><option value="0">C</option><option value="6">Python</option>
                    <option value="3">Java</option><option value="17">Go</option>
                    <option value="16">JavaScript</option>
                </select>
            </div>
            <div><label>AI模型</label>
                <select id="ojai-model">
                    <option value="deepseek-chat">DeepSeek-Chat</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet</option>
                </select>
            </div>
        </div>

        <button class="ojai-btn2 ojai-btn2-red" id="ojai-generate" style="width:100%;margin-top:10px;">
            🤖 AI生成代码
        </button>

        <label style="margin-top:12px;">💻 生成的代码 <span style="font-weight:400;color:#999;">(可手动修改)</span></label>
        <textarea id="ojai-code" rows="10" placeholder="AI生成的代码会显示在这里..."></textarea>

        <div style="margin-top:8px; display:none;" id="ojai-submit-area">
            <div class="ojai-vcode-box">
                <span style="font-size:12px; font-weight:600;">🔐 验证码:</span>
                <input type="text" id="ojai-vcode" size="6" placeholder="输入验证码">
                <img id="ojai-vcode-img" src="vcode.php" alt="验证码" onclick="this.src='vcode.php?'+Math.random()">
                <span style="font-size:11px; color:#999;">点击图片刷新</span>
            </div>
            <div class="ojai-btn-row">
                <button class="ojai-btn2 ojai-btn2-green" id="ojai-submit">🚀 提交代码</button>
                <button class="ojai-btn2 ojai-btn2-blue" id="ojai-query">🔍 查询结果</button>
                <button class="ojai-btn2 ojai-btn2-outline" id="ojai-retry">🔄 换个思路重新生成</button>
            </div>
        </div>

        <div id="ojai-log"></div>
    </div>

    <!-- 设置 Tab -->
    <div class="ojai-tab-content" id="tab-settings">
        <label>🔑 API Key</label>
        <input type="password" id="ojai-api-key" placeholder="sk-... 你的API Key">
        <div style="font-size:11px; color:#999; margin-bottom:8px;">
            支持 DeepSeek / OpenAI 兼容接口。Key仅保存在浏览器本地存储中。
        </div>

        <label>🌐 API地址</label>
        <input type="text" id="ojai-api-url" placeholder="https://api.deepseek.com/chat/completions">

        <div class="ojai-row">
            <div><label>默认模型</label>
                <input type="text" id="ojai-default-model" placeholder="deepseek-chat">
            </div>
            <div><label>默认语言</label>
                <select id="ojai-default-lang">
                    <option value="1">C++</option><option value="0">C</option><option value="6">Python</option>
                    <option value="3">Java</option><option value="17">Go</option>
                </select>
            </div>
        </div>

        <div class="ojai-btn-row" style="margin-top:12px;">
            <button class="ojai-btn2 ojai-btn2-green" id="ojai-save-settings">💾 保存设置</button>
            <button class="ojai-btn2 ojai-btn2-outline" id="ojai-test-api">🔗 测试连接</button>
        </div>
    </div>

    <!-- 提交记录 Tab -->
    <div class="ojai-tab-content" id="tab-history">
        <button class="ojai-btn2 ojai-btn2-blue" id="ojai-load-history">🔄 刷新提交记录</button>
        <div id="ojai-history-list" style="margin-top:8px; font-size:12px;"></div>
    </div>
</div>`;
    document.body.appendChild(panel);

    // ============ 初始化 ============
    const LOG_EL = document.getElementById('ojai-log');

    function log(msg, cls) {
        const time = new Date().toLocaleTimeString();
        LOG_EL.innerHTML += `<span class="${cls || ''}">[${time}] ${msg}</span><br>`;
        LOG_EL.scrollTop = LOG_EL.scrollHeight;
    }

    function clearLog() { LOG_EL.innerHTML = ''; }

    // 加载设置
    document.getElementById('ojai-api-key').value = SETTINGS.api_key;
    document.getElementById('ojai-api-url').value = SETTINGS.api_url;
    document.getElementById('ojai-default-model').value = SETTINGS.model;
    document.getElementById('ojai-default-lang').value = SETTINGS.lang;
    document.getElementById('ojai-lang').value = SETTINGS.lang;
    document.getElementById('ojai-model').value = SETTINGS.model;

    // 显示当前上下文
    const ctx = getCurrentContext();
    document.getElementById('ojai-ctx').textContent =
        `CID=${ctx.cid}, PID=${ctx.pid} 「${ctx.title}」`;

    // 如果没有题目描述，尝试自动提取
    if (!document.getElementById('ojai-desc').value.trim()) {
        extractProblemDescription().then(desc => {
            if (desc) document.getElementById('ojai-desc').value = desc;
        });
    }

    // ============ 事件委托 ============
    btn.addEventListener('click', () => {
        panel.classList.add('show');
        overlay.classList.add('show');
        // 自动提取题目描述和上下文
        const ctx2 = getCurrentContext();
        document.getElementById('ojai-ctx').textContent =
            `CID=${ctx2.cid}, PID=${ctx2.pid} 「${ctx2.title}」`;
        extractProblemDescription().then(desc => {
            if (desc && !document.getElementById('ojai-desc').value.trim()) {
                document.getElementById('ojai-desc').value = desc;
            }
        });
    });

    document.getElementById('ojai-close').addEventListener('click', () => {
        panel.classList.remove('show');
        overlay.classList.remove('show');
    });
    overlay.addEventListener('click', () => {
        panel.classList.remove('show');
        overlay.classList.remove('show');
    });

    // Tab切换
    document.querySelectorAll('.ojai-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.ojai-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.ojai-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    // 保存设置
    document.getElementById('ojai-save-settings').addEventListener('click', () => {
        saveSetting('api_key', document.getElementById('ojai-api-key').value.trim());
        saveSetting('api_url', document.getElementById('ojai-api-url').value.trim());
        saveSetting('model', document.getElementById('ojai-default-model').value.trim());
        saveSetting('lang', document.getElementById('ojai-default-lang').value);
        document.getElementById('ojai-lang').value = SETTINGS.lang;
        document.getElementById('ojai-model').value = SETTINGS.model;
        log('✅ 设置已保存', 'ok');
    });

    // 测试API连接
    document.getElementById('ojai-test-api').addEventListener('click', async () => {
        const key = document.getElementById('ojai-api-key').value.trim();
        const url = document.getElementById('ojai-api-url').value.trim();
        if (!key || !url) { log('请先填写 API Key 和 API 地址', 'err'); return; }
        log('🔗 测试连接中...', 'info');
        try {
            const resp = await callAI(url, key, 'deepseek-chat', [{ role: 'user', content: 'hi, say "ok"' }]);
            log('✅ 连接成功! 响应: ' + resp.substring(0, 100), 'ok');
        } catch (e) {
            log('❌ 连接失败: ' + e.message, 'err');
        }
    });

    // AI生成代码
    document.getElementById('ojai-generate').addEventListener('click', async () => {
        const apiKey = document.getElementById('ojai-api-key').value.trim() || SETTINGS.api_key;
        const apiUrl = document.getElementById('ojai-api-url').value.trim() || SETTINGS.api_url;
        const model = document.getElementById('ojai-model').value || SETTINGS.model;
        const lang = document.getElementById('ojai-lang').value || SETTINGS.lang;

        if (!apiKey) { log('❌ 请先在设置中配置 API Key', 'err'); return; }

        const desc = document.getElementById('ojai-desc').value.trim();
        if (!desc || desc.length < 10) { log('❌ 题目描述太短，请补充', 'err'); return; }

        log('🤖 正在调用AI生成代码...', 'info');
        document.getElementById('ojai-generate').disabled = true;
        document.getElementById('ojai-generate').textContent = '⏳ 生成中...';

        try {
            const prompt = buildPrompt(desc, lang);
            const response = await callAI(apiUrl, apiKey, model, [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ], 4000);

            // 提取代码
            const code = extractCode(response, lang);
            document.getElementById('ojai-code').value = code;
            document.getElementById('ojai-submit-area').style.display = 'block';
            // 刷新验证码
            document.getElementById('ojai-vcode-img').src = 'vcode.php?' + Math.random();
            log('✅ 代码生成完毕! 长度: ' + code.length + ' 字符', 'ok');
        } catch (e) {
            log('❌ AI生成失败: ' + e.message, 'err');
        } finally {
            document.getElementById('ojai-generate').disabled = false;
            document.getElementById('ojai-generate').textContent = '🤖 AI生成代码';
        }
    });

    // 换个思路重新生成
    document.getElementById('ojai-retry').addEventListener('click', () => {
        document.getElementById('ojai-generate').click();
    });

    // 提交代码
    document.getElementById('ojai-submit').addEventListener('click', async () => {
        const code = document.getElementById('ojai-code').value.trim();
        const vcode = document.getElementById('ojai-vcode').value.trim();
        const ctx3 = getCurrentContext();
        const lang = document.getElementById('ojai-lang').value || SETTINGS.lang;

        if (!code) { log('❌ 没有代码可提交', 'err'); return; }
        if (!vcode) { log('❌ 请输入验证码', 'err'); return; }
        if (!ctx3.cid || ctx3.pid === '') { log('❌ 无法确定比赛ID，请在题目页面使用', 'err'); return; }

        log('🚀 正在提交...', 'info');

        try {
            // 用FormData
            const formData = new URLSearchParams();
            formData.append('cid', ctx3.cid);
            formData.append('pid', ctx3.pid);
            formData.append('language', lang);
            formData.append('source', code);
            formData.append('vcode', vcode);

            const resp = await fetch('submit.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
                credentials: 'include',
            });

            const resultHtml = await resp.text();

            if (resultHtml.includes('Solution ID') || resultHtml.includes('success') ||
                resultHtml.includes('已提交') || resultHtml.includes('等待')) {
                // 提取solution ID
                const sidMatch = resultHtml.match(/solution[_ ]?id[=: ]*(\d+)/i);
                const sid = sidMatch ? sidMatch[1] : '?';
                log(`✅ 提交成功! Solution ID: ${sid}`, 'ok');
                log(`🔍 点击"查询结果"按钮查看判题结果`, 'info');

                // 保存到本地历史
                saveToHistory({ sid, cid: ctx3.cid, pid: ctx3.pid, title: ctx3.title, time: new Date().toISOString(), status: 'pending' });
            } else if (resultHtml.includes('wrong') || resultHtml.includes('错误') || resultHtml.includes('失败')) {
                log('❌ 提交失败，请检查验证码是否正确', 'err');
            } else {
                log('⚠️ 提交状态未知，请手动检查状态页面', 'warn');
            }

            // 刷新验证码
            document.getElementById('ojai-vcode-img').src = 'vcode.php?' + Math.random();
            document.getElementById('ojai-vcode').value = '';

        } catch (e) {
            log('❌ 提交失败: ' + e.message, 'err');
        }
    });

    // 查询结果
    document.getElementById('ojai-query').addEventListener('click', async () => {
        const ctx4 = getCurrentContext();
        log('🔍 查询提交记录...', 'info');
        await loadSubmissionHistory(ctx4.cid);
    });

    // 加载提交记录
    document.getElementById('ojai-load-history').addEventListener('click', async () => {
        await loadSubmissionHistory(getCurrentContext().cid);
    });

    // ============ 核心函数 ============

    async function extractProblemDescription() {
        const ctx = getCurrentContext();
        if (!ctx.cid || ctx.pid === '') return '';

        try {
            const resp = await fetch(`problem.php?cid=${ctx.cid}&pid=${ctx.pid}`, { credentials: 'include' });
            const html = await resp.text();

            // 提取标题
            const h3Match = html.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
            const title = h3Match ? h3Match[1].trim() : '';

            // 提取各section
            const sections = {};
            for (const [key, name] of [['desc', '题目描述'], ['input', '输入'], ['output', '输出'], ['hint', '提示']]) {
                const re = new RegExp(`<h4[^>]*>\\s*${name}\\s*<\\/h4>\\s*(.*?)(?=<h4[^>]*>|<\\/div>\\s*<\\/div>)`, 's');
                const m = html.match(re);
                if (m) {
                    let content = m[1];
                    content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
                    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
                    content = content.replace(/<pre[^>]*>/g, '\n').replace(/<\/pre>/g, '\n');
                    content = content.replace(/<br\s*\/?>/gi, '\n');
                    content = content.replace(/<[^>]+>/g, ' ');
                    content = content.replace(/&nbsp;/g, ' ');
                    content = content.replace(/&lt;/g, '<');
                    content = content.replace(/&gt;/g, '>');
                    content = content.replace(/&amp;/g, '&');
                    content = content.replace(/\n\s*\n/g, '\n').replace(/[ \t]+/g, ' ').trim();
                    sections[key] = content;
                }
            }

            // 样例
            const pres = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/g);
            let sampleIn = '', sampleOut = '';
            if (pres && pres.length >= 2) {
                sampleIn = pres[0].replace(/<[^>]+>/g, '').trim();
                sampleOut = pres[1].replace(/<[^>]+>/g, '').trim();
            }

            // 时间/内存
            const timeM = html.match(/<span[^>]*fd=['"]time_limit['"]\s*[^>]*>\s*(\d+)\s*<\/span>/);
            const timeLimit = timeM ? timeM[1] + ' Sec' : '1 Sec';
            const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+\s*\w+)/);
            const memLimit = memM ? memM[1] : '32 MB';

            return [
                `【题目】${title}`,
                `【时间限制】${timeLimit}  【内存限制】${memLimit}`,
                `【题目描述】${sections.desc || ''}`,
                `【输入格式】${sections.input || ''}`,
                `【输出格式】${sections.output || ''}`,
                `【样例输入】\n${sampleIn}`,
                `【样例输出】\n${sampleOut}`,
                `【提示】${sections.hint || '无'}`,
            ].join('\n\n');
        } catch (e) {
            console.error('Failed to extract problem:', e);
            return '';
        }
    }

    const SYSTEM_PROMPT = `You are an expert competitive programmer. Given a programming problem, write a COMPLETE, COMPILABLE solution.

RULES:
1. Output ONLY the code. No explanations, no markdown formatting.
2. The code must be COMPLETE - include all necessary headers, main function, everything.
3. Read from standard input (stdin/scanf/cin) and write to standard output (printf/cout).
4. Handle input parsing correctly - read exactly what the problem describes.
5. Follow EXACT output format - spaces, newlines, formatting matter.
6. Use efficient algorithms. Pay attention to constraints (n up to 100000 needs O(n log n)).
7. For sorting problems, implement the SPECIFIC algorithm requested (not std::sort unless allowed).
8. For Chinese OJ problems, DO NOT output Chinese prompts like "请输入" - only output the required data.
9. Add a newline after the last output.
10. Use `int main()` not `void main()` for C/C++. Return 0 at the end.`;

    function buildPrompt(desc, lang) {
        const langNames = { '0': 'C', '1': 'C++', '3': 'Java', '6': 'Python', '17': 'Go', '16': 'JavaScript' };
        const langName = langNames[lang] || 'C++';

        const ioNote = lang === '6' ?
            `Python: Use sys.stdin.read().split() for fast input. Use sys.stdout.write() for output.` :
            lang === '1' ?
            `C++: For large n (≥100000), use scanf/printf instead of cin/cout, or add ios::sync_with_stdio(false).` : '';

        return `${desc}\n\n请用${langName}语言编写解题代码。\n${ioNote}\n只输出完整代码，不要解释。`;
    }

    async function callAI(apiUrl, apiKey, model, messages, maxTokens) {
        maxTokens = maxTokens || 4000;
        const resp = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: 0.1,
                stream: false,
            }),
        });

        if (!resp.ok) {
            const errText = await resp.text();
            throw new Error(`API Error ${resp.status}: ${errText.substring(0, 200)}`);
        }

        const data = await resp.json();
        return data.choices[0].message.content;
    }

    function extractCode(response, lang) {
        // 先尝试提取markdown代码块
        const m = response.match(/```[\w]*\n([\s\S]*?)```/);
        if (m) return m[1].trim();

        // 尝试提取 ``` 和结尾 ```
        const m2 = response.match(/```[\w]*([\s\S]*)```/);
        if (m2) return m2[1].trim();

        // 如果没有代码块标记，返回整个响应
        return response.trim();
    }

    // ============ 提交记录 ============
    async function loadSubmissionHistory(cid) {
        const historyEl = document.getElementById('ojai-history-list');
        historyEl.innerHTML = '<span style="color:#999;">加载中...</span>';

        try {
            const url = cid ? `status.php?cid=${cid}` : `status.php`;
            const resp = await fetch(url, { credentials: 'include' });
            const html = await resp.text();

            // 提取表格行
            const trRe = /<tr[^>]*>(.*?)<\/tr>/gs;
            const rows = [];
            let m;
            while ((m = trRe.exec(html)) !== null) {
                const tds = m[1].match(/<td[^>]*>(.*?)<\/td>/gs);
                if (tds && tds.length >= 8) {
                    const cells = tds.map(td => td.replace(/<[^>]+>/g, '').trim());
                    if (cells[0] && /^\d+$/.test(cells[0])) {
                        rows.push(cells);
                    }
                }
            }

            if (rows.length === 0) {
                historyEl.innerHTML = '<span style="color:#999;">暂无提交记录</span>';
                return;
            }

            let html2 = '<table style="width:100%;font-size:11px;border-collapse:collapse;">';
            html2 += '<tr style="background:#f5f5f5;"><th style="padding:6px;">RunID</th><th>用户</th><th>结果</th><th>内存</th><th>时间</th><th>语言</th><th>时间</th></tr>';
            for (const r of rows.slice(0, 20)) {
                const statusCls = r[2] && (r[2].includes('正确') || r[2].includes('Accepted')) ? 'ojai-status-ac' :
                    (r[2] && r[2].includes('Wrong') || r[2].includes('错误')) ? 'ojai-status-wa' : 'ojai-status-pending';
                html2 += `<tr style="border-top:1px solid #eee;">
          <td style="padding:4px;">${r[0]||''}</td>
          <td>${r[1]||''}</td>
          <td><span class="ojai-status-tag ${statusCls}">${r[2]||'?'}</span></td>
          <td>${r[3]||''}</td>
          <td>${r[4]||''}</td>
          <td>${r[5]||''}</td>
          <td>${r[8]||''}</td>
        </tr>`;
            }
            html2 += '</table>';
            if (rows.length > 20) html2 += '<br><span style="color:#999;">仅显示最近20条</span>';
            historyEl.innerHTML = html2;
        } catch (e) {
            historyEl.innerHTML = '<span style="color:red;">加载失败: ' + e.message + '</span>';
        }
    }

    function saveToHistory(entry) {
        let history = [];
        try {
            history = JSON.parse(GM_getValue('oj_ai_history', '[]'));
        } catch (e) { }
        history.unshift(entry);
        if (history.length > 50) history = history.slice(0, 50);
        GM_setValue('oj_ai_history', JSON.stringify(history));
    }

    // ============ 快捷键 ============
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'G') {
            e.preventDefault();
            document.getElementById('ojai-generate').click();
        }
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('ojai-submit').click();
        }
    });

    console.log('✅ HNUST OJ AI助手 已就绪');
    console.log('   🤖 点击右下角红色按钮打开');
    console.log('   Ctrl+Shift+G → 生成代码');
    console.log('   Ctrl+Shift+Enter → 提交代码');
    console.log('   支持 DeepSeek / OpenAI / Claude API');
    console.log('   ⚠️  提交需手动输入验证码');

})();
