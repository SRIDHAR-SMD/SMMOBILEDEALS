/* Scroll guard — stops the page from jumping/blinking on its own (embedded reels, late-loading images, hero swaps).
   Real user scrolling (wheel, touch, keys, scrollbar drag, clicks) is always allowed; any other sudden jump is undone. */
(function(){
  if (window.__smdScrollGuard) return; window.__smdScrollGuard = true;
  var lastInput = 0, y = window.pageYOffset || 0, restoring = false;
  function mark(){ lastInput = Date.now(); }
  ['wheel','touchstart','touchmove','keydown','pointerdown','mousedown'].forEach(function(ev){ window.addEventListener(ev, mark, { passive:true, capture:true }); });
  window.addEventListener('hashchange', mark);
  window.addEventListener('scroll', function(){
    if (restoring) return;
    var now = window.pageYOffset || 0;
    if (Date.now() - lastInput < 1200 || Math.abs(now - y) < 4 || document.hidden){ y = now; return; }
    if (Math.abs(now - y) > 40){ restoring = true; window.scrollTo(0, y); setTimeout(function(){ restoring = false; }, 60); return; }
    y = now;
  }, { passive:true });
})();
