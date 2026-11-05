import http from 'node:http';import crypto from 'node:crypto';import fs from 'node:fs';import path from 'node:path';
import {db,ROOT,getS,setS,checkPw} from './db.js';
import {refreshDailyRates,scheduleDailyRates} from './gold-rate.js';
const PORT=+process.env.PORT||3000,HOST=process.env.HOST||'127.0.0.1',PROD=process.env.NODE_ENV==='production',DAY=864e5,MAX_PHOTO=8*1024*1024,MAX_UPLOADS=250*1024*1024;
if(PROD&&process.env.TRUST_PROXY!=='1')throw Error('Production requires TRUST_PROXY=1 behind a trusted HTTPS reverse proxy.');
const hashes=[...fs.readFileSync(ROOT+'index.html','utf8').matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>`'sha256-${crypto.createHash('sha256').update(m[1]).digest('base64')}'`);
const CSP=`default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
const E=(s,m)=>Object.assign(new Error(m),{status:s});
const send=(res,c,o)=>{res.writeHead(c,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(o))};
const hits=new Map(),limited=(k,max,win)=>{const n=Date.now();const a=(hits.get(k)||[]).filter(t=>n-t<win);a.push(n);hits.set(k,a);return a.length>max};
const sha=t=>crypto.createHash('sha256').update(t).digest('hex');
const sameOrigin=(origin,host)=>{if(!origin||!host)return true;try{return new URL(origin).host===host}catch{return false}};
const decodePath=pathname=>{try{return decodeURIComponent(pathname)}catch{throw E(400,'Malformed URL')}};
const str=(v,max,req)=>{v=typeof v==='string'?v.trim():'';if(req&&!v)throw E(400,'Please fill in all required fields.');if(v.length>max)throw E(400,'One of the fields is too long.');return v};
const readBody=req=>new Promise((ok,no)=>{let b='';req.on('data',c=>{b+=c;if(b.length>20000){no(E(413,'Too large'));req.destroy()}});req.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch{no(E(400,'Bad JSON'))}})});
const readUpload=req=>new Promise((ok,no)=>{const chunks=[];let size=0,failed=false;
req.on('data',chunk=>{if(failed)return;size+=chunk.length;if(size>MAX_PHOTO+8192){failed=true;no(E(413,'Photo must be 8 MB or smaller.'));return}chunks.push(chunk)});
req.on('end',()=>{if(failed)return;try{
 const type=req.headers['content-type']||'',match=/^multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))$/i.exec(type);
 if(!match||((match[1]||match[2]).length>70))throw E(415,'Upload a JPEG or PNG photo.');
 const boundary=Buffer.from(`--${match[1]||match[2]}`),body=Buffer.concat(chunks),headerEnd=body.indexOf(Buffer.from('\r\n\r\n'));
 if(!body.subarray(0,boundary.length).equals(boundary)||body.toString('ascii',boundary.length,boundary.length+2)!=='\r\n'||headerEnd<0)throw E(400,'Invalid photo upload.');
 const header=body.subarray(boundary.length+2,headerEnd).toString('utf8');
 if(!/content-disposition:\s*form-data;\s*name="photo";\s*filename="[^"]*"/i.test(header))throw E(400,'Choose one photo to upload.');
 const start=headerEnd+4,finish=body.indexOf(Buffer.concat([Buffer.from('\r\n'),boundary]),start);
 if(finish<0||!body.subarray(finish+2+boundary.length).equals(Buffer.from('--\r\n')))throw E(400,'Invalid photo upload.');
 const photo=body.subarray(start,finish);if(!photo.length)throw E(400,'The selected photo is empty.');
 ok(photo);
}catch(e){no(e)}});req.on('error',e=>{if(!failed)no(e)})});
const imageInfo=photo=>{
 const png=Buffer.from([137,80,78,71,13,10,26,10]);
 if(photo.length>=24&&photo.subarray(0,8).equals(png)&&photo.toString('ascii',12,16)==='IHDR'){
  const width=photo.readUInt32BE(16),height=photo.readUInt32BE(20);
  if(photo.indexOf(Buffer.from('IEND'))<0)throw E(400,'The PNG file is incomplete.');
  return{ext:'png',width,height}
 }
 if(photo.length<4||photo[0]!==0xff||photo[1]!==0xd8||photo[photo.length-2]!==0xff||photo[photo.length-1]!==0xd9)throw E(415,'Only complete JPEG and PNG photos are supported.');
 const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);let i=2;
 while(i+4<photo.length){
  if(photo[i++]!==0xff)throw E(400,'The JPEG file is invalid.');
  while(i<photo.length&&photo[i]===0xff)i++;
  const marker=photo[i++];if(marker===0xda||marker===0xd9)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(i+2>photo.length)break;const length=photo.readUInt16BE(i);
  if(length<2||i+length>photo.length)throw E(400,'The JPEG file is invalid.');
  if(sof.has(marker)){if(length<7)throw E(400,'The JPEG file is invalid.');return{ext:'jpg',height:photo.readUInt16BE(i+3),width:photo.readUInt16BE(i+5)}}
  i+=length
 }
 throw E(415,'The JPEG file has no supported image data.')
};
const stripMetadata=(photo,ext)=>{
 if(ext==='jpg'){
  const chunks=[photo.subarray(0,2)];let i=2,scan=false;
  while(i<photo.length){
   const start=i;if(photo[i++]!==0xff)throw E(400,'The JPEG file is invalid.');
   while(i<photo.length&&photo[i]===0xff)i++;
   const marker=photo[i++];if(marker===0xda){chunks.push(photo.subarray(start));scan=true;break}
   if(marker===0xd9)throw E(400,'The JPEG file has no image data.');
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){chunks.push(photo.subarray(start,i));continue}
   if(i+2>photo.length)throw E(400,'The JPEG file is invalid.');
   const length=photo.readUInt16BE(i),end=i+length;if(length<2||end>photo.length)throw E(400,'The JPEG file is invalid.');
   if(marker!==0xe1&&marker!==0xed&&marker!==0xfe)chunks.push(photo.subarray(start,end));
   i=end
  }
  if(!scan)throw E(400,'The JPEG file has no image data.');
  return Buffer.concat(chunks)
 }
 const chunks=[photo.subarray(0,8)],metadata=new Set(['eXIf','tEXt','zTXt','iTXt','tIME']);let i=8,ended=false;
 while(i+12<=photo.length){
  const length=photo.readUInt32BE(i),end=i+length+12;if(end>photo.length)throw E(400,'The PNG file is invalid.');
  const type=photo.toString('ascii',i+4,i+8);if(!metadata.has(type))chunks.push(photo.subarray(i,end));
  i=end;if(type==='IEND'){ended=true;break}
 }
 if(!ended)throw E(400,'The PNG file is incomplete.');
 return Buffer.concat(chunks)
};
const who=req=>{const t=/(?:^|; )sid=([^;]+)/.exec(req.headers.cookie||'')?.[1];if(!t)return null;
return db.prepare('SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?').get(sha(t),Date.now())||null};
const login=(res,uid)=>{const t=crypto.randomBytes(32).toString('base64url');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(sha(t),uid,Date.now()+14*DAY);
res.setHeader('Set-Cookie',`sid=${t}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${14*86400}${PROD?'; Secure':''}`)};
const cats=()=>JSON.parse(getS('categories')),TYPES=['Custom design','Repair','Resizing','Polishing','Old-gold exchange'],STATUS=['new','in progress','done','cancelled'];
const prod=b=>{const n=str(b.name,120,1),c=str(b.category,40,1);if(!cats().some(x=>x.id===c))throw E(400,'Unknown category');
const w=b.weight_tola===''||b.weight_tola==null?null:+b.weight_tola;if(w!==null&&!(w>=0&&w<10000))throw E(400,'Weight must be a number');
const img=str(b.image,200),resolved=img&&path.resolve(ROOT,img);if(img&&(!/^assets\/photos\/[\w\-./]+$/.test(img)||img.includes('..')||!resolved.startsWith(path.resolve(ROOT,'assets/photos')+path.sep)||!fs.existsSync(resolved)||!fs.statSync(resolved).isFile()))throw E(400,'Choose an existing photo inside assets/photos/.');
return[n,c,str(b.metal,30),str(b.purity,20),w,str(b.price,40),img||null,str(b.alt,200)]};
const rate=v=>{if(v===''||v==null)return null;v=+v;if(!(v>=0&&v<1e8))throw E(400,'Rates must be numbers');return v};
async function api(req,res,p){const m=req.method,ip=(PROD&&process.env.TRUST_PROXY?req.headers['x-forwarded-for']?.split(',')[0].trim():null)||req.socket.remoteAddress;let b={};
const R=`${m} ${p}`,me=who(req);
if(R==='POST /api/admin/photos'){
 if(!sameOrigin(req.headers.origin,req.headers.host))throw E(403,'Bad origin');
 if(!me)throw E(401,'Please sign in.');if(me.role!=='admin')throw E(403,'Admins only.');
 if(limited('u'+me.id,20,DAY))throw E(429,'Photo upload limit reached. Try again tomorrow.');
 const photo=await readUpload(req);if(photo.length>MAX_PHOTO)throw E(413,'Photo must be 8 MB or smaller.');
 const info=imageInfo(photo);if(!(info.width>0&&info.height>0&&info.width*info.height<=20000000))throw E(400,'Photo dimensions must be no larger than 20 megapixels.');
 const safePhoto=stripMetadata(photo,info.ext),name=`${crypto.randomUUID()}.${info.ext}`,dir=path.join(ROOT,'assets','photos','uploads');fs.mkdirSync(dir,{recursive:true});
 const currentSize=fs.readdirSync(dir,{withFileTypes:true}).filter(entry=>entry.isFile()&&/^[\da-f-]+\.(?:jpg|png)$/.test(entry.name)).reduce((sum,entry)=>sum+fs.statSync(path.join(dir,entry.name)).size,0);
 if(currentSize+safePhoto.length>MAX_UPLOADS)throw E(507,'Photo storage is full. Contact the site administrator.');
 fs.writeFileSync(path.join(dir,name),safePhoto,{flag:'wx',mode:0o644});return send(res,201,{image:`assets/photos/uploads/${name}`})
}
if(m!=='GET'){if(!(req.headers['content-type']||'').startsWith('application/json'))throw E(415,'JSON only');
const o=req.headers.origin;if(!sameOrigin(o,req.headers.host))throw E(403,'Bad origin');b=await readBody(req)}
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
if(R==='POST /api/admin/categories'){
 const label=str(b.label,40,1),categories=cats();if(categories.length>=40)throw E(400,'The category limit has been reached.');
 if(categories.some(c=>c.label.toLocaleLowerCase()===label.toLocaleLowerCase()))throw E(409,'That category already exists.');
 const base=(label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32).replace(/-$/,''))||`category-${crypto.randomBytes(3).toString('hex')}`;
 let id=base,n=2;while(categories.some(c=>c.id===id))id=`${base}-${n++}`;
 categories.push({id,label});setS('categories',categories);return send(res,201,{id,label})
}
const cm=/^\/api\/admin\/categories\/([a-z0-9-]+)$/.exec(p);
if(cm&&m==='PUT'){
 const label=str(b.label,40,1),categories=cats(),category=categories.find(c=>c.id===cm[1]);if(!category)throw E(404,'Category not found.');
 if(categories.some(c=>c.id!==category.id&&c.label.toLocaleLowerCase()===label.toLocaleLowerCase()))throw E(409,'That category already exists.');
 category.label=label;setS('categories',categories);return send(res,200,category)
}
if(cm&&m==='DELETE'){
 const categories=cats(),category=categories.find(c=>c.id===cm[1]);if(!category)throw E(404,'Category not found.');
 if(categories.length<=1)throw E(409,'Keep at least one product category.');
 if(db.prepare('SELECT 1 FROM products WHERE category=? LIMIT 1').get(category.id))throw E(409,'Move or delete this category’s products before deleting it.');
 setS('categories',categories.filter(c=>c.id!==category.id));return send(res,200,{ok:true})
}
if(R==='PUT /api/admin/rates'){const r={unit:'tola',currency:'NPR',hallmark_gold:rate(b.hallmark_gold),tejabi_gold:rate(b.tejabi_gold),silver:rate(b.silver),updated_at:new Date().toISOString(),updated_bs:str(b.updated_bs,40)};setS('rates',r);return send(res,200,r)}
if(R==='GET /api/admin/requests')return send(res,200,{items:db.prepare('SELECT * FROM requests ORDER BY id DESC LIMIT 500').all()});
if(R==='GET /api/admin/users')return send(res,200,{items:db.prepare("SELECT id,name,email FROM users WHERE role='admin' ORDER BY id").all()});
if(R==='POST /api/admin/products'){const r=db.prepare('INSERT INTO products(name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?)').run(...prod(b));return send(res,201,{id:r.lastInsertRowid})}
const mm=/^\/api\/admin\/(requests|products)\/(\d+)$/.exec(p);if(!mm)throw E(404,'Not found');const id=+mm[2];
if(mm[1]==='requests'&&m==='PUT'){if(!STATUS.includes(b.status))throw E(400,'Bad status');db.prepare('UPDATE requests SET status=? WHERE id=?').run(b.status,id);return send(res,200,{ok:true})}
if(mm[1]==='products'&&m==='PUT'){db.prepare('UPDATE products SET name=?,category=?,metal=?,purity=?,weight_tola=?,price=?,image=?,alt=? WHERE id=?').run(...prod(b),id);return send(res,200,{ok:true})}
if(mm[1]==='products'&&m==='DELETE'){db.prepare('DELETE FROM products WHERE id=?').run(id);return send(res,200,{ok:true})}
throw E(404,'Not found')}
const OK=/^\/(index\.html|admin\.html|styles\.css|script\.js|admin\.js|robots\.txt|sitemap\.xml|sitemap\.txt|assets\/[\w\-./]+|data\/site\.json)$/,
TYPE={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.txt':'text/plain','.xml':'application/xml'};
function serve(req,res,p){if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end()}
if(p==='/')p='/index.html';const f=path.join(ROOT,p);
if(!OK.test(p)||p.includes('..')||!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404,{'Content-Type':'text/plain'});return res.end('Not found')}
const e=path.extname(f),cache=e==='.js'?'no-store':e==='.html'||p==='/data/site.json'?'no-cache':'public, max-age=86400';res.writeHead(200,{'Content-Type':TYPE[e]||'application/octet-stream','Cache-Control':cache});fs.createReadStream(f).pipe(res)}
void refreshDailyRates();scheduleDailyRates();
http.createServer(async(req,res)=>{res.setHeader('Content-Security-Policy',CSP);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
try{if(PROD&&req.headers['x-forwarded-proto']!=='https')throw E(400,'HTTPS is required.');
const pathname=new URL(req.url,'http://x').pathname;const p=decodePath(pathname);if(p.startsWith('/api/'))await api(req,res,p);else serve(req,res,p)}
catch(e){if(res.headersSent)return;if(e.status)send(res,e.status,{error:e.message});else{console.error(e);send(res,500,{error:'Server error'})}}}).listen(PORT,HOST,()=>console.log(`http://${HOST}:${PORT}`));
