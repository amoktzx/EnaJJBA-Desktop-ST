/* Citation matching for RP narrative. It validates actual words in a single source,
 * including abbreviated citations with ordered ellipsis-separated literal anchors.
 * This is only textual provenance, NEVER semantic fact checking. */
export function normalizeQuoteText(value){
  return String(value??'').normalize('NFKC').toLocaleLowerCase('ru')
    .replace(/ё/g,'е').replace(/[\u200b-\u200d\ufeff]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
}
function findPhrase(text,phrase,from=0){
  // Match whole normalized tokens, not substrings of unrelated words.
  for(let at=text.indexOf(phrase,from);at>=0;at=text.indexOf(phrase,at+1)){
    const left=at===0||text[at-1]===' ';
    const end=at+phrase.length;
    if(left&&(end===text.length||text[end]===' '))return at;
  }
  return -1;
}
export function matchSourceQuote(source,quote){
  const raw=String(quote??'').trim();
  if(!raw)return {valid:false,mode:'none'};
  const full=normalizeQuoteText(source),normalized=normalizeQuoteText(raw);
  if(!full||normalized.length<5)return {valid:false,mode:'none'};
  if(String(source).includes(raw))return {valid:true,mode:'exact'};
  // Short punctuation/whitespace variations are okay, but words must be intact.
  const hasEllipsis=/(?:\.{3,}|…)/u.test(raw);
  if(!hasEllipsis)return {valid:findPhrase(full,normalized)>=0,mode:'normalized'};
  const fragments=raw.split(/(?:\.{3,}|…)/u).map(normalizeQuoteText).filter(Boolean);
  if(fragments.length<2||fragments.some(x=>x.length<10 || x.split(' ').length<2))
    return {valid:false,mode:'unsafe-fragments'};
  let from=0;
  for(const fragment of fragments){
    const at=findPhrase(full,fragment,from);
    if(at<0)return {valid:false,mode:'unmatched-fragments'};
    from=at+fragment.length;
  }
  return {valid:true,mode:'fragments'};
}
