/* Sincroniza a altura com a área realmente visível no Android/SPCK. */
(function () {
  let resizeTimer;
  function updateAppHeight() {
    const visibleHeight = window.visualViewport && window.visualViewport.height;
    const height = visibleHeight || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", Math.round(height) + "px");
  }
  function scheduleUpdate() {
    clearTimeout(resizeTimer);
    updateAppHeight();
    resizeTimer = setTimeout(updateAppHeight, 180);
    setTimeout(updateAppHeight, 450);
  }
  updateAppHeight();
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
    window.visualViewport.addEventListener("scroll", updateAppHeight, { passive: true });
  }
  document.addEventListener("focusout", function () {
    setTimeout(updateAppHeight, 120);
    setTimeout(updateAppHeight, 350);
    setTimeout(updateAppHeight, 650);
  });
})();

/* ACADEMIA ÁGUIA — JavaScript puro otimizado. */
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, updatePassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

/* Insira  real neste campo, diretamente no SPCK. */
const firebaseConfig = {
  apiKey: "AIzaSyDH2XQlOTnerd232XLJdcMAqM4NsTSsd-s",
  authDomain: "academia-aguia.firebaseapp.com",
  projectId: "academia-aguia",
  storageBucket: "academia-aguia.firebasestorage.app",
  messagingSenderId: "573048573909",
  appId: "1:573048573909:web:f129a3f044543ec9e4b75c"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const secondaryApp = initializeApp(firebaseConfig, "AcademiaAguiaUserCreation");
const secondaryAuth = getAuth(secondaryApp);
const authEmail = value => {
  const v=String(value||"").trim().toLowerCase();
  return v.includes("@") ? v : `${v.replace(/[^a-z0-9._-]/g,"")}@academia-aguia.com`;
};
let db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[]};

const subjectsDefault = [
  "Língua Portuguesa",
  "Matemática",
  "Raciocínio Lógico",
  "História de Pernambuco",
  "Geografia",
  "Informática",
  "Direito Constitucional",
  "Direito Administrativo",
  "Direitos Humanos",
  "Legislação aplicada à PMPE"
];
let currentUser=null, page="dashboard", draftBlocks=[];
async function readCollection(name){const snap=await getDocs(collection(firestore,name));return snap.docs.map(d=>({id:d.id,...d.data()}));}
async function loadCloudData(){
  const attemptPromise=currentUser.role==="admin" ? readCollection("attempts") : getDocs(query(collection(firestore,"attempts"),where("userId","==",currentUser.id))).then(s=>s.docs.map(d=>({id:d.id,...d.data()})));
  const [users,subjects,posts,questions,attempts,notices,library]=await Promise.all([readCollection("users"),readCollection("subjects"),readCollection("posts"),readCollection("questions"),attemptPromise,readCollection("notices"),readCollection("library")]);
  db={users,subjects,posts,questions,attempts,notices,library};
  if(currentUser.role==="admin" && !subjects.length){await Promise.all(subjectsDefault.map((name,i)=>setDoc(doc(firestore,"subjects","s"+i),{name})));db.subjects=await readCollection("subjects");}
  currentUser=db.users.find(u=>u.id===auth.currentUser.uid)||currentUser;
}
async function saveDoc(name,item){const data={...item};delete data.id;await setDoc(doc(firestore,name,item.id),data);}
async function removeDoc(name,id){await deleteDoc(doc(firestore,name,id));}
function reportCloudError(err){console.error(err);const map={"auth/invalid-credential":"Matrícula ou senha incorretas.","auth/user-not-found":"Conta não encontrada.","auth/wrong-password":"Matrícula ou senha incorretas.","auth/email-already-in-use":"Essa matrícula já está cadastrada.","auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.","permission-denied":"Operação bloqueada pelas regras do Firestore. O usuário pode não ter permissão para esta disciplina."};toast(map[err.code]||"Não foi possível concluir. Verifique a conexão e a configuração do Firebase.",true);}
function uid(){return "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg,bad=false){const el=document.getElementById("toast");el.textContent=msg;el.style.background=bad?"#a53b43":"#168447";el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function roleName(r){return r==="admin"?"Administrador":r==="teacher"?"Professor":"Aluno"}
function subjectName(id){return db.subjects.find(s=>s.id===id)?.name||"Sem disciplina"}
function teacherSubjectId(){return currentUser?.role==="teacher" ? (currentUser.subjectId||"") : ""}
function subjectOptionsForCurrentUser(){
  const list=currentUser?.role==="teacher" ? db.subjects.filter(s=>s.id===teacherSubjectId()) : db.subjects;
  return list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
}
function safeTeacherPhoto(path){
  const value=String(path||"").trim();
  if(!value || !/^assets\/imagens\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i.test(value)) return "";
  return value;
}
function setScreen(id){["loginScreen","passwordScreen","mainScreen"].forEach(x=>document.getElementById(x).classList.toggle("hidden",x!==id))}


async function login(e){
  e.preventDefault();

  const username=document.getElementById("loginUser").value.trim();
  const password=document.getElementById("loginPassword").value;

  if(!username||!password){
    toast("Informe sua matrícula e senha.",true);
    return;
  }

  let etapa="Iniciando login";

  try{
    etapa="Autenticando no Firebase";

    const credential=await signInWithEmailAndPassword(
      auth,
      authEmail(username),
      password
    );

    etapa="Buscando perfil no Firestore";

    const profile=await getDoc(
      doc(firestore,"users",credential.user.uid)
    );

    if(!profile.exists()){
      await signOut(auth);
      throw new Error("A autenticação funcionou, mas o perfil não foi encontrado.");
    }

    currentUser={id:profile.id,...profile.data()};

    etapa="Carregando dados do sistema";

    await loadCloudData();

    etapa="Abrindo a plataforma";

    if(currentUser.mustChange===true){
      setScreen("passwordScreen");
    }else{
      enterApp();
    }

  }catch(err){
    console.error("ERRO ACADEMIA ÁGUIA:",err);

    alert(
      "DIAGNÓSTICO DO LOGIN\n\n"+
      "Etapa: "+etapa+"\n\n"+
      "Código: "+(err.code||"Sem código")+"\n\n"+
      "Mensagem: "+(err.message||"Erro desconhecido")
    );
  }
}


function enterApp(){
  setScreen("mainScreen");
  document.getElementById("userLabel").textContent=currentUser.name+" • "+roleName(currentUser.role);
  document.getElementById("teacherNav").classList.toggle("hidden",currentUser.role!=="teacher");
  document.getElementById("adminNav").classList.toggle("hidden",currentUser.role!=="admin");
  go("dashboard");
}

async function changePassword(e){
  e.preventDefault();
  const p=document.getElementById("newPassword").value,c=document.getElementById("confirmPassword").value;
  if(p.length<6){toast("A senha precisa ter pelo menos 6 caracteres.",true);return;}
  if(p!==c){toast("As senhas não coincidem.",true);return;}
  try{await updatePassword(auth.currentUser,p);await updateDoc(doc(firestore,"users",currentUser.id),{mustChange:false});currentUser.mustChange=false;toast("Senha alterada com sucesso.");enterApp();}
  catch(err){reportCloudError(err);}
}
async function logout(){try{await signOut(auth);}catch(err){console.error(err);}currentUser=null;db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[]};document.getElementById("loginForm").reset();setScreen("loginScreen");}

function go(p){
  page=p;
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  document.getElementById("mobilePageTitle").textContent=({dashboard:"Painel inicial",subjects:"Disciplinas e aulas",questions:"Questões e simulados",library:"Biblioteca",teachers:"Corpo docente",performance:"Meu desempenho",editor:"Central de publicação",myPosts:"Minhas publicações",myProfile:"Meu perfil docente",admin:"Painel administrativo",users:"Usuários e matrículas",manageSubjects:"Gerenciar disciplinas",manageContent:"Gerenciar publicações"})[p]||"Academia Águia";
  
  const contentArea = document.getElementById("pageContent");
  contentArea.classList.remove("page-fade");
  void contentArea.offsetWidth; // Força reflow para reiniciar animação
  contentArea.innerHTML=renderPage();
  contentArea.classList.add("page-fade");
  document.getElementById("sidebar").classList.remove("open");
}

function head(title,desc,action=""){return `<div class="page-head"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function empty(msg){return `<div class="empty">${msg}</div>`}
function renderPage(){switch(page){case"dashboard":return dashboard();case"subjects":return subjectsPage();case"questions":return questionsPage();case"library":return libraryPage();case"teachers":return teachersPage();case"performance":return performancePage();case"editor":return editorPage();case"myPosts":return myPostsPage();case"myProfile":return profilePage();case"admin":return adminPage();case"users":return usersPage();case"manageSubjects":return manageSubjectsPage();case"manageContent":return manageContentPage();default:return dashboard()}}

function dashboard(){const myAttempts=db.attempts.filter(a=>a.userId===currentUser.id),correct=myAttempts.reduce((n,a)=>n+a.correct,0),total=myAttempts.reduce((n,a)=>n+a.total,0),posts=db.posts.length,qs=db.questions.length,materials=db.library.length+db.posts.filter(p=>p.blocks?.some(b=>b.type==="image"||b.type==="link")).length;return `${head(`Bem-vindo, ${esc(currentUser.name)}`,"Sua central de formação, estudo e preparação.")}<div class="grid"><div class="stat-card"><span class="stat-icon">▤</span><div class="stat-label">Aulas e publicações</div><strong>${posts}</strong><span class="small-text">Conteúdos disponíveis</span></div><div class="stat-card"><span class="stat-icon">☑</span><div class="stat-label">Questões disponíveis</div><strong>${qs}</strong><span class="small-text">Banco de questões</span></div><div class="stat-card"><span class="stat-icon">▣</span><div class="stat-label">Materiais</div><strong>${materials}</strong><span class="small-text">Biblioteca e anexos</span></div><div class="stat-card"><span class="stat-icon">▥</span><div class="stat-label">Meu aproveitamento</div><strong>${total?Math.round(correct/total*100):0}%</strong><span class="small-text">${total} questões respondidas</span></div></div><div class="grid two section-gap"><div class="panel"><h3>Disciplinas</h3><div class="grid two">${db.subjects.slice(0,6).map(s=>`<button class="nav-link" data-subject="${s.id}">▤ <span>${esc(s.name)}</span></button>`).join("")}</div><div class="actions"><button class="btn outline" data-page="subjects">Ver todas as disciplinas</button></div></div><div class="panel"><h3>Avisos da administração</h3>${db.notices.length?db.notices.slice().reverse().slice(0,4).map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.body)}</div><small class="small-text">${esc(n.date)}</small></div>`).join(""):empty("Nenhum aviso publicado até o momento.")}</div></div><div class="panel section-gap"><h3>Atividades recentes</h3>${recentActivity()}</div>`}
function recentActivity(){const items=[...db.posts.map(p=>({label:"Publicação: "+p.title,date:p.date})),...db.attempts.map(a=>({label:"Simulado/questões concluído: "+a.correct+"/"+a.total,date:a.date}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);return items.length?items.map(x=>`<div class="notice">${esc(x.label)} <span class="small-text">• ${esc(x.date)}</span></div>`).join(""):empty("As atividades aparecerão aqui conforme forem realizadas.")}
function subjectFilter(){return `<option value="">Todas as disciplinas</option>`+db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}
function subjectsPage(){return `${head("Disciplinas e aulas","Explore os conteúdos organizados por matéria.")}<div class="panel"><div class="field"><label>Filtrar disciplina</label><select id="subjectFilter">${subjectFilter()}</select></div><div id="subjectResults">${subjectResults("")}</div></div>`}
function subjectResults(id){const posts=db.posts.filter(p=>!id||p.subjectId===id);return posts.length?posts.slice().reverse().map(postCard).join(""):empty("Ainda não há aulas publicadas nesta disciplina.")}
function postCard(p){return `<article class="item-card"><div class="meta">${esc(subjectName(p.subjectId))} • ${esc(p.date)} • ${esc(p.authorName)}</div><h3>${esc(p.title)}</h3>${(p.blocks||[]).map(renderBlock).join("")}<div class="small-text">Assunto: ${esc(p.topic||"Não informado")}</div></article>`}
function renderBlock(b){if(b.type==="text")return `<div class="block">${esc(b.text).replace(/\n/g,"<br>")}</div>`;if(b.type==="image")return `<figure><img class="post-image" src="${b.data}" alt="${esc(b.caption||b.title||"Imagem da aula")}"><figcaption class="small-text">${esc(b.caption||b.title||"")}</figcaption></figure>`;if(b.type==="link"){let safeUrl=b.url||"#";if(safeUrl&&!/^https?:\/\//i.test(safeUrl))safeUrl="https://"+safeUrl;return `<div class="block"><b>${esc(b.title||"Material externo")}</b><p>${esc(b.description||"")}</p><a href="${esc(safeUrl)}" target="_blank" rel="noopener">Abrir material ↗</a></div>`;}if(b.type==="question"){const q=db.questions.find(x=>x.id===b.questionId);return q?`<div class="block"><b>Questão de fixação</b><p>${esc(q.prompt)}</p><button class="btn secondary" data-page="questions">Resolver questões</button></div>`:""}return ""}
function questionsPage(){const qs=db.questions;return `${head("Questões e simulados","Pratique, confira suas respostas e acompanhe seu resultado.")}<div class="panel"><div class="inline"><div class="field"><label>Disciplina</label><select id="questionSubject">${subjectFilter()}</select></div><div class="field"><label>Modo de correção</label><select id="questionMode"><option value="instant">Correção imediata</option><option value="end">Corrigir ao finalizar</option></select></div></div><div id="questionList">${questionList("")}</div></div>`}
function questionList(sub){const qs=db.questions.filter(q=>!sub||q.subjectId===sub);return qs.length?qs.map(q=>`<div class="item-card"><div class="meta">${esc(subjectName(q.subjectId))} • ${esc(q.topic||"")}</div><b>${esc(q.prompt)}</b><div id="q-${q.id}">${q.options.map((o,i)=>`<label class="choice"><input type="radio" name="ans-${q.id}" value="${i}"> <b>${"ABCD"[i]}.</b> ${esc(o)}</label>`).join("")}<button class="btn primary" data-answer="${q.id}">Responder</button></div><div id="result-${q.id}"></div></div>`).join(""):empty("Nenhuma questão cadastrada ainda.")}

function answerQuestion(id){
  const q=db.questions.find(x=>x.id===id),selected=document.querySelector(`input[name="ans-${id}"]:checked`);
  if(!selected){toast("Selecione uma alternativa.",true);return}
  const ok=Number(selected.value)===q.answer;
  const result=document.getElementById("result-"+id);
  result.innerHTML=`<div class="question-result ${ok?"correct":"incorrect"}"><b>${ok?"Resposta correta!":"Resposta incorreta."}</b><p>Gabarito: ${"ABCD"[q.answer]}. ${esc(q.options[q.answer])}</p><p>${esc(q.explanation||"Sem comentário do professor.")}</p></div>`;
  document.querySelectorAll(`#q-${id} input`).forEach(x=>x.disabled=true);
  const btn = document.querySelector(`#q-${id} button`);
  if(btn) btn.disabled=true;
  
  // Scroll suave até o resultado no celular
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const attempt={id:uid(),userId:currentUser.id,subjectId:q.subjectId,correct:ok?1:0,total:1,date:new Date().toLocaleString("pt-BR")};
  db.attempts.push(attempt);
  saveDoc("attempts",attempt).catch(reportCloudError);
}

function libraryPage(){return `${head("Biblioteca","Materiais complementares, PDFs, imagens e links.")}<div class="panel"><div class="form-grid"><div class="field"><label>Filtrar por disciplina</label><select id="libraryFilter">${subjectFilter()}</select></div><div class="field"><label>Buscar material</label><input id="librarySearch" placeholder="Digite um título ou assunto"></div></div><div id="libraryResults">${libraryResults("","")}</div></div>`}
function libraryResults(sub,term){const list=db.library.filter(x=>(!sub||x.subjectId===sub)&&(!term||(x.title+x.description).toLowerCase().includes(term.toLowerCase())));return list.length?list.map(x=>{let safeUrl=x.url||"#";if(safeUrl&&!/^https?:\/\//i.test(safeUrl))safeUrl="https://"+safeUrl;return `<div class="item-card"><div class="meta">${esc(subjectName(x.subjectId))} • ${esc(x.kind)}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p>${x.url?`<a target="_blank" rel="noopener" href="${esc(safeUrl)}">Abrir material ↗</a>`:""}</div>`}).join(""):empty("Nenhum material encontrado.")}

function teachersPage(){const ts=db.users.filter(u=>u.role==="teacher");return `${head("Corpo docente","Conheça os professores e suas áreas de atuação.")}<div class="grid two">${ts.length?ts.map(t=>{const photo=safeTeacherPhoto(t.photoPath);return `<div class="item-card"><div class="teacher-row">${photo?`<img class="avatar" style="object-fit:cover" src="${esc(photo)}" alt="Foto de ${esc(t.name)}">`:`<div class="avatar" style="display:grid;place-items:center;color:var(--gold);font-size:28px">♙</div>`}<div><h3>${esc(t.name)}</h3><div class="meta">${esc(subjectName(t.subjectId)||t.subject||t.area||"Professor")}</div></div></div><p>${esc(t.bio||"Apresentação não cadastrada.")}</p></div>`}).join(""):empty("Nenhum professor cadastrado.")}</div>`}
function performancePage(){const a=db.attempts.filter(x=>x.userId===currentUser.id),correct=a.reduce((n,x)=>n+x.correct,0),total=a.reduce((n,x)=>n+x.total,0),by={};a.forEach(x=>{const k=subjectName(x.subjectId);by[k]??={c:0,t:0};by[k].c+=x.correct;by[k].t+=x.total});return `${head("Meu desempenho","Acompanhe sua evolução nas atividades realizadas.")}<div class="grid three"><div class="stat-card"><div class="stat-label">Questões respondidas</div><strong>${total}</strong></div><div class="stat-card"><div class="stat-label">Acertos</div><strong>${correct}</strong></div><div class="stat-card"><div class="stat-label">Aproveitamento</div><strong>${total?Math.round(correct/total*100):0}%</strong></div></div><div class="panel section-gap"><h3>Desempenho por disciplina</h3>${Object.keys(by).length?Object.entries(by).map(([k,v])=>`<p>${esc(k)} — ${v.c}/${v.t} (${Math.round(v.c/v.t*100)}%)</p><div class="progress"><span style="width:${v.c/v.t*100}%"></span></div>`).join(""):empty("Responda questões para gerar seu relatório.")}</div><div class="panel section-gap"><h3>Histórico de tentativas</h3>${a.length?a.slice().reverse().map(x=>`<div class="notice">${esc(subjectName(x.subjectId))}: ${x.correct}/${x.total} • ${esc(x.date)}</div>`).join(""):empty("Nenhuma tentativa registrada.")}</div>`}

function editorPage(){return `${head("Central de publicação","Monte aulas com texto, imagens, links e questões em uma mesma sequência.")}<div class="panel"><div class="form-grid"><div class="field"><label>Título da aula *</label><input id="postTitle" placeholder="Ex.: Classes de palavras"></div><div class="field"><label>Disciplina *</label><select id="postSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select>${currentUser.role==="teacher"?`<small class="small-text">Disciplina definida pela administração: ${esc(subjectName(teacherSubjectId()))}</small>`:""}</div></div><div class="field"><label>Assunto / tópico</label><input id="postTopic" placeholder="Ex.: Substantivo"></div><div class="tabs"><button class="tab" data-addblock="text">＋ Texto</button><button class="tab" data-addblock="image">＋ Imagem</button><button class="tab" data-addblock="link">＋ Link</button><button class="tab" data-addblock="question">＋ Questão existente</button></div><div id="blockEditor">${draftBlocks.length?draftBlocks.map((b,i)=>blockEditor(b,i)).join(""):empty("Adicione os blocos que formarão sua aula.")}</div><div class="actions"><button class="btn primary" id="publishPost">Publicar aula</button><button class="btn outline" id="clearDraft">Limpar editor</button></div><p class="small-text">As publicações ficam visíveis aos alunos imediatamente. O administrador pode revisá-las e removê-las.</p></div><div class="panel section-gap"><h3>Cadastro rápido de questão</h3>${questionForm(false)}</div><div class="panel section-gap"><h3>Adicionar material à biblioteca</h3>${libraryForm()}</div>`}
function blockEditor(b,i){let body="";if(b.type==="text")body=`<textarea data-blockfield="text" data-index="${i}" placeholder="Escreva o conteúdo da aula...">${esc(b.text||"")}</textarea>`;if(b.type==="image")body=`<input type="file" accept="image/*" data-imageblock="${i}"><input data-blockfield="caption" data-index="${i}" placeholder="Legenda da imagem" value="${esc(b.caption||"")}">${b.data?`<img class="file-preview" src="${b.data}">`:""}`;if(b.type==="link")body=`<input data-blockfield="title" data-index="${i}" placeholder="Título do link" value="${esc(b.title||"")}"><input data-blockfield="url" data-index="${i}" placeholder="https://..." value="${esc(b.url||"")}"><textarea data-blockfield="description" data-index="${i}" placeholder="Descrição">${esc(b.description||"")}</textarea>`;if(b.type==="question")body=`<select data-blockfield="questionId" data-index="${i}"><option value="">Selecione uma questão</option>${db.questions.map(q=>`<option value="${q.id}" ${q.id===b.questionId?"selected":""}>${esc(q.prompt.slice(0,80))}</option>`).join("")}</select>`;return `<div class="block"><div class="block-toolbar"><b>BLOCO ${i+1} — ${b.type.toUpperCase()}</b><div><button class="btn outline" data-move="${i}" data-dir="-1">↑</button> <button class="btn outline" data-move="${i}" data-dir="1">↓</button> <button class="btn danger" data-removeblock="${i}">Remover</button></div></div>${body}</div>`}
function questionForm(admin){return `<div class="field"><label>Disciplina</label><select id="qSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select></div><div class="field"><label>Assunto</label><input id="qTopic" placeholder="Assunto da questão"></div><div class="field"><label>Enunciado *</label><textarea id="qPrompt" placeholder="Digite o enunciado"></textarea></div><div class="form-grid">${["A","B","C","D"].map((x,i)=>`<div class="field"><label>Alternativa ${x} *</label><input id="qOpt${i}" placeholder="Alternativa ${x}"></div>`).join("")}</div><div class="form-grid"><div class="field"><label>Gabarito</label><select id="qAnswer"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div><div class="field"><label>Comentário do professor</label><input id="qExplanation" placeholder="Explique a resposta"></div></div><button class="btn secondary" id="saveQuestion">Cadastrar questão</button>`}
function libraryForm(){return `<div class="form-grid"><div class="field"><label>Título</label><input id="libTitle"></div><div class="field"><label>Disciplina</label><select id="libSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select></div></div><div class="form-grid"><div class="field"><label>Tipo</label><select id="libKind"><option>PDF</option><option>Imagem</option><option>Link</option><option>Apostila</option><option>Resumo</option><option>Material complementar</option></select></div><div class="field"><label>Endereço URL (quando aplicável)</label><input id="libUrl" placeholder="https://..."></div></div><div class="field"><label>Descrição</label><textarea id="libDescription"></textarea></div><button class="btn secondary" id="saveLibrary">Salvar material</button>`}
function myPostsPage(){const list=db.posts.filter(p=>p.authorId===currentUser.id);return `${head("Minhas publicações","Consulte, edite ou exclua os conteúdos que você publicou.")}${list.length?list.slice().reverse().map(p=>`<div class="item-card"><div class="meta">${esc(subjectName(p.subjectId))} • ${esc(p.date)}</div><h3>${esc(p.title)}</h3><p>${esc(p.topic||"")}</p><div class="actions"><button class="btn outline" data-editpost="${p.id}">Editar</button><button class="btn danger" data-deletepost="${p.id}">Excluir</button></div></div>`).join(""):empty("Você ainda não publicou aulas.")}`}
function profilePage(){return `${head("Meu perfil docente","Atualize sua apresentação no corpo docente.")}<div class="panel"><form id="profileForm"><div class="field"><label>Nome de exibição</label><input id="profileName" value="${esc(currentUser.name)}" required></div><div class="field"><label>Disciplina principal</label><input value="${esc(subjectName(currentUser.subjectId)||currentUser.subject||"Não definida")}" disabled></div><div class="field"><label>Área de atuação</label><input id="profileArea" value="${esc(currentUser.area||"")}"></div><div class="field"><label>Apresentação</label><textarea id="profileBio">${esc(currentUser.bio||"")}</textarea></div><p class="small-text">A disciplina e a foto do perfil são definidas pela administração.</p><button class="btn primary">Salvar perfil</button></form></div>`}
function adminPage(){const teachers=db.users.filter(u=>u.role==="teacher").length,students=db.users.filter(u=>u.role==="student").length;return `${head("Painel administrativo","Visão geral e ferramentas de gestão da Academia Águia.")}<div class="grid"><div class="stat-card"><div class="stat-label">Alunos cadastrados</div><strong>${students}</strong></div><div class="stat-card"><div class="stat-label">Professores</div><strong>${teachers}</strong></div><div class="stat-card"><div class="stat-label">Publicações</div><strong>${db.posts.length}</strong></div><div class="stat-card"><div class="stat-label">Questões</div><strong>${db.questions.length}</strong></div></div><div class="grid two section-gap"><div class="panel"><h3>Publicar aviso</h3><div class="field"><label>Título</label><input id="noticeTitle"></div><div class="field"><label>Mensagem</label><textarea id="noticeBody"></textarea></div><button class="btn primary" id="publishNotice">Publicar aviso</button></div><div class="panel"><h3>Atividade recente</h3>${recentActivity()}</div></div><div class="panel section-gap"><h3>Estado do armazenamento</h3><p class="muted">010</p><button class="btn outline" id="exportData">Exportar cópia dos dados (JSON)</button></div>`}
function usersPage(){return `${head("Usuários e matrículas","Cadastre contas e forneça uma senha provisória para o primeiro acesso.")}<div class="panel"><h3>Novo usuário</h3><div class="form-grid"><div class="field"><label>Nome completo</label><input id="userName"></div><div class="field"><label>Usuário / matrícula</label><input id="userLogin"></div><div class="field"><label>Perfil</label><select id="userRole"><option value="student">Aluno</option><option value="teacher">Professor</option><option value="admin">Administrador</option></select></div><div class="field"><label>Senha provisória</label><input id="userTempPass" value="Aguila@2026"></div></div><div id="teacherFields" class="panel section-gap hidden"><h3>Dados do professor</h3><div class="field"><label>Disciplina que ficará sob responsabilidade do professor *</label><select id="userSubject"><option value="">Selecione a disciplina</option>${db.subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></div><div class="field"><label>Caminho da foto (opcional)</label><input id="userPhotoPath" placeholder="assets/imagens/professor-portugues.jpg"><small class="small-text">Coloque a imagem na pasta assets/imagens e informe o nome exato do arquivo.</small></div></div><button class="btn primary" id="createUser">Criar cadastro</button><p class="small-text">A conta será obrigada a trocar a senha no primeiro login.</p></div><div class="panel section-gap"><h3>Contas cadastradas</h3><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Disciplina</th><th>Ação</th></tr></thead><tbody>${db.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${roleName(u.role)}</td><td>${u.role==="teacher"?esc(subjectName(u.subjectId)||u.subject||"Não definida"):"—"}</td><td><button class="btn danger" data-deleteuser="${u.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div></div>`}
function manageSubjectsPage(){return `${head("Gerenciar disciplinas","Adicione ou remova matérias disponíveis na plataforma.")}<div class="panel"><div class="inline"><input id="newSubject" placeholder="Nome da nova disciplina"><button class="btn primary" id="addSubject">Adicionar</button></div><div class="section-gap">${db.subjects.map(s=>`<div class="notice inline"><span>${esc(s.name)}</span><button class="btn danger" data-deletesubject="${s.id}">Excluir</button></div>`).join("")}</div></div>`}
function manageContentPage(){return `${head("Gerenciar publicações","O administrador pode revisar e remover qualquer publicação.")}${db.posts.length?db.posts.slice().reverse().map(p=>`<div class="item-card"><div class="meta">${esc(p.authorName)} • ${esc(subjectName(p.subjectId))}</div><h3>${esc(p.title)}</h3><p>${esc(p.topic||"")}</p><button class="btn danger" data-deletepost="${p.id}">Remover publicação</button></div>`).join(""):empty("Ainda não existem publicações.")}`}

function addBlock(type){draftBlocks.push({type});go("editor")}
function updateBlock(i,k,v){if(draftBlocks[i])draftBlocks[i][k]=v}
function saveQuestion(){const prompt=document.getElementById("qPrompt").value.trim(),opts=[0,1,2,3].map(i=>document.getElementById("qOpt"+i).value.trim()),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("qSubject").value;if(!subjectId){toast("Selecione uma disciplina.",true);return}if(!prompt||opts.some(x=>!x)){toast("Preencha enunciado e as quatro alternativas.",true);return}const item={id:uid(),subjectId,topic:document.getElementById("qTopic").value,prompt,options:opts,answer:Number(document.getElementById("qAnswer").value),explanation:document.getElementById("qExplanation").value,authorId:currentUser.id};saveDoc("questions",item).then(()=>{db.questions.push(item);toast("Questão cadastrada.");go("editor")}).catch(reportCloudError)}
function publishPost(){const title=document.getElementById("postTitle").value.trim(),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("postSubject").value;if(!title||!subjectId){toast("Informe o título e a disciplina.",true);return}if(!draftBlocks.length){toast("Adicione pelo menos um bloco à aula.",true);return}for(const b of draftBlocks){if(b.type==="text"&&!b.text?.trim()){toast("Há um bloco de texto vazio.",true);return}if(b.type==="link"&&(!b.url)){toast("Informe a URL do link.",true);return}if(b.type==="question"&&!b.questionId){toast("Selecione a questão do bloco.",true);return}}const item={id:uid(),title,subjectId,topic:document.getElementById("postTopic").value,blocks:JSON.parse(JSON.stringify(draftBlocks)),authorId:currentUser.id,authorName:currentUser.name,date:new Date().toLocaleString("pt-BR")};saveDoc("posts",item).then(()=>{db.posts.push(item);draftBlocks=[];toast("Aula publicada para os alunos.");go("myPosts")}).catch(reportCloudError)}
function saveLibrary(){const title=document.getElementById("libTitle").value.trim(),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("libSubject").value;if(!title||!subjectId){toast("Informe o título e a disciplina.",true);return}const item={id:uid(),title,subjectId,kind:document.getElementById("libKind").value,url:document.getElementById("libUrl").value,description:document.getElementById("libDescription").value,authorId:currentUser.id};saveDoc("library",item).then(()=>{db.library.push(item);toast("Material salvo na biblioteca.");go("library")}).catch(reportCloudError)}
async function saveProfile(e){
  e.preventDefault();
  const patch={name:document.getElementById("profileName").value.trim(),area:document.getElementById("profileArea").value,bio:document.getElementById("profileBio").value};
  try{await updateDoc(doc(firestore,"users",currentUser.id),patch);Object.assign(currentUser,patch);const i=db.users.findIndex(u=>u.id===currentUser.id);if(i>=0)db.users[i]={...db.users[i],...patch};toast("Perfil atualizado.");enterApp();go("myProfile");}
  catch(err){reportCloudError(err);}
}
function fileToData(file,cb){if(!file)return;if(file.size>500000){toast("Imagem muito grande para o Firestore. Escolha uma imagem de até 500 KB.",true);return}const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}
async function createUser(){
  const name=document.getElementById("userName").value.trim(),username=document.getElementById("userLogin").value.trim().toLowerCase(),password=document.getElementById("userTempPass").value,role=document.getElementById("userRole").value;
  const subjectId=role==="teacher"?document.getElementById("userSubject").value:"";
  const photoPath=role==="teacher"?document.getElementById("userPhotoPath").value.trim():"";
  if(!name||!username||password.length<6){toast("Preencha os campos e use senha com 6 caracteres ou mais.",true);return;}
  if(role==="teacher"&&!subjectId){toast("Escolha a disciplina do professor.",true);return;}
  if(role==="teacher"&&photoPath&&!safeTeacherPhoto(photoPath)){toast("Use um caminho válido dentro de assets/imagens, por exemplo assets/imagens/professor-portugues.jpg.",true);return;}
  if(db.users.some(u=>u.username.toLowerCase()===username)){toast("Esse usuário/matrícula já existe.",true);return;}
  try{const cred=await createUserWithEmailAndPassword(secondaryAuth,authEmail(username),password);const assigned=db.subjects.find(s=>s.id===subjectId);const profile={username,name,role,mustChange:true,createdAt:new Date().toISOString(),...(role==="teacher"?{subjectId,subject:assigned?.name||"",photoPath}: {})};await setDoc(doc(firestore,"users",cred.user.uid),profile);await signOut(secondaryAuth);db.users.push({id:cred.user.uid,...profile});toast("Usuário criado. Entregue a matrícula e a senha provisória.");go("users");}
  catch(err){try{await signOut(secondaryAuth);}catch(_){}reportCloudError(err);}
}

function bindPage(){
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.querySelectorAll("[data-subject]").forEach(b=>b.addEventListener("click",()=>{go("subjects");setTimeout(()=>{ $("subjectFilter").value=b.dataset.subject;$("subjectResults").innerHTML=subjectResults(b.dataset.subject)},0)}));
  
  const $=id=>document.getElementById(id);
  if($("subjectFilter"))$("subjectFilter").onchange=e=>$("subjectResults").innerHTML=subjectResults(e.target.value);
  if($("questionSubject"))$("questionSubject").onchange=e=>$("questionList").innerHTML=questionList(e.target.value);
  
  // Delegação unificada para responder questões com segurança
  const qListContainer = $("questionList");
  if(qListContainer){
    qListContainer.onclick = function(e) {
      const btn = e.target.closest("[data-answer]");
      if(btn) answerQuestion(btn.dataset.answer);
    };
  }

  if($("libraryFilter"))$("libraryFilter").onchange=()=> $("libraryResults").innerHTML=libraryResults($("libraryFilter").value,$("librarySearch").value);
  if($("librarySearch"))$("librarySearch").oninput=()=> $("libraryResults").innerHTML=libraryResults($("libraryFilter").value,$("librarySearch").value);

  document.querySelectorAll("[data-addblock]").forEach(b=>b.onclick=()=>addBlock(b.dataset.addblock));
  document.querySelectorAll("[data-blockfield]").forEach(el=>el.oninput=()=>updateBlock(Number(el.dataset.index),el.dataset.blockfield,el.value));
  document.querySelectorAll("[data-removeblock]").forEach(b=>b.onclick=()=>{draftBlocks.splice(Number(b.dataset.removeblock),1);go("editor")});
  document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.move),j=i+Number(b.dataset.dir);if(j>=0&&j<draftBlocks.length){[draftBlocks[i],draftBlocks[j]]=[draftBlocks[j],draftBlocks[i]];go("editor")}});
  document.querySelectorAll("[data-imageblock]").forEach(el=>el.onchange=()=>fileToData(el.files[0],data=>{draftBlocks[Number(el.dataset.imageblock)].data=data;go("editor")}));

  if($("publishPost"))$("publishPost").onclick=publishPost;
  if($("clearDraft"))$("clearDraft").onclick=()=>{draftBlocks=[];go("editor")};
  if($("saveQuestion"))$("saveQuestion").onclick=saveQuestion;
  if($("saveLibrary"))$("saveLibrary").onclick=saveLibrary;
  if($("profileForm"))$("profileForm").onsubmit=saveProfile;
  if($("createUser"))$("createUser").onclick=createUser;
  if($("userRole")){
    const toggleTeacherFields=()=>$("teacherFields")?.classList.toggle("hidden",$("userRole").value!=="teacher");
    $("userRole").onchange=toggleTeacherFields;
    toggleTeacherFields();
  }

  document.querySelectorAll("[data-deleteuser]").forEach(b=>b.onclick=async()=>{if(b.dataset.deleteuser===currentUser.id){toast("Não é possível excluir a conta em uso.",true);return}if(confirm("Remover o perfil e o acesso à plataforma deste usuário?")){try{await removeDoc("users",b.dataset.deleteuser);db.users=db.users.filter(u=>u.id!==b.dataset.deleteuser);toast("Perfil removido. A conta de autenticação permanece no Firebase, mas sem acesso ao sistema.");go("users");}catch(err){reportCloudError(err);}}});
  if($("addSubject"))$("addSubject").onclick=()=>{const n=$("newSubject").value.trim();if(!n){toast("Digite o nome da disciplina.",true);return}if(db.subjects.some(s=>s.name.toLowerCase()===n.toLowerCase())){toast("Disciplina já cadastrada.",true);return}const item={id:uid(),name:n};saveDoc("subjects",item).then(()=>{db.subjects.push(item);go("manageSubjects")}).catch(reportCloudError)};
  document.querySelectorAll("[data-deletesubject]").forEach(b=>b.onclick=()=>{if(confirm("Remover esta disciplina? Conteúdos já publicados serão mantidos.")){removeDoc("subjects",b.dataset.deletesubject).then(()=>{db.subjects=db.subjects.filter(s=>s.id!==b.dataset.deletesubject);go("manageSubjects")}).catch(reportCloudError)}});
  document.querySelectorAll("[data-deletepost]").forEach(b=>b.onclick=()=>{if(confirm("Excluir esta publicação?")){removeDoc("posts",b.dataset.deletepost).then(()=>{db.posts=db.posts.filter(p=>p.id!==b.dataset.deletepost);go(page)}).catch(reportCloudError)}});
  document.querySelectorAll("[data-editpost]").forEach(b=>b.onclick=()=>{const p=db.posts.find(x=>x.id===b.dataset.editpost);if(!p)return;draftBlocks=JSON.parse(JSON.stringify(p.blocks));go("editor");setTimeout(()=>{ $("postTitle").value=p.title;$("postSubject").value=p.subjectId;$("postTopic").value=p.topic||"";const btn=$("publishPost");btn.textContent="Salvar alterações";btn.onclick=()=>{p.title=$("postTitle").value.trim();p.subjectId=currentUser.role==="teacher"?teacherSubjectId():$("postSubject").value;p.topic=$("postTopic").value;p.blocks=JSON.parse(JSON.stringify(draftBlocks));saveDoc("posts",p).then(()=>{draftBlocks=[];toast("Publicação atualizada.");go("myPosts")}).catch(reportCloudError)}},0)});
  if($("publishNotice"))$("publishNotice").onclick=()=>{const title=$("noticeTitle").value.trim(),body=$("noticeBody").value.trim();if(!title||!body){toast("Preencha título e mensagem.",true);return}const item={id:uid(),title,body,date:new Date().toLocaleString("pt-BR")};saveDoc("notices",item).then(()=>{db.notices.push(item);toast("Aviso publicado.");go("admin")}).catch(reportCloudError)};
  if($("exportData"))$("exportData").onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="academia-aguila-backup.json";a.click();URL.revokeObjectURL(a.href)};
}

const originalRender=renderPage;
renderPage=function(){const html=originalRender();setTimeout(bindPage,0);return html};
if(localStorage.getItem("aguila_theme")==="light")document.body.classList.add("light");

document.getElementById("loginForm").addEventListener("submit",login);
document.getElementById("passwordForm").addEventListener("submit",changePassword);
document.getElementById("logoutBtn").addEventListener("click",logout);
document.getElementById("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("aguila_theme",document.body.classList.contains("light")?"light":"dark")});
document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
