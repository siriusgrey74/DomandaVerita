(function(){
  function logd(){ var t='[v8.4.8] '+Array.prototype.slice.call(arguments).join(' '); console.log(t); var b=document.getElementById('diagBox'); if(b) b.textContent=t; }
  function qs(s){ return document.querySelector(s); }
  function qsa(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function params(){ return new URLSearchParams(location.search); }
  function getGameId(){ return params().get('game'); }
  function getHostId(){ return params().get('host'); }
  function randomId(){ return Math.random().toString(36).slice(2,10); }
  var CID_KEY='dv_client_id';
  function getClientId(){ var id=localStorage.getItem(CID_KEY); if(!id){ id='cid_'+Math.random().toString(36).slice(2,10); localStorage.setItem(CID_KEY,id);} return id; }
  var CLIENT_ID=getClientId();

  var db=firebase.database();

  var toastEl=qs('#toast');
  function toast(msg){ if(!toastEl)return; toastEl.textContent=msg; toastEl.classList.remove('hidden'); setTimeout(function(){ toastEl.classList.add('hidden'); }, 1500); }
  function copy(text){
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ toast('Link copiato'); }).catch(function(){ toast('Copia non riuscita'); });
    } else {
      var ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Link copiato');
    }
  }

  var creatorSection=qs('#creatorSection');
  var inviteeSection=qs('#inviteeSection');
  var selectCardsSection=qs('#selectCardsSection');
  var bettingSection=qs('#bettingSection');
  var outcomeSection=qs('#outcomeSection');
  var actionSection=qs('#actionSection');

  var currentGameId=null, myRole=null, selectStarted=false, deadlineInterval=null, reconcileInterval=null, debounceTimer=null, lastSnapshot=null;

  function whoAmI(d){ if(!d) return '?'; if(d.player1 && d.player1.clientId===CLIENT_ID) return 'p1'; if(d.player2 && d.player2.clientId===CLIENT_ID) return 'p2'; return myRole||'?'; }
  function showDiagGame(d){
    var wh=whoAmI(d);
    var lastW=(d&&d.lastWinner!=null)?d.lastWinner:'null';
    var wcid=(d&&d.winnerClientId)||'null';
    var res=(d&&d.resolverCid)||'null';
    logd('gid='+currentGameId,'me='+wh,'cid='+CLIENT_ID,'phase='+(d&&d.phase),'lastWinner='+lastW,'winnerCID='+wcid,'resolverCID='+res);
  }

  var urlGameId=getGameId(), urlHostId=getHostId();
  if(urlHostId){ myRole='p1'; currentGameId=urlHostId; showCreatorWaiting(currentGameId); }
  else if(urlGameId){ myRole='p2'; currentGameId=urlGameId; showInvitee(currentGameId); }
  else { myRole='p1'; showCreatorStart(); }

  function showCreatorStart(){
    creatorSection.classList.remove('hidden'); inviteeSection.classList.add('hidden'); selectCardsSection.classList.add('hidden'); bettingSection.classList.add('hidden'); outcomeSection.classList.add('hidden'); actionSection.classList.add('hidden');
    var nameInput=qs('#nameInput'); var inviteBtn=qs('#inviteBtn');
    function onName(){ inviteBtn.disabled = nameInput.value.trim().length<2; }
    nameInput.addEventListener('input', onName); onName();
    inviteBtn.addEventListener('click', function(){
      var name=nameInput.value.trim(); if(!name) return;
      var newId=randomId(); currentGameId=newId;
      var linkOpponent=location.origin+location.pathname+'?game='+newId;
      var linkHost=location.origin+location.pathname+'?host='+newId;
      qs('#creatorStart').classList.add('hidden'); qs('#gameLinkWrap').classList.remove('hidden');
      qs('#gameLinkOpponent').value=linkOpponent; qs('#gameLinkHost').value=linkHost;
      qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); }; qs('#copyHostBtn').onclick=function(){ copy(linkHost); };
      history.replaceState(null,'',linkHost);
      db.ref('games/'+newId).set({ player1:{name:name, joined:true, clientId:CLIENT_ID, role:'p1'}, createdAt:Date.now(), phase:'waiting', version:'8.4.8' });
      attachCreatorListener(newId);
    }, { once:true });
  }

  function showCreatorWaiting(gid){
    creatorSection.classList.remove('hidden'); inviteeSection.classList.add('hidden'); selectCardsSection.classList.add('hidden'); bettingSection.classList.add('hidden'); outcomeSection.classList.add('hidden'); actionSection.classList.add('hidden');
    var linkOpponent=location.origin+location.pathname+'?game='+gid; var linkHost=location.origin+location.pathname+'?host='+gid;
    qs('#creatorStart').classList.add('hidden'); qs('#gameLinkWrap').classList.remove('hidden');
    qs('#gameLinkOpponent').value=linkOpponent; qs('#gameLinkHost').value=linkHost;
    qs('#copyOpponentBtn').onclick=function(){ copy(linkOpponent); }; qs('#copyHostBtn').onclick=function(){ copy(linkHost); };
    attachCreatorListener(gid);
  }

  function attachCreatorListener(gid){
    db.ref('games/'+gid).on('value', function(s){
      var d=s.val(); if(!d){ qs('#creatorStatus').innerText='Sessione non trovata.'; return; }
      showDiagGame(d);
      if(d.refused){ qs('#creatorStatus').innerText='L\\'invito è stato rifiutato.'; }
      if(d.cancelled){ qs('#creatorStatus').innerText='Invito annullato.'; }
      if(d.player2 && d.player2.joined){ qs('#creatorStatus').innerText='Avversario ha accettato! Si passa alla selezione carte...'; }
      if(d.phase==='select' && !selectStarted){ selectStarted=true; creatorSection.classList.add('hidden'); startSelectCards('p1'); }
    });
    qs('#cancelBtn').onclick=function(){ db.ref('games/'+gid+'/cancelled').set(true); qs('#creatorStatus').innerText='Invito annullato.'; history.replaceState(null,'',location.pathname); qs('#newInviteBtn').classList.remove('hidden'); qs('#cancelBtn').disabled=true; };
    qs('#newInviteBtn').onclick=function(){ location.href=location.pathname; };
  }

  function showInvitee(gid){
    creatorSection.classList.add('hidden'); inviteeSection.classList.remove('hidden'); selectCardsSection.classList.add('hidden'); bettingSection.classList.add('hidden'); outcomeSection.classList.add('hidden'); actionSection.classList.add('hidden');
    db.ref('games/'+gid).once('value').then(function(s){ var d=s.val(); if(!d||!d.player1){ qs('#inviteeStatus').innerText='Invito non valido o scaduto.'; return; } qs('#player1Info').innerText='Sei stato invitato da: '+(d.player1.name||'Giocatore 1'); });
    var nameInput2=qs('#nameInput2'); var acceptBtn=qs('#acceptBtn'); function onName(){ acceptBtn.disabled = nameInput2.value.trim().length<2; } nameInput2.addEventListener('input', onName); onName();
    qs('#rejectBtn').onclick=function(){ db.ref('games/'+gid+'/refused').set(true); qs('#inviteeStatus').innerText='Hai rifiutato l\\'invito.'; };
    acceptBtn.onclick=function(){
      var name=nameInput2.value.trim();
      db.ref('games/'+gid+'/player2').set({ name:name, joined:true, clientId:CLIENT_ID, role:'p2' }).then(function(){
        qs('#inviteeStatus').innerText='Hai accettato l\\'invito.';
        db.ref('games/'+gid).once('value').then(function(s){ var d=s.val(); if(d && d.player1 && d.player1.joined){ db.ref('games/'+gid+'/phase').set('select'); } });
      });
    };
    db.ref('games/'+gid).on('value', function(s){ var d=s.val()||{}; showDiagGame(d); if(d.phase==='select' && !selectStarted){ selectStarted=true; inviteeSection.classList.add('hidden'); startSelectCards('p2'); } });
  }

  var suits=['p','c','q','f']; var ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  var selected=[], timerInt=null, timeZero=false;

  function buildGrid(){
    var grid=qs('#cardGrid'); grid.innerHTML='';
    for(var r=0;r<ranks.length;r++){
      for(var s=0;s<suits.length;s++){
        (function(code){
          var cell=document.createElement('div'); cell.className='card'; cell.textContent=code; cell.dataset.card=code;
          cell.addEventListener('click', function(){ toggleCard(code,cell); }); grid.appendChild(cell);
        })(ranks[r]+suits[s]);
      }
    }
  }
  function toggleCard(code, el){
    if(el.classList.contains('disabled')) return;
    var i=selected.indexOf(code);
    if(i>-1){ selected.splice(i,1); el.classList.remove('selected'); }
    else { if(selected.length>=8) return; selected.push(code); el.classList.add('selected'); }
    updateSel();
  }
  function updateSel(){
    qs('#selectedCards').textContent=selected.length?selected.join(', '):'—';
    var ok=(selected.length===8 || timeZero); qs('#confirmBtn').disabled=!ok;
  }
  function paintSelection(){ qsa('.card').forEach(function(c){ if(selected.indexOf(c.dataset.card)>-1) c.classList.add('selected'); else c.classList.remove('selected'); }); updateSel(); }
  function lockGrid(){ qsa('.card').forEach(function(c){ c.classList.add('disabled'); }); }
  function autoComplete(){ var deck=[]; for(var i=0;i<ranks.length;i++){ for(var j=0;j<suits.length;j++){ deck.push(ranks[i]+suits[j]); } } while(selected.length<8){ var pick=deck[Math.floor(Math.random()*deck.length)]; if(selected.indexOf(pick)===-1) selected.push(pick); } }
  function onTimeExpired(whichRole){ if(selected.length<8){ autoComplete(); paintSelection(); } qs('#confirmBtn').disabled=false; qs('#selectInfo').textContent='Tempo scaduto: selezione completata automaticamente. Conferma per continuare.'; lockGrid(); }
  function startSelectCards(whichRole){
    selectCardsSection.classList.remove('hidden'); bettingSection.classList.add('hidden'); outcomeSection.classList.add('hidden'); actionSection.classList.add('hidden');
    selected=[]; buildGrid(); var tl=60; timeZero=false; qs('#timeLeft').textContent=tl;
    if(timerInt) clearInterval(timerInt);
    timerInt=setInterval(function(){ tl--; if(tl<=0){ tl=0; timeZero=true; qs('#timeLeft').textContent=tl; clearInterval(timerInt); onTimeExpired(whichRole); } else { qs('#timeLeft').textContent=tl; } },1000);
    qs('#confirmBtn').onclick=function(){ if(selected.length===0){ autoComplete(); paintSelection(); } lockGrid(); db.ref('games/'+currentGameId+'/cards_'+whichRole).set(selected); db.ref('games/'+currentGameId+'/ready_'+whichRole).set(true); qs('#selectInfo').textContent='Selezione confermata. In attesa dell\\'avversario...'; qs('#confirmBtn').textContent='Confermato ✓'; };
    db.ref('games/'+currentGameId).on('value', function(s){ var d=s.val()||{}; showDiagGame(d); if(d.ready_p1 && d.ready_p2){ qs('#selectInfo').textContent='Entrambi pronti. La partita può iniziare!'; startBettingCountdown(5); } });
  }
  function startBettingCountdown(sec){
    var el=qs('#startBettingCountdown'); if(!el) return; if(!el.classList.contains('hidden')) return; el.classList.remove('hidden');
    var n=sec; (function tick(){ el.textContent='Si passa alla puntata tra '+n+'…'; if(n<=0){ el.textContent='Caricamento puntata…';
      db.ref('games/'+currentGameId).transaction(function(data){ if(!data) return data; if(data.phase!=='select') return data; data.phase='betting'; data.roundInitialized=false; if(!data.turn) data.turn=1; if(typeof data.tokens_p1!=='number') data.tokens_p1=10; if(typeof data.tokens_p2!=='number') data.tokens_p2=10; data.betDeadlineAt=Date.now()+15000; data.bets={}; data.resolverCid=null; data.lastWinner=null; data.winnerClientId=null; return data; });
      el.classList.add('hidden'); return; } n--; setTimeout(tick,1000); })();
  }

  function startBetting(){ selectCardsSection.classList.add('hidden'); bettingSection.classList.remove('hidden'); outcomeSection.classList.add('hidden'); actionSection.classList.add('hidden'); }
  function setBetControlsEnabled(on){ qs('#betSelect').disabled=!on; qs('#betInput').disabled=!on; qs('#betZero').disabled=!on; qs('#betLock').textContent = on ? '' : 'Caricamento giocatori…'; }
  function clampBetInput(max){ var inp=qs('#betInput'); var parsed=parseInt(inp.value,10); var v=isNaN(parsed)?0:parsed; var v2=Math.max(0,Math.min(max,v)); inp.value=v2; }
  function populateBetSelect(max){ var sel=qs('#betSelect'); var prev=sel.value; sel.innerHTML=''; var up=(typeof max==='number'&&max>=0)?max:20; for(var i=0;i<=up;i++){ var o=document.createElement('option'); o.value=i; o.textContent=i; sel.appendChild(o); } if(prev && parseInt(prev,10)<=up){ sel.value=prev; } }

  var betUIInited=false, currentMaxTok=-1, roleKnown=false;
  function setupBettingRound(){
    var gameRef=db.ref('games/'+currentGameId);
    gameRef.transaction(function(data){ if(!data) return data; if(data.phase!=='betting') return data; if(!data.turn) data.turn=1; if(typeof data.tokens_p1!=='number') data.tokens_p1=10; if(typeof data.tokens_p2!=='number') data.tokens_p2=10; if(!data.roundInitialized){ if(data.turn>=2){ data.tokens_p1+=2; data.tokens_p2+=2; } data.roundInitialized=true; } if(!data.betDeadlineAt) data.betDeadlineAt=Date.now()+15000; if(!data.bets) data.bets={}; if(typeof data.resolverCid==='undefined') data.resolverCid=null; return data; });

    if(!betUIInited){ populateBetSelect(undefined); qs('#betSelect').value='0'; qs('#betInput').value='0'; setBetControlsEnabled(false); betUIInited=true; }

    var localDeadline=null;
    function echo(){ var d=lastSnapshot||{}; var mine=(d.bets && typeof d.bets[CLIENT_ID]==='number')? d.bets[CLIENT_ID] : null; qs('#betEcho').innerText=(typeof mine==='number')? ('Puntata salvata sul server: '+mine) : ''; }

    db.ref('games/'+currentGameId).on('value', function(s){
      var d=s.val()||{}; lastSnapshot=d; showDiagGame(d); if(d.phase!=='betting') return;
      var id1=d.player1&&d.player1.clientId, id2=d.player2&&d.player2.clientId; var both=!!(id1&&id2);
      if(both && !roleKnown){ myRole=(CLIENT_ID===id1)?'p1':'p2'; roleKnown=true; setBetControlsEnabled(true); if(!d.bets || typeof d.bets[CLIENT_ID] !== 'number'){ db.ref('games/'+currentGameId+'/bets/'+CLIENT_ID).set(0); } } else if(!both){ setBetControlsEnabled(false); }

      if(typeof d.betDeadlineAt==='number'){
        localDeadline=d.betDeadlineAt;
        function updateTimer(){ var rem=Math.max(0,Math.floor((localDeadline-Date.now())/1000)); qs('#betTimeLeft').textContent=rem; if(rem===0){ setBetControlsEnabled(false); } }
        updateTimer(); if(deadlineInterval) clearInterval(deadlineInterval); deadlineInterval=setInterval(updateTimer,200);

        if(reconcileInterval) clearInterval(reconcileInterval);
        reconcileInterval=setInterval(function(){ var now=Date.now(); var overdue=(typeof lastSnapshot.betDeadlineAt==='number') && now>(lastSnapshot.betDeadlineAt+500); if(overdue && lastSnapshot.phase==='betting' && !lastSnapshot.roundResolved){ requestResolve(); } else if(lastSnapshot.phase!=='betting'){ clearInterval(reconcileInterval); } },1000);
      }

      var myTok=(myRole==='p1')? d.tokens_p1 : d.tokens_p2; var oppTok=(myRole==='p1')? d.tokens_p2 : d.tokens_p1;
      if(typeof myTok==='number'){ qs('#myTokens').textContent=myTok; var inp=qs('#betInput'), sel=qs('#betSelect'), typing=document.activeElement===inp; if(currentMaxTok!==myTok){ currentMaxTok=myTok; var prevSel=sel.value; inp.max=myTok; if(!typing) clampBetInput(myTok); populateBetSelect(myTok); if(!typing){ if(prevSel) sel.value=prevSel; else sel.value=inp.value; } } } else { qs('#myTokens').textContent='—'; }
      qs('#turnNo').textContent=d.turn||1; if(typeof oppTok==='number' && oppTok<6){ qs('#oppLowWrap').classList.remove('hidden'); } else { qs('#oppLowWrap').classList.add('hidden'); }

      echo();
    });

    function saveCurrent(){ if(!roleKnown) return; var val=parseInt(qs('#betInput').value||'0',10) || 0; db.ref('games/'+currentGameId+'/bets/'+CLIENT_ID).set(val).then(function(){ qs('#betStatus').textContent='Puntata salvata ('+val+').'; }); }
    function debouncedSave(){ if(debounceTimer) clearTimeout(debounceTimer); debounceTimer=setTimeout(saveCurrent, 120); }

    qs('#betInput').addEventListener('input', function(){ if(!roleKnown) return; var max=parseInt(qs('#betInput').max||'0',10) || 0; clampBetInput(max); qs('#betSelect').value=String(parseInt(qs('#betInput').value||'0',10) || 0); debouncedSave(); });
    qs('#betSelect').addEventListener('change', function(){ if(!roleKnown) return; var v=parseInt(qs('#betSelect').value||'0',10) || 0; qs('#betInput').value=String(v); debouncedSave(); });
    qs('#betZero').addEventListener('click', function(){ if(!roleKnown) return; qs('#betInput').value='0'; qs('#betSelect').value='0'; debouncedSave(); });
  }

  function requestResolve(force){
    var ref=db.ref('games/'+currentGameId);
    ref.transaction(function(data){ if(!data) return data; if(data.phase!=='betting') return data; if(data.roundResolved) return data; if(!force && data.resolverCid && data.resolverCid!==CLIENT_ID) return data; if(!data.resolverCid || force) data.resolverCid=CLIENT_ID; return data; },
    function(err, committed, snap){ if(err || !committed || !snap) return; var d=snap.val(); if(d && d.resolverCid===CLIENT_ID){ resolveRound(); } });
  }

  function resolveRound(){
    var ref=db.ref('games/'+currentGameId);
    ref.transaction(function(data){
      if(!data) return data; if(data.phase!=='betting') return data; if(data.resolverCid!==CLIENT_ID) return data; if(data.roundResolved) return data;
      function toInt(x){ var n=parseInt(x,10); return isNaN(n)?0:Math.max(0,n); }
      var id1=data.player1 && data.player1.clientId || null;
      var id2=data.player2 && data.player2.clientId || null;
      var b1=toInt(data.bets && data.bets[id1]); var b2=toInt(data.bets && data.bets[id2]);
      var t1=toInt(data.tokens_p1); var t2=toInt(data.tokens_p2);
      var cb1=Math.min(b1,t1), cb2=Math.min(b2,t2);
      data.tokens_p1=t1-cb1; data.tokens_p2=t2-cb2;

      var winner=null; if(cb1>cb2) winner='p1'; else if(cb2>cb1) winner='p2'; else winner=null;
      if(!data.rounds) data.rounds={}; var turn=data.turn||1;
      data.rounds['turn_'+turn]={ bet_p1:cb1, bet_p2:cb2, winner:winner };

      data.roundResolved=true; data.betDeadlineAt=null; data.lastWinner=winner; data.advanceAllowed=false; data.phase='outcome';
      data.winnerClientId = winner==='p1'? id1 : (winner==='p2'? id2 : null);
      return data;
    });
  }

  function showOutcome(){
    db.ref('games/'+currentGameId).on('value', function(s){
      var d=s.val()||{}; showDiagGame(d); if(d.phase!=='outcome') return;
      bettingSection.classList.add('hidden'); outcomeSection.classList.remove('hidden'); actionSection.classList.add('hidden');
      qs('#outcomeTurn').textContent=d.turn||1; var last=d.rounds && d.rounds['turn_'+(d.turn||1)]; if(!last) return;
      var p1name=d.player1 && d.player1.name || 'Giocatore 1'; var p2name=d.player2 && d.player2.name || 'Giocatore 2';
      var post=qs('#postOutcome'); post.innerHTML='';
      if(last.winner===null){
        qs('#outcomeText').textContent='Pareggio: nessun vincitore. Entrambi perdono la puntata.'; qs('#winnerInfo').textContent='';
        var btn=document.createElement('button'); btn.textContent='Vai al turno successivo'; btn.onclick=function(){
          db.ref('games/'+currentGameId).transaction(function(data){ if(!data) return data; if(data.phase!=='outcome') return data; data.turn=(data.turn||1)+1; data.bets={}; data.resolverCid=null; data.roundResolved=false; data.roundInitialized=false; data.phase='betting'; data.advanceAllowed=true; data.betDeadlineAt=Date.now()+15000; data.action=null; data.lastWinner=null; data.winnerClientId=null; return data; });
        }; post.appendChild(btn);
      } else {
        qs('#outcomeText').textContent='Esito puntata'; var wName=(last.winner==='p1')? p1name : p2name; qs('#winnerInfo').textContent='Ha vinto la puntata: '+wName;
        var btn2=document.createElement('button'); btn2.textContent='Vai alla fase Azione'; btn2.onclick=function(){ db.ref('games/'+currentGameId).transaction(function(data){ if(!data) return data; if(data.phase!=='outcome') return data; data.phase='action'; data.advanceAllowed=false; return data; }); }; post.appendChild(btn2);
      }
    });
  }

  function showAction(){
    outcomeSection.classList.add('hidden'); bettingSection.classList.add('hidden'); selectCardsSection.classList.add('hidden'); actionSection.classList.remove('hidden');
    db.ref('games/'+currentGameId).on('value', function(s){
      var d=s.val()||{}; showDiagGame(d); if(d.phase!=='action') return;
      var iAmWinner=d.winnerClientId && d.winnerClientId===CLIENT_ID;
      qs('#actionForWinner').classList.toggle('hidden', !iAmWinner); qs('#actionForLoser').classList.toggle('hidden', iAmWinner); qs('#proceedNextTurn').disabled=!iAmWinner;
      var p1=d.player1&&d.player1.name||'Giocatore 1'; var p2=d.player2&&d.player2.name||'Giocatore 2';
      var wName=d.lastWinner==='p1'? p1 : (d.lastWinner==='p2'? p2 : 'Nessuno');
      if(d.lastWinner===null){ qs('#actionStatus').textContent='Pareggio: nessuna azione.'; }
      else if(iAmWinner){ qs('#actionStatus').textContent='Hai vinto la puntata. Scegli Domanda o Verità.'; }
      else { qs('#actionStatus').textContent=wName+' sta scegliendo Domanda o Verità. Attendi…'; }
      function guardedTx(mut){ db.ref('games/'+currentGameId).transaction(function(data){ if(!data) return data; if(data.phase!=='action') return data; if(!data.winnerClientId) return data; if(data.winnerClientId!==CLIENT_ID) return data; return mut(data); }); }
      qs('#chooseQuestion').onclick=function(){ guardedTx(function(d){ d.action={by:d.lastWinner, byClientId:d.winnerClientId, mode:'question', at:Date.now()}; return d; }); };
      qs('#chooseTruth').onclick=function(){ guardedTx(function(d){ d.action={by:d.lastWinner, byClientId:d.winnerClientId, mode:'truth', at:Date.now()}; return d; }); };
      qs('#proceedNextTurn').onclick=function(){ guardedTx(function(d){ d.turn=(d.turn||1)+1; d.bets={}; d.resolverCid=null; d.roundResolved=false; d.roundInitialized=false; d.phase='betting'; d.advanceAllowed=true; d.betDeadlineAt=Date.now()+15000; d.action=null; return d; }); };
    });
  }

  function watchPhase(){
    db.ref('games/'+currentGameId).on('value', function(s){
      var d=s.val()||{}; var p=d.phase; showDiagGame(d);
      if(p==='select'){ var role=(d.player1&&d.player1.clientId===CLIENT_ID)?'p1':((d.player2&&d.player2.clientId===CLIENT_ID)?'p2':(myRole||'p1')); startSelectCards(role); }
      else if(p==='betting'){ startBetting(); setupBettingRound(); }
      else if(p==='outcome'){ showOutcome(); }
      else if(p==='action'){ showAction(); }
    });
  }
  var kick=setInterval(function(){ if(currentGameId){ clearInterval(kick); watchPhase(); } },200);
})();