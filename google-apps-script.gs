/* معرض الفردوس - Google Apps Script لإدارة المنتجات والبراندات */
const SPREADSHEET_ID='1d6NCLMWqOmhZu6MH_nCRsUGiajXxc_qtL_oFPoU73ts';
const PRODUCTS_SHEET='الورقة1';
const BRANDS_SHEET='Brands';
const DEBUG_SHEET='Debug';

function doGet(e){
  const p=(e&&e.parameter)||{};
  const action=String(p.action||'').trim().toLowerCase();
  safeDebug_('GET','received',p,'');

  if(action==='brands'){
    try{
      const brands=listBrands_();
      safeDebug_('GET','brands_ok',p,'count='+brands.length);
      return json_({success:true,brands});
    }catch(err){
      safeDebug_('GET','brands_error',p,String(err.message||err));
      return json_({success:false,error:String(err.message||err)});
    }
  }

  if(action==='brand_upsert'){
    const lock=LockService.getScriptLock();
    lock.waitLock(20000);
    try{
      safeDebug_('GET','brand_upsert_start',p,'');
      const out=upsertBrand_(p);
      safeDebug_('GET','brand_upsert_ok',p,'saved');
      return out;
    }catch(err){
      safeDebug_('GET','brand_upsert_error',p,String(err.message||err));
      return json_({success:false,error:String(err.message||err)});
    }finally{
      lock.releaseLock();
    }
  }

  if(action==='brand_delete'){
    const lock=LockService.getScriptLock();
    lock.waitLock(20000);
    try{
      safeDebug_('GET','brand_delete_start',p,'');
      const out=deleteBrand_(p);
      safeDebug_('GET','brand_delete_ok',p,'deleted');
      return out;
    }catch(err){
      safeDebug_('GET','brand_delete_error',p,String(err.message||err));
      return json_({success:false,error:String(err.message||err)});
    }finally{
      lock.releaseLock();
    }
  }

  if(action==='debug'){
    return json_({success:true,rows:listDebug_()});
  }

  return json_({success:true,message:'Firdaws Store API is working'});
}

function doPost(e){
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{
    if(!e||!e.parameter) throw new Error('No request data received');
    const p=e.parameter;
    const action=String(p.action||'add').trim().toLowerCase();
    safeDebug_('POST','received',p,'');

    if(action==='brand_upsert'){
      safeDebug_('POST','brand_upsert_start',p,'');
      const out=upsertBrand_(p);
      safeDebug_('POST','brand_upsert_ok',p,'saved');
      return out;
    }

    if(action==='brand_delete'){
      safeDebug_('POST','brand_delete_start',p,'');
      const out=deleteBrand_(p);
      safeDebug_('POST','brand_delete_ok',p,'deleted');
      return out;
    }

    const sheet=getProductsSheet_();
    const info=ensureProductHeaders_(sheet);
    const out=action==='update'?updateProduct_(sheet,info,p):addProduct_(sheet,info,p);
    safeDebug_('POST','product_'+action+'_ok',p,'');
    return out;
  }catch(err){
    safeDebug_('POST','error',(e&&e.parameter)||{},String(err.message||err));
    return json_({success:false,error:String(err.message||err)});
  }finally{
    lock.releaseLock();
  }
}

function getSS_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function getProductsSheet_(){const ss=getSS_();return ss.getSheetByName(PRODUCTS_SHEET)||ss.getSheets()[0];}

function getBrandsSheet_(){
  const ss=getSS_();
  let s=ss.getSheetByName(BRANDS_SHEET);
  if(!s)s=ss.insertSheet(BRANDS_SHEET);
  if(s.getLastColumn()<3)s.insertColumnsAfter(Math.max(1,s.getLastColumn()),3-Math.max(1,s.getLastColumn()));
  const h=s.getRange(1,1,1,3).getDisplayValues()[0];
  if(h[0]!=='name'||h[1]!=='logo'||h[2]!=='updated_at')s.getRange(1,1,1,3).setValues([['name','logo','updated_at']]);
  s.setFrozenRows(1);
  return s;
}

function getDebugSheet_(){
  const ss=getSS_();
  let s=ss.getSheetByName(DEBUG_SHEET);
  if(!s)s=ss.insertSheet(DEBUG_SHEET);
  const headers=['timestamp','method','stage','action','name','logo','old_name','message'];
  if(s.getLastColumn()<headers.length){
    const need=headers.length-Math.max(1,s.getLastColumn());
    if(need>0)s.insertColumnsAfter(Math.max(1,s.getLastColumn()),need);
  }
  const h=s.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if(headers.some((x,i)=>h[i]!==x))s.getRange(1,1,1,headers.length).setValues([headers]);
  s.setFrozenRows(1);
  return s;
}

function safeDebug_(method,stage,p,message){
  try{
    const s=getDebugSheet_();
    const now=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Baghdad','yyyy-MM-dd HH:mm:ss');
    s.appendRow([
      now,
      String(method||''),
      String(stage||''),
      String((p&&p.action)||''),
      String((p&&p.name)||''),
      String((p&&p.logo)||''),
      String((p&&p.old_name)||''),
      String(message||'')
    ]);
    SpreadsheetApp.flush();
  }catch(_){ }
}

function listDebug_(){
  const s=getDebugSheet_();
  const last=s.getLastRow();
  if(last<2)return[];
  const start=Math.max(2,last-49);
  return s.getRange(start,1,last-start+1,8).getDisplayValues();
}

function headerInfo_(sheet){
  const n=Math.max(1,sheet.getLastColumn());
  const headers=sheet.getRange(1,1,1,n).getDisplayValues()[0].map(x=>String(x).trim());
  const idx={};
  headers.forEach((h,i)=>{if(h)idx[h.toLowerCase()]=i});
  return {headers,idx};
}

function ensureProductHeaders_(sheet){
  const required=['id','name','price','old_price','offer','discount_note','image','category','sub_category','brand','brand_logo','desc','images','featured','stock','active'];
  let info=headerInfo_(sheet);
  required.forEach(h=>{
    if(info.idx[h]===undefined){
      sheet.getRange(1,sheet.getLastColumn()+1).setValue(h);
      info=headerInfo_(sheet);
    }
  });
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  return headerInfo_(sheet);
}

function listBrands_(){
  const s=getBrandsSheet_();
  const last=s.getLastRow();
  if(last<2)return[];
  return s.getRange(2,1,last-1,3).getDisplayValues()
    .filter(r=>String(r[0]).trim())
    .map(r=>({name:String(r[0]).trim(),logo:String(r[1]).trim(),updated_at:String(r[2]).trim()}));
}

function findBrandLogo_(name){
  const key=String(name||'').trim().toLowerCase();
  if(!key)return'';
  const b=listBrands_().find(x=>x.name.toLowerCase()===key);
  return b?b.logo:'';
}

function upsertBrand_(p){
  const name=String(p.name||'').trim();
  const logo=String(p.logo||'').trim();
  const oldName=String(p.old_name||'').trim();

  safeDebug_('CORE','upsert_validate',p,'name='+(name?'ok':'missing')+', logo='+(logo?'ok':'missing'));
  if(!name)throw new Error('Missing brand name');
  if(!logo)throw new Error('Missing brand logo');

  const s=getBrandsSheet_();
  safeDebug_('CORE','brands_sheet_ready',p,'sheet='+s.getName());

  const last=s.getLastRow();
  const rows=last>=2?s.getRange(2,1,last-1,3).getDisplayValues():[];
  const keys=[oldName,name].filter(Boolean).map(x=>x.toLowerCase());
  let target=-1;

  for(let i=0;i<rows.length;i++){
    if(keys.includes(String(rows[i][0]).trim().toLowerCase())){
      target=i+2;
      break;
    }
  }

  const now=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Baghdad','yyyy-MM-dd HH:mm:ss');

  if(target<0){
    safeDebug_('CORE','before_append',p,'lastRow='+last);
    s.appendRow([name,logo,now]);
    SpreadsheetApp.flush();
    safeDebug_('CORE','after_append',p,'newLastRow='+s.getLastRow());
  }else{
    safeDebug_('CORE','before_update_row',p,'row='+target);
    s.getRange(target,1,1,3).setValues([[name,logo,now]]);
    SpreadsheetApp.flush();
    safeDebug_('CORE','after_update_row',p,'row='+target);
  }

  propagateBrandLogo_(oldName||name,name,logo);
  SpreadsheetApp.flush();

  const verify=listBrands_().find(x=>x.name.toLowerCase()===name.toLowerCase());
  if(!verify||String(verify.logo||'').trim()!==logo){
    safeDebug_('CORE','verify_failed',p,'brand row not found after write');
    throw new Error('Brand write verification failed');
  }

  safeDebug_('CORE','verify_ok',p,'saved');
  return json_({success:true,action:'brand_upsert',name,logo});
}

function deleteBrand_(p){
  const name=String(p.name||'').trim();
  if(!name)throw new Error('Missing brand name');
  const s=getBrandsSheet_();
  const last=s.getLastRow();
  if(last>=2){
    const rows=s.getRange(2,1,last-1,1).getDisplayValues();
    for(let i=rows.length-1;i>=0;i--){
      if(String(rows[i][0]).trim().toLowerCase()===name.toLowerCase())s.deleteRow(i+2);
    }
  }
  propagateBrandLogo_(name,name,'');
  SpreadsheetApp.flush();
  return json_({success:true,action:'brand_delete',name});
}

function propagateBrandLogo_(oldName,newName,logo){
  const s=getProductsSheet_();
  const info=ensureProductHeaders_(s);
  const last=s.getLastRow();
  if(last<2)return;
  const range=s.getRange(2,1,last-1,info.headers.length);
  const rows=range.getValues();
  const oldKey=String(oldName||'').trim().toLowerCase();
  const newKey=String(newName||'').trim().toLowerCase();
  let changed=false;
  rows.forEach(r=>{
    const b=String(r[info.idx.brand]||'').trim().toLowerCase();
    if(b===oldKey||b===newKey){
      if(oldKey&&oldKey!==newKey)r[info.idx.brand]=newName;
      r[info.idx.brand_logo]=logo;
      changed=true;
    }
  });
  if(changed)range.setValues(rows);
}

function fillBrandLogo_(row,info,p){
  const brand=String((info.idx.brand!==undefined?row[info.idx.brand]:'')||p.brand||'').trim();
  if(info.idx.brand_logo!==undefined){
    const sent=String(p.brand_logo||'').trim();
    row[info.idx.brand_logo]=sent||findBrandLogo_(brand)||row[info.idx.brand_logo]||'';
  }
}

function addProduct_(sheet,info,p){
  const row=new Array(info.headers.length).fill('');
  const id=String(p.id||'').trim()||String(Date.now());
  row[info.idx.id]=id;
  Object.keys(p).forEach(k=>{
    const key=String(k).toLowerCase();
    if(key==='action'||key==='id')return;
    if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];
  });
  fillBrandLogo_(row,info,p);
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return json_({success:true,action:'add',id});
}

function updateProduct_(sheet,info,p){
  const id=String(p.id||'').trim();
  if(!id)throw new Error('Missing product id');
  const last=sheet.getLastRow();
  if(last<2)throw new Error('No products found');
  const ids=sheet.getRange(2,info.idx.id+1,last-1,1).getDisplayValues();
  let target=-1;
  for(let i=0;i<ids.length;i++){
    if(String(ids[i][0]).trim()===id){target=i+2;break;}
  }
  if(target<0)throw new Error('Product not found: '+id);
  const range=sheet.getRange(target,1,1,info.headers.length);
  const row=range.getValues()[0];
  Object.keys(p).forEach(k=>{
    const key=String(k).toLowerCase();
    if(key==='action'||key==='id')return;
    if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];
  });
  row[info.idx.id]=id;
  fillBrandLogo_(row,info,p);
  range.setValues([row]);
  SpreadsheetApp.flush();
  return json_({success:true,action:'update',id,row:target});
}

function json_(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
