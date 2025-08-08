(function(){
  // helpers
  function qs(s){ return document.querySelector(s); }
  function toast(msg){ var t=qs('#toast'); t.textContent=msg; t.classList.remove('hidden'); setTimeout(function(){ t.classList.add('hidden'); }, 1500); }
  function copy(text){
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ toast('Link copiato'); }).catch(function(){ toast('Copia non riuscita'); });
    } else {
      var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Link copiato');
    }
  }
  function randomId(){ return Math.random().toString(36).slice(2,10); }
  function params(){ return new URLSearchParams(location.search); }

  // diagnostics
  var logs=[];
  function log(s){ logs.push(s); refreshDiag(); }
  function refreshDiag(){
    var p = params();
    var mode = detectMode(p);
    qs('#modeBadge').textContent = 'Modalità: ' + mode;
    qs('#urlBadge').textContent = 'URL: ' + (location.pathname + location.search);
    var short = [];
    short.push('firebase: '+(!!window.firebase));
    try{ short.push('apps: '+(window.firebase?.apps?.length||0)); }catch(e){ short.push('apps: err'); }
    try{ short.push('db: '+(db?'ok':'no')); }catch(e){ short.push('db: err'); }
    qs('#diagShort').textContent = ' | ' + short.join(' · ');
    qs('#diagBox').textContent = logs.slice(-80).join('\\n');
  }
  qs('#toggleDiag').addEventListener('click', function(){ qs('#diagBox').classList.toggle('hidden'); });

  // firebase init
  var db=null;
  try{
    if(window.firebase && firebase.apps.length){
      db=firebase.database();
      log('Firebase RTDB: ok');
      firebase.database().ref('.info/connected').on('value', function(snap){
        log('RTDB .info/connected = '+snap.val());
      });
    } else if(window.firebase && !firebase.apps.length){
      log('Firebase SDK presente ma app non inizializzata (controlla firebase-config.js)');
    } else {
      log('Firebase SDK non presente');
    }
  }catch(e){ log('Firebase init error: '+e.message); }

  // mode detection
  function detectMode(p){
    var game = p.get('game');
    var host = p.get('host');
    if(game && host){ return 'ambigua (game+host)'; }
    if(game){ return 'invited'; }
    if(host){ return 'creator-wait'; }
    return 'creator';
  }

  // force mode buttons
  qs('#forceInvitee').addEventListener('click', function(){
    var id = prompt('Inserisci ID partita (8 caratteri):');
    if(id){ location.href = location.pathname + '?game=' + encodeURIComponent(id); }
  });
  qs('#forceCreator').addEventListener('click', function(){
    var id = prompt('Inserisci ID partita (8 caratteri):');
    if(id){ location.href = location.pathname + '?host=' + encodeURIComponent(id); }
  });

  // sections
  var creatorSection=qs('#creatorSection');
  var inviteeSection=qs('#inviteeSection');

  function showCreator(){
    creatorSection.classList.remove('hidden');
    inviteeSection.classList.add('hidden');
  }
  function showInvitee(){
    creatorSection.classList.add('hidden');
    inviteeSection.classList.remove('hidden');
  }

  // initial route (STRICT)
  (function initialRoute(){
    var p=params();
    var mode=detectMode(p);
    log('initialRoute mode='+mode);
    if(mode==='invited'){ showInvitee(); setupInvitee(p.get('game')); return; }
    if(mode==='creator-wait'){ showCreator(); setupCreator(true, p.get('host')); return; }
    // default creator
    showCreator(); setupCreator(false, null);
  })();

  // creator setup
  function setupCreator(resume, hostId){
    var nameInput=qs('#nameInput');
    var inviteBtn=qs('#inviteBtn');
    function onName(){ inviteBtn.disabled = nameInput.value.trim().length<2; }
    nameInput.addEventListener('input', onName); onName();

    if(resume){
      var linkOpponent=location.origin+location.pathname+'?game='+hostId;
      var linkHost=location.origin+location.pathname+'?host='+hostId;
      qs('#creatorStart').classList.add('hidden');
      qs('#gameLinkWrap').classList.remove('hidden');
      qs('#gameLinkOpponent').value=linkOpponent;
      qs('#gameLinkHost').value=linkHost;
      qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); };
      qs('#copyHostBtn').onclick=function(){ copy(linkHost); };
      qs('#creatorStatus').textContent='Sessione già creata. In attesa che l\\'avversario accetti...';
      bindCreatorFirebase(hostId);
      return;
    }

    inviteBtn.addEventListener('click', function(){
      var name=nameInput.value.trim(); if(!name) return;
      var newId=randomId();
      var linkOpponent=location.origin+location.pathname+'?game='+newId;
      var linkHost=location.origin+location.pathname+'?host='+newId;

      qs('#creatorStart').classList.add('hidden');
      qs('#gameLinkWrap').classList.remove('hidden');
      qs('#gameLinkOpponent').value=linkOpponent;
      qs('#gameLinkHost').value=linkHost;
      qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); };
      qs('#copyHostBtn').onclick=function(){ copy(linkHost); };

      if(!db){
        qs('#creatorStatus').textContent='⚠️ Modalità offline: Firebase non pronto. Link generato solo localmente.';
        log('Offline: nessuna scrittura su RTDB');
        return;
      }

      firebase.database().ref('games/'+newId).set({
        player1:{ name:name, joined:true, clientId:'host-local', role:'p1' },
        createdAt: Date.now(),
        phase:'waiting',
        version:'8.4.8-patch2'
      }).then(function(){
        log('RTDB: sessione creata '+newId);
        qs('#creatorStatus').textContent='Sessione creata. In attesa che l\\'avversario accetti...';
        history.replaceState(null,'', location.pathname+'?host='+newId);
        bindCreatorFirebase(newId);
      }).catch(function(err){
        log('RTDB write error: '+err.message);
        qs('#creatorStatus').textContent='⚠️ Errore scrittura su RTDB: '+err.message;
      });
    }, { once:true });
  }

  function bindCreatorFirebase(gid){
    if(!db) return;
    firebase.database().ref('games/'+gid).on('value', function(s){
      var d=s.val();
      if(!d){ qs('#creatorStatus').textContent='Sessione non trovata.'; return; }
      log('creator: phase='+d.phase+' p2='+(d.player2 && d.player2.joined));
      if(d.player2 && d.player2.joined){
        qs('#creatorStatus').textContent='Avversario ha accettato! (patch2 non contiene ancora la fase successiva)';
      }
    });
  }

  // invitee setup
  function setupInvitee(gameId){
    showInvitee();
    if(!db){
      qs('#inviteeStatus').textContent='⚠️ Modalità offline: Firebase non pronto.';
      log('Offline: nessun read da RTDB');
      return;
    }
    firebase.database().ref('games/'+gameId).once('value').then(function(s){
      var d=s.val();
      if(!d || !d.player1){ qs('#inviteeStatus').textContent='Invito non valido o scaduto.'; return; }
      qs('#player1Info').textContent='Sei stato invitato da: '+(d.player1.name || 'Giocatore 1');
    });

    var nameInput2=qs('#nameInput2');
    var acceptBtn=qs('#acceptBtn');
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

  // initial diagnostics print
  log('patch2 avviata');
  refreshDiag();
})();