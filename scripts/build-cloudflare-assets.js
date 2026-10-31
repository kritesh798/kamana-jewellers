import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),output=path.join(root,'.cloudflare-assets');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const copy=(source,destination=source)=>{
 const from=path.join(root,source),to=path.join(output,destination);
 if(!fs.existsSync(from)||!fs.statSync(from).isFile())throw Error(`Required Cloudflare asset is missing: ${source}`);
 fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to)
};

fs.rmSync(output,{recursive:true,force:true});
for(const file of ['index.html','admin.html','styles.css','script.js','admin.js','robots.txt','sitemap.xml',
 'data/site.json','data/rates.json','data/collection.json'])copy(file);

const site=readJson('data/site.json'),catalog=readJson('data/collection.json'),assets=new Set();
for(const match of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/(?:src|href)="(assets\/[^"]+)"/g))assets.add(match[1]);
for(const item of catalog.items)if(item.image)assets.add(item.image);
if(site.hero?.video?.enabled){if(site.hero.video.webm)assets.add(site.hero.video.webm);if(site.hero.video.mp4)assets.add(site.hero.video.mp4)}
for(const asset of assets)copy(asset);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hashes=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
 .map(match=>`'sha256-${crypto.createHash('sha256').update(match[1]).digest('base64')}'`);
const csp=`default-src 'self'; script-src 'self' ${hashes.join(' ')}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src https://www.google.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
fs.writeFileSync(path.join(output,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  X-Frame-Options: DENY
  Content-Security-Policy: ${csp}
`);
console.log(`Prepared ${assets.size} referenced media files for Cloudflare.`)
