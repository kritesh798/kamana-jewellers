const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(m,u,b)=>fetch(u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong. Try again.');return d});
async function load(){const{user}=await api('GET','/api/me');$('#auth').hidden=!!user;$('#acct').hidden=!user;if(!user)return;
$('#hi').textContent='Signed in as '+user.name+' ('+user.email+')';$('#adm').hidden=user.role!=='admin';
const{items}=await api('GET','/api/my/requests');$('#mine').innerHTML=items.length?items.map(r=>`<li>${esc(r.type)}: ${esc(r.description.slice(0,80))} <b>(${esc(r.status)})</b>, ${esc(r.created_at.slice(0,10))}</li>`).join(''):'<li>No requests yet. Send one from the shop page.</li>'}
for(const[id,url]of[['#lf','/api/login'],['#rf','/api/register']])$(id).addEventListener('submit',async e=>{e.preventDefault();$('#err').textContent='';
try{await api('POST',url,Object.fromEntries(new FormData(e.target)));e.target.reset();await load()}catch(x){$('#err').textContent=x.message}});
$('#out').onclick=async()=>{await api('POST','/api/logout');load()};load();
