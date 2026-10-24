import assert from 'node:assert/strict';
import {createBeta} from './beta.js';
const chat=Array.from({length:10},(_,i)=>({is_user:true,is_system:true,name:'Ена',mes:i===0?'Ена получила диск с меткой 1.':`Ена оглянулась. ${i}`,send_date:`2026-10-24T00:00:${String(i).padStart(2,'0')}Z`}));
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},gm:{},directory:{},notes:'',beta:{schema:2,migrated:true,linksMigrated:true,records:[],proposals:[],history:[],syncCursor:0,fullScan:{cursor:0,total:10,status:'idle',added:0,blocks:0}}};
const settings={enaSync:{automatic:false,profileId:'active',detailLevel:'focused'}};
const ctx={chat,chatId:'test_quality_preview',characterId:1,generateRaw:async()=>JSON.stringify({changes:[
 {scope:'gm:inventory',factType:'objective',title:'Диск №1',detail:'Ена получила диск.',message_ids:['m0'],quote:'Ена получила диск',confidence:'high'},
 {scope:'gm:invented',factType:'objective',title:'Плохая категория',detail:'Некорректный раздел',message_ids:['m0'],quote:'Ена получила диск'},
 {scope:'gm:body',factType:'objective',title:'Выдуманная улыбка',detail:'Не подтверждена',message_ids:['m1'],quote:'несуществующее'}]})};
const beta=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
beta.action('scan-diagnose-early',{dataset:{},closest:()=>({})});
const start=Date.now();while(!meta.beta.scanDiagnostics.preview&&Date.now()-start<5000)await new Promise(r=>setTimeout(r,20));
assert.equal(meta.beta.scanDiagnostics.extracted,3);
assert.equal(meta.beta.scanDiagnostics.acceptable,1);
assert.deepEqual(meta.beta.scanDiagnostics.preview.map(v=>v.accepted),[true,false,false]);
const ui=beta.view('gm');
assert.match(ui,/Что именно предложила модель/);
assert.match(ui,/Диск №1/);
assert.match(ui,/Плохая категория/);
assert.match(ui,/цитата не подтверждена/);
assert.equal(meta.beta.proposals.length,0);
assert.equal(meta.beta.fullScan.cursor,0);
console.log('Quality preview: accepted/rejected cards and no mutation PASSED');
