/* Ena Desktop Beta 5.9: pure dossier grouping and conservative reference hints.
 * Importing this module never alters a chat, an export, or stored records.
 */
const normalized = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('ru')
  .replace(/ё/g, 'е').replace(/[«»“”„"'`]/g, '').replace(/\s+/g, ' ').trim();
export const personKey = subject => normalized(subject) || 'персонаж не указан';
export const dossierAttribute = value => {
  const raw = normalized(value);
  if (/^(цвет |оттенок )?глаз[а-я]*$/.test(raw) || raw === 'глаза') return 'Глаза';
  if (/^(цвет |оттенок |стиль |длина )?волос[а-я]*$/.test(raw) || raw === 'прическа') return 'Волосы';
  if (raw === 'рост' || raw === 'высота') return 'Рост';
  if (/^(цвет |тон |оттенок )?кож[а-я]*$/.test(raw)) return 'Кожа';
  if (/^(пищевое )?предпочтени[а-я]*$/.test(raw) || raw === 'любимая еда') return 'Любимая еда';
  return String(value||'Не указано').trim();
};
export const attributeKey = value => normalized(dossierAttribute(value));
export const wardrobeAttribute = value => /(?:комплект|наряд|костюм|одежд|гардероб|накидк|плащ|платье|рубашк|брюк|топ\b|куртк)/i.test(String(value||''));
export const referenceScope = (scope,attribute) => scope === 'gm:profiles' && wardrobeAttribute(attribute) ? 'gm:wardrobe' : scope;
const contentKey = detail => normalized(detail).replace(/[.,;:!?()\-—]+/g, ' ').replace(/\s+/g,' ').trim();
export function referenceAction(candidate, records=[], proposals=[]) {
  if(!candidate || !['gm:profiles','gm:wardrobe'].includes(candidate.scope)) return {type:'create'};
  const matching = entry => entry && referenceScope(entry.scope,entry.attribute) === candidate.scope && !entry.deleted &&
    personKey(entry.subject) === personKey(candidate.subject) &&
    (candidate.scope !== 'gm:profiles' || attributeKey(entry.attribute) === attributeKey(candidate.attribute));
  // Clothing outfits are separate observations; their similar names do not
  // prove ownership or persistence. A confirmed exact outfit should not repeat.
  const comparable=[...records.filter(matching),...proposals.filter(p=>p.status!=='deleted'&&p.status!=='rejected'&&matching(p))];
  if(comparable.some(item=>contentKey(item.detail) === contentKey(candidate.detail))) return {type:'repeat'};
  if(candidate.scope==='gm:profiles') {
    const approved=comparable.filter(x=>x.status==='approved'||x.manual||x.proposalId);
    if(approved.length) return {type:'update', previousId:approved[approved.length-1].id};
    if(comparable.length) return {type:'additional', reason:'другое значение свойства уже на рассмотрении'};
  }
  return {type:'create'};
}
export function groupDossiers(records=[]) {
  const map=new Map();
  for(const record of records) {
    if(!['gm:profiles','gm:wardrobe'].includes(record.scope)||record.deleted) continue;
    const person=personKey(record.subject);
    if(!map.has(person))map.set(person,{key:person,name:record.subject?.trim()||'Персонаж не указан',fields:new Map(),wardrobe:[]});
    const dossier=map.get(person);
    if(referenceScope(record.scope,record.attribute)==='gm:wardrobe'){dossier.wardrobe.push(record);continue;}
    const a=attributeKey(record.attribute||record.title);
    if(!dossier.fields.has(a))dossier.fields.set(a,{name:dossierAttribute(record.attribute||record.title),history:[]});
    dossier.fields.get(a).history.push(record);
  }
  const newest=(a,b)=>{const ai=Math.max(-1,...(a.sources||[]).map(s=>Number(s.index)||0));const bi=Math.max(-1,...(b.sources||[]).map(s=>Number(s.index)||0));return ai-bi || String(a.created||'').localeCompare(String(b.created||''));};
  for(const d of map.values()){
    for(const f of d.fields.values())f.history.sort(newest);
    d.wardrobe.sort(newest);
    const outfits=new Map();
    // Only merge genuinely identical outfit descriptions; a new garment is NOT
    // automatically the same item just because the wearer is the same.
    for(const record of d.wardrobe){
      const ref=contentKey(record.detail)||`record:${record.id}`;
      if(!outfits.has(ref))outfits.set(ref,[]);
      outfits.get(ref).push(record);
    }
    d.wardrobeGroups=[...outfits.values()];
  }
  return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'ru'));
}
