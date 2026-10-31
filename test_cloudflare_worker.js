import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {pbkdf2Sync,randomBytes} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import worker from './cloudflare/worker.js';

const root=fileURLToPath(new URL('.',import.meta.url)),db=new DatabaseSync(':memory:');
db.exec(fs.readFileSync(path.join(root,'migrations','0001_cloudflare.sql'),'utf8'));
class Statement{
 constructor(sql,values=[]){this.query=sql;this.values=values}
 bind(...values){return new Statement(this.query,values)}
 first(){return db.prepare(this.query).get(...this.values)||null}
 all(){return{results:db.prepare(this.query).all(...this.values)}}
 run(){const result=db.prepare(this.query).run(...this.values);return{meta:{last_row_id:Number(result.lastInsertRowid),changes:Number(result.changes)}}}
}
const assets={
 async fetch(request){
  const url=new URL(request.url),relative=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname).replace(/^\/+/,'');
  if(relative.includes('..'))return new Response('Not found',{status:404});
  const file=path.join(root,relative);
  if(!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});
  const type=path.extname(file)==='.json'?'application/json':path.extname(file)==='.jpg'?'image/jpeg':'text/html';
  return new Response(fs.readFileSync(file),{headers:{'Content-Type':type}})
 }
};
const env={DB:{prepare:query=>new Statement(query),batch:async statements=>{
 db.exec('BEGIN');
 try{const results=statements.map(statement=>statement.run());db.exec('COMMIT');return results}
 catch(e){db.exec('ROLLBACK');throw e}
}},ASSETS:assets};
const today=new Date(),yesterday=new Date(today.getTime()-864e5);
const ratesFixture=[
 {rateType:'छापावाल सुन (१ तोला)',todayDate:today.toISOString(),todayBaseRatePerGram:283500,yestardayDate:yesterday.toISOString(),yestardayBaseRatePerGram:283200},
 {rateType:'असली चाँदी दर (१ तोला)',todayDate:today.toISOString(),todayBaseRatePerGram:3930,yestardayDate:yesterday.toISOString(),yestardayBaseRatePerGram:3980}
];
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response(JSON.stringify(ratesFixture),{status:200,headers:{'Content-Type':'application/json'}});
const send=async(method,url,body,cookie,origin='https://shop.test')=>{
 const headers={origin};if(cookie)headers.cookie=cookie;
 if(body!==undefined)headers['content-type']='application/json';
 return worker.fetch(new Request(`https://shop.test${url}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)}),env,{waitUntil:promise=>promise})
};

try{
 const catalog=await send('GET','/api/products');
 assert.equal(catalog.status,200);
 const catalogData=await catalog.json();
 assert.equal(catalogData.categories.length,10);
 assert.equal(catalogData.items.filter(item=>/-scan-\d+\.jpg$/.test(item.image||'')).length,35);

 const rates=await send('GET','/api/rates');
 assert.equal(rates.status,200);
 const ratesData=await rates.json();
 assert.equal(ratesData.hallmark_gold,283500);
 assert.equal(ratesData.silver,3930);
 assert.equal(new Date(ratesData.updated_at).toISOString(),today.toISOString());

 assert.equal((await send('GET','/api/admin/requests')).status,401);
 const salt=randomBytes(16),password='cloudflare-test-password';
 const hash=pbkdf2Sync(password,salt,120_000,32,'sha256');
 const stored=`$pbkdf2-sha256$120000$${salt.toString('base64url')}$${hash.toString('base64url')}`;
 db.prepare("INSERT INTO users(name,email,pass,role,created_at) VALUES(?,?,?,'admin',?)").run('Test Admin','admin@example.test',stored,today.toISOString());
 const login=await send('POST','/api/login',{email:'admin@example.test',password});
 assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 assert.equal((await send('GET','/api/me',undefined,cookie)).status,200);

 const category=await send('POST','/api/admin/categories',{label:'Worker Test'},cookie);
 assert.equal(category.status,201);
 const categoryId=(await category.json()).id;
 assert.equal((await send('PUT',`/api/admin/categories/${categoryId}`,{label:'Renamed Worker Test'},cookie)).status,200);
 const product=await send('POST','/api/admin/products',{name:'Worker Test Product',category:categoryId,metal:'Gold',image:'assets/photos/products/bracelet-01.jpg'},cookie);
 assert.equal(product.status,201);
 const productId=(await product.json()).id;
 const updated=await send('GET','/api/products');
 assert((await updated.json()).items.some(item=>item.id===productId&&item.category===categoryId));
 assert.equal((await send('DELETE',`/api/admin/categories/${categoryId}`,{},cookie)).status,409);
 assert.equal((await send('DELETE',`/api/admin/products/${productId}`,{},cookie)).status,200);
 assert.equal((await send('DELETE',`/api/admin/categories/${categoryId}`,{},cookie)).status,200);

 const request=await send('POST','/api/requests',{name:'Customer',phone:'123456789',type:'Repair',description:'Resize ring'});
 assert.equal(request.status,201);
 const adminRequests=await send('GET','/api/admin/requests',undefined,cookie);
 const requestId=(await adminRequests.json()).items[0].id;
 assert.equal((await send('PUT',`/api/admin/requests/${requestId}`,{status:'done'},cookie)).status,200);
 assert.equal((await send('PUT','/api/admin/rates',{hallmark_gold:'284000',tejabi_gold:'',silver:'4000',updated_bs:''},cookie)).status,200);
 assert.equal((await send('GET','/api/rates')).status,200);
 assert.equal((await send('POST','/api/admin/photos',{},cookie)).status,503);
 assert.equal((await send('POST','/api/admin/categories',{label:'Bad Origin'},cookie,'https://attacker.test')).status,403);
 const logout=await send('POST','/api/logout',{});
 assert.equal(logout.status,200);
 const staticPage=await worker.fetch(new Request('https://shop.test/'),env,{});
 assert.equal(staticPage.status,200);
 assert.match(await staticPage.text(),/<title>New Kamana Jewellers/);
 console.log('Cloudflare Worker checks passed: static assets, D1-backed catalog/rates/admin APIs, sessions, CRUD, and upload-storage guard.');
}finally{
 globalThis.fetch=originalFetch;
 db.close()
}
