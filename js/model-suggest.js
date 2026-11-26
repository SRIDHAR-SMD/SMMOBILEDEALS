/* Model suggestions + chatbot auto-fill
   1) Service "What's the issue?" box, Contact message box and the admin product form
      (Name / Brand / Model) show model suggestions while typing.
      Type "samsung s"  -> every Galaxy S model (S10e ... S26 Ultra)
      Type "samsung s ultra" -> S20 Ultra, S21 Ultra ... S26 Ultra
      Type "iphone"     -> iPhone, 3G ... 18 Pro Max
   2) Admin product form: when the admin saves a product with only brand/model typed,
      the chatbot fills the empty Description + Specs. Admin can switch this access
      ON/OFF (checkbox in the form) and press UNDO after saving. */
const ModelSuggest=(()=>{
  const L=(brand,prefix,list)=>list.map(n=>({brand,name:prefix+n}));
  const MODELS=[].concat(
    /* ---------- Samsung (list given by shop) ---------- */
    L('Samsung','Galaxy ',['S10e','S10','S10+','S10 5G','S20','S20+','S20 Ultra','S20 FE','S21','S21+','S21 Ultra','S21 FE','S22','S22+','S22 Ultra','S23','S23+','S23 Ultra','S23 FE','S24','S24+','S24 Ultra','S24 FE','S25','S25+','S25 Ultra','S26','S26+','S26 Ultra']),
    L('Samsung','Galaxy ',['Z Fold','Z Fold 2','Z Fold 3','Z Fold 4','Z Fold 5','Z Fold 6','Z Fold 7']),
    L('Samsung','Galaxy ',['Z Flip','Z Flip 5G','Z Flip 3','Z Flip 4','Z Flip 5','Z Flip 6','Z Flip 7']),
    /* ---------- Apple (list given by shop) ---------- */
    L('Apple','',['iPhone','iPhone 3G','iPhone 3GS','iPhone 4','iPhone 4S','iPhone 5','iPhone 5c','iPhone 5s','iPhone 6','iPhone 6 Plus','iPhone 6s','iPhone 6s Plus','iPhone SE','iPhone 7','iPhone 7 Plus','iPhone 8','iPhone 8 Plus','iPhone X','iPhone XS','iPhone XS Max','iPhone XR','iPhone 11','iPhone 11 Pro','iPhone 11 Pro Max','iPhone 12','iPhone 12 mini','iPhone 12 Pro','iPhone 12 Pro Max','iPhone 13','iPhone 13 mini','iPhone 13 Pro','iPhone 13 Pro Max','iPhone SE 3rd Gen','iPhone 14','iPhone 14 Plus','iPhone 14 Pro','iPhone 14 Pro Max','iPhone 15','iPhone 15 Plus','iPhone 15 Pro','iPhone 15 Pro Max','iPhone 16','iPhone 16 Plus','iPhone 16 Pro','iPhone 16 Pro Max','iPhone 16e','iPhone 17','iPhone 17 Air','iPhone 17 Pro','iPhone 17 Pro Max','iPhone 18','iPhone 18 Pro','iPhone 18 Pro Max']),
    /* ---------- other brands already sold in the shop ---------- */
    L('Samsung','Galaxy ',['A06','A16','A26','A36','A56','A15','A25','A35','A55','M15','M35','M55','F15','F55']),
    L('Google','',['Pixel 6','Pixel 6 Pro','Pixel 6a','Pixel 7','Pixel 7 Pro','Pixel 7a','Pixel 8','Pixel 8 Pro','Pixel 8a','Pixel 9','Pixel 9 Pro','Pixel 9 Pro XL','Pixel 9 Pro Fold','Pixel 9a','Pixel 10','Pixel 10 Pro','Pixel 10 Pro XL']),
    L('OnePlus','OnePlus ',['9','9 Pro','10 Pro','10T','11','11R','12','12R','13','13R','Nord 3','Nord 4','Nord 5','Nord CE 3','Nord CE 4']),
    L('Xiaomi','Xiaomi ',['12','12 Pro','13','13 Pro','13T','13T Pro','14','14 Ultra','14T','14T Pro','15','15 Ultra']),
    L('Redmi','Redmi ',['Note 11','Note 12','Note 12 Pro','Note 13','Note 13 Pro','Note 13 Pro+','Note 14','Note 14 Pro','Note 14 Pro+','13C','A3','12 5G','13 5G','14C']),
    L('Oppo','Oppo ',['Reno 10','Reno 10 Pro','Reno 11','Reno 11 Pro','Reno 12','Reno 12 Pro','Reno 13','Reno 13 Pro','F25 Pro','F27 Pro+','K12x','A3 Pro','Find X8']),
    L('Vivo','Vivo ',['V27','V27 Pro','V29','V29 Pro','V30','V30 Pro','V40','V40 Pro','V50','T3','T3 Pro','T4','Y28','Y200','X100','X100 Pro','X200','X200 Pro']),
    L('Realme','Realme ',['11 Pro','11 Pro+','12 Pro','12 Pro+','13 Pro','13 Pro+','14 Pro','14 Pro+','GT 6','GT 6T','Narzo 70','Narzo 70 Pro','Narzo 80 Pro','C55','C65','C67']),
    L('Motorola','Motorola ',['Edge 40','Edge 40 Neo','Edge 50 Pro','Edge 50 Fusion','Edge 60 Pro','Edge 60 Fusion','G54','G64','G84','G85','Razr 40','Razr 50','Razr 60'])
  ).map(m=>({brand:m.brand,name:m.name,full:m.name.toLowerCase().indexOf(m.brand.toLowerCase())===0?m.name:m.brand+' '+m.name}));

  /* "iPhone 3G" etc keep Apple prefix; Samsung "Galaxy S24" -> "Samsung Galaxy S24" */
  const norm=s=>String(s||'').toLowerCase().replace(/series/g,' ').replace(/[^a-z0-9+]+/g,' ').trim();
  MODELS.forEach(m=>{m._k=norm(m.brand+' '+m.name);m._w=m._k.split(' ')});
  /* Samsung/Galaxy aliases so "galaxy s" or "s24 ultra" works without the brand word */
  function search(q,max){
    const t=norm(q).split(' ').filter(Boolean);
    if(!t.length)return[];
    if(t.length===1&&t[0].length<2)return[];
    const out=[];
    for(const m of MODELS){
      let pos=-1,ok=true;
      for(const tok of t){
        let f=-1;
        for(let i=pos+1;i<m._w.length;i++){if(m._w[i].indexOf(tok)===0){f=i;break}}
        if(f<0){ok=false;break}pos=f;
      }
      if(ok)out.push(m);
      if(out.length>=(max||60))break;
    }
    return out;
  }

  /* ---------- dropdown UI ---------- */
  let box=null,cur=null;
  function css(){
    if(document.getElementById('ms-style'))return;
    const s=document.createElement('style');s.id='ms-style';
    s.textContent='.ms-box{position:absolute;z-index:100002;max-height:260px;overflow:auto;background:#101827!important;color:#f4f6fb!important;border:1px solid #33405e!important;border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.45);padding:4px}.ms-box *{color:inherit!important;text-shadow:none!important;opacity:1!important}.ms-head{font-size:11px;color:#9fb0d0!important;padding:6px 10px 2px}.ms-item{display:flex;justify-content:space-between;gap:10px;padding:11px 10px;border-radius:8px;cursor:pointer;font-size:14px;color:#f4f6fb!important}.ms-item:hover,.ms-item.on{background:#2563eb!important;color:#fff!important}.ms-item small{color:#9fb0d0!important;font-size:11.5px}.ms-item:hover small{color:#dbe6ff!important}';
    document.head.appendChild(s);
  }
  function hide(){if(box){box.remove();box=null}cur=null}
  function show(el,items,onPick){
    css();hide();if(!items.length)return;
    box=document.createElement('div');box.className='ms-box';
    const r=el.getBoundingClientRect();
    box.style.left=(r.left+window.scrollX)+'px';box.style.top=(r.bottom+window.scrollY+4)+'px';box.style.width=Math.max(r.width,260)+'px';
    box.innerHTML='<div class="ms-head">Suggestions — tap to select</div>'+items.map((m,i)=>'<div class="ms-item" data-i="'+i+'"><span>'+m.full.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span><small>'+m.brand+'</small></div>').join('');
    document.body.appendChild(box);cur={items,onPick};
    box.addEventListener('mousedown',e=>{const it=e.target.closest('.ms-item');if(!it)return;e.preventDefault();const m=items[+it.dataset.i];hide();onPick(m)});
  }
  document.addEventListener('mousedown',e=>{if(box&&!box.contains(e.target))hide()});
  window.addEventListener('scroll',e=>{if(box&&!box.contains(e.target))hide()},true);

  /* free-text box (textarea): suggest for the last few words typed, replace them on pick */
  function attachText(el){
    if(!el||el.dataset.msOn)return;el.dataset.msOn='1';
    el.addEventListener('input',()=>{
      const before=el.value.slice(0,el.selectionStart||el.value.length);
      const seg=before.split(/[,.;\n]/).pop();
      const words=seg.split(/\s+/).filter(Boolean);
      for(let n=Math.min(4,words.length);n>=1;n--){
        const frag=words.slice(-n).join(' ');
        const hit=search(frag,40);
        if(hit.length){
          show(el,hit,m=>{
            const idx=before.toLowerCase().lastIndexOf(frag.toLowerCase());
            el.value=before.slice(0,idx)+m.full+el.value.slice(before.length);
            el.focus();const p=idx+m.full.length;el.setSelectionRange(p,p);
          });return;
        }
      }
      hide();
    });
    el.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  }
  /* single-line input (admin form): whole value is the query */
  function attachInput(el,onPick){
    if(!el||el.dataset.msOn)return;el.dataset.msOn='1';
    const go=()=>{const q=(document.getElementById('pm-brand')&&el.id==='pm-model-name'?document.getElementById('pm-brand').value+' ':'')+el.value;const hit=search(q,60);hit.length?show(el,hit,onPick):hide()};
    el.addEventListener('input',go);el.addEventListener('focus',()=>{if(el.value)go()});
    el.addEventListener('keydown',e=>{if(e.key==='Escape')hide()});
  }

  /* ---------- chatbot knowledge (only facts that are certain) ---------- */
  const IP=(k,chip,disp,cam,extra)=>({k,chip,disp,cam,extra});
  const KNOWN=[
    IP('iphone 11 pro max','A13 Bionic','6.5" Super Retina XDR OLED','12MP triple'),IP('iphone 11 pro','A13 Bionic','5.8" Super Retina XDR OLED','12MP triple'),IP('iphone 11','A13 Bionic','6.1" Liquid Retina LCD','12MP dual'),
    IP('iphone 12 pro max','A14 Bionic','6.7" Super Retina XDR OLED','12MP triple','5G'),IP('iphone 12 pro','A14 Bionic','6.1" Super Retina XDR OLED','12MP triple','5G'),IP('iphone 12 mini','A14 Bionic','5.4" Super Retina XDR OLED','12MP dual','5G'),IP('iphone 12','A14 Bionic','6.1" Super Retina XDR OLED','12MP dual','5G'),
    IP('iphone 13 pro max','A15 Bionic','6.7" Super Retina XDR OLED (120Hz)','12MP triple','5G'),IP('iphone 13 pro','A15 Bionic','6.1" Super Retina XDR OLED (120Hz)','12MP triple','5G'),IP('iphone 13 mini','A15 Bionic','5.4" Super Retina XDR OLED','12MP dual','5G'),IP('iphone 13','A15 Bionic','6.1" Super Retina XDR OLED','12MP dual','5G'),
    IP('iphone 14 pro max','A16 Bionic','6.7" Super Retina XDR OLED (120Hz, Always-On)','48MP triple','5G'),IP('iphone 14 pro','A16 Bionic','6.1" Super Retina XDR OLED (120Hz, Always-On)','48MP triple','5G'),IP('iphone 14 plus','A15 Bionic','6.7" Super Retina XDR OLED','12MP dual','5G'),IP('iphone 14','A15 Bionic','6.1" Super Retina XDR OLED','12MP dual','5G'),
    IP('iphone 15 pro max','A17 Pro','6.7" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C · Titanium'),IP('iphone 15 pro','A17 Pro','6.1" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C · Titanium'),IP('iphone 15 plus','A16 Bionic','6.7" Super Retina XDR OLED','48MP dual','5G · USB-C'),IP('iphone 15','A16 Bionic','6.1" Super Retina XDR OLED','48MP dual','5G · USB-C'),
    IP('iphone 16 pro max','A18 Pro','6.9" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C'),IP('iphone 16 pro','A18 Pro','6.3" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C'),IP('iphone 16 plus','A18','6.7" Super Retina XDR OLED','48MP dual','5G · USB-C'),IP('iphone 16e','A18','6.1" Super Retina XDR OLED','48MP single','5G · USB-C'),IP('iphone 16','A18','6.1" Super Retina XDR OLED','48MP dual','5G · USB-C'),
    IP('iphone 17 pro max','A19 Pro','6.9" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C'),IP('iphone 17 pro','A19 Pro','6.3" Super Retina XDR OLED (120Hz)','48MP triple','5G · USB-C'),IP('iphone 17 air','A19 Pro','6.5" Super Retina XDR OLED (120Hz)','48MP single','5G · USB-C'),IP('iphone 17','A19','6.3" Super Retina XDR OLED (120Hz)','48MP dual','5G · USB-C'),
    IP('galaxy s25 ultra','','6.9" Dynamic AMOLED 2X (120Hz)','200MP quad','5G · S Pen'),IP('galaxy s24 ultra','','6.8" Dynamic AMOLED 2X (120Hz)','200MP quad','5G · S Pen'),IP('galaxy s23 ultra','','6.8" Dynamic AMOLED 2X (120Hz)','200MP quad','5G · S Pen'),
    IP('galaxy s22 ultra','','6.8" Dynamic AMOLED 2X (120Hz)','108MP quad','5G · S Pen'),IP('galaxy s21 ultra','','6.8" Dynamic AMOLED 2X (120Hz)','108MP quad','5G · S Pen'),IP('galaxy s20 ultra','','6.9" Dynamic AMOLED 2X (120Hz)','108MP quad','5G')
  ];
  const nk=s=>' '+String(s||'').toLowerCase().replace(/^(apple|samsung)\s+/,'').replace(/[^a-z0-9+]+/g,' ').trim()+' ';
  function lookup(p){
    const s=nk(p.modelName||'')+nk(p.name||'');
    for(const k of KNOWN){if(s.indexOf(' '+k.k+' ')>-1)return k}
    return null;
  }
  const isPhoneCat=p=>/mobile/.test(String(p.category||''))&&!/spare/.test(String(p.category||''));

  function generate(p){
    const brand=(p.brand||'').trim(),model=(p.modelName||'').trim();
    const nm=(p.name&&p.name!=='New Product'?p.name:'').trim();
    const title=nm||[brand,model].filter(Boolean).join(' ');
    if(!title)return null;
    const k=lookup(p),specs=[],bits=[];
    if(k){
      if(k.disp)specs.push(k.disp);
      if(k.chip)specs.push(k.chip);
      if(k.cam)specs.push(k.cam+' rear camera');
      if(k.extra)specs.push(k.extra);
    }
    if(p.storage)specs.push(p.storage+(/rom|ssd|storage/i.test(p.storage)?'':' storage'));
    if(p.ram)specs.push(p.ram+(/ram/i.test(p.ram)?'':' RAM'));
    if(!k&&isPhoneCat(p))specs.push(/apple/i.test(brand+title)?'iOS':'Android');
    const warr=p.condition&&p.condition!=='new'?'Shop warranty':'Manufacturer warranty';
    specs.push(warr);
    if(k&&k.disp)bits.push(k.disp+' display');
    if(k&&k.chip)bits.push('powered by '+k.chip);
    if(k&&k.cam)bits.push(k.cam+' camera');
    const desc=title+(bits.length?' — '+bits.join(', ')+'.':' from '+(brand||'a trusted brand')+'.')+' Available at SM Mobile Deals, Coimbatore with '+warr.toLowerCase()+', next-day delivery inside Coimbatore district and Cash on Delivery.';
    return{desc,specs,title,model:model||(nm&&brand&&nm.toLowerCase().indexOf(brand.toLowerCase())===0?nm.slice(brand.length).trim():'')};
  }

  /* ---------- admin product form wiring ---------- */
  const KEY='smd_ai_fill';
  const enabled=()=>{try{return localStorage.getItem(KEY)!=='off'}catch(e){return true}};
  let undoSnap=null;
  function snack(msg,btn,fn){
    const o=document.getElementById('ms-snack');if(o)o.remove();
    const d=document.createElement('div');d.id='ms-snack';
    d.style.cssText='position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:100001;background:#111;color:#fff;padding:12px 16px;border-radius:12px;display:flex;gap:14px;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.4);max-width:92vw;font-size:14px';
    d.innerHTML='<span>'+msg+'</span>'+(btn?'<button type="button" style="background:#fff;color:#111;border:0;border-radius:8px;padding:6px 12px;font-weight:700;cursor:pointer">'+btn+'</button>':'');
    if(btn)d.querySelector('button').onclick=()=>{d.remove();fn()};
    document.body.appendChild(d);setTimeout(()=>d.remove(),20000);
  }
  function wireAdmin(){
    const f=document.getElementById('product-form');
    if(!f||f.dataset.msOn)return;f.dataset.msOn='1';
    const set=(n,v)=>{const x=f.elements[n];if(x)x.value=v};
    const get=n=>(f.elements[n]&&f.elements[n].value||'').trim();
    const fill=m=>{
      set('brand',m.brand);
      set('modelName',m.name.replace(/^Galaxy /,'Galaxy '));
      const nm=get('name');
      if(!nm||nm==='New Product'||nm===undoSnap?.lastAuto||true)set('name',m.full);
    };
    attachInput(document.getElementById('pm-name'),fill);
    attachInput(document.getElementById('pm-model-name'),fill);
    attachInput(document.getElementById('pm-brand'),m=>{set('brand',m.brand)});
    /* access switch */
    const row=document.createElement('label');
    row.style.cssText='display:flex;gap:8px;align-items:flex-start;font-size:13px;margin:0 0 12px;padding:10px 12px;border:1px dashed var(--border-soft,#bbb);border-radius:10px;cursor:pointer';
    row.innerHTML='<input type="checkbox" id="pm-ai-fill" style="margin-top:3px"><span><b>🤖 Chatbot auto-fill</b> — brand / model mattum type panni Save panna, empty-ah irukkura <i>Description</i> and <i>Specs</i>-ai chatbot automatic-ah fill pannum. Save aana piragu <b>Undo</b> button varum.</span>';
    const first=f.querySelector('.field');if(first)f.insertBefore(row,first);
    const cb=row.querySelector('input');cb.checked=enabled();
    cb.addEventListener('change',()=>{try{localStorage.setItem(KEY,cb.checked?'on':'off')}catch(e){}});
    /* run BEFORE the page's own submit handler (capture) so the filled values get saved */
    f.addEventListener('submit',()=>{
      undoSnap=null;
      if(!enabled())return;
      const id=get('id');
      const p={name:get('name'),brand:get('brand'),modelName:get('modelName'),category:get('category'),storage:get('storage'),ram:get('ram'),condition:get('condition')};
      const g=generate(p);if(!g)return;
      const snap={id,name:get('name'),modelName:get('modelName'),desc:get('desc'),specs:get('specs'),changed:[]};
      if(!get('desc')){set('desc',g.desc);snap.changed.push('desc')}
      if(!get('specs')&&g.specs.length>1){set('specs',g.specs.join('\n'));snap.changed.push('specs')}
      if(!get('modelName')&&g.model){set('modelName',g.model);snap.changed.push('modelName')}
      if((get('name')===''||get('name')==='New Product')&&g.title&&g.title!=='New Product'){set('name',g.title);snap.changed.push('name')}
      if(snap.changed.length)undoSnap=snap;
    },true);
    f.addEventListener('submit',()=>{
      const s=undoSnap;if(!s)return;
      setTimeout(()=>snack('🤖 Chatbot '+s.changed.map(c=>({desc:'description',specs:'specifications',modelName:'model',name:'name'}[c])).join(' + ')+' auto-fill pannidhu.','Undo',async()=>{
        const p=DB.getProduct(s.id);if(!p)return;
        if(s.changed.includes('desc'))p.desc=s.desc;
        if(s.changed.includes('specs'))p.specs=s.specs?s.specs.split('\n').filter(Boolean):[];
        if(s.changed.includes('modelName'))p.modelName=s.modelName;
        if(s.changed.includes('name'))p.name=s.name||'New Product';
        await DB.saveProduct(p);
        try{Notify.toast('Undo done — chatbot changes removed','success')}catch(e){}
        setTimeout(()=>location.reload(),700);
      }),900);
    },false);
  }

  function boot(){
    attachText(document.querySelector('textarea[name="issue"]'));
    attachText(document.querySelector('#contact-form textarea[name="message"]'));
    wireAdmin();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  return{search,generate,MODELS};
})();
