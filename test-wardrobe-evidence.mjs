import assert from 'node:assert/strict';
import {matchSourceQuote} from './quoteEvidence.js';
import {createBeta,OBJECTIVE_SCOPE_KEYS} from './beta.js';
import {messageKey} from './betaCore.js';
import {exportFullSnapshot,validateFullSnapshot,canPropose} from './factLedger.js';
assert.ok(OBJECTIVE_SCOPE_KEYS.includes('gm:wardrobe'));
const eye={scope:'gm:profiles',subject:'Леоне',attribute:'цвет глаз',factType:'objective',quote:'серо-зелёные глаза и тёмные волосы',sources:[{key:'same'}],status:'pending'};
const hair={...eye,attribute:'цвет волос',title:'Волосы Леоне'};
assert.equal(canPropose(hair,[eye]),true,'different dossier properties sharing one source and quote must coexist');
assert.equal(canPropose({...eye,title:'Глаза Леоне'},[eye]),false,'same property and evidence should deduplicate');
const text='Незнакомка была в фиолетовой бархатной накидке, длинной и тяжёлой. Под ней темнели чёрный топ и свободные брюки; плащ был наброшен поверх плеч.';
assert.deepEqual(matchSourceQuote(text,'фиолетовой бархатной накидке... Под ней темнели чёрный топ и свободные брюки'),{valid:true,mode:'fragments'});
assert.equal(matchSourceQuote(text,'ФИОЛЕТОВОЙ, бархатной накидке').valid,true);
assert.equal(matchSourceQuote(text,'фиолетовой бархатной накидке... под ней темнели красный топ и свободные брюки').valid,false);
assert.equal(matchSourceQuote(text,'фиолетовой бархатной накидке... брюки и топ').valid,false);
assert.equal(matchSourceQuote(text,'Ена').valid,false);
const chat=[{mes:text,name:'Рассказчик',is_user:false,is_system:true,send_date:'2001-05-01T00:00:00'},
  {mes:'Леоне Аббаккио, высокий мужчина, имел серо-зелёные глаза и тёмные волосы.',name:'Ена',is_user:true,is_system:true,send_date:'2001-05-01T00:00:01'}];
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},gm:{},notes:'',beta:{schema:2,records:[],proposals:[],history:[],syncCursor:0,migrated:true,linksMigrated:true,fullScan:{cursor:0,total:2,status:'idle',blocks:0,added:0}}};
let prompt='';const settings={enaSync:{profileId:'active',detailLevel:'focused',extractionPhase:'catalog',automatic:false}};
const responses={changes:[
 {scope:'gm:wardrobe',factType:'objective',subject:'Неустановленная женщина',attribute:'комплект: накидка, топ, брюки',title:'Комплект с фиолетовой бархатной накидкой',detail:'Женщина была в фиолетовой бархатной накидке, чёрном топе и свободных брюках. Владелец не установлен.',message_ids:['m0'],quote:'фиолетовой бархатной накидке... Под ней темнели чёрный топ и свободные брюки'},
 {scope:'gm:profiles',factType:'objective',subject:'Леоне Аббаккио',attribute:'цвет глаз',title:'Леоне: цвет глаз',detail:'Серо-зелёные глаза.',message_ids:['m1'],quote:'серо-зелёные глаза'},
 {scope:'gm:wardrobe',factType:'objective',subject:'Ена',attribute:'комплект',title:'Выдуманный комплект',detail:'Не существовал',message_ids:['m0'],quote:'красная куртка... чёрные сапоги'}
]};
const ctx={chat,chatId:'wardrobe_test',characterId:1,generateRaw:async ({systemPrompt})=>{prompt=systemPrompt;return JSON.stringify(responses)}};
const beta=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui:{windows:new Map(),tab:{gm:'sync'}},oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
beta.action('scan-diagnose-early',{dataset:{},closest:()=>({})});
const deadline=Date.now()+4000;while(!meta.beta.scanDiagnostics.preview&&Date.now()<deadline)await new Promise(r=>setTimeout(r,15));
assert.equal(meta.beta.scanDiagnostics.extracted,3);
assert.equal(meta.beta.scanDiagnostics.acceptable,2);
assert.equal(meta.beta.scanDiagnostics.discarded['цитата не подтверждена (включая сокращённые фрагменты)'],1);
assert.equal(meta.beta.scanDiagnostics.preview[0].evidenceMode,'fragments');
assert.match(prompt,/Авторское описание рассказчика/);
assert.match(prompt,/НЕ устанавливай лимит|Не устанавливай лимит/);
assert.match(prompt,/gm:wardrobe/);
assert.equal(meta.beta.proposals.length,0);
assert.equal(meta.beta.fullScan.cursor,0);
assert.match(beta.view('gm'),/сокращённая цитата/);
const zipData=exportFullSnapshot(meta,chat.map(messageKey));
assert.equal(validateFullSnapshot(zipData).data.beta.proposals.length,0);
// Foldered dossier and wardrobe cards survive old records and remain editable.
meta.beta.records.push({id:'manual_outfit',scope:'gm:wardrobe',subject:'Ена',attribute:'комплект одежды',title:'Бархатная накидка, топ и брюки',detail:'Комплект в начале истории',manual:true,created:'2001-05-01',sources:[]});
meta.beta.records.push({id:'manual_profile',scope:'gm:profiles',subject:'Леоне Аббаккио',attribute:'цвет глаз',title:'Леоне: глаза',detail:'Серо-зелёные',manual:true,created:'2001-05-01',sources:[]});
const uiState={windows:new Map(),tab:{gm:'wardrobe'}};
const viewer=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui:uiState,oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const wardrobeHTML=viewer.view('gm');
assert.match(wardrobeHTML,/Гардероб/);assert.match(wardrobeHTML,/Ена/);assert.match(wardrobeHTML,/Бархатная накидка, топ и брюки/);assert.match(wardrobeHTML,/data-beta="edit"/);
uiState.tab.gm='profiles';assert.match(viewer.view('gm'),/Леоне Аббаккио/);
console.log('Beta 5.8: fragment matching, no cross-source hallucinations, first-pass prompt, wardrobe dossier, old-backup compatibility: PASS');
