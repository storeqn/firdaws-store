/* معرض الفردوس - Google Apps Script لإدارة المنتجات والبراندات */
const SPREADSHEET_ID='1d6NCLMWqOmhZu6MH_nCRsUGiajXxc_qtL_oFPoU73ts';
const PRODUCTS_SHEET='الورقة1';
const BRANDS_SHEET='Brands';

function doGet(e){
  const action=String((e&&e.parameter&&e.parameter.action)||'').trim().toLowerCase();
  if(action==='brands') return json_({success:true,brands:listBrands_()});
  return json_({success:true,message:'Firdaws Store API is working'});
}

function doPost(e){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    if(!e||!e.parameter) throw new Error('No request data received');
    const p=e.parameter,action=String(p.action||'add').trim().toLowerCase();
    if(action==='brand_upsert') return upsertBrand_(p);
    if(action==='brand_delete') return deleteBrand_(p);
    const sheet=getProductsSheet_(),info=ensureProductHeaders_(sheet);
    return action==='update'?updateProduct_(sheet,info,p):addProduct_(sheet,info,p);
  }catch(err){return json_({success:false,error:String(err.message||err)});}finally{lock.releaseLock();}
}

function getSS_(){return SpreadsheetApp.openById(SPREADSHEET_ID);}
function getProductsSheet_(){const ss=getSS_();return ss.getSheetByName(PRODUCTS_SHEET)||ss.getSheets()[0];}
function getBrandsSheet_(){const ss=getSS_();let s=ss.getSheetByName(BRANDS_SHEET);if(!s)s=ss.insertSheet(BRANDS_SHEET);if(s.getLastColumn()<3)s.insertColumnsAfter(Math.max(1,s.getLastColumn()),3-Math.max(1,s.getLastColumn()));const h=s.getRange(1,1,1,3).getDisplayValues()[0];if(h[0]!=='name'||h[1]!=='logo'||h[2]!=='updated_at')s.getRange(1,1,1,3).setValues([['name','logo','updated_at']]);s.setFrozenRows(1);return s;}

function headerInfo_(sheet){
  const n=Math.max(1,sheet.getLastColumn());
  const headers=sheet.getRange(1,1,1,n).getDisplayValues()[0].map(x=>String(x).trim());
  const idx={};headers.forEach((h,i)=>{if(h)idx[h.toLowerCase()]=i});
  return {headers,idx};
}

function ensureProductHeaders_(sheet){
  const required=['id','name','price','old_price','offer','discount_note','image','category','sub_category','brand','brand_logo','desc','images','featured','stock','active'];
  let info=headerInfo_(sheet);
  required.forEach(h=>{if(info.idx[h]===undefined){sheet.getRange(1,sheet.getLastColumn()+1).setValue(h);info=headerInfo_(sheet);}});
  sheet.setFrozenRows(1);SpreadsheetApp.flush();return headerInfo_(sheet);
}

function listBrands_(){
  const s=getBrandsSheet_(),last=s.getLastRow();if(last<2)return[];
  return s.getRange(2,1,last-1,3).getDisplayValues().filter(r=>String(r[0]).trim()).map(r=>({name:String(r[0]).trim(),logo:String(r[1]).trim(),updated_at:String(r[2]).trim()}));
}

function findBrandLogo_(name){
  const key=String(name||'').trim().toLowerCase();if(!key)return'';
  const b=listBrands_().find(x=>x.name.toLowerCase()===key);return b?b.logo:'';
}

function upsertBrand_(p){
  const name=String(p.name||'').trim(),logo=String(p.logo||'').trim(),oldName=String(p.old_name||'').trim();
  if(!name)throw new Error('Missing brand name');if(!logo)throw new Error('Missing brand logo');
  const s=getBrandsSheet_(),last=s.getLastRow(),rows=last>=2?s.getRange(2,1,last-1,3).getDisplayValues():[];
  const keys=[oldName,name].filter(Boolean).map(x=>x.toLowerCase());let target=-1;
  for(let i=0;i<rows.length;i++){if(keys.includes(String(rows[i][0]).trim().toLowerCase())){target=i+2;break;}}
  const now=Utilities.formatDate(new Date(),Session.getScriptTimeZone()||'Asia/Baghdad','yyyy-MM-dd HH:mm:ss');
  if(target<0)s.appendRow([name,logo,now]);else s.getRange(target,1,1,3).setValues([[name,logo,now]]);
  propagateBrandLogo_(oldName||name,name,logo);SpreadsheetApp.flush();
  return json_({success:true,action:'brand_upsert',name,logo});
}

function deleteBrand_(p){
  const name=String(p.name||'').trim();if(!name)throw new Error('Missing brand name');
  const s=getBrandsSheet_(),last=s.getLastRow();if(last>=2){const rows=s.getRange(2,1,last-1,1).getDisplayValues();for(let i=rows.length-1;i>=0;i--){if(String(rows[i][0]).trim().toLowerCase()===name.toLowerCase())s.deleteRow(i+2);}}
  propagateBrandLogo_(name,name,'');SpreadsheetApp.flush();return json_({success:true,action:'brand_delete',name});
}

function propagateBrandLogo_(oldName,newName,logo){
  const s=getProductsSheet_(),info=ensureProductHeaders_(s),last=s.getLastRow();if(last<2)return;
  const range=s.getRange(2,1,last-1,info.headers.length),rows=range.getValues(),oldKey=String(oldName||'').trim().toLowerCase(),newKey=String(newName||'').trim().toLowerCase();
  let changed=false;rows.forEach(r=>{const b=String(r[info.idx.brand]||'').trim().toLowerCase();if(b===oldKey||b===newKey){if(oldKey&&oldKey!==newKey)r[info.idx.brand]=newName;r[info.idx.brand_logo]=logo;changed=true;}});if(changed)range.setValues(rows);
}

function fillBrandLogo_(row,info,p){
  const brand=String((info.idx.brand!==undefined?row[info.idx.brand]:'')||p.brand||'').trim();
  if(info.idx.brand_logo!==undefined){const sent=String(p.brand_logo||'').trim();row[info.idx.brand_logo]=sent||findBrandLogo_(brand)||row[info.idx.brand_logo]||'';}
}

function addProduct_(sheet,info,p){
  const row=new Array(info.headers.length).fill('');const id=String(p.id||'').trim()||String(Date.now());row[info.idx.id]=id;
  Object.keys(p).forEach(k=>{const key=String(k).toLowerCase();if(key==='action'||key==='id')return;if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];});
  fillBrandLogo_(row,info,p);sheet.appendRow(row);SpreadsheetApp.flush();return json_({success:true,action:'add',id});
}

function updateProduct_(sheet,info,p){
  const id=String(p.id||'').trim();if(!id)throw new Error('Missing product id');const last=sheet.getLastRow();if(last<2)throw new Error('No products found');
  const ids=sheet.getRange(2,info.idx.id+1,last-1,1).getDisplayValues();let target=-1;for(let i=0;i<ids.length;i++){if(String(ids[i][0]).trim()===id){target=i+2;break;}}if(target<0)throw new Error('Product not found: '+id);
  const range=sheet.getRange(target,1,1,info.headers.length),row=range.getValues()[0];Object.keys(p).forEach(k=>{const key=String(k).toLowerCase();if(key==='action'||key==='id')return;if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];});
  row[info.idx.id]=id;fillBrandLogo_(row,info,p);range.setValues([row]);SpreadsheetApp.flush();return json_({success:true,action:'update',id,row:target});
}

function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
