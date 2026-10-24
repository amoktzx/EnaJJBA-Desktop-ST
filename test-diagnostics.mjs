import assert from 'node:assert/strict';
import {createBeta} from './beta.js';

function build({count=60,respond,fullScanState}={}){
  const chat=Array.from({length:count},(_,i)=>({is_user:true,mes:`Ена забрала ключ номер ${i}, и положила его в сумку.`,send_date:`2001-04-26T${i}`,swipe_id:0}));
  const persistent={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},gm:{},directory:{},notes:'',beta:{schema:2,records:[],proposals:[],history:[],syncCursor:0,syncRuns:0,migrated:true,linksMigrated:true,fullScan:fullScanState||{cursor:25,total:count,status:'paused',added:0,blocks:1}}};
  const settings={enaSync:{automatic:false,interval:50,profileId:'active'}};
  let requests=0, saves=0;
  const context={chat,chatId:'naples_test',chatMetadata:{},characterId:1,generateRaw:async o=>{requests++;return respond?.(o)||'{"changes":[]}'}};
  const beta=createBeta({meta:()=>persistent,ctx:()=>context,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{saves++},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'',oldNotes:()=>''});
  globalThis.confirm=()=>true;
  const click=type=>beta.action(type,{closest:()=>({}),dataset:{}});
  return {beta,persistent,click,metrics:()=>({requests,saves})};
}
async function until(f,ms=12000){const t=Date.now();while(!f()){if(Date.now()-t>ms)throw Error('timed out');await new Promise(r=>setTimeout(r,30));}}
function sample({prompt}){
  const n=prompt.match(/Ена забрала ключ номер (\d+)/)?.[1]||'0';
  return JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Ключ '+n+' забран',detail:'Ена положила ключ в сумку',message_ids:['m0'],quote:`Ена забрала ключ номер ${n}`,confidence:'high'}]});
}
{
  const h=build({respond:sample});const cursor=h.beta.state().fullScan.cursor;
  h.click('scan-diagnose-early');
  await until(()=>h.beta.state().scanDiagnostics.status==='ok');
  assert.equal(h.beta.state().scanDiagnostics.extracted,1);
  assert.equal(h.beta.state().scanDiagnostics.acceptable,1);
  assert.equal(h.beta.state().scanDiagnostics.added,0);
  assert.equal(h.beta.state().fullScan.cursor,cursor);
  assert.equal(h.beta.state().proposals.length,0);
  assert.equal(h.beta.state().syncRuns,0);
  assert.match(h.beta.view('gm'),/модель предложила: 1/);
  console.log('Diagnostic dry run keeps facts and cursor unchanged: PASS');
}
{
  const h=build({respond:()=>JSON.stringify({changes:[{scope:'gm:inventory',factType:'objective',title:'Ключ',detail:'У Ены',message_ids:['m0'],quote:'несуществующая цитата',confidence:'high'}]})});
  h.click('scan-diagnose-early');
  await until(()=>h.beta.state().scanDiagnostics.status==='filtered');
  assert.equal(h.beta.state().scanDiagnostics.discarded['цитата не подтверждена (включая сокращённые фрагменты)'],1);
  assert.equal(h.beta.state().proposals.length,0);
  console.log('Unmatched literal citations are explained: PASS');
}
{
 const h=build({count:100,respond:()=>'{"changes":[]}',fullScanState:{cursor:0,total:0,status:'idle',added:0,blocks:0}});
 h.click('scan-all');
 await until(()=>h.beta.state().fullScan.status==='complete');
 assert.equal(h.beta.state().fullScan.cursor,100);
 assert.equal(h.beta.state().fullScan.lastError,'');
 assert.equal(h.beta.state().proposals.length,0);
 console.log('Consecutive empty blocks are valid in an objective diary: PASS');
}
{
 const h=build({respond:()=>{throw new Error('API request failed → Bad Request')}});
 h.click('scan-diagnose-current');
 await until(()=>h.beta.state().scanDiagnostics.status==='failed');
 assert.match(h.beta.state().scanDiagnostics.error,/Bad Request/);
 assert.equal(h.beta.state().fullScan.cursor,25);
 console.log('HTTP 400 diagnostic has error without cursor advance: PASS');
}
