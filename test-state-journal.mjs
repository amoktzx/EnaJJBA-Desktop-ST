import assert from 'node:assert/strict';
import {projectStates,entityKeyOf,canonicalEntityKey} from './entityState.js';
import {createBeta} from './beta.js';
import {messageKey} from './betaCore.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';

const chat=Array.from({length:105},(_,i)=>({name:'Ена',is_user:true,is_system:true,mes:`Сообщение ${i}: Ена работает в Неаполе`,swipe_id:0,send_date:'2001-04-28:'+i}));
const sources=i=>[{index:i,key:messageKey(chat[i])}];
const mk=(id,at,entityKey,entityStatus,scope='gm:body',title='Ожог левой кисти Леоне')=>({id,scope,entityKey,entityLabel:title,entityStatus,title,detail:title+' / '+entityStatus,action:'update',sources:sources(at),status:'approved',created:'2026-10-24T00:00:00'});
const first=mk('burn-found',10,'Леоне:левая кисть:ожог','active');
const second=mk('burn-dressed',55,'Леоне:левая кисть:ожог','in_progress');
const last=mk('burn-healed',100,'Леоне:левая кисть:ожог','healed');
assert.equal(entityKeyOf(first),canonicalEntityKey('gm:body','Леоне:левая кисть:ожог'));
// Later approvals before earlier approvals must still yield the latest in-story state.
let states=projectStates([last,first,second]);
assert.equal(states.length,1); assert.equal(states[0].state,'healed');
assert.deepEqual(states[0].history.map(x=>x.proposalId),['burn-found','burn-dressed','burn-healed']);
// No active healing event once its source is removed/edited or its status changes.
states=projectStates([first,second,last],p=>p.id!=='burn-healed');
assert.equal(states.length,1);assert.equal(states[0].state,'in_progress');
last.status='deleted';states=projectStates([first,second,last]);assert.equal(states[0].state,'in_progress');
second.status='rejected';states=projectStates([first,second,last]);assert.equal(states[0].state,'active');
// A different body part or another NPC is a separate state.
const extra=mk('second-wound',60,'Ена:шея:ссадина','healed','gm:body','Ссадина на шее Ены');
assert.equal(projectStates([first,extra]).length,2);
// Unlinked legacy proposals should NOT auto-migrate to entity states.
assert.equal(entityKeyOf({scope:'gm:body',title:'Ожог Леоне'}),'');

// A single physical disk changes ownership/status; the earlier find stays in history.
const diskFound=mk('disk-found',5,'Ена:диск 1','held','gm:inventory','Диск №1');
const diskLost=mk('disk-lost',65,'Ена:диск 1','lost','gm:inventory','Диск №1');
const diskReturned=mk('disk-returned',95,'Ена:диск 1','held','gm:inventory','Диск №1');
let diskView=projectStates([diskLost,diskReturned,diskFound]);
assert.equal(diskView.length,1);
assert.equal(diskView[0].state,'held');
assert.deepEqual(diskView[0].history.map(ev=>ev.proposalId),['disk-found','disk-lost','disk-returned']);
diskView=projectStates([diskLost,diskReturned,diskFound],p=>p.id!=='disk-returned');
assert.equal(diskView[0].state,'lost');
diskView=projectStates([diskFound,diskLost],p=>p.id!=='disk-lost');
assert.equal(diskView[0].state,'held');
// Same object with different accidental labels should merge by ID, not title.
const diskDifferentTitle=mk('disk-lost-2',68,'Ена:диск 1','lost','gm:inventory','Белый диск из Tele-Campania');
assert.equal(projectStates([diskFound,diskDifferentTitle]).length,1);
// Two similar but distinct physical objects stay separated.
const diskTwo=mk('disk-2',18,'Ена:диск 2','held','gm:inventory','Диск №2');
assert.equal(projectStates([diskFound,diskTwo]).length,2);

// Integration: new AI proposal includes explicit stable entity key and does not
// create duplicate b.records; old data is preserved and exports unchanged.
const source=sources(10)[0];
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},gm:{},notes:'',beta:{schema:2,records:[],history:[],proposals:[],migrated:true,linksMigrated:true,syncCursor:null,syncRuns:0}};
const settings={enaSync:{automatic:false,interval:25,review:true,profileId:'active',detailLevel:'focused'}};
const context={chat:chat.slice(0,15),chatId:'JJBA_TEST',chatMetadata:{},generateRaw:async()=>JSON.stringify({changes:[{
 scope:'gm:body',factType:'objective',title:'Ожог на руке Леоне',detail:'Обожжена левая кисть Леоне',quote:'Ена работает',message_ids:['m10'],
 entityKey:'Леоне:левая кисть:ожог',entityLabel:'Ожог левой кисти Леоне',action:'create',entityStatus:'active',confidence:'high'}]})};
const ui={windows:new Map(),tab:{gm:'sync'}};
const beta=createBeta({meta:()=>meta,ctx:()=>context,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui,oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const click=(name,id)=>beta.action(name,{dataset:{id},closest:()=>({})});
click('scan-last');await new Promise(r=>setTimeout(r,100));
assert.equal(meta.beta.proposals.length,1);assert.equal(meta.beta.proposals[0].entityKey,'Леоне:левая кисть:ожог');
click('approve',meta.beta.proposals[0].id);
assert.equal(meta.beta.proposals[0].status,'approved');assert.equal(meta.beta.records.length,0);
ui.tab.gm='states';assert.match(beta.view('gm'),/Ожог левой кисти Леоне/);assert.match(beta.view('gm'),/История изменений/);
ui.tab.gm='body';assert.match(beta.view('gm'),/Ожог левой кисти Леоне/);
const snap=exportFullSnapshot(meta,context.chat.map(messageKey));
assert.equal(validateFullSnapshot(snap).data.beta.proposals[0].entityKey,'Леоне:левая кисть:ожог');
globalThis.confirm=()=>true;click('delete-proposal',meta.beta.proposals[0].id);assert.equal(meta.beta.proposals[0].status,'deleted');
assert.equal(projectStates(meta.beta.proposals).length,0);
ui.tab.gm='states';assert.doesNotMatch(beta.view('gm'),/Ожог левой кисти Леоне/);
console.log('Beta 5.6: approved state projection, retroactive chronology, source rollback, deletion, v5.5 fallback, UI and export PASS');
