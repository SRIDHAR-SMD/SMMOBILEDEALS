/*
 * Fog fix for the existing SM Assistant widget.
 * Add before </body> in the admin dashboard html:
 *   <script src="chatbot-fog-fix.js"></script>
 */
(function () {
  const s = (el, o) => Object.entries(o).forEach(([k, v]) => el.style.setProperty(k, v, 'important'));
  setInterval(() => {
    document.querySelectorAll('button').forEach(b => {
      const t = b.textContent.trim();
      const isAdminTab = /Talk to Admin$/.test(t), isAiTab = /AI Assistant$/.test(t);
      if (!isAdminTab && !isAiTab) return;
      let strip = b.parentElement;
      while (strip && !/udane answer/.test(strip.textContent)) strip = strip.parentElement;
      if (strip) strip.querySelectorAll('*').forEach(el => {
        if (el.tagName !== 'BUTTON' && !el.closest('button'))
          s(el, { color: '#1f2937', opacity: '1', filter: 'none', 'mix-blend-mode': 'normal' });
      });
      s(b, {
        opacity: '1', filter: 'none', 'font-weight': '700',
        color: isAiTab ? '#fff' : '#111827',
        background: isAiTab ? '#2563eb' : '#fff',
        border: '1.5px solid ' + (isAiTab ? '#1d4ed8' : '#6b7280')
      });
      b.querySelectorAll('*').forEach(c => s(c, { color: 'inherit', opacity: '1', filter: 'none', background: 'transparent' }));
    });
  }, 400);
})();
