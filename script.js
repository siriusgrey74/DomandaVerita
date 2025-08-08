
// Utils
function qs(s){return document.querySelector(s)};
function qsa(s){return Array.from(document.querySelectorAll(s))};
function params(){return new URLSearchParams(location.search)};
function getGameId(){return params().get('game')};
function getHostId(){return params().get('host')};
function randomId(){return Math.random().toString(36).slice(2,10)};
const LS_KEY='dv_game';

function saveLocal(obj){ localStorage.setItem(LS_KEY, JSON.stringify(obj)); }
function loadLocal(){ try{return JSON.parse(localStorage.getItem(LS_KEY)||'null')}catch(_){return null} }
function clearLocal(){ localStorage.removeItem(LS_KEY); }

// Firebase
const db = firebase.database();

// Sections
const creatorSection = qs('#creatorSection');
const inviteeSection = qs('#inviteeSection');
const selectCardsSection = qs('#selectCardsSection');

// State
let role=null, currentGameId=null, gameListener=null;

// Routing
const urlGameId = getGameId();   // invitee param
const urlHostId = getHostId();   // creator restore param
const saved = loadLocal();

// --- Decisione ruolo all'avvio ---
// 1) Se ?host -> creatore (p1)
// 2) Se ?game e localStorage dice che sei p1 della stessa partita -> creatore (fallback)
// 3) Se ?game -> invitato (p2)
// 4) Altrimenti -> creatore nuovo
if(urlHostId){
  role='p1'; currentGameId=urlHostId; showCreatorWaiting(currentGameId);
} else if(urlGameId && saved && saved.role==='p1' && saved.gameId===urlGameId){
  role='p1'; currentGameId=urlGameId; showCreatorWaiting(currentGameId);
} else if(urlGameId){
  role='p2'; currentGameId=urlGameId; showInvitee(currentGameId);
} else {
  role='p1'; showCreatorStart();
}

// ----- Creator (p1) -----
function showCreatorStart(){
  creatorSection.classList.remove('hidden');
  inviteeSection.classList.add('hidden');
  selectCardsSection.classList.add('hidden');

  qs('#nameInput').addEventListener('input', e=> qs('#inviteBtn').disabled = e.target.value.trim().length<2 );
  qs('#inviteBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput').value.trim();
    const newId = randomId(); currentGameId=newId;

    const linkOpponent = `${location.origin}${location.pathname}?game=${newId}`;
    const linkHost     = `${location.origin}${location.pathname}?host=${newId}`;

    // UI
    qs('#creatorStart').classList.add('hidden');
    qs('#gameLinkWrap').classList.remove('hidden');
    qs('#gameLinkOpponent').value = linkOpponent;
    qs('#gameLinkHost').value = linkHost;
    qs('#copyOpponentBtn').onclick = ()=>{ qs('#gameLinkOpponent').select(); document.execCommand('copy'); };
    qs('#copyHostBtn').onclick = ()=>{ qs('#gameLinkHost').select(); document.execCommand('copy'); };

    // Persisti sia URL host che localStorage
    history.replaceState(null, '', linkHost);
    saveLocal({role:'p1', gameId:newId});

    // Init DB
    db.ref('games/'+newId).set({ player1:{name, joined:true}, createdAt:Date.now(), phase:'waiting' });
    attachCreatorListener(newId);
  });
}

function showCreatorWaiting(gid){
  creatorSection.classList.remove('hidden');
  inviteeSection.classList.add('hidden');
  selectCardsSection.classList.add('hidden');

  const linkOpponent = `${location.origin}${location.pathname}?game=${gid}`;
  const linkHost     = `${location.origin}${location.pathname}?host=${gid}`;

  qs('#creatorStart').classList.add('hidden');
  qs('#gameLinkWrap').classList.remove('hidden');
  qs('#gameLinkOpponent').value = linkOpponent;
  qs('#gameLinkHost').value = linkHost;
  qs('#copyOpponentBtn').onclick = ()=>{ qs('#gameLinkOpponent').select(); document.execCommand('copy'); };
  qs('#copyHostBtn').onclick = ()=>{ qs('#gameLinkHost').select(); document.execCommand('copy'); };

  // Se l'URL non contiene host, sostituiscilo (così il refresh è sicuro)
  if(!getHostId()){ history.replaceState(null, '', linkHost); }
  if(!saved || saved.gameId!==gid || saved.role!=='p1'){ saveLocal({role:'p1', gameId:gid}); }

  attachCreatorListener(gid);
}

function attachCreatorListener(gid){
  if(gameListener) db.ref('games/'+gid).off('value', gameListener);
  gameListener = db.ref('games/'+gid).on('value', s=>{
    const d=s.val();
    if(!d){ qs('#creatorStatus').innerText="Sessione non trovata."; return; }
    if(d.refused){ qs('#creatorStatus').innerText="L'invito è stato rifiutato."; clearLocal(); qs('#newInviteBtn').classList.remove('hidden'); }
    if(d.cancelled){ qs('#creatorStatus').innerText="Invito annullato."; clearLocal(); qs('#newInviteBtn').classList.remove('hidden'); }
    if(d.player2?.joined){ qs('#creatorStatus').innerText="Avversario ha accettato! Si passa alla selezione carte..."; }
    if(d.phase==='select'){ creatorSection.classList.add('hidden'); startSelectCards('p1'); }
  });

  // Pulsanti azione
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

// ----- Invitee (p2) -----
function showInvitee(gid){
  creatorSection.classList.add('hidden');
  inviteeSection.classList.remove('hidden');
  selectCardsSection.classList.add('hidden');

  const ref = db.ref('games/'+gid);
  ref.once('value').then(s=>{
    const d=s.val();
    if(!d||!d.player1){ qs('#inviteeStatus').innerText="Invito non valido o scaduto."; return; }
    qs('#player1Info').innerText = "Sei stato invitato da: " + (d.player1.name||"Giocatore 1");
  });

  qs('#nameInput2').addEventListener('input', e=> qs('#acceptBtn').disabled = e.target.value.trim().length<2 );
  qs('#acceptBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput2').value.trim();
    db.ref('games/'+gid+'/player2').set({ name, joined:true });
    qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
    db.ref('games/'+gid).once('value').then(s=>{ const d=s.val(); if(d?.player1?.joined){ db.ref('games/'+gid+'/phase').set('select'); } });
  });
  qs('#rejectBtn').addEventListener('click', ()=>{
    db.ref('games/'+gid+'/refused').set(true);
    qs('#inviteeStatus').innerText="Hai rifiutato l'invito.";
  });

  db.ref('games/'+gid).on('value', s=>{
    const d=s.val()||{};
    if(d.cancelled){ qs('#inviteeStatus').innerText="Invito annullato dal creatore."; }
    if(d.phase==='select'){ inviteeSection.classList.add('hidden'); startSelectCards('p2'); }
  });
}

// ---- Card selection ----
const suits=['p','c','q','f'];
const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
let selected=[]; let timerInt=null;

function startSelectCards(whichRole){
  selectCardsSection.classList.remove('hidden');
  const grid=qs('#cardGrid'); grid.innerHTML='';
  for(let r=0;r<ranks.length;r++){ for(let s=0;s<suits.length;s++){ const code=ranks[r]+suits[s]; const cell=document.createElement('div'); cell.className='card'; cell.textContent=code; cell.dataset.card=code; cell.addEventListener('click',()=>toggleCard(code,cell)); grid.appendChild(cell);}}
  let tl=60; qs('#timeLeft').textContent=tl;
  if(timerInt) clearInterval(timerInt);
  timerInt=setInterval(()=>{ tl--; if(tl<0) tl=0; qs('#timeLeft').textContent=tl; if(tl===0){ clearInterval(timerInt); autoComplete(); qs('#confirmBtn').disabled=false; } },1000);
  qs('#confirmBtn').onclick=()=>{
    db.ref(`games/${currentGameId}/cards_${whichRole}`).set(selected);
    db.ref(`games/${currentGameId}/ready_${whichRole}`).set(true);
    qs('#selectInfo').textContent="Selezione inviata. In attesa dell'avversario...";
    qs('#confirmBtn').disabled=true;
    db.ref(`games/${currentGameId}`).once('value').then(s=>{ const d=s.val()||{}; if(d.ready_p1 && d.ready_p2){ db.ref(`games/${currentGameId}/phase`).set('betting'); }});
  };
  db.ref(`games/${currentGameId}`).on('value', s=>{ const d=s.val()||{}; if(d.ready_p1 && d.ready_p2){ qs('#selectInfo').textContent="Entrambi pronti. La partita può iniziare!"; }});
}
function toggleCard(code, el){ const i=selected.indexOf(code); if(i>-1){ selected.splice(i,1); el.classList.remove('selected'); } else { if(selected.length>=8) return; selected.push(code); el.classList.add('selected'); } updateSel(); }
function updateSel(){ qs('#selectedCards').textContent=selected.length?selected.join(', '):'—'; const t0=qs('#timeLeft').textContent==='0'; qs('#confirmBtn').disabled = (!t0 && selected.length!==8); }
function autoComplete(){ const deck=[]; for(const r of ranks){ for(const s of suits){ deck.push(r+s); } } while(selected.length<8){ const pick = deck[Math.floor(Math.random()*deck.length)]; if(!selected.includes(pick)) selected.push(pick); } qsa('.card').forEach(c=>{ if(selected.includes(c.dataset.card)) c.classList.add('selected'); }); updateSel(); }
