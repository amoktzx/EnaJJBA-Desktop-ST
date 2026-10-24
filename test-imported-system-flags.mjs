import assert from 'node:assert/strict';
import {messageKey,messageSourceStats,isRoleplayMessage,validateEvidence} from './betaCore.js';
import {createBeta} from './beta.js';

// 100 imported roleplay messages: narrator AND player have is_system=true
// (exact shape reported by Ena Desktop's 0-API diagnostic).
const chat=Array.from({length:100},(_,i)=>({
  name:i%2?'Неаполь, 2001 — Рассказчик v2':'Ена Марелова',
  is_user:i%2===0,is_system:true,mes:i%2===0
    ?`Ена забрала документ №${i} и спрятала его в сумку.`
    :`Леоне увидел документ №${i} в руках Ены и запомнил его.`,
  send_date:`2001-04-30T${i}`,swipe_id:0,
}));
const p=chat[0];assert.ok(messageKey(p));assert.ok(messageKey(chat[1]));assert.ok(isRoleplayMessage(p));
const st=messageSourceStats(chat,0,100);
assert.equal(st.entries,100);
assert.equal(st.text,100);
assert.equal(st.flaggedSystem,100);
assert.equal(st.recoveredSystem,100);
assert.equal(st.system,0);
assert.equal(st.mes,100);
assert.equal(st.empty,0);
const notices=[
  {name:'System',is_user:false,is_system:true,mes:'hidden system prompt'},
  {name:'Система',is_user:false,is_system:true,mes:'Служебный контент'},
  {name:'Неаполь',is_user:false,is_system:true,role:'system',mes:'internal'},
  {name:'Неаполь',is_user:false,is_system:true,extra:{type:'system'},mes:'internal'},
  {is_system:true,is_user:false,mes:'anonymous hidden'},
];
for(const x of notices){assert.equal(messageKey(x),'');assert.equal(isRoleplayMessage(x),false)}
assert.equal(messageSourceStats([...chat,...notices],100,5).system,5);
const before=messageKey(chat[0]);
assert.equal(validateEvidence([{index:0,key:before}],[{...chat[0]}]),true);
assert.equal(validateEvidence([{index:0,key:before}],[{...chat[0],mes:'Изменённая сцена'}]),false);
assert.equal(validateEvidence([{index:0,key:before}],[{...chat[0],swipe_id:1}]),false);
let requests=0;const ctx={chat,chatId:'Naples',characterId:1,generateRaw:async()=>{requests++;return JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Документ №0 в сумке',detail:'Ена забрала документ.',message_ids:['m0'],quote:'забрала документ №0',confidence:'high'}]});}};
const db={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},gm:{},directory:{},beta:{records:[],proposals:[],history:[],schema:2,syncCursor:0,syncRuns:0,migrated:true,linksMigrated:true,fullScan:{cursor:50,total:100,status:'paused',added:0,blocks:2}}};
const config={enaSync:{automatic:false,interval:50,profileId:'active'}};
const beta=createBeta({meta:()=>db,ctx:()=>ctx,settings:()=>config,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'',oldNotes:()=>''});
const click=t=>beta.action(t,{closest:()=>({}),dataset:{}});
assert.match(beta.view('gm'),/Старый прогресс недостоверен/);
assert.doesNotMatch(beta.view('gm'),/data-beta="scan-resume"/);
click('scan-resume');assert.equal(requests,0);
click('scan-read-inspect');assert.equal(requests,0);
assert.equal(beta.state().scanDiagnostics.ranges[2].text,100);
assert.match(beta.view('gm'),/восстановлено игровых 100/);
click('scan-diagnose-early');
await new Promise(r=>setTimeout(r,130));
assert.equal(requests,1);
assert.equal(beta.state().scanDiagnostics.status,'ok');
assert.equal(beta.state().scanDiagnostics.acceptable,1);
assert.equal(beta.state().fullScan.cursor,50);
assert.equal(beta.state().proposals.length,0);
console.log('Imported chat: 100 system-flagged RP messages readable; real service messages excluded; links stable; old cursor guarded; safe GLM test PASS');
