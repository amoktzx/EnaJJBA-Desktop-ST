// Pure functions used by the beta and its local regression tests.
export function digest(value) {
  const s=String(value??''); let h=2166136261;
  for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;}
  return h.toString(36);
}
// SillyTavern normally provides `mes`, but imported or extension-provided
// chat contexts can expose plain text in `text` or `content`. Never serialize
// an arbitrary object as "[object Object]" and mistake that for roleplay text.
export function messageText(message){
  if(!message || typeof message!=='object')return typeof message==='string'?message:'';
  for(const name of ['mes','text','content','message']){
    const value=message[name];
    if(typeof value==='string' && value.trim())return value;
    if(value && typeof value==='object'){
      if(typeof value.text==='string' && value.text.trim())return value.text;
      if(typeof value.content==='string' && value.content.trim())return value.content;
      if(Array.isArray(value)){
        const combined=value.map(x=>typeof x==='string'?x:(x?.type==='text'&&typeof x.text==='string'?x.text:'')).filter(Boolean).join('\n');
        if(combined.trim())return combined;
      }
    }
  }
  if(Array.isArray(message.swipes)&&message.swipes.length){
    const selected=message.swipes[Number(message.swipe_id)||0];
    if(typeof selected==='string'&&selected.trim())return selected;
  }
  return '';
}
// Imported SillyTavern conversations may mark *every* ordinary roleplay
// message is_system=true.  A real system notice has a system role/name/type,
// or lacks a recognizable actor. Keep the flag visible in diagnostics, but
// do not discard a named user/assistant message solely because of it.
export function isRoleplayMessage(message){
  const text=messageText(message);
  if(!text.trim())return false;
  if(!message || typeof message!=='object')return typeof message==='string';
  if(message.role==='system' || message.type==='system' || message.extra?.type==='system' || message.extra?.is_system===true)return false;
  const name=String(message.name??'').trim();
  if(/^(?:system|system prompt|sillytavern|система|системное сообщение)(?:\s|$|:)/i.test(name))return false;
  if(message.is_system===true){
    // Both are present in the user's imported JJBA chat, including its
    // narrator: name + explicit actor flag. Do not guess on anonymous notices.
    return Boolean(name && typeof message.is_user==='boolean');
  }
  return true;
}
export function messageKey(message){
  if(!isRoleplayMessage(message)) return '';
  const text=messageText(message);
  return digest([message.send_date??'',message.is_user?'user':'assistant',text,message.swipe_id??''].join('\u241f'));
}
export function messageSourceStats(chat,start=0,limit=10){
  const list=Array.isArray(chat)?chat:[];
  const section=list.slice(start,start+limit);
  const result={start,end:Math.min(list.length,start+limit),total:list.length,entries:section.length,
    system:0,flaggedSystem:0,recoveredSystem:0,text:0,empty:0,mes:0,fallback:0,swipes:0,other:0,
    samples:[]};
  for(let i=0;i<section.length;i++){
    const m=section[i];
    const isObj=m&&typeof m==='object';
    if(!isObj){result.other++;if(result.samples.length<3)result.samples.push({index:start+i+1,type:typeof m,keys:[],is_system:false,length:typeof m==='string'?m.length:0});continue;}
    const keys=Object.keys(m);
    const system=m.is_system===true;
    if(system)result.flaggedSystem++;
    const text=messageText(m), readable=isRoleplayMessage(m);
    if(system&&readable)result.recoveredSystem++;
    if(system&&!readable)result.system++;
    if(readable){result.text++;if(typeof m.mes==='string'&&m.mes.trim())result.mes++;else result.fallback++;}
    else result.empty++;
    if(Array.isArray(m.swipes)&&m.swipes.length)result.swipes++;
    if(result.samples.length<3)result.samples.push({index:start+i+1,type:'object',keys:keys.slice(0,12),is_system:system,length:text.length,
      mesType:typeof m.mes,textType:typeof m.text,contentType:typeof m.content});
  }
  return result;
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
