// ===== Passei — pausas.js =====
// Temporizador de foco com alerta de pausa na tela (Pomodoro e variações).
// Dispara no document os eventos "passei:pausa-inicio" e "passei:pausa-fim",
// que o app.js usa para congelar o cronômetro do simulado durante a pausa.
(function(){
  const KEY = "passei_pausas_v1";
  const MIN = 60 * 1000;

  // Métodos de estudo por tempo. Pomodoro: 25 min de foco, 5 de pausa e uma pausa
  // longa de 15 min a cada 4 ciclos. Blocos longos: 50/10, para quem entra em ritmo
  // mais devagar e prefere interromper menos.
  const METODOS = {
    pomodoro: { nome: "Pomodoro 25/5", foco: 25, pausa: 5, longa: 15, cadaLonga: 4 },
    blocos:   { nome: "Blocos 50/10",  foco: 50, pausa: 10, longa: 20, cadaLonga: 3 },
    off:      { nome: "Desligado" }
  };

  const DICAS = [
    "Levante e alongue pescoço, ombros e costas.",
    "Olhe para algo a uns 6 metros de distância por 20 segundos.",
    "Beba água.",
    "Evite o celular: redes sociais não descansam o cérebro.",
    "Respire fundo algumas vezes, devagar."
  ];

  let estado = carregar();   // { metodo, fase: "foco"|"pausa"|"aguardando-pausa"|"aguardando-foco", fimEm, restanteMs, ciclos, parado }
  let tick = null;
  let overlayTipo = null;    // qual tela do overlay está visível

  function carregar(){
    try{
      const e = JSON.parse(localStorage.getItem(KEY));
      if(e && METODOS[e.metodo]) return e;
    }catch(err){}
    return { metodo: "pomodoro", fase: "foco", fimEm: null, restanteMs: null, ciclos: 0, parado: false };
  }
  function salvar(){ try{ localStorage.setItem(KEY, JSON.stringify(estado)); }catch(err){} }

  const m = () => METODOS[estado.metodo];
  const fmt = ms => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  };
  const restante = () => estado.parado ? estado.restanteMs : estado.fimEm - Date.now();
  const $ = id => document.getElementById(id);

  function duracaoPausa(){
    const cfg = m();
    return (cfg.cadaLonga && estado.ciclos > 0 && estado.ciclos % cfg.cadaLonga === 0) ? cfg.longa : cfg.pausa;
  }

  function iniciarFase(fase, minutos){
    estado.fase = fase;
    estado.parado = false;
    estado.restanteMs = null;
    estado.fimEm = Date.now() + minutos * MIN;
    salvar();
    render();
  }

  // ---------- Som suave (sem arquivos externos) ----------
  function sino(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35].forEach((t, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = i ? 784 : 659;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.9);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 1);
      });
    }catch(err){}
  }

  // ---------- Overlay ----------
  function mostrarOverlay(tipo){
    const ov = $("pausa-overlay");
    const titulo = $("pausa-titulo"), texto = $("pausa-texto"), rel = $("pausa-relogio"),
          dicas = $("pausa-dicas"), btn1 = $("pausa-btn-1"), btn2 = $("pausa-btn-2");
    ov.hidden = false;
    overlayTipo = tipo;
    if(tipo === "aguardando-pausa"){
      const min = duracaoPausa();
      titulo.textContent = "Hora da pausa";
      texto.textContent = `Você completou ${m().foco} min de foco. Uma pausa de ${min} min ajuda a manter a concentração no próximo bloco.`;
      rel.textContent = fmt(min * MIN);
      dicas.hidden = false;
      btn1.textContent = "Começar pausa";
      btn2.textContent = "Mais 5 min de foco";
      btn2.hidden = false;
    }else if(tipo === "pausa"){
      titulo.textContent = "Em pausa";
      texto.textContent = "Afaste-se da tela. O cronômetro do simulado está parado.";
      dicas.hidden = false;
      btn1.textContent = "Encerrar pausa agora";
      btn2.hidden = true;
    }else if(tipo === "aguardando-foco"){
      titulo.textContent = "Pausa encerrada";
      texto.textContent = `Pronto para mais ${m().foco} min de foco?`;
      rel.textContent = fmt(m().foco * MIN);
      dicas.hidden = true;
      btn1.textContent = "Voltar a estudar";
      btn2.hidden = true;
    }
    btn1.focus();
  }
  function esconderOverlay(){ $("pausa-overlay").hidden = true; overlayTipo = null; }

  function acaoPrincipal(){
    if(estado.fase === "aguardando-pausa"){
      iniciarFase("pausa", duracaoPausa());
    }else if(estado.fase === "pausa"){
      estado.fase = "aguardando-foco"; estado.fimEm = null; salvar(); render();
    }else if(estado.fase === "aguardando-foco"){
      esconderOverlay();
      document.dispatchEvent(new Event("passei:pausa-fim"));
      iniciarFase("foco", m().foco);
    }
  }
  function acaoSecundaria(){
    if(estado.fase === "aguardando-pausa"){
      esconderOverlay();
      document.dispatchEvent(new Event("passei:pausa-fim"));
      iniciarFase("foco", 5);
    }
  }

  // ---------- Relógio ----------
  function passo(){
    if(estado.metodo === "off") return;
    if(estado.fase === "foco" || estado.fase === "pausa"){
      if(!estado.parado && restante() <= 0){
        if(estado.fase === "foco"){
          estado.ciclos += 1;
          estado.fase = "aguardando-pausa";
          document.dispatchEvent(new Event("passei:pausa-inicio"));
        }else{
          estado.fase = "aguardando-foco";
        }
        estado.fimEm = null; salvar(); sino();
      }
    }
    render();
  }

  function render(){
    const chip = $("foco-chip");
    if(!chip) return;
    if(estado.metodo === "off"){ chip.hidden = true; esconderOverlay(); return; }
    chip.hidden = false;
    chip.classList.toggle("pausa", estado.fase !== "foco");
    chip.classList.toggle("parado", !!estado.parado);
    const rotulo = estado.fase === "foco" ? "Foco" : "Pausa";
    const tempo = (estado.fase === "foco" || estado.fase === "pausa") ? fmt(restante()) : "00:00";
    $("foco-chip-texto").textContent = `${rotulo} ${tempo}${estado.parado ? " (parado)" : ""}`;
    chip.title = estado.parado ? "Retomar o temporizador" : "Parar o temporizador";

    if(estado.fase === "foco") esconderOverlay();
    else{
      if(overlayTipo !== estado.fase) mostrarOverlay(estado.fase);
      if(estado.fase === "pausa") $("pausa-relogio").textContent = fmt(restante());
    }
    document.querySelectorAll("#ritmo-opcoes button").forEach(b => b.classList.toggle("active", b.dataset.metodo === estado.metodo));
  }

  function alternarParado(){
    if(estado.fase !== "foco") return;
    if(estado.parado){ estado.fimEm = Date.now() + estado.restanteMs; estado.parado = false; }
    else{ estado.restanteMs = restante(); estado.parado = true; }
    salvar(); render();
  }

  function escolherMetodo(metodo){
    if(!METODOS[metodo]) return;
    const estavaEmPausa = estado.fase !== "foco";
    estado.metodo = metodo; estado.ciclos = 0;
    if(estavaEmPausa) document.dispatchEvent(new Event("passei:pausa-fim"));
    if(metodo === "off"){ estado.fase = "foco"; estado.fimEm = null; salvar(); render(); return; }
    iniciarFase("foco", m().foco);
  }

  // ---------- API ----------
  window.PasseiPausas = {
    iniciar(){
      $("pausa-dicas").innerHTML = DICAS.map(d => `<li>${d}</li>`).join("");
      $("pausa-btn-1").addEventListener("click", acaoPrincipal);
      $("pausa-btn-2").addEventListener("click", acaoSecundaria);
      $("foco-chip").addEventListener("click", alternarParado);
      document.querySelectorAll("#ritmo-opcoes button").forEach(b => b.addEventListener("click", () => escolherMetodo(b.dataset.metodo)));
      if(estado.metodo !== "off" && estado.fase === "foco" && !estado.parado && !estado.fimEm){
        iniciarFase("foco", m().foco);
      }
      // Se a página foi recarregada no meio de uma pausa, o simulado começa congelado
      if(estado.fase !== "foco" && estado.metodo !== "off") document.dispatchEvent(new Event("passei:pausa-inicio"));
      clearInterval(tick);
      tick = setInterval(passo, 1000);
      passo();
    },
    emPausa(){ return estado.metodo !== "off" && estado.fase !== "foco"; }
  };
})();
