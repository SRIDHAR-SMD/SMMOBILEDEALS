/* Bill line helper — decides what each bill line shows, by product kind.
   phone/laptop : model, brand, RAM, ROM, colour, warranty, IMEI / serial, price + discount price
   watch        : brand, model, size (mm) [+ spec details for non Apple/Samsung], price + discount price
   accessory    : brand, model, warranty, price  (no RAM/ROM)                                          */
window.BillLines = (function(){
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CAT = { mobiles:'phone', 'second-hand-mobiles':'phone', laptops:'laptop', 'second-hand-laptops':'laptop', watches:'watch' };
  function kind(it, p){
    if (it && it.kind) return it.kind;
    const c = String((it && it.category) || (p && p.category) || '').toLowerCase();
    if (c) return CAT[c] || 'accessory';
    const t = String((it && it.type) || (p && p.type) || '').toLowerCase();
    return t === 'phone' ? 'phone' : t === 'laptop' ? 'laptop' : t === 'watch' ? 'watch' : 'accessory';
  }
  function sizeOf(it, p){
    if (it.size) return it.size;
    const s = ((p && p.specs) || []).find(x => /^\d{2}(\.\d)?\s?mm$/i.test(String(x).trim()));
    return s ? String(s).trim() : '';
  }
  function lines(it, p){
    const k = kind(it, p), pick = (a, b) => a || b || '';
    const brand = pick(it.brand, p && p.brand), model = pick(it.model, p && p.modelName);
    const bits = [];
    const add = (l, v) => { if (v) bits.push(l + ': ' + v); };
    const ids = [];
    if (k === 'phone' || k === 'laptop'){
      add('Model', model); add('Brand', brand);
      add('RAM', pick(it.ram, p && p.ram)); add('ROM', pick(it.storage, p && p.storage));
      add('Colour', pick(it.colorName, p && p.colorName)); add('Warranty', it.warranty);
      if (k === 'phone'){ if (it.imei) ids.push('IMEI 1: ' + it.imei); if (it.imei2) ids.push('IMEI 2: ' + it.imei2); }
      else if (it.serial) ids.push('Serial No: ' + it.serial);
    } else if (k === 'watch'){
      add('Brand', brand); add('Model', model); add('Size', sizeOf(it, p));
      if (!/apple|samsung/i.test(brand)) add('Details', pick(it.specs, ((p && p.specs) || []).filter(x => !/^\d{2}(\.\d)?\s?mm$/i.test(String(x))).slice(0, 3).join(', ')));
    } else {
      add('Brand', brand); add('Model', model); add('Warranty', it.warranty);
    }
    return { kind: k, bits, ids };
  }
  function detailHtml(it, p, st){
    st = st || {};
    const l = lines(it, p);
    return (l.bits.length ? '<div class="spec-line mb-sub" style="' + (st.sub || '') + '">' + E(l.bits.join(' · ')) + '</div>' : '') +
      l.ids.map(x => '<div class="spec-line" style="font-family:monospace;font-weight:600;color:#1a1a1a;' + (st.id || '') + '">' + E(x) + '</div>').join('');
  }
  /* returns [priceCell, discountCell] text */
  function prices(it, p, fmt){
    const k = kind(it, p), sell = Number(it.price) || 0;
    const mrp = Number(it.mrp != null && it.mrp !== '' ? it.mrp : (p && p.mrp)) || 0;
    if (k === 'accessory') return [fmt(sell), '—'];
    return mrp > sell ? [fmt(mrp), fmt(sell)] : [fmt(sell), '—'];
  }
  return { kind, lines, detailHtml, prices, E };
})();
