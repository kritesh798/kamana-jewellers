const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=(m,u,b)=>{const multipart=b instanceof FormData;return fetch(u,{method:m,headers:m!=='GET'&&!multipart?{'Content-Type':'application/json'}:undefined,body:multipart?b:m!=='GET'&&b!==undefined?JSON.stringify(b):undefined}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Something went wrong.');return d})};
const say=e=>$('#err').textContent=e?e.message:'';
let P=[],C=[];
async function reqs(){const{items}=await api('GET','/api/admin/requests');
$('#reqs').innerHTML='<thead><tr><th>Date</th><th>Name</th><th>Phone</th><th>Type</th><th>Details</th><th>Status</th></tr></thead><tbody>'+items.map(r=>`<tr><td>${esc(r.created_at.slice(0,10))}</td><td>${esc(r.name)}</td><td><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td><td>${esc(r.type)}</td><td>${esc(r.description)}<br>${esc(r.contact_time||'')}</td><td><select data-r="${r.id}" aria-label="Status for ${esc(r.name)}">${['new','in progress','done','cancelled'].map(s=>`<option${s==r.status?' selected':''}>${s}</option>`).join('')}</select></td></tr>`).join('')+'</tbody>'}
function productRows(){const q=$('#productSearch').value.trim().toLocaleLowerCase(),labels=new Map(C.map(c=>[c.id,c.label])),items=P.filter(p=>`${p.name} ${labels.get(p.category)||p.category}`.toLocaleLowerCase().includes(q));
$('#productCount').textContent=q?`Showing ${items.length} of ${P.length} products.`:`${P.length} ${P.length===1?'product':'products'} in all categories.`;
$('#prods').innerHTML=items.length?items.map(p=>`<article class="admin-product-row">${p.image?`<img src="/${esc(p.image)}" alt="" loading="lazy">`:'<span class="admin-no-photo">No photo</span>'}<div class="admin-product-info"><strong>${esc(p.name)}</strong><span>${esc(labels.get(p.category)||p.category)}</span></div><div class="admin-row-actions"><button class="btn ghost" type="button" data-e="${p.id}" aria-label="Edit ${esc(p.name)}">Edit</button><button class="btn ghost" type="button" data-d="${p.id}" aria-label="Delete ${esc(p.name)}">Delete</button></div></article>`).join(''):'<p class="admin-empty">No products match. Try another search, or add a product above.</p>'}
async function prods(){const d=await api('GET','/api/products');P=d.items;C=d.categories;
const selected=$('#cat').value;$('#cat').innerHTML=C.map(c=>`<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
if(C.some(c=>c.id===selected))$('#cat').value=selected;
$('#categoryList').innerHTML=C.map(c=>{const count=P.filter(p=>p.category===c.id).length;return`<article class="admin-category-row" data-category="${esc(c.id)}"><label><span>Category name</span><input data-label value="${esc(c.label)}" maxlength="40" aria-label="Category name: ${esc(c.label)}"></label><p class="admin-category-count">${count} ${count===1?'product':'products'}</p><div class="admin-row-actions"><button class="btn ghost" type="button" data-save-category>Save name</button><button class="btn ghost" type="button" data-delete-category ${count?'disabled title="Move or delete its products first"':''}>Remove</button></div>${count?'<small class="admin-category-hint">Move or delete these products before removing this category.</small>':''}</article>`}).join('');
productRows()}
function resetProductMode(){const f=$('#pf');f.elements.id.value='';f.elements.image.value='';$('#photoFile').value='';$('#photoPreview').removeAttribute('src');$('#photoPreview').hidden=true;$('#photoMsg').textContent='Choose a photo, then select “Upload photo”.';$('#productFormTitle').textContent='Add a product';$('#productFormNote').textContent='Enter a name, choose a category, and add a photo. Other details are optional.';$('#productSubmit').textContent='Add product';$('#cancelEdit').hidden=true}
function resetProductForm(){const f=$('#pf');f.reset();resetProductMode()}
function previewPhoto(image){const preview=$('#photoPreview');if(image){preview.src='/'+image;preview.hidden=false}else{preview.removeAttribute('src');preview.hidden=true}}
async function init(){try{const{user}=await api('GET','/api/me');if(!user||user.role!=='admin'){$('#login').hidden=false;$('#app').hidden=true;$('#out').hidden=true;return}
say();$('#login').hidden=true;$('#app').hidden=false;$('#out').hidden=false;
const r=await api('GET','/api/rates');for(const k of['hallmark_gold','tejabi_gold','silver','updated_bs'])$('#rateForm').elements[k].value=r[k]??'';
await Promise.all([reqs(),prods()]);const u=await api('GET','/api/admin/users');
$('#users').innerHTML='<thead><tr><th>Name</th><th>Email</th></tr></thead><tbody>'+u.items.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td></tr>`).join('')+'</tbody>'}catch(e){say(e)}}
$('#loginForm').onsubmit=async e=>{e.preventDefault();say();try{await api('POST','/api/login',Object.fromEntries(new FormData(e.target)));e.target.reset();await init()}catch(x){say(x)}};
$('#out').onclick=async()=>{try{await api('POST','/api/logout');$('#app').hidden=true;$('#out').hidden=true;$('#login').hidden=false}catch(e){say(e)}};
$('#rateForm').onsubmit=async e=>{e.preventDefault();try{say();await api('PUT','/api/admin/rates',Object.fromEntries(new FormData(e.target)));$('#rateMsg').textContent='Saved. The shop page now shows the new rate.'}catch(x){say(x)}};
$('#reqs').onchange=async e=>{const s=e.target.closest('select[data-r]');if(s)try{say();await api('PUT','/api/admin/requests/'+s.dataset.r,{status:s.value})}catch(x){say(x)}};
$('#pf').onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target)),id=b.id;delete b.id;
try{say();$('#productSubmit').disabled=true;await(id?api('PUT','/api/admin/products/'+id,b):api('POST','/api/admin/products',b));$('#productMsg').textContent=id?'Product changes saved.':'Product added to the shop.';resetProductForm();await prods()}catch(x){say(x)}finally{$('#productSubmit').disabled=false}};
const MAX_SIDE=2400;
async function shrinkPhoto(file){
 // Phone cameras (e.g. 50 MP) make huge files; re-encode to a clean, smaller JPEG before sending.
 if(typeof createImageBitmap!=='function')return file;
 let bitmap;try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'})}catch{try{bitmap=await createImageBitmap(file)}catch{return file}}
 const scale=Math.min(1,MAX_SIDE/Math.max(bitmap.width,bitmap.height)),w=Math.round(bitmap.width*scale),h=Math.round(bitmap.height*scale);
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(bitmap,0,0,w,h);bitmap.close?.();
 const blob=await new Promise(ok=>canvas.toBlob(ok,'image/jpeg',.88));canvas.width=canvas.height=0;
 return blob&&blob.size?new File([blob],'photo.jpg',{type:'image/jpeg'}):file}
const sendPhoto=(form,onProgress)=>new Promise((ok,no)=>{const x=new XMLHttpRequest();x.open('POST','/api/admin/photos');x.timeout=180000;
 x.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100))};
 x.onload=()=>{let d={};try{d=JSON.parse(x.responseText)}catch{}x.status>=200&&x.status<300?ok(d):no(new Error(d.error||`Upload failed (error ${x.status}). Please try again.`))};
 x.onerror=()=>no(new Error('Upload failed: the internet connection dropped. Check Wi-Fi or mobile data and try again.'));
 x.ontimeout=()=>no(new Error('Upload took too long and was stopped. Check the internet connection and try again.'));
 x.send(form)});
$('#uploadPhoto').onclick=async()=>{const file=$('#photoFile').files[0];if(!file){say(new Error('Choose a photo first, then select “Upload photo”.'));return}
try{say();$('#uploadPhoto').disabled=true;$('#photoMsg').textContent='Preparing photo…';const small=await shrinkPhoto(file);
const form=new FormData();form.append('photo',small,small.name||'photo.jpg');
$('#photoMsg').textContent='Uploading photo… 0%';
const result=await sendPhoto(form,p=>{$('#photoMsg').textContent=p<100?`Uploading photo… ${p}%`:'Saving photo… please wait.'});$('#pf').elements.image.value=result.image;
previewPhoto(result.image);$('#photoMsg').textContent='Photo uploaded. Add the product name and category, then select “Add product”.'}
catch(x){$('#photoMsg').textContent='Photo was not uploaded. Please try again.';say(x)}finally{$('#uploadPhoto').disabled=false}};
$('#categoryForm').onsubmit=async e=>{e.preventDefault();const button=$('#categorySubmit');
try{say();button.disabled=true;const label=new FormData(e.target).get('label');await api('POST','/api/admin/categories',{label});e.target.reset();$('#categoryMsg').textContent=`“${label}” category added.`;await prods()}catch(x){say(x)}finally{button.disabled=false}};
$('#categoryList').onclick=async e=>{const row=e.target.closest('.admin-category-row');if(!row)return;const save=e.target.closest('[data-save-category]'),remove=e.target.closest('[data-delete-category]');if(!save&&!remove)return;
try{say();
if(save){save.disabled=true;await api('PUT','/api/admin/categories/'+encodeURIComponent(row.dataset.category),{label:row.querySelector('[data-label]').value});$('#categoryMsg').textContent='Category name saved.'}
else if(remove&&!remove.disabled){if(!confirm('Remove this empty category? This cannot be undone.'))return;remove.disabled=true;await api('DELETE','/api/admin/categories/'+encodeURIComponent(row.dataset.category));$('#categoryMsg').textContent='Category removed.'}
await prods()}catch(x){say(x)}};
$('#productSearch').oninput=productRows;
$('#prods').onclick=async e=>{const b=e.target.closest('button');if(!b)return;try{say();
if(b.dataset.d&&confirm('Delete this product from the shop? This cannot be undone.')){b.disabled=true;await api('DELETE','/api/admin/products/'+b.dataset.d);$('#productMsg').textContent='Product deleted.';await prods()}
if(b.dataset.e){const p=P.find(x=>x.id==b.dataset.e),f=$('#pf').elements;if(!p)return;
for(const k of['id','name','category','metal','purity','weight_tola','price','image','alt'])f[k].value=p[k]??'';
$('#photoFile').value='';$('#photoMsg').textContent=p.image?'Current photo is shown below. Choose and upload another photo to replace it.':'This product has no photo yet. Choose and upload one below.';
previewPhoto(p.image);$('#productFormTitle').textContent='Edit product';$('#productFormNote').textContent='Change the product name, category, or photo. Select “Save changes” when finished.';
$('#productSubmit').textContent='Save changes';$('#cancelEdit').hidden=false;$('#productFormTitle').scrollIntoView({behavior:'smooth',block:'center'});f.name.focus()}}catch(x){say(x)}};
$('#cancelEdit').onclick=resetProductForm;
$('#pf').addEventListener('reset',()=>{setTimeout(()=>resetProductMode(),0)});
init();
