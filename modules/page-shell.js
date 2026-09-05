/* ═══════════════════════════════════════════════════════════
   MySoul AI OS — Shared Page Utilities
   modules/page-shell.js
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── Navigation builder ── */
function buildNav(activeKey) {
  const NAV = [
    {key:'launcher',href:'launcher.html',icon:'⬡',label:'Home'},
    {key:'chat',    href:'../index.html', icon:'💬',label:'Chat'},
    {key:'emotion', href:'emotion.html',  icon:'🎭',label:'Emotion'},
    {key:'daily',   href:'dashboard.html',icon:'✦', label:'Daily'},
    {key:'tasks',   href:'tasks.html',    icon:'📅',label:'Tasks'},
  ];
  const nav = document.getElementById('osNav');
  if(!nav) return;
  NAV.forEach(n=>{
    const a = document.createElement('a');
    a.className='os-nav-item'+(n.key===activeKey?' active':'');
    a.href = n.href;
    a.innerHTML=`<span class="nav-icon">${n.icon}</span><span>${n.label}</span>`;
    nav.appendChild(a);
  });
}

/* ── Particle BG ── */
function buildParticles(canvasId, count=50, color='0,200,255') {
  const c = document.getElementById(canvasId);
  if(!c) return;
  const ctx = c.getContext('2d');
  let pts = [];
  function resize(){c.width=innerWidth;c.height=innerHeight;}
  resize(); window.addEventListener('resize',resize);
  for(let i=0;i<count;i++)
    pts.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.1+.3,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,o:Math.random()*.35+.08});
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
      if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${color},${p.o})`;ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

/* ── API helper (uses existing soul-core pattern) ── */
async function soulAPI(text, systemHint='') {
  const uid = (() => { let id=localStorage.getItem('ms_uid'); if(!id){id=Math.random().toString(36).slice(2,10);localStorage.setItem('ms_uid',id);} return 'user_'+id; })();
  try {
    const r = await fetch('../api/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({user_id:uid, text: systemHint ? `[${systemHint}] ${text}` : text}),
      signal: AbortSignal.timeout(14000),
    });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } catch(e) {
    return {response: null, emotion:'neutral', error: e.message};
  }
}

/* ── Toast ── */
function showToast(msg, type='info') {
  let el=document.getElementById('osToast');
  if(!el){
    el=document.createElement('div');el.id='osToast';
    el.style.cssText='position:fixed;top:16px;left:50%;transform:translateX(-50%) translateY(-20px);z-index:99990;padding:8px 20px;border-radius:20px;font-family:var(--f-display);font-size:12px;letter-spacing:.1em;backdrop-filter:blur(12px);opacity:0;transition:all .35s var(--ease-spring,ease);pointer-events:none;white-space:nowrap;';
    document.body.appendChild(el);
  }
  const colors={info:'rgba(0,200,255,.15)',success:'rgba(56,240,152,.15)',error:'rgba(255,64,96,.15)'};
  const borders={info:'rgba(0,200,255,.4)',success:'rgba(56,240,152,.4)',error:'rgba(255,64,96,.4)'};
  const texts={info:'rgba(0,200,255,.9)',success:'rgba(56,240,152,.9)',error:'rgba(255,64,96,.9)'};
  el.style.background=colors[type]||colors.info;
  el.style.border=`1px solid ${borders[type]||borders.info}`;
  el.style.color=texts[type]||texts.info;
  el.textContent=msg;
  el.style.opacity='1'; el.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(el._t);
  el._t=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(-20px)';},2400);
}

/* ── Markdown-ish formatter ── */
function formatResponse(text) {
  if(!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code style="font-family:var(--f-mono);background:rgba(0,200,255,.1);padding:1px 5px;border-radius:4px;font-size:.92em">$1</code>')
    .replace(/^#{1,3} (.+)$/gm,'<div style="font-family:var(--f-display);font-size:15px;font-weight:700;color:var(--ec);margin:10px 0 4px">$1</div>')
    .replace(/\n/g,'<br>');
}

/* ── Loading state helper ── */
function setLoading(el, on, text='Thinking…') {
  if(!el) return;
  if(on) {
    el.innerHTML=`<div class="os-loading"><div class="os-spinner"></div><span>${text}</span></div>`;
  }
}

window.buildNav=buildNav;
window.buildParticles=buildParticles;
window.soulAPI=soulAPI;
window.showToast=showToast;
window.formatResponse=formatResponse;
window.setLoading=setLoading;
