/* Ena Desktop 1.0 Beta: locally editable applications, provenance, rollback and AI review. */
import {digest,messageKey,validateEvidence,safeMoney,parseExtraction} from './betaCore.js';

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
  let editor=null, filter='', extracting=false, lastChatRef=null, pendingTimer=null, lastChangeCount=0, fullScanRunning=false, fullScanStop=false;
  const defaultConfig={automatic:false,interval:50,review:true,connection:'active',maxContextMessages:50};
  function state(){
    const m=meta();
    if(!m.beta||typeof m.beta!=='object')m.beta={schema:1,records:[],proposals:[],history:[],syncCursor:null,syncRuns:0};
    const b=m.beta;
    for(const k of ['records','proposals','history'])if(!Array.isArray(b[k]))b[k]=[];
    if(!b.schema)b.schema=1;
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
  const valid=r=>validateEvidence(r.sources||[],messages());
  const records=scope=>state().records.filter(r=>r.scope===scope&&!r.deleted&&valid(r));
  const allActive=()=>state().records.filter(r=>!r.deleted&&valid(r));
  function renderRows(scope,app){const a=records(scope),q=filter.trim().toLocaleLowerCase('ru');const rows=q?a.filter(x=>JSON.stringify([x.title,x.detail,x.extra,x.person,x.date]).toLocaleLowerCase('ru').includes(q)):a;
    if(!rows.length)return `<div class="ena-beta-empty"><div class="ena-beta-folder">▣</div>${p(appEmpty[app]||'Пока записей нет')}<small>${scope.startsWith('gm:')?'Факты GM не передаются в ноутбук Ены.':'Можно добавить вручную или подтвердить событие в синхронизации.'}</small></div>`;
    return `<div class="ena-beta-records">${rows.map(r=>`<article class="ena-beta-record" data-record="${encode(r.id)}"><div class="ena-beta-record-main"><b>${encode(r.title)}</b><small>${encode(r.date||r.created?.slice(0,10)||'')}</small></div><div class="ena-beta-record-detail">${encode(r.detail||'')}</div><div class="ena-beta-record-meta">${r.extra?`<span>${encode(r.extra)}</span>`:''}${r.amount!==undefined&&r.amount!==''?`<span>${encode(r.amount)} ${encode(r.currency||'₤')}</span>`:''}${r.status==='done'?'<span>✓ Завершено</span>':''}${r.sources?.length?'<span title="Проверяется по сообщению чата">◉ Источник в чате</span>':'<span>✎ Ручная запись</span>'}<button data-beta="edit" data-id="${encode(r.id)}" type="button">Изменить</button><button data-beta="delete" data-id="${encode(r.id)}" type="button">Удалить</button></div></article>`).join('')}</div>`;
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
  function computer(){const s=settings().enaSync;const extra=`<section class="ena-beta-settings-extension"><h3>ИИ и синхронизация • Beta</h3><p>Генерация использует активное подключение SillyTavern (OpenRouter или Route.me — в зависимости от выбранного в ST). Новый API-ключ не нужен. Отдельный профиль не переключается автоматически.</p><label><input data-beta-setting="automatic" type="checkbox" ${s.automatic?'checked':''}> Проверять новые блоки автоматически</label><label>Порог сообщений <select data-beta-setting="interval">${[25,50,75,100].map(n=>`<option value="${n}" ${Number(s.interval)===n?'selected':''}>${n}</option>`).join('')}</select></label><label><input data-beta-setting="review" type="checkbox" ${s.review?'checked':''}> Показывать предложения перед применением</label><p class="ena-beta-warning">Даже при отключении подтверждения в этой бете изменения не применяются автоматически. Это защита от ложных сюжетных фактов.</p><button data-beta="scan-last">Проверить последние ${Number(s.interval)||50} сообщений</button><button data-beta="export">Экспорт JSON</button><label class="ena-beta-file">Импорт JSON <input data-beta-input="import" type="file" accept="application/json,.json"></label><p>Записи сохраняются в метаданных чата. Обои — локально в браузере. При обновлении расширения делай резервную копию.</p></section>`;return oldComputer().replace(/Никаких API-запросов и затрат токенов в этой версии\./,'Автоматическая синхронизация включается ниже отдельно.').replace(/<\/div>$/i,extra+'</div>');}
  function editorHTML(){const scope=editor.scope,r=editor.id?state().records.find(x=>x.id===editor.id):null;const def=TABLES[scope]||['Запись','Название','Подробности'];const finance=scope.endsWith('finance')||scope.endsWith('bank');const isCommunication=scope.startsWith('mail:')||scope.startsWith('sms:');
    return `<div class="ena-editor-backdrop"><form class="ena-beta-editor ena-editor" data-beta-form="record" data-id="${encode(editor.id||'')}"><div class="ena-editor-head"><b>${r?'Изменить':'Добавить'} · ${encode(def[0])}</b><button type="button" data-beta="cancel">×</button></div><label>${encode(def[1])} <input name="title" maxlength="180" required value="${encode(r?.title||'')}"></label><label>${encode(def[2])}<textarea name="detail" rows="5" maxlength="3000">${encode(r?.detail||'')}</textarea></label><div class="ena-beta-form-grid"><label>${isCommunication?'От кого / кому':'Дополнительно / местоположение'}<input name="extra" maxlength="280" value="${encode(r?.extra||'')}"></label><label>Дата в сюжете <input name="date" maxlength="80" placeholder="например, 30.04.2001" value="${encode(r?.date||'')}"></label>${finance?`<label>Сумма (+ доход, − расход)<input name="amount" type="number" step="0.01" value="${encode(r?.amount??'')}"></label><label>Валюта <input name="currency" maxlength="12" value="${encode(r?.currency||'₤')}"></label>`:''}<label>Статус <select name="status"><option value="active" ${(r?.status||'active')==='active'?'selected':''}>Активно</option><option value="done" ${r?.status==='done'?'selected':''}>Завершено / исполнено</option><option value="planned" ${r?.status==='planned'?'selected':''}>В планах</option></select></label><label>№ сообщения-основания (необязательно)<input name="messageIndex" type="number" min="0" max="999999" placeholder="Например, 1100"></label></div><small>Если укажешь сообщение-основание, при удалении/редактировании/смене свайпа запись автоматически скрывается. Ручные записи без источника не удаляются.</small><div class="ena-beta-form-actions"><button type="submit">Сохранить</button><button type="button" data-beta="cancel">Отмена</button></div></form></div>`;
  }
  function syncView(){const b=state(),s=settings().enaSync,c=messages();const pending=b.proposals.filter(p=>p.status==='pending');const invalid=b.records.filter(r=>r.sources?.length&&!valid(r));
    const cards=pending.map(x=>`<article class="ena-beta-proposal ${valid(x)?'':'ena-beta-invalid'}"><b>${encode(SCOPE_OPTIONS[x.scope]||x.scope)} • ${encode(x.title)}</b><p>${encode(x.detail)}</p>${x.quote?`<blockquote>${encode(x.quote)}</blockquote>`:''}<small>Источник: ${encode(x.sources?.map(z=>'#'+z.index).join(', ')||'—')} ${valid(x)?'✓ присутствует':'⚠ изменён или удалён'} · ${encode(x.confidence||'не оценена')}</small><div><button data-beta="approve" data-id="${encode(x.id)}" ${valid(x)?'':'disabled'}>Подтвердить</button><button data-beta="reject" data-id="${encode(x.id)}">Отклонить</button></div></article>`).join('');
    const f=b.fullScan||{cursor:0,total:0,status:'idle',added:0,blocks:0};
    const progress=f.total?Math.min(100,Math.round((f.cursor||0)/f.total*100)):0;
    const work=fullScanRunning?`<button data-beta="scan-stop" type="button">■ Остановить после текущего блока</button>`:
       `<button data-beta="scan-all" type="button">Проверить весь чат (${c.length} сообщений)</button>${f.cursor>0&&f.cursor<f.total?'<button data-beta="scan-resume" type="button">▶ Продолжить полную проверку</button>':''}`;
    const progressBar=f.total?`<div class="ena-scan-progress" role="progressbar" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><p>Полный проход: ${f.cursor||0} / ${f.total||0} сообщений · ${progress}% · блоков ${f.blocks||0} · новых предложений ${f.added||0} · ${encode(f.status||'')}</p>`:'';
    return `<div class="ena-content ena-scroll ena-beta-space"><div class="ena-beta-banner"><b>Источник ИИ: активное подключение SillyTavern</b><p>Вызов через generateRaw без изменения чата и без самостоятельного переключения API-профиля.</p><p>Обработано блоков: ${b.syncRuns||0}; сообщений в чате: ${c.length}; текущая позиция: ${b.syncCursor===null?'ещё не задана':b.syncCursor}.</p></div>
      <div class="ena-beta-controls"><button data-beta="scan-last" ${extracting?'disabled':''}>Последние ${Number(s.interval||50)} сообщений</button><button data-beta="scan-new" ${extracting?'disabled':''}>Новые сообщения</button>${work}<button data-beta="export">Экспорт JSON</button><label class="ena-beta-file">Импорт JSON <input data-beta-input="import" type="file" accept="application/json,.json"></label></div>
      <div class="ena-beta-notice">Полная проверка выполняется порциями по ${Number(s.interval)||50} сообщений через активную модель. Каждая порция — отдельный платный запрос; можно остановить и возобновить. Начало полной проверки не удаляет существующие предложения. Перед импортом рекомендуется экспортировать копию.</div>${progressBar}
      <h3>Предложения (${pending.length})</h3>${cards||'<p>Нет предложений. ИИ не должен придумывать события, которых не было.</p>'}<h3>Основания после откатов (${invalid.length})</h3>${invalid.map(r=>`<p class="ena-beta-warning">⚠ ${encode(r.title)} — источник удалён или изменён, запись скрыта.</p>`).join('')||'<p>Осиротевших записей нет.</p>'}<h3>Журнал</h3><div class="ena-beta-log">${b.history.slice(0,40).map(x=>`<div><small>${encode(x.time?.slice(0,16).replace('T',' ')||'')}</small> ${encode(x.summary)}</div>`).join('')}</div></div>`;
  }
  function mutateRecord(scope,fields,previous=null,sources=[]){const b=state();if(previous){Object.assign(previous,fields);previous.sources=sources.length?sources:previous.sources||[];queueHistory('Изменено вручную: '+previous.title);}else{b.records.push({id:key(),scope,created:dateTime(),manual:true,...fields,sources});queueHistory('Добавлено вручную: '+fields.title);}saveMeta();}
  function action(type,el){if(!el.closest('#ena-desktop-root'))return false;
    if(type==='scan-last'||type==='scan-new'){if(fullScanRunning){toast('Сначала останови полную проверку');return true;}void scan(type==='scan-last');return true;}
    if(type==='scan-all'){void scanWholeChat(false);return true;}
    if(type==='scan-resume'){void scanWholeChat(true);return true;}
    if(type==='scan-stop'){fullScanStop=true;toast('Остановка после текущего запроса');return true;}
    if(type==='go-sync'){ui.tab.gm='sync';fillWindow('gm');return true;}
    if(type==='new'){const app=el.closest('.ena-window')?.dataset.app;let scope=activeScope(app);if(!TABLES[scope])return true;editor={app,scope,id:null};fillWindow(app);return true;}
    if(type==='edit'){const r=state().records.find(x=>x.id===el.dataset.id);if(!r)return true;editor={app:r.scope.split(':')[0],scope:r.scope,id:r.id};fillWindow(editor.app);return true;}
    if(type==='cancel'){const app=editor?.app;editor=null;if(app)fillWindow(app);return true;}
    if(type==='delete'){const r=state().records.find(x=>x.id===el.dataset.id);if(!r)return true;if(!confirm('Удалить запись «'+r.title+'»? Это не меняет текст ролки.'))return true;r.deleted=true;queueHistory('Удалена запись: '+r.title);fillWindow(r.scope.split(':')[0]);return true;}
    if(type==='approve'||type==='reject'){const p=state().proposals.find(x=>x.id===el.dataset.id);if(!p)return true;if(type==='approve'&&!valid(p)){toast('Основание изменено: нельзя подтвердить');return true;}
      p.status=type==='reject'?'rejected':'approved';if(type==='approve'){
        const fields={title:p.title,detail:p.detail,extra:p.extra||'',date:p.date||'',status:'active'};
        if(p.scope.startsWith('archive:')){
          const cat=p.scope.split(':')[1];const a=meta().archive[cat];a.push({id:key(),title:p.title,detail:p.detail,year:p.year||'',progress:cat==='anomalies'?'found':({films:['seen','started','planned'],books:['read','started','planned'],music:['listened','started','planned']}[cat]||[]).includes(p.progress)?p.progress:'planned',ownership:p.owned?'personal':'unknown',source:p.sources?.map(x=>'#'+x.index).join(', '),autoSources:p.sources,standStatus:'unknown'});
        }else state().records.push({id:key(),scope:p.scope,...fields,amount:p.amount??'',currency:p.currency||'₤',sources:p.sources,manual:false,created:dateTime()});
      }queueHistory((type==='approve'?'Подтверждено: ':'Отклонено: ')+p.title);fillWindow('gm');if(p.scope.startsWith('archive:'))fillWindow('archive');return true;}
    if(type==='export'){const data=JSON.stringify({version:'1.0-beta',exportDate:dateTime(),chatData:meta()},null,2);const blob=new Blob([data],{type:'application/json'}),object=URL.createObjectURL(blob),link=document.createElement('a');link.href=object;link.download='EnaDesktop_backup_'+new Date().toISOString().slice(0,10)+'.json';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),5000);toast('Резервная копия сохранена');return true;}
    if(type==='notes-list'){editor={app:'notes',scope:'notes:notes',id:null};fillWindow('notes');return true;}
    return false;
  }
  function submit(form,ev){if(form.dataset.betaForm!=='record')return false;ev.preventDefault();const fd=new FormData(form);const target=editor?.app,scope=editor?.scope;if(!scope)return true;
    const title=String(fd.get('title')||'').trim();if(!title)return true;
    const old=editor.id?state().records.find(x=>x.id===editor.id):null;
    const sourceIndex=String(fd.get('messageIndex')||'').trim();let sources=old?.sources||[];
    if(sourceIndex){const i=Number(sourceIndex),message=messages()[i];if(!message||!messageKey(message)){toast('Такого сообщения в текущем чате нет');return true;}sources=[{index:i,key:messageKey(message)}];}
    const fields={title:title.slice(0,180),detail:String(fd.get('detail')||'').slice(0,3000),extra:String(fd.get('extra')||'').slice(0,280),date:String(fd.get('date')||'').slice(0,80),status:String(fd.get('status')||'active'),amount:fd.has('amount')?String(fd.get('amount')||''):'',currency:String(fd.get('currency')||'₤').slice(0,12)};
    mutateRecord(scope,fields,old,sources);editor=null;fillWindow(target);toast('Запись сохранена');return true;
  }
  function change(el,ev){if(el.dataset.betaSetting){const s=settings().enaSync;const name=el.dataset.betaSetting;s[name]=el.type==='checkbox'?el.checked:Number(el.value)||50;persistSettings();return true;}
    if(el.dataset.betaInput==='import'){const file=el.files?.[0];if(file)void importBackup(file);return true;}
    return false;
  }
  function input(el){if(el.dataset.betaInput==='search'){filter=el.value;const app=el.closest('.ena-window')?.dataset.app;const content=el.closest('.ena-window')?.querySelector('.ena-beta-records,.ena-beta-empty');if(app&&TABLES[activeScope(app)]){const temp=document.createElement('div');temp.innerHTML=renderRows(activeScope(app),app);const container=el.closest('.ena-window')?.querySelector('.ena-content');if(container)container.innerHTML=temp.innerHTML;}return true;}return false;}
  async function importBackup(file){
    if(file.size>20_000_000){toast('Резервная копия больше 20 МБ');return;}
    let json;
    try{json=JSON.parse(await file.text());}catch{toast('Ошибка: файл не является корректным JSON');return;}
    const data=json?.chatData;
    if(!data||!data.archive||!data.beta||!Array.isArray(data.beta.records)||data.beta.records.length>=10000){toast('Неподходящая резервная копия Ena Desktop');return;}
    if(!confirm('Импорт ЗАМЕНИТ данные ноутбука ТЕКУЩЕГО чата. Сначала сохрани экспорт текущих данных. Продолжить?'))return;
    const bag=activeChatKey();
    try{
      if(bag!==activeChatKey()){toast('Чат изменился: импорт отменён');return;}
      const m=meta();
      for(const prop of ['archive','salon','directory','gm','notes','gameDate','gameTime','beta'])if(data[prop]!==undefined)m[prop]=structuredClone(data[prop]);
      saveMeta();editor=null;markInvalid();
      toast('Импорт завершён. Проверены источники сообщений.');
      for(const a of ['archive','salon','directory','gm','notes','mail','sms'])fillWindow(a);
    }catch(e){console.error('[EnaDesktop] import failed',e);toast('Ошибка импорта: '+e.message);}
  }
  function markInvalid(){const b=state();const invalid=b.records.filter(r=>r.sources?.length&&!valid(r));const newly=invalid.filter(r=>!r.notifiedInvalid);
    newly.forEach(r=>{r.notifiedInvalid=true;queueHistory('Откат: основание «'+r.title+'» отсутствует',false);});
    b.records.filter(r=>r.notifiedInvalid&&valid(r)).forEach(r=>{r.notifiedInvalid=false;queueHistory('Источник восстановлен: '+r.title,false);});
    const archiveMissing=Object.values(meta().archive||{}).flat().filter(r=>r.autoSources?.length&&!archiveValid(r));
    const old=b.lastInvalidCount||0;b.lastInvalidCount=invalid.length+archiveMissing.length;
    // Do not reset cursor on edit/delete; pending changes are still reviewed, no auto-fact magic.
    if(newly.length||old!==invalid.length+archiveMissing.length)saveMeta();
    if(newly.length)toast('Откат: '+newly.length+' записей скрыто (потерян источник)');
    if(ui.windows?.has('gm'))fillWindow('gm');
  }
  function archiveValid(record){return validateEvidence(record?.autoSources||[],messages());}
  function activeChatKey(){return ctx()?.chatMetadata || null;}
  // A single sequential chunk. Returns null on failure / chat switch, and never
  // silently skips a failed chunk. Full-chat mode stores its own resumable cursor.
  async function scanChunk(start, limit, {updateCursor=true}={}){
    if(extracting)return null;
    const c=ctx();if(typeof c?.generateRaw!=='function'){toast('Активная модель SillyTavern недоступна');return null;}
    const bag=activeChatKey(),b=state(),chat=messages(),end=Math.min(chat.length,start+limit);
    const portion=chat.slice(start,end).map((x,i)=>({index:start+i,key:messageKey(x),speaker:x.is_user?'Ена/пользователь':'Рассказчик',text:(()=>{const m=String(x.mes||'');return m.length>5000?m.slice(0,2600)+'\n[... фрагмент длинного сообщения пропущен ...]\n'+m.slice(-2300):m;})()})).filter(x=>x.key&&x.text.trim());
    if(end<=start)return {next:end,added:0};
    if(!portion.length){if(updateCursor){b.syncCursor=Math.max(b.syncCursor??0,end);saveMeta();}return {next:end,added:0};}
    extracting=true;toast('Проверяю сообщения '+(start+1)+'–'+end+' через текущее API');if(ui.windows.has('gm'))fillWindow('gm');
    const system=`Ты строгий экстрактор СОБЫТИЙ для ролевой игры JoJo (Неаполь 2001), а не рассказчик. Верни ТОЛЬКО JSON: {"changes":[{"scope":"gm:inventory","title":"...","detail":"...","message_ids":["m0"],"quote":"точная короткая цитата из указанного сообщения","confidence":"high","progress":"planned","owned":false}]} .
Доступные scope: ${SCOPE_KEYS.join(', ')}. События ТОЛЬКО прямо подтверждённые текстом: явно приобретённый предмет, просмотренный Еной фильм, полученное письмо или SMS, изменение баланса, конкретная травма, выполненное задание, открытое место или знание NPC. Простое УПОМИНАНИЕ произведения не означает просмотр. Для личных archive:films progress=seen ТОЛЬКО при реально подтверждённом просмотре; для books=read, для music=listened, иначе planned. Поле owned=true ТОЛЬКО если Ена купила копию ДЛЯ СЕБЯ. Покупка лицензии для видеосалона НЕ добавляет фильм в личный архив. Личные мысли Ены не придумывать. Никогда не переносить в личные записи Ены сведения, известные только GM. Не создавать эфирных богов, меметическое заражение, опасность просмотра VHS без подтверждения. Для каждого изменения используй 1-2 ID реально подтверждающих сообщений и цитату ДОСЛОВНО из одного из них. Для поиска МЕНЬШЕ значит ЛУЧШЕ. Если фактов нет, changes:[] . Никакого текста вне JSON.`;
    const payload=portion.map((x,i)=>({id:'m'+i,index:x.index,key:x.key,speaker:x.speaker,text:x.text}));
    try{
      const result=await c.generateRaw({systemPrompt:system,prompt:'Извлеки только факты из сообщений:\n'+JSON.stringify(payload)});
      if(bag!==activeChatKey()){toast('Чат изменился: проверка остановлена');return null;}
      const changes=parseExtraction(result);const seenKeys=new Set([...b.proposals.map(x=>x.signature)]);let added=0;
      for(const change of changes){if(!SCOPE_KEYS.includes(change.scope))continue;const ids=Array.isArray(change.message_ids)?change.message_ids:[];
        const sources=ids.map(id=>payload[Number(String(id).replace(/^m/,''))]).filter(Boolean);
        if(!sources.length||sources.length>3)continue;
        const quote=String(change.quote||'').trim();if(quote&&!sources.some(x=>x.text.includes(quote)))continue;
        const title=String(change.title||'').trim().slice(0,160),detail=String(change.detail||'').trim().slice(0,1600);if(!title)continue;
        const signature=digest([change.scope,title,detail,...sources.map(x=>x.key)].join('|'));if(seenKeys.has(signature))continue;
        const evidence=sources.map(x=>({index:x.index,key:x.key}));
        b.proposals.push({id:key(),signature,status:'pending',scope:change.scope,title,detail,extra:String(change.extra||'').slice(0,200),date:String(change.date||'').slice(0,70),year:String(change.year||'').slice(0,40),progress:String(change.progress||'').slice(0,40),owned:change.owned===true,quote,confidence:String(change.confidence||'').slice(0,30),sources:evidence,created:dateTime()});seenKeys.add(signature);added++;
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
    if(!canResume){const chunks=Math.ceil(total/interval);if(!confirm(`Проверить ${total} сообщений порциями по ${interval}? Это до ${chunks} запросов к активной модели и может расходовать платные токены. Результаты будут предложениями, не автоматическими фактами.`))return;}
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
      if(event==='CHAT_CHANGED'){editor=null;filter='';lastChatRef=null;}
      updateEvents();
    });
    if(ev.GENERATION_ENDED)c.eventSource.on(ev.GENERATION_ENDED,()=>updateEvents());
    // Initialize cursor at current chat length, never spend on previous 1000+ messages without user opting in.
    const b=state();if(b.syncCursor===null){b.syncCursor=messages().length;saveMeta();}
  }
  return {state,view,action,submit,change,input,initialize,archiveValid,markInvalid,records};
}
