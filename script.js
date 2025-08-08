
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

if(urlGameId){
  // ----- Invitee flow (Player 2) -----
  role='p2'; currentGameId=urlGameId;
  creatorSection.classList.add('hidden'); inviteeSection.classList.remove('hidden');

  const ref = db.ref('games/'+currentGameId);
  ref.once('value').then(s=>{
    const d=s.val();
    if(!d||!d.player1){ qs('#inviteeStatus').innerText="Invito non valido o scaduto."; return; }
    qs('#player1Info').innerText = "Sei stato invitato da: " + (d.player1.name||"Giocatore 1");
  });

  qs('#nameInput2').addEventListener('input', e=> qs('#acceptBtn').disabled = e.target.value.trim().length<2 );
  qs('#acceptBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput2').value.trim();
    db.ref('games/'+currentGameId+'/player2').set({ name, joined:true });
    qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
    db.ref('games/'+currentGameId).once('value').then(s=>{ const d=s.val(); if(d?.player1?.joined){ db.ref('games/'+currentGameId+'/phase').set('select'); } });
  });
  qs('#rejectBtn').addEventListener('click', ()=>{
    db.ref('games/'+currentGameId+'/refused').set(true);
    qs('#inviteeStatus').innerText="Hai rifiutato l'invito.";
  });

  db.ref('games/'+currentGameId).on('value', s=>{
    const d=s.val()||{};
    if(d.cancelled){ qs('#inviteeStatus').innerText="Invito annullato dal creatore."; }
    if(d.phase==='select'){ inviteeSection.classList.add('hidden'); startSelectCards('p2'); }
  });

} else {
  // ----- Creator flow (Player 1) -----
  role='p1'; creatorSection.classList.remove('hidden');

  // Priority 1: URL host param
  if(urlHostId){
    currentGameId=urlHostId;
    restoreWaitingUI(currentGameId);
    attachCreatorListener(currentGameId);
  }
  // Priority 2: LocalStorage
  else if(saved && saved.role==='p1' && saved.gameId){
    currentGameId=saved.gameId;
    restoreWaitingUI(currentGameId);
    attachCreatorListener(currentGameId);
  }
  // New game
  else{
    qs('#nameInput').addEventListener('input', e=> qs('#inviteBtn').disabled = e.target.value.trim().length<2 );
    qs('#inviteBtn').addEventListener('click', ()=>{
      const name = qs('#nameInput').value.trim();
      const newId = randomId(); currentGameId=newId;
      const inviteLink = `${location.origin}${location.pathname}?game=${newId}`;
      // Update UI
      qs('#gameLink').value = inviteLink;
      qs('#creatorStart').classList.add('hidden');
      qs('#gameLinkWrap').classList.remove('hidden');
      qs('#copyBtn').onclick = ()=>{ qs('#gameLink').select(); document.execCommand('copy'); };
      // Persist both in URL and localStorage
      history.replaceState(null, '', `${location.pathname}?host=${newId}`);
      saveLocal({role:'p1', gameId:newId});
      // Init game on DB
      db.ref('games/'+newId).set({ player1:{name, joined:true}, createdAt:Date.now(), phase:'waiting' });
      attachCreatorListener(newId);
    });
  }

  // Cancel button
  qs('#cancelBtn').addEventListener('click', ()=>{
    if(!currentGameId) return;
    db.ref('games/'+currentGameId+'/cancelled').set(true);
    qs('#creatorStatus').innerText="Invito annullato.";
    clearLocal();
    history.replaceState(null, '', location.pathname);
    qs('#newInviteBtn').classList.remove('hidden');
    qs('#cancelBtn').disabled = true;
  });

  // New invite button
  qs('#newInviteBtn').addEventListener('click', ()=>{
    qs('#creatorStart').classList.remove('hidden');
    qs('#gameLinkWrap').classList.add('hidden');
    qs('#creatorStatus').innerText = "In attesa che l'avversario accetti...";
    qs('#newInviteBtn').classList.add('hidden');
    qs('#cancelBtn').disabled = false;
    currentGameId=null;
  });
}

function restoreWaitingUI(gid){
  const inviteLink = `${location.origin}${location.pathname}?game=${gid}`;
  qs('#gameLink').value = inviteLink;
  qs('#creatorStart').classList.add('hidden');
  qs('#gameLinkWrap').classList.remove('hidden');
  qs('#copyBtn').onclick = ()=>{ qs('#gameLink').select(); document.execCommand('copy'); };
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
