import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kamana-rates-test-'));
process.env.DB_PATH=path.join(dir,'test.db');
const {db,getS,setS}=await import('./server/db.js');
const {latestPublishedRates}=await import('./shared/rates.js');
const {refreshDailyRates}=await import('./server/gold-rate.js');
const now=new Date('2026-10-30T04:30:00.000Z');
const records=[
 {rateType:'छापावाल सुन (१ तोला)',todayDate:'2026-10-29T04:48:34.614Z',todayBaseRatePerGram:283500,yestardayDate:'2026-10-28T04:50:23.062Z',yestardayBaseRatePerGram:283200},
 {rateType:'असली चाँदी दर (१ तोला)',todayDate:'2026-10-29T04:48:34.614Z',todayBaseRatePerGram:3930,yestardayDate:'2026-10-28T04:50:23.062Z',yestardayBaseRatePerGram:3980}
];
const response=data=>async()=>({ok:true,json:async()=>data});

try{
 const latest=latestPublishedRates(records,now);
 assert.equal(latest.goldAmount,283500);
 assert.equal(latest.silverAmount,3930);
 assert.equal(latest.updatedAt.toISOString(),'2026-10-29T04:48:34.614Z');

 setS('rates',{unit:'tola',currency:'NPR',hallmark_gold:280000,tejabi_gold:null,silver:3900,updated_at:'2026-10-28T04:50:23.062Z',updated_bs:''});
 assert.equal(await refreshDailyRates(response(records),now),true);
 let rates=JSON.parse(getS('rates'));
 assert.equal(rates.hallmark_gold,283500);
 assert.equal(rates.silver,3930);
 assert.equal(rates.updated_at,'2026-10-29T04:48:34.614Z');

 const saved=getS('rates');
 assert.equal(await refreshDailyRates(response([]),now),false);
 assert.equal(getS('rates'),saved);

 setS('rates',{...JSON.parse(saved),hallmark_gold:285000,silver:4000,updated_at:'2026-10-30T04:00:00.000Z'});
 const newerSaved=getS('rates');
 assert.equal(await refreshDailyRates(response(records),now),false);
 assert.equal(getS('rates'),newerSaved);
 console.log('Rate checks passed: the latest published pair is used with its real date, and newer saved rates are preserved.');
}finally{
 db.close();
 fs.rmSync(dir,{recursive:true,force:true});
}
