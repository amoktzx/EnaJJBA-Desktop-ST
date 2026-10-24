/* Canonical game-state projection. Pure; histories are sourced from approved proposals.
 * Facts stay immutable. Deleting/rolling back a source recomputes the latest status. */
export const STATE_SCOPES=new Set(['gm:inventory','gm:body','gm:quests','gm:sidequests','gm:knowledge','gm:risks','salon:tasks','salon:stock']);
// Archive anomalies keep their existing found/unseen/viewed workflow in the archive UI.
export const ENTITY_ACTIONS=['create','update','resolve','transfer','lose','restore'];
export const STATE_LABELS={
  active:'Активно', planned:'Запланировано', in_progress:'В процессе', completed:'Завершено',
  held:'В наличии', transferred:'Передано', lost:'Потеряно', healed:'Вылечено', resolved:'Закрыто',
  suspected:'Подозрение', known:'Известно', found:'Найдено', unseen:'Не просмотрено', viewed:'Просмотрено'
};
const normalize=v=>String(v??'').normalize('NFKC').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[«»“”"']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().slice(0,130);
export const isStateScope=scope=>STATE_SCOPES.has(scope);
export function canonicalEntityKey(scope,name){
  const part=normalize(name);
  return part ? String(scope)+':'+part : '';
}
export function entityKeyOf(p){
  if(!isStateScope(p?.scope))return '';
  // Explicit IDs take precedence over human-readable labels.
  const raw=String(p.entityKey||'').trim();
  if(!raw)return ''; // Legacy v5.5 proposals remain ordinary records until explicitly linked.
  const prefix=String(p.scope)+':';
  return canonicalEntityKey(p.scope,raw.startsWith(prefix)?raw.slice(prefix.length):raw);
}
function sourceIndex(p){const a=(p.sources||[]).map(s=>Number(s.index)).filter(Number.isFinite);return a.length?Math.max(...a):Number.MAX_SAFE_INTEGER;}
export function inferState(p){
  if(p.entityStatus && STATE_LABELS[p.entityStatus])return p.entityStatus;
  const action=String(p.action||'');
  const map={lose:'lost',transfer:'transferred',restore:'held',resolve:p.scope==='gm:body'?'healed':'completed'};
  if(map[action])return map[action];
  const progress=String(p.progress||p.statusValue||'');
  if(STATE_LABELS[progress])return progress;
  if(progress==='done')return 'completed';
  if(p.scope==='gm:body')return 'active';
  if(p.scope==='gm:inventory')return 'held';
  if(p.factType==='npc_suspicion')return 'suspected';
  if(p.factType==='npc_knowledge')return 'known';
  return 'active';
}
export function projectStates(proposals,valid=()=>true){
  const index=new Map();
  // Build from approved and still-sourced proposals only. Sort by in-story source
  // position, not approval order (the user may approve old events out of order).
  const changes=(proposals||[]).filter(p=>p?.status==='approved'&&isStateScope(p.scope)&&entityKeyOf(p)&&valid(p))
    .sort((a,b)=>sourceIndex(a)-sourceIndex(b)||String(a.created||'').localeCompare(String(b.created||'')));
  for(const p of changes){
    const id=entityKeyOf(p),stage=inferState(p);
    const item=index.get(id)||{id,scope:p.scope,label:p.entityLabel||p.title,owner:p.entityOwner||'',state:'',detail:'',sources:[],history:[]};
    if(!item.owner&&p.entityOwner)item.owner=p.entityOwner;
    // Newer source positions can update the human-facing description/title.
    item.label=p.entityLabel||item.label;
    item.state=stage;item.detail=p.detail;item.sources=p.sources||[];
    item.history.push({proposalId:p.id,status:stage,action:p.action||'update',title:p.title,detail:p.detail,sources:p.sources||[],at:sourceIndex(p),date:p.date||''});
    index.set(id,item);
  }
  return [...index.values()].sort((a,b)=>a.label.localeCompare(b.label,'ru'));
}
export function existingEntityOptions(proposals,valid=()=>true){
  return projectStates(proposals,valid).map(e=>({id:e.id,scope:e.scope,label:e.label,state:e.state}));
}
