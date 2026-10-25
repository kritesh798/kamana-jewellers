import {DatabaseSync} from 'node:sqlite';import crypto from 'node:crypto';import fs from 'node:fs';import {fileURLToPath} from 'node:url';
export const ROOT=fileURLToPath(new URL('..',import.meta.url));
fs.mkdirSync(ROOT+'server/data',{recursive:true});
export const db=new DatabaseSync(process.env.DB_PATH||ROOT+'server/data/kamana.db');
db.exec(`PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,phone TEXT,pass TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,metal TEXT,purity TEXT,weight_tola REAL,price TEXT,image TEXT,alt TEXT);
CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,name TEXT NOT NULL,phone TEXT NOT NULL,type TEXT NOT NULL,description TEXT NOT NULL,contact_time TEXT,status TEXT NOT NULL DEFAULT 'new',created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
export const getS=k=>db.prepare('SELECT value FROM settings WHERE key=?').get(k)?.value;
export const setS=(k,v)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(v));
if(!getS('rates')){const r=JSON.parse(fs.readFileSync(ROOT+'data/rates.json','utf8'));delete r._howto;setS('rates',r)}
if(!getS('categories')){const c=JSON.parse(fs.readFileSync(ROOT+'data/collection.json','utf8'));setS('categories',c.categories);
if(!db.prepare('SELECT 1 FROM products LIMIT 1').get()){const ins=db.prepare('INSERT INTO products(name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?)');
c.items.forEach(i=>ins.run(i.name,i.category,i.metal||null,i.purity||null,i.weight_tola??null,i.price||null,i.image||null,i.alt||''))}}
const catalog=JSON.parse(fs.readFileSync(ROOT+'data/collection.json','utf8'));
if(JSON.stringify(JSON.parse(getS('categories')||'[]'))!==JSON.stringify(catalog.categories))setS('categories',catalog.categories);
const originalPlaceholders=['Placeholder: necklace set (TODO)','Placeholder: earrings (TODO)','Placeholder: ring (TODO)','Placeholder: bangles (TODO)','Placeholder: bridal set (TODO)','Placeholder: silver item (TODO)'];
const existingProducts=db.prepare('SELECT id,name,image FROM products').all();
if(existingProducts.length===originalPlaceholders.length&&existingProducts.every(p=>originalPlaceholders.includes(p.name))){
 const ins=db.prepare('INSERT INTO products(name,category,metal,purity,weight_tola,price,image,alt) VALUES(?,?,?,?,?,?,?,?)');
 db.exec('BEGIN');
 try{db.exec('DELETE FROM products');catalog.items.forEach(i=>ins.run(i.name,i.category,i.metal||null,i.purity||null,i.weight_tola??null,i.price||null,i.image||null,i.alt||''));db.exec('COMMIT')}
 catch(e){db.exec('ROLLBACK');throw e}
}
const starterPhoto=/^assets\/photos\/products\/(?:bracelet-\d+|chandrama-jewellery-\d+|gedis-chandrahar-\d+|mangalsutra-\d+|silver-sikiri-\d+|tilhari-medium-\d+)\.jpg$|^assets\/photos\/Bride_wearing_gold_jewellery_20261025115042\.jpg$/;
const hasNumberedSeed=existingProducts.some(p=>starterPhoto.test(p.image||'')&&(/\s\d+$/.test(p.name)||p.name==='Bridal Jewellery Set'));
if(hasNumberedSeed){
 const currentByImage=new Map(catalog.items.filter(i=>i.image).map(i=>[i.image,i]));
 const update=db.prepare('UPDATE products SET name=?,category=?,metal=?,purity=?,weight_tola=?,price=?,alt=? WHERE id=?');
 const remove=db.prepare('DELETE FROM products WHERE id=?');
 db.exec('BEGIN');
 try{
  for(const p of existingProducts){if(!starterPhoto.test(p.image||''))continue;const item=currentByImage.get(p.image);
   if(item)update.run(item.name,item.category,item.metal||null,item.purity||null,item.weight_tola??null,item.price||null,item.alt||'',p.id);
   else remove.run(p.id)}
  db.exec('COMMIT')
 }catch(e){db.exec('ROLLBACK');throw e}
}
export const hashPw=p=>{const s=crypto.randomBytes(16);return s.toString('hex')+':'+crypto.scryptSync(p,s,64).toString('hex')};
const DUMMY=hashPw('x');
export const checkPw=(p,st)=>{const[s,h]=(st||DUMMY).split(':');const x=crypto.scryptSync(p,Buffer.from(s,'hex'),64);return crypto.timingSafeEqual(x,Buffer.from(h,'hex'))&&!!st};
