// خيارات المنتجات - يدعم الإدخال المبسط بدون كتابة اسم الخيار
function parseOptions(v){
  const raw=String(v||'').trim();
  if(!raw)return[];

  const lines=raw.split(/\n/).map(s=>s.trim()).filter(Boolean);
  const structured=[];
  const loose=[];

  lines.forEach(line=>{
    const i=line.indexOf(':');
    if(i>0){
      const name=line.slice(0,i).trim();
      const values=line.slice(i+1).split(/[|;]/).map(x=>x.trim()).filter(Boolean);
      if(name&&values.length)structured.push({name,values});
    }else{
      line.split(/[;|،,]/).map(x=>x.trim()).filter(Boolean).forEach(x=>loose.push(x));
    }
  });

  if(structured.length&&!loose.length)return structured;

  const memory=[], colors=[], other=[];
  loose.forEach(value=>{
    if(/(?:GB|TB|RAM|ROM|جيجا|غيغا|تيرا|\d+\s*\/\s*\d+)/i.test(value)) memory.push(value);
    else if(/^(?:اسود|أسود|ابيض|أبيض|احمر|أحمر|ازرق|أزرق|اخضر|أخضر|اصفر|أصفر|ذهبي|فضي|رصاصي|رمادي|وردي|بنفسجي|بني|بيج|برتقالي|كحلي|سماوي|أسمر)$/i.test(value)) colors.push(value);
    else other.push(value);
  });

  const result=[...structured];
  if(colors.length)result.push({name:'الألوان',values:colors});
  if(memory.length)result.push({name:'الذاكرة',values:memory});
  if(other.length)result.push({name:'الخيارات',values:other});
  return result;
}
