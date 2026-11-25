const KEY={users:'inter_users',current:'inter_current',properties:'inter_custom_properties',agents:'inter_property_agents',availability:'inter_availability',visits:'inter_visits',fee:'inter_visit_fee'};
const $=s=>document.querySelector(s); const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=(k,fallback=[])=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const getUsers=()=>load(KEY.users);const getProps=()=>load(KEY.properties);const getAgents=()=>load(KEY.agents);const getVisits=()=>load(KEY.visits);function uniqueTrackingCode(){let code;do{code='AGT-'+Math.floor(100+Math.random()*900)}while(getAgents().some(a=>a.trackingCode===code));return code}let current=window.Api?.enabled()?null:load(KEY.current,null);let activePanel='overview';let currentPanel='';let photoData='';let phoneVerification={id:'',requestedPhone:'',verifiedPhone:''};
const roleNames={client:'Cliente',owner:'Proprietário',agent:'Intermediário',admin:'Administrador'};
const fee=()=>Number(localStorage.getItem(KEY.fee)||3000);
const money=n=>new Intl.NumberFormat('pt-AO',{maximumFractionDigits:0}).format(Number(n)||0);
function toastMsg(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastMsg.timer);toastMsg.timer=setTimeout(()=>t.classList.remove('show'),2800)}
function openAccess(mode='register'){drawAccess(mode);$('#overlay').classList.add('open');$('#overlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden'}
function drawAccess(mode){
 const register=mode==='register';
 const registrationFields=register?`
  <div class="role-field"><label>Telefone (+244)</label><input name="phone" required placeholder="+244 9xx xxx xxx"></div>
  <div class="role-field"><label>NIF <span class="optional-label">(opcional)</span></label><input name="nif" placeholder="Número de identificação fiscal"></div>
  <div class="role-field full"><label>Perfil</label><select name="role" id="signupRole"><option value="client">Cliente — pesquisar e agendar visitas</option><option value="owner">Proprietário — publicar e gerir imóveis</option><option value="agent">Intermediário — gerir imóveis e visitas</option></select></div>
  <div class="role-field full" id="docField"><label>BI / documento de identificação</label><input type="file" name="document" accept="image/*,.pdf"><p class="role-help">Necessário para validação manual de proprietários e intermediários.</p></div>
 `:'';
 $('#dialogContent').innerHTML=`
  <div class="dialog-inner">
   <p class="eyebrow">INTERMEDIÁRIUS · CONTA SEGURA</p>
   <div class="login-tabs"><button class="${!register?'active':''}" data-access="login">Entrar</button><button class="${register?'active':''}" data-access="register">Criar conta</button></div>
   <h2 class="dialog-title" id="dialogTitle">${register?'Crie a sua conta':'Bem-vindo de volta'}</h2>
   <p class="dialog-subtitle">${register?'Um registo para cada perfil do ecossistema imobiliário.':'Aceda ao seu perfil e às suas ferramentas.'}</p>
   <form id="accessForm" class="role-form">
    ${register?'<div class="role-field full"><label>Nome completo</label><input name="name" required autocomplete="name" placeholder="O seu nome"></div>':''}
    <div class="role-field full"><label>E-mail</label><input name="email" type="email" required autocomplete="email" placeholder="nome@email.com"></div>
    ${registrationFields}
    <div class="role-field full"><label>Palavra-passe</label><input name="password" type="password" required minlength="6" autocomplete="${register?'new-password':'current-password'}" placeholder="Mínimo 6 caracteres"></div>
    <div class="role-form-actions"><button type="submit" class="primary-button">${register?'Criar conta':'Entrar'} →</button></div>
   </form>
   <p class="role-note">Protótipo navegável: os registos e documentos ficam apenas neste navegador. O armazenamento seguro e a autenticação real requerem o backend e o storage privado definidos na especificação.</p>
  </div>`;
 $('#dialogContent').querySelectorAll('[data-access]').forEach(button=>button.onclick=()=>drawAccess(button.dataset.access));
 const form=$('#accessForm');
 form.onsubmit=async event=>{
  event.preventDefault();
  const fd=new FormData(form),email=String(fd.get('email')).trim().toLowerCase(),password=String(fd.get('password'));
  if(register){
   const role=String(fd.get('role')||'');
   if(!['client','owner','agent'].includes(role)){toastMsg('Selecione um perfil disponível para criar a conta.');return}
   const users=getUsers();
   if(users.some(user=>user.email===email)){toastMsg('Este e-mail já tem conta');return}
   const doc=form.querySelector('[name=document]').files[0];
   if((role==='owner'||role==='agent')&&!doc){toastMsg('Anexe o BI/NIF para validar este perfil');return}
   const user={id:'u-'+Date.now(),name:String(fd.get('name')).trim(),email,phone:String(fd.get('phone')||''),nif:String(fd.get('nif')||''),role,password,documentName:doc?doc.name:'',status:role==='client'?'active':'pending_review',createdAt:new Date().toISOString()};
   users.push(user);save(KEY.users,users);setCurrent(user);closeAccess();toastMsg(role==='client'?'Conta criada com sucesso':'Conta criada · validação de BI/NIF pendente');openWorkspace();
  }else{
   const user=getUsers().find(item=>item.email===email&&item.password===password);
   if(!user){toastMsg('E-mail ou palavra-passe incorrectos');return}
   setCurrent(user);closeAccess();openWorkspace();
  }
 };
}
const legacyDrawAccess=drawAccess;
drawAccess=function(mode){legacyDrawAccess(mode);if(mode==='register'&&window.Api?.enabled())setupPhoneVerification($('#accessForm'))};
function normalizeAOPhoneForVerification(value){let digits=String(value||'').replace(/\D/g,'');if(digits.length===9&&digits[0]==='9')digits='244'+digits; if(!/^2449\d{8}$/.test(digits))return'';return '+244 '+digits.slice(3,6)+' '+digits.slice(6,9)+' '+digits.slice(9)}
function setupPhoneVerification(form){const phone=form.querySelector('[name="phone"]'),submit=form.querySelector('button[type="submit"]'),phoneField=phone.closest('.role-field'),status=document.createElement('p'),requestButton=document.createElement('button'),codeField=document.createElement('div');status.className='role-help';status.setAttribute('aria-live','polite');requestButton.type='button';requestButton.className='secondary-button';requestButton.textContent='Enviar código Ombala';phoneField.append(requestButton,status);codeField.className='role-field full hidden';codeField.innerHTML='<label for="phoneVerificationCode">Código de verificação</label><div class="role-row-actions"><input id="phoneVerificationCode" name="otp_code" inputmode="numeric" autocomplete="one-time-code" placeholder="Código recebido"><button type="button" class="secondary-button" id="verifyPhoneCode">Verificar</button></div>';phoneField.after(codeField);const code=form.querySelector('#phoneVerificationCode'),verifyButton=form.querySelector('#verifyPhoneCode');let busy=false;function refresh(){const normalized=normalizeAOPhoneForVerification(phone.value);if(phoneVerification.id&&normalized!==phoneVerification.requestedPhone){phoneVerification={id:'',requestedPhone:'',verifiedPhone:''};codeField.classList.add('hidden');code.value=''}const verified=!!normalized&&phoneVerification.id&&phoneVerification.verifiedPhone===normalized;requestButton.disabled=busy||!normalized;verifyButton.disabled=busy||!phoneVerification.id||!code.value.trim();submit.disabled=!verified;if(verified)status.textContent='Telefone verificado. Pode criar a conta.';else if(phoneVerification.id&&normalized===phoneVerification.requestedPhone)status.textContent='Código enviado via Ombala. Introduza-o para verificar o telefone.';else if(phone.value&&!normalized)status.textContent='Introduza um número móvel angolano válido, por exemplo +244 923 000 000.';else status.textContent='Peça um código de verificação enviado via Ombala.'}phone.addEventListener('input',refresh);code.addEventListener('input',refresh);requestButton.onclick=async()=>{const normalized=normalizeAOPhoneForVerification(phone.value);if(!normalized){refresh();return}busy=true;phoneVerification={id:'',requestedPhone:normalized,verifiedPhone:''};codeField.classList.add('hidden');code.value='';status.textContent='A pedir código de verificação...';refresh();try{const result=window.Api.resource(await window.Api.auth.phoneVerifications.request({phone:normalized})),id=result?.verification_id;if(!id)throw new Error('A API não devolveu verification_id.');if(normalizeAOPhoneForVerification(phone.value)!==normalized)throw new Error('O número foi alterado durante o pedido. Peça outro código.');phoneVerification={id:String(id),requestedPhone:normalized,verifiedPhone:''};codeField.classList.remove('hidden');status.textContent='Código enviado via Ombala. Introduza-o para verificar o telefone.';code.focus()}catch(error){phoneVerification={id:'',requestedPhone:'',verifiedPhone:''};toastMsg('Não foi possível pedir o código Ombala: '+error.message);status.textContent='Não foi possível pedir o código. Verifique o número e tente novamente.'}finally{busy=false;refresh()}};verifyButton.onclick=async()=>{const normalized=normalizeAOPhoneForVerification(phone.value),verificationId=phoneVerification.id;if(!verificationId||normalized!==phoneVerification.requestedPhone||!code.value.trim()){refresh();return}busy=true;refresh();try{const result=window.Api.resource(await window.Api.auth.phoneVerifications.verify({verification_id:verificationId,code:code.value.trim()}));if(result?.verified!==true)throw new Error(result?.message||'A API não confirmou a verificação do telefone.');if(result.verification_id&&String(result.verification_id)!==verificationId)throw new Error('A API devolveu uma verificação diferente da solicitada.');if(phoneVerification.id!==verificationId||normalizeAOPhoneForVerification(phone.value)!==normalized)throw new Error('O número foi alterado durante a verificação. Peça outro código.');phoneVerification.verifiedPhone=normalized;status.textContent='Telefone verificado. Pode criar a conta.';codeField.classList.add('hidden')}catch(error){toastMsg('Não foi possível validar o código: '+error.message);status.textContent='Código não validado. Confirme o código e tente novamente.'}finally{busy=false;refresh()}};refresh()}
function isPhoneVerificationComplete(form){const normalized=normalizeAOPhoneForVerification(form.querySelector('[name="phone"]')?.value);return !!normalized&&!!phoneVerification.id&&phoneVerification.verifiedPhone===normalized}
function closeAccess(){$('#overlay').classList.remove('open');$('#overlay').setAttribute('aria-hidden','true');document.body.style.overflow=''}
function setCurrent(user){current=user;save(KEY.current,user);if(window.Api?.enabled()){window.__apiRentalsLoaded=false;window.__apiCommissionsLoaded=false}refreshHeader()}
function refreshHeader(){if(!current){$('#profileButton').classList.remove('signed-in');$('#profileButton .avatar').textContent='A';$('#profileButton .profile-name').textContent='Entrar / Criar conta';return}$('#profileButton').classList.add('signed-in');$('#profileButton .avatar').textContent=(current.name||'A').trim().charAt(0).toUpperCase();$('#profileButton .profile-name').textContent=current.name.split(' ')[0]+' · '+roleNames[current.role]}
function openWorkspace(panel='overview'){if(!current){openAccess('register');return}activePanel=panel;$('.page-shell').hidden=true;$('#roleMount').hidden=false;$('#roleMount').innerHTML='<div class="page-shell role-shell"><div class="role-header"><div class="role-heading"><p class="eyebrow"><span class="live-dot"></span> ÁREA DE '+esc(roleNames[current.role].toUpperCase())+'</p><h1>'+esc(greeting())+'</h1><p>Ferramentas e actividade da sua conta.</p></div><div class="role-actions"><button class="secondary-button" id="backToMarket">← Explorar imóveis</button><button class="secondary-button" id="signOut">Sair da conta</button></div></div><div class="role-layout"><aside class="role-sidebar"><div class="role-user"><span class="avatar">'+esc((current.name||'A')[0].toUpperCase())+'</span><div><strong>'+esc(current.name)+'</strong><small>'+esc(roleNames[current.role])+'</small></div></div><nav class="role-menu">'+menuItems().map(x=>'<button data-panel="'+x.id+'" class="'+(activePanel===x.id?'active':'')+'">'+x.label+'</button>').join('')+'</nav></aside><section class="role-content" id="roleContent"></section></div><p class="role-note">Modo de demonstração local. Aprovações, dados e documentos não são partilhados entre dispositivos nem protegidos por um servidor nesta versão.</p></div>';renderPanel();window.communityNotify&&window.communityNotify();$('#roleMount').onclick=handleWorkspaceClick;$('#roleMount').onsubmit=handleWorkspaceSubmit;$('#signOut').onclick=()=>{localStorage.removeItem(KEY.current);current=null;refreshHeader();leaveWorkspace()};$('#backToMarket').onclick=leaveWorkspace}
function greeting(){let hour=new Date().getHours();return (hour<12?'Bom dia, ':hour<18?'Boa tarde, ':'Boa noite, ')+(current.name||'').split(' ')[0]}
function menuItems(){let items={client:[['overview','Visão geral'],['visits','As minhas visitas'],['contracts','Contratos'],['profile','O meu perfil']],owner:[['overview','Visão geral'],['properties','Os meus imóveis'],['create','Cadastrar imóvel'],['agents','Intermediários'],['visits','Visitas'],['leases','Arrendamentos'],['commissions','Comissões']],agent:[['overview','Visão geral'],['properties','Imóveis'],['create','Cadastrar imóvel'],['agents','Intermediários'],['availability','Disponibilidade'],['checkin','Check-in presencial'],['visits','Visitas'],['commissions','Comissões']],admin:[['overview','Visão geral'],['accounts','Validar contas'],['properties','Moderar imóveis'],['payments','Pagamentos GPO'],['settings','Configurações']]};if(current.role!=='admin')(items[current.role]||items.client).push(['community','Comunidade'+(window.communityBadge?window.communityBadge():'')]);return (items[current.role]||items.client).map(x=>({id:x[0],label:x[1]}))}
function statsCard(label,value){return '<div class="stat-card"><small>'+label+'</small><strong>'+value+'</strong></div>'}
function renderPanel(){let c=$('#roleContent');if(!c)return;c.innerHTML=current.role==='owner'?ownerPanel():current.role==='agent'?agentPanel():current.role==='admin'?adminPanel():clientPanel();if(window.Api?.enabled()){const note=$('#roleMount .role-shell > .role-note');if(note)note.textContent='A sessão e os dados da conta são carregados pela API configurada.'}}
function head(title,desc,badge=''){return '<div class="role-content-head"><div><h2>'+title+'</h2><p>'+desc+'</p></div>'+(badge?'<span class="status-pill '+badge.kind+'">'+badge.text+'</span>':'')+'</div>'}
function myProperties(){return getProps().filter(p=>p.ownerEmail===current.email)}
function myAgentLinks(){return getAgents().filter(a=>a.agentEmail===current.email)}
function ownedVisitList(){let ids=myProperties().map(p=>String(p.id));return getVisits().filter(v=>ids.includes(String(v.propertyId)))}
function contractList(view='client'){let list=load('inter_rent_contracts');if(view==='client')list=list.filter(c=>!c.tenantEmail||c.tenantEmail===current.email);if(view==='owner')list=list.filter(c=>!c.ownerEmail||c.ownerEmail===current.email);if(!list.length)return '<div class="role-empty"><b>Ainda sem contratos de arrendamento</b>Quando a primeira renda for confirmada pela GPO, o contrato aparece aqui.</div>';return '<div class="role-list">'+list.map(c=>'<article class="role-contract-row"><div><strong>'+esc(c.title)+'</strong><small>'+esc(c.number)+' · Arrendatário: '+esc(c.tenant)+' · '+money(c.totalPaid)+' Kz pagos via GPO · '+new Date(c.paidAt).toLocaleDateString('pt-AO')+'</small></div><button class="tiny-button" data-view-contract="'+esc(c.id)+'">Ver contrato</button></article>').join('')+'</div>'}
const legacyContractList=contractList;
contractList=function(view='client'){if(window.Api?.enabled()&&!window.__apiRentalsLoaded)return '<div class="role-empty">A carregar arrendamentos da API...</div>';return legacyContractList(view)}
function commissionPanel(view){let list=load('inter_agent_commissions');list=list.filter(c=>view==='owner'?c.ownerEmail===current.email:c.agentEmail===current.email);if(!list.length)return '<div class="role-empty"><b>Sem comissões de arrendamento</b>As comissões de intermediário são pagas pelo proprietário e nunca cobradas ao cliente.</div>';return '<div class="role-panel"><div class="role-list">'+list.map(c=>'<div class="commission-row"><div><b>'+esc(c.propertyTitle)+'</b><small>'+ (view==='owner'?'Intermediário: '+esc(c.agentName):'Proprietário: '+esc(c.ownerName))+' · '+c.rate+'% da primeira renda</small></div><div style="text-align:right"><strong>'+money(c.amount)+' Kz</strong><small>'+ (c.status==='paid'?'Liquidada pela GPO (demo)':'Paga pelo proprietário')+'</small>'+(view==='owner'&&c.status==='due'?'<button class="tiny-button" data-action="settle-commission" data-id="'+esc(c.id)+'">Liquidar via GPO →</button>':'')+'</div></div>').join('')+'</div><p class="role-help">A comissão do intermediário é uma obrigação do proprietário. Não é incluída na renda nem cobrada ao arrendatário.</p></div>'}
function ownerPanel(){if(activePanel==='community')return window.communityPanel(current);let props=myProperties(),auth=getAgents().filter(a=>a.ownerEmail===current.email),visits=ownedVisitList();if(activePanel==='create')return head('Cadastrar imóvel','Registe o imóvel em nome do proprietário. O anúncio segue para revisão administrativa.')+createPropertyForm();if(activePanel==='properties')return head('Os meus imóveis','Gerir anúncios submetidos e respectivo estado.')+propertiesList(props,true);if(activePanel==='agents')return head('Intermediários autorizados','Convide, autorize ou revogue intermediários nos seus imóveis.')+agentInviteForm(props)+agentList(auth,'owner');if(activePanel==='visits')return head('Visitas aos seus imóveis','Acompanhe visitas pagas e o respectivo estado.')+visitList(visits);if(activePanel==='commissions')return head('Comissão do intermediário','A comissão acordada é da responsabilidade do proprietário, nunca do arrendatário.')+commissionPanel('owner');if(activePanel==='leases')return head('Arrendamentos e contratos','Primeira renda paga pela GPO e contratos emitidos.')+contractList('owner');let pending=props.filter(p=>p.status==='pending_review').length;return head('Painel do proprietário','Gestão de anúncios e autorizações.',{text:current.status==='active'?'Conta verificada':'BI/NIF em validação',kind:current.status==='active'?'active':'pending'})+'<div class="role-stats">'+statsCard('Imóveis cadastrados',props.length)+statsCard('Aguardam aprovação',pending)+statsCard('Visitas pagas',visits.filter(v=>v.paid).length)+'</div><div class="role-hero"><div><strong>O seu imóvel, sob o seu controlo.</strong><span>Cadastre anúncios e escolha os intermediários autorizados.</span></div><span class="role-hero-mark">⌂</span></div><div class="role-panel"><h3>Atalhos</h3><div class="role-row-actions" style="justify-content:flex-start"><button class="primary-button" data-panel="create">+ Cadastrar imóvel</button><button class="secondary-button" data-panel="agents">Autorizar intermediário</button></div></div>'+propertiesList(props.slice(0,3),false)}
function createPropertyForm(){return '<div class="role-notice">Proprietários e intermediários podem cadastrar imóveis. Cada imóvel só pode ser publicado uma vez; depois podem ser vinculados até 5 intermediários. Após submeter, o anúncio fica pendente de aprovação.</div><form class="role-panel role-form" id="propertyForm"><div class="role-field full"><label>Título do anúncio</label><input name="title" required placeholder="Ex.: Apartamento T3 com varanda"></div><div class="role-field"><label>Categoria</label><select name="category"><option value="rent">Arrendamento</option><option value="sale">Compra / venda</option><option value="commercial">Comercial</option></select></div><div class="role-field"><label>Tipo de imóvel</label><select name="type"><option>Apartamento</option><option>Vivenda</option><option>Quarto</option><option>Loja</option><option>Escritório</option><option>Armazém</option><option>Terreno</option></select></div><div class="role-field"><label>Preço (Kz)</label><input name="price" type="number" min="1" required placeholder="180000"></div><div class="role-field"><label>Província</label><select name="province"><option>Luanda</option><option>Benguela</option><option>Huíla</option><option>Huambo</option><option>Namibe</option><option>Cabinda</option><option>Outra</option></select></div><div class="role-field"><label>Município</label><input name="municipality" required placeholder="Talatona"></div><div class="role-field"><label>Bairro</label><input name="neighborhood" required placeholder="Talatona"></div><div class="role-field"><label>Quartos</label><input name="bedrooms" type="number" min="0" value="2"></div><div class="role-field"><label>Casas de banho</label><input name="baths" type="number" min="0" value="1"></div><div class="role-field"><label>Área (m²)</label><input name="area" type="number" min="1" placeholder="100"></div><div class="role-field full"><label>Morada exacta (privada)</label><input name="privateAddress" required placeholder="Rua, número, condomínio"></div><div class="role-field full"><label>Pino exacto · latitude e longitude (privado)</label><div class="role-form"><input name="privatePoint" required placeholder="-8.8390, 13.2894" aria-label="Coordenadas exactas"><div class="pin-picker" aria-hidden="true">⌖</div></div><p class="role-help">No MVP real, a morada e coordenadas exactas ficam no servidor e são ocultadas até ao pagamento. Aqui o campo é apenas uma demonstração local.</p></div><div class="role-field full"><label>Descrição</label><textarea name="description" required placeholder="Descreva o imóvel e os seus pontos fortes"></textarea></div><div class="role-field full"><label>Comodidades (separadas por vírgula)</label><input name="amenities" placeholder="Varanda, segurança 24h, estacionamento"></div>'+window.mediaField()+'<div class="role-form-actions"><button type="button" class="secondary-button" data-panel="properties">Cancelar</button><button class="primary-button" type="submit">Submeter para aprovação →</button></div></form>'}
function propertiesList(list,manage){if(!list.length)return '<div class="role-empty"><b>Ainda não há imóveis</b>Cadastre um imóvel para começar.</div>';return '<div class="role-list">'+list.map(p=>'<article class="role-row"><img class="role-thumb" src="'+esc(p.image||'assets/imovel-1.png')+'" alt=""><div><strong>'+esc(p.title)+'</strong><small>'+esc(p.municipality)+' · '+money(p.price)+' Kz · '+statusText(p.status)+'</small></div><div class="role-row-actions"><span class="status-pill '+statusKind(p.status)+'">'+statusText(p.status)+'</span>'+(manage&&p.status!=='active'?'<button class="tiny-button danger" data-action="delete-property" data-id="'+p.id+'">Remover</button>':'')+'</div></article>').join('')+'</div>'}
function statusText(s){return ({pending_review:'Em revisão',active:'Publicado',rejected:'Rejeitado',rented:'Arrendado',sold:'Vendido',pending:'Pendente',pending_payment:'Aguardando pagamento',paid:'Pago',failed:'Falhou',cancelled:'Cancelado',expired:'Expirado',approved:'Autorizado',revoked:'Revogado',completed:'Concluída',scheduled:'Agendada'})[s]||s||'Pendente'}function statusKind(s){return s==='active'||s==='approved'||s==='completed'||s==='paid'?'active':s==='rejected'||s==='revoked'||s==='failed'||s==='cancelled'||s==='expired'?'rejected':'pending'}
function agentInviteForm(props){return '<form class="role-panel role-form" id="agentInviteForm"><h3 class="role-field full">Convidar intermediário</h3><div class="role-field"><label>Imóvel</label><select name="propertyId" required>'+props.map(p=>'<option value="'+p.id+'">'+esc(p.title)+'</option>').join('')+'</select></div><div class="role-field"><label>E-mail do intermediário</label><input type="email" name="agentEmail" required placeholder="agente@email.com"></div><div class="role-field"><label>Comissão do intermediário (%)</label><input name="commissionPct" type="number" min="0" max="100" step="0.1" value="5"></div><div class="role-field full"><label>Termos adicionais (opcional)</label><input name="terms" placeholder="Condições acordadas"></div><div class="role-form-actions"><button class="primary-button" type="submit" '+(!props.length?'disabled':'')+'>Enviar autorização →</button></div><p class="role-help role-field full">Será criado um ID de rastreio único para o link do intermediário. A autorização pode ser revogada a qualquer momento.</p></form>'}
function agentList(list,ownerMode){if(!list.length)return '<div class="role-empty"><b>'+ (ownerMode?'Sem intermediários vinculados':'Sem autorizações ainda')+'</b>'+(ownerMode?'Convide um intermediário pelo e-mail da conta.':'Os convites recebidos vão aparecer aqui.')+'</div>';return '<div class="role-list">'+list.map(a=>{let p=getProps().find(x=>String(x.id)===String(a.propertyId));return '<article class="role-row"><span class="host-avatar">'+esc((a.agentName||a.agentEmail||'I')[0].toUpperCase())+'</span><div><strong>'+esc(p?p.title:a.propertyTitle||'Imóvel removido')+'</strong><small>'+esc(a.agentName||a.agentEmail||'Intermediário')+' · ID de rastreio <b class="role-code">'+esc(a.trackingCode||'—')+'</b></small></div><div class="role-row-actions"><span class="status-pill '+statusKind(a.status)+'">'+statusText(a.status)+'</span>'+(ownerMode&&a.status!=='revoked'?'<button class="tiny-button danger" data-action="revoke-agent" data-id="'+a.id+'">Revogar</button>':'')+(!ownerMode&&a.status==='pending'?'<button class="tiny-button" data-action="accept-agent" data-id="'+a.id+'">Aceitar</button><button class="tiny-button danger" data-action="decline-agent" data-id="'+a.id+'">Recusar</button>':'')+(!ownerMode&&a.status==='approved'?'<button class="tiny-button neutral" data-action="copy-ref" data-ref="'+a.trackingCode+'">Copiar link ?ref=</button>':'')+'</div></article>'}).join('')+'</div>'}
function visitList(list){if(!list.length)return '<div class="role-empty"><b>Sem visitas registadas</b>As visitas pagas vão aparecer aqui.</div>';return '<div class="role-list">'+list.map(v=>'<article class="role-row"><img class="role-thumb" src="'+esc(v.image||'assets/imovel-1.png')+'" alt=""><div><strong>'+esc(v.title)+'</strong><small>'+esc(new Date(v.scheduled).toLocaleString('pt-AO',{dateStyle:'medium',timeStyle:'short'}))+' · '+esc(v.agent||'Intermediário')+' · '+(v.paid?'Pagamento confirmado':'Pagamento pendente')+'</small><small>'+(v.paid&&v.code?'Código de visita <b class="role-code">'+esc(v.code)+'</b>':'Código disponível após confirmação do pagamento')+' · '+statusText(v.visitStatus||'scheduled')+'</small></div><span class="status-pill '+(v.paid?'active':'pending')+'">'+(v.paid?'Paga':'Pendente')+'</span></article>').join('')+'</div>'}
function ownerVisitFiltered(){return ownedVisitList()}
function agentPanel(){if(activePanel==='community')return window.communityPanel(current);let links=myAgentLinks(),approved=links.filter(a=>a.status==='approved'),visits=getVisits().filter(v=>v.agentEmail===current.email||v.agent===current.name);if(activePanel==='create')return head('Cadastrar imóvel','Publique um imóvel. O anúncio segue para revisão administrativa.')+createPropertyForm();if(activePanel==='agents'){let mp=myProperties();return head('Intermediários vinculados','Até 5 intermediários por imóvel publicado por si.')+(mp.length?agentInviteForm(mp)+agentList(getAgents().filter(a=>a.ownerEmail===current.email),'owner'):'<div class="role-empty"><b>Sem imóveis publicados</b>Cadastre um imóvel para vincular intermediários.</div>')}if(activePanel==='properties'){let mp=myProperties();return head('Imóveis','Os que publicou e os que os proprietários lhe autorizaram.')+(mp.length?'<h3 class="cm-sub">Publicados por mim</h3>'+propertiesList(mp,true)+'<h3 class="cm-sub">Autorizados por proprietários</h3>':'')+agentList(links,false)}if(activePanel==='availability')return head('Disponibilidade','Configure os dias e horários em que pode receber visitas.')+availabilityForm();if(activePanel==='checkin')return head('Check-in presencial','Valide o código único que o cliente apresenta no local.')+checkinForm();if(activePanel==='visits')return head('As minhas visitas','Agendamentos vinculados ao seu perfil de intermediário.')+visitList(visits);if(activePanel==='commissions')return head('Comissões','Acompanhe os valores devidos pelo proprietário e os pagamentos registados.')+commissionPanel('agent');return head('Painel do intermediário','Autorizações, agenda e validação presencial.',{text:current.status==='active'?'Conta verificada':'BI/NIF em validação',kind:current.status==='active'?'active':'pending'})+'<div class="role-stats">'+statsCard('Imóveis autorizados',approved.length)+statsCard('Autorizações pendentes',links.filter(a=>a.status==='pending').length)+statsCard('Visitas atribuídas',visits.length)+'</div><div class="role-hero"><div><strong>O seu código protege os seus leads.</strong><span>Partilhe o link rastreável associado ao imóvel autorizado.</span></div><span class="role-hero-mark">⌖</span></div>'+agentList(links,false)}
function availabilityForm(){let a=load(KEY.availability,{} )[current.email]||{days:['1','2','3','4','5'],start:'09:00',end:'17:00',slot:60};return '<form class="role-panel role-form" id="availabilityForm"><h3 class="role-field full">Horários semanais</h3><div class="role-field full"><label>Dias disponíveis</label><div class="role-form">'+[['1','Segunda'],['2','Terça'],['3','Quarta'],['4','Quinta'],['5','Sexta'],['6','Sábado'],['0','Domingo']].map(d=>'<label class="role-checkrow"><input type="checkbox" name="days" value="'+d[0]+'" '+(a.days.includes(d[0])?'checked':'')+'>'+d[1]+'</label>').join('')+'</div></div><div class="role-field"><label>Das</label><input type="time" name="start" value="'+a.start+'" required></div><div class="role-field"><label>Até</label><input type="time" name="end" value="'+a.end+'" required></div><div class="role-field"><label>Duração do intervalo</label><select name="slot"><option value="30" '+(a.slot==30?'selected':'')+'>30 minutos</option><option value="60" '+(a.slot==60?'selected':'')+'>60 minutos</option><option value="90" '+(a.slot==90?'selected':'')+'>90 minutos</option></select></div><div class="role-form-actions"><button class="primary-button">Guardar disponibilidade</button></div></form><div class="role-notice">'+(window.Api?.enabled()?'A disponibilidade é guardada na API. Os horários serão usados pelo backend ao agendar visitas.':'Os horários guardados são uma demonstração local.')+'</div>'}
function checkinForm(){return '<form class="role-panel role-form" id="checkinForm"><h3 class="role-field full">Validar código de visita</h3><div class="role-field full"><label>Código fornecido pelo cliente</label><input class="visit-code-input" name="visitCode" required placeholder="INT-8492" autocomplete="off"></div><p class="role-help role-field full">A validação só deve ser feita presencialmente. O cliente recebe o código após o pagamento confirmado.</p><div class="role-form-actions"><button class="primary-button">Confirmar check-in →</button></div></form>'}
function clientPanel(){if(activePanel==='community')return window.communityPanel(current);if(activePanel==='visits'){let visits=getVisits();return head('As minhas visitas','Pagamentos, códigos de visita e localização desbloqueada.')+visitList(visits)}if(activePanel==='contracts')return head('Os meus contratos','Contratos emitidos após confirmação da primeira renda e comissão da plataforma.')+contractList();if(activePanel==='profile')return head('O meu perfil','Dados de registo e estado da verificação.')+'<div class="role-panel"><div class="role-list"><article class="role-row"><span class="host-avatar">'+esc(current.name[0].toUpperCase())+'</span><div><strong>'+esc(current.name)+'</strong><small>'+esc(current.email)+' · '+esc(current.phone||'')+'<br>'+esc(current.nif?'NIF '+current.nif:'Sem NIF registado')+' · BI/NIF '+(current.documentName?'anexado: '+esc(current.documentName):'não anexado')+'</small></div><span class="status-pill '+statusKind(current.status)+'">'+statusText(current.status)+'</span></article></div></div>';return head('Painel do cliente','Favoritos e visitas num só lugar.')+'<div class="role-stats">'+statsCard('Visitas marcadas',getVisits().length)+statsCard('Favoritos',load('inter_favs').length)+statsCard('Perfil','Cliente')+'</div><div class="role-hero"><div><strong>Pronto para encontrar o próximo imóvel?</strong><span>Explore anúncios e agende uma visita com segurança.</span></div><span class="role-hero-mark">⌂</span></div><div class="role-panel"><h3>Acesso rápido</h3><div class="role-row-actions" style="justify-content:flex-start"><button class="primary-button" id="goExplore">Explorar imóveis →</button><button class="secondary-button" data-panel="visits">Ver as minhas visitas</button></div></div>'}
function adminPanel(){let users=getUsers(),props=getProps(),visits=getVisits();if(activePanel==='accounts')return head('Validar contas','Verifique BI/NIF e aprove ou rejeite contas de proprietário e intermediário.')+accountList(users.filter(u=>u.role!=='client'));if(activePanel==='properties')return head('Moderar imóveis','Revise anúncios antes de os disponibilizar ao público.')+adminPropertyList(props);if(activePanel==='payments')return head('Pagamentos GPO','Registo local de taxas de visita e métodos seleccionados.')+paymentReport(visits);if(activePanel==='settings')return head('Configurações da plataforma','Taxa de visita e comissões percentuais do fluxo de arrendamento.')+'<form class="role-panel role-form" id="feeForm"><h3 class="role-field full">Valores e percentagens</h3><div class="role-field"><label>Taxa da visita (Kz)</label><input name="fee" type="number" min="0" value="'+fee()+'" required></div><div class="role-field"><label>Comissão da plataforma sobre a renda (%)</label><input name="platformPct" type="number" min="0" max="100" step="0.1" value="'+(localStorage.getItem('inter_platform_commission_pct')||5)+'" required></div><div class="role-field"><label>Comissão padrão do intermediário, paga pelo proprietário (%)</label><input name="agentPct" type="number" min="0" max="100" step="0.1" value="'+(localStorage.getItem('inter_agent_commission_pct')||5)+'" required></div><div class="role-notice role-field full">Estas percentagens são parâmetros de demonstração. A comissão do intermediário não é adicionada à cobrança do arrendatário.</div><div class="role-form-actions"><button class="primary-button">Guardar configurações</button></div></form>';return head('Painel administrativo','Validação, moderação e auditoria do MVP.')+'<div class="role-stats">'+statsCard('Contas por validar',users.filter(u=>u.status==='pending_review').length)+statsCard('Imóveis em revisão',props.filter(p=>p.status==='pending_review').length)+statsCard('Visitas pagas',visits.filter(v=>v.paid).length)+'</div><div class="role-hero"><div><strong>Fila de moderação</strong><span>Valide identidades e qualidade dos anúncios.</span></div><span class="role-hero-mark">✓</span></div><div class="role-row-actions" style="justify-content:flex-start"><button class="primary-button" data-panel="accounts">Validar contas</button><button class="secondary-button" data-panel="properties">Rever imóveis</button><button class="secondary-button" data-panel="payments">Auditar pagamentos</button></div>'}
function accountList(users){
 if(!users.length)return '<div class="role-empty"><b>Nenhuma conta profissional pendente</b>Novos proprietários e intermediários vão aparecer aqui.</div>';
 return '<div class="role-list">'+users.map(user=>{
  const identity=user.documentName?'BI/NIF: '+user.documentName:'NIF: '+(user.nif||'não informado');
  return '<article class="role-row"><span class="host-avatar">'+esc((user.name||'U')[0].toUpperCase())+'</span><div><strong>'+esc(user.name)+' · '+esc(roleNames[user.role]||user.role)+'</strong><small>'+esc(user.email)+' · '+esc(user.phone||'')+' · '+esc(identity)+'</small></div><div class="role-row-actions"><span class="status-pill '+statusKind(user.status)+'">'+statusText(user.status)+'</span>'+(user.status==='pending_review'?'<button class="tiny-button" data-action="approve-user" data-id="'+esc(user.id)+'">Aprovar</button><button class="tiny-button danger" data-action="reject-user" data-id="'+esc(user.id)+'">Rejeitar</button>':'')+'</div></article>';
 }).join('')+'</div>';
}
function adminPropertyList(properties){
 if(!properties.length)return '<div class="role-empty"><b>Sem imóveis pendentes</b>Novos imóveis enviados para revisão vão aparecer aqui.</div>';
 return '<div class="role-list">'+properties.map(property=>{
  const owner=property.owner?.name||property.owner_name||property.ownerName||'Publicador';
  const image=window.apiMediaUrl?.(property.image||property.image_url)||property.image||'assets/imovel-1.png';
  return '<article class="role-row"><img class="role-thumb" src="'+esc(image)+'" alt=""><div><strong>'+esc(property.title)+'</strong><small>'+esc(owner)+' · '+esc(property.province||'')+' / '+esc(property.municipality||'')+' · '+money(property.price)+' Kz</small></div><div class="role-row-actions"><span class="status-pill '+statusKind(property.status)+'">'+statusText(property.status)+'</span>'+(property.status==='pending_review'?'<button class="tiny-button" data-action="approve-property" data-id="'+esc(property.id)+'">Aprovar</button><button class="tiny-button danger" data-action="reject-property" data-id="'+esc(property.id)+'">Rejeitar</button>':'')+'</div></article>';
 }).join('')+'</div>';
}
function adminPaymentList(payments){
 if(!payments.length)return '<div class="role-empty"><b>Sem pagamentos registados</b>Os pagamentos confirmados e pendentes aparecerão aqui.</div>';
 const purposes={visit:'Visita',rental:'Arrendamento',commission:'Comissão'};
 return '<div class="role-list">'+payments.map(payment=>{
  const date=payment.created_at?new Date(payment.created_at).toLocaleString('pt-AO'):'—';
  return '<article class="role-row"><span class="host-avatar">P</span><div><strong>'+esc(purposes[payment.purpose]||payment.purpose||'Pagamento')+' · '+esc(payment.method||'GPO FACI')+'</strong><small>Referência: '+esc(payment.reference||'—')+' · '+esc(date)+'</small></div><div class="role-row-actions"><strong>'+money(payment.amount)+' '+esc(payment.currency||'AOA')+'</strong><span class="status-pill '+statusKind(payment.status)+'">'+statusText(payment.status)+'</span></div></article>';
 }).join('')+'</div>';
}
function adminSettingsForm(settings){
 return '<form class="role-panel role-form" id="feeForm"><h3 class="role-field full">Valores e percentagens</h3><div class="role-field"><label>Taxa da visita (Kz)</label><input name="fee" type="number" min="0" value="'+Number(settings.visit_fee||0)+'" required></div><div class="role-field"><label>Comissão da plataforma sobre a renda (%)</label><input name="platformPct" type="number" min="0" max="100" step="0.1" value="'+Number(settings.platform_commission_pct||0)+'" required></div><div class="role-field"><label>Comissão padrão do intermediário, paga pelo proprietário (%)</label><input name="agentPct" type="number" min="0" max="100" step="0.1" value="'+Number(settings.agent_commission_pct||0)+'" required></div><div class="role-notice role-field full">Estas percentagens são parâmetros da plataforma. A comissão do intermediário não é adicionada à cobrança do arrendatário.</div><div class="role-form-actions"><button class="primary-button">Guardar configurações</button></div></form>';
}
function paymentReport(visits){let paid=visits.filter(v=>v.paid),visitTotal=paid.reduce((sum,v)=>sum+Number(v.fee||fee()),0),rents=load('inter_rent_transactions'),rentConfirmed=rents.filter(x=>x.status==='confirmed'),rentTotal=rentConfirmed.reduce((s,x)=>s+Number(x.rent||0),0),platformIncome=rentConfirmed.reduce((s,x)=>s+Number(x.platformFee||0),0),commissions=load('inter_agent_commissions'),due=commissions.filter(x=>x.status==='due').reduce((s,x)=>s+Number(x.amount||0),0);return '<div class="role-stats">'+statsCard('Visitas confirmadas',paid.length)+statsCard('Rendas recebidas',money(rentTotal)+' Kz')+statsCard('Comissão da plataforma',money(platformIncome)+' Kz')+'</div><div class="role-panel"><h3>Arrendamentos pagos via GPO</h3>'+(!rentConfirmed.length?'<div class="role-empty"><b>Sem rendas confirmadas</b>Os pagamentos de renda e comissões da plataforma aparecerão aqui após a confirmação GPO.</div>':'<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Referência</th><th>Contrato</th><th>Método</th><th>Renda</th><th>Plataforma</th><th>Total</th><th>Estado</th></tr></thead><tbody>'+rentConfirmed.map(x=>{let c=load('inter_rent_contracts').find(y=>y.id===x.contractId);return '<tr><td>'+esc(x.reference)+'</td><td>'+esc(c?c.number:'—')+'</td><td>'+esc(x.method==='reference'?'Referência':'Multicaixa Express')+'</td><td>'+money(x.rent)+' Kz</td><td>'+money(x.platformFee)+' Kz</td><td>'+money(x.total)+' Kz</td><td>Confirmado</td></tr>'}).join('')+'</tbody></table></div>')+'</div><div class="role-panel"><h3>Taxas de visita e obrigações de comissão</h3><p>Visitas pagas: '+money(visitTotal)+' Kz · Comissão de intermediários devida pelos proprietários: '+money(due)+' Kz</p><p class="role-help">A comissão do intermediário é responsabilidade do proprietário e fica separada do valor cobrado ao arrendatário. Na produção, estes estados devem vir de webhooks GPO verificados.</p></div>'}
function syncPublicListing(propertyId){let p=getProps().find(x=>String(x.id)===String(propertyId));if(!p||p.status!=='active'||!window.marketplaceData)return;let pub=publicListing(p),i=window.marketplaceData.properties.findIndex(x=>String(x.id)===String(propertyId));if(i<0)window.marketplaceData.properties.push(pub);else window.marketplaceData.properties[i]=pub;window.marketplaceData.render()}
function handleWorkspaceClick(e){let btn=e.target.closest('button');if(!btn)return;if(btn.dataset.action==='copy-ref'){let link=location.origin+location.pathname+'?ref='+encodeURIComponent(btn.dataset.ref);if(navigator.clipboard)navigator.clipboard.writeText(link).then(()=>toastMsg('Link rastreável copiado'));else toastMsg(link);return}if(btn.dataset.panel){activePanel=btn.dataset.panel;renderPanel();$('#roleMount').querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===activePanel));return}let action=btn.dataset.action,id=btn.dataset.id;if(!action){if(btn.id==='goExplore'){leaveWorkspace();return}return}if(action==='settle-commission'){let list=load('inter_agent_commissions').map(c=>c.id===id?{...c,status:'paid',paymentMethod:'gpo',paidAt:new Date().toISOString()}:c);save('inter_agent_commissions',list);toastMsg('Liquidação GPO registada (demonstração)')}if(action==='delete-property'){let props=getProps().filter(p=>String(p.id)!==id);save(KEY.properties,props)}if(action==='approve-user'||action==='reject-user'){let users=getUsers().map(u=>u.id===id?{...u,status:action==='approve-user'?'active':'rejected'}:u);save(KEY.users,users)}if(action==='approve-property'||action==='reject-property'){let props=getProps().map(p=>String(p.id)===id?{...p,status:action==='approve-property'?'active':'rejected'}:p);save(KEY.properties,props);if(action==='approve-property'){let p=props.find(x=>String(x.id)===id);if(p&&window.marketplaceData){let pub=publicListing(p);let idx=window.marketplaceData.properties.findIndex(x=>String(x.id)===id);if(idx<0)window.marketplaceData.properties.push(pub);window.marketplaceData.render()}}}if(action==='approve-agent'||action==='revoke-agent'||action==='accept-agent'||action==='decline-agent'){let agents=getAgents().map(a=>a.id===id?{...a,status:action==='revoke-agent'||action==='decline-agent'?'revoked':'approved',acceptedAt:new Date().toISOString()}:a);save(KEY.agents,agents);let changed=agents.find(a=>a.id===id);if(changed)syncPublicListing(changed.propertyId)}renderPanel()}
function handleWorkspaceSubmit(e){e.preventDefault();const form=e.target,fd=new FormData(form);if(form.id==='propertyForm'){let title=String(fd.get('title')).trim(),price=Number(fd.get('price'));if(!title||!price){toastMsg('Preencha os campos obrigatórios');return}if(!window.__media||window.__media.photos.length<5){toastMsg('Adicione pelo menos 5 fotografias do imóvel');return}let category=fd.get('category'),id='p-'+Date.now(),p={id,title,category,type:fd.get('type'),price,period:category==='rent'?'/ mês':'',bedrooms:Number(fd.get('bedrooms')||0),baths:Number(fd.get('baths')||0),area:Number(fd.get('area')||0),province:fd.get('province'),municipality:String(fd.get('municipality')).trim(),neighborhood:String(fd.get('neighborhood')).trim(),image:window.__media.photos[0],photos:window.__media.photos.slice(),video:window.__media.video||'',badge:category==='rent'?'Arrendamento':category==='sale'?'Compra e venda':'Comercial',description:String(fd.get('description')).trim(),amenities:String(fd.get('amenities')).split(',').map(x=>x.trim()).filter(Boolean),pin:[30+Math.floor(Math.random()*60),20+Math.floor(Math.random()*60)],ownerEmail:current.email,ownerName:current.name,publisherRole:current.role,agent:current.name,agentEmail:current.role==='agent'?current.email:null,status:'pending_review',privateAddress:String(fd.get('privateAddress')||''),privatePoint:String(fd.get('privatePoint')||''),createdAt:new Date().toISOString()};let props=getProps();const NK=x=>[x.province,x.municipality,x.neighborhood,x.privateAddress].map(v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')).join('|');const dup=props.find(x=>x.status!=='rejected'&&NK(x)===NK(p));if(dup){toastMsg(dup.ownerEmail===current.email?'Já publicou este imóvel':'Este imóvel já foi publicado por outra pessoa. Peça ao publicador que o vincule como intermediário.');return}props.unshift(p);save(KEY.properties,props);photoData='';window.__media={photos:[],video:''};activePanel='properties';renderPanel();toastMsg('Imóvel submetido para revisão administrativa');return}if(form.id==='agentInviteForm'){let p=getProps().find(x=>String(x.id)===String(fd.get('propertyId')));if(!p){toastMsg('Cadastre um imóvel antes de convidar');return}let email=String(fd.get('agentEmail')).trim().toLowerCase(),users=getUsers(),agent=users.find(u=>u.email===email&&u.role==='agent');let agents=getAgents();if(email===current.email){toastMsg('Não pode vincular-se a si próprio');return}if(agents.filter(a=>String(a.propertyId)===String(p.id)&&!['revoked','rejected'].includes(a.status)).length>=5){toastMsg('Este imóvel já tem 5 intermediários vinculados (máximo)');return}if(agents.some(a=>a.propertyId===p.id&&a.agentEmail===email&&a.status!=='revoked')){toastMsg('Este intermediário já está associado ao imóvel');return}agents.unshift({id:'a-'+Date.now(),propertyId:p.id,ownerEmail:current.email,agentEmail:email,agentName:agent?agent.name:email,trackingCode:uniqueTrackingCode(),terms:String(fd.get('terms')||''),commissionPct:Number(fd.get('commissionPct')||localStorage.getItem('inter_agent_commission_pct')||5),status:'pending',createdAt:new Date().toISOString()});save(KEY.agents,agents);renderPanel();toastMsg(agent?'Convite enviado ao intermediário':'Convite guardado · aguarda o registo do intermediário');return}if(form.id==='availabilityForm'){let data=load(KEY.availability,{});data[current.email]={days:fd.getAll('days'),start:fd.get('start'),end:fd.get('end'),slot:Number(fd.get('slot'))};save(KEY.availability,data);toastMsg('Disponibilidade guardada');return}if(form.id==='checkinForm'){let code=String(fd.get('visitCode')).trim().toUpperCase(),visits=getVisits(),v=visits.find(x=>String(x.code).toUpperCase()===code&&(x.agent===current.name||x.agentEmail===current.email));if(!v){toastMsg('Código não encontrado para este intermediário');return}if(!v.paid){toastMsg('A visita ainda não tem pagamento confirmado');return}v.visitStatus='completed';v.checkedInAt=new Date().toISOString();save(KEY.visits,visits);renderPanel();toastMsg('Check-in validado · visita concluída');return}if(form.id==='feeForm'){localStorage.setItem(KEY.fee,String(Math.max(0,Number(fd.get('fee')||0))));localStorage.setItem('inter_platform_commission_pct',String(Math.min(100,Math.max(0,Number(fd.get('platformPct')||0)))));localStorage.setItem('inter_agent_commission_pct',String(Math.min(100,Math.max(0,Number(fd.get('agentPct')||0)))));renderPanel();toastMsg('Taxas e comissões actualizadas');return}}
function publicListing(p){let link=getAgents().find(a=>String(a.propertyId)===String(p.id)&&a.status==='approved');return {id:p.id,title:p.title,category:p.category,type:p.type,price:p.price,period:p.period,bedrooms:p.bedrooms,baths:p.baths,area:p.area,province:p.province,municipality:p.municipality,neighborhood:p.municipality+' · '+p.neighborhood,image:p.image,badge:p.badge,description:p.description,amenities:p.amenities,agent:link?link.agentName:'Intermediário por atribuir',pin:p.pin||[55,45]}}
function leaveWorkspace(){$('#roleMount').hidden=true;$('.page-shell').hidden=false;activePanel='overview';if(window.marketplaceData)window.marketplaceData.render();window.scrollTo({top:0,behavior:'smooth'})}
$('#profileButton').addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(current)openWorkspace();else openAccess('register')},true);
$('#workspaceButton').addEventListener('click',()=>openWorkspace());
document.addEventListener('click',e=>{let b=e.target.closest('[data-view="perfil"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(current)openWorkspace('profile');else openAccess('register')},true);
$('#roleMount').addEventListener('change',e=>{if(e.target.id==='propertyPhoto'){let f=e.target.files&&e.target.files[0];if(!f)return;if(f.size>700*1024){toastMsg('A imagem deve ter até 700 KB');e.target.value='';return}let reader=new FileReader();reader.onload=()=>{photoData=reader.result;let img=$('#uploadPreview');img.src=photoData;img.classList.remove('hidden')};reader.readAsDataURL(f)}});
document.querySelector('.brand').addEventListener('click',e=>{if(!$('#roleMount').hidden){e.preventDefault();leaveWorkspace()}});
document.addEventListener('click',e=>{let btn=e.target.closest('[data-access]');if(btn){drawAccess(btn.dataset.access);return}if(e.target===$('#overlay'))closeAccess()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#overlay').classList.contains('open'))closeAccess()});
refreshHeader();
window.__roles={renderPanel,toastMsg};
if(window.Api?.enabled()){
 let adminUsers=null,adminUsersError='',adminProperties=null,adminPropertiesError='',adminStats=null,adminStatsError='',adminPayments=null,adminPaymentsError='',adminSettings=null,adminSettingsError='';
 const localAdminPanel=adminPanel;
 let agentApiData=null,agentApiError='',agentSyncPromise=null;
 const localAgentPanel=agentPanel;
 function agentRefreshControl(){return '<div class="role-row-actions" style="justify-content:flex-end"><button class="secondary-button" data-action="refresh-agent-data">Atualizar dados</button></div>'}
 agentPanel=function(){
  if(!['overview','properties','agents','availability','visits'].includes(activePanel))return localAgentPanel();
  const title=activePanel==='overview'?'Painel do intermediário':activePanel==='properties'?'Imóveis disponíveis':activePanel==='agents'?'Convites e vínculos':activePanel==='availability'?'Disponibilidade':'As minhas visitas';
  if(agentApiError)return head(title,'Dados sincronizados com a API do backend.')+'<div class="role-notice">Não foi possível carregar os dados do intermediário: '+esc(agentApiError)+'</div>'+agentRefreshControl();
  if(!agentApiData)return head(title,'A carregar os dados do intermediário a partir da API.')+'<div class="role-empty">A carregar imóveis, vínculos, visitas e disponibilidade...</div>';
  if(activePanel==='properties')return head(title,'Imóveis publicados por si ou autorizados pelos proprietários.')+agentRefreshControl()+(agentApiData.properties.length?propertiesList(agentApiData.properties,false):'<div class="role-empty"><b>Sem imóveis disponíveis</b>Os imóveis publicados ou autorizados vão aparecer aqui.</div>');
  if(activePanel==='agents')return head(title,'Aceite ou recuse convites e partilhe o código de rastreio dos vínculos aprovados.')+agentRefreshControl()+agentList(agentApiData.links,false);
  if(activePanel==='availability')return head(title,'Configure os dias e horários em que pode receber visitas.')+agentRefreshControl()+availabilityForm();
  if(activePanel==='visits')return head(title,'Agendamentos atribuídos ao seu perfil pela API.')+agentRefreshControl()+visitList(agentApiData.visits);
  const approved=agentApiData.links.filter(link=>link.status==='approved').length;
  const pending=agentApiData.links.filter(link=>link.status==='pending').length;
  return head(title,'Autorizações, agenda e validação presencial.',{text:current.status==='active'?'Conta verificada':'BI/NIF em validação',kind:current.status==='active'?'active':'pending'})
   +agentRefreshControl()+'<div class="role-stats">'+statsCard('Imóveis disponíveis',agentApiData.properties.length)+statsCard('Autorizações pendentes',pending)+statsCard('Visitas atribuídas',agentApiData.visits.length)+'</div><div class="role-hero"><div><strong>O seu código protege os seus leads.</strong><span>'+approved+' vínculo(s) aprovado(s) com código de rastreio.</span></div><span class="role-hero-mark">⌖</span></div>'+agentList(agentApiData.links,false);
 };
 async function fetchAllAgentPages(fetchPage){
  const items=[];let page=1,lastPage=1;
  do{
   const response=await fetchPage(page);
   items.push(...Api.rows(response));
   const meta=response?.meta||response?.data?.meta||response?.data?.data?.meta;
   lastPage=Number(meta?.last_page||page);
   page++;
  }while(page<=lastPage);
  return items;
 }
 function mapAgentProperty(property){
  const media=property.media||property.photos||[];
  const firstMedia=media[0];
  const photos=media.map(item=>window.apiMediaUrl?.(typeof item==='string'?item:(item.url||item.path))||(typeof item==='string'?item:(item.url||item.path||''))).filter(Boolean);
  const rawImage=typeof property.image==='string'?property.image:property.image?.url||property.image?.path||property.image_url||(typeof firstMedia==='string'?firstMedia:firstMedia?.url||firstMedia?.original_url||firstMedia?.path);
  const image=window.apiMediaUrl?.(rawImage)||rawImage||'assets/imovel-1.png';
  return {
   id:property.id,title:property.title||'Imóvel',category:property.category,type:property.type,price:Number(property.price||0),
   province:property.province,municipality:property.municipality||'',neighborhood:property.neighborhood||'',
   bedrooms:Number(property.bedrooms||0),baths:Number(property.baths||0),area:Number(property.area||0),
   image,photos,
   status:property.status||'pending_review',ownerEmail:property.owner?.email||property.owner_email||'',
   ownerName:property.owner?.name||property.owner_name||'',description:property.description||'',amenities:property.amenities||[]
  };
 }
 function mapAgentLink(link){
  return {
   id:link.id,propertyId:link.property_id,propertyTitle:link.property_title||link.property?.title||'Imóvel',
   ownerId:link.owner_id,agentId:link.agent_id,agentName:link.agent_name||link.agent?.name||'',
   agentEmail:link.agent_email||link.agent?.email||current.email,ownerEmail:link.owner?.email||link.owner_email||'',
   trackingCode:link.tracking_code||'',commissionPct:Number(link.commission_pct||0),terms:link.terms||'',
   status:link.status,createdAt:link.created_at||''
  };
 }
 function mapAgentVisit(visit,properties){
  const property=properties.find(item=>String(item.id)===String(visit.property_id));
  return {
   id:visit.id,propertyId:visit.property_id,title:visit.title||visit.property?.title||property?.title||'Imóvel',
   scheduled:visit.scheduled_at||'',paid:visit.paid===true,code:visit.paid===true?(visit.code||''):'',
   visitStatus:visit.status||'scheduled',agent:visit.agent||current.name,agentEmail:current.email,
   image:property?.image||'assets/imovel-1.png'
  };
 }
 async function syncAgentData(showErrors,force){
  if(current?.role!=='agent'||!Api.getToken())return;
  if(agentSyncPromise)return agentSyncPromise;
  if(agentApiData&&!force)return agentApiData;
  agentApiError='';
  agentSyncPromise=(async()=>{
   try{
    const [properties,links,visits,availability]=await Promise.all([
     fetchAllAgentPages(page=>Api.properties.mine({page})),
     fetchAllAgentPages(page=>Api.agentLinks.list({page})),
     fetchAllAgentPages(page=>Api.visits.list({page})),
     Api.availability.get()
    ]);
    const mappedProperties=properties.map(mapAgentProperty);
    const mappedLinks=links.map(mapAgentLink).filter(link=>String(link.agentId)===String(current.id));
    agentApiData={
     properties:mappedProperties,links:mappedLinks,
     visits:visits.map(visit=>mapAgentVisit(visit,mappedProperties)),
     availability:{
      days:(availability?.days||[1,2,3,4,5]).map(day=>Number(day)===7?'0':String(day)),
      start:availability?.start||'09:00',end:availability?.end||'17:00',slot:Number(availability?.slot||60)
     }
    };
    save(KEY.properties,mappedProperties);save(KEY.agents,mappedLinks);save(KEY.visits,agentApiData.visits);
    const availabilityCache=load(KEY.availability,{});availabilityCache[current.email]=agentApiData.availability;save(KEY.availability,availabilityCache);
    agentApiError='';
    if(current?.role==='agent')renderPanel();
    return agentApiData;
   }catch(error){
    agentApiError=error.message||'Erro desconhecido';
    if(current?.role==='agent')renderPanel();
    if(showErrors)toastMsg('Não foi possível actualizar os dados do intermediário: '+agentApiError);
    throw error;
   }finally{agentSyncPromise=null}
  })();
  return agentSyncPromise;
 }
 adminPanel=function(){
  if(activePanel==='overview'){
   const stats=adminStats||{};
   return head('Painel administrativo','Validação, moderação e auditoria do MVP.')
    +(adminStatsError?'<div class="role-notice">Não foi possível carregar os indicadores: '+esc(adminStatsError)+'</div>':'')
    +'<div class="role-stats">'+statsCard('Contas por validar',adminStats?Number(stats.users_pending||0):'—')+statsCard('Imóveis em revisão',adminStats?Number(stats.properties_pending||0):'—')+statsCard('Visitas pagas',adminStats?Number(stats.visits_paid||0):'—')+'</div><div class="role-hero"><div><strong>Fila de moderação</strong><span>Valide identidades e qualidade dos anúncios.</span></div><span class="role-hero-mark">✓</span></div><div class="role-row-actions" style="justify-content:flex-start"><button class="primary-button" data-panel="accounts">Validar contas</button><button class="secondary-button" data-panel="properties">Rever imóveis</button><button class="secondary-button" data-panel="payments">Auditar pagamentos</button></div>';
  }
  if(activePanel==='accounts'){
   const content=adminUsersError
    ?'<div class="role-notice">Não foi possível carregar as contas: '+esc(adminUsersError)+'</div>'
    :adminUsers===null
     ?'<div class="role-empty">A carregar contas da API...</div>'
     :accountList(adminUsers);
   return head('Validar contas','Verifique BI/NIF e aprove ou rejeite contas de proprietário e intermediário.')
    +'<div class="role-row-actions" style="justify-content:flex-end"><button class="secondary-button" data-action="refresh-admin-users">Atualizar lista</button></div>'
    +content;
  }
  if(activePanel==='properties'){
   const content=adminPropertiesError
    ?'<div class="role-notice">Não foi possível carregar os imóveis: '+esc(adminPropertiesError)+'</div>'
    :adminProperties===null
     ?'<div class="role-empty">A carregar imóveis da API...</div>'
     :adminPropertyList(adminProperties);
   return head('Moderar imóveis','Revise anúncios pendentes enviados à API antes de os disponibilizar ao público.')
    +'<div class="role-row-actions" style="justify-content:flex-end"><button class="secondary-button" data-action="refresh-admin-properties">Atualizar lista</button></div>'
    +content;
  }
  if(activePanel==='payments'){
   const content=adminPaymentsError
    ?'<div class="role-notice">Não foi possível carregar os pagamentos: '+esc(adminPaymentsError)+'</div>'
    :adminPayments===null
     ?'<div class="role-empty">A carregar pagamentos da API...</div>'
     :adminPaymentList(adminPayments);
   return head('Pagamentos GPO FACI','Pagamentos e referências devolvidos pelo backend.')
    +'<div class="role-row-actions" style="justify-content:flex-end"><button class="secondary-button" data-action="refresh-admin-payments">Atualizar lista</button></div>'
    +content;
  }
  if(activePanel==='settings'){
   const content=adminSettingsError
    ?'<div class="role-notice">Não foi possível carregar as configurações: '+esc(adminSettingsError)+'</div>'
    :adminSettings===null
     ?'<div class="role-empty">A carregar configurações da API...</div>'
     :adminSettingsForm(adminSettings);
   return head('Configurações da plataforma','Taxa de visita e comissões percentuais do fluxo de arrendamento.')
    +'<div class="role-row-actions" style="justify-content:flex-end"><button class="secondary-button" data-action="refresh-admin-settings">Atualizar valores</button></div>'
    +content;
  }
  return localAdminPanel();
 };
 async function syncAdminStats(showErrors){
  try{
   adminStats=Api.resource(await Api.admin.stats());
   adminStatsError='';
   if(activePanel==='overview')renderPanel();
  }catch(error){
   adminStatsError=error.message;
   if(activePanel==='overview')renderPanel();
   if(showErrors)toastMsg('Não foi possível carregar os indicadores: '+error.message);
  }
 }
 async function syncAdminUsers(showErrors){
  try{
   const users=[];
   let page=1,lastPage=1;
   do{
    const response=await Api.admin.users({status:'pending_review',page});
    users.push(...Api.rows(response));
    const meta=response?.meta||response?.data?.meta||response?.data?.data?.meta;
    lastPage=Number(meta?.last_page||page);
    page++;
   }while(page<=lastPage);
   adminUsers=users.filter(user=>(user.role==='owner'||user.role==='agent')&&user.status==='pending_review');
   adminUsersError='';
   if(activePanel==='accounts')renderPanel();
  }catch(error){
   adminUsersError=error.message;
   if(activePanel==='accounts')renderPanel();
   if(showErrors)toastMsg('Não foi possível carregar as contas: '+error.message);
  }
 }
 async function syncAdminProperties(showErrors){
  try{
   const properties=[];
   let page=1,lastPage=1;
   do{
    const response=await Api.admin.properties({status:'pending_review',page});
    properties.push(...Api.rows(response));
    const meta=response?.meta||response?.data?.meta||response?.data?.data?.meta;
    lastPage=Number(meta?.last_page||page);
    page++;
   }while(page<=lastPage);
   adminProperties=properties.filter(property=>property.status==='pending_review');
   adminPropertiesError='';
   if(activePanel==='properties')renderPanel();
  }catch(error){
   adminPropertiesError=error.message;
   if(activePanel==='properties')renderPanel();
   if(showErrors)toastMsg('Não foi possível carregar os imóveis: '+error.message);
  }
 }
 async function syncAdminPayments(showErrors){
  try{
   const payments=[];
   let page=1,lastPage=1;
   do{
    const response=await Api.admin.payments({page});
    payments.push(...Api.rows(response));
    const meta=response?.meta||response?.data?.meta||response?.data?.data?.meta;
    lastPage=Number(meta?.last_page||page);
    page++;
   }while(page<=lastPage);
   adminPayments=payments;
   adminPaymentsError='';
   if(activePanel==='payments')renderPanel();
  }catch(error){
   adminPaymentsError=error.message;
   if(activePanel==='payments')renderPanel();
   if(showErrors)toastMsg('Não foi possível carregar os pagamentos: '+error.message);
  }
 }
 async function syncAdminSettings(showErrors){
  try{
   adminSettings=Api.resource(await Api.admin.settings());
   adminSettingsError='';
   if(activePanel==='settings')renderPanel();
  }catch(error){
   adminSettingsError=error.message;
   if(activePanel==='settings')renderPanel();
   if(showErrors)toastMsg('Não foi possível carregar as configurações: '+error.message);
  }
 }
 document.addEventListener('click',event=>{
  if(!event.target.closest('#profileButton,#workspaceButton')||current?.role!=='agent')return;
  setTimeout(()=>syncAgentData(true,false).catch(()=>{}),0);
 },true);
 document.addEventListener('click',event=>{
  const panel=event.target.closest('#roleMount [data-panel="overview"],#roleMount [data-panel="properties"],#roleMount [data-panel="agents"],#roleMount [data-panel="availability"],#roleMount [data-panel="visits"]');
  if(!panel||current?.role!=='agent')return;
  setTimeout(()=>syncAgentData(true,false).catch(()=>{}),0);
 },true);
 document.addEventListener('click',async event=>{
  const refresh=event.target.closest('#roleMount [data-action="refresh-agent-data"]');
  const response=event.target.closest('#roleMount [data-action="accept-agent"],#roleMount [data-action="decline-agent"]');
  if(!refresh&&!response)return;
  if(current?.role!=='agent')return;
  event.preventDefault();event.stopImmediatePropagation();
  const button=refresh||response;
  button.disabled=true;
  try{
   if(response){
    const status=response.dataset.action==='accept-agent'?'approved':'rejected';
    await Api.agentLinks.respond(response.dataset.id,status);
    toastMsg(status==='approved'?'Convite aceite.':'Convite recusado.');
   }
   await syncAgentData(false,true);
  }catch(error){
   if(response&&response.isConnected)response.disabled=false;
   if(refresh&&refresh.isConnected)refresh.disabled=false;
   toastMsg('Não foi possível actualizar os dados do intermediário: '+error.message);
  }
 },true);
 document.addEventListener('click',event=>{
  if(!event.target.closest('#profileButton,#workspaceButton')||current?.role!=='admin')return;
  setTimeout(()=>syncAdminStats(true),0);
 },true);
 document.addEventListener('click',event=>{
  const panel=event.target.closest('#roleMount [data-panel="accounts"],#roleMount [data-panel="properties"],#roleMount [data-panel="payments"],#roleMount [data-panel="settings"]');
  if(!panel||current?.role!=='admin')return;
  setTimeout(()=>{
   if(panel.dataset.panel==='accounts')syncAdminUsers(true);
   else if(panel.dataset.panel==='properties')syncAdminProperties(true);
   else if(panel.dataset.panel==='payments')syncAdminPayments(true);
   else syncAdminSettings(true);
  },0);
 },true);
 document.addEventListener('click',async event=>{
  const refresh=event.target.closest('#roleMount [data-action="refresh-admin-users"]');
  const refreshProperties=event.target.closest('#roleMount [data-action="refresh-admin-properties"]');
  const refreshPayments=event.target.closest('#roleMount [data-action="refresh-admin-payments"]');
  const refreshSettings=event.target.closest('#roleMount [data-action="refresh-admin-settings"]');
  const userReview=event.target.closest('#roleMount [data-action="approve-user"],#roleMount [data-action="reject-user"]');
  const propertyReview=event.target.closest('#roleMount [data-action="approve-property"],#roleMount [data-action="reject-property"]');
  if(!refresh&&!refreshProperties&&!refreshPayments&&!refreshSettings&&!userReview&&!propertyReview)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!Api.getToken()){toastMsg('Inicie sessão como administrador para gerir contas.');return}
  if(refresh){refresh.disabled=true;await syncAdminUsers(true);return}
  if(refreshProperties){refreshProperties.disabled=true;await syncAdminProperties(true);return}
  if(refreshPayments){refreshPayments.disabled=true;await syncAdminPayments(true);return}
  if(refreshSettings){refreshSettings.disabled=true;await syncAdminSettings(true);return}
  const review=userReview||propertyReview;
  review.disabled=true;
  try{
   const approved=review.dataset.action==='approve-user'||review.dataset.action==='approve-property';
   if(userReview)await Api.admin.reviewUser(review.dataset.id,{status:approved?'active':'rejected'});
   else await Api.admin.reviewProperty(review.dataset.id,{status:approved?'active':'rejected'});
   toastMsg(userReview?(approved?'Conta aprovada.':'Conta rejeitada.'):(approved?'Imóvel aprovado.':'Imóvel rejeitado.'));
   if(userReview)await syncAdminUsers(false);
   else{
    await syncAdminProperties(false);
    if(approved)await window.marketplaceData?.reloadProperties?.();
   }
   await syncAdminStats(false);
  }catch(error){
   toastMsg('Não foi possível actualizar '+(userReview?'a conta':'o imóvel')+': '+error.message);
   if(review.isConnected)review.disabled=false;
  }
 },true);
 let commissionPollTimer=null,commissionPollId=null;
 window.__apiCommissionsLoaded=false;
 commissionPanel=function(view){if(!window.__apiCommissionsLoaded)return '<div class="role-empty">A carregar comissões da API...</div>';let list=load('inter_agent_commissions').filter(c=>view==='owner'?c.ownerEmail===current.email:c.agentEmail===current.email);if(!list.length)return '<div class="role-empty"><b>Sem comissões de arrendamento</b>As comissões aparecem após confirmação de um arrendamento.</div>';return '<div class="role-panel"><div class="role-list">'+list.map(c=>{const paid=c.payment?.status==='paid',pending=c.payment?.status==='pending';return '<div class="commission-row"><div><b>'+esc(c.propertyTitle||'Imóvel')+'</b><small>'+(view==='owner'?'Intermediário: '+esc(c.agentName||'—'):'Proprietário: '+esc(c.ownerName||'—'))+' · '+Number(c.rate||0)+'% da primeira renda</small></div><div style="text-align:right"><strong>'+money(c.amount)+' Kz</strong><small>'+(paid?'Liquidada via GPO FACI':pending?'Aguardando pagamento GPO FACI':'Comissão devida pelo proprietário')+'</small>'+(view==='owner'&&!paid&&!pending?'<button class="tiny-button" data-action="settle-commission" data-id="'+esc(c.id)+'">Pagar via GPO FACI →</button>':'')+'</div></div>'}).join('')+'</div><p class="role-help">A comissão do intermediário é paga pelo proprietário, nunca pelo arrendatário.</p></div>'};
 const commissionRows=async()=>Api.rows(await Api.commissions.list());
 const mapCommission=c=>({id:c.id,propertyId:c.property_id,propertyTitle:c.property_title||c.property?.title||'Imóvel',ownerEmail:c.owner_email||c.owner?.email,ownerName:c.owner_name||c.owner?.name,agentEmail:c.agent_email||c.agent?.email,agentName:c.agent_name||c.agent?.name,amount:Number(c.amount||0),rate:Number(c.rate||c.commission_pct||0),status:c.status,payment:c.payment||null});
 async function syncCommissions(){const rows=(await commissionRows()).map(mapCommission);window.__apiCommissionsLoaded=true;save('inter_agent_commissions',rows);if(activePanel==='commissions')renderPanel();return rows}
 function commissionIsPaid(c){return c?.payment?.status==='paid'}
 function commissionPaymentTerminal(c){return ['failed','cancelled','canceled','expired','rejected'].includes(String(c?.payment?.status||'').toLowerCase())||['cancelled','canceled','expired','rejected'].includes(String(c?.status||'').toLowerCase())}
 function commissionPaymentMessage(c){const data=c?.payment?.data||{};if(commissionIsPaid(c))return'Pagamento confirmado pela API. A comissão está paga.';if(data.charge_requested===true)return'Cobrança enviada ao telemóvel. O envio não significa que a comissão foi paga.';if(data.charge_requested===false)return data.message||'A API não confirmou o envio da cobrança. A referência continua disponível.';return data.message||'Aguardando confirmação do pagamento pela API.'}
 function updateCommissionDialog(c){const box=$('#dialogContent');if(!box||box.dataset.commissionId!==String(c.id))return;const payment=c.payment||{};$('#commissionPaymentStatus').textContent=commissionIsPaid(c)?'Pago':payment.status||c.status||'pending';$('#commissionPaymentAmount').textContent=payment.amount==null?money(c.amount)+' AOA':money(payment.amount)+' '+(payment.currency||'AOA');$('#commissionPaymentReference').textContent=payment.reference||'A referência ainda não foi devolvida pela API.';$('#commissionPaymentMessage').textContent=commissionPaymentMessage(c);$('#copyCommissionReference').disabled=!payment.reference}
 function showCommissionPayment(c){commissionPollId=c.id;$('#dialogContent').innerHTML='<div class="dialog-inner"><p class="eyebrow">GPO FACI · COMISSÃO</p><h2 class="dialog-title">Aguardando pagamento</h2><p class="dialog-subtitle">A comissão só será marcada como paga após confirmação da API.</p><div class="payment-receipt"><div class="receipt-row"><span>Estado</span><strong id="commissionPaymentStatus">pending</strong></div><div class="receipt-row"><span>Valor</span><strong id="commissionPaymentAmount">—</strong></div><div class="receipt-row"><span>Referência</span><strong id="commissionPaymentReference">—</strong></div><p id="commissionPaymentMessage"></p></div><div class="detail-footer"><button class="secondary-button" id="copyCommissionReference">Copiar referência</button><button class="secondary-button" id="refreshCommissionPayment">Atualizar estado</button><button class="primary-button" id="closeCommissionPayment">Fechar</button></div></div>';$('#overlay').classList.add('open');$('#overlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#dialogContent').dataset.commissionId=String(c.id);updateCommissionDialog(c);$('#copyCommissionReference').onclick=async()=>{if(!c.payment?.reference)return;try{await navigator.clipboard.writeText(String(c.payment.reference));toastMsg('Referência copiada')}catch(error){toastMsg('Não foi possível copiar a referência: '+error.message)}};$('#refreshCommissionPayment').onclick=()=>refreshCommissionPayment(true);$('#closeCommissionPayment').onclick=closeAccess;startCommissionPolling(c)}
 async function refreshCommissionPayment(showErrors){if(!commissionPollId)return;try{const rows=await syncCommissions(),c=rows.find(item=>String(item.id)===String(commissionPollId));if(c){updateCommissionDialog(c);startCommissionPolling(c)}else{if(showErrors)toastMsg('A comissão não apareceu na lista da API.');startCommissionPolling(null)}}catch(error){if(showErrors)toastMsg('Não foi possível consultar a comissão: '+error.message);startCommissionPolling(null)}}
 function startCommissionPolling(c){if(commissionPollTimer)clearTimeout(commissionPollTimer);if(c&&(commissionIsPaid(c)||commissionPaymentTerminal(c)))return;commissionPollTimer=setTimeout(()=>refreshCommissionPayment(false),25000)}
 async function payCommission(button){const id=button.dataset.id;button.disabled=true;const originalError=async error=>{try{const rows=await syncCommissions(),existing=rows.find(c=>String(c.id)===String(id));if(existing?.payment){showCommissionPayment(existing);return}toastMsg('A API não encontrou um pagamento criado. Pode tentar novamente. '+error.message);button.disabled=false}catch(checkError){toastMsg('Não foi possível confirmar se a comissão foi enviada. Atualize a lista antes de tentar novamente. '+checkError.message)}};try{const response=await Api.commissions.pay(id,{payment_method:'reference'}),c=mapCommission(Api.resource(response)),rows=load('inter_agent_commissions').filter(item=>String(item.id)!==String(c.id));rows.unshift(c);save('inter_agent_commissions',rows);if(activePanel==='commissions')renderPanel();showCommissionPayment(c)}catch(error){await originalError(error)}}
 document.addEventListener('click',e=>{const panel=e.target.closest('#roleMount [data-panel="commissions"]');if(!panel||!Api.getToken())return;setTimeout(async()=>{try{await syncCommissions();renderPanel()}catch(error){toastMsg('Não foi possível carregar comissões: '+error.message)}},0)},true);
 document.addEventListener('click',e=>{const button=e.target.closest('#roleMount [data-action="settle-commission"]');if(!button)return;e.preventDefault();e.stopImmediatePropagation();if(!Api.getToken()){toastMsg('Entre na sua conta para pagar a comissão');return}payCommission(button)},true);
 document.addEventListener('submit',async e=>{
  if(e.target.id!=='accessForm')return;
  e.preventDefault();e.stopImmediatePropagation();
  const form=e.target,fd=new FormData(form),register=!!form.querySelector('[name="name"]'),button=form.querySelector('button[type="submit"]');
  if(register&&!['client','owner','agent'].includes(fd.get('role'))){toastMsg('Selecione um perfil disponível para criar a conta.');return}
  button.disabled=true;
  try{
   let response;
   if(register){const phone=normalizeAOPhoneForVerification(fd.get('phone'));if(!phone||!isPhoneVerificationComplete(form))throw new Error('Verifique o telefone com o código enviado via Ombala antes de criar a conta.');fd.set('phone',phone);fd.set('phone_verification_id',phoneVerification.id);fd.delete('otp_code');fd.delete('adminCode');const document=fd.get('document');if(!(document instanceof File)||!document.name)fd.delete('document');response=await Api.auth.register(fd)}
   else response=await Api.auth.login({email:String(fd.get('email')).trim().toLowerCase(),password:String(fd.get('password'))});
   const data=response?.data||response;
   if(response?.token)Api.setToken(response.token);else if(data?.token)Api.setToken(data.token);
   if(!Api.getToken())throw new Error('A API não devolveu um token de acesso.');
   current=response?.user||data?.user||await Api.auth.me();
   if(current?.data)current=current.data;
   if(!current?.id)throw new Error('A resposta de autenticação não contém o perfil do utilizador.');
   if(register)phoneVerification={id:'',requestedPhone:'',verifiedPhone:''};
   setCurrent(current);agentApiData=null;agentApiError='';closeAccess();openWorkspace();
   if(current.role==='agent')syncAgentData(false,false).catch(()=>{});
   if(current.role==='admin')syncAdminStats(false);
  }catch(error){toastMsg(error.message||'Não foi possível autenticar.')}
  finally{button.disabled=register&&window.Api?.enabled()?!isPhoneVerificationComplete(form):false}
 },true);
 document.addEventListener('submit',async e=>{
  const form=e.target;if(!['propertyForm','agentInviteForm','availabilityForm','checkinForm','feeForm'].includes(form.id))return;
  e.preventDefault();e.stopImmediatePropagation();
  const fd=new FormData(form),button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
  try{
   if(form.id==='propertyForm'){
    if(window.__media.photos.length<5)throw new Error('Adicione pelo menos 5 fotografias do imóvel.');
    const body=new FormData(),keys=['title','category','type','price','province','municipality','neighborhood','bedrooms','baths','area','description'];
    keys.forEach(key=>body.append(key,String(fd.get(key)||'')));
    const point=String(fd.get('privatePoint')||'').split(',').map(value=>value.trim());
    body.append('private_address',String(fd.get('privateAddress')||''));if(point.length===2){body.append('private_lat',point[0]);body.append('private_lng',point[1])}
    String(fd.get('amenities')||'').split(',').map(value=>value.trim()).filter(Boolean).forEach(value=>body.append('amenities[]',value));
    for(let i=0;i<window.__media.photos.length;i++){const blob=await fetch(window.__media.photos[i]).then(response=>response.blob());body.append('photos[]',blob,'photo-'+(i+1)+'.jpg')}
    if(window.__media.video){const blob=await fetch(window.__media.video).then(response=>response.blob());body.append('video',blob,'property-video.mp4')}
    const response=await Api.properties.create(body),created=response?.data?.property||response?.property||response?.data||response;
    const cached={id:created.id,title:String(fd.get('title')),category:fd.get('category'),price:Number(fd.get('price')),municipality:String(fd.get('municipality')),status:created.status||'pending_review',image:'assets/imovel-1.png',ownerEmail:current.email};
    const list=getProps();list.unshift(cached);save(KEY.properties,list);window.__media={photos:[],video:''};activePanel='properties';renderPanel();toastMsg('Imóvel enviado à API para revisão');if(current.role==='agent')await syncAgentData(false,true);return;
   }
   if(form.id==='agentInviteForm'){
    await Api.agentLinks.invite(String(fd.get('propertyId')),{agent_email:String(fd.get('agentEmail')).trim().toLowerCase(),commission_pct:Number(fd.get('commissionPct')),terms:String(fd.get('terms')||'')});
    toastMsg('Convite enviado à API');activePanel='agents';if(current.role==='agent')await syncAgentData(false,true);else renderPanel();return;
   }
   if(form.id==='availabilityForm'){
    const days=fd.getAll('days').map(day=>Number(day)==0?7:Number(day));
    await Api.availability.save({days,start:fd.get('start'),end:fd.get('end'),slot:Number(fd.get('slot'))});
    const data=load(KEY.availability,{});data[current.email]={days:fd.getAll('days'),start:fd.get('start'),end:fd.get('end'),slot:Number(fd.get('slot'))};save(KEY.availability,data);if(current.role==='agent')await syncAgentData(false,true);toastMsg('Disponibilidade guardada na API');return;
   }
   if(form.id==='checkinForm'){
    await Api.visits.checkin(String(fd.get('visitCode')).trim().toUpperCase());toastMsg('Check-in validado pela API');activePanel='visits';if(current.role==='agent')await syncAgentData(false,true);else renderPanel();return;
   }
   adminSettings=Api.resource(await Api.admin.saveSettings({visit_fee:Number(fd.get('fee')),platform_commission_pct:Number(fd.get('platformPct')),agent_commission_pct:Number(fd.get('agentPct'))}));
   adminSettingsError='';
   localStorage.setItem(KEY.fee,String(Number(fd.get('fee'))));localStorage.setItem('inter_platform_commission_pct',String(Number(fd.get('platformPct'))));localStorage.setItem('inter_agent_commission_pct',String(Number(fd.get('agentPct'))));renderPanel();toastMsg('Configurações guardadas na API');
  }catch(error){toastMsg(error.message||'Não foi possível concluir o pedido')}
  finally{if(button?.isConnected)button.disabled=false}
 },true);
 document.addEventListener('click',async e=>{
  const button=e.target.closest('#signOut');if(!button)return;
  e.preventDefault();e.stopImmediatePropagation();
  try{await Api.auth.logout()}catch(error){toastMsg('Erro ao terminar sessão na API: '+error.message)}
  localStorage.removeItem(KEY.current);current=null;agentApiData=null;agentApiError='';refreshHeader();leaveWorkspace();
 },true);
 document.addEventListener('click',e=>{if(!e.target.closest('#profileButton,[data-access]'))return;setTimeout(()=>{const note=$('#dialogContent .dialog-inner > .role-note');if(note)note.textContent='A autenticação e os dados da conta são enviados à API configurada.'},0)},true);
 if(Api.getToken()){
  Api.auth.me().then(response=>{current=response?.user||response?.data?.user||response?.data||response;setCurrent(current)})
   .catch(error=>{Api.setToken(null);localStorage.removeItem(KEY.current);current=null;refreshHeader();if(error.status!==401)toastMsg('Erro ao recuperar sessão: '+error.message)})
 }
}
