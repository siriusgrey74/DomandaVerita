
// common.js - helpers
window.DV = (function(){
  function qs(s,root){ return (root||document).querySelector(s); }
  function qsa(s,root){ return Array.from((root||document).querySelectorAll(s)); }
  function params(){ return new URLSearchParams(location.search); }
  function toast(msg){ let t=qs('#toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.appendChild(t);} t.textContent=msg; t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'),1500); }
  function copy(text){ if(navigator.clipboard&&window.isSecureContext){ navigator.clipboard.writeText(text).then(()=>toast('Copiato')).catch(()=>fallback()); } else { fallback(); }
    function fallback(){ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); toast('Copiato'); } }
  function randId(){ return Math.random().toString(36).slice(2,10); }
  function getCID(){ const k='dv_cid'; let v=localStorage.getItem(k); if(!v){ v='cid_'+randId(); localStorage.setItem(k,v);} return v; }
  function now(){ return Date.now(); }
  return {qs,qsa,params,toast,copy,randId,getCID,now};
})();
