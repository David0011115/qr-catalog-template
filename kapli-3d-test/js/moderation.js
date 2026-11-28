(() => {
  'use strict';
  const SB_URL = 'https://kccwtpveezsrgwfnflhf.supabase.co';
  const SB_KEY = 'sb_publishable_oyO2ubBpXo3h1IBB-DPdsQ_gnYaO0Mf';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dt = value => value ? new Date(value).toLocaleString('ru-RU', {dateStyle:'short',timeStyle:'short'}) : '—';
  const nice = value => ({pending:'Ожидает',in_review:'На проверке',resolved:'Решено',dismissed:'Отклонено',accepted:'Удовлетворена',rejected:'Отклонена',new:'Новое',reviewing:'Проверяется',cleared:'Не подтвердилось',confirmed:'Подтверждено',mute:'Мут',ban:'Перманентный бан',insult:'Оскорбления',spam:'Спам / флуд',impossible_move:'Невозможное перемещение',cooldown_abuse:'Нарушение перезарядки',resource_anomaly:'Аномалия ресурсов',result_anomaly:'Подозрительный результат',request_tampering:'Подмена запроса',repeated_anomaly:'Повторяющиеся аномалии',other:'Другое'})[value] || value || '—';
  const client = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'kapli3dtest-auth'}});
  let currentUser = null, isAdmin = false, isModerator = false;
  const rpc = async (name, args={}) => { const {data,error}=await client.rpc(name,args); if(error)throw error; return data; };
  function note(message,kind=''){const el=$('notice');el.textContent=message;el.className='status'+(kind?' '+kind:'');}
  function errorText(e){const m=String(e?.message||e||'Ошибка');if(m.includes('admin_only')||m.includes('staff_only'))return 'У этого аккаунта нет прав сотрудника модерации.';if(m.includes('admin_ban_only'))return 'Постоянный бан может выдавать только администратор.';if(m.includes('admin_role_protected'))return 'Нельзя изменить роль администратора.';if(/invalid login credentials/i.test(m))return 'Неверная почта или пароль.';return m;}
  function showLoggedOut(){currentUser=null;isAdmin=false;isModerator=false;$('loginPanel').classList.remove('hidden');$('appPanel').classList.add('hidden');$('logoutBtn').classList.add('hidden');}
  async function boot(session){
    if(!session?.user){showLoggedOut();return;}
    currentUser=session.user;$('loginPanel').classList.add('hidden');$('appPanel').classList.remove('hidden');$('logoutBtn').classList.remove('hidden');
    $('who').textContent='Вход: '+(currentUser.email||currentUser.id);note('Проверяем роль аккаунта…');
    try{
      const role=await rpc('kapli_mod_my_role');
      isAdmin=role==='admin';isModerator=role==='moderator'||isAdmin;
      if(!isModerator)throw new Error('staff_only');
      const data=await rpc('kapli_mod_admin_dashboard');
      $('tabs').classList.remove('hidden');$('stats').classList.remove('hidden');
      ['overview','players','queue','appeals','events','roles'].forEach(k=>$('tab-'+k).classList.add('hidden'));
      $('tab-overview').classList.remove('hidden');
      $('tab-events').classList.toggle('hidden',!isAdmin);
      $('tab-roles').classList.add('hidden');
      $('rolesTab').classList.toggle('hidden',!isAdmin);
      if(isAdmin){$('tab-roles').classList.remove('hidden');}
      $('sanctionKind').querySelector('option[value="ban"]').hidden=!isAdmin;
      if(!isAdmin&&$('sanctionKind').value==='ban')$('sanctionKind').value='mute';
      document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='overview'));
      $('who').textContent=(currentUser.email||currentUser.id)+' · '+(isAdmin?'👑 Администратор':'🛡️ Модератор');
      note(isAdmin?'Доступ администратора подтверждён.':'Доступ модератора подтверждён.','ok');
      renderStats(data||{});await loadAll();
    }catch(e){
      isAdmin=false;isModerator=false;$('tabs').classList.add('hidden');$('stats').classList.add('hidden');
      note(errorText(e),'error');
      ['overview','players','queue','appeals','events','roles'].forEach(k=>$('tab-'+k).classList.add('hidden'));
    }
  }
  function renderStats(d){$('stats').innerHTML=[['queue_pending','Жалобы в работе'],['appeals_pending','Апелляции'],['events_new','События на проверке'],['active_mutes','Активные муты'],['active_bans','Перманентные баны']].map(([k,t])=>'<div class="stat"><b>'+Number(d[k]||0).toLocaleString('ru-RU')+'</b><span>'+t+'</span></div>').join('');}
  async function loadAll(){
    if(!isModerator)return;
    const jobs=await Promise.allSettled([rpc('kapli_mod_admin_queue',{p_status:'pending'}),rpc('kapli_mod_admin_appeals',{p_status:'pending'}),isAdmin?rpc('kapli_mod_admin_events',{p_status:'new'}):Promise.resolve([]),rpc('kapli_mod_admin_sanctions',{p_user_id:null}),rpc('kapli_mod_admin_dashboard')]);
    const [q,a,e,s,d]=jobs;
    $('queueList').innerHTML=q.status==='fulfilled'?renderQueue(q.value):'<p class="small">'+esc(errorText(q.reason))+'</p>';
    $('appealsList').innerHTML=a.status==='fulfilled'?renderAppeals(a.value):'<p class="small">'+esc(errorText(a.reason))+'</p>';
    $('eventsList').innerHTML=e.status==='fulfilled'?renderEvents(e.value):'<p class="small">'+esc(errorText(e.reason))+'</p>';
    $('sanctionsList').innerHTML=s.status==='fulfilled'?renderSanctions(s.value):'<p class="small">'+esc(errorText(s.reason))+'</p>';
    if(d.status==='fulfilled')renderStats(d.value||{});
    if(isAdmin)await loadModerators();
  }
  function renderQueue(rows){
    if(!rows?.length)return '<p class="small">Очередь пока пустая. Когда появятся жалобы, они будут отображаться здесь.</p>';
    return rows.map(x=>'<article class="item"><div class="item-head"><b>#'+x.id+' · '+esc(nice(x.category))+'</b><span class="tag">'+esc(nice(x.priority))+' · '+esc(nice(x.status))+'</span></div><p class="small">Игрок: '+esc(x.reported_nickname||'профиль не найден')+' · UUID: '+esc(x.reported_user_id||'—')+'<br>Источник: '+esc(x.source)+' '+(x.source_id?'#'+esc(x.source_id):'')+' · '+dt(x.created_at)+'</p><div class="evidence">'+esc(JSON.stringify(x.evidence||{},null,2))+'</div><div class="row" style="margin-top:9px"><button data-action="queue-review" data-id="'+x.id+'">Взять в работу</button><button class="good" data-action="queue-resolve" data-id="'+x.id+'">Решено</button><button class="warn" data-action="queue-dismiss" data-id="'+x.id+'">Отклонить</button></div></article>').join('');
  }
  function renderAppeals(rows){
    if(!rows?.length)return '<p class="small">Новых апелляций нет.</p>';
    return rows.map(x=>'<article class="item"><div class="item-head"><b>Апелляция #'+x.id+' · санкция #'+x.sanction_id+'</b><span class="tag">'+esc(nice(x.status))+'</span></div><p class="small">'+esc(x.nickname||'Игрок')+' · UUID: '+esc(x.user_id)+' · '+dt(x.created_at)+'</p><p>'+esc(x.body)+'</p><label>Комментарий администратора</label><input id="appeal-note-'+x.id+'" maxlength="1000" placeholder="Причина решения (необязательно)"><div class="row" style="margin-top:8px"><button class="good" data-action="appeal-accept" data-id="'+x.id+'">Удовлетворить</button><button class="warn" data-action="appeal-reject" data-id="'+x.id+'">Отклонить</button></div></article>').join('');
  }
  function renderEvents(rows){
    if(!rows?.length)return '<p class="small">Новых подозрительных событий нет.</p>';
    return rows.map(x=>'<article class="item"><div class="item-head"><b>Событие #'+x.id+' · '+esc(nice(x.event_type))+'</b><span class="tag">'+esc(nice(x.review_status))+'</span></div><p class="small">'+esc(x.nickname||'Игрок')+' · UUID: '+esc(x.user_id)+'<br>Матч: '+esc(x.match_id||'—')+' · '+dt(x.created_at)+'</p><div class="evidence">'+esc(JSON.stringify(x.evidence||{},null,2))+'</div><label>Заметка проверки</label><input id="event-note-'+x.id+'" maxlength="1000" placeholder="Что проверено и к какому выводу пришли"><div class="row" style="margin-top:8px"><button data-action="event-review" data-id="'+x.id+'">Проверяю</button><button class="good" data-action="event-clear" data-id="'+x.id+'">Не подтвердилось</button><button class="warn" data-action="event-confirm" data-id="'+x.id+'">Подтвердилось</button></div><p class="small">Подтверждение события само по себе не выдаёт мут или бан.</p></article>').join('');
  }
  function renderSanctions(rows){
    if(!rows?.length)return '<p class="small">Санкций пока нет.</p>';
    return rows.map(x=>{const issuer=x.source==='automatic'?'⚖️ Арбитр чата':(x.issuer_nickname?'Выдал: '+(x.issuer_role==='admin'?'👑 ':x.issuer_role==='moderator'?'🛡️ ':'')+esc(x.issuer_nickname):x.source==='admin'?'Ручная санкция':'Система');return '<article class="item"><div class="item-head"><b>#'+x.id+' · '+esc(nice(x.kind))+' · '+esc(x.nickname||x.user_id)+'</b><span class="tag">'+(x.revoked_at?'Снята':(x.kind==='ban'?'Без срока':(new Date(x.ends_at)>new Date()?'Активна':'Истекла')))+'</span></div><p class="small">UUID: '+esc(x.user_id)+'<br>Причина: '+esc(x.reason)+'<br>'+issuer+' · Выдана: '+dt(x.created_at)+' · До: '+(x.kind==='ban'?'—':dt(x.ends_at))+'</p>'+(!x.revoked_at&&(x.kind==='ban'||new Date(x.ends_at)>new Date())&&(isAdmin||x.kind==='mute')?'<button class="warn" data-action="sanction-revoke" data-id="'+x.id+'">Снять санкцию</button>':'')+'</article>';}).join('');
  }
  async function searchPlayers(){
    const q=$('playerQuery').value.trim();if(q.length<2){$('playerResults').innerHTML='<p class="small">Введи минимум 2 символа.</p>';return;}
    $('searchBtn').disabled=true;
    try{const rows=await rpc('kapli_mod_admin_find_players',{p_query:q});$('playerResults').innerHTML=rows?.length?rows.map(x=>'<article class="item"><div class="item-head"><b>'+esc(x.nickname)+'</b><span class="tag">ID '+esc(x.public_id)+'</span></div><p class="small">UUID: '+esc(x.user_id)+' · создан '+dt(x.created_at)+'</p><button data-action="choose-player" data-uid="'+esc(x.user_id)+'">Выбрать игрока</button></article>').join(''):'<p class="small">Игрок не найден.</p>';}
    catch(e){$('playerResults').innerHTML='<p class="small">'+esc(errorText(e))+'</p>';}
    finally{$('searchBtn').disabled=false;}
  }
  async function applySanction(){
    const uid=$('targetId').value.trim(),kind=$('sanctionKind').value,reason=$('reason').value.trim(),minutes=Number($('minutes').value);
    if(!uid||!reason){note('Укажи UUID игрока и причину санкции.','error');return;}
    if(kind==='ban'&&!isAdmin){note('Постоянный бан может выдавать только администратор.','error');return;}
    if(!isModerator){note('Недостаточно прав для выдачи санкции.','error');return;}
    if(kind==='mute'&&(!Number.isInteger(minutes)||minutes<1||minutes>43200)){note('Длительность мута должна быть от 1 до 43 200 минут.','error');return;}
    if(!confirm(kind==='ban'?'Выдать перманентный бан этому аккаунту?':'Выдать мут на '+minutes+' минут?'))return;
    $('applySanction').disabled=true;
    try{await rpc('kapli_mod_admin_set_sanction',{p_user_id:uid,p_kind:kind,p_minutes:kind==='ban'?null:minutes,p_reason:reason});note('Санкция выдана.','ok');await loadAll();}
    catch(e){note(errorText(e),'error');}
    finally{$('applySanction').disabled=false;}
  }
  async function action(button){
    const id=Number(button.dataset.id),act=button.dataset.action;button.disabled=true;
    try{
      if(act==='choose-player'){$('targetId').value=button.dataset.uid;note('Игрок выбран. Теперь можно выдать санкцию.','ok');return;}
      if(act==='choose-role-player'){$('roleUserId').value=button.dataset.uid;$('roleSelected').textContent='Выбран: '+button.dataset.nick+' · UUID: '+button.dataset.uid;note('Игрок выбран для управления ролью.','ok');return;}
      if(act==='role-revoke'){const uid=button.dataset.uid;if(!confirm('Снять роль модератора у этого игрока?'))return;await rpc('kapli_mod_admin_set_moderator',{p_user_id:uid,p_on:false});note('Роль модератора снята.','ok');await loadModerators();return;}
      if(act==='sanction-revoke'){const reason=prompt('Причина снятия санкции (необязательно):','');if(reason===null)return;await rpc('kapli_mod_admin_revoke_sanction',{p_sanction_id:id,p_reason:reason});}
      if(act==='queue-review'||act==='queue-resolve'||act==='queue-dismiss'){const status=act==='queue-review'?'in_review':act==='queue-resolve'?'resolved':'dismissed';const noteText=prompt('Комментарий к решению (необязательно):','');if(noteText===null)return;await rpc('kapli_mod_admin_resolve_queue',{p_queue_id:id,p_status:status,p_note:noteText});}
      if(act==='appeal-accept'||act==='appeal-reject'){const noteText=$('appeal-note-'+id)?.value||'';await rpc('kapli_mod_admin_review_appeal',{p_appeal_id:id,p_decision:act==='appeal-accept'?'accepted':'rejected',p_note:noteText});}
      if(act==='event-review'||act==='event-clear'||act==='event-confirm'){const noteText=$('event-note-'+id)?.value||'';const status=act==='event-review'?'reviewing':act==='event-clear'?'cleared':'confirmed';await rpc('kapli_mod_admin_review_event',{p_event_id:id,p_status:status,p_note:noteText});}
      note('Изменения сохранены.','ok');await loadAll();
    }catch(e){note(errorText(e),'error');}
    finally{button.disabled=false;}
  }
  function renderModerators(rows){
    if(!rows?.length)return '<p class="small">Назначенных модераторов пока нет.</p>';
    return rows.map(x=>'<article class="item"><div class="item-head"><b>🛡️ '+esc(x.nickname||'Игрок без профиля')+'</b><button class="warn" data-action="role-revoke" data-uid="'+esc(x.user_id)+'">Снять права</button></div><p class="small">UUID: '+esc(x.user_id)+' · назначен '+dt(x.granted_at)+'</p></article>').join('');
  }
  async function searchRolePlayers(){
    const q=$('roleSearch').value.trim();
    if(q.length<2){$('roleSearchResults').innerHTML='<p class="small">Введи минимум 2 символа ника.</p>';return;}
    $('roleSearchBtn').disabled=true;
    try{
      const rows=await rpc('kapli_mod_admin_find_players',{p_query:q});
      $('roleSearchResults').innerHTML=rows?.length?rows.map(x=>'<article class="item"><div class="item-head"><b>'+esc(x.nickname)+'</b><span class="tag">ID '+esc(x.public_id)+'</span></div><p class="small">UUID: '+esc(x.user_id)+'</p><button data-action="choose-role-player" data-uid="'+esc(x.user_id)+'" data-nick="'+esc(x.nickname)+'">Выбрать</button></article>').join(''):'<p class="small">Игрок не найден.</p>';
    }catch(e){$('roleSearchResults').innerHTML='<p class="small">'+esc(errorText(e))+'</p>';}
    finally{$('roleSearchBtn').disabled=false;}
  }
  async function loadModerators(){
    if(!isAdmin)return;
    try{$('moderatorsList').innerHTML=renderModerators(await rpc('kapli_mod_admin_list_moderators'));}
    catch(e){$('moderatorsList').innerHTML='<p class="small">'+esc(errorText(e))+'</p>';}
  }
  async function setModerator(on){
    if(!isAdmin){note('Назначать модераторов может только администратор.','error');return;}
    const uid=$('roleUserId').value.trim();
    if(!uid){note('Введи UUID аккаунта.','error');return;}
    const b=on?$('grantModerator'):$('revokeModerator');b.disabled=true;
    try{await rpc('kapli_mod_admin_set_moderator',{p_user_id:uid,p_on:on});note(on?'Модератор назначен.':'Роль модератора снята.','ok');await loadModerators();}
    catch(e){note(errorText(e),'error');}
    finally{b.disabled=false;}
  }
  $('loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;note('Входим…');try{const {data,error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;await boot(data.session);}catch(err){note(errorText(err),'error');}finally{b.disabled=false;}});
  $('logoutBtn').addEventListener('click',async()=>{await client.auth.signOut();showLoggedOut();});
  $('refreshBtn').addEventListener('click',async()=>{try{const d=await rpc('kapli_mod_admin_dashboard');renderStats(d);await loadAll();note('Данные обновлены.','ok');}catch(e){note(errorText(e),'error');}});
  $('searchBtn').addEventListener('click',searchPlayers);
  $('playerQuery').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchPlayers();}});
  $('applySanction').addEventListener('click',applySanction);
  $('roleSearchBtn').addEventListener('click',searchRolePlayers);
  $('roleSearch').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();searchRolePlayers();}});
  $('grantModerator').addEventListener('click',()=>setModerator(true));
  $('revokeModerator').addEventListener('click',()=>setModerator(false));
  $('sanctionKind').addEventListener('change',()=>$('minutesWrap').classList.toggle('hidden',$('sanctionKind').value==='ban'));
  $('tabs').addEventListener('click',e=>{const b=e.target.closest('[data-tab]');if(!b||b.classList.contains('hidden'))return;document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));['overview','players','queue','appeals','events','roles'].forEach(k=>$('tab-'+k).classList.toggle('hidden',k!==b.dataset.tab));});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b)action(b);});
  client.auth.getSession().then(({data})=>boot(data.session)).catch(()=>showLoggedOut());
  client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT')showLoggedOut();else if(session)boot(session);});
})();