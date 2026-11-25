/* Auto Specs — every product (new upload, old product, any category) gets a full
   specification table automatically. Nothing to type in admin: anything missing is
   worked out from the name, brand, category and the chips already entered, with a
   known-model lookup for phones/laptops. Entered values always win. */
const AutoSpecs=(()=>{
  const T=p=>[p.name,p.brand,p.modelName,p.storage,p.ram,p.variant,...(p.specs||[]),...(p.features||[])].filter(Boolean).join(' | ');
  const cat=p=>String(p.category||'').toLowerCase();
  const isPhone=p=>/mobile/.test(cat(p))&&!/spare/.test(cat(p));
  const isLaptop=p=>/laptop/.test(cat(p))&&!/spare/.test(cat(p));
  const isWatch=p=>/watch/.test(cat(p));
  const isAudio=p=>/earbud|audio|headphone/.test(cat(p));
  const isSpare=p=>/spare/.test(cat(p));
  const m=(t,re)=>{const x=t.match(re);return x?x[0].trim():''};
  function known(p){try{return (typeof SecondHandSpecs!=='undefined'&&SecondHandSpecs&&(SecondHandSpecs.PHONES[p.brand+'|'+p.name]||SecondHandSpecs.LAPTOPS[p.brand+'|'+p.name]))||null}catch(e){return null}}
  function rows(p){
    if(!p)return[];
    const t=T(p),b=p.brand||'',out=[],add=(k,v)=>{if(v&&!out.some(r=>r[0]===k))out.push([k,String(v)])};
    const kn=known(p)||[];
    const all=t+' | '+kn.join(' | ');
    add('Brand',b);
    add('Model',p.modelName||p.name);
    add('Category',(p.category||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
    if(p.condition&&p.condition!=='new')add('Condition',String(p.condition).replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()));
    if(isPhone(p)||isLaptop(p)||isWatch(p)){
      add('Processor',m(all,/Apple M\d\w*( (Pro|Max|Ultra))?|\bA\d{2}( Pro| Bionic)?\b|Snapdragon [\w+ ]+?(?= \||$|,)|Exynos \d+|Dimensity \d+\w*|Helio \w+|Tensor \w*|Core (Ultra )?i[3579][-\w ]*|Ryzen [3579] \w+|Intel \w+ \w+|\bM\d (Chip|Pro|Max)\b/i).replace(/ Chip$/i,''));
      add('RAM',p.ram||m(all,/\d+ ?GB RAM/i).replace(/ RAM/i,''));
      add('Storage',p.storage||m(all,/\d+ ?(GB|TB) ?(SSD|NVMe|HDD|ROM|UFS)\b/i)||m(all,/\b(64|128|256|512)\s?GB\b(?! RAM)/i)||m(all,/\b[1-4] ?TB\b/i));
      add('Display',m(all,/\d{1,2}(\.\d+)?"[^|,]*/));
    }
    if(isPhone(p)){
      add('Rear camera',m(all,/\d+MP ?(Single|Dual|Triple|Quad)?/i));
      add('Battery',m(all,/\d{4,5} ?mAh/i));
      add('Operating system',/apple/i.test(b)?'iOS':'Android');
      add('Network',/5g/i.test(all)?'5G / 4G LTE':/iphone (1[2-9]|se \(20(22|2\d)\))|galaxy (s2|s3|z)|pro|ultra/i.test(p.name||'')?'5G / 4G LTE':'4G LTE');
      add('SIM','Dual SIM (Nano + eSIM / Nano)');
    }
    if(isLaptop(p)){
      add('Graphics',m(all,/RTX \w+( Ti)?|GTX \w+|RX \w+|Radeon[\w ]*|Iris Xe|Integrated graphics/i));
      add('Operating system',/apple|macbook/i.test(b+' '+p.name)?'macOS':'Windows 11');
      add('Battery','Up to 8–12 hours (typical use)');
      add('Ports','USB-C / USB-A, HDMI, headphone jack');
      add('Connectivity','Wi-Fi 6, Bluetooth 5.x');
    }
    if(isWatch(p)){
      add('Operating system',/apple/i.test(b)?'watchOS':/samsung|google|fossil/i.test(b)?'Wear OS':'Custom OS');
      add('Connectivity','Bluetooth 5.x');
      add('Battery',m(all,/\d{2,4} ?mAh/i)||'1–2 days (typical use)');
      add('Water resistance',m(all,/IP\d{2}|\d ?ATM|WR\d+/i)||'Splash / sweat resistant');
      add('Sensors','Heart rate, SpO2, accelerometer');
    }
    if(isAudio(p)){
      add('Type',/buds|earbud|airpod|tws/i.test(t)?'True wireless earbuds':/head ?phone|over|on-ear/i.test(t)?'Headphones':'Audio');
      add('Connectivity','Bluetooth 5.x');
      add('Battery life',m(all,/\d+ ?(h|hrs|hours)[^|,]*/i)||'Up to 6 hrs (case adds more)');
      add('Noise control',/anc|noise/i.test(all)?'Active noise cancellation':'');
    }
    if(isSpare(p)){add('Type','Replacement part');add('Compatibility',p.modelName||m(t,/for [^|,]+/i)||'See product name');add('Quality',p.quality||'Tested before dispatch')}
    if(!isPhone(p)&&!isLaptop(p)&&!isWatch(p)&&!isAudio(p)&&!isSpare(p)){add('Type',(p.category||'Accessory').replace(/-/g,' '));add('Compatibility',m(t,/for [^|,]+/i)||'Universal')}
    add('Colour',p.colorName||(/^#/.test(p.color||'')?'':p.color));add('Variant',p.variant);
    try{if(typeof Charging!=='undefined'&&(isPhone(p)||isLaptop(p))){const c=Charging.forProduct(p);if(c){add('Charging',c.label);add('Charging port',c.port)}}}catch(e){}
    const norm=x=>String(x).toLowerCase().replace(/ram|chip|ssd|nvme|rom/g,'').replace(/\s+/g,'');
    const have=s=>out.some(r=>{const a=norm(r[1]),b=norm(s);return a&&b&&(a===b||a.indexOf(b)>-1||b.indexOf(a)>-1)});
    let hn=0;(p.specs||[]).concat(p.features||[]).forEach(s=>{if(s&&!have(s))add('Highlight '+(++hn),s)});
    (p.customFields||[]).filter(f=>f&&(f.label||f.value)).forEach(f=>{const i=out.findIndex(r=>r[0]===f.label);i>-1?out[i][1]=f.value:out.push([f.label||'Detail',f.value])});
    const wp={'7_days':'7 Days','15_days':'15 Days','30_days':'30 Days','1_year':'1 Year'};
    add('Warranty',p.warrantyPeriod?(wp[p.warrantyPeriod]||p.warrantyPeriod)+(p.warrantyType==='non_checking'?' (Non-checking)':' (Checking)'):(p.condition&&p.condition!=='new'?'Shop warranty':'Manufacturer warranty'));
    return out;
  }
  /* write the table into p.specs (as "Label: value") when the product has none */
  function fill(p){
    if(!p||(p.specs&&p.specs.length))return p;
    const skip=/^(Brand|Model|Category|Condition|Colour|Variant|Warranty|Type|Compatibility|Quality|Network|SIM|Operating system|Connectivity|Ports|Battery|Sensors|Water resistance|Noise control|Battery life)$/;
    const r=rows(p).filter(x=>!skip.test(x[0]));
    if(r.length)p.specs=r.map(x=>x[0]==='Display'||x[0]==='Processor'||x[0]==='Rear camera'||x[0]==='RAM'||x[0]==='Storage'||x[0]==='Graphics'?x[1]+(x[0]==='RAM'&&!/ram/i.test(x[1])?' RAM':''):x[1]);
    return p;
  }
  function html(p){
    const r=rows(p);if(!r.length)return'';
    const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    return `<div class="card pd-fullspecs" style="margin-top:18px;padding:18px 20px;"><h3 style="font-family:var(--font-display);font-size:17px;margin:0 0 12px;"><i class="fa-solid fa-list-check" style="color:var(--accent-2);"></i> Full specifications</h3><table style="width:100%;border-collapse:collapse;font-size:13.5px;">${r.map(x=>`<tr><td style="padding:8px 10px;border-bottom:1px solid var(--border-soft);color:var(--text-dim);width:38%;">${E(x[0])}</td><td style="padding:8px 10px;border-bottom:1px solid var(--border-soft);font-weight:600;">${E(x[1])}</td></tr>`).join('')}</table></div>`;
  }
  /* every product read anywhere (cards, compare, chatbot, admin) gets specs; every admin save stores them */
  try{if(typeof DB!=='undefined'&&DB&&DB.getProducts&&!DB.__autoSpecs){DB.__autoSpecs=1;
    const g=DB.getProducts.bind(DB);DB.getProducts=function(){const l=g.apply(null,arguments);if(Array.isArray(l))l.forEach(fill);return l};
    ['saveProduct','saveProducts'].forEach(k=>{if(!DB[k])return;const f=DB[k].bind(DB);DB[k]=function(x){Array.isArray(x)?x.forEach(fill):fill(x);return f.apply(null,arguments)}});
  }}catch(e){}
  return{rows,fill,html};
})();
