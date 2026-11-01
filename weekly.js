// ===== Passei — Meta semanal e ritmo de estudo =====
// Mantém uma cópia local para uso offline e sincroniza com o Supabase quando as tabelas existem.
(function(){
  const LOCAL_PREFIX = "passei_meta_semanal_v1";
  const TIMER_KEY = "passei_ritmo_estudo_v1";
  const DEFAULT_TASKS = [
    {categoria:"Prioridade", titulo:"Baixar e ler o arquivo ATF_DE_Written_Case.zip", minutos:30},
    {categoria:"Prioridade", titulo:"Resolver o case de raciocínio lógico da Artefact", minutos:120},
    {categoria:"Prioridade", titulo:"Produzir as respostas do case em inglês", minutos:90},
    {categoria:"Prioridade", titulo:"Exportar a solução em PDF com o nome solicitado", minutos:20},
    {categoria:"Prioridade", titulo:"Enviar pelo Google Forms até 03/11 às 23:59", minutos:15},
    {categoria:"Dados", titulo:"Python e Pandas — prática com notebook ou exercício", minutos:180},
    {categoria:"Dados", titulo:"SQL — consultas salvas e explicadas", minutos:120},
    {categoria:"Dados", titulo:"Estatística — problemas resolvidos e interpretação", minutos:120},
    {categoria:"Dados", titulo:"Power BI ou aprendizado de máquina — painel ou experimento", minutos:120},
    {categoria:"Carreira", titulo:"GitHub, documentação e candidaturas direcionadas", minutos:60}
  ];
  const MODES = {
    pomodoro:{nome:"Ritmo leve", foco:25, pausa:5, detalhe:"25 min de foco + 5 min de descanso"},
    profundo:{nome:"Bloco profundo", foco:50, pausa:10, detalhe:"50 min de foco + 10 min de descanso"},
    case:{nome:"Case concentrado", foco:45, pausa:10, detalhe:"45 min de foco + 10 min de descanso"}
  };
  let tarefas=[], userId=null, remoteReady=false, timer=null, startupDone=false;

  const style=document.createElement("style");
  style.textContent=`
    .weekly-hero{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;background:linear-gradient(135deg,#172b46,#1a2330);border:1px solid var(--border);border-radius:14px;padding:18px;margin-bottom:16px}
    .weekly-hero h2{margin:0 0 4px}.weekly-hero p{margin:0}.weekly-progress{font-size:26px;font-weight:800;color:var(--ok);white-space:nowrap}
    .study-timer{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;margin:16px 0}
    .study-timer .timer-top{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}
    .study-timer .phase{color:var(--accent);font-weight:700}.study-timer .clock{font-size:44px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:1px}
    .timer-modes{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.timer-modes button,.timer-actions button{padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--card2);color:var(--text);font-weight:700;cursor:pointer}
    .timer-modes button.active{border-color:var(--accent);background:var(--accent-soft)}.timer-actions button.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
    .task-group{margin:20px 0}.task-group h3{font-size:14px;color:var(--muted);margin:0 0 8px;text-transform:uppercase;letter-spacing:.06em}
    .weekly-task{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin:8px 0}
    .weekly-task input{width:20px;height:20px;accent-color:var(--ok);flex:0 0 auto}.weekly-task.done .task-title{text-decoration:line-through;color:var(--muted)}
    .task-title{flex:1}.task-time{color:var(--muted);font-size:12px;white-space:nowrap}.sync-note{font-size:12px;color:var(--muted);margin-top:8px}
    @media(max-width:560px){.weekly-hero{display:block}.weekly-progress{margin-top:10px}.study-timer .clock{font-size:38px}}
  `;
  document.head.appendChild(style);

  const dashboardBtn=document.querySelector('[data-view="dashboard"]');
  const metaBtn=document.createElement("button");
  metaBtn.type="button"; metaBtn.className="nav-btn"; metaBtn.dataset.view="weekly"; metaBtn.textContent="Meta semanal";
  dashboardBtn.insertAdjacentElement("afterend",metaBtn);

  const view=document.createElement("main");
  view.id="view-weekly"; view.className="view"; view.hidden=true;
  view.innerHTML=`
    <section class="weekly-hero">
      <div><h2>Meta semanal</h2><p class="muted">Checklist do planejamento do Notion, salvo no celular e sincronizado na sua conta quando houver conexão.</p></div>
      <div id="weekly-progress" class="weekly-progress">0/0</div>
    </section>
    <section class="study-timer" aria-live="polite">
      <div class="timer-top"><div><div id="timer-phase" class="phase">Preparando o foco</div><div id="timer-mode-label" class="muted">Ritmo leve · 25 min de foco + 5 min de descanso</div></div><div id="study-clock" class="clock">25:00</div></div>
      <div id="timer-modes" class="timer-modes"></div>
      <div class="timer-actions"><button id="timer-start" class="primary">Iniciar ciclo</button><button id="timer-pause">Pausar</button><button id="timer-reset">Reiniciar</button></div>
      <p class="sync-note">O ciclo muda sozinho entre foco e descanso. Ao concluir uma etapa, marque a tarefa correspondente abaixo.</p>
    </section>
    <div id="weekly-tasks"></div>
    <p id="weekly-sync-note" class="sync-note"></p>
  `;
  document.getElementById("app").appendChild(view);

  function weekStart(){
    const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay());
    return d.toISOString().slice(0,10);
  }
  function localKey(){ return `${LOCAL_PREFIX}_${userId||"anon"}_${weekStart()}`; }
  function readLocal(){
    try{const value=JSON.parse(localStorage.getItem(localKey())); if(Array.isArray(value)) return value;}catch(e){}
    return DEFAULT_TASKS.map((t,i)=>({...t,id:"local-"+i,ordem:i,concluida:false,concluida_em:null}));
  }
  function saveLocal(){ try{localStorage.setItem(localKey(),JSON.stringify(tarefas));}catch(e){} }
  function mins(n){ return n>=60 ? `${Math.floor(n/60)}h${n%60?String(n%60).padStart(2,"0"):""}` : `${n} min`; }
  function escapeHtml(s){const d=document.createElement("div");d.textContent=s;return d.innerHTML;}

  async function getUser(){
    const {data}=await sb.auth.getUser();
    userId=data.user && data.user.id;
    return data.user;
  }
  async function loadRemote(){
    const user=await getUser(); if(!user) return false;
    const semana=weekStart();
    const {data:plan,error:planError}=await sb.from("passei_planos_semanais")
      .upsert({week_start:semana,titulo:"Meta semanal de estudos"},{onConflict:"user_id,week_start"})
      .select("id").single();
    if(planError) throw planError;
    let {data:rows,error}=await sb.from("passei_metas_semanais").select("*").eq("plano_id",plan.id).order("ordem");
    if(error) throw error;
    if(!rows.length){
      const payload=DEFAULT_TASKS.map((t,i)=>({plano_id:plan.id,categoria:t.categoria,titulo:t.titulo,minutos_estimados:t.minutos,ordem:i}));
      const inserted=await sb.from("passei_metas_semanais").insert(payload).select("*");
      if(inserted.error) throw inserted.error;
      rows=inserted.data;
    }
    tarefas=rows.map(t=>({id:t.id,categoria:t.categoria,titulo:t.titulo,minutos:t.minutos_estimados,ordem:t.ordem,concluida:t.concluida,concluida_em:t.concluida_em}));
    remoteReady=true; saveLocal(); return true;
  }
  async function loadTasks(){
    remoteReady=false; tarefas=readLocal();
    try{ await loadRemote(); }catch(err){ console.warn("Meta semanal em modo local:",err.message); }
    renderTasks();
  }
  function renderTasks(){
    const done=tarefas.filter(t=>t.concluida).length;
    document.getElementById("weekly-progress").textContent=`${done}/${tarefas.length}`;
    const groups={};
    tarefas.sort((a,b)=>a.ordem-b.ordem).forEach(t=>(groups[t.categoria]||(groups[t.categoria]=[])).push(t));
    document.getElementById("weekly-tasks").innerHTML=Object.entries(groups).map(([cat,items])=>`
      <section class="task-group"><h3>${escapeHtml(cat)}</h3>${items.map(t=>`
        <label class="weekly-task ${t.concluida?"done":""}">
          <input type="checkbox" data-task-id="${t.id}" ${t.concluida?"checked":""} />
          <span class="task-title">${escapeHtml(t.titulo)}</span><span class="task-time">${mins(t.minutos)}</span>
        </label>`).join("")}</section>`).join("");
    document.querySelectorAll("[data-task-id]").forEach(el=>el.addEventListener("change",()=>toggleTask(el.dataset.taskId,el.checked)));
    document.getElementById("weekly-sync-note").textContent=remoteReady ? "✓ Sincronizado com o banco do Passei." : "Salvo neste celular. A sincronização entrará em funcionamento assim que a migração do banco for aplicada.";
  }
  async function toggleTask(id,checked){
    const task=tarefas.find(t=>String(t.id)===String(id)); if(!task) return;
    task.concluida=checked; task.concluida_em=checked?new Date().toISOString():null; saveLocal(); renderTasks();
    if(remoteReady){
      const {error}=await sb.from("passei_metas_semanais").update({concluida:checked,concluida_em:task.concluida_em}).eq("id",task.id).eq("user_id",userId);
      if(error){remoteReady=false;renderTasks();}
    }
  }

  function readTimer(){
    try{return JSON.parse(localStorage.getItem(TIMER_KEY));}catch(e){return null;}
  }
  function saveTimer(){try{localStorage.setItem(TIMER_KEY,JSON.stringify(timer));}catch(e){}}
  function fmt(seconds){seconds=Math.max(0,seconds);return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;}
  function renderTimer(){
    timer=timer||{mode:"pomodoro",phase:"foco",paused:true,remaining:MODES.pomodoro.foco*60};
    const m=MODES[timer.mode], phase=timer.phase==="foco"?"Foco agora":"Descanso agora";
    document.getElementById("timer-phase").textContent=phase;
    document.getElementById("timer-mode-label").textContent=`${m.nome} · ${m.detalhe}`;
    const rem=timer.paused?timer.remaining:Math.ceil((timer.endsAt-Date.now())/1000);
    document.getElementById("study-clock").textContent=fmt(rem);
    document.getElementById("timer-start").textContent=timer.paused?"Iniciar ciclo":"Em andamento";
    document.getElementById("timer-pause").textContent=timer.paused?"Retomar":"Pausar";
    document.querySelectorAll("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===timer.mode));
  }
  function begin(mode){
    const m=MODES[mode], secs=(timer&&timer.phase==="pausa"?m.pausa:m.foco)*60;
    timer={mode,phase:"foco",paused:false,endsAt:Date.now()+secs*1000,remaining:secs}; saveTimer(); renderTimer();
  }
  function toggleTimer(){
    if(timer.paused){timer.paused=false;timer.endsAt=Date.now()+timer.remaining*1000;}
    else{timer.remaining=Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000));timer.paused=true;}
    saveTimer();renderTimer();
  }
  function resetTimer(){const m=MODES[timer.mode];timer={mode:timer.mode,phase:"foco",paused:true,remaining:m.foco*60};saveTimer();renderTimer();}
  function tick(){
    if(!timer||timer.paused) return;
    const remaining=Math.ceil((timer.endsAt-Date.now())/1000);
    if(remaining>0){renderTimer();return;}
    const m=MODES[timer.mode]; timer.phase=timer.phase==="foco"?"pausa":"foco"; timer.remaining=(timer.phase==="foco"?m.foco:m.pausa)*60;
    timer.endsAt=Date.now()+timer.remaining*1000; saveTimer(); renderTimer();
    if(navigator.vibrate) navigator.vibrate([180,80,180]);
  }
  function setupTimer(){
    timer=readTimer()||{mode:"pomodoro",phase:"foco",paused:true,remaining:MODES.pomodoro.foco*60};
    if(!timer.paused && (!timer.endsAt || timer.endsAt<Date.now())){timer.paused=true;timer.remaining=MODES[timer.mode].foco*60;timer.phase="foco";}
    document.getElementById("timer-modes").innerHTML=Object.entries(MODES).map(([key,m])=>`<button type="button" data-mode="${key}">${m.nome}<br><small>${m.detalhe}</small></button>`).join("");
    document.querySelectorAll("[data-mode]").forEach(b=>b.addEventListener("click",()=>{timer={mode:b.dataset.mode,phase:"foco",paused:true,remaining:MODES[b.dataset.mode].foco*60};saveTimer();renderTimer();}));
    document.getElementById("timer-start").addEventListener("click",()=>{if(timer.paused) begin(timer.mode);});
    document.getElementById("timer-pause").addEventListener("click",toggleTimer);
    document.getElementById("timer-reset").addEventListener("click",resetTimer);
    renderTimer(); setInterval(tick,1000);
  }
  function openWeekly(){
    document.querySelectorAll(".view").forEach(v=>v.hidden=true); view.hidden=false;
    document.querySelectorAll(".nav-btn[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view==="weekly"));
    loadTasks(); window.scrollTo(0,0);
  }
  metaBtn.addEventListener("click",openWeekly);
  document.querySelectorAll('.nav-btn[data-view]:not([data-view="weekly"])').forEach(b=>b.addEventListener("click",()=>{view.hidden=true;}));
  setupTimer();
  const app=document.getElementById("app");
  new MutationObserver(()=>{if(!app.hidden&&!startupDone){startupDone=true;getUser().then(()=>{if(timer.paused) begin(timer.mode);});}}).observe(app,{attributes:true,attributeFilter:["hidden"]});
})();