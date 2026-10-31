import {getS,setS} from './db.js';
import {latestPublishedRates,nepalDateKey} from '../shared/rates.js';

const SOURCE='https://api.fenegosida.org/api/website/v1/Dashboard/today';
const DAY=864e5;

export async function refreshDailyRates(fetcher=fetch,now=new Date()){
try{
const response=await fetcher(SOURCE,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
if(!response.ok){console.error(`Daily precious-metal rate update failed: source returned HTTP ${response.status}.`);return false}
let records;
try{records=await response.json()}catch(e){console.error('Daily precious-metal rate update failed: source returned invalid JSON.',e);return false}
const latest=latestPublishedRates(records,now);
if(!latest){console.error('Daily precious-metal rate update failed: source did not include a valid published 1-tola hallmark gold and silver pair.');return false}
const {goldAmount,silverAmount,updatedAt}=latest,rates=JSON.parse(getS('rates')),savedAt=new Date(rates.updated_at);
if(rates.hallmark_gold!=null&&rates.silver!=null&&Number.isFinite(savedAt.getTime())&&updatedAt<savedAt){
console.warn('Daily rate update skipped: the website already has a newer saved rate.');return false}
setS('rates',{...rates,hallmark_gold:goldAmount,silver:silverAmount,updated_at:updatedAt.toISOString(),updated_bs:''});
console.log(`Latest published rates saved from the Federation (${nepalDateKey(updatedAt)} Nepal time): gold NPR ${goldAmount.toLocaleString('en-IN')} and silver NPR ${silverAmount.toLocaleString('en-IN')} per tola.`);
return true
}catch(e){console.error('Daily precious-metal rate update failed while contacting the Federation.',e);return false}
}

export function scheduleDailyRates(){
const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
timeZone:'Asia/Kathmandu',year:'numeric',month:'numeric',day:'numeric'
}).formatToParts(now).map(x=>[x.type,x.value]));
let next=Date.UTC(+parts.year,+parts.month-1,+parts.day,10)-345*60*1000;
if(next<=now.getTime())next+=DAY;
const timer=setTimeout(()=>{void refreshDailyRates();scheduleDailyRates()},next-now.getTime());
timer.unref();
}
