// واجهة خيارات المنتجات بشكل أزرار مثل متجر الأمير براند
function optionsHtml(p){
  if(!p.options||!p.options.length)return'';
  return `<div class="variant-box">${p.options.map(o=>`<div class="variant-section"><div class="variant-title">${esc(o.name)}</div><div class="product-option-group" data-option-name="${esc(o.name)}">${o.values.map(v=>`<button type="button" class="product-option-btn" data-option-name="${esc(o.name)}" data-option-value="${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`).join('')}<div class="variant-note">اختر الخيار قبل الإضافة للسلة</div></div>`;
}
function selectedProductOptions(p){
  const out={};
  if(!p.options||!p.options.length)return out;
  for(const o of p.options){
    const el=document.querySelector(`.product-option-btn.active[data-option-name="${CSS.escape(o.name)}"]`);
    if(!el)return null;
    out[o.name]=el.dataset.optionValue;
  }
  return out;
}
const originalAdd=add;
add=function(id){
  const p=products.find(x=>x.id===id);
  if(!p||sold(p))return toast('نفدت الكمية');
  if(p.options&&p.options.length&&!$('productModal').open){openProduct(id);return toast('اختر الخيار أولاً ثم أضف للسلة')}
  const current=cartEntry(id);
  if(p.stock!==null&&current.qty>=p.stock)return toast('وصلت للكمية المتوفرة');
  let opts=current.options;
  if(p.options&&p.options.length){
    opts=selectedProductOptions(p);
    if(!opts)return toast('اختر جميع الخيارات أولاً');
  }
  cart[id]={qty:current.qty+1,options:opts};
  saveCart();syncPurchase(id);toast('✓ تمت الإضافة للسلة');
};
