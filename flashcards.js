// ===== Passei — Flashcards de conceitos =====
// Frente: o conceito. Verso: a regra/definição cobrada pela Cesgranrio.
// Escolha matéria, quais cartões (pendentes, só os errados, novos, todos) e o sentido (termo→definição, definição→termo ou misturado).
// Cartão errado vai para "Revisar" e só volta a "Sei" depois de dois acertos seguidos.
// O progresso fica no navegador, separado por usuário.
(function(){
  if(typeof FLASHCARDS === "undefined") return;

  // ---------- Utilidades (marcação sempre escapada) ----------
  class Seguro{ constructor(t){ this.t = t; } }
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]); }
  function val(v){ return v instanceof Seguro ? v.t : Array.isArray(v) ? v.map(val).join("") : (v === false || v == null) ? "" : esc(v); }
  function html(p, ...vs){ return new Seguro(p.reduce((a, s, i)=> a + s + (i < vs.length ? val(vs[i]) : ""), "")); }
  function pintar(el, s){ if(!(s instanceof Seguro)) throw new Error("pintar() aceita apenas html``"); el.replaceChildren(document.createRange().createContextualFragment(s.t)); }
  function embaralhar(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

  const CARDS = FLASHCARDS.map(c=> ({ ...c, id: c.m + "#" + c.t }));
  const MATERIAS = [...new Set(CARDS.map(c=> c.m))];

  // ---------- Estilo ----------
  const style = document.createElement("style");
  style.textContent = `
    .fc-hero{background:linear-gradient(135deg,#172b46,#1a2330);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px}
    .fc-hero h2{margin:0 0 6px}.fc-hero p{margin:0;font-size:14px}
    .fc-painel{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px}
    .fc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:12px}
    .fc-painel label{display:block;font-size:13px;color:var(--muted);margin-bottom:6px;font-weight:600}
    .fc-painel select{width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font:inherit;font-size:15px;min-height:44px}
    .fc-btn{padding:11px 18px;border-radius:8px;border:none;background:var(--accent);color:var(--accent-ink);font-weight:700;cursor:pointer;font-size:15px;min-height:44px}
    .fc-btn.sec{background:var(--card2);color:var(--text);border:1px solid var(--border)}
    .fc-btn.ok{background:var(--ok);color:var(--ok-ink)}.fc-btn.no{background:var(--danger);color:#fff}
    .fc-btn:disabled{opacity:.45;cursor:default}
    .fc-start{width:100%;margin-top:14px}
    .fc-info{font-size:13px;color:var(--muted);margin:10px 0 0}
    .fc-st{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 10px;font-size:13px;color:var(--muted);margin-top:10px}
    .fc-st b{color:var(--text);font-weight:600}
    .fc-bar{grid-column:1/-1;height:8px;background:var(--border);border-radius:4px;overflow:hidden;display:flex}
    .fc-bar i{display:block;height:100%}.fc-bar .s{background:var(--ok)}.fc-bar .r{background:var(--danger)}
    .fc-leg{font-size:12px;color:var(--muted);margin-top:10px}.fc-leg span{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 4px 0 10px}
    .fc-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;font-size:14px;color:var(--muted);margin-bottom:8px}
    .fc-prog{height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px}.fc-prog i{display:block;height:100%;background:var(--accent)}
    .fc-card{background:#fbfbf7;color:#13242e;border-radius:16px;min-height:clamp(280px,50vh,440px);padding:clamp(22px,4vw,36px);display:flex;flex-direction:column;justify-content:center;cursor:pointer;position:relative;box-shadow:0 14px 34px rgba(0,0,0,.35);user-select:none}
    .fc-card:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    .fc-card .tag{position:absolute;top:12px;left:16px;font-size:12px;color:#5b6b75}
    .fc-card .lado{position:absolute;top:12px;right:16px;font-size:12px;font-weight:700;color:#b3366a}
    .fc-card .q{font-size:clamp(21px,4vw,30px);line-height:1.22;font-weight:700;text-align:center;text-wrap:balance}
    .fc-card ul{margin:0;padding-left:1.1em;font-size:clamp(15px,2.5vw,18px);line-height:1.5}.fc-card li{margin:5px 0}
    .fc-card .dica{position:absolute;bottom:10px;left:0;right:0;text-align:center;font-size:12px;color:#7b8a93}
    .fc-card.vira{animation:fcvira .26s ease}
    @keyframes fcvira{from{transform:rotateY(70deg);opacity:.3}to{transform:none;opacity:1}}
    @media (prefers-reduced-motion:reduce){.fc-card.vira{animation:none}}
    .fc-resp{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}.fc-resp .fc-btn{min-height:54px;font-size:16px}
    .fc-teclas{font-size:12px;color:var(--muted);text-align:center;margin-top:10px}
    .fc-fim{text-align:center}.fc-fim .pct{font-size:clamp(44px,9vw,64px);font-weight:800;color:var(--ok);line-height:1;margin:8px 0}
    .fc-acoes{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:14px}
  `;
  document.head.appendChild(style);

  // ---------- Navegação ----------
  const ref = document.querySelector('.nav-btn[data-view="plano"]') || document.querySelector('.nav-btn[data-view="home"]');
  const navBtn = document.createElement("button");
  navBtn.type = "button"; navBtn.className = "nav-btn"; navBtn.dataset.view = "flashcards"; navBtn.textContent = "Flashcards";
  ref.insertAdjacentElement("afterend", navBtn);

  const view = document.createElement("main");
  view.id = "view-flashcards"; view.className = "view"; view.hidden = true;
  document.getElementById("app").appendChild(view);

  const showViewAnterior = window.showView;
  window.showView = function(nome){ view.hidden = true; showViewAnterior(nome); };
  document.querySelectorAll('.nav-btn[data-view]:not([data-view="flashcards"])').forEach(b=> b.addEventListener("click", ()=>{ view.hidden = true; }));
  navBtn.addEventListener("click", abrir);

  // ---------- Progresso (por usuário) ----------
  let chave = "passei_flash_v1_anon", P = {};
  async function carregar(){
    try{ const { data } = await sb.auth.getUser(); if(data.user) chave = "passei_flash_v1_" + data.user.id; }catch(e){}
    try{ P = JSON.parse(localStorage.getItem(chave) || "{}") || {}; }catch(e){ P = {}; }
  }
  function salvar(){ try{ localStorage.setItem(chave, JSON.stringify(P)); }catch(e){} }
  const st = c=> (P[c.id] && P[c.id].s) || "novo";
  let pref = { mat:"*", quais:"pend", dir:"td" };
  try{ pref = { ...pref, ...JSON.parse(localStorage.getItem("passei_flash_pref") || "{}") }; }catch(e){}
  function salvarPref(){ try{ localStorage.setItem("passei_flash_pref", JSON.stringify(pref)); }catch(e){} }

  async function abrir(){
    document.querySelectorAll(".view").forEach(v=> v.hidden = true);
    view.hidden = false;
    document.querySelectorAll(".nav-btn[data-view]").forEach(b=> b.classList.toggle("active", b.dataset.view === "flashcards"));
    window.scrollTo(0,0);
    await carregar();
    telaInicio();
  }

  // ---------- Tela inicial ----------
  function filtrar(){
    return CARDS.filter(c=> (pref.mat === "*" || c.m === pref.mat) && (
      pref.quais === "todos" || (pref.quais === "pend" && st(c) !== "sei") || (pref.quais === "rev" && st(c) === "rev") || (pref.quais === "novo" && st(c) === "novo")));
  }
  function telaInicio(){
    const opt = (v, t, sel)=> html`<option value="${v}"${sel === v ? new Seguro(" selected") : ""}>${t}</option>`;
    pintar(view, html`
      <div class="fc-hero"><h2>Flashcards de conceitos</h2><p class="muted">${CARDS.length} cartões com as regras que a Cesgranrio cobra. Vire o cartão, diga se acertou e o sistema separa o que você precisa revisar.</p></div>
      <div class="fc-painel">
        <div class="fc-grid">
          <div><label for="fc-mat">Matéria</label><select id="fc-mat">${opt("*", "Todas as matérias (misturado)", pref.mat)}${MATERIAS.map(m=> opt(m, m + " (" + CARDS.filter(c=> c.m === m).length + ")", pref.mat))}</select></div>
          <div><label for="fc-quais">Quais cartões</label><select id="fc-quais">${opt("pend","Não sei ainda (novos + revisar)",pref.quais)}${opt("rev","Só os que errei",pref.quais)}${opt("novo","Só os que nunca vi",pref.quais)}${opt("todos","Todos",pref.quais)}</select></div>
          <div><label for="fc-dir">Mostrar primeiro</label><select id="fc-dir">${opt("td","Termo → definição",pref.dir)}${opt("dt","Definição → termo",pref.dir)}${opt("mix","Misturado (ida e volta)",pref.dir)}</select></div>
        </div>
        <button class="fc-btn fc-start" id="fc-go">Começar</button>
        <p class="fc-info" id="fc-info"></p>
      </div>
      <div class="fc-painel">
        <label>Seu progresso por matéria</label>
        ${MATERIAS.map(m=>{ const cs = CARDS.filter(c=> c.m === m); const s = cs.filter(c=> st(c) === "sei").length, r = cs.filter(c=> st(c) === "rev").length;
          return html`<div class="fc-st"><b>${m}</b><span>${s}/${cs.length} sei · ${r} revisar</span><div class="fc-bar"><i class="s" style="width:${(s/cs.length*100).toFixed(1)}%"></i><i class="r" style="width:${(r/cs.length*100).toFixed(1)}%"></i></div></div>`; })}
        <p class="fc-leg"><span style="background:var(--ok)"></span>Sei<span style="background:var(--danger)"></span>Revisar<span style="background:var(--border)"></span>Não visto</p>
        <button class="fc-btn sec" id="fc-zerar">Zerar progresso</button>
      </div>`);
    const info = ()=>{ const n = filtrar().length; view.querySelector("#fc-info").textContent = n ? n + " cartões nesta rodada." : "Nenhum cartão com esse filtro. Escolha outra opção."; view.querySelector("#fc-go").disabled = !n; };
    [["fc-mat","mat"],["fc-quais","quais"],["fc-dir","dir"]].forEach(([id,k])=> view.querySelector("#"+id).addEventListener("change", e=>{ pref[k] = e.target.value; salvarPref(); info(); }));
    view.querySelector("#fc-go").addEventListener("click", ()=>{ const l = filtrar(); if(l.length) iniciar(l); });
    let conf = false; const bz = view.querySelector("#fc-zerar");
    bz.addEventListener("click", ()=>{ if(!conf){ conf = true; bz.textContent = "Toque de novo para confirmar"; setTimeout(()=>{ conf = false; bz.textContent = "Zerar progresso"; }, 4000); return; } P = {}; salvar(); telaInicio(); });
    info();
  }

  // ---------- Sessão ----------
  let fila = [], i = 0, virado = false, acertos = 0, errados = [];
  function iniciar(lista){
    fila = embaralhar(lista).map(c=> ({ c, inv: pref.dir === "dt" || (pref.dir === "mix" && Math.random() < .5) }));
    i = 0; acertos = 0; errados = [];
    pintar(view, html`
      <div class="fc-top"><span id="fc-pos"></span><button class="fc-btn sec" id="fc-sair">Encerrar</button></div>
      <div class="fc-prog"><i id="fc-pb"></i></div>
      <div class="fc-card" id="fc-card" tabindex="0" role="button" aria-label="Virar cartão"></div>
      <div class="fc-resp"><button class="fc-btn no" id="fc-err" disabled>Errei</button><button class="fc-btn ok" id="fc-ok" disabled>Acertei</button></div>
      <p class="fc-teclas">Toque no cartão para virar. No computador: espaço vira, 1 = errei, 2 = acertei.</p>`);
    view.querySelector("#fc-card").addEventListener("click", virar);
    view.querySelector("#fc-err").addEventListener("click", ()=> responder(false));
    view.querySelector("#fc-ok").addEventListener("click", ()=> responder(true));
    view.querySelector("#fc-sair").addEventListener("click", telaInicio);
    mostrar(); window.scrollTo(0,0);
  }
  function face(lado){
    const { c, inv } = fila[i]; const termo = (lado === "frente") !== inv;
    const corpo = termo ? html`<div class="q">${c.t}</div>` : html`<ul>${c.d.split(" • ").map(p=> html`<li>${p}</li>`)}</ul>`;
    const dica = lado === "frente" ? (inv ? "Qual é o conceito? Toque para ver" : "O que é? Toque para ver") : "Toque para voltar";
    return html`<span class="tag">${c.m}</span><span class="lado">${lado === "frente" ? "Pergunta" : "Resposta"}</span>${corpo}<span class="dica">${dica}</span>`;
  }
  function mostrar(){
    virado = false; const card = view.querySelector("#fc-card");
    pintar(card, face("frente")); card.classList.remove("vira");
    view.querySelector("#fc-err").disabled = view.querySelector("#fc-ok").disabled = true;
    view.querySelector("#fc-pos").textContent = "Cartão " + (i+1) + " de " + fila.length + " · " + acertos + " acertos";
    view.querySelector("#fc-pb").style.width = (i / fila.length * 100) + "%";
  }
  function virar(){
    const card = view.querySelector("#fc-card"); if(!card) return;
    virado = !virado; pintar(card, face(virado ? "verso" : "frente"));
    card.classList.remove("vira"); void card.offsetWidth; card.classList.add("vira");
    if(virado) view.querySelector("#fc-err").disabled = view.querySelector("#fc-ok").disabled = false;
  }
  function responder(ok){
    if(!virado) return;
    const c = fila[i].c; const r = P[c.id] || { s:"novo", a:0, e:0 };
    if(ok){
      r.a++; acertos++;
      if(r.s === "rev" && !r.ok1){ r.ok1 = true; } else { r.s = "sei"; delete r.ok1; }
    } else { r.e++; r.s = "rev"; r.ok1 = false; errados.push(c); }
    P[c.id] = r; salvar(); i++;
    if(i < fila.length) mostrar(); else fim();
  }
  function fim(){
    const pct = Math.round(acertos / fila.length * 100);
    pintar(view, html`
      <div class="fc-painel fc-fim">
        <p class="muted">Rodada concluída</p>
        <div class="pct">${pct}%</div>
        <h3>${acertos} de ${fila.length} acertos</h3>
        <p class="muted">${errados.length ? errados.length + " cartões foram para a pilha de revisão. Um cartão errado só sai dela depois de dois acertos seguidos." : "Nenhum erro nesta rodada."}</p>
        <div class="fc-acoes">${errados.length ? html`<button class="fc-btn" id="fc-ref">Refazer os que errei</button>` : ""}<button class="fc-btn sec" id="fc-volta">Voltar ao início</button></div>
      </div>`);
    const ref = view.querySelector("#fc-ref"); if(ref) ref.addEventListener("click", ()=> iniciar(errados.slice()));
    view.querySelector("#fc-volta").addEventListener("click", telaInicio);
  }
  document.addEventListener("keydown", e=>{
    if(view.hidden || !view.querySelector("#fc-card") || /SELECT|TEXTAREA|INPUT/.test(e.target.tagName)) return;
    if(e.code === "Space" || e.key === "Enter"){ e.preventDefault(); virar(); }
    else if(e.key === "1") responder(false); else if(e.key === "2") responder(true);
  });
})();
