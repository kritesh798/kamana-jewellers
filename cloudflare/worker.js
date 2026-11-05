import {latestPublishedRates,nepalDateKey} from '../shared/rates.js';

const DAY=864e5,MAX_BODY=20_000,MAX_PHOTO=8*1024*1024,
RATE_SOURCE='https://api.fenegosida.org/api/website/v1/Dashboard/today',
RATE_SYNC_INTERVAL=6*60*60*1000,PASSWORD_ITERATIONS=100_000,
GITHUB_REPOSITORY='kritesh798/kamana-jewellers',GITHUB_BRANCH='main',
REQUEST_TYPES=['Custom design','Repair','Resizing','Polishing','Old-gold exchange'],
REQUEST_STATUSES=['new','in progress','done','cancelled'];
const error=(status,message)=>Object.assign(new Error(message),{status});
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
const sql=(env,query,...args)=>env.DB.prepare(query).bind(...args);
const setting=async(env,key)=>{const row=await sql(env,'SELECT value FROM settings WHERE key=?',key).first();return row?.value??null};
const saveSetting=(env,key,value)=>sql(env,'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',key,JSON.stringify(value)).run();
const str=(value,max,required=false)=>{const result=typeof value==='string'?value.trim():'';if(required&&!result)throw error(400,'Please fill in all required fields.');if(result.length>max)throw error(400,'One of the fields is too long.');return result};
const validRate=value=>{if(value===''||value==null)return null;const number=Number(value);if(!(number>=0&&number<1e8))throw error(400,'Rates must be numbers');return number};
const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const digest=async value=>encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
const photoKey=image=>/^media\/photos\/([\da-f-]+\.(?:jpg|png))$/.exec(image||'')?.[1]||null;
const rawPhotoUrl=name=>`https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_BRANCH}/assets/photos/uploads/${name}`;
const githubApi=(path,token,init={})=>fetch(`https://api.github.com${path}`,{
 ...init,headers:{accept:'application/vnd.github+json',authorization:`Bearer ${token}`,
  'X-GitHub-Api-Version':'2022-11-28','User-Agent':'kamana-jewellers-photo-uploader',...init.headers}
});
function base64(bytes){
 let binary='';for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
 return btoa(binary)
}

async function readPhoto(request){
 const type=request.headers.get('content-type')||'';
 if(!/^multipart\/form-data(?:;|$)/i.test(type))throw error(415,'Upload a JPEG or PNG photo.');
 const length=Number(request.headers.get('content-length')||0);
 if(length>MAX_PHOTO+8192)throw error(413,'Photo must be 8 MB or smaller.');
 const reader=request.body?.getReader();
 if(!reader)throw error(400,'Choose one photo to upload.');
 const chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>MAX_PHOTO+8192){await reader.cancel();throw error(413,'Photo must be 8 MB or smaller.')}
   chunks.push(value)
  }
 }finally{reader.releaseLock()}
 const body=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
 let form;
 try{form=await new Request(request.url,{method:'POST',headers:request.headers,body}).formData()}
 catch{throw error(400,'Invalid photo upload.')}
 const photos=form.getAll('photo');
 if(photos.length!==1||typeof photos[0]?.arrayBuffer!=='function'||[...form.keys()].some(key=>key!=='photo'))throw error(400,'Choose one photo to upload.');
 const file=photos[0];if(!file.size)throw error(400,'The selected photo is empty.');
 if(file.size>MAX_PHOTO)throw error(413,'Photo must be 8 MB or smaller.');
 return new Uint8Array(await file.arrayBuffer())
}

function photoInfo(photo){
 const view=new DataView(photo.buffer,photo.byteOffset,photo.byteLength),png=[137,80,78,71,13,10,26,10];
 if(photo.length>=33&&png.every((byte,index)=>photo[index]===byte)&&String.fromCharCode(...photo.subarray(12,16))==='IHDR'){
  const width=view.getUint32(16),height=view.getUint32(20);let i=8,ended=false;
  while(i+12<=photo.length){
   const length=view.getUint32(i),end=i+length+12;if(end>photo.length)throw error(400,'The PNG file is invalid.');
   const type=String.fromCharCode(...photo.subarray(i+4,i+8));i=end;
   if(type==='IEND'){ended=true;break}
  }
  if(!ended)throw error(400,'The PNG file is incomplete.');
  return{ext:'png',width,height}
 }
 if(photo.length<4||photo[0]!==0xff||photo[1]!==0xd8||photo.at(-2)!==0xff||photo.at(-1)!==0xd9)throw error(415,'Only complete JPEG and PNG photos are supported.');
 const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);let i=2;
 while(i+4<photo.length){
  if(photo[i++]!==0xff)throw error(400,'The JPEG file is invalid.');
  while(i<photo.length&&photo[i]===0xff)i++;
  const marker=photo[i++];if(marker===0xda||marker===0xd9)break;
  if(marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(i+2>photo.length)break;
  const length=view.getUint16(i);if(length<2||i+length>photo.length)throw error(400,'The JPEG file is invalid.');
  if(sof.has(marker)){if(length<7)throw error(400,'The JPEG file is invalid.');return{ext:'jpg',height:view.getUint16(i+3),width:view.getUint16(i+5)}}
  i+=length
 }
 throw error(415,'The JPEG file has no supported image data.')
}

function stripPhotoMetadata(photo,ext){
 if(ext==='jpg'){
  const chunks=[photo.subarray(0,2)];let i=2,scan=false;
  while(i<photo.length){
   const start=i;if(photo[i++]!==0xff)throw error(400,'The JPEG file is invalid.');
   while(i<photo.length&&photo[i]===0xff)i++;
   const marker=photo[i++];if(marker===0xda){chunks.push(photo.subarray(start));scan=true;break}
   if(marker===0xd9)throw error(400,'The JPEG file has no image data.');
   if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){chunks.push(photo.subarray(start,i));continue}
   if(i+2>photo.length)throw error(400,'The JPEG file is invalid.');
   const length=new DataView(photo.buffer,photo.byteOffset,photo.byteLength).getUint16(i),end=i+length;
   if(length<2||end>photo.length)throw error(400,'The JPEG file is invalid.');
   if(marker!==0xe1&&marker!==0xed&&marker!==0xfe)chunks.push(photo.subarray(start,end));
   i=end
  }
  if(!scan)throw error(400,'The JPEG file has no image data.');
  const size=chunks.reduce((total,chunk)=>total+chunk.length,0),result=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}
  return result
 }
 const chunks=[photo.subarray(0,8)],metadata=new Set(['eXIf','tEXt','zTXt','iTXt','tIME']);
 const view=new DataView(photo.buffer,photo.byteOffset,photo.byteLength);let i=8,ended=false;
 while(i+12<=photo.length){
  const length=view.getUint32(i),end=i+length+12;if(end>photo.length)throw error(400,'The PNG file is invalid.');
  const type=String.fromCharCode(...photo.subarray(i+4,i+8));if(!metadata.has(type))chunks.push(photo.subarray(i,end));
  i=end;if(type==='IEND'){ended=true;break}
 }
 if(!ended)throw error(400,'The PNG file is incomplete.');
 const size=chunks.reduce((total,chunk)=>total+chunk.length,0),result=new Uint8Array(size);let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length}
 return result
}

async function photoResponse(request,env){
 if(request.method!=='GET')throw error(405,'Method not allowed.');
 const match=/^\/media\/photos\/([\da-f-]+\.(?:jpg|png))$/.exec(new URL(request.url).pathname);
 if(!match)throw error(404,'Not found.');
 const upstream=await fetch(rawPhotoUrl(match[1]),{cf:{cacheEverything:true,cacheTtl:31536000}});
 if(upstream.status===404)throw error(404,'Photo not found.');
 if(!upstream.ok)throw error(502,'Could not retrieve the product photo from GitHub.');
 return new Response(upstream.body,{headers:{'Content-Type':match[1].endsWith('.jpg')?'image/jpeg':'image/png',
  'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}})
}

async function uploadPhoto(request,env,me){
 if(!env.GITHUB_TOKEN)throw error(503,'GitHub photo storage is not configured.');
 if(await limited(env,`photo:${me.id}`,20,DAY))throw error(429,'Photo upload limit reached. Try again tomorrow.');
 const photo=await readPhoto(request),info=photoInfo(photo);
 if(!(info.width>0&&info.height>0&&info.width*info.height<=20_000_000))throw error(400,'Photo dimensions must be no larger than 20 megapixels.');
 const safePhoto=stripPhotoMetadata(photo,info.ext);
 const name=`${crypto.randomUUID()}.${info.ext}`,filePath=`assets/photos/uploads/${name}`;
 const response=await githubApi(`/repos/${GITHUB_REPOSITORY}/contents/${filePath}`,env.GITHUB_TOKEN,{
  method:'PUT',body:JSON.stringify({message:`Upload product photo ${name}`,content:base64(safePhoto),branch:GITHUB_BRANCH})
 });
 if(!response.ok){
  console.error(`GitHub photo upload failed with HTTP ${response.status}.`);
  throw error(502,'Could not save the photo to GitHub. Check the repository token and try again.')
 }
 return json({image:`media/photos/${name}`},201)
}

async function seed(env){
 if(await setting(env,'cloudflare-seed-v1'))return;
 const [collectionResponse,ratesResponse]=await Promise.all([
  env.ASSETS.fetch(new Request('https://assets.local/data/collection.json')),
  env.ASSETS.fetch(new Request('https://assets.local/data/rates.json'))
 ]);
 if(!collectionResponse.ok||!ratesResponse.ok)throw Error('Cloudflare static catalog or rates file is missing.');
 const collection=await collectionResponse.json(),rates=await ratesResponse.json();delete rates._howto;
 const statements=[];
 collection.categories.forEach((category,index)=>statements.push(sql(env,'INSERT OR IGNORE INTO categories(id,label,sort_order) VALUES(?,?,?)',category.id,category.label,index)));
 collection.items.forEach(item=>statements.push(sql(env,'INSERT OR IGNORE INTO products(source_key,name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?,?)',String(item.id),item.name,item.category,item.metal||null,item.purity||null,item.weight_tola??null,item.price||null,item.image||null,item.alt||'')));
 statements.push(sql(env,'INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)','rates',JSON.stringify(rates)));
 statements.push(sql(env,'INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)','cloudflare-seed-v1',new Date().toISOString()));
 await env.DB.batch(statements)
}

async function currentUser(request,env){
 const token=/(?:^|; )sid=([^;]+)/.exec(request.headers.get('cookie')||'')?.[1];
 if(!token)return null;
 const tokenHash=await digest(token);
 return await sql(env,'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?',tokenHash,Date.now()).first()||null
}

async function passwordMatches(password,stored){
 const [,algorithm,iterations,saltText,hashText]=typeof stored==='string'?stored.split('$'):[];
 if(algorithm!=='pbkdf2-sha256'||iterations!==String(PASSWORD_ITERATIONS)||!saltText||!hashText)return false;
 let salt,expected;
 try{salt=decode(saltText);expected=decode(hashText)}catch{return false}
 if(salt.length!==16||expected.length!==32)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),{name:'PBKDF2'},false,['deriveBits']);
 const actual=new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt,iterations:PASSWORD_ITERATIONS},key,256));
 let difference=0;for(let i=0;i<actual.length;i++)difference|=actual[i]^expected[i];
 return difference===0
}

async function limited(env,key,max,windowMs){
 const now=Date.now(),cutoff=now-windowMs;
 const row=await sql(env,`INSERT INTO rate_limits(key,window_start,count) VALUES(?,?,1)
 ON CONFLICT(key) DO UPDATE SET
 count=CASE WHEN rate_limits.window_start<=? THEN 1 ELSE rate_limits.count+1 END,
 window_start=CASE WHEN rate_limits.window_start<=? THEN ? ELSE rate_limits.window_start END
 RETURNING count`,key,now,cutoff,cutoff,now).first();
 return row.count>max
}

async function readJson(request){
 const contentType=request.headers.get('content-type')||'';
 if(!contentType.toLowerCase().startsWith('application/json'))throw error(415,'JSON only');
 const text=await request.text();
 if(new TextEncoder().encode(text).byteLength>MAX_BODY)throw error(413,'Too large');
 try{const body=text?JSON.parse(text):{};if(!body||typeof body!=='object'||Array.isArray(body))throw Error();return body}
 catch{throw error(400,'Bad JSON')}
}

async function refreshRates(env){
 let records;
 try{
  const response=await fetch(RATE_SOURCE,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw Error(`source returned HTTP ${response.status}`);
  records=await response.json()
 }catch(e){console.error('Daily precious-metal rate update failed while contacting the Federation.',e);return false}
 const latest=latestPublishedRates(records);
 if(!latest){console.error('Daily precious-metal rate update failed: no valid published 1-tola gold and silver pair was found.');return false}
 const rates=JSON.parse(await setting(env,'rates')||'{}'),savedAt=new Date(rates.updated_at);
 if(rates.hallmark_gold!=null&&rates.silver!=null&&Number.isFinite(savedAt.getTime())&&latest.updatedAt<savedAt){
  console.warn('Daily rate update skipped: the website already has a newer saved rate.');return false
 }
 await saveSetting(env,'rates',{...rates,hallmark_gold:latest.goldAmount,silver:latest.silverAmount,updated_at:latest.updatedAt.toISOString(),updated_bs:''});
 console.log(`Latest published rates saved from the Federation (${nepalDateKey(latest.updatedAt)} Nepal time).`);
 return true
}

async function getRates(env){
 let rates=JSON.parse(await setting(env,'rates')||'{}');
 const attempted=Number(await setting(env,'rate-sync-attempt')||0);
 if(!attempted||Date.now()-attempted>=RATE_SYNC_INTERVAL){
  await saveSetting(env,'rate-sync-attempt',Date.now());
  if(await refreshRates(env))rates=JSON.parse(await setting(env,'rates'))
 }
 return rates
}

async function categories(env){return(await env.DB.prepare('SELECT id,label FROM categories ORDER BY sort_order,id').all()).results}
async function productValues(body,env){
 const name=str(body.name,120,true),category=str(body.category,40,true);
 if(!await sql(env,'SELECT 1 FROM categories WHERE id=?',category).first())throw error(400,'Unknown category');
 const weight=body.weight_tola===''||body.weight_tola==null?null:Number(body.weight_tola);
 if(weight!==null&&!(weight>=0&&weight<10000))throw error(400,'Weight must be a number');
 const image=str(body.image,200);
 if(image){
  const key=photoKey(image);
  if(key){
   const photo=await fetch(rawPhotoUrl(key),{method:'HEAD'});
   if(!photo.ok)throw error(400,'Choose an existing product photo.')
  }
  else{
   if(!/^assets\/photos\/products\/[\w./-]+$/.test(image)||image.includes('..'))throw error(400,'Choose an existing product photo.');
   const photo=await env.ASSETS.fetch(new Request(new URL('/'+image,'https://assets.local')));
   if(!photo.ok)throw error(400,'Choose an existing product photo.')
  }
 }
 return[name,category,str(body.metal,30),str(body.purity,20),weight,str(body.price,40)||null,image||null,str(body.alt,200)]
}

async function route(request,env,ctx){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path.startsWith('/media/'))return photoResponse(request,env);
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(method!=='GET'){
  const origin=request.headers.get('origin');
  if(origin){try{if(new URL(origin).host!==url.host)throw error(403,'Bad origin')}catch(e){if(e.status)throw e;throw error(403,'Bad origin')}}
 }
 const me=await currentUser(request,env);
 if(method==='GET'&&(path==='/api/rates'||path==='/api/products'||path==='/api/me')||path.startsWith('/api/admin/'))await seed(env);
 if(method==='GET'&&path==='/api/rates')return json(await getRates(env));
 if(method==='GET'&&path==='/api/products'){
  const [categoryList,items]=await Promise.all([categories(env),env.DB.prepare('SELECT id,name,category,metal,purity,weight_tola,price,image,alt FROM products ORDER BY id').all()]);
  return json({categories:categoryList,items:items.results})
 }
 if(method==='GET'&&path==='/api/me')return json({user:me?.role==='admin'?me:null});
 if(method==='POST'&&path==='/api/login'){
  const body=await readJson(request),ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(await limited(env,'login:'+ip,10,9*60_000))throw error(429,'Too many attempts. Try again later.');
  const email=str(body.email,120).toLowerCase(),user=await sql(env,'SELECT * FROM users WHERE email=?',email).first();
  if(user?.role!=='admin'||!await passwordMatches(typeof body.password==='string'?body.password:'',user.pass))throw error(401,'Wrong email or password.');
  const token=encode(crypto.getRandomValues(new Uint8Array(32))),expires=Date.now()+14*DAY;
  await sql(env,'DELETE FROM sessions WHERE expires<?',Date.now()).run();
  await sql(env,'INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)',await digest(token),user.id,expires).run();
  return json({ok:true},200,{'Set-Cookie':`sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${14*86400}; Secure`})
 }
 if(method==='POST'&&path==='/api/logout'){
  const token=/(?:^|; )sid=([^;]+)/.exec(request.headers.get('cookie')||'')?.[1];
  if(token)await sql(env,'DELETE FROM sessions WHERE token=?',await digest(token)).run();
  return json({ok:true},200,{'Set-Cookie':'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure'})
 }
 if(method==='POST'&&path==='/api/requests'){
  const body=await readJson(request),ip=request.headers.get('cf-connecting-ip')||'unknown';
  if(await limited(env,'request:'+ip,20,6*60*60_000))throw error(429,'Too many requests. Please call the shop.');
  const type=str(body.type,30,true);if(!REQUEST_TYPES.includes(type))throw error(400,'Unknown request type');
  await sql(env,'INSERT INTO requests(user_id,name,phone,type,description,contact_time,created_at) VALUES(NULL,?,?,?,?,?,?)',
   str(body.name,80,true),str(body.phone,20,true),type,str(body.description||body.desc,1500,true),str(body.time,60),new Date().toISOString()).run();
  return json({ok:true},201)
 }
 if(!path.startsWith('/api/admin/'))throw error(404,'Not found');
 if(!me)throw error(401,'Please sign in.');
 if(me.role!=='admin')throw error(403,'Admins only.');
 if(path==='/api/admin/photos'&&method==='POST')return uploadPhoto(request,env,me);
 const body=method==='GET'?{}:await readJson(request);
 if(path==='/api/admin/categories'&&method==='POST'){
  const label=str(body.label,40,true),list=await categories(env);
  if(list.length>=40)throw error(400,'The category limit has been reached.');
  if(list.some(x=>x.label.toLocaleLowerCase()===label.toLocaleLowerCase()))throw error(409,'That category already exists.');
  const base=(label.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,32).replace(/-$/,''))||`category-${crypto.randomUUID().slice(0,6)}`;
  let id=base,n=2;while(list.some(x=>x.id===id))id=`${base}-${n++}`;
  const nextOrder=(await sql(env,'SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM categories').first()).n;
  await sql(env,'INSERT INTO categories(id,label,sort_order) VALUES(?,?,?)',id,label,nextOrder).run();
  return json({id,label},201)
 }
 const categoryMatch=/^\/api\/admin\/categories\/([a-z0-9-]+)$/.exec(path);
 if(categoryMatch&&method==='PUT'){
  const label=str(body.label,40,true),list=await categories(env),category=list.find(x=>x.id===categoryMatch[1]);
  if(!category)throw error(404,'Category not found.');
  if(list.some(x=>x.id!==category.id&&x.label.toLocaleLowerCase()===label.toLocaleLowerCase()))throw error(409,'That category already exists.');
  await sql(env,'UPDATE categories SET label=? WHERE id=?',label,category.id).run();
  return json({id:category.id,label})
 }
 if(categoryMatch&&method==='DELETE'){
  const list=await categories(env),category=list.find(x=>x.id===categoryMatch[1]);
  if(!category)throw error(404,'Category not found.');
  if(list.length<=1)throw error(409,'Keep at least one product category.');
  if(await sql(env,'SELECT 1 FROM products WHERE category=? LIMIT 1',category.id).first())throw error(409,'Move or delete this category’s products before deleting it.');
  await sql(env,'DELETE FROM categories WHERE id=?',category.id).run();
  return json({ok:true})
 }
 if(path==='/api/admin/rates'&&method==='PUT'){
  const rates={unit:'tola',currency:'NPR',hallmark_gold:validRate(body.hallmark_gold),tejabi_gold:validRate(body.tejabi_gold),silver:validRate(body.silver),updated_at:new Date().toISOString(),updated_bs:str(body.updated_bs,40)};
  await saveSetting(env,'rates',rates);return json(rates)
 }
 if(path==='/api/admin/requests'&&method==='GET'){
  const result=await env.DB.prepare('SELECT * FROM requests ORDER BY id DESC LIMIT 500').all();return json({items:result.results})
 }
 if(path==='/api/admin/users'&&method==='GET'){
  const result=await env.DB.prepare("SELECT id,name,email FROM users WHERE role='admin' ORDER BY id").all();return json({items:result.results})
 }
 if(path==='/api/admin/products'&&method==='POST'){
  const values=await productValues(body,env),result=await sql(env,'INSERT INTO products(name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?)',...values).run();
  return json({id:result.meta.last_row_id},201)
 }
 const match=/^\/api\/admin\/(requests|products)\/(\d+)$/.exec(path);
 if(!match)throw error(404,'Not found');
 const id=Number(match[2]);
 if(match[1]==='requests'&&method==='PUT'){
  if(!REQUEST_STATUSES.includes(body.status))throw error(400,'Bad status');
  const result=await sql(env,'UPDATE requests SET status=? WHERE id=?',body.status,id).run();
  if(!result.meta.changes)throw error(404,'Request not found.');
  return json({ok:true})
 }
 if(match[1]==='products'&&method==='PUT'){
  const values=await productValues(body,env),result=await sql(env,'UPDATE products SET name=?,category=?,metal=?,purity=?,weight_tola=?,price=?,image=?,alt=? WHERE id=?',...values,id).run();
  if(!result.meta.changes)throw error(404,'Product not found.');
  return json({ok:true})
 }
 if(match[1]==='products'&&method==='DELETE'){
  const result=await sql(env,'DELETE FROM products WHERE id=?',id).run();
  if(!result.meta.changes)throw error(404,'Product not found.');
  return json({ok:true})
 }
 throw error(404,'Not found')
}

function securityHeaders(response,isApi){
 const headers=new Headers(response.headers);
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','same-origin');
 headers.set('X-Frame-Options','DENY');
 if(isApi)headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers})
}

export default{
 async fetch(request,env,ctx){
  try{
   const response=await route(request,env,ctx);
   return securityHeaders(response,new URL(request.url).pathname.startsWith('/api/'))
  }catch(e){
   if(!e.status)console.error('Cloudflare Worker request failed.',e);
   return securityHeaders(json({error:e.status?e.message:'Server error'},e.status||500),true)
  }
 },
 scheduled(controller,env,ctx){ctx.waitUntil((async()=>{await saveSetting(env,'rate-sync-attempt',Date.now());await refreshRates(env)})())}
};
