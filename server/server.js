import http from 'node:http';import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';
import {db,ROOT,getS,setS,checkPw} from './db.js';
import {refreshDailyRates,scheduleDailyRates} from './gold-rate.js';
const PORT=+process.env.PORT||3000,PROD=process.env.NODE_ENV==='production',DAY=864e5;
const hashes=[...fs.readFileSync(ROOT+'index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
const CSP=`default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
const E=(s,m)=>Object.assign(new Error(m),{status:s});
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const hits=new Map(),limited=(k,max,win)=>{const n=Date.now(),a=(hits.get(k)||[]).filter(t=>n-t<win);a.push(n);hits.set(k,a);return a.length>max};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const str=(v,max,req)=>{v=typeof v==='string'?v.trim():'';if(req&&!v)throw E(400,'Please fill in all required fields.');if(v.length>max)throw E(400,'One of the fields is too long.');return v};
const readBody=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>20000){no(E(413,'Too large'));req.destroy()}});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch{no(E(400,'Bad JSON'))}})});
const who=req=>{const t=/(?:^|; )sid=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(!t)return null;
return db.prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(sha(t),Date.now())||null};
const login=(res,uid)=>{const t=crypto.randomBytes(32).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(t),uid,Date.now()+14*DAY);
res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${14*86400}${PROD?'; Secure':''}`)};
const cats=()=>JSON.parse(getS('categories')),TYPES=['Custom design','Repair','Resizing','Polishing','Old-gold exchange'],STATUS=['new','in progress','done','cancelled'];
const prod=b=>{const n=str(b.name,120,1),c=str(b.category,40,1);if(!cats().some(x=>x.id===c))throw E(400,'Unknown category');
const w=b.weight_tola===''||b.weight_tola==null?null:+b.weight_tola;if(w!==null&&!(w>=0&&w<10000))throw E(400,'Weight must be a number');
const img=str(b.image,200);if(img&&(!/^assets\/photos\/[\w\-./]+$/.test(img)||img.includes('..')))throw E(400,'Image must be a path inside assets/photos/');
return[n,c,str(b.metal,30),str(b.purity,20),w,str(b.price,40),img||null,str(b.alt,200)]};
const rate=v=>{if(v===''||v==null)return null;v=+v;if(!(v>=0&&v<1e8))throw E(400,'Rates must be numbers');return v};
async function api(req,res,p){const m=req.method,ip=(PROD&&process.env.TRUST_PROXY?req.headers['x-forwarded-for']?.split(',')[0].trim():null)||req.socket.remoteAddress;let b={};
if(m!=='GET'){if(!(req.headers['content-type']||'').startsWith('application/json'))throw E(415,'JSON only');
const o=req.headers.origin;if(o&&new URL(o).host!==req.headers.host)throw E(403,'Bad origin');b=await readBody(req)}
const me=who(req),R=`${m} ${p}`;
if(R==='GET /api/rates')return send(res,200,JSON.parse(getS('rates')));
if(R==='GET /api/products')return send(res,200,{categories:cats(),items:db.prepare('SELECT id,name,category,metal,purity,weight_tola,price,image,alt FROM products ORDER BY id').all()});
if(R==='GET /api/me')return send(res,200,{user:me?.role==='admin'?me:null});
if(R==='POST /api/login'){if(limited('l'+ip,10,9e5))throw E(429,'Too many attempts. Try again later.');
const u=db.prepare('SELECT * FROM users WHERE email=?').get(str(b.email,120).toLowerCase());
if(u?.role!=='admin'||!checkPw(typeof b.password==='string'?b.password:'',u?.pass))throw E(401,'Wrong email or password.');login(res,u.id);return send(res,200,{ok:true})}
if(R==='POST /api/logout'){const t=/(?:^|; )sid=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(t)db.prepare('DELETE FROM sessions WHERE token=?').run(sha(t));
res.setHeader('Set-Cookie','sid=; HttpOnly; Path=/; Max-Age=0');return send(res,200,{ok:true})}
if(R==='POST /api/requests'){if(limited('q'+ip,20,36e5))throw E(429,'Too many requests. Please call the shop.');
const t=str(b.type,30,1);if(!TYPES.includes(t))throw E(400,'Unknown request type');
db.prepare('INSERT INTO requests(user_id,name,phone,type,description,contact_time,created_at) VALUES(NULL,?,?,?,?,?,?)').run(str(b.name,80,1),str(b.phone,20,1),t,str(b.description||b.desc,1500,1),str(b.time,60),new Date().toISOString());return send(res,201,{ok:true})}
if(!p.startsWith('/api/admin/'))throw E(404,'Not found');if(!me)throw E(401,'Please sign in.');if(me.role!=='admin')throw E(403,'Admins only.');
if(R==='PUT /api/admin/rates'){const r={unit:'tola',currency:'NPR',hallmark_gold:rate(b.hallmark_gold),tejabi_gold:rate(b.tejabi_gold),silver:rate(b.silver),updated_at:new Date().toISOString(),updated_bs:str(b.updated_bs,40)};setS('rates',r);return send(res,200,r)}
if(R==='GET /api/admin/requests')return send(res,200,{items:db.prepare('SELECT * FROM requests ORDER BY id DESC LIMIT 500').all()});
if(R==='GET /api/admin/users')return send(res,200,{items:db.prepare("SELECT id,name,email FROM users WHERE role='admin' ORDER BY id").all()});
if(R==='POST /api/admin/products'){const r=db.prepare('INSERT INTO products(name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?)').run(...prod(b));return send(res,201,{id:r.lastInsertRowid})}
const mm=/^\/api\/admin\/(requests|products)\/(\d+)$/.exec(p);if(!mm)throw E(404,'Not found');const id=+mm[2];
if(mm[1]==='requests'&&m==='PUT'){if(!STATUS.includes(b.status))throw E(400,'Bad status');db.prepare('UPDATE requests SET status=? WHERE id=?').run(b.status,id);return send(res,200,{ok:true})}
if(mm[1]==='products'&&m==='PUT'){db.prepare('UPDATE products SET name=?,category=?,metal=?,purity=?,weight_tola=?,price=?,image=?,alt=? WHERE id=?').run(...prod(b),id);return send(res,200,{ok:true})}
if(mm[1]==='products'&&m==='DELETE'){db.prepare('DELETE FROM products WHERE id=?').run(id);return send(res,200,{ok:true})}
throw E(404,'Not found')}
const OK=/^\/(index\.html|admin\.html|styles\.css|script\.js|admin\.js|robots\.txt|sitemap\.xml|assets\/[\w\-./]+|data\/site\.json)$/,
TYPE={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain','.xml':'application/xml'};
function serve(req,res,p){if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
if(p==='/')p='/index.html';const f=path.join(ROOT,p);
if(!OK.test(p)||p.includes('..')||!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
const e=path.extname(f),cache=e==='.js'?'no-store':e==='.html'||p==='/data/site.json'?'no-cache':'public, max-age=86400';res.writeHead(200,{'Content-Type':TYPE[e]||'application/octet-stream','Cache-Control':cache});fs.createReadStream(f).pipe(res)}
void refreshDailyRates();scheduleDailyRates();
http.createServer(async(req,res)=>{res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
try{const p=new URL(req.url,'http://x').pathname;if(p.startsWith('/api/'))await api(req,res,p);else serve(req,res,decodeURIComponent(p))}
catch(e){if(res.headersSent)return;if(e.status)send(res,e.status,{error:e.message});else{console.error(e);send(res,500,{error:'Server error'})}}}).listen(PORT,()=>console.log('http://localhost:'+PORT));
