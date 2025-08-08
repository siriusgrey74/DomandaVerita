
function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }
function getGameId(){ const p=new URLSearchParams(location.search); return p.get('game'); }
function randomId(){ return Math.random().toString(36).slice(2,10); }

const db = firebase.database();

const creatorSection = qs('#creatorSection');
const inviteeSection = qs('#inviteeSection');
const selectCardsSection = qs('#selectCardsSection');

const gameId = getGameId();
let role = null;
let currentGameId = null;

if (gameId) {
  role = 'p2';
  currentGameId = gameId;
  creatorSection.classList.add('hidden');
  inviteeSection.classList.remove('hidden');

  const ref = db.ref('games/'+gameId);
  ref.once('value').then(snap => {
    const data = snap.val();
    if(!data || !data.player1){ qs('#inviteeStatus').innerText = "Invito non valido."; return; }
    qs('#player1Info').innerText = "Sei stato invitato da: " + (data.player1.name||"Giocatore 1");
  });

  qs('#nameInput2').addEventListener('input', e=>qs('#acceptBtn').disabled = e.target.value.trim().length < 2 );
  qs('#acceptBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput2').value.trim();
    db.ref('games/'+gameId+'/player2').set({ name, joined: true });
    qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
    db.ref('games/'+gameId).once('value').then(s=>{
      const d=s.val();
      if(d?.player1?.joined){ db.ref('games/'+gameId+'/phase').set('select'); }
    });
  });
  qs('#rejectBtn').addEventListener('click', ()=>{
    db.ref('games/'+gameId+'/refused').set(true);
    qs('#inviteeStatus').innerText = "Hai rifiutato l'invito.";
  });

  db.ref('games/'+gameId+'/phase').on('value', snap=>{
    const phase = snap.val();
    if(phase==='select'){
      inviteeSection.classList.add('hidden');
      startSelectCards('p2');
    }
  });

} else {
  role = 'p1';
  creatorSection.classList.remove('hidden');
  inviteeSection.classList.add('hidden');

  qs('#nameInput').addEventListener('input', e=> qs('#inviteBtn').disabled = e.target.value.trim().length<2 );
  qs('#inviteBtn').addEventListener('click', ()=>{
    const name = qs('#nameInput').value.trim();
    const newId = randomId();
    currentGameId = newId;
    const link = `${location.origin}${location.pathname}?game=${newId}`;
    qs('#gameLink').value = link;
    qs('#gameLinkWrap').classList.remove('hidden');
    qs('#copyBtn').onclick = ()=>{ qs('#gameLink').select(); document.execCommand('copy'); };

    db.ref('games/'+newId).set({
      player1: { name, joined: true },
      createdAt: Date.now(),
      phase: 'waiting'
    });

    db.ref('games/'+newId).on('value', snap=>{
      const data = snap.val();
      if(data?.refused){ qs('#creatorStatus').innerText = "L'invito e' stato rifiutato."; }
      if(data?.player2?.joined){
        qs('#creatorStatus').innerText = "Avversario ha accettato! Si passa alla selezione carte...";
        db.ref('games/'+newId+'/phase').set('select');
      }
    });
  });
}

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
    firebase.database().ref(`games/${currentGameId}/cards_${whichRole}`).set(selected);
    firebase.database().ref(`games/${currentGameId}/ready_${whichRole}`).set(true);
    qs('#selectInfo').textContent = "Selezione inviata. In attesa dell'avversario...";
    qs('#confirmBtn').disabled = true;

    firebase.database().ref(`games/${currentGameId}`).once('value').then(s=>{
      const d=s.val()||{};
      if(d.ready_p1 && d.ready_p2){
        firebase.database().ref(`games/${currentGameId}/phase`).set('betting');
      }
    });
  };

  firebase.database().ref(`games/${currentGameId}`).on('value', snap=>{
    const d = snap.val()||{};
    if(d.ready_p1 && d.ready_p2){
      qs('#selectInfo').textContent = "Entrambi pronti. La partita puo' iniziare!";
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
  qs('#confirmBtn').disabled = (selected.length!==8 && qs('#timeLeft').textContent!=='0');
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
