import { createBeta } from './beta.js';
/* Ena Desktop 2001 — independent client-only SillyTavern UI extension. MIT.
   No generation, context injection, Memory Books or chat edits in v0.1. */
const ENA = (() => {
  'use strict';
  const VERSION = '1.0.0-beta.1';
  const META_KEY = 'ena_desktop_v1';
  const SETTING_KEY = 'ena_desktop_2001';
  const ROOT = new URL('./', import.meta.url);
  const url = name => new URL('assets/' + name, ROOT).href;
  const apps = [
    ['archive','Архив','archive'],['salon','Видеосалон','videoclub'],
    ['mail','Почта','mail'],['sms','SMS','sms'],
    ['directory','Справочник','contacts'],['notes','Заметки','notes'],
    ['computer','Мой компьютер','computer'],['gm','GM • вне сюжета','gm']
  ];
  const titles = Object.fromEntries(apps.map(a=>[a[0],a[1]]));
  const icons = Object.fromEntries(apps.map(a=>[a[0],url('icons/'+a[2]+'.svg')]));
  const progressNames={planned:'В планах',seen:'Просмотрено',started:'Начато',found:'Обнаружено',unseen:'Не просмотрено',viewed:'Просмотрено',studied:'Исследовано',read:'Прочитано',listened:'Прослушано',possessed:'На руках',transferred:'Передано',lost:'Утрачено'};
  const categories = {
    films: ['Фильмография','фильм'], music:['Дискография','запись'],
    books:['Библиография','книга'], anomalies:['Аномалии','объект']
  };
  let root, fab, lastHandled = null, running = false, zCounter=90, saveTimer = null, searchTimer = null, localWallpaper = null;
  const ui = { windows: new Map(), active: null, start:false, calendar:false, calendarMonth:null, tab:{archive:'films',salon:'overview',gm:'overview',directory:'people',mail:'inbox',sms:'inbox'}, filter:'all', search:'', adding:null, archiveEditor:null };
  const fallbackMeta = {};
  const settingsDefault = { autoOpen:true, showFab:true, wallpaper:'city', iconSize:56, wallpaperUrl:'' };
  const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = ()=>('item_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8));
  const icon = (key, size=32)=>`<img width="${size}" height="${size}" src="${icons[key]||url('icons/folder.svg')}" alt="" draggable="false">`;
  const ctx = ()=>globalThis.SillyTavern?.getContext?.() || globalThis.__ENA_PREVIEW_CONTEXT__ || null;
  function settings(){
    const c=ctx(); if(!c) return settingsDefault;
    const bag=c.extensionSettings || c.extension_settings;
    if(!bag) return settingsDefault;
    if(!bag[SETTING_KEY]) bag[SETTING_KEY] = {...settingsDefault};
    for(const [k,v] of Object.entries(settingsDefault)) if(bag[SETTING_KEY][k]===undefined) bag[SETTING_KEY][k]=v;
    return bag[SETTING_KEY];
  }
  function persistSettings(){ const c=ctx(); try { c?.saveSettingsDebounced?.(); } catch(e){ console.warn('[EnaDesktop] save settings',e); } }
  function meta(){
    const c=ctx(); const bag=c?.chatMetadata || fallbackMeta;
    if(!bag[META_KEY]) bag[META_KEY]={v:1,apps:{},layout:{},archive:{films:[],music:[],books:[],anomalies:[]},salon:{licenses:[],tasks:[],transactions:[],documents:[]},directory:{people:[],places:[]},notes:'',gm:{injuries:[],items:[],quests:[]},gameDate:'',gameTime:''};
    const m=bag[META_KEY];
    for(const k of ['archive','salon','directory','gm','layout','apps']) if(!m[k]||typeof m[k]!=='object') m[k]={};
    for(const [k] of Object.entries(categories)) if(!Array.isArray(m.archive[k]))m.archive[k]=[];
    for(const k of ['licenses','tasks','transactions','documents'])if(!Array.isArray(m.salon[k]))m.salon[k]=[];
    for(const k of ['people','places'])if(!Array.isArray(m.directory[k]))m.directory[k]=[];
    for(const k of ['injuries','items','quests'])if(!Array.isArray(m.gm[k]))m.gm[k]=[];
    if(typeof m.notes!=='string')m.notes='';
    return m;
  }
  function saveMeta(){
    const c=ctx();if(!c?.chatMetadata)return;
    try { Promise.resolve(c.saveMetadata?.()).catch(e=>console.warn('[EnaDesktop] metadata',e)); }
    catch(e){console.warn('[EnaDesktop] metadata',e);}
  }
  function queueSave(){ clearTimeout(saveTimer); const currentBag=ctx()?.chatMetadata;
    saveTimer=setTimeout(()=>{if(currentBag===ctx()?.chatMetadata)saveMeta();},700);
  }
  function toast(message){const n=root?.querySelector('.ena-toast');if(!n)return;n.textContent=message;n.classList.add('ena-toast-visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>n.classList.remove('ena-toast-visible'),2600);}
  const beta = createBeta({meta,ctx,settings,persistSettings,saveMeta,toast,fillWindow,ui,oldComputer:computerHTML,oldNotes:notesHTML});
  function generateShell(){
    root=document.createElement('div'); root.id='ena-desktop-root';root.hidden=true;
    root.innerHTML=`<div class="ena-screen" role="dialog" aria-label="Ноутбук Ены" aria-modal="true">
      <div class="ena-desktop-icons" id="ena-icons" aria-label="Рабочий стол"></div>
      <div id="ena-window-layer"></div>
      <nav class="ena-taskbar" aria-label="Панель задач"><button type="button" class="ena-start-button" data-action="start"><span class="ena-start-logo">▦</span><b>Пуск</b></button><div class="ena-task-items"></div><button type="button" class="ena-tray" data-action="calendar" title="Календарь"><span aria-hidden="true">◖))</span><span class="ena-tray-time">—:—</span><span class="ena-tray-date">2001</span></button></nav>
      <div class="ena-menu-slot"></div><div class="ena-calendar-slot"></div>
      <div class="ena-toast" role="status" aria-live="polite"></div></div>`;
    document.body.appendChild(root);
    root.addEventListener('click',handleClick);
    root.addEventListener('dblclick',handleDoubleClick);
    root.addEventListener('submit',handleSubmit);
    root.addEventListener('change',handleChange);
    root.addEventListener('input',handleInput);
    root.addEventListener('pointerdown',handlePointerDown);
    root.addEventListener('keydown',ev=>{if(ev.key==='Escape'){if(ui.archiveEditor){ui.archiveEditor=null;fillWindow('archive');}else if(ui.start||ui.calendar){ui.start=false;ui.calendar=false;renderMenus();}else shutdown(false);}});
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!root.hidden&&ev.target.closest?.('#ena-desktop-root')){ev.preventDefault();}});
    fab=document.createElement('button');fab.id='ena-desktop-fab';fab.type='button';fab.title='Ноутбук Ены';fab.setAttribute('aria-label','Открыть ноутбук Ены');
    fab.innerHTML=icon('computer',35); document.body.appendChild(fab);
    fab.addEventListener('click',()=>boot());
    updateFab();
    drawIcons(); updateWallpaper(); updateClock();
  }
  function updateFab(){if(fab)fab.hidden=!settings().showFab;}
  function updateWallpaper(){if(!root)return;const s=settings();const screen=root.querySelector('.ena-screen');
    screen.style.backgroundImage=localWallpaper?`url("${localWallpaper}")`:s.wallpaper==='classic'?'none':`url("${url('wallpaper.svg')}")`;
    screen.classList.toggle('ena-classic',s.wallpaper==='classic'&&!localWallpaper);
    root.style.setProperty('--ena-icon-size',Math.max(44,Math.min(72,Number(s.iconSize)||56))+'px');
  }
  function drawIcons(){const el=root.querySelector('#ena-icons');el.innerHTML=apps.map(([key,name])=>`<button class="ena-desktop-icon" type="button" data-open="${key}" title="Открыть: ${esc(name)}">${icon(key,64)}<span>${esc(name)}</span></button>`).join('');}
  function boot(){if(!root) return;running=true; root.hidden=false;ui.start=false;ui.calendar=false; ui.windows.clear();ui.active=null;
    updateWallpaper();drawIcons(); const m=meta();
    for(const [key,open] of Object.entries(m.apps||{}))if(open&&titles[key])openWindow(key,false);
    updateClock();renderTaskbar();renderMenus();
    fab.hidden=true;
  }
  function shutdown(reset=true){ if(!root)return;
    if(reset){meta().apps={};saveMeta();} root.hidden=true;ui.start=false;ui.calendar=false;ui.windows.clear();ui.active=null;running=false;updateFab();
  }
  function focusWindow(key){const el=ui.windows.get(key);if(!el)return;el.style.zIndex=String(++zCounter);ui.active=key;ui.windows.forEach((w,k)=>w.classList.toggle('ena-focused',k===key)); renderTaskbar();}
  function defaultGeometry(key){
    const width=Math.min(window.innerWidth-40,key==='archive'?950:key==='salon'?900:key==='gm'?980:650);
    const height=Math.min(window.innerHeight-86,key==='archive'?650:key==='gm'?660:key==='salon'?620:490);
    const count=ui.windows.size;
    return {x:Math.max(12,Math.min(window.innerWidth-width-10,225+(count%4)*34)),y:Math.max(12,Math.min(window.innerHeight-height-65,78+(count%4)*30)),w:width,h:height};
  }
  function openWindow(key,persist=true){
    if(!titles[key])return;
    if(ui.windows.has(key)){const existing=ui.windows.get(key);existing.classList.remove('ena-minimized');focusWindow(key);return;}
    const m=meta();const stored=m.layout[key]||{};const def=defaultGeometry(key);
    const pos={...def,...stored};
    const win=document.createElement('section');win.className='ena-window';win.dataset.app=key;win.setAttribute('role','dialog');win.setAttribute('aria-label',titles[key]);
    win.style.left=pos.x+'px';win.style.top=pos.y+'px';win.style.width=pos.w+'px';win.style.height=pos.h+'px';
    win.addEventListener('pointerup',ev=>{if(ev.target.closest('.ena-titlebar'))return;const bounds=win.getBoundingClientRect();const r=meta().layout[key]||{};if(Math.abs((r.w||def.w)-bounds.width)>3||Math.abs((r.h||def.h)-bounds.height)>3){Object.assign(r,{x:win.offsetLeft,y:win.offsetTop,w:Math.round(bounds.width),h:Math.round(bounds.height)});meta().layout[key]=r;saveMeta();}});
    win.innerHTML=`<div class="ena-titlebar" data-drag="${key}"><span class="ena-title">${icon(key,20)}<strong>${esc(titles[key])}</strong></span><span class="ena-window-buttons"><button type="button" data-action="minimize" data-app="${key}" title="Свернуть">─</button><button type="button" data-action="maximize" data-app="${key}" title="Развернуть">□</button><button type="button" data-action="close" data-app="${key}" title="Закрыть">×</button></span></div><div class="ena-window-body"></div>`;
    root.querySelector('#ena-window-layer').appendChild(win);ui.windows.set(key,win);fillWindow(key);focusWindow(key);
    if(persist){m.apps[key]=true;saveMeta();}
  }
  function fillWindow(key){const el=ui.windows.get(key);if(!el)return;
    let content='';switch(key){
      case 'archive':content=archiveHTML();break;case 'salon':content=beta.view('salon');break;
      case 'directory':content=beta.view('directory');break;case 'notes':content=beta.view('notes');break;
      case 'computer':content=beta.view('computer');break;case 'gm':content=beta.view('gm');break;
      case 'mail':content=beta.view('mail');break;
      case 'sms':content=beta.view('sms');break;
    }
    el.querySelector('.ena-window-body').innerHTML=content;
  }
  const heading=(name)=>`<div class="ena-toolbar"><span class="ena-toolbar-name">${esc(name)}</span><span class="ena-toolbar-extra">Ena Desktop 2001</span></div>`;
  const tabs=(name,choices)=>`<div class="ena-tabs" role="tablist">${choices.map(([k,t])=>`<button type="button" class="ena-tab ${ui.tab[name]===k?'ena-tab-on':''}" data-tab-group="${name}" data-tab="${k}">${esc(t)}</button>`).join('')}</div>`;
  const empty=(headline,sub='')=>`<div class="ena-empty">${icon('folder',50)}<b>${esc(headline)}</b><p>${esc(sub)}</p></div>`;
  const placeholderHTML=(title,desc,app)=>heading(title)+`<div class="ena-content">${empty('Пока нет записей',desc)}<div class="ena-hint">Окно готово; синхронизация появится в отдельной версии. Ничего не отправляется в чат.</div></div>`;
  // Archive is intentionally personal. Salon licenses never populate this collection.
  const archiveStatusOptions={
    films:[['planned','Не просмотрено / в планах'],['started','Смотрит сейчас'],['seen','Просмотрено']],
    music:[['planned','Не прослушано / в планах'],['started','Слушает сейчас'],['listened','Прослушано']],
    books:[['planned','Не прочитано / в планах'],['started','Читает сейчас'],['read','Прочитано']],
    anomalies:[['found','Обнаружено'],['possessed','На руках'],['transferred','Передано'],['lost','Утрачено']]
  };
  const completedProgress={films:'seen',music:'listened',books:'read'};
  const catEmoji={films:'▣',music:'♫',books:'▤',anomalies:'◉'};
  const archiveFilters=[['all','Все записи'],['finished','Завершено'],['todo','Не просмотрено / в планах'],['revisit','Надо пересмотреть'],['favorites','Избранное'],['owned','Личные копии']];
  function coverSrc(r){const s=String(r.cover||'').trim();return /^(https:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(s)?s:'';}
  function archiveStatus(cat,r){if(cat==='anomalies')return progressNames[r.progress]||'Обнаружено';
    if(r.progress===completedProgress[cat]||r.progress==='seen'&&cat==='films')return cat==='books'?'Прочитано':cat==='music'?'Прослушано':'Просмотрено';
    if(r.progress==='started')return 'В процессе';
    return cat==='films'?'Не просмотрено':cat==='music'?'Не прослушано':'Не прочитано';}
  function mediaArtwork(r,cat){const src=coverSrc(r);return `<div class="ena-cover ena-cover-${cat}">${src?`<img class="ena-cover-image" src="${esc(src)}" alt="Обложка: ${esc(r.title)}" loading="lazy" referrerpolicy="no-referrer">`:`<div class="ena-cover-placeholder"><span>${catEmoji[cat]}</span><small>${esc(categories[cat][0])}</small></div>`}</div>`;}
  function archiveEditorHTML(cat){const id=ui.archiveEditor?.id;const r=(meta().archive[cat]||[]).find(x=>x.id===id)||{};
    const mode=id?'Редактировать запись':'Новая запись';const options=archiveStatusOptions[cat]||[];
    return `<div class="ena-editor-backdrop"><form class="ena-editor" data-form="archive" data-edit-id="${esc(id||'')}" aria-label="${mode}">
      <div class="ena-editor-head"><b>${mode} · ${esc(categories[cat][0])}</b><button type="button" data-action="archive-cancel" aria-label="Закрыть">✕</button></div>
      <div class="ena-editor-grid">
        <div class="ena-form-col">
          <label>Название *<input name="title" required maxlength="160" value="${esc(r.title||'')}" placeholder="Название произведения / носителя"></label>
          <label>${cat==='anomalies'?'Тип / формат':'Год'}<input name="year" maxlength="40" value="${esc(r.year||'')}" placeholder="${cat==='anomalies'?'VHS, CD, DVD, предмет…':'Например, 1997'}"></label>
          <label>${cat==='anomalies'?'Где находится / статус':'Статус'}<select name="progress">${options.map(([k,t])=>`<option value="${k}" ${r.progress===k?'selected':''}>${t}</option>`).join('')}</select></label>
          ${cat==='anomalies'?`<label>Связь со стендом<select name="standStatus">${[['unknown','Не установлена'],['suspected','Подозревается'],['confirmed','Подтверждена']].map(([k,t])=>`<option value="${k}" ${(r.standStatus||'unknown')===k?'selected':''}>${t}</option>`).join('')}</select></label><label>Местонахождение<input name="location" maxlength="160" value="${esc(r.location||'')}"></label>`:
            `<label>Дата знакомства / просмотра<input name="eventDate" type="text" maxlength="70" value="${esc(r.eventDate||'')}" placeholder="Например, 27.04.2001 или неизвестна"></label><label class="ena-check"><input type="checkbox" name="owned" ${r.ownership==='personal'?'checked':''}> Куплено / принадлежит Ене лично</label><label class="ena-check"><input type="checkbox" name="revisit" ${r.revisit?'checked':''}> ${cat==='films'?'Надо пересмотреть':cat==='books'?'Надо перечитать':'Надо переслушать'}</label>`}
          <label class="ena-check"><input type="checkbox" name="favorite" ${r.favorite?'checked':''}> ★ Избранное</label>
          ${cat==='anomalies'?`<label class="ena-check"><input type="checkbox" name="anomalyViewed" ${r.anomalyViewed||r.progress==='viewed'?'checked':''}> Содержимое просмотрено</label><label class="ena-check"><input type="checkbox" name="anomalyStudied" ${r.anomalyStudied||r.progress==='studied'?'checked':''}> Объект исследован</label>`:''}
        </div>
        <div class="ena-form-col">
          <label>Обложка / фотография — ссылка https://<input name="coverUrl" type="url" placeholder="https://..." value="${esc(coverSrc(r).startsWith('https://')?r.cover:'')}"></label>
          <label>Или выбрать изображение с устройства<input type="file" name="coverFile" accept="image/png,image/jpeg,image/webp"></label>
          ${coverSrc(r)?`<label class="ena-check"><input type="checkbox" name="removeCover"> Удалить текущую обложку</label>`:''}
          <small>Файлы сжимаются для экономии места в сохранении чата. При отсутствии изображения — обычная ретро-обложка.</small>
          <label>Личные заметки<textarea name="detail" rows="5" maxlength="2400" placeholder="Только известное Ене; никаких автоматически придуманных воспоминаний">${esc(r.detail||'')}</textarea></label>
          <label>Источник / ссылка на сообщение (необязательно)<input name="source" maxlength="240" value="${esc(r.source||'')}" placeholder="Например, сообщение №1117"></label>
        </div>
      </div>
      <div class="ena-editor-foot">${id?`<button type="button" data-action="delete-record" data-scope="archive-${cat}" data-id="${esc(id)}">Удалить запись</button>`:''}<button type="button" data-action="archive-cancel">Отмена</button><button type="submit" class="ena-primary">${id?'Сохранить изменения':'Добавить в Архив'}</button></div>
    </form></div>`;
  }
  function archiveHTML(){const cat=ui.tab.archive;const rows=meta().archive[cat].filter(r=>beta.archiveValid(r));const name=categories[cat][0];
    const term=ui.search.trim().toLocaleLowerCase('ru');
    const filtered=rows.filter(r=>{
      if(term&&!`${r.title||''} ${r.year||''} ${r.detail||''}`.toLocaleLowerCase('ru').includes(term))return false;
      if(ui.filter==='favorites')return !!r.favorite;
      if(ui.filter==='owned')return r.ownership==='personal';
      if(ui.filter==='revisit')return !!r.revisit;
      if(ui.filter==='finished')return cat==='anomalies'?!!(r.anomalyViewed||r.anomalyStudied||r.progress==='viewed'||r.progress==='studied'):r.progress===completedProgress[cat]||r.progress==='seen'&&cat==='films';
      if(ui.filter==='todo')return cat==='anomalies'?!r.anomalyViewed:r.progress!==completedProgress[cat]&&!(r.progress==='seen'&&cat==='films');
      return true;
    });
    const cards=filtered.length?`<div class="ena-library-grid">${filtered.map(r=>`<article class="ena-library-card" data-record="${esc(r.id)}">
        <button type="button" class="ena-cover-button" data-action="archive-edit" data-id="${esc(r.id)}" aria-label="Открыть карточку ${esc(r.title)}">${mediaArtwork(r,cat)}</button>
        <div class="ena-library-text"><button type="button" class="ena-record-title" data-action="archive-edit" data-id="${esc(r.id)}">${esc(r.title)}</button><small>${esc(r.year||'Год неизвестен')}</small>
          <div class="ena-card-meta"><span class="ena-record-state ${cat==='anomalies'?'ena-state-anomaly':''}">${esc(archiveStatus(cat,r))}</span>${r.ownership==='personal'?'<span title="Личная копия">⌑ Моё</span>':''}</div>
          ${cat==='anomalies'?`<div class="ena-card-meta">${r.anomalyViewed||r.progress==='viewed'?'<span>✓ Просмотрено</span>':'<span>○ Не просмотрено</span>'}${r.anomalyStudied||r.progress==='studied'?'<span>⌕ Исследовано</span>':''}</div>`:''}
          <div class="ena-archive-actions"><button type="button" data-action="archive-favorite" data-id="${esc(r.id)}" title="${r.favorite?'Убрать из избранного':'В избранное'}">${r.favorite?'★':'☆'}</button>${cat!=='anomalies'?`<button type="button" data-action="toggle-revisit" data-id="${esc(r.id)}" title="${cat==='films'?'Пересмотреть':cat==='books'?'Перечитать':'Переслушать'}" class="${r.revisit?'ena-revisit-active':''}">↻</button>`:''}<button type="button" data-action="archive-edit" data-id="${esc(r.id)}" title="Подробности">✎</button></div>
        </div></article>`).join('')}</div>`:empty(rows.length?'Ничего не найдено':'Личный архив пока пуст',rows.length?'Измени поиск или фильтры.':'Добавляй фильмы, музыку, книги и необычные находки. Лицензии видеосалона сюда не переносятся.');
    const completed=rows.filter(r=>cat==='anomalies'?r.anomalyViewed||r.progress==='viewed':r.progress===completedProgress[cat]||r.progress==='seen'&&cat==='films').length;
    const highlights=cat==='anomalies'?`<span>${completed} просмотрено</span>`:`<span>${completed} завершено</span><span>${rows.filter(r=>r.revisit).length} повторить</span>`;
    return heading('Мой архив')+tabs('archive',Object.entries(categories).map(([k,v])=>[k,v[0]]))+
      `<div class="ena-archive-tools"><label class="ena-archive-search">⌕ <input type="search" data-field="archive-search" placeholder="Поиск по архиву" value="${esc(ui.search)}"></label><button type="button" class="ena-control" data-action="archive-add">✚ Добавить запись</button></div>
      <div class="ena-archive-body"><aside class="ena-archive-sidebar"><span class="ena-aside-head">${esc(name)}</span>
        ${(cat==='anomalies'?[['all','Все объекты'],['finished','Просмотрено / исследовано'],['todo','Не просмотрено'],['favorites','Избранное']]:archiveFilters).map(([k,t])=>`<button type="button" class="ena-side-option ${ui.filter===k?'ena-side-active':''}" data-filter="${k}">${k==='favorites'?'☆':k==='revisit'?'↻':k==='finished'?'✓':k==='todo'?'○':k==='owned'?'⌑':'▤'} ${cat==='anomalies'&&k==='revisit'?'Требует внимания':esc(t)}</button>`).join('')}
        <div class="ena-archive-summary"><b>В коллекции</b><strong>${rows.length}</strong>${highlights}</div>
      </aside><main class="ena-archive-results">${cards}</main></div>
      <div class="ena-statusline">${esc(name)} · ${rows.length} записей · личный архив, отдельно от видеосалона</div>${ui.archiveEditor?archiveEditorHTML(cat):''}`;
  }
  function selectedArchiveRecord(id){return meta().archive[ui.tab.archive].find(r=>r.id===id);}
  function archiveOpenEditor(id=null){ui.archiveEditor={id,category:ui.tab.archive};fillWindow('archive');}
  function tinyCover(file){return new Promise((resolve,reject)=>{const temp=URL.createObjectURL(file),img=new Image();img.onload=()=>{try{
      const scale=Math.min(1,280/img.width,420/img.height),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(img.width*scale));cv.height=Math.max(1,Math.round(img.height*scale));cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      let result=cv.toDataURL('image/jpeg',0.66);if(result.length>110000)result=cv.toDataURL('image/jpeg',0.42);
      URL.revokeObjectURL(temp);if(result.length>110000)reject(Error('Изображение слишком велико после сжатия'));else resolve(result);
    }catch(e){URL.revokeObjectURL(temp);reject(e);}};img.onerror=()=>{URL.revokeObjectURL(temp);reject(Error('Не удалось открыть изображение'));};img.src=temp;});}
  function salonHTML(){const s=meta().salon;const t=ui.tab.salon;
    const rows=t==='licenses'?s.licenses:t==='tasks'?s.tasks:t==='finance'?s.transactions:t==='documents'?s.documents:null;
    const view=rows? (rows.length?`<div class="ena-row-list">${rows.map(item=>`<div class="ena-data-row"><span>${esc(item.title)}</span><small>${esc(item.detail)}</small><button data-action="delete-record" data-scope="salon-${t}" data-id="${esc(item.id)}">×</button></div>`).join('')}</div>`:empty('Записей пока нет','Добавляй только подтверждённые факты. Это отдельный от личного Архива учёт.')):
    `<div class="ena-salon-home"><div class="ena-pane">${icon('videoclub',50)}<strong>Видеосалон Ены</strong><p>Лицензии, задачи, документы, выручка и расходы.</p><p>Без счётчика каждого посетителя и без игровых характеристик.</p></div><div class="ena-pane"><b>Сейчас в учёте</b><p>Лицензий: ${s.licenses.length}</p><p>Задач: ${s.tasks.length}</p><p>Документов: ${s.documents.length}</p><p>Финансовых записей: ${s.transactions.length}</p></div></div>`;
    const form=ui.adding==='salon'&&rows?`<form class="ena-add-form" data-form="salon"><input required name="title" maxlength="160" placeholder="Название / статья"><input name="detail" maxlength="220" placeholder="Примечание, сумма или срок"><button type="submit">Сохранить</button></form>`:'';
    return heading('Видеосалон · работа')+tabs('salon',[['overview','Главная'],['licenses','Лицензии'],['finance','Финансы'],['tasks','Задачи'],['documents','Документы']])+
      `<div class="ena-subtoolbar"><span>Коммерческий каталог не попадает в личные ачивки.</span>${rows?'<button data-action="show-add" data-kind="salon">+ Добавить</button>':''}</div>`+form+`<div class="ena-content ena-scroll">${view}</div>`;
  }
  function directoryHTML(){const t=ui.tab.directory;const rows=meta().directory[t];return heading('Справочник')+tabs('directory',[['people','Люди'],['places','Места']])+`<div class="ena-subtoolbar"><span>Только то, что Ене известно.</span><button data-action="show-add" data-kind="directory">+ Запись</button></div>`+(ui.adding==='directory'?`<form class="ena-add-form" data-form="directory"><input name="title" required maxlength="140" placeholder="${t==='people'?'Имя':'Название места'}"><input name="detail" maxlength="400" placeholder="Известные подробности"><button>Сохранить</button></form>`:'')+`<div class="ena-content ena-scroll">${rows.length?`<div class="ena-row-list">${rows.map(r=>`<div class="ena-data-row"><span>${esc(r.title)}</span><small>${esc(r.detail)}</small><button data-action="delete-record" data-scope="directory-${t}" data-id="${esc(r.id)}">×</button></div>`).join('')}</div>`:empty('Пока пусто','Это личные знания Ены, не всезнающий реестр GM.')}</div>`;}
  function notesHTML(){return heading('Заметки')+`<div class="ena-notes-wrap"><p>Личный блокнот Ены. Записи редактируешь только ты; нейросеть не пишет её мысли.</p><textarea class="ena-notes" data-field="notes" spellcheck="true" placeholder="Записать мысль, адрес, напоминание…">${esc(meta().notes)}</textarea><small>Автосохранение в данных текущего чата • ручное редактирование</small></div>`;}
  function computerHTML(){const s=settings(),m=meta();return heading('Мой компьютер — настройки')+`<div class="ena-content ena-settings-content"><div class="ena-settings-block"><b>Оформление</b><label>Обои <select data-select="wallpaper"><option value="city" ${s.wallpaper==='city'?'selected':''}>Городские сумерки</option><option value="classic" ${s.wallpaper==='classic'?'selected':''}>Классический синий</option></select></label><label>Размер иконок <input type="range" min="44" max="72" value="${Number(s.iconSize)||56}" data-field="icon-size"><output>${Number(s.iconSize)||56} px</output></label><label>Свои обои <input type="file" accept="image/*" data-field="wallpaper-file"></label><button data-action="reset-wallpaper">Сбросить личные обои</button><small>Загруженные обои хранятся только в этом браузере, не синхронизируются с другим устройством.</small></div><div class="ena-settings-block"><b>Дата и время в сюжете</b><label>Игровая дата <input type="date" data-field="game-date" value="${esc(m.gameDate||'')}"></label><label>Игровое время <input type="time" data-field="game-time" value="${esc(m.gameTime||'')}"></label><small>Время не течёт автоматически, поскольку внутри ролевой игры оно меняется событиями.</small></div><div class="ena-settings-block"><b>Поведение</b><label><input type="checkbox" data-field="auto-open" ${s.autoOpen?'checked':''}> Открывать по фразе «Ена открыла ноутбук»</label><label><input type="checkbox" data-field="show-fab" ${s.showFab?'checked':''}> Показывать кнопку ноутбука в SillyTavern</label><small>Никаких API-запросов и затрат токенов в этой версии.</small></div></div>`;}
  function gmHTML(){const t=ui.tab.gm,m=meta();const rows=t==='body'?m.gm.injuries:t==='items'?m.gm.items:t==='quests'?m.gm.quests:null;
    const view=rows?rows.length?`<div class="ena-row-list">${rows.map(r=>`<div class="ena-data-row"><span>${esc(r.title)}</span><small>${esc(r.detail)}</small><button data-action="delete-record" data-scope="gm-${t}" data-id="${esc(r.id)}">×</button></div>`).join('')}</div>`:empty('Нет подтверждённых записей','Можно добавить вручную, пока нейросинхронизация не подключена.'):
      `<div class="ena-gm-home"><div class="ena-pane"><b>GM • за пределами сюжета</b><p>Отдельная панель для тебя, а не программа, которую видит Ена.</p><p>Никаких полосок энергии, стресса или выдуманного здоровья.</p></div><div class="ena-pane"><b>Состояние</b><p>Внешние травмы и следы: ${m.gm.injuries.length}</p><p>Инвентарь: ${m.gm.items.length}</p><p>Задания: ${m.gm.quests.length}</p><p>Банк и знания NPC — следующие версии.</p></div></div>`;
    return heading('GM — только для игрока')+tabs('gm',[['overview','Обзор'],['body','Следы и травмы'],['items','Инвентарь'],['quests','Задания']])+`<div class="ena-subtoolbar"><span>Ручные данные, без автоматической синхронизации.</span>${rows?'<button data-action="show-add" data-kind="gm">+ Запись</button>':''}</div>`+(ui.adding==='gm'&&rows?`<form class="ena-add-form" data-form="gm"><input required name="title" maxlength="160" placeholder="Что произошло"><input name="detail" maxlength="300" placeholder="Где, когда, детали"><button>Сохранить</button></form>`:'')+`<div class="ena-content ena-scroll">${view}</div>`;
  }
  function renderTaskbar(){if(!root)return;root.querySelector('.ena-task-items').innerHTML=[...ui.windows.keys()].map(k=>`<button class="ena-task-button ${ui.active===k?'ena-task-active':''}" data-task="${k}" title="${esc(titles[k])}">${icon(k,18)}<span>${esc(titles[k])}</span></button>`).join('');}
  function updateClock(){if(!root)return;const m=meta();root.querySelector('.ena-tray-time').textContent=m.gameTime||'--:--';root.querySelector('.ena-tray-date').textContent=m.gameDate?m.gameDate.split('-').reverse().join('.'): '2001';}
  function renderMenus(){if(!root)return;root.querySelector('.ena-menu-slot').innerHTML=ui.start?`<div class="ena-start-menu"><div class="ena-start-stripe">Ena <b>2001</b></div><div class="ena-start-main"><div class="ena-start-entry" data-action="open" data-app="archive">${icon('archive',27)} Архив</div><div class="ena-start-entry" data-action="open" data-app="computer">${icon('computer',27)} Настройки</div><div class="ena-start-entry" data-action="open" data-app="gm">${icon('gm',27)} GM • вне сюжета</div><div class="ena-start-rule"></div><button data-action="sleep">☾ Ждущий режим</button><button data-action="shutdown">⏻ Выключить ноутбук</button></div></div>`:'';
    root.querySelector('.ena-calendar-slot').innerHTML=ui.calendar?renderCalendar():'';
  }
  function renderCalendar(){const m=meta(),d=m.gameDate?new Date(m.gameDate+'T12:00:00'):new Date('2001-01-01T12:00:00');let y=d.getFullYear(),month=d.getMonth();if(ui.calendarMonth){y=ui.calendarMonth[0];month=ui.calendarMonth[1];}
    const first=(new Date(y,month,1).getDay()+6)%7,days=new Date(y,month+1,0).getDate();const weeks=[];for(let i=0;i<first;i++)weeks.push('<span></span>');for(let day=1;day<=days;day++){const selected=m.gameDate===`${y}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;weeks.push(`<button type="button" data-action="day-select" data-day="${day}" data-month="${month}" data-year="${y}" class="${selected?'ena-cal-selected':''}">${day}</button>`);}const monthName=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(new Date(y,month,1));
    return `<div class="ena-calendar-popup"><div class="ena-cal-heading"><button data-action="cal-prev">◀</button><b>${esc(monthName)}</b><button data-action="cal-next">▶</button></div><div class="ena-cal-grid">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(s=>`<strong>${s}</strong>`).join('')}${weeks.join('')}</div><div class="ena-cal-hint">${m.gameDate?'Сюжетная дата • выбрать день':'Дата сюжета не задана. Выбери день.'}</div></div>`;
  }
  function doAction(action,el){if(beta.action(action,el))return;const key=el.dataset.app,id=el.dataset.id;
    if(action==='start'){ui.start=!ui.start;ui.calendar=false;renderMenus();return;}
    if(action==='calendar'){ui.calendar=!ui.calendar;ui.start=false;ui.calendarMonth=null;renderMenus();return;}
    if(action==='shutdown'){shutdown(true);return;}
    if(action==='sleep'){shutdown(false);return;}
    if(action==='open'){ui.start=false;renderMenus();openWindow(key);return;}
    if(action==='close'){ui.windows.get(key)?.remove();ui.windows.delete(key);delete meta().apps[key];ui.active=null;saveMeta();renderTaskbar();return;}
    if(action==='minimize'){ui.windows.get(key)?.classList.add('ena-minimized');ui.active=null;renderTaskbar();return;}
    if(action==='maximize'){const w=ui.windows.get(key);if(!w)return;w.classList.toggle('ena-maximized');focusWindow(key);return;}
    if(action==='archive-add'){archiveOpenEditor();return;}
    if(action==='archive-edit'){archiveOpenEditor(id);return;}
    if(action==='archive-cancel'){ui.archiveEditor=null;fillWindow('archive');return;}
    if(action==='archive-favorite'){const r=selectedArchiveRecord(id);if(r){r.favorite=!r.favorite;saveMeta();fillWindow('archive');}return;}
    if(action==='show-add'){ui.adding=ui.adding===el.dataset.kind?null:el.dataset.kind;const active=el.closest('.ena-window')?.dataset.app;if(active)fillWindow(active);return;}
    if(action==='cycle-progress'){const cat=ui.tab.archive,r=meta().archive[cat].find(x=>x.id===id);if(r){const cycle=cat==='anomalies'?['found','unseen','viewed','studied']:['planned','started','seen'];r.progress=cycle[(cycle.indexOf(r.progress)+1)%cycle.length];saveMeta();fillWindow('archive');}return;}
    if(action==='toggle-revisit'){const r=meta().archive[ui.tab.archive].find(x=>x.id===id);if(r){r.revisit=!r.revisit;saveMeta();fillWindow('archive');}return;}
    if(action==='delete-record'){let [scope,part]=el.dataset.scope.split('-');let arr=scope==='archive'?meta().archive[part]:scope==='salon'?meta().salon[part==='finance'?'transactions':part==='licenses'?'licenses':part==='tasks'?'tasks':'documents']:scope==='directory'?meta().directory[part]:scope==='gm'?meta().gm[part==='body'?'injuries':part==='items'?'items':'quests']:null;if(!arr)return;
      if(!confirm('Удалить эту запись? Это не меняет сообщения ролевого чата.'))return;const i=arr.findIndex(x=>x.id===id);if(i>=0)arr.splice(i,1);if(scope==='archive')ui.archiveEditor=null;saveMeta();fillWindow(scope==='salon'?'salon':scope==='directory'?'directory':scope==='archive'?'archive':'gm');return;}
    if(action==='reset-wallpaper'){localWallpaper=null;try{localStorage.removeItem('ena-desktop-wallpaper');}catch{}persistSettings();updateWallpaper();fillWindow('computer');toast('Обои восстановлены');return;}
    if(action==='cal-prev'||action==='cal-next'){const ref=ui.calendarMonth?new Date(ui.calendarMonth[0],ui.calendarMonth[1],1):new Date((meta().gameDate||'2001-01-01')+'T12:00:00');ref.setMonth(ref.getMonth()+(action==='cal-prev'?-1:1));ui.calendarMonth=[ref.getFullYear(),ref.getMonth()];renderMenus();return;}
    if(action==='day-select'){meta().gameDate=`${el.dataset.year}-${String(Number(el.dataset.month)+1).padStart(2,'0')}-${String(el.dataset.day).padStart(2,'0')}`;saveMeta();ui.calendar=false;updateClock();renderMenus();if(ui.windows.has('computer'))fillWindow('computer');return;}
  }
  function handleClick(ev){const ba=ev.target.closest('[data-beta]');if(ba){ev.preventDefault();beta.action(ba.dataset.beta,ba);return;}const act=ev.target.closest('[data-action]');if(act){ev.preventDefault();doAction(act.dataset.action,act);return;}
    const task=ev.target.closest('[data-task]');if(task){const k=task.dataset.task,w=ui.windows.get(k);if(!w)return;if(ui.active===k&&!w.classList.contains('ena-minimized')){w.classList.add('ena-minimized');ui.active=null;renderTaskbar();}else {w.classList.remove('ena-minimized');focusWindow(k);}return;}
    const tab=ev.target.closest('[data-tab]');if(tab){ui.tab[tab.dataset.tabGroup]=tab.dataset.tab;ui.adding=null;ui.filter='all';ui.search='';ui.archiveEditor=null;fillWindow(tab.dataset.tabGroup);return;}
    const filter=ev.target.closest('[data-filter]');if(filter){ui.filter=filter.dataset.filter;fillWindow('archive');return;}
    const shortcut=ev.target.closest('.ena-desktop-icon');if(shortcut){if(window.matchMedia?.('(pointer:coarse)')?.matches){openWindow(shortcut.dataset.open);}else shortcut.focus();return;}
    const win=ev.target.closest('.ena-window');if(win)focusWindow(win.dataset.app);
    if(!ev.target.closest('.ena-start-menu,.ena-start-button')){ui.start=false;renderMenus();}
  }
  function handleDoubleClick(ev){const shortcut=ev.target.closest('[data-open]');if(shortcut)openWindow(shortcut.dataset.open);}
  async function handleSubmit(ev){const betaForm=ev.target.closest('form[data-beta-form]');if(betaForm){beta.submit(betaForm,ev);return;}const form=ev.target.closest('form[data-form]');if(!form)return;ev.preventDefault();const fd=new FormData(form),kind=form.dataset.form,active=form.closest('.ena-window')?.dataset.app,title=String(fd.get('title')||'').trim();if(!title)return;
    if(kind==='archive'){
      const cat=ui.tab.archive,editId=form.dataset.editId,previous=editId?selectedArchiveRecord(editId):null;
      const item=previous||{id:uid()};
      const requestedUrl=String(fd.get('coverUrl')||'').trim();
      const file=fd.get('coverFile');
      if(requestedUrl&&!/^https:\/\//i.test(requestedUrl)){toast('Для обложки нужна ссылка https://');return;}
      let cover=fd.get('removeCover')?'':(item.cover||'');
      if(requestedUrl)cover=requestedUrl.slice(0,1200);
      if(file instanceof File&&file.size){if(file.size>5_000_000){toast('Файл должен быть не более 5 МБ');return;}
        try{cover=await tinyCover(file);}catch(e){toast(e.message||'Ошибка загрузки обложки');return;}}
      const newFields={title:title.slice(0,160),detail:String(fd.get('detail')||'').trim().slice(0,2400),year:String(fd.get('year')||'').trim().slice(0,40),progress:String(fd.get('progress')||'planned'),cover,
        favorite:fd.has('favorite'),source:String(fd.get('source')||'').trim().slice(0,240)};
      if(cat==='anomalies')Object.assign(newFields,{standStatus:String(fd.get('standStatus')||'unknown'),location:String(fd.get('location')||'').trim().slice(0,160),anomalyViewed:fd.has('anomalyViewed'),anomalyStudied:fd.has('anomalyStudied')});
      else Object.assign(newFields,{ownership:fd.has('owned')?'personal':'unknown',revisit:fd.has('revisit'),eventDate:String(fd.get('eventDate')||'').trim().slice(0,70)});
      Object.assign(item,newFields);
      if(!previous)meta().archive[cat].push(item);
      ui.archiveEditor=null;saveMeta();fillWindow('archive');toast(previous?'Запись обновлена':'Добавлено в личный Архив');return;
    }
    const item={id:uid(),title:title.slice(0,160),detail:String(fd.get('detail')||'').trim().slice(0,400)};
    if(kind==='salon'){const t=ui.tab.salon,arr=meta().salon[t==='finance'?'transactions':t];arr.push(item);}
    else if(kind==='directory')meta().directory[ui.tab.directory].push(item);
    else if(kind==='gm'){const t=ui.tab.gm;meta().gm[t==='body'?'injuries':t==='items'?'items':'quests'].push(item);}
    saveMeta();ui.adding=null;fillWindow(active);toast('Запись сохранена');
  }
  function handleChange(ev){if(beta.change(ev.target,ev))return;const el=ev.target,field=el.dataset.field,selection=el.dataset.select,s=settings(),m=meta();
    if(selection==='archive-filter'){ui.filter=el.value;fillWindow('archive');return;}
    if(selection==='wallpaper'){s.wallpaper=el.value;localWallpaper=null;try{localStorage.removeItem('ena-desktop-wallpaper');}catch{}persistSettings();updateWallpaper();return;}
    if(field==='game-date'){m.gameDate=el.value;saveMeta();updateClock();return;}
    if(field==='game-time'){m.gameTime=el.value;saveMeta();updateClock();return;}
    if(field==='auto-open'){s.autoOpen=el.checked;persistSettings();return;}
    if(field==='show-fab'){s.showFab=el.checked;persistSettings();return;}
    if(field==='wallpaper-file'){const file=el.files?.[0];if(!file)return;if(file.size>8_000_000){toast('Изображение слишком большое (максимум 8 МБ)');return;}const reader=new FileReader();reader.onload=()=>{
      const img=new Image();img.onload=()=>{const cv=document.createElement('canvas'),scale=Math.min(1,1600/img.width,1000/img.height);cv.width=Math.round(img.width*scale);cv.height=Math.round(img.height*scale);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        try{const data=cv.toDataURL('image/jpeg',0.78);localStorage.setItem('ena-desktop-wallpaper',data);localWallpaper=data; // Browser-local: never stored in ST settings.
          updateWallpaper();toast('Обои изменены только в этом браузере');}
        catch(e){toast('Не удалось сохранить обои: недостаточно места');}
      };img.src=reader.result;
    };reader.readAsDataURL(file);return;}
  }
  function handleInput(ev){if(beta.input(ev.target))return;const field=ev.target.dataset.field;if(field==='archive-search'){ui.search=ev.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{const cur=root.querySelector('[data-field=archive-search]');const selection=cur?{start:cur.selectionStart,end:cur.selectionEnd}:null;fillWindow('archive');const next=root.querySelector('[data-field=archive-search]');if(next){next.focus();if(selection)next.setSelectionRange(selection.start,selection.end);}},240);return;}if(field==='notes'){meta().notes=ev.target.value;queueSave();return;}if(field==='icon-size'){settings().iconSize=Number(ev.target.value);persistSettings();updateWallpaper();ev.target.nextElementSibling&&(ev.target.nextElementSibling.textContent=ev.target.value+' px');}}
  function handlePointerDown(ev){const title=ev.target.closest('.ena-titlebar');if(!title||ev.target.closest('button')||ev.button!==0)return;const win=title.closest('.ena-window');if(!win||win.classList.contains('ena-maximized')||window.innerWidth<700)return;
    focusWindow(win.dataset.app);
    const startX=ev.clientX,startY=ev.clientY,x=win.offsetLeft,y=win.offsetTop;
    title.setPointerCapture(ev.pointerId);const move=e=>{const width=win.offsetWidth;const height=win.offsetHeight;win.style.left=Math.max(0,Math.min(window.innerWidth-width,x+e.clientX-startX))+'px';win.style.top=Math.max(0,Math.min(window.innerHeight-height-45,y+e.clientY-startY))+'px';};
    const up=e=>{title.removeEventListener('pointermove',move);title.removeEventListener('pointerup',up);title.removeEventListener('pointercancel',up);const r=meta().layout[win.dataset.app]||{};Object.assign(r,{x:win.offsetLeft,y:win.offsetTop,w:win.offsetWidth,h:win.offsetHeight});meta().layout[win.dataset.app]=r;saveMeta();};
    title.addEventListener('pointermove',move);title.addEventListener('pointerup',up,{once:true});title.addEventListener('pointercancel',up,{once:true});
  }
  function onMessageSent(){if(!settings().autoOpen)return;const c=ctx();const chat=c?.chat||[];const entry=chat.at(-1);if(!entry||!entry.is_user||entry.is_system)return;const text=String(entry.mes||'');const id=`${chat.length}:${text}`;if(lastHandled===id)return;lastHandled=id;
    // No model interpretation, no substring matching other characters' dialogue.
    const sentence='(?:^|[^\\p{L}])Ена[^.!?\\n]{0,100}?';
    const opened=new RegExp(sentence+'(?:открыла|включила|запустила|раскрыла)[^.!?\\n]{0,60}?(?:ноутбук|ноут)(?=$|[^\\p{L}])','iu');
    const closed=new RegExp(sentence+'(?:закрыла|выключила|захлопнула)[^.!?\\n]{0,60}?(?:ноутбук|ноут)(?=$|[^\\p{L}])','iu');
    if(closed.test(text)){if(running)shutdown(false);return;}
    if(opened.test(text)&&!/(?:Ена\s+(?:не|никогда)\s+(?:открыла|включила)|Ена[^.!?\n]{0,30}?не\s+(?:открыла|включила))/i.test(text))boot();
  }
  function init(){if(document.getElementById('ena-desktop-root'))return;generateShell();beta.initialize();const saved=(()=>{try{return localStorage.getItem('ena-desktop-wallpaper')}catch{return null}})();if(saved&&saved.startsWith('data:image/')){localWallpaper=saved;updateWallpaper();}
    const c=ctx();if(c?.eventSource?.on&&c?.event_types){
      if(c.event_types.MESSAGE_SENT)c.eventSource.on(c.event_types.MESSAGE_SENT,onMessageSent);
      if(c.event_types.CHAT_CHANGED)c.eventSource.on(c.event_types.CHAT_CHANGED,()=>{clearTimeout(saveTimer);lastHandled=null;if(running){shutdown(false);boot();}});
    }
    console.info('[EnaDesktop] v'+VERSION+' ready');
  }
  return {init,boot,shutdown};
})();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ENA.init,{once:true});else ENA.init();
