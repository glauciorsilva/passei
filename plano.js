// ===== Passei — Plano de estudo (blocos de 10 com trava de 90%) =====
// Regras:
// - Cada trilha (uma matéria ou "Misturado") mostra um bloco de 10 questões.
// - Bloco novo só é liberado quando o bloco atual tiver 90% de acerto (9 de 10). Abaixo disso, o mesmo bloco volta.
// - Em cada alternativa há uma aba para escrever a justificativa (por que está certa / errada).
// - A cada 30 questões respondidas no plano, entra uma Revisão de fixação misturando tudo o que já foi feito.
// Estado e justificativas ficam no navegador e sincronizam no Supabase (supabase/004_plano_estudo.sql).
(function(){
  const BLOCO = 10, META = 0.9, REVISAO_A_CADA = 30, REVISAO_QTD = 10;
  const MISTO = "__misto__";
  const LETRAS = ["A","B","C","D","E"];
  let userId = null, remoto = { estado:false, justif:false };
  let estado = null, justif = {}, sessao = null, carregado = false;
  const timersJustif = {};

  // ---------- Estilo ----------
  const style = document.createElement("style");
  style.textContent = `
    nav{flex-wrap:wrap;justify-content:flex-end}
    .pl-hero{background:linear-gradient(135deg,#172b46,#1a2330);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px}
    .pl-hero h2{margin:0 0 6px}.pl-hero p{margin:0;font-size:14px}
    .pl-regras{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
    .pl-regras span{font-size:12px;padding:4px 10px;border-radius:999px;background:var(--card2);border:1px solid var(--border);color:var(--muted)}
    .pl-contador{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px}
    .pl-contador .top{display:flex;justify-content:space-between;font-size:14px;font-weight:600;margin-bottom:8px}
    .pl-bar{height:8px;background:var(--border);border-radius:4px;overflow:hidden}.pl-bar>div{height:100%;background:var(--accent)}
    .pl-revisao{background:var(--accent-soft);border:1px solid var(--accent);border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .pl-revisao strong{display:block}
    .pl-btn{padding:10px 16px;border-radius:8px;border:none;background:var(--accent);color:var(--accent-ink);font-weight:700;cursor:pointer;font-size:14px}
    .pl-btn.sec{background:var(--card2);color:var(--text);border:1px solid var(--border)}
    .pl-trilha.misto{border-color:var(--accent)}
    .pl-trilha .st{font-size:12px;color:var(--muted);margin-top:6px}
    .pl-trilha .ok{color:var(--ok);font-weight:700}
    .pl-alt{display:flex;flex-direction:column;gap:6px}
    .pl-just{margin-left:14px}
    .pl-just-toggle{background:none;border:none;color:var(--muted);font-size:12.5px;cursor:pointer;padding:2px 0;font-weight:600}
    .pl-just-toggle:hover{color:var(--accent)}
    .pl-just-toggle .tem{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--ok);margin-left:6px;vertical-align:1px}
    .pl-just textarea{width:100%;min-height:70px;margin-top:4px;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg2);color:var(--text);font:inherit;font-size:14px;resize:vertical}
    .pl-just.certa textarea{border-color:var(--ok)}.pl-just.errada textarea{border-color:var(--danger)}
    .pl-just .salvo{font-size:11px;color:var(--muted);height:14px}
    .pl-decisao{border-radius:12px;padding:16px;margin:16px 0;border:1px solid var(--border);background:var(--card)}
    .pl-decisao.ok{border-color:var(--ok);background:var(--ok-soft)}.pl-decisao.no{border-color:var(--danger);background:var(--danger-soft)}
    .pl-decisao h3{margin:0 0 4px}
    .pl-acoes{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
    .pl-lista .question-card{margin:14px 0}
    .pl-lista .sua{font-size:13px;margin:-4px 0 10px;font-weight:600}
  `;
  document.head.appendChild(style);

  // ---------- Navegação ----------
  const homeBtn = document.querySelector('.nav-btn[data-view="home"]');
  const navBtn = document.createElement("button");
  navBtn.type = "button"; navBtn.className = "nav-btn"; navBtn.dataset.view = "plano"; navBtn.textContent = "Plano de estudo";
  homeBtn.insertAdjacentElement("afterend", navBtn);

  const view = document.createElement("main");
  view.id = "view-plano"; view.className = "view"; view.hidden = true;
  document.getElementById("app").appendChild(view);

  // As outras telas do app escondem esta
  const showViewOriginal = showView;
  window.showView = function(nome){ view.hidden = true; showViewOriginal(nome); };
  document.querySelectorAll('.nav-btn[data-view]:not([data-view="plano"])').forEach(b=> b.addEventListener("click", ()=>{ view.hidden = true; querPlano = false; }));
  navBtn.addEventListener("click", ()=>{ querPlano = true; abrirPlano(); });

  // Se o plano for aberto antes de o banco de questões terminar de carregar, espera e reabre.
  let querPlano = false, esperando = null;
  function mostrarPlano(){
    document.querySelectorAll(".view").forEach(v=> v.hidden = true);
    view.hidden = false;
    document.querySelectorAll(".nav-btn[data-view]").forEach(b=> b.classList.toggle("active", b.dataset.view === "plano"));
  }
  async function abrirPlano(){
    mostrarPlano();
    window.scrollTo(0,0);
    if(!banco().length){
      pintar(view, html`<p class="muted">Carregando as questões…</p>`);
      if(!esperando) esperando = setInterval(()=>{
        if(!banco().length) return;
        clearInterval(esperando); esperando = null;
        if(querPlano) abrirPlano();
      }, 300);
      return;
    }
    if(!carregado){ pintar(view, html`<p class="muted">Carregando seu plano…</p>`); await carregarTudo(); }
    if(!querPlano) return;
    mostrarPlano();
    if(sessao && !sessao.fim) renderQuestao(); else renderPainel();
  }

  // ---------- Utilidades ----------
  // Toda interpolação em html`` é escapada; só trechos já montados com html`` entram como marcação.
  class Seguro{ constructor(t){ this.t = t; } toString(){ return this.t; } }
  function escTexto(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]); }
  function valor(v){ return v instanceof Seguro ? v.t : Array.isArray(v) ? v.map(valor).join("") : (v === false || v == null) ? "" : escTexto(v); }
  function html(partes, ...vals){ return new Seguro(partes.reduce((acc, p, i)=> acc + p + (i < vals.length ? valor(vals[i]) : ""), "")); }
  function pintar(el, seguro){
    if(!(seguro instanceof Seguro)) throw new Error("pintar() aceita apenas html``");
    el.replaceChildren(document.createRange().createContextualFragment(seguro.t));
  }
  function embaralhar(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function banco(){ return (typeof BANCO !== "undefined" ? BANCO : []).filter(q=> q.valido); }
  function porId(){ const m = new Map(); banco().forEach(q=> m.set(q.id, q)); return m; }
  function nomeTrilha(chave){ return chave === MISTO ? "Misturado (todas as matérias)" : chave; }
  function minimo(n){ return Math.ceil(n * META - 1e-9); }
  function novoEstado(){ return { v:1, trilhas:{}, feitas:[], erros:{}, contador:0, proximaRevisao:REVISAO_A_CADA, revisaoPendente:false, revisoes:[], atualizadoEm:null }; }
  function trilha(chave){
    estado.trilhas[chave] = estado.trilhas[chave] || { bloco:1, ids:[], tentativas:0, melhor:0, historico:[] };
    return estado.trilhas[chave];
  }

  // ---------- Persistência ----------
  function chaveLocal(t){ return `passei_plano_${t}_v1_${userId || "anon"}`; }
  function lerLocal(t, padrao){ try{ const v = JSON.parse(localStorage.getItem(chaveLocal(t))); if(v) return v; }catch(e){} return padrao; }
  function gravarLocal(t, v){ try{ localStorage.setItem(chaveLocal(t), JSON.stringify(v)); }catch(e){} }

  async function carregarTudo(){
    try{ const { data } = await sb.auth.getUser(); userId = data.user && data.user.id; }catch(e){}
    estado = lerLocal("estado", null) || novoEstado();
    justif = lerLocal("justif", {});
    pendentes = new Set(lerLocal("pendentes", []));
    try{
      const { data, error } = await sb.from("passei_plano_estado").select("estado,atualizado_em").maybeSingle();
      if(error) throw error;
      remoto.estado = true;
      const remotoEstado = data && data.estado;
      if(remotoEstado && (!estado.atualizadoEm || (remotoEstado.atualizadoEm || "") > estado.atualizadoEm)){ estado = remotoEstado; gravarLocal("estado", estado); }
      else if(estado.atualizadoEm && (!remotoEstado || (remotoEstado.atualizadoEm || "") < estado.atualizadoEm)) enviarEstado(); // aparelho mais novo que a conta
    }catch(err){ console.warn("Plano de estudo em modo local:", err.message); }
    try{
      const linhas = [];
      for(let de = 0; ; de += 1000){
        const { data, error } = await sb.from("passei_justificativas").select("id,questao_id,alternativa,texto").order("id").range(de, de + 999);
        if(error) throw error;
        linhas.push(...data);
        if(data.length < 1000) break;
      }
      remoto.justif = true;
      const locais = justif; justif = {};
      linhas.forEach(r=>{ justif[`${r.questao_id}:${r.alternativa}`] = r.texto; });
      // edições feitas no aparelho e ainda não enviadas (inclusive apagadas) prevalecem sobre a conta
      pendentes.forEach(k=>{ if(locais[k]) justif[k] = locais[k]; else delete justif[k]; salvarJustifRemoto(k); });
      // justificativas antigas, só do aparelho, sobem para a conta
      Object.entries(locais).forEach(([k,t])=>{ if(t && !(k in justif) && !pendentes.has(k)){ justif[k] = t; marcarPendente(k); salvarJustifRemoto(k); } });
    }catch(err){ console.warn("Justificativas em modo local:", err.message); }
    gravarLocal("justif", justif);
    carregado = true;
  }

  // Uma gravação de cada vez: a mais recente sempre chega por último.
  let filaEstado = Promise.resolve();
  function enviarEstado(){
    if(!remoto.estado) return filaEstado;
    filaEstado = filaEstado.then(async ()=>{
      try{
        const { error } = await sb.from("passei_plano_estado").upsert({ estado, atualizado_em: estado.atualizadoEm }, { onConflict:"user_id" });
        if(error) console.warn("Falha ao sincronizar o plano (tenta de novo na próxima gravação):", error.message);
      }catch(err){ console.warn("Sem conexão para sincronizar o plano:", err.message); }
    });
    return filaEstado;
  }
  function salvarEstado(){
    estado.atualizadoEm = new Date().toISOString();
    gravarLocal("estado", estado);
    return enviarEstado();
  }

  let pendentes = new Set();
  const filaJustif = {};
  function marcarPendente(k){ pendentes.add(k); gravarLocal("pendentes", [...pendentes]); }
  function salvarJustifRemoto(k){
    if(!remoto.justif) return Promise.resolve(false);
    filaJustif[k] = (filaJustif[k] || Promise.resolve()).then(async ()=>{
      const [qid, alt] = k.split(":").map(Number);
      const texto = justif[k] || "";
      try{
        const r = texto.trim()
          ? await sb.from("passei_justificativas").upsert({ questao_id:qid, alternativa:alt, texto, atualizado_em:new Date().toISOString() }, { onConflict:"user_id,questao_id,alternativa" })
          : await sb.from("passei_justificativas").delete().eq("questao_id", qid).eq("alternativa", alt).eq("user_id", userId);
        if(r.error){ console.warn("Falha ao salvar justificativa:", r.error.message); return false; }
        if((justif[k] || "") === texto){ pendentes.delete(k); gravarLocal("pendentes", [...pendentes]); }
        return true;
      }catch(err){ console.warn("Sem conexão para salvar justificativa:", err.message); return false; }
    });
    return filaJustif[k];
  }
  function agendarJustif(k, texto, aviso){
    if(texto.trim()) justif[k] = texto; else delete justif[k];
    gravarLocal("justif", justif);
    marcarPendente(k);
    if(aviso) aviso.textContent = "Salvando…";
    clearTimeout(timersJustif[k]);
    timersJustif[k] = setTimeout(async ()=>{
      const ok = await salvarJustifRemoto(k);
      if(aviso) aviso.textContent = ok ? "✓ Salvo na sua conta" : "✓ Salvo neste aparelho (sobe para a conta depois)";
    }, 700);
  }

  // ---------- Montagem dos blocos ----------
  function montarBloco(chave){
    const pool = banco().filter(q=> chave === MISTO || q.materia === chave);
    const feitas = new Set(estado.feitas);
    const ineditas = pool.filter(q=> !feitas.has(q.id));
    let escolhidas = [];
    if(chave === MISTO){
      // distribui entre as matérias, como na prova
      const grupos = {};
      embaralhar(ineditas).forEach(q=> (grupos[q.materia] = grupos[q.materia] || []).push(q));
      const ordem = embaralhar(Object.keys(grupos));
      while(escolhidas.length < BLOCO && ordem.some(m=> grupos[m].length)){
        for(const m of ordem){ if(grupos[m].length && escolhidas.length < BLOCO) escolhidas.push(grupos[m].shift()); }
      }
    } else {
      escolhidas = embaralhar(ineditas).slice(0, BLOCO);
    }
    if(escolhidas.length < BLOCO){
      // acabaram as inéditas: completa com as que você mais errou
      const ja = new Set(escolhidas.map(q=> q.id));
      const resto = embaralhar(pool.filter(q=> !ja.has(q.id))).sort((a,b)=> (estado.erros[b.id]||0) - (estado.erros[a.id]||0));
      escolhidas = escolhidas.concat(resto.slice(0, BLOCO - escolhidas.length));
    }
    return escolhidas.map(q=> q.id);
  }

  function montarRevisao(){
    const mapa = porId();
    const feitas = estado.feitas.filter(id=> mapa.has(id));
    const comErro = embaralhar(feitas.filter(id=> estado.erros[id])).sort((a,b)=> estado.erros[b] - estado.erros[a]);
    const metade = Math.ceil(REVISAO_QTD / 2);
    const escolhidas = comErro.slice(0, metade);
    const resto = embaralhar(feitas.filter(id=> !escolhidas.includes(id)));
    return embaralhar(escolhidas.concat(resto.slice(0, REVISAO_QTD - escolhidas.length)));
  }

  // ---------- Painel ----------
  function statusTrilha(chave){
    const t = estado.trilhas[chave];
    if(!t) return html`Bloco 1 · ainda não iniciado`;
    const venc = t.historico.filter(h=> h.passou).length;
    return html`Bloco ${t.bloco}${t.tentativas ? html` · tentativa ${t.tentativas + 1} · melhor ${t.melhor}%` : ""}${venc ? html` · <span class="ok">${venc} vencido${venc > 1 ? "s" : ""}</span>` : ""}`;
  }

  function renderPainel(){
    const total = banco().length;
    if(!total){ pintar(view, html`<p class="muted">As questões ainda estão carregando. Volte em instantes.</p>`); return; }
    const materias = typeof MATERIAS !== "undefined" ? MATERIAS : [];
    const faltam = Math.max(0, estado.proximaRevisao - estado.contador);
    const feitasNoCiclo = REVISAO_A_CADA - faltam;
    const ultRev = estado.revisoes[estado.revisoes.length - 1];
    const blocoRevisao = estado.revisaoPendente ? html`
      <section class="pl-revisao">
        <div><strong>🔁 Revisão de fixação liberada</strong><span class="muted">${REVISAO_QTD} questões misturando tudo o que você já fez, com prioridade para as que você errou. Ela vem antes do próximo bloco.</span></div>
        <button class="pl-btn" id="pl-iniciar-revisao">Fazer revisão agora</button>
      </section>` : html`
      <section class="pl-contador">
        <div class="top"><span>Próxima revisão de fixação</span><span>${feitasNoCiclo}/${REVISAO_A_CADA} questões</span></div>
        <div class="pl-bar"><div style="width:${Math.round(100 * feitasNoCiclo / REVISAO_A_CADA)}%"></div></div>
        <div class="muted" style="font-size:12px;margin-top:6px">Faltam ${faltam} questões · ${estado.feitas.length} questões diferentes já feitas no plano${ultRev ? html` · última revisão: ${ultRev.acertos}/${ultRev.total}` : ""}</div>
      </section>`;
    pintar(view, html`
      <section class="pl-hero">
        <h2>Plano de estudo — Transpetro</h2>
        <p class="muted">Escolha uma matéria ou o modo misturado. Bloco novo só aparece quando você acertar 90% do bloco atual.</p>
        <div class="pl-regras"><span>10 questões por bloco</span><span>90% (9/10) libera o próximo</span><span>Justificativa em cada alternativa</span><span>Revisão de fixação a cada 30</span></div>
      </section>
      ${blocoRevisao}
      <div class="grid" id="pl-trilhas"></div>`);
    const grid = view.querySelector("#pl-trilhas");
    [MISTO, ...materias].forEach(chave=>{
      const n = chave === MISTO ? total : banco().filter(q=> q.materia === chave).length;
      if(!n) return;
      const card = document.createElement("div");
      card.className = "subject-card pl-trilha" + (chave === MISTO ? " misto" : "");
      pintar(card, html`<h4>${chave === MISTO ? "🔀 " : ""}${nomeTrilha(chave)}</h4><div class="count">${n} questões no banco</div><div class="st">${statusTrilha(chave)}</div>`);
      card.addEventListener("click", ()=> iniciar(chave));
      grid.appendChild(card);
    });
    const btnRev = view.querySelector("#pl-iniciar-revisao");
    if(btnRev) btnRev.addEventListener("click", iniciarRevisao);
  }

  // ---------- Sessão ----------
  function iniciar(chave){
    if(estado.revisaoPendente){ iniciarRevisao(); return; }
    const t = trilha(chave);
    const mapa = porId();
    t.ids = (t.ids || []).filter(id=> mapa.has(id));
    if(!t.ids.length){ t.ids = montarBloco(chave); salvarEstado(); }
    const questoes = embaralhar(t.ids).map(id=> mapa.get(id));
    sessao = { tipo:"bloco", chave, questoes, idx:0, respostas:[], inicio:Date.now(), fim:false };
    renderQuestao();
  }
  function iniciarRevisao(){
    const mapa = porId();
    const ids = montarRevisao();
    if(!ids.length){ estado.revisaoPendente = false; salvarEstado(); renderPainel(); return; }
    sessao = { tipo:"revisao", chave:"revisao", questoes: ids.map(id=> mapa.get(id)), idx:0, respostas:[], inicio:Date.now(), fim:false };
    renderQuestao();
  }

  function tituloSessao(){
    if(sessao.tipo === "revisao") return "🔁 Revisão de fixação";
    const t = estado.trilhas[sessao.chave];
    return `${nomeTrilha(sessao.chave)} · Bloco ${t.bloco}${t.tentativas ? ` (tentativa ${t.tentativas + 1})` : ""}`;
  }

  // Monta o cartão de uma questão. respondida = índice escolhido (ou null se ainda não respondeu).
  function cartaoQuestao(q, respondida, aoResponder, abrir){
    abrir = abrir || [];
    const card = document.createElement("div");
    card.className = "question-card";
    pintar(card, html`<div class="question-tag">${q.materia}${q.assunto ? " · " + q.assunto : ""}${q.origem === "ia" ? html`<span class="badge-ia">Inédita</span>` : ""}</div><p></p><div class="alternatives"></div>`);
    card.querySelector("p").textContent = q.enunciado;
    const box = card.querySelector(".alternatives");
    q.alternativas.forEach((alt, i)=>{
      const wrap = document.createElement("div");
      wrap.className = "pl-alt";
      const btn = document.createElement("button");
      btn.className = "alt-btn";
      btn.textContent = `${LETRAS[i]}) ${alt}`;
      wrap.appendChild(btn);
      const certa = i === q.corretaIndex;
      const k = `${q.id}:${i}`;
      const just = document.createElement("div");
      just.className = "pl-just " + (certa ? "certa" : "errada");
      just.hidden = respondida === null;
      const tg = document.createElement("button");
      tg.type = "button"; tg.className = "pl-just-toggle";
      const ta = document.createElement("textarea");
      ta.placeholder = certa ? "Por que esta alternativa está CERTA? (regra, conceito, artigo de lei…)" : "Por que esta alternativa está ERRADA? Onde está a pegadinha?";
      ta.value = justif[k] || "";
      ta.hidden = !abrir.includes(i);
      const aviso = document.createElement("div");
      aviso.className = "salvo"; aviso.hidden = ta.hidden;
      just.append(tg, ta, aviso);
      const rotulo = ()=>{
        tg.textContent = `${ta.hidden ? "▸" : "▾"} ✎ Justificativa — por que está ${certa ? "certa" : "errada"}`;
        if((justif[k] || "").trim()){ const dot = document.createElement("span"); dot.className = "tem"; dot.title = "Já tem justificativa"; tg.appendChild(dot); }
      };
      tg.addEventListener("click", ()=>{ ta.hidden = !ta.hidden; aviso.hidden = ta.hidden; rotulo(); if(!ta.hidden) ta.focus(); });
      ta.addEventListener("input", ()=>{ agendarJustif(k, ta.value, aviso); rotulo(); });
      rotulo();
      wrap.appendChild(just);
      box.appendChild(wrap);

      if(respondida !== null){
        btn.disabled = true;
        if(certa) btn.classList.add("correct");
        if(i === respondida && !certa) btn.classList.add("wrong");
      } else {
        btn.addEventListener("click", ()=> aoResponder(i));
      }
    });
    return card;
  }

  function feedbackHtml(q, correct){
    return html`<div class="${correct ? "ok" : "no"}" style="font-weight:700">${correct ? "✅ Você acertou!" : `❌ Você errou. Gabarito: ${LETRAS[q.corretaIndex]}`}</div>
      ${q.regra ? html`<div style="margin-top:6px">${q.regra}</div>` : ""}
      ${q.fonte ? html`<div class="muted" style="font-size:12px;margin-top:6px">Fonte: ${q.fonte}${/^https?:\/\//i.test(q.fonteUrl || "") ? html` — <a href="${q.fonteUrl}" target="_blank" rel="noopener">ver questão original</a>` : ""}</div>` : ""}
      <div class="muted" style="font-size:12px;margin-top:8px">Escreva com suas palavras por que a correta está certa e por que a sua estava errada — as abas abertas acima já salvam sozinhas.</div>`;
  }

  function renderQuestao(){
    const q = sessao.questoes[sessao.idx];
    const n = sessao.questoes.length;
    pintar(view, html`
      <div class="quiz-header"><div><strong>${tituloSessao()}</strong></div><div class="quiz-meta"><span>Questão ${sessao.idx + 1} de ${n}</span><span>${sessao.respostas.filter(r=> r.correct).length} acertos</span></div></div>
      <div class="progress-bar"><div style="height:100%;background:var(--accent);width:${Math.round(100 * sessao.idx / n)}%"></div></div>
      <div id="pl-card"></div>
      <div id="pl-feedback" class="feedback" hidden></div>
      <div class="quiz-actions" style="justify-content:space-between">
        <button class="pl-btn sec" id="pl-sair">Sair do bloco</button>
        <button class="pl-btn" id="pl-prox" disabled>${sessao.idx + 1 === n ? "Ver resultado" : "Próxima →"}</button>
      </div>`);
    const holder = view.querySelector("#pl-card");
    const mostrarRespondida = (resp)=>{
      holder.replaceChildren(cartaoQuestao(q, resp.alternativa, null, [q.corretaIndex, resp.alternativa]));
      const fb = view.querySelector("#pl-feedback");
      fb.hidden = false;
      pintar(fb, feedbackHtml(q, resp.correct));
      view.querySelector("#pl-prox").disabled = false;
    };
    const responder = (i)=>{
      if(sessao.respostas.length > sessao.idx) return; // já respondida
      const resp = { questaoId:q.id, alternativa:i, correct: i === q.corretaIndex, materia:q.materia, assunto:q.assunto };
      sessao.respostas.push(resp);
      mostrarRespondida(resp);
    };
    // ao voltar para o plano no meio do bloco, a questão já respondida não pode ser respondida de novo
    if(sessao.respostas.length > sessao.idx) mostrarRespondida(sessao.respostas[sessao.idx]);
    else holder.replaceChildren(cartaoQuestao(q, null, responder));

    view.querySelector("#pl-prox").addEventListener("click", ()=>{
      if(sessao.respostas.length <= sessao.idx) return;
      sessao.idx++;
      if(sessao.idx >= n) finalizar(); else { renderQuestao(); window.scrollTo(0,0); }
    });
    view.querySelector("#pl-sair").addEventListener("click", ()=>{
      if(sessao.respostas.length && !confirm("Sair agora? As respostas deste bloco não contam e ele recomeça do início na próxima vez. As justificativas já escritas ficam salvas.")) return;
      sessao = null; renderPainel();
    });
  }

  // ---------- Resultado e regras de progressão ----------
  function finalizar(){
    sessao.fim = true;
    const total = sessao.respostas.length;
    const acertos = sessao.respostas.filter(r=> r.correct).length;
    const pct = Math.round(100 * acertos / total);
    const passou = acertos >= minimo(total);
    const feitas = new Set(estado.feitas);
    sessao.respostas.forEach(r=>{
      feitas.add(r.questaoId);
      if(!r.correct) estado.erros[r.questaoId] = (estado.erros[r.questaoId] || 0) + 1;
    });
    estado.feitas = [...feitas];
    let dispararRevisao = false;
    const agora = new Date().toISOString();

    if(sessao.tipo === "bloco"){
      const t = trilha(sessao.chave);
      t.historico.push({ bloco:t.bloco, data:agora, acertos, total, passou });
      estado.contador += total; // só questões dos blocos contam para as 30; a revisão não conta para si mesma
      if(passou){ t.bloco++; t.ids = []; t.tentativas = 0; t.melhor = 0; }
      else { t.tentativas++; t.melhor = Math.max(t.melhor, pct); }
      if(estado.contador >= estado.proximaRevisao){ estado.revisaoPendente = true; dispararRevisao = true; }
    } else {
      estado.revisoes.push({ data:agora, acertos, total });
      estado.revisaoPendente = false;
      while(estado.proximaRevisao <= estado.contador) estado.proximaRevisao += REVISAO_A_CADA;
    }
    salvarEstado();

    const bySubj = {};
    sessao.respostas.forEach(r=>{ bySubj[r.materia] = bySubj[r.materia] || { acertos:0, total:0 }; bySubj[r.materia].total++; if(r.correct) bySubj[r.materia].acertos++; });
    // bloco de uma matéria entra no histórico com o nome da matéria (aparece no aproveitamento da tela inicial)
    const rotulo = sessao.tipo === "revisao" ? "Plano · Revisão de fixação" : sessao.chave === MISTO ? "Plano · Misturado" : sessao.chave;
    Promise.resolve()
      .then(()=> saveAttempt({ date:agora, materia:rotulo, total, acertos, tempoSegundos:Math.floor((Date.now() - sessao.inicio)/1000), bySubj }, sessao.respostas))
      .catch(e=> console.warn("Não foi possível registrar no histórico:", e && e.message));

    renderResultado({ total, acertos, pct, passou, dispararRevisao });
  }

  function renderResultado({ total, acertos, pct, passou, dispararRevisao }){
    const revisao = sessao.tipo === "revisao";
    const min = minimo(total);
    let decisao;
    if(revisao){
      const erradas = sessao.respostas.filter(r=> !r.correct).length;
      decisao = html`<div class="pl-decisao ${pct >= 90 ? "ok" : "no"}"><h3>${pct >= 90 ? "Fixação confirmada 💪" : "Ainda não fixou tudo"}</h3>
        <div>${erradas ? `As ${erradas} que você errou voltam com prioridade na próxima revisão. Releia as justificativas delas.` : "Você acertou tudo o que foi revisado."} Os blocos estão liberados de novo.</div></div>`;
    } else if(passou){
      decisao = html`<div class="pl-decisao ok"><h3>Bloco vencido! 🏆</h3><div>Você fez ${acertos}/${total} (mínimo ${min}). O próximo bloco, com ${BLOCO} questões novas, está liberado.</div></div>`;
    } else {
      decisao = html`<div class="pl-decisao no"><h3>Faltou pouco — refaça este bloco</h3><div>Você fez ${acertos}/${total}; para liberar questões novas são necessárias ${min}. As mesmas ${total} questões voltam em outra ordem. Use as justificativas para entender cada erro antes de tentar de novo.</div></div>`;
    }
    const aviso = dispararRevisao ? html`<div class="pl-decisao" style="border-color:var(--accent);background:var(--accent-soft)"><h3>🔁 Você completou mais 30 questões</h3><div>Agora vem a revisão de fixação: ${REVISAO_QTD} questões misturando tudo o que já foi feito.</div></div>` : "";
    const proxTexto = estado.revisaoPendente ? "Fazer revisão de fixação" : revisao ? "Voltar ao plano" : passou ? "Próximo bloco →" : "Refazer este bloco";
    pintar(view, html`
      <h2>${revisao ? "Resultado da revisão" : "Resultado do bloco"}</h2>
      <div class="result-summary">
        <div class="stat-box"><div class="num">${acertos}/${total}</div><div class="lbl">Acertos</div></div>
        <div class="stat-box"><div class="num">${pct}%</div><div class="lbl">Aproveitamento</div></div>
        <div class="stat-box"><div class="num">${revisao ? "—" : `${min}/${total}`}</div><div class="lbl">Meta (90%)</div></div>
      </div>
      ${decisao}${aviso}
      <div class="pl-acoes">
        <button class="pl-btn" id="pl-continuar">${proxTexto}</button>
        <button class="pl-btn sec" id="pl-revisar">Rever questões e justificativas</button>
        <button class="pl-btn sec" id="pl-painel">Voltar ao plano</button>
      </div>
      <div id="pl-lista" class="pl-lista"></div>`);
    const chave = sessao.chave;
    view.querySelector("#pl-continuar").addEventListener("click", ()=>{
      if(estado.revisaoPendente) iniciarRevisao();
      else if(revisao){ sessao = null; renderPainel(); }
      else iniciar(chave);
      window.scrollTo(0,0);
    });
    view.querySelector("#pl-painel").addEventListener("click", ()=>{ sessao = null; renderPainel(); window.scrollTo(0,0); });
    view.querySelector("#pl-revisar").addEventListener("click", (e)=>{
      e.target.disabled = true;
      const lista = view.querySelector("#pl-lista");
      pintar(lista, html`<h3>Questões ${revisao ? "da revisão" : "do bloco"}</h3><p class="muted" style="font-size:13px">Abra a aba de cada alternativa para escrever ou corrigir a justificativa. Tudo salva automaticamente.</p>`);
      sessao.respostas.forEach((r, n)=>{
        const q = sessao.questoes.find(x=> x.id === r.questaoId);
        const card = cartaoQuestao(q, r.alternativa, null);
        card.querySelectorAll(".pl-just").forEach(j=> j.hidden = false);
        const sua = document.createElement("div");
        sua.className = "sua " + (r.correct ? "badge-strong" : "badge-weak");
        sua.textContent = `${n + 1}. Sua resposta: ${LETRAS[r.alternativa]} — ${r.correct ? "acertou" : "errou (gabarito " + LETRAS[q.corretaIndex] + ")"}`;
        card.insertBefore(sua, card.children[1]);
        lista.appendChild(card);
      });
    });
    window.scrollTo(0,0);
  }
})();
