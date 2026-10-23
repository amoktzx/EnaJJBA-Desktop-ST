/* Ena Desktop 1.0 Beta: locally editable applications, provenance, rollback and AI review. */
import {digest,messageKey,validateEvidence,safeMoney,parseExtraction} from './betaCore.js';
import {identityKeys,canPropose,exportFullSnapshot,validateFullSnapshot,countsFor} from './factLedger.js';

const TABLES={
 'salon:licenses':['Лицензии','Название / произведение','Формат, права, срок или примечание'],
 'salon:finance':['Доходы и расходы','Статья операции','За что получены / потрачены деньги'],
 'salon:tasks':['Задачи салона','Дело','Срок, исполнитель, примечание'],
 'salon:documents':['Документы','Наименование документа','Номер, дата, где лежит'],
 'salon:stock':['Носители для проката','Название / партия','Количество, формат и место'],
 'directory:people':['Люди','Имя','Что Ене действительно известно'],
 'directory:places':['Места','Название места','Адрес, ориентиры, что там есть'],
 'mail:inbox':['Входящие письма','Тема письма','Содержание'],
 'mail:sent':['Отправленные письма','Тема письма','Содержание'],
 'mail:drafts':['Черновики','Тема письма','Содержание'],
 'sms:inbox':['Полученные SMS','Имя / номер','Сообщение'],
 'sms:sent':['Отправленные SMS','Имя / номер','Сообщение'],
 'sms:drafts':['Черновики SMS','Имя / номер','Сообщение'],
 'gm:bank':['Банк / наличные','Операция или счёт','Обоснование, валюта, источник'],
 'gm:inventory':['Инвентарь','Предмет','Количество, владелец, местонахождение'],
 'gm:body':['Следы и травмы','След / травма','Где, чем получено, текущее состояние'],
 'gm:quests':['Основные задания','Задача','Условия и прогресс'],
 'gm:sidequests':['Побочные дела','Дело','Условия и прогресс'],
 'gm:knowledge':['Знания NPC','Персонаж и факт','Кто знает, кому верит, кто скрывает'],
 'gm:events':['Хронология','Событие','Когда, место, последствия'],
 'gm:risks':['Нерешённые обстоятельства','Факт / риск','Подтверждённое описание'],
 'notes:notes':['Личные заметки','Заголовок','Запись']
};
const SCOPE_OPTIONS={
 'archive:films':'Архив / фильм', 'archive:music':'Архив / музыка','archive:books':'Архив / книга','archive:anomalies':'Архив / аномалия',
 'salon:licenses':'Видеосалон / лицензия','salon:finance':'Видеосалон / финансы','salon:tasks':'Видеосалон / задача','salon:documents':'Видеосалон / документ','salon:stock':'Видеосалон / прокат',
 'mail:inbox':'Почта / входящие','mail:sent':'Почта / исходящие','sms:inbox':'SMS / входящие','sms:sent':'SMS / исходящие',
 'directory:people':'Справочник / люди','directory:places':'Справочник / места',
 'gm:bank':'GM / банк','gm:inventory':'GM / инвентарь','gm:body':'GM / внешние травмы','gm:quests':'GM / основное задание','gm:sidequests':'GM / побочное дело','gm:knowledge':'GM / знания NPC','gm:events':'GM / событие','gm:risks':'GM / обстоятельство'
};
const SCOPE_KEYS=Object.keys(SCOPE_OPTIONS);
const factLabels={objective:'Объективное событие',npc_knowledge:'Знание NPC',npc_suspicion:'Подозрение NPC'};
const appTabs={
 salon:[['overview','Главная'],['licenses','Лицензии'],['stock','Прокат'],['finance','Финансы'],['documents','Бумаги'],['tasks','Задачи']],
 directory:[['people','Люди'],['places','Места']],
 mail:[['inbox','Входящие'],['sent','Исходящие'],['drafts','Черновики']],
 sms:[['inbox','Входящие'],['sent','Отправленные'],['drafts','Черновики']],
 gm:[['overview','Обзор'],['bank','Банк'],['inventory','Инвентарь'],['body','Тело'],['quests','Задания'],['sidequests','Побочные'],['knowledge','Знания NPC'],['events','События'],['risks','Риски'],['sync','Синхронизация']]
};
const appTitles={salon:'Видеосалон',directory:'Справочник',mail:'Почта',sms:'SMS',gm:'GM • вне сюжета'};
const appEmpty={salon:'Ничего не добавлено. Не ведём учёт каждого посетителя.',directory:'Ена пока не знает записанных здесь людей или мест.',mail:'Никаких автоматически выдуманных писем.',sms:'Никаких автоматически выдуманных SMS.',gm:'Нет подтверждённых фактов.'};
const encode=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=()=>('e'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
const p=(s)=>`<p>${encode(s)}</p>`;
const dateTime=()=>new Date().toISOString();

export function createBeta({meta,ctx,settings,persistSettings,saveMeta,toast,fillWindow,ui,oldComputer,oldNotes}){
  let editor=null, proposalEditor=null, factTab='pending', filter='', extracting=false, lastChatRef=null, pendingTimer=null, lastChangeCount=0, fullScanRunning=false, fullScanStop=false;
  const defaultConfig={automatic:false,interval:50,review:true,connection:'active',profileId:'',maxContextMessages:50};
  function state(){
    const m=meta();
    if(!m.beta||typeof m.beta!=='object')m.beta={schema:1,records:[],proposals:[],history:[],syncCursor:null,syncRuns:0};
    const b=m.beta;
    for(const k of ['records','proposals','history'])if(!Array.isArray(b[k]))b[k]=[];
    if(!b.schema)b.schema=1;
    if(b.schema<2)b.schema=2;
    if(!b.linksMigrated){
      // Accepted facts created by older betas had no proposalId. Link their projection
      // to the accepted proposal so deletion also revokes that projection.
      for(const proposal of b.proposals.filter(p=>p.status==='approved'&&!p.linkedRecordId)){
        const matching=(item)=>item&&!item.proposalId&&item.title===proposal.title&&
          (item.scope===proposal.scope||proposal.scope.startsWith('archive:'))&&
          ((item.sources||item.autoSources||[]).some(src=>(proposal.sources||[]).some(ps=>ps.key===src.key)));
        const entry=proposal.scope.startsWith('archive:')?
          (m.archive?.[proposal.scope.split(':')[1]]||[]).find(matching):b.records.find(matching);
        if(entry){entry.proposalId=proposal.id;proposal.linkedRecordId=entry.id;}
      }
      b.linksMigrated=true;saveMeta();
    }
    if(!b.fullScan||typeof b.fullScan!=='object')b.fullScan={cursor:0,total:0,status:'idle',added:0,blocks:0};
    if(!b.migrated){
      // Copy old manual v0.1/v0.2 records WITHOUT deleting their originals, for reversible migration.
      const map=[['salon','licenses','salon:licenses'],['salon','tasks','salon:tasks'],['salon','documents','salon:documents'],['salon','transactions','salon:finance'],['directory','people','directory:people'],['directory','places','directory:places'],['gm','injuries','gm:body'],['gm','items','gm:inventory'],['gm','quests','gm:quests']];
      for(const [a,t,scope] of map)for(const x of m[a]?.[t]||[])b.records.push({id:x.id||key(),scope,title:x.title||'',detail:x.detail||'',manual:true,status:'approved',created:dateTime(),sources:[]});
      b.migrated=true;queueHistory('Миграция записей v0.2 в v1.0',false);
    }
    const s=settings();if(!s.enaSync)s.enaSync={...defaultConfig};
    for(const [k,v] of Object.entries(defaultConfig))if(s.enaSync[k]===undefined)s.enaSync[k]=v;
    return b;
  }
  function queueHistory(summary,persist=true){const b=meta().beta;if(!b)return;b.history.unshift({id:key(),time:dateTime(),summary});b.history=b.history.slice(0,250);if(persist)saveMeta();}
  const messages=()=>ctx()?.chat||[];
  // Read only the non-secret metadata of the profiles already saved in SillyTavern.
  function profiles(){
    const c=ctx();
    if(c?.extensionSettings?.disabledExtensions?.includes('connection-manager'))return [];
    return (c?.extensionSettings?.connectionManager?.profiles||[])
      .filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.api)
      .map(x=>({id:x.id,name:x.name,api:x.api,model:x.model||''}));
  }
  function selectedProviderLabel(){
    const s=settings().enaSync;
    if(!s.profileId||s.profileId==='active')return 'Активное подключение SillyTavern';
    const found=profiles().find(x=>x.id===s.profileId);
    return found?`${found.name} · ${found.model||found.api}`:'Профиль не найден — выбери другой';
  }
  function profileSelect(){
    const s=settings().enaSync;
    const opts=profiles().map(x=>`<option value="${encode(x.id)}" ${s.profileId===x.id?'selected':''}>${encode(x.name)} (${encode(x.model||x.api)})</option>`).join('');
    const missing=s.profileId&&s.profileId!=='active'&&!profiles().some(x=>x.id===s.profileId);
    return `<section class="ena-api-picker"><b>Модель для GM-трекера</b><label>Подключение <select data-beta-setting="profileId"><option value="active" ${!s.profileId||s.profileId==='active'?'selected':''}>Текущее подключение SillyTavern</option>${missing?`<option selected disabled value="${encode(s.profileId)}">⚠ Удалённый профиль — выбери другой</option>`:''}${opts}</select></label><p>Можно выбрать профиль OpenRouter, Route.me или другой из «Connection Manager». Запросы идут напрямую по сохранённому профилю, модель рассказчика не меняется. Ключи не сохраняются в Ena Desktop.</p>${!profiles().length?'<small>Сохранённых профилей не обнаружено. Создай профиль в SillyTavern → API Connections → Connection Profiles.</small>':''}</section>`;
  }
  async function requestAI(system,prompt){
    const c=ctx(), chosen=settings().enaSync.profileId||'active';
    if(chosen==='active'){
      if(typeof c?.generateRaw!=='function')throw Error('Активное подключение SillyTavern недоступно');
      return c.generateRaw({systemPrompt:system,prompt});
    }
    if(!profiles().some(x=>x.id===chosen))throw Error('Выбранный профиль подключения недоступен. Выбери другой в GM → Синхронизация');
    // Official ST request service uses the selected profile without changing the narrator connection.
    const {ConnectionManagerRequestService:service}=await import('/scripts/extensions/shared.js');
    const messages=[{role:'system',content:system},{role:'user',content:prompt}];
    const formatted=service.constructPrompt(messages,chosen);
    const result=await service.sendRequest(chosen,formatted,3072,{stream:false,extractData:true});
    if(typeof result==='string')return result;
    if(typeof result?.content==='string')return result.content;
    throw Error('Профиль вернул ответ без текстового содержимого');
  }

  const valid=r=>validateEvidence(r.sources||[],messages());
  const records=scope=>state().records.filter(r=>r.scope===scope&&!r.deleted&&valid(r));
  const allActive=()=>state().records.filter(r=>!r.deleted&&valid(r));
  function renderRows(scope,app){const a=records(scope),q=filter.trim().toLocaleLowerCase('ru');const rows=q?a.filter(x=>JSON.stringify([x.title,x.detail,x.extra,x.person,x.date]).toLocaleLowerCase('ru').includes(q)):a;
    if(!rows.length)return `<div class="ena-beta-empty"><div class="ena-beta-folder">▣</div>${p(appEmpty[app]||'Пока записей нет')}<small>${scope.startsWith('gm:')?'Факты GM не передаются в ноутбук Ены.':'Можно добавить вручную или подтвердить событие в синхронизации.'}</small></div>`;
    return `<div class="ena-beta-records">${rows.map(r=>`<article class="ena-beta-record" data-record="${encode(r.id)}"><div class="ena-beta-record-main"><b>${encode(r.title)}</b><small>${encode(r.date||r.created?.slice(0,10)||'')}</small></div><div class="ena-beta-record-detail">${encode(r.detail||'')}</div><div class="ena-beta-record-meta">${r.extra?`<span>${encode(r.extra)}</span>`:''}${r.amount!==undefined&&r.amount!==''?`<span>${encode(r.amount)} ${encode(r.currency||'₤')}</span>`:''}${r.status==='done'?'<span>✓ Завершено</span>':''}${r.factType?`<span>${encode(factLabels[r.factType]||r.factType)}</span>`:''}${r.sources?.length?'<span title="Проверяется по сообщению чата">◉ Источник в чате</span>':'<span>✎ Ручная запись</span>'}<button data-beta="edit" data-id="${encode(r.id)}" type="button">Изменить</button><button data-beta="delete" data-id="${encode(r.id)}" type="button">Удалить</button></div></article>`).join('')}</div>`;
  }
  function heading(title){return `<div class="ena-toolbar"><b>${encode(title)}</b><small>Ena Desktop • 2001</small></div>`;}
  function tabs(app){return `<div class="ena-tabs">${appTabs[app].map(([k,t])=>`<button class="ena-tab ${ui.tab[app]===k?'ena-tab-on':''}" data-tab-group="${app}" data-tab="${k}">${encode(t)}</button>`).join('')}</div>`;}
  function paneHeader(label){return `<div class="ena-beta-controls"><b>${encode(label)}</b><label>Поиск <input data-beta-input="search" value="${encode(filter)}" placeholder="Поиск в этом окне…"></label><button data-beta="new" type="button">+ Добавить</button></div>`;}
  function activeScope(app){return app+':'+(ui.tab[app]||appTabs[app]?.[0][0]);}
  function summaryPanel(app){
    const b=state(),scopes=Object.entries(TABLES).filter(([k])=>k.startsWith(app+':'));
    const counters=scopes.map(([k,v])=>`<div class="ena-beta-metric"><strong>${records(k).length}</strong><span>${encode(v[0])}</span></div>`).join('');
    const financeRecords=records(app==='gm'?'gm:bank':'salon:finance');
    const byCurrency=new Map();for(const r of financeRecords){const currency=r.currency||'₤',n=safeMoney(r.amount);byCurrency.set(currency,(byCurrency.get(currency)||0)+n);}
    const finances=financeRecords.length?'<div class="ena-beta-banner"><b>Учтённые денежные движения (не остаток на счёте)</b>'+[...byCurrency].map(([currency,sum])=>`<p>${encode(currency)}: ${sum.toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>`).join('')+'</div>':'';
    let intro=app==='salon'?'Деловой учёт: лицензии и копии для проката, документы, задачи, общие суммы. Ни один фильм не попадает отсюда в личные ачивки.':'Только подтверждённые игровые факты: финансы, вещи, внешние травмы, дела и знания персонажей. Без параметров энергии и стресса.';
    return `<div class="ena-content ena-scroll ena-beta-space"><div class="ena-beta-banner"><b>${app==='gm'?'Панель ведущего — вне сюжета':'Видеосалон Ены'}</b>${p(intro)}</div><div class="ena-beta-metrics">${counters}</div>${finances}<div class="ena-beta-notice">Предложений на проверку: <b>${b.proposals.filter(x=>x.status==='pending'&&valid(x)).length}</b> · Записи, потерявшие сообщение-источник, скрываются и помечаются в журнале.</div>${app==='gm'?`<button data-beta="go-sync">Проверить синхронизацию →</button>`:''}</div>`;
  }
  function view(app){const b=state();if(app==='computer')return computer();if(app==='notes')return notes();if(!appTabs[app])return '';
    const tab=ui.tab[app]||appTabs[app][0][0];
    if(app==='gm'&&tab==='sync')return heading('GM • синхронизация')+tabs(app)+syncView();
    if(tab==='overview')return heading(app==='gm'?'GM Control':'Видеосалон')+tabs(app)+summaryPanel(app);
    const scope=app+':'+tab;
    const label=TABLES[scope]?.[0]||appTitles[app];
    return heading(label)+tabs(app)+paneHeader(label)+`<div class="ena-content ena-scroll ena-beta-space">${renderRows(scope,app)}</div>${editor?.app===app?editorHTML():''}`;
  }
  function notes(){state();return oldNotes()+`<div class="ena-beta-notes-footer"><button data-beta="notes-list">+ Отдельная заметка</button> <span>Личные мысли за Ену пишет только игрок.</span></div><div class="ena-content ena-scroll ena-beta-space">${renderRows('notes:notes','notes')}</div>${editor?.app==='notes'?editorHTML():''}`;}
  function computer(){const s=settings().enaSync;const extra=`<section class="ena-beta-settings-extension"><h3>ИИ и синхронизация • Beta</h3>${profileSelect()}<label><input data-beta-setting="automatic" type="checkbox" ${s.automatic?'checked':''}> Проверять новые блоки автоматически</label><label>Порог сообщений <select data-beta-setting="interval">${[25,50,75,100].map(n=>`<option value="${n}" ${Number(s.interval)===n?'selected':''}>${n}</option>`).join('')}</select></label><label><input data-beta-setting="review" type="checkbox" ${s.review?'checked':''}> Показывать предложения перед применением</label><p class="ena-beta-warning">Даже при отключении подтверждения в этой бете изменения не применяются автоматически. Это защита от ложных сюжетных фактов.</p><button data-beta="scan-last">Проверить последние ${Number(s.interval)||50} сообщений</button><button data-beta="export">⬇ Полный экспорт JSON</button><button type="button" data-beta="choose-import">⬆ Импорт JSON</button><input class="ena-beta-file-hidden" data-beta-input="import" type="file" accept="application/json,.json"><p>Записи сохраняются в метаданных чата. Обои — локально в браузере. При обновлении расширения делай резервную копию.</p></section>`;return oldComputer().replace(/Никаких API-запросов и затрат токенов в этой версии\./,'Автоматическая синхронизация включается ниже отдельно.').replace(/<\/div>$/i,extra+'</div>');}
  function editorHTML(){const scope=editor.scope,r=editor.id?state().records.find(x=>x.id===editor.id):null;const def=TABLES[scope]||['Запись','Название','Подробности'];const finance=scope.endsWith('finance')||scope.endsWith('bank');const isCommunication=scope.startsWith('mail:')||scope.startsWith('sms:');
    return `<div class="ena-editor-backdrop"><form class="ena-beta-editor ena-editor" data-beta-form="record" data-id="${encode(editor.id||'')}"><div class="ena-editor-head"><b>${r?'Изменить':'Добавить'} · ${encode(def[0])}</b><button type="button" data-beta="cancel">×</button></div><label>${encode(def[1])} <input name="title" maxlength="180" required value="${encode(r?.title||'')}"></label><label>${encode(def[2])}<textarea name="detail" rows="5" maxlength="3000">${encode(r?.detail||'')}</textarea></label><div class="ena-beta-form-grid"><label>${isCommunication?'От кого / кому':'Дополнительно / местоположение'}<input name="extra" maxlength="280" value="${encode(r?.extra||'')}"></label><label>Дата в сюжете <input name="date" maxlength="80" placeholder="например, 30.04.2001" value="${encode(r?.date||'')}"></label>${finance?`<label>Сумма (+ доход, − расход)<input name="amount" type="number" step="0.01" value="${encode(r?.amount??'')}"></label><label>Валюта <input name="currency" maxlength="12" value="${encode(r?.currency||'₤')}"></label>`:''}<label>Статус <select name="status"><option value="active" ${(r?.status||'active')==='active'?'selected':''}>Активно</option><option value="done" ${r?.status==='done'?'selected':''}>Завершено / исполнено</option><option value="planned" ${r?.status==='planned'?'selected':''}>В планах</option></select></label><label>№ сообщения-основания (необязательно)<input name="messageIndex" type="number" min="0" max="999999" placeholder="Например, 1100"></label></div><small>Если укажешь сообщение-основание, при удалении/редактировании/смене свайпа запись автоматически скрывается. Ручные записи без источника не удаляются.</small><div class="ena-beta-form-actions"><button type="submit">Сохранить</button><button type="button" data-beta="cancel">Отмена</button></div></form></div>`;
  }
  function proposalEditorHTML(){
    if(!proposalEditor)return '';
    const p=state().proposals.find(x=>x.id===proposalEditor.id);
    if(!p||p.status!=='pending')return '';
    const split=proposalEditor.mode==='split';
    const scopeOptions=(selected)=>SCOPE_KEYS.map(x=>`<option value="${encode(x)}" ${x===selected?'selected':''}>${encode(SCOPE_OPTIONS[x])}</option>`).join('');
    const factOptions=(selected)=>Object.entries(factLabels).map(([x,t])=>`<option value="${encode(x)}" ${x===selected?'selected':''}>${encode(t)}</option>`).join('');
    const sources=(chosen='all')=>`<select name="${chosen==='all'?'evidence':'evidence2'}"><option value="all">Все указанные источники</option>${(p.sources||[]).map((x,i)=>`<option value="${i}">Только #${x.index}</option>`).join('')}</select>`;
    const titlePart=(n,title,detail,scope,kind)=>`<fieldset class="ena-beta-fact-edit"><legend>Факт ${n}</legend><label>Категория<select name="scope${n}">${scopeOptions(scope)}</select></label><label>Тип факта<select name="factType${n}">${factOptions(kind)}</select></label><label>Название<input name="title${n}" required maxlength="160" value="${encode(title)}"></label><label>Факт, без интерпретаций<textarea name="detail${n}" rows="4" maxlength="1600" required>${encode(detail)}</textarea></label><label>Основание ${sources(n===1?'all':'second').replace('name="evidence"','name="source1"').replace('name="evidence2"','name="source2"')}</label></fieldset>`;
    return `<div class="ena-editor-backdrop"><form class="ena-beta-editor ena-editor ena-beta-proposal-editor" data-beta-form="proposal" data-id="${encode(p.id)}" data-mode="${split?'split':'edit'}"><div class="ena-editor-head"><b>${split?'Разделить предложение':'Редактировать предложение'}</b><button type="button" data-beta="cancel-proposal">×</button></div><p>Редактирование меняет только предложение, не текст ролевого чата. При разделении два факта будут подтверждаться независимо.</p>${titlePart(1,p.title,p.detail,p.scope,p.factType||'objective')}${split?titlePart(2,'','',p.scope,p.factType||'objective'):''}<small>Источники: ${encode((p.sources||[]).map(x=>'#'+x.index).join(', '))}. Если подтверждения недостаточно, отклони запись и уточни сюжет.</small><div class="ena-beta-form-actions"><button type="submit">${split?'Создать 2 предложения':'Сохранить правки'}</button><button type="button" data-beta="cancel-proposal">Отмена</button></div></form></div>`;
  }
  function syncView(){const b=state(),s=settings().enaSync,c=messages();const pending=b.proposals.filter(p=>p.status==='pending');const shown=b.proposals.filter(p=>p.status===factTab);const counts=countsFor(b);const invalid=b.records.filter(r=>!r.deleted&&r.sources?.length&&!valid(r));
    const cards=shown.map(x=>`<article class="ena-beta-proposal ${valid(x)?'':'ena-beta-invalid'}"><b>${encode(SCOPE_OPTIONS[x.scope]||x.scope)} • ${encode(x.title)}</b><div class="ena-fact-badge">${encode(factLabels[x.factType||'objective'])}</div><p>${encode(x.detail)}</p>${x.quote?`<blockquote>${encode(x.quote)}</blockquote>`:''}<small>Источник: ${encode(x.sources?.map(z=>'#'+z.index).join(', ')||'—')} ${valid(x)?'✓ присутствует':'⚠ изменён или удалён'} · ${encode(x.confidence||'не оценена')}</small>
    <details class="ena-beta-preview"><summary>Как изменится база после подтверждения?</summary><div><b>${encode(SCOPE_OPTIONS[x.scope]||x.scope)} → новая запись</b><p>${encode(x.title)}</p><p>${encode(x.detail)}</p><small>${encode(factLabels[x.factType||'objective'])}; ${x.sources?.map(z=>'#'+z.index).join(', ')||'—'}</small></div></details>
    <div class="ena-beta-proposal-actions">${x.status==='pending'?`<button data-beta="approve" data-id="${encode(x.id)}" ${valid(x)?'':'disabled'}>Подтвердить</button><button data-beta="edit-proposal" data-id="${encode(x.id)}">✎ Изменить</button><button data-beta="split-proposal" data-id="${encode(x.id)}">Разделить</button><button data-beta="reject" data-id="${encode(x.id)}">Отклонить</button>`:x.status==='deleted'?`<button data-beta="restore-proposal" data-id="${encode(x.id)}">Восстановить на рассмотрение</button>`:`<button data-beta="restore-proposal" data-id="${encode(x.id)}">Вернуть на рассмотрение</button>`}<button data-beta="delete-proposal" data-id="${encode(x.id)}" ${x.status==='deleted'?'disabled':''}>Удалить</button></div></article>`).join('');
    const f=b.fullScan||{cursor:0,total:0,status:'idle',added:0,blocks:0};
    const progress=f.total?Math.min(100,Math.round((f.cursor||0)/f.total*100)):0;
    const work=fullScanRunning?`<button data-beta="scan-stop" type="button">■ Остановить после текущего блока</button>`:
       `<button data-beta="scan-all" type="button">Проверить весь чат (${c.length} сообщений)</button>${f.cursor>0&&f.cursor<f.total?'<button data-beta="scan-resume" type="button">▶ Продолжить полную проверку</button>':''}`;
    const progressBar=f.total?`<div class="ena-scan-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><p>Полный проход: ${f.cursor||0} / ${f.total||0} сообщений · ${progress}% · блоков ${f.blocks||0} · новых предложений ${f.added||0} · ${encode(f.status||'')}</p>`:'';
    return `<div class="ena-content ena-scroll ena-beta-space"><div class="ena-beta-banner"><b>Источник ИИ: ${encode(selectedProviderLabel())}</b><p>Выбранный профиль GM не переключает модель рассказчика. Результаты записываются только после твоего подтверждения.</p>${profileSelect()}<p>Обработано блоков: ${b.syncRuns||0}; сообщений в чате: ${c.length}; текущая позиция: ${b.syncCursor===null?'ещё не задана':b.syncCursor}.</p></div>
      <div class="ena-beta-controls"><button data-beta="scan-last" ${extracting?'disabled':''}>Последние ${Number(s.interval||50)} сообщений</button><button data-beta="scan-new" ${extracting?'disabled':''}>Новые сообщения</button>${work}<button data-beta="export">⬇ Полный экспорт JSON</button><button type="button" data-beta="choose-import">⬆ Импорт JSON</button><input class="ena-beta-file-hidden" data-beta-input="import" type="file" accept="application/json,.json"></div>
      <div class="ena-beta-notice">Полная проверка выполняется порциями по ${Number(s.interval)||50} сообщений через выбранный API-профиль. Каждая порция — отдельный платный запрос; можно остановить и возобновить. Принятые, на рассмотрении и отклонённые предложения блокируют повторное появление по тому же источнику и цитате. Удалённые — не блокируют. Импорт/экспорт включает ВСЮ базу со статусами и историей.</div>${progressBar}
      <div class="ena-fact-status-tabs">${[['pending','На рассмотрении'],['approved','Принятые'],['rejected','Отклонённые'],['deleted','Удалённые']].map(([k,v])=>`<button type="button" data-beta="fact-tab" data-value="${k}" class="${factTab===k?'ena-fact-status-active':''}">${v} (${counts[k]})</button>`).join('')}</div><h3>Факты: ${counts[factTab]||0}</h3>${cards||'<p>В этой категории пока нет записей.</p>'}<h3>Основания после откатов (${invalid.length})</h3>${invalid.map(r=>`<p class="ena-beta-warning">⚠ ${encode(r.title)} — источник удалён или изменён, запись скрыта.</p>`).join('')||'<p>Осиротевших записей нет.</p>'}<h3>Журнал</h3><div class="ena-beta-log">${b.history.slice(0,40).map(x=>`<div><small>${encode(x.time?.slice(0,16).replace('T',' ')||'')}</small> ${encode(x.summary)}</div>`).join('')}</div></div>${proposalEditorHTML()}`;
  }
  function removeLinkedFact(p){
    const b=state();
    for(const r of b.records)if(r.proposalId===p.id||(p.linkedRecordId&&r.id===p.linkedRecordId))r.deleted=true;
    for(const cat of ['films','music','books','anomalies'])for(const r of meta().archive[cat]||[])
      if(r.proposalId===p.id||(p.linkedRecordId&&r.id===p.linkedRecordId))r.deleted=true;
  }
  function proposalForRecord(id){return state().proposals.find(p=>p.linkedRecordId===id);}
  function deleteLinkedRecord(id){const p=proposalForRecord(id);if(p){p.status='deleted';p.deletedAt=dateTime();queueHistory('Удалён факт из каталога: '+p.title);}return !!p;}
  function mutateRecord(scope,fields,previous=null,sources=[]){const b=state();if(previous){Object.assign(previous,fields);previous.sources=sources.length?sources:previous.sources||[];const linked=state().proposals.find(x=>x.id===previous.proposalId);if(linked){linked.title=previous.title;linked.detail=previous.detail;linked.scope=previous.scope;linked.date=previous.date||'';}queueHistory('Изменено вручную: '+previous.title);}else{b.records.push({id:key(),scope,created:dateTime(),manual:true,...fields,sources});queueHistory('Добавлено вручную: '+fields.title);}saveMeta();}
  function action(type,el){if(!el.closest('#ena-desktop-root'))return false;
    if(type==='scan-last'||type==='scan-new'){if(fullScanRunning){toast('Сначала останови полную проверку');return true;}void scan(type==='scan-last');return true;}
    if(type==='scan-all'){void scanWholeChat(false);return true;}
    if(type==='scan-resume'){void scanWholeChat(true);return true;}
    if(type==='scan-stop'){fullScanStop=true;toast('Остановка после текущего запроса');return true;}
    if(type==='choose-import'){const input=el.closest('.ena-window')?.querySelector('input[data-beta-input="import"]');if(!input){toast('Поле импорта недоступно');return true;}input.value='';input.click();return true;}
    if(type==='edit-proposal'||type==='split-proposal'){const rec=state().proposals.find(x=>x.id===el.dataset.id);if(!rec||rec.status!=='pending')return true;proposalEditor={id:rec.id,mode:type==='split-proposal'?'split':'edit'};fillWindow('gm');return true;}
    if(type==='cancel-proposal'){proposalEditor=null;fillWindow('gm');return true;}
    if(type==='go-sync'){ui.tab.gm='sync';fillWindow('gm');return true;}
    if(type==='new'){const app=el.closest('.ena-window')?.dataset.app;let scope=activeScope(app);if(!TABLES[scope])return true;editor={app,scope,id:null};fillWindow(app);return true;}
    if(type==='edit'){const r=state().records.find(x=>x.id===el.dataset.id);if(!r)return true;editor={app:r.scope.split(':')[0],scope:r.scope,id:r.id};fillWindow(editor.app);return true;}
    if(type==='cancel'){const app=editor?.app;editor=null;if(app)fillWindow(app);return true;}
    if(type==='fact-tab'){factTab=el.dataset.value||'pending';fillWindow('gm');return true;}
    if(type==='delete-proposal'||type==='restore-proposal'){
      const b=state(),p=b.proposals.find(x=>x.id===el.dataset.id);if(!p)return true;
      if(type==='delete-proposal'){
        if(!confirm('Удалить факт «'+p.title+'»? Он перестанет блокировать повторное обнаружение при следующем анализе.'))return true;
        removeLinkedFact(p);
        p.status='deleted';p.deletedAt=dateTime();queueHistory('Удалено из журнала фактов: '+p.title);
      }else{
        // Restored facts return for human review, not to approved state automatically.
        if(b.proposals.some(other=>other.id!==p.id&&other.status!=='deleted'&&canPropose(p,[other])===false)){
          toast('Такой факт уже есть в базе. Сначала удали повтор.');return true;
        }
        removeLinkedFact(p);p.status='pending';delete p.deletedAt;
        queueHistory('Возвращено на рассмотрение: '+p.title);
      }
      saveMeta();fillWindow('gm');if(p.scope.startsWith('archive:'))fillWindow('archive');else fillWindow(p.scope.split(':')[0]);return true;
    }
    if(type==='delete'){const r=state().records.find(x=>x.id===el.dataset.id);if(!r)return true;if(!confirm('Удалить запись «'+r.title+'»? Это не меняет текст ролки.'))return true;r.deleted=true;const linked=state().proposals.find(p=>p.id===r.proposalId||p.linkedRecordId===r.id);if(linked){linked.status='deleted';linked.deletedAt=dateTime();}queueHistory('Удалена запись: '+r.title);fillWindow(r.scope.split(':')[0]);return true;}
    if(type==='approve'||type==='reject'){const p=state().proposals.find(x=>x.id===el.dataset.id);if(!p)return true;if(type==='approve'&&!valid(p)){toast('Основание изменено: нельзя подтвердить');return true;}
      p.status=type==='reject'?'rejected':'approved';if(type==='approve'){
        const fields={title:p.title,detail:p.detail,extra:p.extra||'',date:p.date||'',status:'active',factType:p.factType||'objective'};
        if(p.scope.startsWith('archive:')){
          const cat=p.scope.split(':')[1];const a=meta().archive[cat];const recordId=key();p.linkedRecordId=recordId;a.push({id:recordId,proposalId:p.id,title:p.title,detail:p.detail,year:p.year||'',progress:cat==='anomalies'?'found':({films:['seen','started','planned'],books:['read','started','planned'],music:['listened','started','planned']}[cat]||[]).includes(p.progress)?p.progress:'planned',ownership:p.owned?'personal':'unknown',source:p.sources?.map(x=>'#'+x.index).join(', '),autoSources:p.sources,standStatus:'unknown'});
        }else {const recordId=key();p.linkedRecordId=recordId;state().records.push({id:recordId,proposalId:p.id,scope:p.scope,...fields,amount:p.amount??'',currency:p.currency||'₤',sources:p.sources,manual:false,created:dateTime()});}
      }queueHistory((type==='approve'?'Подтверждено: ':'Отклонено: ')+p.title);fillWindow('gm');if(p.scope.startsWith('archive:'))fillWindow('archive');return true;}
    if(type==='export'){
      const data=exportFullSnapshot(meta(),messages().map(messageKey).filter(Boolean));
      downloadSnapshot(data);toast('Полная база GM и ноутбука экспортирована');return true;
    }
    if(type==='notes-list'){editor={app:'notes',scope:'notes:notes',id:null};fillWindow('notes');return true;}
    return false;
  }
  function submit(form,ev){
    if(form.dataset.betaForm==='proposal'){
      ev.preventDefault();const p=state().proposals.find(x=>x.id===form.dataset.id);
      if(!p||p.status!=='pending'||!valid(p)){toast('Предложение или его источник больше недоступны');return true;}
      const fd=new FormData(form),split=form.dataset.mode==='split';
      const parts=[];
      for(let n=1;n<=(split?2:1);n++){
        const scope=String(fd.get('scope'+n)||''),kind=String(fd.get('factType'+n)||''),title=String(fd.get('title'+n)||'').trim().slice(0,160),detail=String(fd.get('detail'+n)||'').trim().slice(0,1600);
        const sourceChoice=String(fd.get('source'+n)||'all');
        const sources=sourceChoice==='all'?p.sources:([p.sources[Number(sourceChoice)]].filter(Boolean));
        if(!SCOPE_KEYS.includes(scope)||!factLabels[kind]||!title||!detail||!sources?.length){toast('Заполни оба факта и выбери подходящие источники');return true;}
        if(kind!=='objective'&&scope!=='gm:knowledge'){toast('Знания и подозрения NPC записываются только в GM → Знания NPC');return true;}
        parts.push({scope,factType:kind,title,detail,sources:structuredClone(sources)});
      }
      if(split){
        p.status='split';p.splitAt=dateTime();
        for(const part of parts){
          // Never preserve a quote from another message after the evidence was split.
          const quote=part.sources.some(src=>messages().some(m=>messageKey(m)===src.key&&String(m.mes||'').includes(p.quote||'__quote-missing__')))?p.quote:'';
          state().proposals.push({...p,...part,quote,id:key(),status:'pending',signature:digest([part.scope,part.factType,part.title,part.detail,...part.sources.map(x=>x.key)].join('|')),splitFrom:p.id,created:dateTime()});
        }
        queueHistory('Разделено на два факта: '+p.title);
      }else{
        const part=parts[0];if(!p.originalBeforeEdit)p.originalBeforeEdit={title:p.title,detail:p.detail,scope:p.scope,factType:p.factType||'objective',sources:p.sources};
        Object.assign(p,part);if(p.quote&&!p.sources.some(src=>messages().some(m=>messageKey(m)===src.key&&String(m.mes||'').includes(p.quote))))p.quote='';p.signature=digest([p.scope,p.factType,p.title,p.detail,...p.sources.map(x=>x.key)].join('|'));
        queueHistory('Исправлено предложение: '+p.title);
      }
      proposalEditor=null;saveMeta();fillWindow('gm');toast(split?'Созданы два независимых предложения':'Предложение изменено');return true;
    }
    if(form.dataset.betaForm!=='record')return false;ev.preventDefault();const fd=new FormData(form);const target=editor?.app,scope=editor?.scope;if(!scope)return true;
    const title=String(fd.get('title')||'').trim();if(!title)return true;
    const old=editor.id?state().records.find(x=>x.id===editor.id):null;
    const sourceIndex=String(fd.get('messageIndex')||'').trim();let sources=old?.sources||[];
    if(sourceIndex){const i=Number(sourceIndex),message=messages()[i];if(!message||!messageKey(message)){toast('Такого сообщения в текущем чате нет');return true;}sources=[{index:i,key:messageKey(message)}];}
    const fields={title:title.slice(0,180),detail:String(fd.get('detail')||'').slice(0,3000),extra:String(fd.get('extra')||'').slice(0,280),date:String(fd.get('date')||'').slice(0,80),status:String(fd.get('status')||'active'),amount:fd.has('amount')?String(fd.get('amount')||''):'',currency:String(fd.get('currency')||'₤').slice(0,12)};
    mutateRecord(scope,fields,old,sources);editor=null;fillWindow(target);toast('Запись сохранена');return true;
  }
  function change(el,ev){if(el.dataset.betaSetting){const s=settings().enaSync;const name=el.dataset.betaSetting;s[name]=el.type==='checkbox'?el.checked:name==='profileId'?String(el.value):Number(el.value)||50;persistSettings();if(name==='profileId'){toast('Профиль GM: '+selectedProviderLabel());fillWindow('gm');}return true;}
    if(el.dataset.betaInput==='import'){const file=el.files?.[0];if(file)void importBackup(file);return true;}
    return false;
  }
  function input(el){if(el.dataset.betaInput==='search'){filter=el.value;const app=el.closest('.ena-window')?.dataset.app;const content=el.closest('.ena-window')?.querySelector('.ena-beta-records,.ena-beta-empty');if(app&&TABLES[activeScope(app)]){const temp=document.createElement('div');temp.innerHTML=renderRows(activeScope(app),app);const container=el.closest('.ena-window')?.querySelector('.ena-content');if(container)container.innerHTML=temp.innerHTML;}return true;}return false;}
  function downloadSnapshot(payload){
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),object=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=object;link.download='EnaDesktop_FULL_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),5000);
  }
  function reconcileAcceptedFacts(){
    // An accepted proposal is the canonical editable fact; the archive/record is its
    // materialized view. This makes editing only data.beta.proposals in ChatGPT sufficient.
    const b=state();
    for(const p of b.proposals.filter(x=>x.linkedRecordId)){
      // Link by proposalId first: a fact may have been moved to another scope in edited JSON.
      const candidate=[...b.records,...Object.values(meta().archive||{}).flat()];
      const dest=candidate.find(x=>x.proposalId===p.id||x.id===p.linkedRecordId);
      if(!dest)continue;
      dest.deleted=p.status!=='approved';
      if(p.status!=='approved')continue;
      dest.title=p.title;dest.detail=p.detail;
      if(!p.scope.startsWith('archive:')){dest.scope=p.scope;dest.factType=p.factType;dest.date=p.date||dest.date;}
      dest.proposalId=p.id;
    }
  }
  async function importBackup(file){
    if(fullScanRunning||extracting){toast('Дождись завершения анализа перед импортом');return;}
    if(file.size>25_000_000){toast('Файл больше 25 МБ');return;}
    let parsed,validated;
    try {parsed=JSON.parse(await file.text());validated=validateFullSnapshot(parsed);}
    catch(e){toast('Неверный формат JSON: '+e.message);return;}
    const {data,chatFingerprint}=validated;
    const currentFingerprint=digest(messages().map(messageKey).filter(Boolean).join('|'));
    if(chatFingerprint&&chatFingerprint!==currentFingerprint&&
       !confirm('Этот файл сделан для другой версии чата. Привязанные к сообщениям факты могут скрыться. Продолжить?'))return;
    const counts=countsFor(data.beta);
    const message=`Импорт ЗАМЕНИТ ВСЮ базу ноутбука текущего чата: ${data.beta.records.length} записей, `+
      `${data.beta.proposals.length} фактов (на рассмотрении ${counts.pending}, принятых ${counts.approved}, `+
      `отклонённых ${counts.rejected}, удалённых ${counts.deleted}). `+
      'Перед заменой автоматически скачается резервная копия текущего состояния. Продолжить?';
    if(!confirm(message))return;
    const bag=activeChatKey();
    try {
      downloadSnapshot(exportFullSnapshot(meta(),messages().map(messageKey).filter(Boolean)));
      if(bag!==activeChatKey())throw Error('Чат изменился — импорт остановлен');
      const target=meta(),restore=structuredClone(data);
      for(const k of ['archive','salon','directory','gm','notes','gameDate','gameTime','beta'])if(restore[k]!==undefined)target[k]=restore[k];
      state();reconcileAcceptedFacts();saveMeta();editor=null;proposalEditor=null;factTab='pending';markInvalid();
      toast('Полная база импортирована — все статусы сохранены');
      for(const a of ['archive','salon','directory','gm','notes','mail','sms'])fillWindow(a);
    }catch(e){console.error('[EnaDesktop] import failed',e);toast('Ошибка импорта: '+e.message);}
  }
  function markInvalid(){const b=state();const invalid=b.records.filter(r=>!r.deleted&&r.sources?.length&&!valid(r));const newly=invalid.filter(r=>!r.notifiedInvalid);
    newly.forEach(r=>{r.notifiedInvalid=true;queueHistory('Откат: основание «'+r.title+'» отсутствует',false);});
    b.records.filter(r=>r.notifiedInvalid&&valid(r)).forEach(r=>{r.notifiedInvalid=false;queueHistory('Источник восстановлен: '+r.title,false);});
    const archiveMissing=Object.values(meta().archive||{}).flat().filter(r=>!r.deleted&&r.autoSources?.length&&!archiveValid(r));
    const old=b.lastInvalidCount||0;b.lastInvalidCount=invalid.length+archiveMissing.length;
    // Do not reset cursor on edit/delete; pending changes are still reviewed, no auto-fact magic.
    if(newly.length||old!==invalid.length+archiveMissing.length)saveMeta();
    if(newly.length)toast('Откат: '+newly.length+' записей скрыто (потерян источник)');
    if(ui.windows?.has('gm'))fillWindow('gm');
  }
  function archiveValid(record){return !record?.deleted&&validateEvidence(record?.autoSources||[],messages());}
  function syncLinkedArchiveRecord(record){
    const p=state().proposals.find(x=>x.id===record?.proposalId);if(!p)return;
    p.title=record.title;p.detail=record.detail||'';
    p.year=record.year||'';p.progress=record.progress||'';
    p.owned=record.ownership==='personal';saveMeta();
  }
  function activeChatKey(){return ctx()?.chatMetadata || null;}
  // A single sequential chunk. Returns null on failure / chat switch, and never
  // silently skips a failed chunk. Full-chat mode stores its own resumable cursor.
  async function scanChunk(start, limit, {updateCursor=true}={}){
    if(extracting)return null;
    const c=ctx();if(!c){toast('SillyTavern недоступна');return null;}
    const bag=activeChatKey(),b=state(),chat=messages(),end=Math.min(chat.length,start+limit);
    const portion=chat.slice(start,end).map((x,i)=>({index:start+i,key:messageKey(x),speaker:x.is_user?'Ена/пользователь':'Рассказчик',text:(()=>{const m=String(x.mes||'');return m.length>5000?m.slice(0,2600)+'\n[... фрагмент длинного сообщения пропущен ...]\n'+m.slice(-2300):m;})()})).filter(x=>x.key&&x.text.trim());
    if(end<=start)return {next:end,added:0};
    if(!portion.length){if(updateCursor){b.syncCursor=Math.max(b.syncCursor??0,end);saveMeta();}return {next:end,added:0};}
    extracting=true;toast('Проверяю сообщения '+(start+1)+'–'+end+' · '+selectedProviderLabel());if(ui.windows.has('gm'))fillWindow('gm');
    const system=`Ты строгий экстрактор СОБЫТИЙ для ролевой игры JoJo (Неаполь 2001), а не рассказчик. Верни ТОЛЬКО JSON: {"changes":[{"scope":"gm:inventory","factType":"objective","title":"...","detail":"...","message_ids":["m0"],"quote":"точная короткая цитата из указанного сообщения","confidence":"high","progress":"planned","owned":false}]} .
Доступные scope: ${SCOPE_KEYS.join(', ')}. События ТОЛЬКО прямо подтверждённые текстом: явно приобретённый предмет, просмотренный Еной фильм, полученное письмо или SMS, изменение баланса, конкретная травма, выполненное задание, открытое место или знание NPC. Простое УПОМИНАНИЕ произведения не означает просмотр. Для личных archive:films progress=seen ТОЛЬКО при реально подтверждённом просмотре; для books=read, для music=listened, иначе planned. Поле owned=true ТОЛЬКО если Ена купила копию ДЛЯ СЕБЯ. Покупка лицензии для видеосалона НЕ добавляет фильм в личный архив. Личные мысли Ены не придумывать. Никогда не переносить в личные записи Ены сведения, известные только GM. Не создавать эфирных богов, меметическое заражение, опасность просмотра VHS без подтверждения. ОДИН факт = ОДНА запись. Никогда не объединяй уборку, передачу ключа и назначенную встречу в один факт. Для подозрения NPC используй scope=gm:knowledge и factType=npc_suspicion, подчеркни, что это субъективное подозрение, не истина; для реально полученного знания NPC scope=gm:knowledge, factType=npc_knowledge. Для объективного события factType=objective. Не делай выводов о будущих реакциях персонажей из внешних следов. Для каждого изменения используй 1-2 ID реально подтверждающих сообщений и максимально КОРОТКУЮ УНИКАЛЬНУЮ цитату ДОСЛОВНО из одного из них; цитата должна относиться только к одному событию (якорь идентичности факта). Для поиска МЕНЬШЕ значит ЛУЧШЕ. Если фактов нет, changes:[] . Никакого текста вне JSON.`;
    const payload=portion.map((x,i)=>({id:'m'+i,index:x.index,key:x.key,speaker:x.speaker,text:x.text}));
    try{
      const result=await requestAI(system,'Извлеки только факты из сообщений:\n'+JSON.stringify(payload));
      if(bag!==activeChatKey()){toast('Чат изменился: проверка остановлена');return null;}
      const changes=parseExtraction(result);let added=0;
      for(const change of changes){if(!SCOPE_KEYS.includes(change.scope))continue;const ids=Array.isArray(change.message_ids)?change.message_ids:[];
        const sources=ids.map(id=>payload[Number(String(id).replace(/^m/,''))]).filter(Boolean);
        if(!sources.length||sources.length>3)continue;
        const quote=String(change.quote||'').trim();if(quote&&!sources.some(x=>x.text.includes(quote)))continue;
        const title=String(change.title||'').trim().slice(0,160),detail=String(change.detail||'').trim().slice(0,1600),factType=factLabels[change.factType]?change.factType:'objective';if(!title||!detail)continue;if(factType!=='objective'&&change.scope!=='gm:knowledge')continue;
        const signature=digest([change.scope,factType,title,detail,...sources.map(x=>x.key)].join('|'));
        const evidence=sources.map(x=>({index:x.index,key:x.key}));
        const candidate={signature,scope:change.scope,factType,title,detail,quote,sources:evidence};
        if(!canPropose(candidate,b.proposals))continue;
        b.proposals.push({id:key(),signature,status:'pending',scope:change.scope,factType,title,detail,extra:String(change.extra||'').slice(0,200),date:String(change.date||'').slice(0,70),year:String(change.year||'').slice(0,40),progress:String(change.progress||'').slice(0,40),owned:change.owned===true,quote,confidence:String(change.confidence||'').slice(0,30),sources:evidence,created:dateTime()});added++;
      }
      if(updateCursor)b.syncCursor=Math.max(b.syncCursor??0,end);
      b.syncRuns=(b.syncRuns||0)+1;
      queueHistory(`Проверены сообщения ${start}–${end-1}, предложено ${added} изменений`);
      return {next:end,added};
    }catch(e){console.error('[EnaDesktop] AI sync error',e);toast('Ошибка ИИ: '+(e?.message||'проверяй консоль'));return null;}
    finally{extracting=false;if(ui.windows.has('gm'))fillWindow('gm');}
  }
  async function scan(recent){if(fullScanRunning||extracting){toast('Проверка уже идёт');return;}
    const chat=messages(),interval=Math.max(5,Math.min(100,Number(settings().enaSync.interval)||50));
    if(!chat.length){toast('В чате нет сообщений');return;}
    const start=recent?Math.max(0,chat.length-interval):Math.max(0,Math.min(state().syncCursor??chat.length,chat.length));
    if(start>=chat.length){toast('Новых сообщений для проверки нет');return;}
    await scanChunk(start,interval);
  }
  async function scanWholeChat(resume){
    if(fullScanRunning||extracting){toast('Проверка уже идёт');return;}
    const chat=messages(),b=state(),interval=Math.max(5,Math.min(100,Number(settings().enaSync.interval)||50));
    if(!chat.length){toast('Чат пуст');return;}
    const saved=b.fullScan||{},canResume=resume&&saved.cursor>0&&saved.cursor<saved.total;
    const start=canResume?saved.cursor:0,total=canResume?Math.min(saved.total,chat.length):chat.length;
    if(!canResume){const chunks=Math.ceil(total/interval);if(!confirm(`Проверить ${total} сообщений порциями по ${interval}? Это до ${chunks} запросов через «${selectedProviderLabel()}» и может расходовать платные токены. Результаты будут предложениями, не автоматическими фактами.`))return;}
    if(!canResume)b.fullScan={cursor:0,total,status:'running',added:0,blocks:0};
    else b.fullScan.status='running';
    fullScanStop=false;fullScanRunning=true;const bag=activeChatKey();saveMeta();
    try{
      for(let i=start;i<total;){
        if(fullScanStop||bag!==activeChatKey()){b.fullScan.status='paused';break;}
        const result=await scanChunk(i,Math.min(interval,total-i),{updateCursor:false});
        if(!result){b.fullScan.status='paused';break;}
        i=result.next;
        b.fullScan.cursor=i;b.fullScan.added+=result.added;b.fullScan.blocks++;
        b.fullScan.status=i>=total?'complete':'running';
        saveMeta();if(ui.windows.has('gm'))fillWindow('gm');
        // Yield to the browser so the stop button remains responsive between API calls.
        await new Promise(resolve=>setTimeout(resolve,70));
      }
      if(bag===activeChatKey()&&b.fullScan.cursor>=total){
        b.fullScan.status='complete';b.syncCursor=Math.max(b.syncCursor??0,total);
        queueHistory('Полная проверка завершена: '+total+' сообщений, '+b.fullScan.added+' новых предложений');
        toast('Полная проверка завершена! Предложений: '+b.fullScan.added);
      }else if(bag===activeChatKey()){queueHistory('Полная проверка приостановлена на сообщении '+b.fullScan.cursor);toast('Полная проверка приостановлена');}
    }finally{fullScanRunning=false;fullScanStop=false;if(ui.windows.has('gm'))fillWindow('gm');}
  }
  function updateEvents(){clearTimeout(pendingTimer);pendingTimer=setTimeout(()=>{const bag=activeChatKey();if(!bag)return;markInvalid();const b=state(),count=messages().length;
      if(b.syncCursor===null){b.syncCursor=count;saveMeta();}
      else if(settings().enaSync.automatic&&!extracting&&!fullScanRunning&&count-b.syncCursor>=Number(settings().enaSync.interval||50)){void scan(false);}
    },900);
  }
  function initialize(){const c=ctx();state();if(!c?.eventSource?.on)return;
    const ev=c.event_types||{};
    for(const event of ['MESSAGE_DELETED','MESSAGE_EDITED','MESSAGE_SWIPED','MESSAGE_UPDATED','CHAT_CHANGED','MESSAGE_RECEIVED'])if(ev[event])c.eventSource.on(ev[event],()=>{
      if(event==='CHAT_CHANGED'){editor=null;proposalEditor=null;factTab='pending';filter='';lastChatRef=null;}
      updateEvents();
    });
    if(ev.GENERATION_ENDED)c.eventSource.on(ev.GENERATION_ENDED,()=>updateEvents());
    // Initialize cursor at current chat length, never spend on previous 1000+ messages without user opting in.
    const b=state();if(b.syncCursor===null){b.syncCursor=messages().length;saveMeta();}
  }
  return {state,view,action,submit,change,input,initialize,archiveValid,markInvalid,records,deleteLinkedRecord,syncLinkedArchiveRecord};
}
