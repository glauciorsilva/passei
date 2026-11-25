// ===== Passei — Riscar alternativa com gesto =====
// Nas telas de questões, arrastar uma alternativa para o lado (dedo ou mouse) risca a alternativa
// com uma linha vermelha no meio: marca as que você já leu e tem certeza de que não são a resposta.
// Arrastar de novo desfaz. O gesto não responde a questão; tocar normalmente continua respondendo.
(function(){
  const LIMIAR = 40; // px na horizontal para contar como arraste

  const style = document.createElement("style");
  style.textContent = `
    .alt-btn{position:relative;touch-action:pan-y;-webkit-user-select:none;user-select:none}
    .alt-btn.riscada{opacity:.55}
    .alt-btn.riscada::after{content:"";position:absolute;left:10px;right:10px;top:50%;height:2.5px;margin-top:-1px;background:var(--danger);border-radius:2px;transform-origin:left;animation:riscar .18s ease-out}
    @keyframes riscar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @media (prefers-reduced-motion:reduce){.alt-btn.riscada::after{animation:none}}
    .alternatives::before{content:"Dica: arraste uma alternativa para o lado para riscá-la";font-size:12px;color:var(--muted)}
  `;
  document.head.appendChild(style);

  let ini = null;          // { btn, x, y, id }
  let ignorarCliqueAte = 0; // após um arraste, o clique que o navegador dispara não pode responder a questão

  document.addEventListener("pointerdown", e=>{
    const btn = e.target.closest && e.target.closest(".alt-btn");
    if(!btn || (e.pointerType === "mouse" && e.button !== 0)) { ini = null; return; }
    ini = { btn, x: e.clientX, y: e.clientY, id: e.pointerId, feito: false };
  }, true);

  document.addEventListener("pointermove", e=>{
    if(!ini || ini.feito || e.pointerId !== ini.id) return;
    const dx = e.clientX - ini.x, dy = e.clientY - ini.y;
    if(Math.abs(dx) >= LIMIAR && Math.abs(dx) > Math.abs(dy) * 1.5){
      ini.feito = true;
      ini.btn.classList.toggle("riscada");
      ini.btn.setAttribute("aria-description", ini.btn.classList.contains("riscada") ? "riscada" : "");
      ignorarCliqueAte = Date.now() + 600;
      if(navigator.vibrate) try{ navigator.vibrate(15); }catch(_){}
    }
  }, true);

  const fim = ()=>{ if(ini && ini.feito) ignorarCliqueAte = Date.now() + 600; ini = null; };
  document.addEventListener("pointerup", fim, true);
  document.addEventListener("pointercancel", fim, true);

  document.addEventListener("click", e=>{
    if(Date.now() < ignorarCliqueAte && e.target.closest && e.target.closest(".alt-btn")){
      e.preventDefault(); e.stopImmediatePropagation(); ignorarCliqueAte = 0;
    }
  }, true);
})();
