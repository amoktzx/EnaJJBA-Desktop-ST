// Explicit, user-provided World Info is a trustworthy *document source*, not a chat citation.
// No nickname registry and no fuzzy identity matching.
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
const LOWER=s=>clean(s).toLocaleLowerCase('ru');
const FIRST=(a)=>Array.isArray(a)?a:Object.values(a||{});
export function appearanceFromLore(content){
  const src=String(content||'');
  // Named appearance sections are preferred. Stop before attire, psychology and lore.
  const match=src.match(/(?:^|\n)\s*ВНЕШНОСТЬ\s*:\s*([^]*?)(?=\n\s*(?:ПРИМЕТЫ|ОДЕЖДА|ХАРАКТЕР|ОТНОШЕНИЯ|БИОГРАФИЯ|ВОЗРАСТ|СПОСОБНОСТИ)\s*:|\n\s*\n|$)/i);
  const marks=src.match(/(?:^|\n)\s*ПРИМЕТЫ\s*:\s*([^]*?)(?=\n\s*(?:ОДЕЖДА|ХАРАКТЕР|ОТНОШЕНИЯ|БИОГРАФИЯ|ВОЗРАСТ|СПОСОБНОСТИ)\s*:|\n\s*\n|$)/i);
  if(match){return [clean(match[1]),marks?`Приметы: ${clean(marks[1])}`:''].filter(Boolean).join('\n').slice(0,2200);}
  const firstParagraph=src.trim().split(/\n\s*\n/)[0].trim();
  // Other character entries usually open with a physical description, but some
  // contain only plots. Import only clearly physical opening paragraphs.
  if(!/(?:\d{2,3}\s*см|глаз|волос|кож|причес|телосложен|шрам|черты лица)/i.test(firstParagraph))return '';
  return firstParagraph.slice(0,1100);
}
export function parseLorebookProfiles(json){
  if(!json||typeof json!=='object'||(!json.entries&&!json.data?.entries))throw Error('Не найден массив/словарь entries в World Info JSON');
  const entries=FIRST(json.entries||json.data.entries), result=[];
  for(const entry of entries){
    if(!entry||typeof entry.content!=='string')continue;
    const comment=String(entry.comment||entry.name||'').replace(/^\s*\d+\s*[—-]\s*/,'').trim();
    // Character entries use a name followed by an ability, or ':'; reject group descriptions.
    const prefix=comment.split(/\s+и\s+|\s*:\s*/i)[0].trim();
    if(!/^[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+){1,2}$/.test(prefix))continue;
    if(/^(?:Ена и |Леоне и |Сорбет и |Джорно и |Квартира |Мастерская |Вилла |Салон |Порт |Периметр |Видео)/i.test(comment))continue;
    const appearance=appearanceFromLore(entry.content);
    if(!appearance)continue;
    result.push({name:prefix,appearance,sourceTitle:comment,entryId:String(entry.uid??''),mention:prefix.split(' ')[0]});
  }
  return result.filter((entry,i,a)=>a.findIndex(other=>LOWER(other.name)===LOWER(entry.name))===i);
}
export function firstEncounter(lore, portion, seen=[]){
  const taken=new Set(seen.map(LOWER));
  const all=(portion||[]).map(p=>String(p.text||'')).join('\n');
  return (lore||[]).filter(p=>{
    if(taken.has(LOWER(p.name)))return false;
    // Match the proper first name only if that name is unambiguous among imported profiles.
    const first=p.mention;
    if((lore||[]).filter(x=>LOWER(x.mention)===LOWER(first)).length!==1)return false;
    return new RegExp(`(^|[^\\p{L}])${first}(?=$|[^\\p{L}])`,'iu').test(all)||all.includes(p.name);
  });
}
