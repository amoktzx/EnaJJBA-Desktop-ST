import assert from 'node:assert/strict';
import {createBeta} from './beta.js';

function makeHarness(total, behavior){
 const chat=Array.from({length:total},(_,i)=>({mes:`Ена нашла предмет номер ${i}; теперь он в сумке.`,is_user:true,send_date:`2001-04-27T${i}`,swipe_id:0}));
 let requests=0;let saved=0;
 const persist={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},gm:{},directory:{},notes:''};
 const settingsObj={enaSync:{automatic:false,interval:50,profileId:'active'}};
 const context={chat,chatId:'Neapol_2001',characterId:1,chatMetadata:{},extensionSettings:{},saveMetadata:async()=>{},generateRaw:async({prompt})=>{
   requests++;
   return behavior({requests,prompt});
 }};
 const b=createBeta({meta:()=>persist,ctx:()=>({...context,chatMetadata:{}}),settings:()=>settingsObj,persistSettings:()=>{},saveMeta:()=>{saved++},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'',oldNotes:()=>''});
 globalThis.confirm=()=>true;
 const click=type=>b.action(type,{closest:()=>({}),dataset:{}});
 return {b,click,counts:()=>({requests,saved})};
}

async function until(fn,timeout=13000){const started=Date.now();while(!fn()){if(Date.now()-started>timeout)throw Error('Timed out');await new Promise(r=>setTimeout(r,40));}}

// Persistent failure: first API fails, resume same chunk, then carries on without reset.
{
 const h=makeHarness(65,({requests,prompt})=>{if(requests===1)throw new Error('429 rate limit temporary');const n=prompt.match(/Ена нашла предмет номер (\d+)/)?.[1];return JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Ена нашла предмет',detail:'Предмет теперь у Ены',message_ids:['m0'],quote:'Ена нашла предмет номер '+n,confidence:'high'}]});});
 h.click('scan-all');
 await until(()=>h.b.state().fullScan.status==='paused');
 assert.equal(h.b.state().fullScan.cursor,0);
 assert.match(h.b.state().fullScan.lastError,/429/);
 assert.match(h.b.view('gm'),/429/);
 h.click('scan-resume');
 await until(()=>h.b.state().fullScan.status==='complete');
 assert.equal(h.b.state().fullScan.cursor,65);
 assert.equal(h.b.state().fullScan.blocks,2);
 assert.equal(h.b.state().fullScan.lastError,'');
 assert.equal(h.counts().requests,3);
 console.log('Persistent error + resume + stable chatID test: PASS');
}
// malformed JSON in 50-message chunk; automatic size reduction to 25 and no skipped messages.
{
 const h=makeHarness(60,({prompt})=>{
   const batch=(prompt.match(/"id":"m\d+"/g)||[]).length;
   if(batch>25)return 'sorry no json';
   const n=prompt.match(/Ена нашла предмет номер (\d+)/)?.[1];return JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Найден предмет',detail:'Предмет '+n+' в сумке',message_ids:['m0'],quote:'Ена нашла предмет номер '+n,confidence:'high'}]});
 });
 h.click('scan-all');
 await until(()=>h.b.state().fullScan.status==='complete');
 assert.equal(h.b.state().fullScan.cursor,60);
 assert.equal(h.b.state().fullScan.chunkSize,25);
 assert.equal(h.b.state().fullScan.blocks,3);
 console.log('Adaptive JSON recovery 50→25 + cursor no skip: PASS');
}
