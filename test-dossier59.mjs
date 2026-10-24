import assert from 'node:assert/strict';
import {createBeta} from './beta.js';
import {groupDossiers,referenceScope,referenceAction,dossierAttribute} from './dossierIndex.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
assert.equal(referenceScope('gm:profiles','Комплект: фиолетовая накидка, брюки'),'gm:wardrobe');
assert.equal(referenceScope('gm:profiles','цвет глаз'),'gm:profiles');
assert.equal(dossierAttribute('цвет глаз'),'Глаза');
const s=[
{id:'eye1',scope:'gm:profiles',subject:'Ена',attribute:'цвет глаз',title:'Цвет глаз',detail:'Серые',created:'2001-01-01',manual:true,sources:[]},
{id:'eye2',scope:'gm:profiles',subject:'Ена',attribute:'глаза',title:'Глаза',detail:'Серые с бирюзовым оттенком',created:'2001-01-02',manual:true,sources:[]},
{id:'old_outfit',scope:'gm:wardrobe',subject:'Ена',attribute:'комплект: накидка, топ, брюки',title:'Бархатный комплект',detail:'Фиолетовая накидка, чёрный топ, брюки',created:'2001-01-02',manual:true,sources:[]},
{id:'outfit_in_wrong_scope',scope:'gm:profiles',subject:'Ена',attribute:'комплект: накидка, топ, брюки',title:'Бархатный комплект в досье',detail:'Фиолетовая накидка, чёрный топ, брюки',created:'2001-01-03',manual:true,sources:[]},
{id:'cat',scope:'gm:profiles',subject:'Рыжий кот',attribute:'надорванное ухо',title:'Надорванное ухо',detail:'Правое ухо с надрывом',created:'2001-01-02',manual:true,sources:[]}
];
let grouped=groupDossiers(s);
assert.equal(grouped.length,2);
assert.equal(grouped.find(x=>x.name==='Ена').fields.size,1);
assert.equal(grouped.find(x=>x.name==='Ена').wardrobe.length,2);
assert.equal(grouped.find(x=>x.name==='Ена').wardrobeGroups.length,1);
assert.equal(grouped.find(x=>x.name==='Ена').fields.get('глаза').history.length,2);
assert.equal(referenceAction({scope:'gm:profiles',subject:'Ена',attribute:'глаза',detail:'Серые'},s,[]).type,'repeat');
assert.equal(referenceAction({scope:'gm:profiles',subject:'Ена',attribute:'цвет глаз',detail:'Серо-голубые'},s,[]).type,'update');
assert.equal(referenceAction({scope:'gm:wardrobe',subject:'Ена',attribute:'комплект',detail:'Фиолетовая накидка, чёрный топ, брюки'},s,[]).type,'repeat');
const chat=[{mes:'Ена теперь имела серо-голубые глаза. На ней были голубая блузка и чёрные брюки.',is_user:false,name:'Рассказчик',is_system:true,send_date:'2001-05-01'}];
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},gm:{},notes:'',beta:{schema:2,records:structuredClone(s),proposals:[],history:[],fullScan:{cursor:0,total:1,status:'idle',blocks:0,added:0},migrated:true,linksMigrated:true}};
const settings={enaSync:{profileId:'active',detailLevel:'focused',extractionPhase:'catalog',automatic:false}};
let prompt='';
const ctx={chat,chatId:'test59',characterId:1,generateRaw:async ({systemPrompt})=>{prompt=systemPrompt;return JSON.stringify({changes:[
{scope:'gm:profiles',factType:'objective',subject:'Ена',attribute:'цвет глаз',title:'Серо-голубые',detail:'Серо-голубые',message_ids:['m0'],quote:'серо-голубые глаза'},
{scope:'gm:profiles',factType:'objective',subject:'Ена',attribute:'комплект: блузка и брюки',title:'Голубая блузка',detail:'Голубая блузка и чёрные брюки',message_ids:['m0'],quote:'голубая блузка и чёрные брюки'}]})}};
const ui={windows:new Map(),tab:{gm:'profiles'}};
const beta=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:()=>{},fillWindow:()=>{},ui,oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const html=beta.view('gm');
assert.match(html,/Досье персонажей/);
assert.doesNotMatch(html,/data-tab="wardrobe"/);
assert.match(html,/>Гардероб<\/b> · 1 комплектов \/ вещей/);
assert.match(html,/Предыдущие сведения \(1\)/);
assert.match(html,/Рыжий кот/);
assert.match(html,/data-beta="new-wardrobe"/);
assert.match(html,/Голубая блузка|Бархатный комплект/);
ui.tab.gm='wardrobe';
assert.match(beta.view('gm'),/Досье персонажей/);
assert.equal(ui.tab.gm,'profiles');
beta.action('scan-diagnose-early',{dataset:{},closest:()=>({})});
let max=Date.now()+3000;while(!meta.beta.scanDiagnostics.preview && Date.now()<max)await new Promise(r=>setTimeout(r,10));
assert.equal(meta.beta.scanDiagnostics.acceptable,2);
assert.equal(meta.beta.scanDiagnostics.preview[0].operation,'update');
assert.equal(meta.beta.scanDiagnostics.preview[1].scope,'gm:wardrobe');
assert.match(prompt,/СТРОК/);
assert.equal(meta.beta.proposals.length,0);
const backup=exportFullSnapshot(meta,[]);
assert.deepEqual(validateFullSnapshot(backup).data.beta.records.map(x=>x.id),s.map(x=>x.id));
assert.equal(backup.data.beta.records.find(x=>x.id==='old_outfit').scope,'gm:wardrobe');
console.log('Beta 5.9: dossier + wardrobe rows, immutable legacy data, history, suggestions, objective diagnostics: PASS');
