// ==UserScript==
// @name         HNUST OJ 一键爬取题目
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  在HNUST ACM OJ页面上，一键爬取比赛/实验的全部题目数据，导出为JSON和TXT文件
// @author       Mao
// @match        http://acm.hnust.edu.cn/*
// @match        https://acm.hnust.edu.cn/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ============ UI 组件 ============
    const STYLE = `
#oj-scraper-btn {
    position: fixed; bottom: 30px; right: 30px; z-index: 99999;
    width: 56px; height: 56px; border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none; color: #fff; font-size: 24px; cursor: pointer;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    transition: transform 0.2s, box-shadow 0.2s;
    display: flex; align-items: center; justify-content: center;
}
#oj-scraper-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.6);
}

#oj-scraper-panel {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    z-index: 100000; width: 520px; max-height: 85vh;
    background: #fff; border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    display: none; flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    overflow: hidden;
}
#oj-scraper-panel.show { display: flex; }

.ojs-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff; padding: 20px 24px;
    display: flex; justify-content: space-between; align-items: center;
}
.ojs-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.ojs-close {
    background: rgba(255,255,255,0.2); border: none; color: #fff;
    width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
    font-size: 18px; line-height: 1;
}
.ojs-close:hover { background: rgba(255,255,255,0.4); }

.ojs-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.ojs-body label { display: block; font-weight: 600; margin: 12px 0 4px; font-size: 13px; color: #555; }
.ojs-body input[type=text],
.ojs-body input[type=password] {
    width: 100%; padding: 10px 12px; border: 2px solid #e0e0e0;
    border-radius: 8px; font-size: 14px; box-sizing: border-box;
    transition: border-color 0.2s;
}
.ojs-body input:focus { outline: none; border-color: #667eea; }

.ojs-btn-row { display: flex; gap: 10px; margin-top: 16px; }
.ojs-btn {
    flex: 1; padding: 12px; border: none; border-radius: 8px;
    font-size: 14px; font-weight: 600; cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
}
.ojs-btn:hover { opacity: 0.9; }
.ojs-btn:active { transform: scale(0.97); }
.ojs-btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
.ojs-btn-success { background: #27ae60; color: #fff; }
.ojs-btn-warning { background: #f39c12; color: #fff; }
.ojs-btn-outline { background: #fff; color: #667eea; border: 2px solid #667eea; }

#ojs-progress { margin-top: 12px; }
.ojs-progress-bar {
    height: 6px; background: #e0e0e0; border-radius: 3px; overflow: hidden;
}
.ojs-progress-fill {
    height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 3px; transition: width 0.3s;
    width: 0%;
}
#ojs-log {
    margin-top: 8px; max-height: 200px; overflow-y: auto;
    font-size: 12px; color: #666; line-height: 1.6;
}
#ojs-log .ok { color: #27ae60; }
#ojs-log .err { color: #e74c3c; }
#ojs-log .info { color: #3498db; }

.ojs-overlay {
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.4); z-index: 99999; display: none;
}
.ojs-overlay.show { display: block; }
`;

    // 注入样式
    const styleEl = document.createElement('style');
    styleEl.textContent = STYLE;
    document.head.appendChild(styleEl);

    // 创建悬浮按钮
    const btn = document.createElement('button');
    btn.id = 'oj-scraper-btn';
    btn.title = '爬取OJ题目';
    btn.innerHTML = '📥';
    document.body.appendChild(btn);

    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.className = 'ojs-overlay';
    document.body.appendChild(overlay);

    // 创建面板
    const panel = document.createElement('div');
    panel.id = 'oj-scraper-panel';
    panel.innerHTML = `
<div class="ojs-header">
    <h2>📥 爬取OJ题目</h2>
    <button class="ojs-close" id="ojs-close">✕</button>
</div>
<div class="ojs-body">
    <label>比赛/实验 ID (CID)</label>
    <input type="text" id="ojs-cid" placeholder="例如: 3761 (多个用逗号分隔, 如 3761,3762,3763)">

    <label>范围爬取 (起始 - 结束)</label>
    <div style="display:flex; gap:8px; align-items:center;">
        <input type="text" id="ojs-cid-from" placeholder="起始CID" style="flex:1;">
        <span>—</span>
        <input type="text" id="ojs-cid-to" placeholder="结束CID" style="flex:1;">
    </div>

    <label>比赛密码 <span style="font-weight:400;color:#999;font-size:12px;">(如比赛需要密码，在此填写)</span></label>
    <input type="text" id="ojs-pwd" placeholder="留空则自动检测并弹窗询问">

    <label>导出格式</label>
    <div style="display:flex; gap:12px; margin-top:6px;">
        <label style="font-weight:400; display:flex; align-items:center; gap:4px;">
            <input type="radio" name="ojs-fmt" value="json" checked> JSON
        </label>
        <label style="font-weight:400; display:flex; align-items:center; gap:4px;">
            <input type="radio" name="ojs-fmt" value="txt"> TXT (每题单独下载)
        </label>
        <label style="font-weight:400; display:flex; align-items:center; gap:4px;">
            <input type="radio" name="ojs-fmt" value="both"> 两者都导出
        </label>
    </div>

    <div class="ojs-btn-row">
        <button class="ojs-btn ojs-btn-primary" id="ojs-scrape">🚀 开始爬取</button>
        <button class="ojs-btn ojs-btn-outline" id="ojs-clear">清空日志</button>
    </div>

    <div id="ojs-progress" style="display:none;">
        <div style="font-size:12px; color:#666; margin-bottom:4px;" id="ojs-progress-text">准备中...</div>
        <div class="ojs-progress-bar"><div class="ojs-progress-fill" id="ojs-progress-fill"></div></div>
    </div>
    <div id="ojs-log"></div>
</div>`;
    document.body.appendChild(panel);

    // ============ 事件绑定 ============
    btn.addEventListener('click', () => {
        // 自动从URL中提取CID
        const urlParams = new URLSearchParams(window.location.search);
        const cid = urlParams.get('cid');
        if (cid) {
            document.getElementById('ojs-cid').value = cid;
        }
        panel.classList.add('show');
        overlay.classList.add('show');
    });

    document.getElementById('ojs-close').addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);

    function closePanel() {
        panel.classList.remove('show');
        overlay.classList.remove('show');
    }

    document.getElementById('ojs-clear').addEventListener('click', () => {
        document.getElementById('ojs-log').innerHTML = '';
        document.getElementById('ojs-progress').style.display = 'none';
    });

    // ============ 核心爬取逻辑 ============
    function log(msg, cls) {
        const logEl = document.getElementById('ojs-log');
        logEl.innerHTML += `<span class="${cls || ''}">${msg}</span><br>`;
        logEl.scrollTop = logEl.scrollHeight;
    }

    function setProgress(pct, text) {
        const bar = document.getElementById('ojs-progress');
        bar.style.display = 'block';
        document.getElementById('ojs-progress-fill').style.width = pct + '%';
        document.getElementById('ojs-progress-text').textContent = text;
    }

    async function fetchPage(url) {
        const resp = await fetch(url, { credentials: 'include' });
        return await resp.text();
    }

    function extractSection(html, sectionName) {
        const re = new RegExp(
            `<h4[^>]*>\\s*${sectionName}\\s*<\\/h4>\\s*(.*?)(?=<h4[^>]*>|<\\/div>\\s*<\\/div>)`,
            's'
        );
        const m = html.match(re);
        if (!m) return '';
        let content = m[1];
        content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
        content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
        content = content.replace(/<pre[^>]*>/g, '\n');
        content = content.replace(/<\/pre>/g, '\n');
        content = content.replace(/<br\s*\/?>/gi, '\n');
        content = content.replace(/<[^>]+>/g, ' ');
        content = content.replace(/&nbsp;/g, ' ');
        content = content.replace(/&lt;/g, '<');
        content = content.replace(/&gt;/g, '>');
        content = content.replace(/&amp;/g, '&');
        content = content.replace(/\n\s*\n/g, '\n');
        content = content.replace(/[ \t]+/g, ' ');
        content = content.replace(/\n +/g, '\n');
        content = content.trim();
        return content;
    }

    function extractSampleIO(html) {
        // 尝试从 <pre> 中提取
        const preRe = /<pre[^>]*>([\s\S]*?)<\/pre>/g;
        const pres = [];
        let m;
        while ((m = preRe.exec(html)) !== null) {
            let text = m[1].replace(/<[^>]+>/g, '');
            text = text.replace(/&nbsp;/g, ' ');
            text = text.replace(/&lt;/g, '<');
            text = text.replace(/&gt;/g, '>');
            text = text.replace(/&amp;/g, '&');
            text = text.trim();
            if (text) pres.push(text);
        }

        let sampleInput = '';
        let sampleOutput = '';
        if (pres.length >= 2) {
            // 第一个 <pre> 通常是样例输入，第二个是样例输出
            // 但也可能是代码模板
            for (let i = 0; i < pres.length - 1; i++) {
                // 检查前面是否有关键词
                const beforeIdx = html.indexOf(pres[i]);
                const before = html.substring(Math.max(0, beforeIdx - 200), beforeIdx);
                if (before.includes('样例输入') || before.includes('sampleinput') || before.includes('Sample Input')) {
                    sampleInput = pres[i];
                    if (i + 1 < pres.length) {
                        sampleOutput = pres[i + 1];
                    }
                    break;
                }
                if (before.includes('样例输出') || before.includes('sampleoutput') || before.includes('Sample Output')) {
                    sampleOutput = pres[i];
                }
            }
            // 如果没有通过关键词找到，则取前两个
            if (!sampleInput && pres.length >= 2) {
                sampleInput = pres[0];
                sampleOutput = pres[1];
            }
        }

        // 也尝试 <span id="sampleinput"> 方式
        if (!sampleInput) {
            const siM = html.match(/<span[^>]*id=["']sampleinput["'][^>]*>([\s\S]*?)<\/span>/i);
            if (siM) sampleInput = siM[1].trim();
        }
        if (!sampleOutput) {
            const soM = html.match(/<span[^>]*id=["']sampleoutput["'][^>]*>([\s\S]*?)<\/span>/i);
            if (soM) sampleOutput = soM[1].trim();
        }

        return { sampleInput, sampleOutput };
    }

    async function scrapeProblem(cid, pid) {
        const url = `problem.php?cid=${cid}&pid=${pid}`;
        const html = await fetchPage(url);

        if (html.length < 500 || html.includes('Not Invited')) {
            return null;
        }

        const titleM = html.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/);
        const title = titleM ? titleM[1].trim() : '';

        if (!title) return null;

        const timeM = html.match(/<span[^>]*fd=['"]time_limit['"][^>]*>\s*(\d+)\s*<\/span>/);
        const timeLimit = timeM ? timeM[1] + ' Sec' : '1 Sec';

        const memM = html.match(/内存限制[：:]?\s*<\/span>\s*(\d+)\s*(\w+)/);
        const memoryLimit = memM ? memM[1] + ' ' + memM[2] : '32 MB';

        const description = extractSection(html, '题目描述') || extractSection(html, 'Description');
        const inputSpec = extractSection(html, '输入') || extractSection(html, 'Input');
        const outputSpec = extractSection(html, '输出') || extractSection(html, 'Output');
        const hint = extractSection(html, '提示') || extractSection(html, 'Hint');

        const { sampleInput, sampleOutput } = extractSampleIO(html);

        return {
            pid,
            title,
            time_limit: timeLimit,
            memory_limit: memoryLimit,
            description,
            input: inputSpec,
            output: outputSpec,
            sample_input: sampleInput,
            sample_output: sampleOutput,
            hint,
        };
    }

    async function accessContest(cid, password) {
        // 尝试直接访问
        let html = await fetchPage(`contest.php?cid=${cid}`);

        // 检测是否需要密码
        if (html.includes('尚未开始或私有') || html.includes('密码')) {
            if (password) {
                // 提交密码
                const formData = new URLSearchParams();
                formData.append('password', password);
                const resp = await fetch(`contest.php?cid=${cid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData,
                    credentials: 'include',
                });
                html = await resp.text();
            } else {
                // 弹窗询问密码
                password = prompt(`比赛 ${cid} 需要密码才能查看题目，请输入密码：`);
                if (!password) {
                    log(`比赛 ${cid}: 未提供密码，跳过`, 'err');
                    return null;
                }
                const formData = new URLSearchParams();
                formData.append('password', password);
                const resp = await fetch(`contest.php?cid=${cid}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData,
                    credentials: 'include',
                });
                html = await resp.text();
            }
        }

        // 再次检查
        if (html.includes('尚未开始或私有') || html.includes('Not Invited')) {
            log(`比赛 ${cid}: 密码错误或无权限访问`, 'err');
            return null;
        }

        return html;
    }

    function parseProblemList(html, cid) {
        const problems = [];
        const re = new RegExp(`problem\\.php\\?cid=${cid}&pid=(\\d+)[^>]*>([^<]+)`, 'g');
        let m;
        while ((m = re.exec(html)) !== null) {
            problems.push({ pid: parseInt(m[1]), name: m[2].trim() });
        }
        return problems;
    }

    function downloadBlob(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function formatProblemTXT(p) {
        return [
            `Title: ${p.title}`,
            `Time Limit: ${p.time_limit}`,
            `Memory Limit: ${p.memory_limit}`,
            ``,
            `${'='.repeat(60)}`,
            `Description:`,
            p.description,
            ``,
            `${'='.repeat(60)}`,
            `Input:`,
            p.input,
            ``,
            `${'='.repeat(60)}`,
            `Output:`,
            p.output,
            ``,
            `${'='.repeat(60)}`,
            `Sample Input:`,
            p.sample_input,
            ``,
            `${'='.repeat(60)}`,
            `Sample Output:`,
            p.sample_output,
            ``,
            `${'='.repeat(60)}`,
            `Hint:`,
            p.hint,
        ].join('\n');
    }

    // ============ 主流程 ============
    document.getElementById('ojs-scrape').addEventListener('click', async () => {
        const cidInput = document.getElementById('ojs-cid').value.trim();
        const cidFrom = document.getElementById('ojs-cid-from').value.trim();
        const cidTo = document.getElementById('ojs-cid-to').value.trim();
        const password = document.getElementById('ojs-pwd').value.trim();
        const fmt = document.querySelector('input[name="ojs-fmt"]:checked').value;

        // 收集CID列表
        let cids = [];
        if (cidInput) {
            cids = cidInput.split(',').map(s => s.trim()).filter(s => s);
        }
        if (cidFrom && cidTo) {
            const from = parseInt(cidFrom);
            const to = parseInt(cidTo);
            if (!isNaN(from) && !isNaN(to) && from <= to) {
                for (let i = from; i <= to; i++) {
                    cids.push(String(i));
                }
            }
        }

        if (cids.length === 0) {
            log('请先输入要爬取的比赛CID！', 'err');
            return;
        }

        // 去重
        cids = [...new Set(cids)];

        log(`🚀 准备爬取 ${cids.length} 个比赛: [${cids.join(', ')}]`, 'info');
        document.getElementById('ojs-log').innerHTML = '';

        const allResults = {};
        let totalProblems = 0;
        let completedProblems = 0;
        let totalExpected = 0;

        // 第一阶段：获取所有比赛的问题列表
        const contestProblemLists = {};
        for (const cid of cids) {
            log(`📋 正在获取比赛 ${cid} 的问题列表...`, 'info');
            const html = await accessContest(cid, password);
            if (!html) {
                log(`比赛 ${cid}: 无法访问，跳过`, 'err');
                continue;
            }
            const problems = parseProblemList(html, cid);
            if (problems.length === 0) {
                log(`比赛 ${cid}: 未找到题目列表`, 'err');
                continue;
            }
            contestProblemLists[cid] = problems;
            totalExpected += problems.length;
            log(`比赛 ${cid}: 发现 ${problems.length} 道题目`, 'ok');
        }

        if (totalExpected === 0) {
            log('没有找到任何题目，请检查CID是否正确', 'err');
            setProgress(0, '失败');
            return;
        }

        setProgress(0, `0 / ${totalExpected}`);

        // 第二阶段：逐个爬取题目详情
        for (const cid of cids) {
            const problems = contestProblemLists[cid];
            if (!problems) continue;

            allResults[cid] = [];

            for (const prob of problems) {
                log(`  🔍 正在爬取: 比赛${cid} #${prob.pid} - ${prob.name}`, 'info');
                const detail = await scrapeProblem(cid, prob.pid);

                if (detail) {
                    allResults[cid].push(detail);
                    totalProblems++;
                    log(`  ✅ 完成: ${detail.title}`, 'ok');

                    // 如果是TXT格式，立即下载
                    if (fmt === 'txt' || fmt === 'both') {
                        const txt = formatProblemTXT(detail);
                        const safeTitle = detail.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 40);
                        const filename = `contest_${cid}_problem_${prob.pid}_${safeTitle}.txt`;
                        downloadBlob(txt, filename, 'text/plain;charset=utf-8');
                        await new Promise(r => setTimeout(r, 300)); // 避免浏览器阻止连续下载
                    }
                } else {
                    log(`  ⚠️ 跳过: 比赛${cid} #${prob.pid} 无法获取`, 'err');
                }

                completedProblems++;
                const pct = Math.round((completedProblems / totalExpected) * 100);
                setProgress(pct, `${completedProblems} / ${totalExpected}`);
            }
        }

        // 保存JSON
        if ((fmt === 'json' || fmt === 'both') && totalProblems > 0) {
            const jsonStr = JSON.stringify(allResults, null, 2);
            const filename = `oj_problems_${cids.join('_')}.json`;
            downloadBlob(jsonStr, filename, 'application/json;charset=utf-8');
            log(`📦 JSON已导出: ${filename}`, 'ok');
        }

        setProgress(100, `完成! ${totalProblems}/${totalExpected} 题`);
        log(`🎉 全部完成! 成功爬取 ${totalProblems} 道题目`, 'ok');
        log(`💾 文件已保存到下载目录`, 'info');
    });

    // ============ 键盘快捷键 ============
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            btn.click();
        }
    });

    console.log('✅ HNUST OJ Scraper 已就绪');
    console.log('   📥 点击右下角按钮 或 按 Ctrl+Shift+S 打开爬取面板');
    console.log('   📋 在比赛页面打开会自动填入当前CID');

})();
