// Ufan v0.7 Firebase migration starter — development branch only.
// Uses the official Firebase browser SDK. Never put an Admin SDK key here.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, sendEmailVerification, signOut, reload }
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc,
  updateDoc, query, where, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const cfg = window.UFAN_FIREBASE_CONFIG || {};
const configured = Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain
  && !Object.values(cfg).some(v => typeof v === 'string' && v.startsWith('YOUR_')));
const fbApp = configured ? initializeApp(cfg) : null;
const auth = fbApp ? getAuth(fbApp) : null;
const db = fbApp ? getFirestore(fbApp) : null;

const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const questions=[['records','Do you record daily sales and expenses?','finance'],['separate','Do you separate personal and business money?','finance'],['pricing','Do you know the cost of your products or services?','finance'],['profit','Do you regularly estimate your business profit?','finance'],['stock','Do you track stock or supplies?','operations'],['goals','Do you have a measurable 30-day business goal?','operations'],['backup','Do you keep a backup of important business information?','operations'],['customers','Do you keep customer or order records?','market'],['marketing','Do you have a way to attract customers?','market'],['feedback','Do you collect customer feedback?','market'],['documents','Have you organized your business documents?','formal'],['compliance','Do you understand registration requirements relevant to your business?','formal']];
const tasks=[['records7','Maintain sales records for 7 days',50],['records30','Maintain sales records for 30 days',100],['documents','Organize business documents',40],['inventory','Set up a stock register',50],['goal','Write a measurable business goal',20],['feedback','Summarize customer feedback without personal details',30]];
let me=null,profile=null,business=null,answers={},page='dashboard',claims=[],ledger=[],agentBusinesses=[];
const notice=(message)=>{const box=$('#msg');if(box)box.textContent=message;else alert(message)};
const btn=(name,p)=>`<button class="${page===p?'on':''}" data-page="${p}">${name}</button>`;
function nav(){let items=[['Dashboard','dashboard'],['My business','business'],['Ufan Check','check'],['Ufan Passport','passport'],['Ufan Verify','verify']];if(profile.role==='agent')items=[['Assigned businesses','assigned'],['Ufan Check','check'],['Ufan Verify','verify']];if(profile.role==='admin')items=[['Review desk','review'],['Audit overview','audit']];$('#nav').innerHTML=items.map(([n,p])=>btn(n,p)).join('')+'<button class="secondary" id="logout">Sign out</button>';document.querySelectorAll('[data-page]').forEach(el=>el.onclick=()=>{page=el.dataset.page;render()});$('#logout').onclick=()=>signOut(auth)}
const box=(s)=>`<div class="card">${s}</div>`;
const title=(t,desc='')=>`<h1>${t}</h1>${desc?`<p>${desc}</p>`:''}`;
function readiness(){let total=0,n=0;for(const q of questions){if(answers[q[0]]!==undefined){total+=Number(answers[q[0]]);n++}}return n===12?Math.round(total/24*100):null}
function category(name,keys){let vals=keys.map(k=>answers[k]).filter(v=>v!==undefined);return vals.length?Math.round(vals.reduce((a,b)=>a+Number(b),0)/(keys.length*2)*100):0}


const sortedNewest = items => items.sort((a,b) => {
  const ts = x => x?.created_at?.toMillis?.() || 0;
  return ts(b) - ts(a);
});
const unpack = snap => ({ id: snap.id, ...snap.data() });

async function ensureProfile(user) {
  const ref = doc(db, 'profiles', user.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { display_name: '', role: 'entrepreneur', created_at: serverTimestamp() });
    snap = await getDoc(ref);
  }
  return { id: user.uid, ...snap.data() };
}

async function load(user) {
  me = user;
  if (!me) {
    profile = null; business = null;
    $('#auth').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#identity').textContent = '';
    return;
  }
  await reload(me);
  if (!me.emailVerified) {
    $('#auth').classList.remove('hidden');
    $('#app').classList.add('hidden');
    $('#authmsg').textContent = 'Verify your email, then sign in again. Use fictional data only during testing.';
    return;
  }
  profile = await ensureProfile(me);
  $('#identity').textContent = profile.role + ' · ' + me.email;
  $('#auth').classList.add('hidden');
  $('#app').classList.remove('hidden');
  await refresh();
  nav(); render();
}

async function refresh() {
  if (profile.role === 'admin') {
    const snaps = await getDocs(collection(db, 'claims'));
    claims = sortedNewest(snaps.docs.map(unpack));
    return;
  }
  if (profile.role === 'agent') {
    const assignmentSnaps = await getDocs(query(collection(db,'agent_assignments'), where('agent_id','==',me.uid)));
    const ids = assignmentSnaps.docs.map(s => s.data().business_id);
    agentBusinesses = (await Promise.all(ids.map(id => getDoc(doc(db,'businesses',id)))))
      .filter(s => s.exists()).map(unpack);
    if (!business || !ids.includes(business.id)) business = agentBusinesses[0] || null;
  } else {
    const snaps = await getDocs(query(collection(db,'businesses'), where('owner_id','==',me.uid)));
    const businesses = snaps.docs.map(unpack).sort((a,b) =>
      (a.created_at?.toMillis?.() || 0) - (b.created_at?.toMillis?.() || 0));
    business = businesses[0] || null;
  }
  if (!business) { answers = {}; claims = []; ledger = []; return; }
  const assessmentSnap = await getDoc(doc(db,'assessments',business.id));
  answers = assessmentSnap.exists() ? (assessmentSnap.data().answers || {}) : {};
  const claimSnaps = await getDocs(query(collection(db,'claims'),where('business_id','==',business.id)));
  claims = sortedNewest(claimSnaps.docs.map(unpack));
  const ledgerSnaps = await getDocs(query(collection(db,'points_ledger'),where('business_id','==',business.id)));
  ledger = ledgerSnaps.docs.map(unpack);
}

function render(){nav();let h='';if(profile.role==='admin'&&page!=='review'&&page!=='audit')page='review';if(profile.role==='agent'&&!['assigned','check','verify'].includes(page))page='assigned';
if(page==='dashboard')h=title('Welcome to Ufan','Build a stronger business one practical action at a time.')+`<div class="grid">${box(`<div class="metric"><span>Business readiness</span><strong>${readiness()??'—'}${readiness()===null?'':'%'}</strong></div>`)}${box(`<div class="metric"><span>Approved Ufan Points</span><strong>${ledger.reduce((s,x)=>s+x.points,0)}</strong></div>`)}</div>`+box(`<h2>${esc(business?.name||'Start your business profile')}</h2><p>${business?'Continue your assessment or submit evidence of improvement.':'Create a business profile to begin.'}</p><button data-go="${business?'check':'business'}">Continue</button>`);
if(page==='business')h=title('My business','Only the account owner can create or edit this profile.')+box(`<label>Business name<input id="bizname" maxlength="100" value="${esc(business?.name||'')}"></label><label>Sector<select id="sector">${['retail','agriculture','services','production','other'].map(x=>`<option ${business?.sector===x?'selected':''}>${x}</option>`).join('')}</select></label><button id="savebiz">Save business</button><p class="muted" id="msg"></p>`);
if(page==='assigned')h=title('Assigned businesses','Agents can assist only entrepreneurs assigned by an administrator.')+box(agentBusinesses.length?agentBusinesses.map(b=>`<div class="item"><strong>${esc(b.name)}</strong> <button class="secondary" data-business="${b.id}">Select</button></div>`).join(''):'No businesses have been assigned to this agent.');
if(page==='check')h=title('Ufan Check','12 self-assessment questions across four readiness categories.')+(business?box(questions.map(([id,q],i)=>`<div class="item"><label>${i+1}. ${esc(q)}</label><select data-answer="${id}"><option value="">Choose an answer</option>${['No','Sometimes','Yes, consistently'].map((a,j)=>`<option value="${j}" ${answers[id]===j?'selected':''}>${a}</option>`).join('')}</select></div>`).join('')+'<button id="savecheck">Save assessment</button><p class="muted" id="msg"></p>'):box('Select or create a business first.'));
if(page==='passport')h=title('Ufan Passport','Self-assessed readiness; not a legal, credit or compliance certification.')+box(`<h2>${esc(business?.name||'No business selected')}</h2><div class="metric"><strong>${readiness()===null?'Incomplete':readiness()+'%'}</strong>Overall readiness</div><div class="grid">${[['Finance',['records','separate','pricing','profit']],['Operations',['stock','goals','backup']],['Market',['customers','marketing','feedback']],['Formalization',['documents','compliance']]].map(([n,ids])=>`<div class="metric"><strong>${category(n,ids)}%</strong>${n}</div>`).join('')}</div><p class="muted">Complete all 12 questions for a full readiness score.</p>`);
if(page==='verify')h=title('Ufan Verify','Submit a short description of completed work. Do not enter identity numbers, customer details or financial account data.')+(business?box(`<h2>New achievement claim</h2><label>Task<select id="task">${tasks.map(t=>`<option value="${t[0]}">${esc(t[1])} (${t[2]} points)</option>`).join('')}</select></label><label>Evidence summary<textarea id="evidence" rows="4" maxlength="2000" placeholder="Describe what you completed and how it can be checked (minimum 25 characters)"></textarea></label><button id="submitclaim">Submit for review</button><p class="muted" id="msg"></p>`)+box(`<h2>My claims</h2>${claims.length?claims.map(c=>`<div class="item"><strong>${esc(tasks.find(t=>t[0]===c.task_key)?.[1]||c.task_key)}</strong> <span class="pill">${esc(c.status)}</span><p>${esc(c.review_note||'Awaiting review')}</p></div>`).join(''):'No submissions yet.'}`):box('Select or create a business first.'));
if(page==='review')h=title('Ufan Review Desk','Only accounts assigned the administrator role can approve points.')+box(claims.length?claims.map(c=>`<div class="item"><strong>${esc(c.task_key)}</strong> <span class="pill">${esc(c.status)}</span><p>${esc(c.evidence_summary)}</p><small class="muted">Claim ${esc(c.id)} · Business ${esc(c.business_id)}</small>${c.status==='pending'?`<label>Decision note<textarea id="note-${c.id}" rows="2" placeholder="Minimum 8 characters"></textarea></label><div class="row"><button data-review="${c.id}" data-decision="approved">Approve</button><button class="secondary" data-review="${c.id}" data-decision="more_evidence">Request proof</button><button class="secondary" data-review="${c.id}" data-decision="rejected">Reject</button></div>`:''}</div>`).join(''):'No claims to review.');
if(page==='audit')h=title('Audit overview','Administrative view of the most recent review events.')+box('<div id="auditlist">Loading…</div>');
$('#screen').innerHTML=h;document.querySelectorAll('[data-go]').forEach(x=>x.onclick=()=>{page=x.dataset.go;render()});document.querySelectorAll('[data-business]').forEach(x=>x.onclick=async()=>{business=agentBusinesses.find(b=>b.id===x.dataset.business);await refresh();page='check';render()});
if($('#savebiz'))$('#savebiz').onclick=saveBusiness;if($('#savecheck'))$('#savecheck').onclick=saveAssessment;if($('#submitclaim'))$('#submitclaim').onclick=submitClaim;document.querySelectorAll('[data-review]').forEach(x=>x.onclick=()=>reviewClaim(x.dataset.review,x.dataset.decision));if(page==='audit')loadAudit();}


async function saveBusiness() {
  const name = $('#bizname').value.trim(), sector = $('#sector').value;
  if (name.length < 2 || name.length > 100) return notice('Business name must contain 2–100 characters.');
  try {
    if (business) await updateDoc(doc(db,'businesses',business.id), { name, sector });
    else await addDoc(collection(db,'businesses'), {
      owner_id: me.uid, name, sector, created_at: serverTimestamp()
    });
    await refresh(); render();
  } catch(e) { notice(e.message); }
}
async function saveAssessment() {
  const values = {};
  for (const q of questions) {
    const value = document.querySelector(`[data-answer="${q[0]}"]`).value;
    if (value !== '') values[q[0]] = Number(value);
  }
  try {
    await setDoc(doc(db,'assessments',business.id), {
      business_id: business.id, answers: values, updated_at: serverTimestamp()
    });
    answers = values; notice('Assessment saved.');
  } catch(e) { notice(e.message); }
}
async function submitClaim() {
  const task_key = $('#task').value;
  const evidence_summary = $('#evidence').value.trim();
  if (evidence_summary.length < 25 || evidence_summary.length > 2000)
    return notice('Provide between 25 and 2,000 characters.');
  const claimId = business.id + '_' + task_key;
  try {
    const ref = doc(db,'claims',claimId);
    const previous = await getDoc(ref);
    if (previous.exists() && !['rejected','more_evidence'].includes(previous.data().status))
      return notice('This task already has a pending or approved claim.');
    // One document per business/task; resubmission replaces a rejected request.
    // Final review decisions and points are written ONLY by the future Cloud Function.
    await setDoc(ref, {
      business_id: business.id, task_key, evidence_summary,
      submitted_by: me.uid, status: 'pending', created_at: serverTimestamp()
    });
    await refresh(); render();
  } catch(e) { notice(e.message); }
}
async function reviewClaim() {
  alert('Claim approval is intentionally disabled until the secure Firebase Cloud Function is deployed. No points can be awarded by the browser.');
}
async function loadAudit() {
  try {
    const snaps = await getDocs(collection(db,'audit_events'));
    const events = sortedNewest(snaps.docs.map(unpack)).slice(0,50);
    $('#auditlist').innerHTML = events.map(x => `<div class="item"><strong>${esc(x.action)}</strong> · ${esc(x.created_at?.toDate?.()?.toLocaleString() || '')}<p>${esc(x.detail)}</p></div>`).join('') || 'No audit events yet.';
  } catch(e) { $('#auditlist').textContent = e.message; }
}

$('#login').onclick = async () => {
  if (!auth) return $('#authmsg').textContent = 'Configure firebase-config.js first.';
  try { await signInWithEmailAndPassword(auth, $('#email').value.trim(), $('#password').value); }
  catch(e) { $('#authmsg').textContent = e.message; }
};
$('#signup').onclick = async () => {
  if (!auth) return $('#authmsg').textContent = 'Configure firebase-config.js first.';
  if ($('#password').value.length < 8) return $('#authmsg').textContent = 'Use at least 8 characters.';
  try {
    const credential = await createUserWithEmailAndPassword(auth, $('#email').value.trim(), $('#password').value);
    await sendEmailVerification(credential.user);
    await signOut(auth);
    $('#authmsg').textContent = 'Account created. Check your email to verify your account, then sign in.';
  } catch(e) { $('#authmsg').textContent = e.message; }
};
if (!auth) $('#authmsg').textContent = 'Firebase setup needed. Check firebase-config.js.';
else onAuthStateChanged(auth, user => load(user).catch(e => {
  console.error('Ufan Firebase load error:', e);
  $('#authmsg').textContent = 'Unable to load account: ' + e.message;
}));
