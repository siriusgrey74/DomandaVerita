
// Utils
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function getGameId(){ const p=new URLSearchParams(location.search); return p.get('game'); }
function randomId(){ return Math.random().toString(36).slice(2,10); }
function saveLocal(state){ localStorage.setItem('dv_game', JSON.stringify(state)); }
function loadLocal(){ try{ return JSON.parse(localStorage.getItem('dv_game')||'null'); }catch(_){ return null; } }
function clearLocal(){ localStorage.removeItem('dv_game'); }

// Firebase
const db = firebase.database();

// Sections
const creatorSection = qs('#creatorSection');
const inviteeSection = qs('#inviteeSection');
const selectCardsSection = qs('#selectCardsSection');

// State
let role = null;
let currentGameId = null;
let gameListener = null;

// Routing
const urlGameId = getGameId();
const saved = loadLocal();

if (urlGameId) {
  // Invitee flow (Player 2)
  role = 'p2';
  currentGameId = urlGameId;
  creatorSection.classList.add('hidden');
  inviteeSection.classList.remove('hidden');

  const ref = db.ref('games/'+currentGameId);
  ref.once('value').then(snap => {
    const data = snap.val();
    if(!data || !data.player1){
      qs('#inviteeStatus').innerText = "Invito non valido o scaduto.";
      return;
    }
    qs('#player1Info').innerText = "Sei stato invitato da: " + (data.player1.name||"Giocatore 1");
  });

  qs('#nameInput2').addEventListener('input', e=> qs('#acceptBtn').disabled = e.target.value.trim().length < 2 );

  qs('#acceptBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput2').value.trim();
    db.ref('games/'+currentGameId+'/player2').set({ name, joined: true });
    qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
    db.ref('games/'+currentGameId).once('value').then(s=>{
      const d=s.val();
      if(d?.player1?.joined){ db.ref('games/'+currentGameId+'/phase').set('select'); }
    });
  });

  qs('#rejectBtn').addEventListener('click', ()=>{
    db.ref('games/'+currentGameId+'/refused').set(true);
    qs('#inviteeStatus').innerText = "Hai rifiutato l'invito.";
  });

  // Listen for cancel/phase changes
  db.ref('games/'+currentGameId).on('value', snap=>{
    const d = snap.val();
    if(!d){ qs('#inviteeStatus').innerText = "Sessione non trovata."; return; }
    if(d.cancelled){ qs('#inviteeStatus').innerText = "Invito annullato dal creatore."; }
    if(d.phase==='select'){
      inviteeSection.classList.add('hidden');
      startSelectCards('p2');
    }
  });

} else {
  // Creator flow (Player 1)
  role = 'p1';
  creatorSection.classList.remove('hidden');

  // Restore pending waiting session if any
  if(saved && saved.role==='p1' && saved.gameId){
    currentGameId = saved.gameId;
    // Show waiting UI with link restored
    const link = `${location.origin}${location.pathname}?game=${currentGameId}`;
    qs('#gameLink').value = link;
    qs('#gameLinkWrap').classList.remove('hidden');
    qs('#creatorStart').classList.add('hidden');
    qs('#copyBtn').onclick = ()=>{ qs('#gameLink').select(); document.execCommand('copy'); };

    // Reattach listener to existing session
    attachCreatorListener(currentGameId);
  } else {
    // Normal create flow
    qs('#nameInput').addEventListener('input', e=> qs('#inviteBtn').disabled = e.target.value.trim().length<2 );
    qs('#inviteBtn').addEventListener('click', ()=>{
      const name = qs('#nameInput').value.trim();
      const newId = randomId();
      currentGameId = newId;
      const link = `${location.origin}${location.pathname}?game=${newId}`;
      qs('#gameLink').value = link;
      qs('#gameLinkWrap').classList.remove('hidden');
      qs('#creatorStart').classList.add('hidden');
      qs('#copyBtn').onclick = ()=>{ qs('#gameLink').select(); document.execCommand('copy'); };

      // Save local session
      saveLocal({ role:'p1', gameId:newId });

      // Init game
      db.ref('games/'+newId).set({
        player1: { name, joined: true },
        createdAt: Date.now(),
        phase: 'waiting'
      });

      // Listen
      attachCreatorListener(newId);
    });
  }

  // Cancel & New Invite
  qs('#cancelBtn').addEventListener('click', ()=>{
    if(!currentGameId) return;
    db.ref('games/'+currentGameId+'/cancelled').set(true);
    // Optionally: db.ref('games/'+currentGameId).remove();
    qs('#creatorStatus').innerText = "Invito annullato.";
    clearLocal();
    qs('#newInviteBtn').classList.remove('hidden');
    qs('#cancelBtn').disabled = true;
  });

  qs('#newInviteBtn').addEventListener('click', ()=>{
    // Reset UI to allow new invite
    qs('#creatorStart').classList.remove('hidden');
    qs('#gameLinkWrap').classList.add('hidden');
    qs('#creatorStatus').innerText = "In attesa che l'avversario accetti...";
    qs('#newInviteBtn').classList.add('hidden');
    qs('#cancelBtn').disabled = false;
    currentGameId = null;
  });
}

function attachCreatorListener(gid){
  if(gameListener) db.ref('games/'+gid).off('value', gameListener);
  gameListener = db.ref('games/'+gid).on('value', snap=>{
    const data = snap.val();
    if(!data){
      qs('#creatorStatus').innerText = "Sessione non trovata.";
      return;
    }
    if(data.refused){
      qs('#creatorStatus').innerText = "L'invito è stato rifiutato.";
      clearLocal();
      qs('#newInviteBtn').classList.remove('hidden');
    }
    if(data.cancelled){
      qs('#creatorStatus').innerText = "Invito annullato.";
      clearLocal();
      qs('#newInviteBtn').classList.remove('hidden');
    }
    if(data.player2 && data.player2.joined){
      qs('#creatorStatus').innerText = "Avversario ha accettato! Si passa alla selezione carte...";
    }
    if(data.phase==='select'){
      // Move both to select phase
      creatorSection.classList.add('hidden');
      startSelectCards('p1');
    }
  });
}

// ---- Card selection ----
const suits = ['p','c','q','f'];
const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

let selected = [];
let timerInt = null;

function startSelectCards(whichRole){
  selectCardsSection.classList.remove('hidden');

  const grid = qs('#cardGrid');
  grid.innerHTML = '';
  for(let r=0; r<ranks.length; r++){
    for(let s=0; s<suits.length; s++){
      const code = ranks[r]+suits[s];
      const cell = document.createElement('div');
      cell.className = 'card';
      cell.textContent = code;
      cell.dataset.card = code;
      cell.addEventListener('click', ()=>toggleCard(code, cell));
      grid.appendChild(cell);
    }
  }

  let timeLeft = 60;
  qs('#timeLeft').textContent = timeLeft;
  if(timerInt) clearInterval(timerInt);
  timerInt = setInterval(()=>{
    timeLeft--;
    if(timeLeft<0){ timeLeft = 0; }
    qs('#timeLeft').textContent = timeLeft;
    if(timeLeft===0){
      clearInterval(timerInt);
      autoComplete();
      qs('#confirmBtn').disabled = false;
    }
  }, 1000);

  qs('#confirmBtn').onclick = ()=>{
    db.ref(`games/${currentGameId}/cards_${whichRole}`).set(selected);
    db.ref(`games/${currentGameId}/ready_${whichRole}`).set(true);
    qs('#selectInfo').textContent = "Selezione inviata. In attesa dell'avversario...";
    qs('#confirmBtn').disabled = true;

    db.ref(`games/${currentGameId}`).once('value').then(s=>{
      const d=s.val()||{};
      if(d.ready_p1 && d.ready_p2){
        db.ref(`games/${currentGameId}/phase`).set('betting');
      }
    });
  };

  db.ref(`games/${currentGameId}`).on('value', snap=>{
    const d = snap.val()||{};
    if(d.ready_p1 && d.ready_p2){
      qs('#selectInfo').textContent = "Entrambi pronti. La partita può iniziare!";
    }
  });
}

function toggleCard(code, el){
  const i = selected.indexOf(code);
  if(i>-1){
    selected.splice(i,1);
    el.classList.remove('selected');
  }else{
    if(selected.length>=8) return;
    selected.push(code);
    el.classList.add('selected');
  }
  updateSelectedView();
}

function updateSelectedView(){
  qs('#selectedCards').textContent = selected.length? selected.join(', ') : '—';
  const timeZero = qs('#timeLeft').textContent==='0';
  qs('#confirmBtn').disabled = (!timeZero && selected.length!==8);
}

function autoComplete(){
  const deck = [];
  for(const r of ranks){ for(const s of suits){ deck.push(r+s); } }
  while(selected.length<8){
    const pick = deck[Math.floor(Math.random()*deck.length)];
    if(!selected.includes(pick)) selected.push(pick);
  }
  qsa('.card').forEach(c=>{
    if(selected.includes(c.dataset.card)) c.classList.add('selected');
  });
  updateSelectedView();
}
