// ===== Passei — app.js =====
// Questões, login e histórico vêm do Supabase (ver supabase/*.sql).
const sb = supabase.createClient(PASSEI_CONFIG.supabaseUrl, PASSEI_CONFIG.supabaseKey);
const FILTRO_KEY = "passei_filtro_origem_v1";
const LEGACY_HISTORY_KEY = "passei_history_v1"; // histórico antigo salvo só no navegador

// Banco completo carregado do Supabase: questões reais + inéditas da rotina diária
let BANCO = [];
let MATERIAS = [];
let HISTORY = [];

// Filtro de origem: "todas" | "real" | "ia"
let filtroOrigem = "todas";
try{ filtroOrigem = localStorage.getItem(FILTRO_KEY) || "todas"; }catch(e){}
function questoesAtivas(){
  return BANCO.filter(q => q.valido && (filtroOrigem === "todas" || q.origem === filtroOrigem));
}

function setLoadStatus(msg){
  const el = document.getElementById("load-status");
  el.hidden = !msg;
  el.textContent = msg || "";
}

async function carregarQuestoes(){
  const PAGE = 1000;
  let todas = [];
  for(let from = 0; ; from += PAGE){
    const { data, error } = await sb.from("questoes")
      .select("id,materia,assunto,enunciado,alternativas,correta_index,regra,fonte,fonte_url,valido,origem")
      .eq("valido", true).order("id").range(from, from + PAGE - 1);
    if(error) throw error;
    todas = todas.concat(data);
    if(data.length < PAGE) break;
  }
  BANCO = todas.map(q => ({
    id: q.id, materia: q.materia, assunto: q.assunto, enunciado: q.enunciado,
    alternativas: q.alternativas, corretaIndex: q.correta_index, regra: q.regra,
    fonte: q.fonte, fonteUrl: q.fonte_url, valido: q.valido, origem: q.origem
  }));
  MATERIAS = [...new Set(BANCO.map(q => q.materia))].sort((a,b)=> a.localeCompare(b, "pt-BR"));
}

// ---------- Auth ----------
document.getElementById("login-form").addEventListener("submit", async e=>{
  e.preventDefault();
  const email = document.getElementById("login-user").value.trim();
  const password = document.getElementById("login-pass").value;
  const btn = e.target.querySelector("button");
  btn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if(error){ document.getElementById("login-error").hidden = false; return; }
  boot();
});
document.getElementById("logout-btn").addEventListener("click", async ()=>{
  await sb.auth.signOut();
  location.reload();
});

// ---------- History (Supabase) ----------
function getHistory(){ return HISTORY; }

async function carregarHistorico(){
  const { data, error } = await sb.from("tentativas")
    .select("feito_em,materia,total,acertos,tempo_segundos,by_subj")
    .order("feito_em");
  if(error) throw error;
  HISTORY = data.map(a => ({ date: a.feito_em, materia: a.materia, total: a.total,
    acertos: a.acertos, tempoSegundos: a.tempo_segundos, bySubj: a.by_subj }));
}

async function saveAttempt(attempt, respostas){
  HISTORY.push(attempt);
  const { data, error } = await sb.from("tentativas").insert({
    feito_em: attempt.date, materia: attempt.materia, filtro_origem: filtroOrigem,
    total: attempt.total, acertos: attempt.acertos, tempo_segundos: attempt.tempoSegundos,
    by_subj: attempt.bySubj || {}
  }).select("id").single();
  if(error){ alert("Não foi possível salvar o simulado na sua conta: " + error.message); return; }
  if(respostas && respostas.length){
    const { error: e2 } = await sb.from("respostas").insert(
      respostas.map(r => ({ tentativa_id: data.id, questao_id: r.questaoId, alternativa: r.alternativa, correta: r.correct }))
    );
    if(e2) console.warn("Falha ao salvar respostas:", e2.message);
  }
}

// Envia para a conta um histórico no formato antigo (localStorage ou JSON exportado)
async function enviarHistoricoLegado(lista){
  const linhas = lista.filter(a => a && a.total).map(a => ({
    feito_em: a.date || new Date().toISOString(), materia: a.materia || "Geral (mesclado)",
    total: a.total, acertos: a.acertos || 0, tempo_segundos: a.tempoSegundos || 0, by_subj: a.bySubj || {}
  }));
  if(!linhas.length) return 0;
  const { error } = await sb.from("tentativas").insert(linhas);
  if(error) throw error;
  return linhas.length;
}

async function migrarHistoricoDoNavegador(){
  let legado = null;
  try{ legado = JSON.parse(localStorage.getItem(LEGACY_HISTORY_KEY)); }catch(e){}
  if(!Array.isArray(legado) || !legado.length) return;
  try{
    const n = await enviarHistoricoLegado(legado);
    localStorage.removeItem(LEGACY_HISTORY_KEY);
    if(n) console.info(`Histórico antigo migrado para a conta: ${n} simulados.`);
  }catch(err){ console.warn("Migração do histórico antigo falhou:", err.message); }
}

// ---------- Navigation ----------
const views = ["home","quiz","result","dashboard"];
function showView(name){
  views.forEach(v=>{
    document.getElementById("view-"+v).hidden = (v!==name);
  });
  document.querySelectorAll(".nav-btn[data-view]").forEach(b=>{
    b.classList.toggle("active", b.dataset.view===name);
  });
  if(name==="dashboard") renderDashboard();
  if(name==="home") renderHome();
  window.scrollTo(0,0);
}
document.querySelectorAll(".nav-btn[data-view]").forEach(b=>{
  b.addEventListener("click", ()=> showView(b.dataset.view));
});

// ---------- Home ----------
function countBySubject(materia){
  return questoesAtivas().filter(q=>q.materia===materia).length;
}
function bestPercentForSubject(materia){
  const h = getHistory().filter(a=>a.materia===materia);
  if(!h.length) return null;
  const totalQ = h.reduce((s,a)=>s+a.total,0);
  const totalC = h.reduce((s,a)=>s+a.acertos,0);
  return Math.round(100*totalC/totalQ);
}
function renderHome(){
  const ativas = questoesAtivas();
  document.getElementById("total-questoes").textContent = ativas.length;
  const nReais = BANCO.filter(q=>q.valido && q.origem==="real").length;
  const nIa = BANCO.filter(q=>q.valido && q.origem==="ia").length;
  document.querySelectorAll("#origem-filter button").forEach(b=>{
    b.classList.toggle("active", b.dataset.origem===filtroOrigem);
    const n = b.dataset.origem==="real"? nReais : b.dataset.origem==="ia"? nIa : nReais+nIa;
    b.querySelector(".n").textContent = n;
  });
  const rotulo = filtroOrigem==="real"? "reais" : filtroOrigem==="ia"? "inéditas" : "";
  const grid = document.getElementById("subject-grid");
  grid.innerHTML = "";
  MATERIAS.forEach(m=>{
    const n = countBySubject(m);
    const pct = bestPercentForSubject(m);
    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML = `
      <h4>${m}</h4>
      <div class="count">${n} questões${rotulo? " "+rotulo:""} disponíveis${pct!==null? ` · aproveitamento: <strong>${pct}%</strong>`:''}</div>
      <div class="bar-bg"><div class="bar-fill" style="width:${pct||0}%"></div></div>
    `;
    if(n===0) card.classList.add("empty");
    else card.addEventListener("click", ()=> startQuiz(m, Math.min(10,n)));
    grid.appendChild(card);
  });
}
document.querySelectorAll("#origem-filter button").forEach(b=>{
  b.addEventListener("click", ()=>{
    filtroOrigem = b.dataset.origem;
    try{ localStorage.setItem(FILTRO_KEY, filtroOrigem); }catch(e){}
    renderHome();
  });
});
document.getElementById("mix-start").addEventListener("click", ()=>{
  const qty = parseInt(document.getElementById("mix-qty").value,10) || 20;
  startQuiz(null, qty);
});

// ---------- Quiz engine ----------
let quizState = null;

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function startQuiz(materia, qty){
  let pool = questoesAtivas();
  if(materia) pool = pool.filter(q=>q.materia===materia);
  pool = shuffle(pool).slice(0, qty);
  if(pool.length===0){ alert("Não há questões válidas suficientes para esse simulado."); return; }

  quizState = {
    materia: materia || "Geral (mesclado)",
    questions: pool,
    idx: 0,
    answers: [], // {correct: bool, materia, assunto}
    startTime: Date.now(),
    timerInterval: null
  };
  showView("quiz");
  startTimer();
  renderQuestion();
}

function startTimer(){
  clearInterval(quizState.timerInterval);
  quizState.timerInterval = setInterval(()=>{
    const s = Math.floor((Date.now()-quizState.startTime)/1000);
    const mm = String(Math.floor(s/60)).padStart(2,"0");
    const ss = String(s%60).padStart(2,"0");
    document.getElementById("quiz-timer").textContent = `${mm}:${ss}`;
  },1000);
}

function renderQuestion(){
  const q = quizState.questions[quizState.idx];
  document.getElementById("quiz-title").textContent = quizState.materia;
  document.getElementById("quiz-progress").textContent = `Questão ${quizState.idx+1} de ${quizState.questions.length}`;
  document.getElementById("progress-fill").style.width = `${100*quizState.idx/quizState.questions.length}%`;
  const tag = document.getElementById("question-tag");
  tag.textContent = `${q.materia} · ${q.assunto}`;
  if(q.origem==="ia"){
    const badge = document.createElement("span");
    badge.className = "badge-ia";
    badge.textContent = "Inédita";
    badge.title = "Questão inédita no estilo Cesgranrio, criada pela rotina de simulados diários";
    tag.appendChild(badge);
  }
  document.getElementById("question-text").textContent = q.enunciado;

  const altsBox = document.getElementById("alternatives");
  altsBox.innerHTML = "";
  const letters = ["A","B","C","D","E"];
  q.alternativas.forEach((alt, i)=>{
    const btn = document.createElement("button");
    btn.className = "alt-btn";
    btn.textContent = `${letters[i]}) ${alt}`;
    btn.addEventListener("click", ()=> answerQuestion(i));
    altsBox.appendChild(btn);
  });
  document.getElementById("feedback").hidden = true;
  document.getElementById("next-btn").disabled = true;
}

function answerQuestion(i){
  const q = quizState.questions[quizState.idx];
  const buttons = document.querySelectorAll("#alternatives .alt-btn");
  buttons.forEach(b=> b.disabled = true);
  buttons[q.corretaIndex].classList.add("correct");
  const isCorrect = i === q.corretaIndex;
  if(!isCorrect) buttons[i].classList.add("wrong");

  quizState.answers.push({correct: isCorrect, materia: q.materia, assunto: q.assunto, questaoId: q.id, alternativa: i});

  const fb = document.getElementById("feedback");
  fb.hidden = false;
  const status = document.getElementById("feedback-status");
  status.textContent = isCorrect ? "✅ Você acertou!" : "❌ Você errou.";
  status.className = isCorrect ? "ok" : "no";
  document.getElementById("feedback-rule").textContent = q.regra || "";
  const srcEl = document.getElementById("feedback-source");
  srcEl.innerHTML = q.fonte ? `Fonte: ${q.fonte}${q.fonteUrl? ` — <a href="${q.fonteUrl}" target="_blank" rel="noopener">ver questão original</a>`:''}` : "";

  document.getElementById("next-btn").disabled = false;
}

document.getElementById("next-btn").addEventListener("click", ()=>{
  quizState.idx++;
  if(quizState.idx >= quizState.questions.length){
    finishQuiz();
  } else {
    renderQuestion();
  }
});

function finishQuiz(){
  clearInterval(quizState.timerInterval);
  const totalSec = Math.floor((Date.now()-quizState.startTime)/1000);
  const acertos = quizState.answers.filter(a=>a.correct).length;
  const total = quizState.answers.length;

  // per-subject breakdown (relevant for "Geral" mode)
  const bySubj = {};
  quizState.answers.forEach(a=>{
    bySubj[a.materia] = bySubj[a.materia] || {acertos:0,total:0};
    bySubj[a.materia].total++;
    if(a.correct) bySubj[a.materia].acertos++;
  });

  saveAttempt({
    date: new Date().toISOString(),
    materia: quizState.materia,
    total, acertos,
    tempoSegundos: totalSec,
    bySubj
  }, quizState.answers);

  renderResult(acertos, total, totalSec, bySubj);
  showView("result");
}

function renderResult(acertos, total, totalSec, bySubj){
  const pct = Math.round(100*acertos/total);
  const mm = String(Math.floor(totalSec/60)).padStart(2,"0");
  const ss = String(totalSec%60).padStart(2,"0");
  document.getElementById("result-summary").innerHTML = `
    <div class="stat-box"><div class="num">${acertos}/${total}</div><div class="lbl">Acertos</div></div>
    <div class="stat-box"><div class="num">${pct}%</div><div class="lbl">Aproveitamento</div></div>
    <div class="stat-box"><div class="num">${mm}:${ss}</div><div class="lbl">Tempo total</div></div>
    <div class="stat-box"><div class="num">${pct>=90? "🏆" : pct>=70? "👍":"📚"}</div><div class="lbl">${pct>=90? "Meta atingida!" : pct>=70? "Quase lá":"Reforçar"}</div></div>
  `;
  const box = document.getElementById("result-by-subject");
  box.innerHTML = "<h3>Desempenho por assunto</h3>";
  Object.entries(bySubj).forEach(([materia,st])=>{
    const p = Math.round(100*st.acertos/st.total);
    const row = document.createElement("div");
    row.className = "subj-row";
    row.innerHTML = `<div class="name">${materia}</div>
      <div class="bar-bg"><div class="bar-fill" style="width:${p}%;background:${p>=90?'#22c55e':p>=70?'#38bdf8':'#ef4444'}"></div></div>
      <div class="pct">${st.acertos}/${st.total}</div>`;
    box.appendChild(row);
  });
}

document.getElementById("result-home-btn").addEventListener("click", ()=> showView("home"));

// ---------- Dashboard ----------
function renderDashboard(){
  const history = getHistory();
  const overview = document.getElementById("dash-overview");
  const totalAttempts = history.length;
  const totalQ = history.reduce((s,a)=>s+a.total,0);
  const totalC = history.reduce((s,a)=>s+a.acertos,0);
  const overallPct = totalQ? Math.round(100*totalC/totalQ) : 0;

  overview.innerHTML = `
    <div class="stat-box"><div class="num">${totalAttempts}</div><div class="lbl">Simulados feitos</div></div>
    <div class="stat-box"><div class="num">${totalQ}</div><div class="lbl">Questões respondidas</div></div>
    <div class="stat-box"><div class="num">${overallPct}%</div><div class="lbl">Aproveitamento geral</div></div>
  `;

  // aggregate by subject across all history (including bySubj breakdown of mixed quizzes)
  const agg = {};
  MATERIAS.forEach(m=> agg[m] = {acertos:0,total:0});
  history.forEach(a=>{
    if(a.bySubj){
      Object.entries(a.bySubj).forEach(([m,st])=>{
        agg[m] = agg[m] || {acertos:0,total:0};
        agg[m].acertos += st.acertos;
        agg[m].total += st.total;
      });
    }
  });

  const subjBox = document.getElementById("dash-subjects");
  subjBox.innerHTML = "<h3>Desempenho por matéria (histórico completo)</h3>";
  const sorted = Object.entries(agg).sort((a,b)=> (a[1].total? (a[1].acertos/a[1].total):1) - (b[1].total? (b[1].acertos/b[1].total):1));
  sorted.forEach(([materia, st])=>{
    const pct = st.total? Math.round(100*st.acertos/st.total) : null;
    const color = pct===null? '#94a3b8' : pct>=90?'#22c55e':pct>=70?'#38bdf8':'#ef4444';
    const row = document.createElement("div");
    row.className = "dash-row";
    row.innerHTML = `
      <div class="head">
        <span>${materia}</span>
        <span class="${pct===null?'':pct<70?'badge-weak':pct>=90?'badge-strong':''}">${pct===null?'sem dados':pct+'%'}</span>
      </div>
      <div class="bar-bg"><div class="bar-fill" style="width:${pct||0}%;background:${color}"></div></div>
      <div class="meta"><span>${st.total} questões respondidas</span><span>${pct!==null && pct<70? 'Priorizar revisão' : pct!==null && pct>=90? 'Meta de 90% atingida' : ''}</span></div>
    `;
    subjBox.appendChild(row);
  });

  if(!history.length){
    subjBox.innerHTML += `<p class="muted">Nenhum simulado feito ainda neste navegador.</p>`;
  }
}

// ---------- Export / Import / Reset ----------
document.getElementById("export-btn").addEventListener("click", ()=>{
  const data = JSON.stringify(getHistory(), null, 2);
  const blob = new Blob([data], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `passei-progresso-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
});
document.getElementById("import-input").addEventListener("change", (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error("formato inválido");
      const n = await enviarHistoricoLegado(imported);
      await carregarHistorico();
      renderDashboard();
      alert(`Progresso importado para a sua conta: ${n} simulados.`);
    }catch(err){
      alert("Arquivo inválido: " + err.message);
    }
  };
  reader.readAsText(file);
});
document.getElementById("reset-btn").addEventListener("click", async ()=>{
  if(confirm("Tem certeza que deseja apagar todo o histórico da sua conta? Isso não pode ser desfeito.")){
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await sb.from("tentativas").delete().eq("user_id", user.id);
    if(error){ alert("Não foi possível apagar: " + error.message); return; }
    HISTORY = [];
    renderDashboard();
  }
});

// ---------- Boot ----------
async function boot(){
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app").hidden = false;
  showView("home");
  setLoadStatus("Carregando questões…");
  try{
    await migrarHistoricoDoNavegador();
    await Promise.all([carregarQuestoes(), carregarHistorico()]);
    setLoadStatus("");
  }catch(err){
    setLoadStatus("Não foi possível carregar os dados: " + err.message);
  }
  showView("home");
  window.scrollTo(0,0);
}
sb.auth.getSession().then(({ data }) => { if(data.session) boot(); });
