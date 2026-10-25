import {getS,setS} from './db.js';

const SOURCE='https://api.fenegosida.org/api/website/v1/Dashboard/today';
const GOLD_RATE_TYPE='छापावाल सुन (१ तोला)',SILVER_RATE_TYPE='असली चाँदी दर (१ तोला)';
const DAY=864e5;
const nepalDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kathmandu',year:'numeric',month:'2-digit',day:'2-digit'});
const dateKey=value=>nepalDate.format(value);

export async function refreshDailyRates(fetcher=fetch){
try{
const response=await fetcher(SOURCE,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
if(!response.ok){console.error(`Daily precious-metal rate update failed: source returned HTTP ${response.status}.`);return false}
let records;
try{records=await response.json()}catch(e){console.error('Daily precious-metal rate update failed: source returned invalid JSON.',e);return false}
const findRate=type=>Array.isArray(records)?records.find(x=>x.rateType===type):null,
gold=findRate(GOLD_RATE_TYPE),silver=findRate(SILVER_RATE_TYPE),
goldAmount=Number(gold?.todayBaseRatePerGram),silverAmount=Number(silver?.todayBaseRatePerGram),
updatedAt=new Date(gold?.todayDate),silverUpdatedAt=new Date(silver?.todayDate);
if(!Number.isFinite(goldAmount)||goldAmount<=0||goldAmount>=1e8||!Number.isFinite(silverAmount)||silverAmount<=0||silverAmount>=1e8||
!Number.isFinite(updatedAt.getTime())||!Number.isFinite(silverUpdatedAt.getTime())||updatedAt.getTime()!==silverUpdatedAt.getTime()){
console.error('Daily precious-metal rate update failed: source did not include valid current 1-tola hallmark gold and silver rates.');
return false}
if(dateKey(updatedAt)!==dateKey(new Date())){
console.warn('Daily rate update skipped: the Federation has not published rates for today in Nepal yet.');
return false}
const rates=JSON.parse(getS('rates'));
setS('rates',{...rates,hallmark_gold:goldAmount,silver:silverAmount,updated_at:updatedAt.toISOString(),updated_bs:''});
console.log(`Daily rates updated from the Federation: gold NPR ${goldAmount.toLocaleString('en-IN')} and silver NPR ${silverAmount.toLocaleString('en-IN')} per tola.`);
return true
}catch(e){console.error('Daily precious-metal rate update failed while contacting the Federation.',e);return false}
}

export function scheduleDailyRates(){
const now=new Date(),parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{
timeZone:'Asia/Kathmandu',year:'numeric',month:'numeric',day:'numeric'
}).formatToParts(now).map(x=>[x.type,x.value]));
let next=Date.UTC(+parts.year,+parts.month-1,+parts.day,12)-345*60*1000;
if(next<=now.getTime())next+=DAY;
const timer=setTimeout(()=>{void refreshDailyRates();scheduleDailyRates()},next-now.getTime());
timer.unref();
}
