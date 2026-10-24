// Pure filtering helpers. Apply conservatively; never silently rewrite roleplay canon.
const norm=value=>String(value??'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
export const PHYSICAL_ATTRIBUTE_RE=/(?:^|\b)(?:рост|высота|внешность|цвет (?:волос|глаз|кожи)|глаза|волосы|кожа|телосложение|лицо|цвет кожи|приметы|примета|характерная примета|украшения|особые отметины|цвет и стиль|шрам(?:ы)?|татуировки|нос|губы|вес|фигура)(?:$|\b)/iu;
export function physicalAttribute(attribute){return PHYSICAL_ATTRIBUTE_RE.test(norm(attribute));}
export function lifetime(scope,attribute,proposed){
  if(['permanent','temporary','state','oneoff'].includes(proposed))return proposed;
  if(['gm:wardrobe'].includes(scope))return 'temporary';
  if(['gm:inventory','gm:body','gm:bank','gm:quests','gm:sidequests','salon:stock','salon:tasks'].includes(scope))return 'state';
  return 'permanent';
}
export function normalizeAttribute(attribute){
  const a=norm(attribute);
  if(/^((цвет|оттенок) )?глаз/.test(a))return 'глаза';
  if(/^((цвет|длина|стиль|оттенок) )?волос/.test(a))return 'волосы';
  if(/^((цвет|тон|оттенок) )?кож/.test(a))return 'кожа';
  if(a==='высота')return 'рост';
  return a;
}
export function classifyOperation(change,existing=[]){
  const scope=change.scope;
  const subject=norm(change.subject);
  const attribute=normalizeAttribute(change.attribute);
  const comparable=existing.filter(x=>x && !x.deleted && x.scope===scope && norm(x.subject)===subject && normalizeAttribute(x.attribute)===attribute && (x.status===undefined||!['rejected','deleted','split'].includes(x.status)));
  if(comparable.some(x=>norm(x.detail)===norm(change.detail)))return {type:'repeat'};
  if(comparable.length && scope==='gm:profiles')return {type:'update',previousId:comparable[comparable.length-1].id};
  return {type:'create'};
}
export function compactExisting(records=[],proposals=[],text='',limit=65){
  const allowed=new Set(['gm:profiles','gm:wardrobe','gm:inventory','gm:body','gm:bank','gm:quests','gm:sidequests','salon:stock','salon:finance','salon:tasks','salon:documents','directory:people','directory:places','archive:books','archive:films','archive:music','archive:anomalies']);
  const active=[...records.filter(r=>!r.deleted),...proposals.filter(p=>p.status==='pending')]
    .filter(x=>allowed.has(x.scope));
  const ctx=norm(text);
  const scored=active.map(x=>{
    const words=norm([x.subject,x.title,x.entityLabel,x.attribute].filter(Boolean).join(' ')).split(' ').filter(w=>w.length>=4);
    return {x,score:words.filter(w=>ctx.includes(w)).length};
  }).sort((a,b)=>b.score-a.score);
  return scored.slice(0,limit).map(({x})=>({id:x.id,scope:x.scope,subject:x.subject||'',attribute:x.attribute||'',title:String(x.title||'').slice(0,90),detail:String(x.detail||'').slice(0,120),entityKey:x.entityKey||'',status:x.status==='pending'?'pending':'approved'}));
}
