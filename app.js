// ===== Passei — app.js =====
const AUTH_USER = "Rafael";
const AUTH_PASS = "Saxtenor1";
const AUTH_KEY = "passei_auth_v1";
const HISTORY_KEY = "passei_history_v1";

const FILTRO_KEY = "passei_filtro_origem_v1";

// Banco completo: questões reais (data.js) + inéditas geradas pela rotina diária (data_ia.js)
const QUESTOES_IA_LISTA = (typeof QUESTOES_IA !== "undefined" ? QUESTOES_IA : [])
  .map(q => Object.assign({origem: "ia"}, q));
const BANCO = QUESTOES.map(q => Object.assign({origem: "real"}, q)).concat(QUESTOES_IA_LISTA);
const MATERIAS = [...new Set(BANCO.map(q => q.materia))];

// Filtro de origem: "todas" | "real" | "ia"
let filtroOrigem = "todas";
try{ filtroOrigem = localStorage.getItem(FILTRO_KEY) || "todas"; }catch(e){}
function questoesAtivas(){
  return BANCO.filter(q => q.valido && (filtroOrigem === "todas" || q.origem === filtroOrigem));
}

// ---------- Auth ----------
function isLoggedIn(){ return localStorage.getItem(AUTH_KEY) === "ok"; }
function login(u,p){
  if(u.trim().toLowerCase() === AUTH_USER.toLowerCase() && p === AUTH_PASS){
    localStorage.setItem(AUTH_KEY, "ok");
    return true;
  }
  return false;
}
function logout(){ localStorage.removeItem(AUTH_KEY); location.reload(); }

document.getElementById("login-form").addEventListener("submit", e=>{
  e.preventDefault();
  const u = document.getElementById("login-user").value;
  const p = document.getElementById("login-pass").value;
  if(login(u,p)){ boot(); }
  else { document.getElementById("login-error").hidden = false; }
});
document.getElementById("logout-btn").addEventListener("click", logout);

// ---------- History (localStorage) ----------
function getHistory(){
  try{ return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }catch(e){ return []; }
}
function saveAttempt(attempt){
  const h = getHistory();
  h.push(attempt);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
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

  quizState.answers.push({correct: isCorrect, materia: q.materia, assunto: q.assunto});

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
  });

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
  reader.onload = ()=>{
    try{
      const imported = JSON.parse(reader.result);
      if(!Array.isArray(imported)) throw new Error("formato inválido");
      const current = getHistory();
      localStorage.setItem(HISTORY_KEY, JSON.stringify(current.concat(imported)));
      renderDashboard();
      alert("Progresso importado com sucesso!");
    }catch(err){
      alert("Arquivo inválido: " + err.message);
    }
  };
  reader.readAsText(file);
});
document.getElementById("reset-btn").addEventListener("click", ()=>{
  if(confirm("Tem certeza que deseja apagar todo o histórico salvo neste navegador?")){
    localStorage.removeItem(HISTORY_KEY);
    renderDashboard();
  }
});

// ---------- Boot ----------
function boot(){
  document.getElementById("login-screen").hidden = true;
  document.getElementById("app").hidden = false;
  showView("home");
  window.scrollTo(0,0);
}
if(isLoggedIn()) boot();
