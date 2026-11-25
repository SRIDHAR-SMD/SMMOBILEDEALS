const ImageViewer=(()=>{let t=null;function s(){const a=document.getElementById("iv-overlay");a&&a.remove(),document.removeEventListener("keydown",c),t=null}function c(a){a.key==="Escape"&&s()}function n(){const a=document.getElementById("iv-img");!a||!t||(a.style.transform=`translate(${t.panX}px, ${t.panY}px) scale(${t.zoom}) rotate(${t.rotate}deg)`,a.style.filter=`brightness(${t.brightness}%) contrast(${t.contrast}%)`,document.getElementById("iv-zoom-label").textContent=Math.round(t.zoom*100)+"%")}function p(a,l){if(!a)return;s(),t={zoom:1,panX:0,panY:0,rotate:0,brightness:100,contrast:100};const o=document.createElement("div");o.id="iv-overlay",o.innerHTML=`
      <div class="iv-toolbar">
        <span class="iv-title">${l?Utils.escapeHtml(l):"Payment Screenshot"}</span>
        <div class="iv-controls">
          <button data-iv="zoom-out" title="Zoom out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
          <span id="iv-zoom-label">100%</span>
          <button data-iv="zoom-in" title="Zoom in"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
          <button data-iv="rotate-left" title="Rotate left"><i class="fa-solid fa-rotate-left"></i></button>
          <button data-iv="rotate-right" title="Rotate right"><i class="fa-solid fa-rotate-right"></i></button>
          <label class="iv-slider-label">Brightness <input type="range" id="iv-brightness" min="40" max="180" value="100"></label>
          <label class="iv-slider-label">Contrast <input type="range" id="iv-contrast" min="40" max="180" value="100"></label>
          <button data-iv="reset" title="Reset"><i class="fa-solid fa-arrows-rotate"></i></button>
          <a href="${a}" download target="_blank" rel="noopener" title="Download original"><i class="fa-solid fa-download"></i></a>
          <button data-iv="close" title="Close (Esc)"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </div>
      <div class="iv-canvas" id="iv-canvas">
        <img id="iv-img" src="${a}" alt="${l?Utils.escapeHtml(l):"Payment screenshot"}" draggable="false">
      </div>
      <p class="iv-hint">Scroll to zoom \xB7 drag to pan when zoomed \xB7 Esc to close</p>`,document.body.appendChild(o),document.addEventListener("keydown",c);const m=document.getElementById("iv-canvas"),r=document.getElementById("iv-img");o.querySelectorAll("[data-iv]").forEach(e=>{e.addEventListener("click",()=>{const i=e.dataset.iv;if(i==="zoom-in"&&(t.zoom=Math.min(6,t.zoom+.3)),i==="zoom-out"&&(t.zoom=Math.max(.3,t.zoom-.3)),i==="rotate-left"&&(t.rotate-=90),i==="rotate-right"&&(t.rotate+=90),i==="reset"&&(t={zoom:1,panX:0,panY:0,rotate:0,brightness:100,contrast:100},document.getElementById("iv-brightness").value=100,document.getElementById("iv-contrast").value=100),i==="close"){s();return}n()})}),document.getElementById("iv-brightness").addEventListener("input",e=>{t.brightness=e.target.value,n()}),document.getElementById("iv-contrast").addEventListener("input",e=>{t.contrast=e.target.value,n()}),m.addEventListener("wheel",e=>{e.preventDefault(),t.zoom=Math.max(.3,Math.min(6,t.zoom+(e.deltaY<0?.15:-.15))),n()},{passive:!1}),o.addEventListener("click",e=>{(e.target===o||e.target===m)&&s()});let d=!1,v=0,u=0,g=0,f=0;r.addEventListener("mousedown",e=>{t.zoom<=1||(d=!0,v=e.clientX,u=e.clientY,g=t.panX,f=t.panY,r.style.cursor="grabbing",e.preventDefault())}),window.addEventListener("mousemove",e=>{!d||!t||(t.panX=g+(e.clientX-v),t.panY=f+(e.clientY-u),n())}),window.addEventListener("mouseup",()=>{d=!1,r&&(r.style.cursor=t&&t.zoom>1?"grab":"default")}),n()}return{open:p,close:s}})();
