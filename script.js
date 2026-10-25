(()=>{clearTimeout(window.__f);
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)],D=document.documentElement;
const cn=navigator.connection||{},lite=cn.saveData||/^(2g|3g|slow-2g)$/.test(cn.effectiveType||''),
reduce=matchMedia('(prefers-reduced-motion:reduce)').matches,J=u=>fetch(u).then(r=>{if(!r.ok)throw 0;return r.json()}).catch(()=>null),JF=(a,b)=>J(a).then(x=>x||J(b)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rateSource='https://api.fenegosida.org/api/website/v1/Dashboard/today',goldRateType='छापावाल सुन (१ तोला)',silverRateType='असली चाँदी दर (१ तोला)',
nepalDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kathmandu',year:'numeric',month:'2-digit',day:'2-digit'}),
dateKey=d=>nepalDate.format(d);
async function ratesData(){const R=await J('/api/rates')||await J('data/rates.json');if(!R)return null;
if(R.hallmark_gold!=null&&R.silver!=null&&R.updated_at&&dateKey(new Date(R.updated_at))===dateKey(new Date()))return R;
try{const response=await fetch(rateSource,{headers:{accept:'application/json'},signal:AbortSignal.timeout(10000)});
if(!response.ok)throw Error(`HTTP ${response.status}`);
const records=await response.json(),findRate=type=>Array.isArray(records)?records.find(x=>x.rateType===type):null,
gold=findRate(goldRateType),silver=findRate(silverRateType),goldAmount=Number(gold?.todayBaseRatePerGram),
silverAmount=Number(silver?.todayBaseRatePerGram),updatedAt=new Date(gold?.todayDate),silverUpdatedAt=new Date(silver?.todayDate);
if(!(goldAmount>0&&goldAmount<1e8&&Number.isFinite(goldAmount)&&silverAmount>0&&silverAmount<1e8&&Number.isFinite(silverAmount)&&
Number.isFinite(updatedAt.getTime())&&updatedAt.getTime()===silverUpdatedAt.getTime())||dateKey(updatedAt)!==dateKey(new Date()))throw Error('No valid gold and silver rates published for today in Nepal');
return{...R,hallmark_gold:goldAmount,silver:silverAmount,updated_at:updatedAt.toISOString(),updated_bs:''}
}catch(e){console.warn('Could not load today’s gold and silver rates from the Federation; showing the last saved rates if available.',e);return R}}
if(lite)D.classList.add('lite');
/* ---- HERO (keep under 6 KB minified) ---- */
const H=$('.hero');
function hero(S){const h=(S&&S.hero)||{},fx=!lite&&!reduce;
if(fx)(h.sparkles||[]).slice(0,6).forEach(s=>{const e=document.createElement('i');e.className='sp';
e.style.cssText=`left:${s.x}%;top:${s.y}%;--s:${s.size}px;--d:${s.delay}s;--t:${3+(s.delay*1.7%3)}s`;
e.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" fill="#fff4cf"/></svg>';$('#sparkles').append(e)});
let v;if(fx&&h.video&&h.video.enabled){v=document.createElement('video');v.muted=v.loop=v.playsInline=true;v.setAttribute('aria-hidden','true');
v.innerHTML=(h.video.webm?`<source src="${h.video.webm}" type="video/webm">`:'')+(h.video.mp4?`<source src="${h.video.mp4}" type="video/mp4">`:'');$('.hero-zoom').insertBefore(v,$('#sparkles'));v.play().catch(()=>{})}
const set=on=>{H.classList.toggle('paused',!on);if(v)on?v.play().catch(()=>{}):v.pause()};let vis=1;
if('IntersectionObserver'in window)new IntersectionObserver(e=>{vis=e[0].isIntersecting;set(vis&&!document.hidden)}).observe(H);
document.addEventListener('visibilitychange',()=>set(vis&&!document.hidden));
if(fx&&matchMedia('(hover:hover) and (pointer:fine)').matches){let r;H.addEventListener('pointermove',e=>{if(r)return;r=requestAnimationFrame(()=>{r=0;const b=H.getBoundingClientRect();
H.style.setProperty('--px',((e.clientX-b.left)/b.width-.5)*-24);H.style.setProperty('--py',((e.clientY-b.top)/b.height-.5)*-24)})})}
if(/[?&]place=1/.test(location.search))H.addEventListener('click',e=>{const b=H.getBoundingClientRect(),x=+((e.clientX-b.left)/b.width*100).toFixed(1),y=+((e.clientY-b.top)/b.height*100).toFixed(1);
console.log(`{"x":${x},"y":${y},"size":16,"delay":0}`);alert(`x ${x}, y ${y} (also in console)`)})}
/* ---- SITE ---- */
Promise.all([J('data/site.json'),ratesData(),JF('/api/products','data/collection.json')]).then(([S,R,C])=>{
hero(S);if(S)site(S,C);if(R)rates(R);if(C)coll(C,S);reveal()});
let WA='9779846032611';const wa=m=>`https://wa.me/${WA}?text=${encodeURIComponent(m)}`;
function site(S,C){const c=S.contact||{};WA=c.whatsapp||WA;
$$('[data-wa]').forEach(a=>a.href=wa('Hello, I found your website.'));$$('[data-call]').forEach(a=>a.href='tel:+'+(c.call||WA));
if(S.hours)$$('[data-hours]').forEach(e=>e.textContent=S.hours);
const m=S.map||{},place=m.query||(m.lat&&m.lng?`${m.lat},${m.lng}`:'New Kamana Jewellers, Savagriha Chowk, Pokhara, Nepal'),directions=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(place)}`;
$$('[data-directions]').forEach(a=>a.href=directions);const map=$('#locationMap');if(map)map.src=`https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
const social=S.social||{};if(social.tiktok)$('#footerTikTok').href=social.tiktok;if(social.facebook)$('#footerFacebook').href=social.facebook;
const b=S.banner;if(b&&b.enabled&&b.text){const e=$('#banner');e.textContent=b.text;e.hidden=false}}
function rates(R){const f=n=>n==null?'Call for rate':'NPR '+Number(n).toLocaleString('en-IN'),rows=[['Hallmark gold',R.hallmark_gold]];
if(R.tejabi_gold!=null)rows.push(['Tejabi gold',R.tejabi_gold]);rows.push(['Silver',R.silver]);
$('#rates').innerHTML=rows.map(r=>`<div><dt>${r[0]}, per ${R.unit||'tola'}</dt><dd>${f(r[1])}</dd></div>`).join('');
let t='',old=true;if(R.updated_at){const d=new Date(R.updated_at);old=Date.now()-d>864e5;
t='Updated '+(dateKey(d)===dateKey(new Date())?'today':dateKey(d)===dateKey(new Date(Date.now()-864e5))?'yesterday':d.toLocaleDateString('en-GB',{dateStyle:'medium',timeZone:'Asia/Kathmandu'}))}
$('#rateNote').innerHTML=(t?t+'. ':'')+'Rates are indicative. Hallmark gold is refreshed daily from the <a href="https://fenegosida.org/" target="_blank" rel="noopener noreferrer">Federation of Nepal Gold and Silver Dealers’ Association</a>.'+(old?' <span class="warn">This rate may be out of date. Call to confirm.</span>':' Call to confirm before you visit.');
if(R.hallmark_gold!=null)$('#heroRate').innerHTML=`Hallmark gold per tola: <b>${f(R.hallmark_gold)}</b>${t?' · '+t.replace(/\(.*\)/,''):''}`}
function coll(C,S){const g=$('#grid'),fl=$('#filters'),cats=[{id:'all',label:'All'},...C.categories];let cur='all',term='';
const ph=i=>`<span class="pic" style="display:grid;place-items:center;text-align:center;padding:12px">Photo placeholder (TODO)</span>`;
const pic=i=>i.image?`<img class="pic" src="${esc(i.image)}" alt="${esc(i.alt||i.name)}" width="800" height="1000" loading="lazy">`:ph(i);
const meta=i=>[i.metal,i.purity,i.weight_tola&&i.weight_tola+' tola',i.price||'Price on request'].filter(Boolean).join(' · ');
const ask=i=>wa(`Hello, I'd like to ask about this piece: ${i.name} (${i.category}).`);
function matches(i,q){const c=C.categories.find(x=>x.id===i.category);return [i.name,i.category,c?.label,i.metal,i.purity,i.weight_tola].some(v=>String(v??'').toLowerCase().includes(q))}
function draw(){fl.innerHTML=cats.map(c=>`<button aria-pressed="${c.id==cur}" data-c="${esc(c.id)}">${esc(c.label)}</button>`).join('');
const items=C.items.filter(i=>(cur=='all'||i.category==cur)&&(!term||matches(i,term)));
g.innerHTML=items.length?items.map(i=>`<figure><button class="pic" data-i="${i.id}" aria-label="View ${esc(i.name)}">${i.image?pic(i):'Photo placeholder (TODO)'}</button><figcaption><h3>${esc(i.name)}</h3><p class="meta">${esc(meta(i))}</p><a class="btn ghost" href="${ask(i)}">Ask about this piece</a></figcaption></figure>`).join(''):'<p class="search-empty">No pieces match this search. Try another name or category.</p>'}
function show(i){if(!i)return;$('#lbc').innerHTML=`${pic(i)}<h3>${esc(i.name)}</h3><p class="meta">${esc(meta(i))}</p><a class="btn wa" href="${ask(i)}">Ask about this piece</a>`;$('#lb').showModal()}
fl.onclick=e=>{const b=e.target.closest('button[data-c]');if(b){cur=b.dataset.c;draw()}};
g.onclick=e=>{const b=e.target.closest('button[data-i]');if(b)show(C.items.find(x=>x.id==b.dataset.i))};
$('#lbx').onclick=()=>$('#lb').close();draw();

const panel=$('#searchPanel'),trigger=$('#searchOpen'),input=$('#searchInput'),catList=$('#searchCategories'),preview=$('#searchPreview'),results=$('#searchMatches');
let active=cats[1]?.id||'all';
function previewCategory(id){const c=cats.find(x=>x.id===id),items=C.items.filter(i=>i.category===id),item=items.find(i=>i.image);
preview.innerHTML=`${item?`<img src="${esc(item.image)}" alt="${esc(item.alt||item.name)}">`:'<div class="search-preview-empty">Add a product photo to preview this category.</div>'}<div class="search-preview-copy"><h3>${esc(c?.label||'Collection')}</h3><p>${items.length} ${items.length===1?'piece':'pieces'}</p></div>`}
function renderResults(){const q=input.value.trim().toLowerCase();term=q;draw();
if(!q){results.innerHTML='';return}
const found=C.items.filter(i=>matches(i,q)).slice(0,6);
results.innerHTML=found.length?found.map(i=>`<button class="search-match" type="button" data-match="${esc(i.id)}">${i.image?`<img src="${esc(i.image)}" alt="">`:'<span class="search-match-placeholder" aria-hidden="true">Gold</span>'}<span>${esc(i.name)}<small>${esc(C.categories.find(c=>c.id===i.category)?.label||i.category)}</small></span></button>`).join(''):'<p class="search-empty">No matching jewellery found.</p>'}
function closeSearch(restore){panel.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore)trigger.focus()}
function openSearch(){panel.hidden=false;trigger.setAttribute('aria-expanded','true');input.focus()}
catList.innerHTML=C.categories.map(c=>`<button class="search-category" type="button" data-search-cat="${esc(c.id)}" aria-pressed="${c.id===active}"><span>${esc(c.label)}</span><small>${C.items.filter(i=>i.category===c.id).length}</small></button>`).join('');
previewCategory(active);
catList.addEventListener('pointerover',e=>{const b=e.target.closest('[data-search-cat]');if(b){active=b.dataset.searchCat;previewCategory(active)}});
catList.addEventListener('focusin',e=>{const b=e.target.closest('[data-search-cat]');if(b){active=b.dataset.searchCat;previewCategory(active)}});
catList.addEventListener('click',e=>{const b=e.target.closest('[data-search-cat]');if(!b)return;cur=b.dataset.searchCat;term='';input.value='';draw();closeSearch(false);$('#collection').scrollIntoView({behavior:reduce?'auto':'smooth'});});
results.addEventListener('click',e=>{const b=e.target.closest('[data-match]');if(!b)return;closeSearch(false);show(C.items.find(i=>i.id==b.dataset.match))});
trigger.addEventListener('click',()=>panel.hidden?openSearch():closeSearch(false));
$('#searchClose').addEventListener('click',()=>closeSearch(true));
$('#searchForm').addEventListener('submit',e=>e.preventDefault());
input.addEventListener('input',renderResults);
document.addEventListener('click',e=>{if(!panel.hidden&&!panel.contains(e.target)&&!trigger.contains(e.target))closeSearch(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)closeSearch(true)})}
$('#reqForm').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),
m=`Hello, I'd like to send a request.\nType: ${f.get('type')}\nName: ${f.get('name')}\nPhone: ${f.get('phone')}\nDetails: ${f.get('desc')}\nBest time to contact: ${f.get('time')||'any time'}`;
const payload={name:f.get('name'),phone:f.get('phone'),type:f.get('type'),description:f.get('desc'),time:f.get('time')};
$('#fallback').hidden=true;
fetch('/api/requests',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})
.then(r=>{if(!r.ok)throw new Error('Could not save your request. You can still message us, but your details will not be recorded.');
window.open(wa(m),'_blank','noopener');$('#fallback').hidden=false;
$('#fallback').innerHTML='Your request was saved. <a data-call href="tel:+9779846032611">Call the shop</a> if WhatsApp did not open.'})
.catch(x=>{window.open(wa(m+' (Note: I could not save this via your website — the server may be down.)'),'_blank','noopener');
$('#fallback').hidden=false;$('#fallback').textContent=x.message})});
function reveal(){const r=$$('.rv');if(!('IntersectionObserver'in window))return r.forEach(e=>e.classList.add('in'));
const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');o.unobserve(e.target)}}),{threshold:0});r.forEach(e=>o.observe(e))}
})();
