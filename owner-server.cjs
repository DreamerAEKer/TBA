const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const ROOT = __dirname;
const PORT = Number(process.env.TBA_OWNER_PORT || 8768);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PRIVATE = path.join(ROOT, '.owner-private');
const TOKEN = crypto.randomBytes(32).toString('hex');
const REPO = 'DreamerAEKer/TBA';
let publishing = false;
let publication = { state: 'idle' };
function gh(args, input) {
    return new Promise((resolve, reject) => {
        const child = execFile('gh', args, { windowsHide: true, timeout: 60000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
            if (err) return reject(new Error('ติดต่อ GitHub ไม่สำเร็จ ตรวจบัญชีด้วย gh auth status แล้วลองใหม่'));
            try { resolve(JSON.parse(stdout)); } catch { reject(new Error('อ่านผลจาก GitHub ไม่สำเร็จ')); }
        });
        if (input) child.stdin.end(JSON.stringify(input));
    });
}
function online(value) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol)
        && !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i.test(u.hostname); } catch { return false; }
}
function selectedRecords(apps) {
    if (!Array.isArray(apps) || apps.length > 1000 || apps.some(a => !a || typeof a.id !== 'string' || typeof a.name !== 'string' || typeof a.url !== 'string')) throw new Error('รูปแบบรายการไม่ถูกต้อง');
    return apps.filter(a => a.published === true && online(a.url)).map(a => ({ id:a.id, name:a.name, url:a.url,
        year:a.year, category:a.category, hosting:a.hosting, icon:a.icon, color:a.color, description:a.description || '', clicks:0 }));
}
function saveOwner(apps) {
    selectedRecords(apps);
    fs.mkdirSync(PRIVATE, { recursive: true });
    const file = path.join(PRIVATE, 'owner.json');
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(PRIVATE, 'owner.previous.json'));
    fs.writeFileSync(file + '.tmp', JSON.stringify(apps, null, 2));
    fs.renameSync(file + '.tmp', file);
}
function send(res, status, data) {
    res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(JSON.stringify(data));
}
async function body(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 2*1024*1024) throw new Error('ไฟล์ใหญ่เกินไป'); }
    return JSON.parse(raw);
}
const server = http.createServer(async (req, res) => {
    try {
        if (req.headers.host !== `127.0.0.1:${PORT}`) return send(res,403,{error:'Host not allowed'});
        const url = new URL(req.url, ORIGIN);
        if (url.pathname.startsWith('/api/')) {
            if (req.headers.origin && req.headers.origin !== ORIGIN) return send(res,403,{error:'Origin not allowed'});
            if (req.headers['sec-fetch-site'] && !['same-origin','none'].includes(req.headers['sec-fetch-site'])) return send(res,403,{error:'Same origin required'});
            if (url.pathname === '/api/session' && req.method === 'GET') return send(res,200,{token:TOKEN});
            if (req.headers['x-tba-owner'] !== TOKEN) return send(res,403,{error:'Owner session required'});
            if (url.pathname === '/api/owner' && req.method === 'GET') {
                const file = path.join(PRIVATE,'owner.json');
                return send(res,200,{apps:fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : null});
            }
            if (url.pathname === '/api/owner' && req.method === 'POST') { const data=await body(req); saveOwner(data.apps); return send(res,200,{saved:true}); }
            if (url.pathname === '/api/publish' && req.method === 'POST') {
                if (publishing || publication.state === 'deploying') return send(res,409,{error:'กำลังเผยแพร่รายการก่อนหน้า กรุณารอ'});
                publishing=true;
                try {
                    const data=await body(req);
                    const selected=selectedRecords(data.apps);
                    saveOwner(data.apps);
                    const existing=await gh(['api',`repos/${REPO}/contents/public/published-apps.json`]);
                    const content=JSON.stringify(selected,null,2)+'\n';
                    if (Buffer.from(existing.content.replace(/\s/g,''),'base64').toString('utf8').trim() === content.trim()) {
                        publication={state:'success',count:selected.length,unchanged:true};
                    } else {
                        const updated=await gh(['api','--method','PUT',`repos/${REPO}/contents/public/published-apps.json`,'--input','-'],
                            {message:`Publish ${selected.length} selected apps from owner panel`,sha:existing.sha,branch:'main',content:Buffer.from(content).toString('base64')});
                        publication={state:'deploying',sha:updated.commit.sha,count:selected.length};
                    }
                    fs.writeFileSync(path.join(ROOT,'public','published-apps.json'),content);
                    return send(res,200,publication);
                } finally { publishing=false; }
            }
            if (url.pathname === '/api/publication' && req.method === 'GET') {
                if (publication.state === 'deploying') {
                    const runs=await gh(['run','list','--repo',REPO,'--commit',publication.sha,'--limit','1','--json','status,conclusion,url']);
                    if (runs[0]?.status === 'completed') publication={...publication,state:runs[0].conclusion === 'success' ? 'success' : 'failed',url:runs[0].url};
                }
                return send(res,200,publication);
            }
            return send(res,404,{error:'Not found'});
        }
        if (req.method !== 'GET') return send(res,405,{error:'Method not allowed'});
        const files = {'/':'index.html','/TBA/':'index.html','/TBA/app.js':'app.js','/TBA/style.css':'style.css','/TBA/published-apps.json':'public/published-apps.json'};
        const file = files[url.pathname];
        if (!file) return send(res,404,{error:'Not found'});
        res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css':'application/json','Cache-Control':'no-store'});
        fs.createReadStream(path.join(ROOT,file)).pipe(res);
    } catch (err) { send(res,400,{error:err.message}); }
});
if (require.main === module) server.listen(PORT,'127.0.0.1',()=>console.log(`TBA owner: ${ORIGIN}/TBA/?manage`));
module.exports={selectedRecords,server};
