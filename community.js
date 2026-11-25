const L=(k,d=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch{return d}};
const S=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RQ='inter_community_requests',OF='inter_community_offers';
const me=()=>L('inter_current',null);
const tip=b=>b>=4?'T4+':'T'+(b||0);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const money=n=>new Intl.NumberFormat('pt-AO',{maximumFractionDigits:0}).format(Number(n)||0);
const toast=m=>window.__roles&&window.__roles.toastMsg(m);
const props=()=>L('inter_custom_properties').filter(p=>p.status==='active');
const catName={rent:'Arrendar',sale:'Comprar',commercial:'Comercial'};
window.__media={photos:[],video:''};

/* ---------- Média do anúncio (mín. 5 fotos + vídeo opcional) ---------- */
window.mediaField=()=>{const M=window.__media,n=M.photos.length;return '<div class="role-field full" id="mediaBox"><label>Fotografias do imóvel (mínimo 5)</label><input id="mediaPhotos" type="file" accept="image/*" multiple><div class="media-grid">'+M.photos.map((s,i)=>'<div class="media-thumb"><img src="'+s+'" alt=""><button type="button" data-cm="rmphoto" data-i="'+i+'" aria-label="Remover">×</button>'+(i===0?'<span>Capa</span>':'')+'</div>').join('')+'</div><p class="media-count '+(n>=5?'ok':'')+'">'+n+' de 5 fotografias'+(n>=5?' ✓':' · faltam '+(5-n))+'</p><label>Vídeo do imóvel (opcional)</label><input id="mediaVideo" type="file" accept="video/*">'+(M.video?'<div class="media-video"><video src="'+M.video+'" controls playsinline preload="metadata"></video><button type="button" class="tiny-button danger" data-cm="rmvideo">Remover vídeo</button></div>':'')+'<p class="role-help">Demonstração local: fotografias são reduzidas automaticamente e o vídeo pode ter até 1,5 MB. Na versão real, ficam no servidor.</p></div>'};
const redrawMedia=()=>{const b=document.getElementById('mediaBox');if(b)b.outerHTML=window.mediaField()};
const shrink=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1000/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=Math.round(i.width*k);c.height=Math.round(i.height*k);c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.72))};i.onerror=()=>res(null);i.src=r.result};r.onerror=()=>res(null);r.readAsDataURL(f)});
document.addEventListener('change',async e=>{const t=e.target,M=window.__media;
 if(t.id==='mediaPhotos'){const files=[...t.files].slice(0,10-M.photos.length);if(!files.length){toast('Máximo de 10 fotografias');return}for(const f of files){const d=await shrink(f);if(d)M.photos.push(d)}redrawMedia()}
 if(t.id==='mediaVideo'){const f=t.files[0];if(!f)return;if(f.size>1.5*1024*1024){toast('O vídeo deve ter até 1,5 MB nesta demonstração');t.value='';return}const r=new FileReader();r.onload=()=>{M.video=r.result;redrawMedia()};r.readAsDataURL(f)}});
window.addMedia=p=>{const g=document.querySelector('.detail-gallery');if(!g||!((p.photos&&p.photos.length>1)||p.video))return;g.insertAdjacentHTML('afterend',(p.photos&&p.photos.length>1?'<div class="gallery-strip">'+p.photos.map((s,i)=>'<img src="'+s+'" data-cm="ph" alt="Foto '+(i+1)+'">').join('')+'</div>':'')+(p.video?'<video class="gallery-video" src="'+p.video+'" controls playsinline preload="metadata"></video>':''))};

/* ---------- Comunidade ---------- */
const mine=u=>{if(u.role==='owner')return props().filter(p=>p.ownerEmail===u.email);if(u.role==='agent'){const ids=L('inter_property_agents').filter(a=>a.agentEmail===u.email&&a.status==='approved').map(a=>String(a.propertyId));return props().filter(p=>p.ownerEmail===u.email||ids.includes(String(p.id)))}return[]};
const matches=(q,p)=>q.status==='open'&&norm(p.municipality)===norm(q.municipality)&&tip(p.bedrooms)===q.tipologia&&(q.category==='all'||p.category===q.category);
const sameBairro=(q,p)=>{const a=norm(q.neighborhood),b=norm(p.neighborhood);return a&&b&&(a.includes(b)||b.includes(a))};
const offerOf=(q,p,u)=>L(OF).find(o=>o.requestId===q.id&&String(o.propertyId)===String(p.id)&&o.byEmail===u.email);
const pending=u=>{if(!u||u.role==='client'||u.role==='admin')return[];const ps=mine(u),out=[];L(RQ).forEach(q=>ps.forEach(p=>{if(matches(q,p)&&!offerOf(q,p,u))out.push({q,p})}));return out};
const unseen=u=>L(OF).filter(o=>L(RQ).some(q=>q.id===o.requestId&&q.clientEmail===u.email)&&o.status==='accepted').length-Number(localStorage.getItem('inter_cm_seen_'+u.email)||0);
const badgeN=u=>!u?0:u.role==='client'?Math.max(0,unseen(u)):pending(u).length;
window.communityBadge=()=>{const n=badgeN(me());return n?' ('+n+')':''};
window.communityNotify=()=>{const u=me(),n=badgeN(u);if(n)toast(u.role==='client'?n+' resposta(s) nova(s) aos seus pedidos':n+' pedido(s) da comunidade à procura de um imóvel como o seu')};
const hd=(t,d)=>'<div class="role-content-head"><div><h2>'+t+'</h2><p>'+d+'</p></div></div>';
const reqInfo=q=>esc(catName[q.category]||'Imóvel')+' · '+esc(q.tipologia)+' · '+esc(q.neighborhood)+', '+esc(q.municipality)+(q.budget?' · até '+money(q.budget)+' Kz':'');

function clientView(u){
 const reqs=L(RQ).filter(q=>q.clientEmail===u.email),offers=L(OF).filter(o=>o.status==='accepted');
 localStorage.setItem('inter_cm_seen_'+u.email,String(offers.filter(o=>reqs.some(q=>q.id===o.requestId)).length));
 const form='<form class="role-panel role-form" id="communityForm"><h3 class="role-field full">Publicar um pedido na comunidade</h3><div class="role-field"><label>O que procura?</label><select name="category"><option value="rent">Arrendar</option><option value="sale">Comprar</option><option value="commercial">Espaço comercial</option></select></div><div class="role-field"><label>Tipologia</label><select name="tipologia"><option>T0</option><option>T1</option><option selected>T2</option><option>T3</option><option>T4+</option></select></div><div class="role-field"><label>Município</label><input name="municipality" required placeholder="Ex.: Talatona"></div><div class="role-field"><label>Bairro</label><input name="neighborhood" required placeholder="Ex.: Benfica"></div><div class="role-field"><label>Orçamento máximo (Kz, opcional)</label><input name="budget" type="number" min="0"></div><div class="role-field full"><label>Mensagem (opcional)</label><textarea name="message" placeholder="Conte o que é importante para si"></textarea></div><div class="role-form-actions"><button class="primary-button">Publicar pedido →</button></div></form>';
 const list=reqs.length?'<div class="role-list">'+reqs.map(q=>{const os=offers.filter(o=>o.requestId===q.id),ids=[...new Set(os.map(o=>String(o.propertyId)))];
  return '<article class="cm-card"><div class="cm-top"><div><strong>'+reqInfo(q)+'</strong><small>'+(q.status==='open'?(os.length?os.length+' aceitação(ões)':'À espera de respostas'):'Pedido fechado')+'</small></div>'+(q.status==='open'?'<button class="tiny-button danger" data-cm="close" data-rid="'+q.id+'">Fechar</button>':'')+'</div>'+ids.map(id=>{const p=props().find(x=>String(x.id)===id);if(!p)return'';const who=os.filter(o=>String(o.propertyId)===id);return '<div class="role-row"><img class="role-thumb" src="'+esc(p.image)+'" alt=""><div><strong>'+esc(p.title)+'</strong><small>'+esc(p.neighborhood)+' · '+money(p.price)+' Kz</small><small>'+who.map(o=>'✓ '+(o.role==='owner'?'Proprietário':'Intermediário')+' '+esc(o.byName)).join(' · ')+'</small></div><div class="role-row-actions"><button class="tiny-button" data-cm="visit" data-pid="'+esc(p.id)+'">Agendar visita</button></div></div>'}).join('')+'</article>'}).join('')+'</div>':'<div class="role-empty"><b>Ainda não publicou pedidos</b>Descreva o imóvel que procura e receba respostas.</div>';
 return hd('Comunidade','Diga o que procura. Proprietários e intermediários com imóveis compatíveis são avisados e respondem.')+form+'<h3 class="cm-sub">Os meus pedidos</h3>'+list}

function proView(u){
 const ps=mine(u),all=[];L(RQ).forEach(q=>ps.forEach(p=>{if(matches(q,p))all.push({q,p,o:offerOf(q,p,u)})}));
 const todo=all.filter(x=>!x.o),done=all.filter(x=>x.o&&x.o.status==='accepted');
 const row=(x,act)=>'<article class="role-row"><img class="role-thumb" src="'+esc(x.p.image)+'" alt=""><div><strong>'+reqInfo(x.q)+'</strong><small>Cliente '+esc(String(x.q.clientName||'').split(' ')[0])+(x.q.message?' · “'+esc(x.q.message)+'”':'')+'</small><small>O seu imóvel: '+esc(x.p.title)+(sameBairro(x.q,x.p)?' · mesmo bairro ✓':'')+'</small></div><div class="role-row-actions">'+act+'</div></article>';
 const empty=ps.length?'Quando um cliente procurar um imóvel como os seus, aparece aqui.':(u.role==='owner'?'Publique um imóvel (aprovado) para receber pedidos.':'Precisa de imóveis vinculados e autorizados para receber pedidos.');
 return hd('Pedidos da comunidade','Clientes à procura de imóveis compatíveis com os seus anúncios. Cada um aceita por si.')+'<h3 class="cm-sub">Novos pedidos'+(todo.length?' ('+todo.length+')':'')+'</h3>'+(todo.length?'<div class="role-list">'+todo.map(x=>row(x,'<button class="tiny-button" data-cm="accept" data-rid="'+x.q.id+'" data-pid="'+esc(x.p.id)+'">Aceitar</button><button class="tiny-button danger" data-cm="ignore" data-rid="'+x.q.id+'" data-pid="'+esc(x.p.id)+'">Ignorar</button>')).join('')+'</div>':'<div class="role-empty"><b>Sem pedidos novos</b>'+empty+'</div>')+(done.length?'<h3 class="cm-sub">Aceites por si</h3><div class="role-list">'+done.map(x=>row(x,'<span class="status-pill ok">Aceite</span>')).join('')+'</div>':'')}
window.communityPanel=u=>u.role==='client'?clientView(u):proView(u);

const refresh=()=>{window.__roles.renderPanel();const b=document.querySelector('[data-panel="community"]');if(b)b.textContent='Comunidade'+window.communityBadge()};
document.addEventListener('click',e=>{const el=e.target.closest('[data-cm]');if(!el)return;const a=el.dataset.cm,u=me(),M=window.__media;
 if(a==='ph'){const m=document.querySelector('.detail-gallery img');if(m)m.src=el.src;return}
 if(a==='rmphoto'){M.photos.splice(+el.dataset.i,1);redrawMedia();return}
 if(a==='rmvideo'){M.video='';redrawMedia();return}
 if(!u)return;
 if(a==='accept'||a==='ignore'){const of=L(OF);of.push({id:'of-'+Date.now(),requestId:el.dataset.rid,propertyId:el.dataset.pid,byEmail:u.email,byName:u.name,role:u.role,status:a==='accept'?'accepted':'declined',at:new Date().toISOString()});S(OF,of);toast(a==='accept'?'Aceitou. O cliente já pode agendar a visita.':'Pedido ignorado');refresh()}
 if(a==='close'){S(RQ,L(RQ).map(q=>q.id===el.dataset.rid?{...q,status:'closed'}:q));refresh()}
 if(a==='visit'){const D=window.marketplaceData,id=el.dataset.pid;if(!D.properties.some(x=>String(x.id)===id)){const p=props().find(x=>String(x.id)===id);if(!p)return;const {privateAddress,privatePoint,ownerEmail,ownerName,ownerId,status,documentName,createdAt,...pub}=p;D.properties.push(pub)}const back=document.getElementById('backToMarket');if(back)back.click();const pid=D.properties.find(x=>String(x.id)===id).id;D.openDetail(pid)}});
document.addEventListener('submit',e=>{if(e.target.id!=='communityForm')return;e.preventDefault();const u=me(),f=new FormData(e.target);if(!u)return;const rq=L(RQ);rq.unshift({id:'rq-'+Date.now(),clientEmail:u.email,clientName:u.name,category:f.get('category'),tipologia:f.get('tipologia'),municipality:String(f.get('municipality')).trim(),neighborhood:String(f.get('neighborhood')).trim(),budget:Number(f.get('budget')||0),message:String(f.get('message')||'').trim(),status:'open',createdAt:new Date().toISOString()});S(RQ,rq);toast('Pedido publicado. Os profissionais compatíveis foram avisados.');refresh()});
if(window.Api?.enabled()){
 const responseRows=response=>Array.isArray(response)?response:Array.isArray(response?.data)?response.data:Array.isArray(response?.data?.data)?response.data.data:[];
 const syncCommunity=async()=>{const rows=responseRows(await Api.community.list());const requests=[],offers=[];rows.forEach(q=>{requests.push({id:q.id,clientEmail:q.client_email||q.client?.email,clientName:q.client_name||q.client?.name,category:q.category,tipologia:q.tipologia,municipality:q.municipality,neighborhood:q.neighborhood,budget:Number(q.budget||0),message:q.message||'',status:q.status,createdAt:q.created_at});(q.offers||[]).forEach(o=>offers.push({id:o.id,requestId:o.request_id||q.id,propertyId:o.property_id,byEmail:o.by_email||o.agent?.email||o.owner?.email,byName:o.by_name||o.agent?.name||o.owner?.name,role:o.role,status:o.status,at:o.created_at}))});S(RQ,requests);S(OF,offers)};
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='communityForm')return;e.preventDefault();e.stopImmediatePropagation();
  if(!Api.getToken()){toast('Entre na sua conta para publicar um pedido');return}
  const form=e.target,fd=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await Api.community.create({category:fd.get('category'),tipologia:fd.get('tipologia'),municipality:String(fd.get('municipality')).trim(),neighborhood:String(fd.get('neighborhood')).trim(),budget:Number(fd.get('budget')||0),message:String(fd.get('message')||'').trim()});await syncCommunity();toast('Pedido enviado à comunidade');refresh()}
  catch(error){toast('Não foi possível publicar o pedido: '+error.message);button.disabled=false}
 },true);
 document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-cm="accept"],[data-cm="ignore"],[data-cm="close"]');if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(!Api.getToken()){toast('Entre na sua conta para responder');return}
  try{if(button.dataset.cm==='close')await Api.community.close(button.dataset.rid);else await Api.community.respond(button.dataset.rid,button.dataset.pid,button.dataset.cm==='accept');await syncCommunity();toast(button.dataset.cm==='close'?'Pedido fechado':'Resposta enviada à API');refresh()}
  catch(error){toast('Não foi possível actualizar o pedido: '+error.message)}
 },true);
}
