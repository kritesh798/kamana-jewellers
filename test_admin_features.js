import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kamana-admin-test-')),dbPath=path.join(dir,'test.db'),password='test-admin-password';
let server,uploadedPath;
const env={...process.env,DB_PATH:dbPath,HOST:'127.0.0.1',NODE_ENV:'development'};
const portProbe=net.createServer();await new Promise((resolve,reject)=>portProbe.listen(0,'127.0.0.1',resolve).once('error',reject));
const port=portProbe.address().port;await new Promise(resolve=>portProbe.close(resolve));
const base=`http://127.0.0.1:${port}`;
async function start(){
 server=spawn(process.execPath,['server/server.js'],{cwd:process.cwd(),env:{...env,PORT:String(port)},stdio:'ignore'});
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error(`Server exited with ${server.exitCode}`);
  try{const response=await fetch(base+'/api/products');if(response.ok)return}catch{}
  await new Promise(resolve=>setTimeout(resolve,100))}
 throw Error('Admin test server did not start.')
}
async function stop(){if(!server||server.exitCode!==null)return;server.kill();await once(server,'exit')}
async function request(method,url,body,cookie){
 const headers={};if(cookie)headers.cookie=cookie;
 if(body&&!(body instanceof FormData)){headers['content-type']='application/json';body=JSON.stringify(body)}
 const response=await fetch(base+url,{method,headers,body});return{response,data:await response.json().catch(()=>({}))}
}

try{
 const admin=spawnSync(process.execPath,['server/create-admin.js','admin@example.test','Test Admin'],{cwd:process.cwd(),env:{...env,ADMIN_PASSWORD:password},encoding:'utf8'});
 assert.equal(admin.status,0,admin.stderr||admin.stdout);
 await start();
 const initialCatalog=await request('GET','/api/products');
 assert(initialCatalog.data.categories.some(c=>c.id==='tops'));
 assert(initialCatalog.data.categories.some(c=>c.id==='rings'));
 assert.equal(initialCatalog.data.items.filter(p=>/-scan-\d+\.jpg$/.test(p.image||'')).length,35);
 const unauthForm=new FormData();unauthForm.append('photo',new Blob(['not an image'],{type:'image/png'}),'invalid.png');
 const unauth=await request('POST','/api/admin/photos',unauthForm);assert.equal(unauth.response.status,401);
 const login=await request('POST','/api/login',{email:'admin@example.test',password});
 assert.equal(login.response.status,200);const cookie=login.response.headers.get('set-cookie').split(';')[0];

 const created=await request('POST','/api/admin/categories',{label:'Phone Test Category'},cookie);
 assert.equal(created.response.status,201);const categoryId=created.data.id;
 const duplicate=await request('POST','/api/admin/categories',{label:'phone test category'},cookie);assert.equal(duplicate.response.status,409);
 const renamed=await request('PUT',`/api/admin/categories/${categoryId}`,{label:'Phone Test Jewellery'},cookie);
 assert.equal(renamed.response.status,200);

 const originalPhoto=fs.readFileSync(path.join(process.cwd(),'assets','photos','products','bracelet-01.jpg'));
 const exif=Buffer.from([0xff,0xe1,0,13,...Buffer.from('GPS-PRIVATE')]);
 const photo=Buffer.concat([originalPhoto.subarray(0,2),exif,originalPhoto.subarray(2)]);
 const form=new FormData();form.append('photo',new Blob([photo],{type:'image/jpeg'}),'customer-file.jpg');
 const upload=await request('POST','/api/admin/photos',form,cookie);assert.equal(upload.response.status,201,JSON.stringify(upload.data));
 uploadedPath=path.resolve(process.cwd(),upload.data.image);assert.match(upload.data.image,/^assets\/photos\/uploads\/[\da-f-]+\.jpg$/);
 const uploadedPhoto=fs.readFileSync(uploadedPath);assert.equal(uploadedPhoto.includes(Buffer.from('GPS-PRIVATE')),false);
 assert.equal(uploadedPhoto[0],0xff);assert.equal(uploadedPhoto[1],0xd8);
 const served=await fetch(base+'/'+upload.data.image);assert.equal(served.status,200);

 const spoof=new FormData();spoof.append('photo',new Blob(['<svg></svg>'],{type:'image/svg+xml'}),'image.svg');
 const rejected=await request('POST','/api/admin/photos',spoof,cookie);assert.equal(rejected.response.status,415);
 const product=await request('POST','/api/admin/products',{name:'Test item',category:categoryId,metal:'Gold',purity:'',weight_tola:'',price:'',image:'assets/photos/products/bracelet-01.jpg',alt:''},cookie);
 assert.equal(product.response.status,201);
 const renamedProduct=await request('PUT',`/api/admin/products/${product.data.id}`,{name:'Renamed test item',category:'tops',metal:'Gold',purity:'',weight_tola:'',price:'',image:'assets/photos/products/bracelet-01.jpg',alt:''},cookie);
 assert.equal(renamedProduct.response.status,200);
 const updatedCatalog=await request('GET','/api/products');
 assert(updatedCatalog.data.items.some(p=>p.id===product.data.id&&p.name==='Renamed test item'&&p.category==='tops'));
 const inUse=await request('DELETE','/api/admin/categories/tops',{},cookie);assert.equal(inUse.response.status,409);
 const deletedProduct=await request('DELETE',`/api/admin/products/${product.data.id}`,{},cookie);assert.equal(deletedProduct.response.status,200);
 const deletedCategory=await request('DELETE',`/api/admin/categories/${categoryId}`,{},cookie);assert.equal(deletedCategory.response.status,200);

 const persistent=await request('POST','/api/admin/categories',{label:'Saved Category'},cookie);assert.equal(persistent.response.status,201);
 await stop();
 const oldDb=new DatabaseSync(dbPath);
 const categorySetting=JSON.parse(oldDb.prepare("SELECT value FROM settings WHERE key='categories'").get().value);
 oldDb.prepare("UPDATE settings SET value=? WHERE key='categories'").run(JSON.stringify(categorySetting.filter(c=>!['tops','rings'].includes(c.id))));
 oldDb.prepare("DELETE FROM products WHERE image LIKE 'assets/photos/products/%-scan-%'").run();
 oldDb.prepare("DELETE FROM settings WHERE key IN ('photo-catalog-categories-v1','pdf-photo-products-v1')").run();
 oldDb.close();
 await start();
 const afterRestart=await request('GET','/api/products');
 assert(afterRestart.data.categories.some(c=>c.id===persistent.data.id));
 assert(afterRestart.data.categories.some(c=>c.id==='tops'));
 assert(afterRestart.data.categories.some(c=>c.id==='rings'));
 assert.equal(afterRestart.data.items.filter(p=>/-scan-\d+\.jpg$/.test(p.image||'')).length,35);
 console.log('Admin feature checks passed: uploads are admin-only and image-validated; categories can be added, renamed, safely deleted, and persist after restart.');
}finally{
 await stop();
 if(uploadedPath&&fs.existsSync(uploadedPath))fs.unlinkSync(uploadedPath);
 fs.rmSync(dir,{recursive:true,force:true});
}
