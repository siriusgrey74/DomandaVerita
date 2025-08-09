window.DV = {
  qs: (sel, el=document)=> el.querySelector(sel),
  qsa: (sel, el=document)=> Array.from(el.querySelectorAll(sel)),
  params: ()=> new URLSearchParams(location.search),
  now: ()=> Date.now(),
  gid: ()=> new URLSearchParams(location.search).get('game'),
  role: ()=> new URLSearchParams(location.search).get('role'),
  rid: (n=8)=> Array.from(crypto.getRandomValues(new Uint8Array(n))).map(x=>('00'+x.toString(16)).slice(-2)).join(''),
  copy: async (txt)=> { try{ await navigator.clipboard.writeText(txt); alert('Link copiato!'); }catch(e){ prompt('Copia il link:', txt); } },
  deck52: ()=>{
    const ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    const suits=['p','c','q','f'];
    const cards=[];
    for(const s of suits){ for(const r of ranks){ cards.push(r+s); } }
    return cards;
  },
  cardValue: (code)=>{
    if(!code) return 0;
    const rank = code.replace(/[pcqf]$/,'').toUpperCase();
    if(['A','J','Q','K'].includes(rank)) return 10;
    const n = parseInt(rank,10); return isNaN(n)?0:n;
  }
};
