const nepalDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kathmandu',year:'numeric',month:'2-digit',day:'2-digit'});
export const nepalDateKey=value=>nepalDate.format(value);

export function latestPublishedRates(records,now=new Date()){
const today=nepalDateKey(now),published=type=>{
const record=Array.isArray(records)?records.find(x=>x.rateType===type):null;
if(!record)return[];
return[[record.todayBaseRatePerGram,record.todayDate],[record.yestardayBaseRatePerGram,record.yestardayDate]]
.map(([value,date])=>({value:Number(value),date:new Date(date)}))
.filter(x=>Number.isFinite(x.value)&&x.value>0&&x.value<1e8&&Number.isFinite(x.date.getTime())&&nepalDateKey(x.date)<=today)
};
const gold=published('छापावाल सुन (१ तोला)'),silver=published('असली चाँदी दर (१ तोला)'),pairs=[];
for(const g of gold)for(const s of silver)if(nepalDateKey(g.date)===nepalDateKey(s.date))pairs.push({goldAmount:g.value,silverAmount:s.value,updatedAt:new Date(Math.max(g.date.getTime(),s.date.getTime()))});
return pairs.sort((a,b)=>b.updatedAt-a.updatedAt)[0]||null
}
