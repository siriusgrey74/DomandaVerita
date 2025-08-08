(function(){
  // helpers
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function toast(msg){ var t=qs('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(function(){ t.classList.add('hidden'); }, 1600); }
  function copy(text){
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ toast('Link copiato'); }).catch(function(){ toast('Copia non riuscita'); });
    } else {
      var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Link copiato');
    }
  }
  function randomId(){ return Math.random().toString(36).slice(2,10); }
  function params(){ return new URLSearchParams(location.search); }

  // logs
  var logs=[];
  function log(s){ logs.push(s); refreshDiag(); }
  function refreshDiag(){
    var short=[];
    short.push('firebase: '+(!!window.firebase));
    try{ short.push('apps: '+(window.firebase?.apps?.length||0)); }catch(e){ short.push('apps:err'); }
    try{ short.push('db: '+(db?'ok':'no')); }catch(e){ short.push('db:err'); }
    qs('#diagShort').textContent=' | '+short.join(' · ');
    qs('#diagBox').textContent=logs.slice(-80).join('\\n');
  }
  qs('#toggleDiag').addEventListener('click', function(){ qs('#diagBox').classList.toggle('hidden'); });

  // firebase
  var db=null;
  try{
    if(window.firebase && firebase.apps.length){ db=firebase.database(); log('Firebase RTDB ok'); }
    else if(window.firebase && !firebase.apps.length){ log('Firebase SDK presente ma app non inizializzata'); }
    else { log('Firebase SDK non presente'); }
  }catch(e){ log('Firebase init error: '+e.message); }

  // SEVERE: bind del pulsante invito super difensivo
  function bindInvite(){
    var inviteBtn=qs('#inviteBtn'); var nameInput=qs('#nameInput');
    if(!inviteBtn || !nameInput){ log('bindInvite: elementi non trovati'); return false; }

    function onName(){ inviteBtn.disabled = nameInput.value.trim().length<2; }
    nameInput.removeEventListener('input', onName); // in caso di doppio bind
    nameInput.addEventListener('input', onName); onName();

    inviteBtn.onclick=null; // rimuovi eventuale vecchio handler
    inviteBtn.addEventListener('click', function(){
      try{
        var name=nameInput.value.trim(); if(!name){ toast('Inserisci un nome'); return; }
        var newId=randomId();
        var linkOpponent=location.origin+location.pathname+'?game='+newId;
        var linkHost=location.origin+location.pathname+'?host='+newId;

        // mostriamo i link immediatamente
        qs('#creatorStart').classList.add('hidden');
        qs('#gameLinkWrap').classList.remove('hidden');
        qs('#gameLinkOpponent').value=linkOpponent;
        qs('#gameLinkHost').value=linkHost;
        qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); };
        qs('#copyHostBtn').onclick=function(){ copy(linkHost); };
        qs('#creatorStatus').textContent='Preparazione sessione...';

        // scrittura su RTDB se possibile, altrimenti modalità offline
        if(db){
          firebase.database().ref('games/'+newId).set({
            player1:{ name:name, joined:true, clientId:'host-local', role:'p1' },
            createdAt: Date.now(),
            phase:'waiting',
            version:'8.4.8-patch3'
          }).then(function(){
            log('RTDB: sessione creata '+newId);
            qs('#creatorStatus').textContent='Sessione creata. In attesa che l\\'avversario accetti...';
            history.replaceState(null,'', location.pathname+'?host='+newId);
          }).catch(function(err){
            log('RTDB write error: '+err.message);
            qs('#creatorStatus').textContent='⚠️ Errore RTDB: '+err.message;
          });
        } else {
          log('Offline: invito generato senza RTDB');
          qs('#creatorStatus').textContent='⚠️ Modalità offline: Firebase non pronto. Link generato solo localmente.';
        }
      }catch(e){
        log('inviteBtn click error: '+e.message);
        alert('Errore durante la creazione dell\\'invito: '+e.message);
      }
    }, { once:false });

    log('bindInvite: OK');
    return true;
  }

  // bind all'avvio + retry se fallisce (per problemi di cache/ordine script)
  function tryBindLoop(attempt){
    var ok = bindInvite();
    if(!ok){
      if(attempt<10){
        setTimeout(function(){ tryBindLoop(attempt+1); }, 200);
      } else {
        qs('#bindWarn').classList.remove('hidden');
        log('bindInvite: FALLITO dopo 10 tentativi');
      }
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ tryBindLoop(0); });
  } else {
    tryBindLoop(0);
  }

  // routing basilare: se query ?game -> mostra pannello invitato
  (function route(){
    var g=params().get('game');
    var h=params().get('host');
    if(g){
      qs('#creatorSection').classList.add('hidden');
      qs('#inviteeSection').classList.remove('hidden');
      setupInvitee(g);
    }
  })();

  // invitee
  function setupInvitee(gameId){
    if(!db){
      qs('#inviteeStatus').textContent='⚠️ Modalità offline: Firebase non pronto.';
      log('Invitee: offline, nessun read RTDB');
      return;
    }
    firebase.database().ref('games/'+gameId).once('value').then(function(s){
      var d=s.val();
      if(!d || !d.player1){ qs('#inviteeStatus').textContent='Invito non valido o scaduto.'; return; }
      qs('#player1Info').textContent='Sei stato invitato da: ' + (d.player1.name || 'Giocatore 1');
    });
    var nameInput2=qs('#nameInput2'); var acceptBtn=qs('#acceptBtn');
    function onName(){ acceptBtn.disabled = nameInput2.value.trim().length<2; }
    nameInput2.addEventListener('input', onName); onName();
    qs('#rejectBtn').onclick=function(){
      if(!db){ qs('#inviteeStatus').textContent='Invito rifiutato (offline).'; return; }
      firebase.database().ref('games/'+gameId+'/refused').set(true);
      qs('#inviteeStatus').textContent='Hai rifiutato l\\'invito.';
    };
    acceptBtn.onclick=function(){
      var name=nameInput2.value.trim();
      if(!db){ qs('#inviteeStatus').textContent='⚠️ Offline: non posso accettare.'; return; }
      firebase.database().ref('games/'+gameId+'/player2').set({ name:name, joined:true, clientId:'invited-local', role:'p2' }).then(function(){
        qs('#inviteeStatus').textContent='Hai accettato l\\'invito.';
        firebase.database().ref('games/'+gameId+'/phase').set('select');
      });
    };
  }

})();