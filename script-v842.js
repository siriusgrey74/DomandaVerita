
function logd(...args){
  const t = '[v8.4.2] ' + args.join(' ');
  console.log(t);
  const box = document.getElementById('diagBox');
  if(box){ box.textContent = t; }
}

// Utils
function qs(s){return document.querySelector(s)};
function qsa(s){return Array.from(document.querySelectorAll(s))};
function params(){return new URLSearchParams(location.search)};
function getGameId(){return params().get('game')};
function getHostId(){return params().get('host')};
function randomId(){return Math.random().toString(36).slice(2,10)};
const LS_KEY='dv_game';
const CID_KEY='dv_client_id';
function getClientId(){ let id=localStorage.getItem(CID_KEY); if(!id){ id = 'cid_'+Math.random().toString(36).slice(2,10); localStorage.setItem(CID_KEY,id);} return id; }
function saveLocal(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
function loadLocal(){ try{return JSON.parse(localStorage.getItem(LS_KEY)||'null')}catch(_){return null} }
function clearLocal(){ localStorage.removeItem(LS_KEY); }

// Firebase
const db = firebase.database();

// Sections
const creatorSection = qs('#creatorSection');
const inviteeSection = qs('#inviteeSection');
const selectCardsSection = qs('#selectCardsSection');
const bettingSection = qs('#bettingSection');
const outcomeSection = qs('#outcomeSection');
const actionSection = qs('#actionSection');

// State
let role=null, currentGameId=null, gameListener=null;
let selectStarted=false;
let confirmed=false;
let myRole=null;
let roleResolved=false;
let deadlineInterval=null, watchdogInterval=null, debounceTimer=null;
const CLIENT_ID = getClientId();
let lastSnapshot=null;

function whoAmI(d){
  if(!d) return '?';
  if(d.player1 && d.player1.clientId===CLIENT_ID) return 'p1';
  if(d.player2 && d.player2.clientId===CLIENT_ID) return 'p2';
  return myRole||'?';
}
function winnerClient(d){
  const w = d?.lastWinner;
  if(w==='p1') return d?.player1?.clientId||null;
  if(w==='p2') return d?.player2?.clientId||null;
  return null;
}
function showDiagGame(d){
  const wh = whoAmI(d);
  const wcid = d?.winnerClientId || winnerClient(d);
  const lastW = d?.lastWinner ?? 'null';
  logd(`gid=${currentGameId} me=${wh} cid=${CLIENT_ID} phase=${d?.phase} lastWinner=${lastW} winnerCID=${wcid}`);
}

// Routing
const urlGameId = getGameId();
const urlHostId = getHostId();
const saved = loadLocal();
logd('Startup game=',urlGameId,'host=',urlHostId,'saved=',JSON.stringify(saved),'cid=',CLIENT_ID);

if(urlHostId){
  role='p1'; currentGameId=urlHostId; myRole='p1'; showCreatorWaiting(currentGameId);
} else if(urlGameId && saved && saved.role==='p1' && saved.gameId===urlGameId){
  role='p1'; currentGameId=urlGameId; myRole='p1'; showCreatorWaiting(currentGameId);
} else if(urlGameId){
  role='p2'; currentGameId=urlGameId; myRole='p2'; showInvitee(currentGameId);
} else {
  role='p1'; myRole='p1'; showCreatorStart();
}

// Creator (p1)
function showCreatorStart(){
  creatorSection.classList.remove('hidden');
  inviteeSection.classList.add('hidden');
  selectCardsSection.classList.add('hidden');
  bettingSection.classList.add('hidden');
  outcomeSection.classList.add('hidden');
  actionSection.classList.add('hidden');
  qs('#nameInput').addEventListener('input', e=> qs('#inviteBtn').disabled = e.target.value.trim().length<2 );
  qs('#inviteBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput').value.trim(); if(!name) return;
    const newId = randomId(); currentGameId=newId;
    const linkOpponent = `${location.origin}${location.pathname}?game=${newId}`;
    const linkHost     = `${location.origin}${location.pathname}?host=${newId}`;
    qs('#creatorStart').classList.add('hidden');
    qs('#gameLinkWrap').classList.remove('hidden');
    qs('#gameLinkOpponent').value = linkOpponent;
    qs('#gameLinkHost').value = linkHost;
    qs('#copyOpponentBtn').onclick = ()=>{ qs('#gameLinkOpponent').select(); document.execCommand('copy'); };
    qs('#copyHostBtn').onclick = ()=>{ qs('#gameLinkHost').select(); document.execCommand('copy'); };
    history.replaceState(null, '', linkHost);
    saveLocal({role:'p1', gameId:newId});
    db.ref('games/'+newId).set({ player1:{name, joined:true, clientId:CLIENT_ID}, createdAt:Date.now(), phase:'waiting', version:'8.4.2' });
    attachCreatorListener(newId);
  });
}

function showCreatorWaiting(gid){
  creatorSection.classList.remove('hidden');
  inviteeSection.classList.add('hidden');
  selectCardsSection.classList.add('hidden');
  bettingSection.classList.add('hidden');
  outcomeSection.classList.add('hidden');
  actionSection.classList.add('hidden');
  const linkOpponent = `${location.origin}${location.pathname}?game=${gid}`;
  const linkHost     = `${location.origin}${location.pathname}?host=${gid}`;
  qs('#creatorStart').classList.add('hidden');
  qs('#gameLinkWrap').classList.remove('hidden');
  qs('#gameLinkOpponent').value = linkOpponent;
  qs('#gameLinkHost').value = linkHost;
  qs('#copyOpponentBtn').onclick = ()=>{ qs('#gameLinkOpponent').select(); document.execCommand('copy'); };
  qs('#copyHostBtn').onclick = ()=>{ qs('#gameLinkHost').select(); document.execCommand('copy'); };
  if(!getHostId()){ history.replaceState(null, '', linkHost); }
  const saved = loadLocal(); if(!saved || saved.gameId!==gid || saved.role!=='p1'){ saveLocal({role:'p1', gameId:gid}); }
  attachCreatorListener(gid);
}

function attachCreatorListener(gid){
  if(gameListener) db.ref('games/'+gid).off('value', gameListener);
  gameListener = db.ref('games/'+gid).on('value', s=>{
    const d=s.val();
    showDiagGame(d);
    if(!d){ qs('#creatorStatus').innerText="Sessione non trovata."; return; }
    if(d.refused){ qs('#creatorStatus').innerText="L'invito è stato rifiutato."; clearLocal(); qs('#newInviteBtn').classList.remove('hidden'); }
    if(d.cancelled){ qs('#creatorStatus').innerText="Invito annullato."; clearLocal(); qs('#newInviteBtn').classList.remove('hidden'); }
    if(d.player2?.joined){ qs('#creatorStatus').innerText="Avversario ha accettato! Si passa alla selezione carte..."; }
    if(d.player1?.clientId===CLIENT_ID && myRole!=='p1'){ myRole='p1'; }
    if(d.phase==='select' && !selectStarted){
      selectStarted=true;
      creatorSection.classList.add('hidden');
      startSelectCards('p1');
    }
  });
  qs('#cancelBtn').onclick = ()=>{
    db.ref('games/'+gid+'/cancelled').set(true);
    qs('#creatorStatus').innerText="Invito annullato.";
    clearLocal();
    history.replaceState(null, '', location.pathname);
    qs('#newInviteBtn').classList.remove('hidden');
    qs('#cancelBtn').disabled = true;
  };
  qs('#newInviteBtn').onclick = ()=>{
    qs('#creatorStart').classList.remove('hidden');
    qs('#gameLinkWrap').classList.add('hidden');
    qs('#creatorStatus').innerText = "In attesa che l'avversario accetti...";
    qs('#newInviteBtn').classList.add('hidden');
    qs('#cancelBtn').disabled = false;
    currentGameId=null;
  };
}

// Invitee (p2)
function showInvitee(gid){
  creatorSection.classList.add('hidden');
  inviteeSection.classList.remove('hidden');
  selectCardsSection.classList.add('hidden');
  bettingSection.classList.add('hidden');
  outcomeSection.classList.add('hidden');
  actionSection.classList.add('hidden');
  const ref = db.ref('games/'+gid);
  ref.once('value').then(s=>{
    const d=s.val();
    if(!d||!d.player1){ qs('#inviteeStatus').innerText="Invito non valido o scaduto."; return; }
    qs('#player1Info').innerText = "Sei stato invitato da: " + (d.player1.name||"Giocatore 1");
  });
  qs('#nameInput2').addEventListener('input', e=> qs('#acceptBtn').disabled = e.target.value.trim().length<2 );
  qs('#acceptBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput2').value.trim();
    db.ref('games/'+gid+'/player2').set({ name, joined:true, clientId:CLIENT_ID });
    qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
    db.ref('games/'+gid).once('value').then(s=>{ const d=s.val(); if(d?.player1?.joined){ db.ref('games/'+gid+'/phase').set('select'); } });
  });
  qs('#rejectBtn').addEventListener('click', ()=>{
    db.ref('games/'+gid+'/refused').set(true);
    qs('#inviteeStatus').innerText="Hai rifiutato l'invito.";
  });
  db.ref('games/'+gid).on('value', s=>{
    const d=s.val()||{};
    showDiagGame(d);
    if(d.player2?.clientId===CLIENT_ID && myRole!=='p2'){ myRole='p2'; }
    if(d.cancelled){ qs('#inviteeStatus').innerText="Invito annullato dal creatore."; }
    if(d.phase==='select' && !selectStarted){
      selectStarted=true;
      inviteeSection.classList.add('hidden');
      startSelectCards('p2');
    }
  });
}

// ---------- SELEZIONE CARTE (FIX) ----------
const suits = ['p','c','q','f'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
let selected = [];
let timerInt = null;
let timeZero = false;

function buildGrid(){
  const grid = document.querySelector('#cardGrid');
  grid.innerHTML = '';
  for (let r=0; r<ranks.length; r++){
    for (let s=0; s<suits.length; s++){
      const code = ranks[r]+suits[s];
      const cell = document.createElement('div');
      cell.className = 'card';
      cell.textContent = code;
      cell.dataset.card = code;
      cell.addEventListener('click', () => toggleCard(code, cell));
      grid.appendChild(cell);
    }
  }
}
function toggleCard(code, el){
  if (el.classList.contains('disabled')) return;
  const i = selected.indexOf(code);
  if (i>-1){ selected.splice(i,1); el.classList.remove('selected'); }
  else { if(selected.length>=8) return; selected.push(code); el.classList.add('selected'); }
  updateSel();
}
function paintSelection(){
  document.querySelectorAll('.card').forEach(c=>{
    if(selected.includes(c.dataset.card)) c.classList.add('selected');
    else c.classList.remove('selected');
  });
  updateSel();
}
function lockGrid(){ document.querySelectorAll('.card').forEach(c=> c.classList.add('disabled')); }
function updateSel(){
  document.querySelector('#selectedCards').textContent = selected.length? selected.join(', '): '—';
  const ok = selected.length===8 || timeZero;
  document.querySelector('#confirmBtn').disabled = !ok;
}
function autoComplete(){
  const deck=[]; for(const r of ranks){ for(const s of suits){ deck.push(r+s); } }
  while(selected.length<8){
    const pick = deck[Math.floor(Math.random()*deck.length)];
    if(!selected.includes(pick)) selected.push(pick);
  }
}
function onTimeExpired(whichRole){
  if(selected.length<8){
    autoComplete();
    paintSelection();
  }
  document.querySelector('#confirmBtn').disabled=false;
  document.querySelector('#selectInfo').textContent="Tempo scaduto: selezione completata automaticamente. Conferma per continuare.";
  lockGrid();
}

function startSelectCards(whichRole){
  selectCardsSection.classList.remove('hidden');
  bettingSection.classList.add('hidden');
  outcomeSection.classList.add('hidden');
  actionSection.classList.add('hidden');

  selected = [];
  buildGrid();

  // Timer 60s con auto-complete
  let tl = 60; timeZero = false;
  document.querySelector('#timeLeft').textContent = tl;
  if (timerInt) clearInterval(timerInt);
  timerInt = setInterval(()=>{
    tl--;
    if (tl<=0){
      tl=0; timeZero=true;
      document.querySelector('#timeLeft').textContent = tl;
      clearInterval(timerInt);
      onTimeExpired(whichRole);
    } else {
      document.querySelector('#timeLeft').textContent = tl;
    }
  },1000);

  // Conferma
  const confirmBtn = document.querySelector('#confirmBtn');
  confirmBtn.onclick = ()=>{
    if (selected.length===0){ autoComplete(); paintSelection(); }
    lockGrid();
    db.ref(`games/${currentGameId}/cards_${whichRole}`).set(selected);
    db.ref(`games/${currentGameId}/ready_${whichRole}`).set(true);
    document.querySelector('#selectInfo').textContent="Selezione confermata. In attesa dell'avversario...";
    confirmBtn.textContent="Confermato ✓";
  };

  // Entrambi pronti → countdown → betting
  db.ref(`games/${currentGameId}`).on('value', snap=>{
    const d = snap.val()||{};
    showDiagGame(d);
    if (d.ready_p1 && d.ready_p2){
      document.querySelector('#selectInfo').textContent="Entrambi pronti. La partita può iniziare!";
      startBettingCountdown(5);
    }
  });
}

function startBettingCountdown(sec){
  const el=qs('#startBettingCountdown');
  if(!el.classList.contains('hidden')) return;
  el.classList.remove('hidden');
  let n=sec;
  const tick=()=>{
    el.textContent = "Si passa alla puntata tra " + n + "…";
    if(n<=0){
      el.textContent = "Caricamento puntata…";
      db.ref(`games/${currentGameId}`).transaction(data=>{
        if(!data) return data;
        if(data.phase!=='select') return data;
        data.phase='betting';
        data.roundInitialized=false;
        if(!data.turn){ data.turn=1; }
        if(typeof data.tokens_p1!=='number') data.tokens_p1=10;
        if(typeof data.tokens_p2!=='number') data.tokens_p2=10;
        data.betDeadlineAt = Date.now() + 15000;
        data.bet_current_p1 = 0;
        data.bet_current_p2 = 0;
        data.bet_ready_p1=false; data.bet_ready_p2=false;
        data.lastWinner = null;
        data.winnerClientId = null;
        return data;
      });
      el.classList.add('hidden');
      return;
    }
    n--;
    setTimeout(tick, 1000);
  };
  tick();
}

// ---------- PUNTATA (FIX) ----------
function startBetting(){
  selectCardsSection.classList.add('hidden');
  bettingSection.classList.remove('hidden');
  outcomeSection.classList.add('hidden');
  actionSection.classList.add('hidden');
}

function setBetControlsEnabled(on){
  qs('#betSelect').disabled = !on;
  qs('#betInput').disabled = !on;
  qs('#betZero').disabled = !on;
  qs('#betLock').textContent = on ? "" : "Caricamento ruolo…";
}

function clampBetInput(max){
  const inp = qs('#betInput');
  const parsed = parseInt(inp.value,10);
  const v = (isNaN(parsed)?0:parsed);
  const v2 = Math.max(0, Math.min(max, v));
  inp.value = v2;
}

function populateBetSelect(max){
  const sel = qs('#betSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  const upper = (typeof max==='number' && max>=0)? max : 20;
  for(let i=0;i<=upper;i++){
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = i;
    sel.appendChild(opt);
  }
  if(prev && parseInt(prev,10)<=upper){ sel.value = prev; }
}

function setupBettingRound(){
  const gameRef = db.ref(`games/${currentGameId}`);

  gameRef.transaction(data=>{
    if(!data) return data;
    if(data.phase!=='betting') return data;
    if(!data.turn){ data.turn = 1; }
    if(typeof data.tokens_p1!=='number') data.tokens_p1 = 10;
    if(typeof data.tokens_p2!=='number') data.tokens_p2 = 10;
    if(!data.roundInitialized){
      if(data.turn>=2){ data.tokens_p1 += 2; data.tokens_p2 += 2; }
      data.roundInitialized = true;
    }
    if(!data.betDeadlineAt){ data.betDeadlineAt = Date.now() + 15000; }
    if(typeof data.bet_current_p1!=='number') data.bet_current_p1=0;
    if(typeof data.bet_current_p2!=='number') data.bet_current_p2=0;
    return data;
  });

  // UI init
  populateBetSelect(undefined);
  qs('#betSelect').value = '0';
  qs('#betInput').value = '0';
  setBetControlsEnabled(false);
  roleResolved = false;

  let localDeadline = null;

  const echo = ()=>{
    const d = lastSnapshot||{};
    const me = whoAmI(d);
    const mine = me==='p1'? d.bet_current_p1 : d.bet_current_p2;
    qs('#betEcho').innerText = (typeof mine==='number')? `Puntata salvata sul server: ${mine}` : '';
  };

  db.ref(`games/${currentGameId}`).on('value', s=>{
    const d=s.val()||{};
    lastSnapshot = d;
    const who = whoAmI(d);
    if((who==='p1' || who==='p2') && !roleResolved){
      myRole = who;
      roleResolved = true;
      setBetControlsEnabled(true);
      // inizializza la mia puntata a 0 in modo esplicito
      db.ref(`games/${currentGameId}/bet_current_${myRole}`).transaction(v=> (typeof v==='number'? v : 0));
    }
    showDiagGame(d);
    if(d.phase!=='betting') return;

    if(typeof d.betDeadlineAt==='number'){
      localDeadline = d.betDeadlineAt;
      const updateTimer = ()=>{
        const rem = Math.max(0, Math.floor((localDeadline - Date.now())/1000));
        qs('#betTimeLeft').textContent = rem;
        if(rem===0){
          setBetControlsEnabled(false);
        }
      };
      updateTimer();
      if(deadlineInterval) clearInterval(deadlineInterval);
      deadlineInterval = setInterval(updateTimer, 200);
      if(watchdogInterval) clearInterval(watchdogInterval);
      watchdogInterval = setInterval(()=>{
        if(localDeadline && Date.now() >= localDeadline){
          resolveRound();
          clearInterval(watchdogInterval);
        }
      }, 250);
    }

    const me = myRole||who;
    const myTok = me==='p1'? d.tokens_p1 : d.tokens_p2;
    const oppTok= me==='p1'? d.tokens_p2 : d.tokens_p1;
    qs('#myTokens').textContent = (typeof myTok==='number')? myTok : '—';
    qs('#turnNo').textContent = d.turn||1;
    if(typeof oppTok==='number' && oppTok<6){ qs('#oppLowWrap').classList.remove('hidden'); }
    else { qs('#oppLowWrap').classList.add('hidden'); }
    if(typeof myTok==='number'){
      const inp = qs('#betInput');
      const sel = qs('#betSelect');
      const userTyping = document.activeElement===inp;
      const prevSel = sel.value;
      inp.max = myTok;
      if(!userTyping) clampBetInput(myTok);
      populateBetSelect(myTok);
      if(userTyping){
        // non toccare mentre digita
      } else {
        if(prevSel) sel.value = prevSel; else sel.value = inp.value;
      }
    }
    echo();
  });

  async function saveCurrent(){
    if(!roleResolved) return;
    const roleNow = myRole;
    const val = parseInt(qs('#betInput').value||'0',10) || 0;
    await db.ref(`games/${currentGameId}/bet_current_${roleNow}`).set(val);
    qs('#betStatus').textContent = `Puntata salvata (${roleNow}=${val}).`;
    echo();
  }

  function debouncedSave(){
    if(debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(()=>{ saveCurrent(); }, 120);
  }

  qs('#betInput').addEventListener('input', ()=>{
    if(!roleResolved) return;
    const max = parseInt(qs('#betInput').max||'0',10) || 0;
    clampBetInput(max);
    qs('#betSelect').value = String(parseInt(qs('#betInput').value||'0',10)||0);
    debouncedSave();
  });
  qs('#betSelect').addEventListener('change', ()=>{
    if(!roleResolved) return;
    const v = parseInt(qs('#betSelect').value||'0',10)||0;
    qs('#betInput').value = String(v);
    debouncedSave();
  });
  qs('#betZero').addEventListener('click', ()=>{
    if(!roleResolved) return;
    qs('#betInput').value = '0';
    qs('#betSelect').value = '0';
    debouncedSave();
  });
}

function resolveRound(){
  const ref = db.ref(`games/${currentGameId}`);
  ref.transaction(data=>{
    if(!data) return data;
    if(data.roundResolved) return data;
    if(data.phase!=='betting') return data;
    const toInt = (x)=>{ const n = parseInt(x,10); return isNaN(n) ? 0 : Math.max(0, n); };
    const b1 = toInt(data.bet_current_p1);
    const b2 = toInt(data.bet_current_p2);
    const t1 = toInt(data.tokens_p1);
    const t2 = toInt(data.tokens_p2);
    const cb1 = Math.min(b1, t1);
    const cb2 = Math.min(b2, t2);
    data.tokens_p1 = t1 - cb1;
    data.tokens_p2 = t2 - cb2;
    let winner = null;
    if(cb1>cb2) winner='p1';
    else if(cb2>cb1) winner='p2';
    else winner = null; // pareggio
    if(!data.rounds) data.rounds={};
    const turn = data.turn||1;
    data.rounds['turn_'+turn] = { bet_p1:cb1, bet_p2:cb2, winner };
    data.roundResolved = true;
    data.betDeadlineAt = null;
    data.lastWinner = winner;
    data.advanceAllowed = false;
    data.phase = 'outcome';
    data.winnerClientId = winner==='p1' ? (data.player1?.clientId||null) : (winner==='p2' ? (data.player2?.clientId||null) : null);
    return data;
  });
}

function showOutcome(){
  const ref = db.ref(`games/${currentGameId}`);
  ref.on('value', s=>{
    const d=s.val()||{};
    showDiagGame(d);
    if(d.phase!=='outcome') return;
    bettingSection.classList.add('hidden');
    outcomeSection.classList.remove('hidden');
    actionSection.classList.add('hidden');
    qs('#outcomeTurn').textContent = d.turn||1;
    const last = d.rounds && d.rounds['turn_'+(d.turn||1)];
    if(!last) return;
    const p1name = (d.player1 && d.player1.name) ? d.player1.name : 'Giocatore 1';
    const p2name = (d.player2 && d.player2.name) ? d.player2.name : 'Giocatore 2';
    const post = qs('#postOutcome'); post.innerHTML='';
    if(last.winner===null){
      qs('#outcomeText').textContent = "Pareggio: nessun vincitore. Entrambi perdono la puntata.";
      qs('#winnerInfo').textContent = "";
      const btn = document.createElement('button');
      btn.textContent = "Vai al turno successivo";
      btn.onclick = ()=> {
        db.ref(`games/${currentGameId}`).transaction(data=>{
          if(!data) return data;
          if(data.phase!=='outcome') return data;
          data.turn = (data.turn||1) + 1;
          data.bet_current_p1 = 0; data.bet_current_p2 = 0;
          data.roundResolved = false;
          data.roundInitialized = false;
          data.phase = 'betting';
          data.advanceAllowed = true;
          data.betDeadlineAt = Date.now() + 15000;
          data.action = null;
          data.lastWinner = null;
          data.winnerClientId = null;
          return data;
        });
      };
      post.appendChild(btn);
    } else {
      const winnerName = last.winner==='p1'? p1name : p2name;
      qs('#outcomeText').textContent = "Esito puntata";
      qs('#winnerInfo').textContent = "Ha vinto la puntata: " + winnerName;
      const btn = document.createElement('button');
      btn.textContent = "Vai alla fase Azione";
      btn.onclick = ()=> {
        db.ref(`games/${currentGameId}`).transaction(data=>{
          if(!data) return data;
          if(data.phase!=='outcome') return data;
          data.phase = 'action';
          data.advanceAllowed = false;
          return data;
        });
      };
      post.appendChild(btn);
    }
  });
}

// Action
function showAction(){
  outcomeSection.classList.add('hidden');
  bettingSection.classList.add('hidden');
  selectCardsSection.classList.add('hidden');
  actionSection.classList.remove('hidden');

  const ref = db.ref(`games/${currentGameId}`);
  ref.on('value', s=>{
    const d=s.val()||{};
    showDiagGame(d);
    if(d.phase!=='action') return;

    const me = whoAmI(d);
    myRole = me;
    const wCid = d.winnerClientId || winnerClient(d);
    const myCid = (me==='p1')? d.player1?.clientId : d.player2?.clientId;
    const iAmWinner = (wCid && wCid === myCid);

    qs('#actionForWinner').classList.toggle('hidden', !iAmWinner);
    qs('#actionForLoser').classList.toggle('hidden', iAmWinner);
    qs('#proceedNextTurn').disabled = !iAmWinner;

    const p1name = (d.player1 && d.player1.name) ? d.player1.name : 'Giocatore 1';
    const p2name = (d.player2 && d.player2.name) ? d.player2.name : 'Giocatore 2';
    const wName = d.lastWinner==='p1'? p1name : (d.lastWinner==='p2'? p2name : 'Nessuno');

    if(d.lastWinner===null){
      qs('#actionStatus').textContent = "Pareggio: nessuna azione.";
    } else if(iAmWinner){
      qs('#actionStatus').textContent = "Hai vinto la puntata. Scegli Domanda o Verità.";
    } else {
      qs('#actionStatus').textContent = wName + " sta scegliendo Domanda o Verità. Attendi…";
    }

    const chooseQuestion = qs('#chooseQuestion');
    const chooseTruth = qs('#chooseTruth');
    const proceedNextTurn = qs('#proceedNextTurn');

    const guardedTx = (mutator)=>{
      db.ref(`games/${currentGameId}`).transaction(data=>{
        if(!data) return data;
        if(data.phase!=='action') return data;
        if(!data.winnerClientId) return data;
        if(data.winnerClientId !== CLIENT_ID) return data;
        return mutator(data);
      });
    };

    chooseQuestion.onclick = ()=> guardedTx((data)=>{ data.action = { by:data.lastWinner, byClientId:data.winnerClientId, mode:'question', at:Date.now() }; return data; });
    chooseTruth.onclick   = ()=> guardedTx((data)=>{ data.action = { by:data.lastWinner, byClientId:data.winnerClientId, mode:'truth', at:Date.now() }; return data; });
    proceedNextTurn.onclick = ()=> guardedTx((data)=>{
      data.turn = (data.turn||1) + 1;
      data.bet_current_p1 = 0; data.bet_current_p2 = 0;
      data.roundResolved = false;
      data.roundInitialized = false;
      data.phase = 'betting';
      data.advanceAllowed = true;
      data.betDeadlineAt = Date.now() + 15000;
      data.action = null;
      return data;
    });
  });
}

// Phase watcher
function watchPhase(){
  db.ref(`games/${currentGameId}`).on('value', s=>{
    const d=s.val()||{};
    const p=d.phase;
    showDiagGame(d);
    if(p==='betting' && d.lastPhase==='outcome' && !d.advanceAllowed){
      db.ref(`games/${currentGameId}/phase`).set('action');
      return;
    }
    if(d.lastPhase!==p){
      db.ref(`games/${currentGameId}/lastPhase`).set(p);
    }

    if(p==='betting'){
      selectCardsSection.classList.add('hidden');
      outcomeSection.classList.add('hidden');
      actionSection.classList.add('hidden');
      startBetting();
      setupBettingRound();
    } else if(p==='outcome'){
      showOutcome();
    } else if(p==='action'){
      showAction();
    }
  });
}

const kick = setInterval(()=>{
  if(currentGameId){
    clearInterval(kick);
    watchPhase();
  }
}, 200);
