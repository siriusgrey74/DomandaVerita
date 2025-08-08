
(function(){
  // --- Helper base ---
  function logd(...args){ const t='[v8.4.7] '+args.join(' '); console.log(t); const b=document.getElementById('diagBox'); if(b) b.textContent=t; }
  function qs(s){ return document.querySelector(s); }
  function params(){ return new URLSearchParams(location.search); }
  function randomId(){ return Math.random().toString(36).slice(2,10); }
  const CID_KEY='dv_client_id';
  function getClientId(){ let id=localStorage.getItem(CID_KEY); if(!id){ id='cid_'+Math.random().toString(36).slice(2,10); localStorage.setItem(CID_KEY,id); } return id; }
  const CLIENT_ID = getClientId();

  // Firebase compat
  const db = firebase.database();

  // --- Routing semplice per questa pagina iniziale ---
  const game = params().get('game');
  const host = params().get('host');
  if (host) {
    // creatore in attesa
    showCreatorWaiting(host);
  } else if (game) {
    // invitato
    showInvitee(game);
  } else {
    // creatore iniziale
    showCreatorStart();
  }

  // --- Clipboard helper ---
  async function copyToClipboard(text){
    try{
      if(navigator.clipboard && window.isSecureContext){
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
      alert('Copiato negli appunti');
    }catch(e){ alert('Copia non riuscita'); }
  }

  // --- Creator: start ---
  function showCreatorStart(){
    logd('creatorStart');
    qs('#creatorSection').classList.remove('hidden');
    qs('#inviteeSection').classList.add('hidden');
    qs('#selectCardsSection').classList.add('hidden');
    qs('#bettingSection').classList.add('hidden');
    qs('#outcomeSection').classList.add('hidden');
    qs('#actionSection').classList.add('hidden');

    const nameInput = qs('#nameInput');
    const inviteBtn = qs('#inviteBtn');

    const onName = () => {
      const ok = (nameInput.value.trim().length >= 2);
      inviteBtn.disabled = !ok;
    };
    nameInput.addEventListener('input', onName);
    onName(); // inizializza stato

    inviteBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim();
      if (!name) return;
      const newId = randomId();
      const linkOpponent = `${location.origin}${location.pathname}?game=${newId}`;
      const linkHost     = `${location.origin}${location.pathname}?host=${newId}`;

      // UI swap
      qs('#creatorStart').classList.add('hidden');
      qs('#gameLinkWrap').classList.remove('hidden');
      qs('#gameLinkOpponent').value = linkOpponent;
      qs('#gameLinkHost').value = linkHost;

      qs('#copyOpponentBtn').onclick = () => copyToClipboard(linkOpponent);
      qs('#copyHostBtn').onclick     = () => copyToClipboard(linkHost);

      // Aggiorna URL per il creatore
      history.replaceState(null, '', linkHost);

      // Scrivi sessione
      await db.ref('games/'+newId).set({
        player1:{ name, joined:true, clientId:CLIENT_ID, role:'p1' },
        createdAt: Date.now(),
        phase:'waiting',
        version:'8.4.7'
      });

      attachCreatorListener(newId);
    }, { once:true }); // evita doppi click
  }

  function attachCreatorListener(gid){
    db.ref('games/'+gid).on('value', s=>{
      const d = s.val()||{};
      logd('creator waiting phase=', d.phase);
      if(d.refused){ qs('#creatorStatus').innerText="L'invito è stato rifiutato."; }
      if(d.cancelled){ qs('#creatorStatus').innerText="Invito annullato."; }
      if(d.player2?.joined){ qs('#creatorStatus').innerText="Avversario ha accettato! Si passa alla selezione carte..."; }
      if(d.phase==='select'){
        // qui normalmente si passa alla pagina completa; v8.4.7 minimale resta alla home
        qs('#creatorStatus').innerText="(Demo) Avvio selezione carte… (versione ridotta)";
      }
    });

    // pulsanti annulla/nuovo (demo)
    qs('#cancelBtn').onclick = async ()=>{
      await db.ref('games/'+gid+'/cancelled').set(true);
      qs('#creatorStatus').innerText="Invito annullato.";
      history.replaceState(null, '', location.pathname);
      qs('#newInviteBtn').classList.remove('hidden');
      qs('#cancelBtn').disabled = true;
    };
    qs('#newInviteBtn').onclick = ()=>{
      location.href = location.pathname; // reset semplice
    };
  }

  // --- Creator: waiting (quando si rientra col link ?host=) ---
  function showCreatorWaiting(gid){
    logd('creatorWaiting gid=',gid);
    qs('#creatorSection').classList.remove('hidden');
    qs('#creatorStart').classList.add('hidden');
    qs('#gameLinkWrap').classList.remove('hidden');
    const linkOpponent = `${location.origin}${location.pathname}?game=${gid}`;
    const linkHost     = `${location.origin}${location.pathname}?host=${gid}`;
    qs('#gameLinkOpponent').value = linkOpponent;
    qs('#gameLinkHost').value = linkHost;
    qs('#copyOpponentBtn').onclick = () => copyToClipboard(linkOpponent);
    qs('#copyHostBtn').onclick     = () => copyToClipboard(linkHost);
    attachCreatorListener(gid);
  }

  // --- Invitee ---
  function showInvitee(gid){
    logd('invitee gid=',gid);
    qs('#creatorSection').classList.add('hidden');
    qs('#inviteeSection').classList.remove('hidden');

    const nameInput2 = qs('#nameInput2');
    const acceptBtn = qs('#acceptBtn');
    const rejectBtn = qs('#rejectBtn');

    const onName = () => { acceptBtn.disabled = nameInput2.value.trim().length < 2; };
    nameInput2.addEventListener('input', onName);
    onName();

    db.ref('games/'+gid).once('value').then(s=>{
      const d=s.val();
      if(!d || !d.player1){ qs('#inviteeStatus').innerText="Invito non valido o scaduto."; return; }
      qs('#player1Info').innerText = "Sei stato invitato da: " + (d.player1.name||"Giocatore 1");
    });

    acceptBtn.addEventListener('click', async ()=>{
      const name = nameInput2.value.trim();
      await db.ref('games/'+gid+'/player2').set({ name, joined:true, clientId:CLIENT_ID, role:'p2' });
      qs('#inviteeStatus').innerText = "Hai accettato l'invito.";
      const s = await db.ref('games/'+gid).get();
      const d = s.val();
      if(d?.player1?.joined){ await db.ref('games/'+gid+'/phase').set('select'); }
    });
    rejectBtn.addEventListener('click', async ()=>{
      await db.ref('games/'+gid+'/refused').set(true);
      qs('#inviteeStatus').innerText="Hai rifiutato l'invito.";
    });
  }
})();
