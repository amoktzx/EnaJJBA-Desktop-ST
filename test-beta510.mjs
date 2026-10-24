import assert from 'node:assert/strict';
import {parseExtraction,messageKey} from './betaCore.js';
import {parseLorebookProfiles,appearanceFromLore,firstEncounter} from './lorebookProfiles.js';
import {physicalAttribute,compactExisting,lifetime} from './registryLogic.js';
import {createBeta} from './beta.js';
import {exportFullSnapshot,validateFullSnapshot} from './factLedger.js';
assert.equal(parseExtraction(JSON.stringify({messages:[{id:'m0',changes:[{scope:'gm:wardrobe',title:'Наряд'}]},{id:'m1',changes:[]}]}))[0].message_ids[0],'m0');
assert.deepEqual(parseExtraction('{"changes":[]}'),[]);
assert.throws(()=>parseExtraction('{"messages":[{"id":"bad","changes":[]}]}'));
assert.equal(physicalAttribute('цвет глаз'),true);
assert.equal(physicalAttribute('характерная примета'),true);
assert.equal(physicalAttribute('модель пистолета'),false);
assert.equal(lifetime('gm:wardrobe','комплект одежды'),'temporary');
assert.equal(lifetime('gm:body','ожог кисти'),'state');
const worldinfo={entries:{'7':{uid:7,comment:'07 — Ена Марелова: внешность и доступный профиль',content:'Описание.\n\nВНЕШНОСТЬ: рост 180 см, серые глаза.\nПРИМЕТЫ: звёзды на запястьях.\nОДЕЖДА: чёрная рубашка.\n\nПРОШЛОЕ: что-то.'},'11':{uid:11,comment:'11 — Леоне Аббаккио и Moody Blues',content:'Леоне Аббаккио, 188 см. Аметриновые глаза и длинные волосы.\n\nХАРАКТЕР: суровый.'},'37':{uid:37,comment:'37 — Квартира Ены и переезд',content:'Квартира с окнами и дверями, рост потолка 280 см.'}}};
const lore=parseLorebookProfiles(worldinfo);assert.deepEqual(lore.map(x=>x.name),['Ена Марелова','Леоне Аббаккио']);
assert.match(lore[0].appearance,/серые глаза/);assert.doesNotMatch(lore[0].appearance,/чёрная рубашка/);assert.equal(firstEncounter(lore,[{text:'Ена подняла руку.'}]).length,1);
assert.equal(firstEncounter(lore,[{text:'Неустановленная женщина подняла руку.'}]).length,0);
assert.equal(firstEncounter(lore,[{text:'Ена подняла руку.'}],['Ена Марелова']).length,0);
const chat=[{mes:'Ена надела фиолетовую накидку и положила пистолет в ящик. Леоне показал револьвер.',is_user:true,is_system:true,name:'Ена',send_date:'2001-04-22'},
            {mes:'Леоне предпочитает пасту. В ту ночь они долго разговаривали.',is_user:false,is_system:true,name:'Рассказчик',send_date:'2001-04-23'}];
const meta={archive:{films:[],music:[],books:[],anomalies:[]},salon:{},directory:{},gm:{},notes:'',beta:{schema:2,records:[],proposals:[],history:[],fullScan:{cursor:0,total:2,status:'idle',added:0,blocks:0},migrated:true,linksMigrated:true,lorebookProfiles:lore,lorebookSeen:[]}};
let systemPrompt='';const ctx={chat,chatId:'beta510',characterId:1,generateRaw:async({systemPrompt:p})=>{
  systemPrompt=p;return JSON.stringify({messages:[{id:'m0',changes:[
    {scope:'gm:profiles',factType:'objective',subject:'Ена Марелова',attribute:'цвет глаз',title:'Цвет глаз Ены',detail:'Серые',quote:'Ена',longevity:'permanent'},
    {scope:'gm:wardrobe',factType:'objective',subject:'Ена Марелова',attribute:'комплект одежды',title:'Накидка',detail:'Ена надела фиолетовую накидку.',quote:'Ена надела фиолетовую накидку'},
    {scope:'gm:inventory',factType:'objective',title:'Револьвер Леоне',detail:'Леоне показал револьвер.',quote:'Леоне показал револьвер',longevity:'state'},
    {scope:'gm:inventory',factType:'objective',title:'Пустяк',detail:'Разовое без последствия',quote:'положила пистолет',longevity:'oneoff'}]}]});}};
const ui={windows:new Map(),tab:{gm:'sync'}};
const settings={enaSync:{profileId:'active',detailLevel:'focused',extractionPhase:'catalog',automatic:false}};
let logs=[];const beta=createBeta({meta:()=>meta,ctx:()=>ctx,settings:()=>settings,persistSettings:()=>{},saveMeta:()=>{},toast:x=>logs.push(x),fillWindow:()=>{},ui,oldComputer:()=>'<div></div>',oldNotes:()=>'<div></div>'});
const h=beta.view('gm');assert.match(h,/Все прежние разделы/);assert.match(h,/Загрузить World Info JSON/);
beta.action('scan-diagnose-early',{dataset:{},closest:()=>({})});
let until=Date.now()+4000;while(!meta.beta.scanDiagnostics.preview&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
assert.equal(meta.beta.scanDiagnostics.extracted,4); // only model output
assert.equal(meta.beta.scanDiagnostics.fromLore,2);
assert.equal(meta.beta.scanDiagnostics.acceptable,4); // wardrobe, revolver, two lore profiles
assert.equal(meta.beta.proposals.length,0);
assert.equal(meta.beta.lorebookSeen.length,0);
assert.equal(meta.beta.scanDiagnostics.discarded['внешность берётся один раз из World Info, не из сцен'],1);
assert.equal(meta.beta.scanDiagnostics.discarded['разовый эпизод без устойчивого свойства или состояния'],1);
assert.match(systemPrompt,/ЭТАП 1/);assert.match(systemPrompt,/ЭТАП 2/);assert.match(systemPrompt,/Никакой системы прозвищ/);
// Non-dry scan persists exactly one lore proposal, one garment and a real piece of equipment.
beta.action('scan-last',{dataset:{},closest:()=>({})});
until=Date.now()+4000;while(meta.beta.proposals.length<4&&Date.now()<until)await new Promise(r=>setTimeout(r,10));
assert.equal(meta.beta.proposals.length,4);
assert.equal(meta.beta.lorebookSeen.length,2);
assert.equal(meta.beta.proposals.filter(p=>p.sourceType==='lorebook').length,2);
assert.equal(meta.beta.proposals.filter(p=>p.scope==='gm:wardrobe').length,1);
const backup=exportFullSnapshot(meta,chat.map(messageKey));assert.equal(validateFullSnapshot(backup).data.beta.lorebookProfiles.length,2);
assert.equal(validateFullSnapshot(backup).data.beta.lorebookSeen.length,2);
console.log('Beta 5.10: staged messages, no physical appearance from chat, direct lorebook provenance once, wardrobe and durable inventory, no one-offs, backup and compact tabs: PASS');
