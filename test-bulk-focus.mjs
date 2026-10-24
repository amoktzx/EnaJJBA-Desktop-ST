import assert from 'node:assert/strict';
import {createBeta} from './beta.js';
import {messageKey} from './betaCore.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
const chat=Array.from({length:14},(_,i)=>({mes:`Ена получила важную посылку номер ${i} от Леоне`,is_user:true,is_system:true,name:'Ена',send_date:`2001-04-29T${i}`,swipe_id:0}));
const src=i=>[{index:i,key:messageKey(chat[i])}];
const proposals=[
 {id:'pending1',scope:'gm:inventory',factType:'objective',status:'pending',title:'Первый предмет',detail:'Вещь в сумке',quote:'важную посылку',sources:src(0)},
 {id:'approved1',linkedRecordId:'auto1',scope:'gm:inventory',factType:'objective',status:'approved',title:'Принятый предмет',detail:'В сумке',quote:'важную посылку',sources:src(1)},
 {id:'rejected1',scope:'gm:knowledge',factType:'npc_suspicion',status:'rejected',title:'Подозрение',detail:'Узнал новость',quote:'важную посылку',sources:src(2)},
 {id:'deleted1',scope:'gm:events',factType:'objective',status:'deleted',title:'Удалённое старое',detail:'Архив',quote:'важную посылку',sources:src(3)},
];
const state={schema:2,records:[{id:'auto1',proposalId:'approved1',scope:'gm:inventory',title:'Принятый предмет',detail:'В сумке',sources:src(1)}, {id:'manual1',manual:true,scope:'gm:events',title:'Ручной факт',detail:'Не трогать',sources:[]}],proposals,history:[{time:'2001',summary:'Полная проверка приостановлена на сообщении 25'}, {time:'2001',summary:'Добавлен ручной факт'}],migrated:true,linksMigrated:true,syncCursor:14,syncRuns:11,fullScan:{cursor:11,total:14,status:'paused',added:2,blocks:3,lastError:'API request failed → Bad Request',failedStart:11},scanDiagnostics:{status:'failed',error:'Bad Request'}};
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},gm:{},directory:{},notes:'',beta:state};
const settings={enaSync:{automatic:false,interval:25,profileId:'active'}};
let saves=0, systemPrompt='';
const ctx={chat,chatId:'test',characterId:1,chatMetadata:{},generateRaw:async({systemPrompt:sys})=>{systemPrompt=sys;return JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Важная посылка',detail:'Ена получила посылку',quote:'важную посылку',message_ids:['m4'],confidence:'high'}]});}};
const beta=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{saves++},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const click=(type,id='',value='')=>beta.action(type,{closest:()=>({}),dataset:{id,value}});
globalThis.confirm=()=>true;
assert.match(beta.view('gm'),/Массовые действия/);assert.match(beta.view('gm'),/Удалить выбранные навсегда/);
assert.match(beta.view('gm'),/Строго: факты справочника/);
// Clearing errors doesn't touch cursors and statuses.
click('clear-scan-errors');assert.equal(state.fullScan.cursor,11);assert.equal(state.fullScan.lastError,'');assert.equal(state.scanDiagnostics.status,'idle');assert.equal(state.history.length,1);assert.equal(state.proposals.length,4);
// Selecting just the two initial statuses and soft-deleting leaves manual records.
beta.change({dataset:{betaInput:'proposal-select',id:'pending1'},checked:true});
beta.change({dataset:{betaInput:'proposal-select',id:'approved1'},checked:true});
click('bulk-delete');assert.equal(state.proposals.find(p=>p.id==='pending1').status,'deleted');assert.equal(state.proposals.find(p=>p.id==='approved1').status,'deleted');assert.equal(state.records.find(r=>r.id==='auto1').deleted,true);assert.equal(state.records.find(r=>r.id==='manual1').deleted,undefined);assert.equal(state.fullScan.cursor,11);
// Reset analysis progress does not remove records, other status decisions or the conversation.
click('reset-scan-progress');assert.equal(state.fullScan.cursor,0);assert.equal(state.fullScan.status,'idle');assert.equal(state.proposals.length,4);assert.equal(chat.length,14);
// All tabs bulk selection and permanent cleanup preserve manually created records.
click('bulk-select-everything');click('bulk-purge');assert.equal(state.proposals.length,0);assert.equal(state.records.length,1);assert.equal(state.records[0].id,'manual1');
assert.equal(validateFullSnapshot(exportFullSnapshot(meta,chat.map(messageKey))).data.beta.records.length,1);
// Focused extraction affects prompt only; doesn't auto-save when dry-run.
click('scan-diagnose-early');await new Promise(r=>setTimeout(r,80));
assert.match(systemPrompt,/СТРОГИЙ РЕЖИМ СПРАВОЧНИКА/);assert.match(systemPrompt,/Ни одной записи о контактах/);assert.equal(beta.state().proposals.length,0);assert.equal(beta.state().scanDiagnostics.status,'ok');
assert.ok(saves>=4);
console.log('Beta 5.5: error reset, multi-selection, soft delete, permanent purge, manual protection, cursor reset, focused model prompt, dry-run, export-import PASSED');
