(function(){
  // --- helpers ---
  function qs(s){ return document.querySelector(s); }
  function log(s){ logs.push(s); refreshDiag(); }
  function toast(msg){ var t=qs('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(function(){ t.classList.add('hidden'); }, 1600); }
  function randomId(){ return Math.random().toString(36).slice(2,10); }
  function copy(text){
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ toast('Link copiato'); }).catch(function(){ toast('Copia non riuscita'); });
    } else {
      var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Link copiato');
    }
  }
  var logs=[];
  function refreshDiag(){
    var short = [];
    short.push('firebase: '+(!!window.firebase));
    try{ short.push('apps: '+(window.firebase?.apps?.length||0)); }catch(e){ short.push('apps: err'); }
    try{ short.push('db: '+(db?'ok':'no')); }catch(e){ short.push('db: err'); }
    qs('#diagShort').textContent = ' | ' + short.join(' · ');
    qs('#diagBox').textContent = logs.slice(-50).join('\n');
  }
  qs('#toggleDiag').addEventListener('click', function(){
    qs('#diagBox').classList.toggle('hidden');
  });

  // global error hooks
  window.addEventListener('error', function(e){ log('window.onerror: '+e.message); });
  window.addEventListener('unhandledrejection', function(e){ log('unhandledrejection: '+(e.reason && e.reason.message || e.reason)); });

  // --- firebase checks ---
  var db=null; var fbStatus='init';
  try{
    if(!window.firebase){ fbStatus='no-firebase'; log('Firebase JS SDK non caricato'); }
    else if(!firebase.apps.length){ fbStatus='no-app'; log('firebase.apps.length = 0 (config non eseguita?)'); }
    else { db=firebase.database(); fbStatus='ok'; log('Firebase RTDB inizializzato'); }
  }catch(err){ fbStatus='init-error'; log('Errore inizializzazione Firebase: '+err.message); }

  // monitor connessione RTDB se possibile
  if(db){
    try{
      firebase.database().ref('.info/connected').on('value', function(snap){
        log('RTDB .info/connected = '+snap.val());
      });
    }catch(err){ log('Errore listener .info/connected: '+err.message); }
  }

  // --- UI: creator ---
  var nameInput=qs('#nameInput');
  var inviteBtn=qs('#inviteBtn');
  function onName(){ inviteBtn.disabled = nameInput.value.trim().length<2; }
  nameInput.addEventListener('input', onName); onName();

  inviteBtn.addEventListener('click', function(){
    var name=nameInput.value.trim(); if(!name) return;
    var newId=randomId();
    var linkOpponent=location.origin+location.pathname+'?game='+newId;
    var linkHost=location.origin+location.pathname+'?host='+newId;

    // sempre mostriamo i link, anche se il DB non è pronto
    qs('#creatorStart').classList.add('hidden');
    qs('#gameLinkWrap').classList.remove('hidden');
    qs('#gameLinkOpponent').value=linkOpponent;
    qs('#gameLinkHost').value=linkHost;
    qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); };
    qs('#copyHostBtn').onclick=function(){ copy(linkHost); };

    if(db){
      // prova a scrivere su RTDB
      firebase.database().ref('games/'+newId).set({
        player1:{ name:name, joined:true, clientId:'host-local', role:'p1' },
        createdAt: Date.now(),
        phase:'waiting',
        version:'8.4.8-patch1'
      }).then(function(){
        log('RTDB: sessione creata '+newId);
        qs('#creatorStatus').textContent='Sessione creata. In attesa che l\'avversario accetti...';
      }).catch(function(err){
        log('RTDB write error: '+err.message);
        qs('#creatorStatus').textContent='⚠️ Errore scrittura su RTDB: '+err.message+' (controlla regole/chiavi)';
      });
    } else {
      qs('#creatorStatus').textContent='⚠️ Modalità offline: Firebase non pronto. Il link funziona solo localmente.';
      log('Modalità offline: invito generato senza scrittura su RTDB');
    }
  });

})();