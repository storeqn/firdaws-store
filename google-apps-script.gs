/* معرض الفردوس - Google Apps Script لإدارة المنتجات */
const SPREADSHEET_ID='1d6NCLMWqOmhZu6MH_nCRsUGiajXxc_qtL_oFPoU73ts';
const PRODUCTS_SHEET='الورقة1';

function doGet(){return json_({success:true,message:'Firdaws Store API is working'});}

function doPost(e){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    if(!e||!e.parameter) throw new Error('No request data received');
    const p=e.parameter,action=String(p.action||'add').trim().toLowerCase();
    const sheet=getSheet_(),info=ensureHeaders_(sheet);
    return action==='update'?updateProduct_(sheet,info,p):addProduct_(sheet,info,p);
  }catch(err){return json_({success:false,error:String(err.message||err)});}finally{lock.releaseLock();}
}

function getSheet_(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(PRODUCTS_SHEET)||ss.getSheets()[0];
}

function headerInfo_(sheet){
  const n=sheet.getLastColumn();
  const headers=sheet.getRange(1,1,1,n).getDisplayValues()[0].map(x=>String(x).trim());
  const idx={};headers.forEach((h,i)=>{if(h)idx[h.toLowerCase()]=i});
  return {headers,idx};
}

function ensureHeaders_(sheet){
  const required=['id','name','price','old_price','offer','discount_note','image','category','sub_category','brand','desc','images','featured','stock','active'];
  let info=headerInfo_(sheet);
  required.forEach(h=>{if(info.idx[h]===undefined){sheet.getRange(1,sheet.getLastColumn()+1).setValue(h);info=headerInfo_(sheet);}});
  sheet.setFrozenRows(1);SpreadsheetApp.flush();return headerInfo_(sheet);
}

function addProduct_(sheet,info,p){
  const row=new Array(info.headers.length).fill('');
  const id=String(p.id||'').trim()||String(Date.now());
  row[info.idx.id]=id;
  Object.keys(p).forEach(k=>{const key=String(k).toLowerCase();if(key==='action'||key==='id')return;if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];});
  sheet.appendRow(row);SpreadsheetApp.flush();return json_({success:true,action:'add',id});
}

function updateProduct_(sheet,info,p){
  const id=String(p.id||'').trim();if(!id)throw new Error('Missing product id');
  const last=sheet.getLastRow();if(last<2)throw new Error('No products found');
  const ids=sheet.getRange(2,info.idx.id+1,last-1,1).getDisplayValues();
  let target=-1;for(let i=0;i<ids.length;i++){if(String(ids[i][0]).trim()===id){target=i+2;break;}}
  if(target<0)throw new Error('Product not found: '+id);
  const range=sheet.getRange(target,1,1,info.headers.length),row=range.getValues()[0];
  Object.keys(p).forEach(k=>{const key=String(k).toLowerCase();if(key==='action'||key==='id')return;if(info.idx[key]!==undefined)row[info.idx[key]]=p[k];});
  row[info.idx.id]=id;range.setValues([row]);SpreadsheetApp.flush();return json_({success:true,action:'update',id,row:target});
}

function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
