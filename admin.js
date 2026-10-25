const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(m,u,b)=>fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d});
const say=e=>$('#err').textContent=e?e.message:'';let P=[];
async function reqs(){const{items}=await api('GET','/api/admin/requests');
$('#reqs').innerHTML='<tr><th>Date</th><th>Name</th><th>Phone</th><th>Type</th><th>Details</th><th>Status</th></tr>'+items.map(r=>`<tr><td>${esc(r.created_at.slice(0,10))}</td><td>${esc(r.name)}</td><td><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td><td>${esc(r.type)}</td><td>${esc(r.description)}<br>${esc(r.contact_time||'')}</td><td><select data-r="${r.id}" aria-label="Status">${['new','in progress','done','cancelled'].map(s=>`<option${s==r.status?' selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')}
async function prods(){const d=await api('GET','/api/products');P=d.items;$('#cat').innerHTML=d.categories.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
$('#prods').innerHTML='<tr><th>Name</th><th>Category</th><th>Image</th><th></th></tr>'+P.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${esc(p.image||'none')}</td><td><button class="btn ghost" data-e="${p.id}">Edit</button><button class="btn ghost" data-d="${p.id}">Delete</button></td></tr>`).join('')}
async function init(){try{const{user}=await api('GET','/api/me');if(!user||user.role!=='admin'){$('#login').hidden=false;$('#app').hidden=true;$('#out').hidden=true;return}
$('#err').textContent='';$('#login').hidden=true;$('#app').hidden=false;$('#out').hidden=false;
const r=await api('GET','/api/rates');for(const k of['hallmark_gold','tejabi_gold','silver','updated_bs'])$('#rateForm').elements[k].value=r[k]??'';
await Promise.all([reqs(),prods()]);const u=await api('GET','/api/admin/users');
$('#users').innerHTML='<tr><th>Name</th><th>Email</th></tr>'+u.items.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td></tr>`).join('')}catch(e){say(e)}}
$('#loginForm').onsubmit=async e=>{e.preventDefault();say();try{await api('POST','/api/login',Object.fromEntries(new FormData(e.target)));e.target.reset();await init()}catch(x){say(x)}};
$('#out').onclick=async()=>{try{await api('POST','/api/logout');$('#app').hidden=true;$('#out').hidden=true;$('#login').hidden=false}catch(e){say(e)}};
$('#rateForm').onsubmit=async e=>{e.preventDefault();try{say();await api('PUT','/api/admin/rates',Object.fromEntries(new FormData(e.target)));$('#rateMsg').textContent='Saved. The shop page now shows the new rate.'}catch(x){say(x)}};
$('#reqs').onchange=async e=>{const s=e.target.closest('select[data-r]');if(s)try{say();await api('PUT','/api/admin/requests/'+s.dataset.r,{status:s.value})}catch(x){say(x)}};
$('#pf').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target)),id=b.id;delete b.id;
try{say();await(id?api('PUT','/api/admin/products/'+id,b):api('POST','/api/admin/products',b));e.target.reset();$('#pf').elements.id.value='';await prods()}catch(x){say(x)}};
$('#prods').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{say();
if(b.dataset.d&&confirm('Delete this product?')){await api('DELETE','/api/admin/products/'+b.dataset.d);await prods()}
if(b.dataset.e){const p=P.find(x=>x.id==b.dataset.e),f=$('#pf').elements;for(const k of['id','name','category','metal','purity','weight_tola','price','image','alt'])f[k].value=p[k]??'';scrollTo(0,$('#pf').offsetTop)}}catch(x){say(x)}};
init();
