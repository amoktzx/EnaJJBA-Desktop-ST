import assert from 'node:assert/strict';
import {createBeta} from './beta.js';
import {messageKey} from './betaCore.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
const chat=[{mes:'Ена увидела два диска и спрятала их в сумке.',is_user:true,send_date:'2001-04-27',swipe_id:0}];
const source={index:0,key:messageKey(chat[0])};
const m={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},notes:'',gm:{}};
const s={enaSync:{automatic:false,interval:50,review:true,profileId:'active'}};
const win={has:()=>false};
const context={chat,chatMetadata:{},extensionSettings:{},saveMetadata:()=>Promise.resolve(),generateRaw:async()=>JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Два диска на руках',detail:'Ена спрятала два диска в сумке',quote:'два диска',message_ids:['m0'],confidence:'high'}]})};
const b=createBeta({meta:()=>m,ctx:()=>context,settings:()=>s,persistSettings:()=>{},saveMeta:()=>{},toast:(msg)=>{},fillWindow:()=>{},ui:{windows:win,tab:{gm:'sync'}},oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const click=(type,id='',value='')=>b.action(type,{closest:()=>({}),dataset:{id,value}});
const wait=()=>new Promise(r=>setTimeout(r,30));
// Generate a fact from chat, then re-run and confirm it does not duplicate.
click('scan-last');await wait();assert.equal(b.state().proposals.length,1);
click('scan-last');await wait();assert.equal(b.state().proposals.length,1);
// Rejection blocks re-detection with exactly the same original evidence.
const id=b.state().proposals[0].id;click('reject',id);assert.equal(b.state().proposals[0].status,'rejected');
click('scan-last');await wait();assert.equal(b.state().proposals.length,1);
// After deletion, the same source may be proposed again.
globalThis.confirm=()=>true;click('delete-proposal',id);
assert.equal(b.state().proposals[0].status,'deleted');click('scan-last');await wait();
assert.equal(b.state().proposals.length,2);
const newId=b.state().proposals.at(-1).id;
click('approve',newId);assert.equal(b.state().records.length,1);
assert.equal(b.state().proposals.at(-1).status,'approved');
click('delete-proposal',newId);assert.equal(b.state().records[0].deleted,true);
const exported=exportFullSnapshot(m,chat.map(messageKey));
assert.equal(exported.statusCounts.deleted,2);
assert.equal(validateFullSnapshot(exported).data.beta.proposals.length,2);
console.log('Integration test: scan → dedup → reject → delete → repropose → approve → revoke → export: PASSED');
