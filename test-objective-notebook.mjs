import assert from 'node:assert/strict';
import {createBeta,OBJECTIVE_SCOPE_KEYS} from './beta.js';
import {messageKey} from './betaCore.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
assert.ok(OBJECTIVE_SCOPE_KEYS.includes('gm:profiles'));
assert.ok(!OBJECTIVE_SCOPE_KEYS.includes('gm:events'));
assert.ok(!OBJECTIVE_SCOPE_KEYS.includes('gm:knowledge'));
const texts=[
 'Ена спросила про оружие. Леоне поднял куртку и показал пистолет Beretta 92FS.',
 '— Мой рост — метр девяносто восемь, — ответил Леоне Ене.',
 'Леоне посмотрел Ене в глаза и улыбнулся.',
 'Ена забрала у Леоне ключ от мастерской.',
 'Формизано показал Ене квитанцию об оплате 5000 лир.',
 'Леоне назвал Ене своим любимым блюдом пасту с соусом.',
 'Ена и Леоне обнялись.',
 'Ена провела перевязку ожога Леоне.',
 'В магазине Ена купила три книги по налоговому праву.',
 'Леоне посмотрел на море.'
];
const chat=texts.map((mes,i)=>({mes,name:i%2?'Leone':'Ена',is_user:i%2===0,is_system:true,send_date:`2001-05-01T00:00:${String(i).padStart(2,'0')}`}));
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},gm:{},notes:'',beta:{schema:2,records:[],proposals:[],history:[],syncCursor:0,migrated:true,linksMigrated:true,fullScan:{cursor:0,total:10,status:'idle',blocks:0,added:0}}};
let request='',saves=0;
const settings={enaSync:{profileId:'active',detailLevel:'focused',automatic:false}};
const response={changes:[
 {scope:'gm:profiles',factType:'objective',subject:'Леоне Аббаккио',attribute:'модель пистолета',title:'Леоне Аббаккио: пистолет',detail:'Ена увидела пистолет Beretta 92FS у Леоне.',message_ids:['m0'],quote:'пистолет Beretta 92FS'},
 {scope:'gm:profiles',factType:'objective',subject:'Леоне Аббаккио',attribute:'рост',title:'Леоне Аббаккио: рост',detail:'Леоне сказал Ене, что его рост 198 см.',message_ids:['m1'],quote:'Мой рост — метр девяносто восемь'},
 {scope:'gm:profiles',factType:'objective',subject:'',attribute:'',title:'Некорректная характеристика',detail:'Не указан субъект',message_ids:['m1'],quote:'Мой рост'},
 {scope:'gm:events',factType:'objective',title:'Леоне улыбнулся Ене',detail:'Встреча',message_ids:['m2'],quote:'посмотрел Ене в глаза'},
 {scope:'gm:knowledge',factType:'npc_suspicion',title:'Леоне тревожится',detail:'Субъективно',message_ids:['m2'],quote:'посмотрел Ене в глаза'},
 {scope:'gm:inventory',factType:'objective',title:'Ключ от мастерской',detail:'Ена забрала ключ от мастерской у Леоне.',entityKey:'ключ мастерской',entityLabel:'Ключ от мастерской',entityStatus:'held',action:'create',message_ids:['m3'],quote:'забрала у Леоне ключ от мастерской'},
 {scope:'gm:bank',factType:'objective',title:'Квитанция об оплате',detail:'Формизано показал Ене квитанцию на 5000 лир.',message_ids:['m4'],quote:'квитанцию об оплате 5000 лир'},
 {scope:'gm:profiles',factType:'npc_suspicion',subject:'Леоне Аббаккио',attribute:'еда',title:'Догадка о предпочтениях',detail:'Не объективно',message_ids:['m5'],quote:'любимым блюдом пасту'},
 {scope:'gm:profiles',factType:'objective',subject:'Леоне Аббаккио',attribute:'любимое блюдо',title:'Леоне Аббаккио: любимая еда',detail:'Леоне назвал Ене своим любимым блюдом пасту с соусом.',message_ids:['m5'],quote:'любимым блюдом пасту с соусом'}
]};
const ctx={chat,chatId:'objective_diary',characterId:1,generateRaw:async ({systemPrompt})=>{request=systemPrompt;return JSON.stringify(response)}};
const b=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{saves++},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
b.action('scan-diagnose-early',{dataset:{},closest:()=>({})});
const start=Date.now();while(!meta.beta.scanDiagnostics.preview&&Date.now()-start<4000)await new Promise(r=>setTimeout(r,15));
const diag=meta.beta.scanDiagnostics;
assert.equal(diag.extracted,9);
assert.equal(diag.acceptable,4);
assert.equal(diag.discarded['не раздел объективного справочника (сюжет/отношения/догадки)'],2);
assert.equal(diag.discarded['мнение или подозрение вместо объективного факта'],1);
assert.equal(diag.discarded['внешность берётся один раз из World Info, не из сцен'],1);
assert.equal(diag.discarded['нет персонажа или типа свойства / комплекта'],1);
assert.match(request,/Memory Books/);
assert.match(request,/любим|любимые/);
assert.match(request,/НЕ ХРАНИТЬ:/);
assert.equal(meta.beta.proposals.length,0);
assert.equal(meta.beta.fullScan.cursor,0);
const html=b.view('gm');
for(const id of ['gm-options','gm-scan','gm-maintenance','gm-diagnostics','gm-bulk','gm-proposals','gm-invalid','gm-log'])assert.ok(html.includes(`data-ena-fold="${id}"`),id);
for(const a of ['clear-scan-errors','reset-scan-progress','bulk-select-visible','bulk-delete','bulk-purge','scan-diagnose-early','scan-all'])assert.ok(html.includes(`data-beta="${a}"`),a);
assert.ok(html.includes('data-tab="profiles"'));
assert.match(html,/сворачиваемых|справочник|Досье/);
const snap=exportFullSnapshot(meta,chat.map(messageKey));
assert.equal(validateFullSnapshot(snap).data.beta.proposals.length,0);
assert.ok(saves>0);
console.log('Beta 5.7 Objective Notebook: 9 analyzed, 4 accepted, 5 properly discarded; foldable controls, no mutation, backup compatibility PASS');
