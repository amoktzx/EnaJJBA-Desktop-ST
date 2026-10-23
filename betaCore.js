// Pure functions used by the beta and its local regression tests.
export function digest(value) {
  const s=String(value??''); let h=2166136261;
  for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;}
  return h.toString(36);
}
export function messageKey(message){
  if(!message || message.is_system) return '';
  return digest([message.send_date??'',message.is_user?'user':'assistant',String(message.mes??''),message.swipe_id??''].join('\u241f'));
}
export function validateEvidence(sources,chat){
  if(!Array.isArray(sources)||!sources.length)return true; // manually entered, no provenance
  const keys=new Set((chat||[]).map(messageKey).filter(Boolean));
  return sources.every(s=>s?.key&&keys.has(s.key));
}
export function applyProjection(records,chat){
  return (records||[]).filter(r=>r && !r.deleted && r.status!=='rejected' && (r.status!=='proposal') && validateEvidence(r.sources||[],chat));
}
export function safeMoney(raw){const n=Number(String(raw??'').replace(',','.'));return Number.isFinite(n)?Math.round(n*100)/100:0;}
export function parseExtraction(output){
  const content=String(output||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```\s*$/,'');
  const begin=content.indexOf('{'),end=content.lastIndexOf('}');
  if(begin<0||end<=begin)throw Error('Модель не вернула JSON');
  const value=JSON.parse(content.slice(begin,end+1));
  if(!value||!Array.isArray(value.changes))throw Error('В JSON нет массива changes');
  return value.changes.slice(0,50);
}
