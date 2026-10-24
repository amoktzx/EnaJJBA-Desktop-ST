/* Stable, source-anchored proposal identities and editable full backups. No network or UI. */
import {digest} from './betaCore.js';
const statuses = new Set(['pending','approved','rejected','deleted','split']);
const identityText = value => String(value??'').normalize('NFKC').toLowerCase().replace(/[«»“”"'`]/g,'').replace(/[\s\u00a0]+/g,' ').trim().slice(0,700);
const sourceKeys = proposal => [...new Set((proposal?.sources||[]).map(x=>String(x?.key||'')).filter(Boolean))].sort();
// Anchor is a verbatim excerpt checked against the cited chat message by the extractor.
// It survives changes to the AI-written title and detail. One anchor can support multiple
// facts in different scopes; editing the title cannot reactivate a rejected suggestion.
export function identityKeys(proposal) {
  const keys=sourceKeys(proposal);
  if(!keys.length)return [];
  const scope=String(proposal.scope||'');
  const kind=String(proposal.factType||'objective');
  const anchor=identityText(proposal.quote);
  // Older imported suggestions may lack a quote, so the normalized title is a fallback.
  // In a character dossier one narration sentence can confirm several properties:
  // e.g. hair AND eye color. Quote-only dedupe would silently discard one.
  const property=['gm:profiles','gm:wardrobe'].includes(scope)
    ?'|subject:'+identityText(proposal.subject)+'|attribute:'+identityText(proposal.attribute):'';
  const discriminator=(anchor?'quote:'+anchor:'legacy-title:'+identityText(proposal.title))+property;
  return keys.map(key=>digest(['fact-v2',key,scope,kind,discriminator].join('\u241f')));
}
export function sameProposedFact(a,b) {
  // A single source/quote may support distinct properties of the same person.
  // Distinguish them before testing nested/identical quote anchors.
  if(a?.scope===b?.scope&&['gm:profiles','gm:wardrobe'].includes(a?.scope)){
    const aProperty=identityText(a?.subject)+'|'+identityText(a?.attribute);
    const bProperty=identityText(b?.subject)+'|'+identityText(b?.attribute);
    if(aProperty!=='|'&&bProperty!=='|'&&aProperty!==bProperty)return false;
  }
  const aKeys=identityKeys(a),bKeys=new Set(identityKeys(b));
  if(aKeys.some(k=>bKeys.has(k)))return true;
  // An extractor may choose a slightly longer excerpt on the next run. Only
  // treat nested literal quotes as the same anchor when scope, kind and at
  // least one exact message source coincide.
  const aq=identityText(a?.quote),bq=identityText(b?.quote);
  const sharedSource=sourceKeys(a).some(k=>sourceKeys(b).includes(k));
  if(sharedSource&&a.scope===b.scope&&(a.factType||'objective')===(b.factType||'objective')&&
     aq.length>=12&&bq.length>=12&&(aq.includes(bq)||bq.includes(aq)))return true;
  // Preserve the v1 exact-signature check for older entries / missing excerpts.
  return Boolean(a?.signature && b?.signature && a.signature===b.signature);
}
export function canPropose(candidate, proposals) {
  return !(proposals||[]).some(p=>p && p.status!=='deleted' && sameProposedFact(candidate,p));
}
export const BACKUP_FORMAT='ena-desktop-full-v2';
const OWNED_FIELDS=['archive','salon','directory','gm','notes','gameDate','gameTime','beta','apps','layout'];
export function countsFor(beta){
  const proposals=beta?.proposals||[];
  return Object.fromEntries(['pending','approved','rejected','deleted','split'].map(s=>[s,proposals.filter(p=>p.status===s).length]));
}
export function exportFullSnapshot(meta, chatKeys=[]) {
  const data={};
  for(const k of OWNED_FIELDS)if(meta[k]!==undefined)data[k]=structuredClone(meta[k]);
  return {format:BACKUP_FORMAT,schemaVersion:2,exportedAt:new Date().toISOString(),
    chatFingerprint:digest(chatKeys.join('|')),
    statusCounts:countsFor(data.beta),
    guide:'Для правок в ChatGPT: редактируйте data.beta.proposals (pending/approved/rejected/deleted/split), data.beta.records и data.archive; не меняйте id и sources.key без необходимости. Импорт ЗАМЕНЯЕТ текущую базу.',
    data};
}
export function validateFullSnapshot(json){
  if(!json||typeof json!=='object')throw Error('Ожидался объект JSON');
  const data=json.format===BACKUP_FORMAT?json.data:json.chatData;
  if(!data||typeof data!=='object'||!data.beta||!data.archive)throw Error('Это не полный экспорт Ena Desktop');
  if(!Array.isArray(data.beta.records)||!Array.isArray(data.beta.proposals)||!Array.isArray(data.beta.history))throw Error('Не хватает records, proposals или history');
  if(data.beta.records.length>20000||data.beta.proposals.length>20000||data.beta.history.length>50000)throw Error('Превышен лимит записей');
  for(const k of ['films','music','books','anomalies'])if(!Array.isArray(data.archive[k]))throw Error('Отсутствует раздел архива: '+k);
  const seen=new Set();
  for(const [kind,arr] of [['record',data.beta.records],['proposal',data.beta.proposals]]) {
    for(const r of arr){
      if(!r||typeof r!=='object'||typeof r.id!=='string'||!r.id.trim())throw Error('У записи отсутствует id');
      if(seen.has(r.id))throw Error('Повторяется id: '+r.id);
      seen.add(r.id);
      if(typeof r.title!=='string'||typeof r.detail!=='string')throw Error('У '+r.id+' неверные поля title/detail');
      if(r.title.length>600||r.detail.length>12000)throw Error('Слишком длинное поле записи '+r.id);
      if(!Array.isArray(r.sources))throw Error('У '+r.id+' неверное поле sources');
      if(r.sources.length>10||r.sources.some(s=>!s||typeof s.key!=='string'||typeof s.index!=='number'))throw Error('Некорректные источники '+r.id);
      if(kind==='proposal'&&!statuses.has(r.status))throw Error('Неизвестный статус '+r.status+' у '+r.id);
    }
  }
  for(const k of OWNED_FIELDS)if(data[k]!==undefined&&typeof data[k]==='function')throw Error('Некорректный раздел '+k);
  return {data,oldFormat:json.format!==BACKUP_FORMAT,chatFingerprint:json.chatFingerprint};
}
