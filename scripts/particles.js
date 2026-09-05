/* ═══════════════════════════════════════════════════════════
   MySoul AI v3 — Immersive Particle System
   scripts/particles.js
═══════════════════════════════════════════════════════════ */
'use strict';

(function () {
  const canvas = document.getElementById('particleCanvas');
  const ctx    = canvas.getContext('2d');

  /* ── Emotion configs ── */
  const ECFG = {
    neutral:   { rgb:[0,200,255],    speed:.22, shake:0,   nodes:55, star:.5,  mode:'orbit'  },
    joy:       { rgb:[255,224,64],   speed:.45, shake:0,   nodes:70, star:.75, mode:'float'  },
    happy:     { rgb:[255,218,32],   speed:.42, shake:0,   nodes:68, star:.72, mode:'float'  },
    calm:      { rgb:[56,240,152],   speed:.14, shake:0,   nodes:42, star:.38, mode:'drift'  },
    sad:       { rgb:[91,141,238],   speed:.16, shake:0,   nodes:38, star:.32, mode:'fall'   },
    stressed:  { rgb:[255,64,96],    speed:1.4, shake:2.8, nodes:80, star:.85, mode:'shake'  },
    angry:     { rgb:[255,64,96],    speed:1.5, shake:3.2, nodes:85, star:.9,  mode:'shake'  },
    fear:      { rgb:[168,85,247],   speed:.75, shake:1.4, nodes:58, star:.6,  mode:'shake'  },
    love:      { rgb:[255,107,160],  speed:.3,  shake:0,   nodes:62, star:.62, mode:'float'  },
    surprised: { rgb:[255,159,56],   speed:.9,  shake:.8,  nodes:72, star:.78, mode:'burst'  },
    academic:  { rgb:[0,200,255],    speed:.22, shake:0,   nodes:55, star:.5,  mode:'orbit'  },
  };

  let W=0, H=0, mouseX=-9999, mouseY=-9999;
  let voiceActive=false, thinking=false;
  let cfg = { ...ECFG.neutral };
  let time=0, animId=null;

  /* ─── Star ─── */
  class Star {
    constructor(init=false) { this.reset(init); }
    reset(init=false) {
      this.x  = Math.random()*W;
      this.y  = init ? Math.random()*H : (Math.random()<.5 ? -4 : H+4);
      this.r  = Math.random()*1.6+.25;
      this.vx = (Math.random()-.5)*.1;
      this.vy = Math.random()*.12+.03;
      this.tw = Math.random()*Math.PI*2;
      this.ts = Math.random()*.018+.004;
      this.ba = Math.random()*.65+.18;
    }
    update() {
      this.tw += this.ts;
      const sp = cfg.speed/0.22;
      this.x += this.vx + (cfg.shake ? (Math.random()-.5)*cfg.shake*.3 : 0);
      this.y += this.vy*sp;
      if (cfg.mode==='fall') this.y += .2;
      if (this.y>H+4 || this.x<-4 || this.x>W+4) this.reset();
    }
    draw() {
      const a = this.ba*cfg.star*(0.7+0.3*Math.sin(this.tw));
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle = `rgba(180,215,255,${a})`; ctx.fill();
    }
  }

  /* ─── Neural Node ─── */
  class Node {
    constructor() { this.spawn(); }
    spawn() {
      this.x  = Math.random()*W;
      this.y  = Math.random()*H;
      this.vx = (Math.random()-.5)*.28;
      this.vy = (Math.random()-.5)*.28;
      this.r  = Math.random()*2.6+.8;
      this.a  = Math.random()*Math.PI*2;
      this.or = Math.random()*50+8;
      this.os = (Math.random()-.5)*.009;
      this.life = 1;
    }
    update() {
      const spd = voiceActive ? cfg.speed*3 : thinking ? cfg.speed*2 : cfg.speed;
      const mul = spd/0.22;
      this.a += this.os;
      this.x += (Math.cos(this.a)*.28 + this.vx)*mul;
      this.y += (Math.sin(this.a)*.18 + this.vy)*mul;
      if (cfg.mode==='float') this.y -= .07;
      if (cfg.mode==='fall')  this.y += .18;
      if (cfg.mode==='shake') { this.x+=(Math.random()-.5)*cfg.shake*.6; this.y+=(Math.random()-.5)*cfg.shake*.3; }
      if (cfg.mode==='burst') { this.vx*=1.002; this.vy*=1.002; }

      /* Mouse repulsion */
      const dx=this.x-mouseX, dy=this.y-mouseY;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d<170&&d>0){const f=(170-d)/170*.042;this.x+=(dx/d)*f*40;this.y+=(dy/d)*f*40;}

      /* Wrap */
      if(this.x<-60)this.x=W+60; if(this.x>W+60)this.x=-60;
      if(this.y<-60)this.y=H+60; if(this.y>H+60)this.y=-60;
    }
    draw() {
      const [r,g,b]=cfg.rgb;
      const p = thinking ? 0.9 : 0.6+0.4*Math.sin(time*.028+this.a);
      /* Halo */
      const gr=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,this.r*6);
      gr.addColorStop(0,`rgba(${r},${g},${b},${.65*p})`);
      gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r*6,0,Math.PI*2);
      ctx.fillStyle=gr; ctx.fill();
      /* Core */
      ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${r},${g},${b},${.92*p})`; ctx.fill();
    }
  }

  /* ─── Connection web ─── */
  function drawWeb(nodes) {
    const [r,g,b]=cfg.rgb;
    const maxD = thinking ? 160 : 125;
    for(let i=0;i<nodes.length;i++) {
      for(let j=i+1;j<nodes.length;j++) {
        const dx=nodes[i].x-nodes[j].x, dy=nodes[i].y-nodes[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<maxD) {
          const a=(1-d/maxD)*(thinking?.7:.45);
          ctx.beginPath();
          ctx.moveTo(nodes[i].x,nodes[i].y);
          ctx.lineTo(nodes[j].x,nodes[j].y);
          ctx.strokeStyle=`rgba(${r},${g},${b},${a})`;
          ctx.lineWidth=(1-d/maxD)*1.6;
          ctx.stroke();
        }
      }
    }
  }

  /* ─── Nebula ─── */
  function drawNebula() {
    const [r,g,b]=cfg.rgb;
    const t=time*.006, p=.5+.5*Math.sin(t);
    [[.15,.2,200],[.85,.75,160],[.5,.92,180],[.72,.08,140],[.3,.6,120]].forEach(([fx,fy,rad])=>{
      const gr=ctx.createRadialGradient(W*fx,H*fy,0,W*fx,H*fy,rad);
      gr.addColorStop(0,`rgba(${r},${g},${b},${.038*p})`);
      gr.addColorStop(.5,`rgba(${r},${g},${b},${.015*p})`);
      gr.addColorStop(1,'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(W*fx,H*fy,rad,0,Math.PI*2);
      ctx.fillStyle=gr; ctx.fill();
    });
  }

  /* ─── Central aura (when thinking) ─── */
  function drawCenterAura() {
    if(!thinking) return;
    const [r,g,b]=cfg.rgb;
    const p=0.6+0.4*Math.sin(time*.08);
    const cx=W/2, cy=H/2;
    const gr=ctx.createRadialGradient(cx,cy,0,cx,cy,200);
    gr.addColorStop(0,`rgba(${r},${g},${b},${.06*p})`);
    gr.addColorStop(.5,`rgba(${r},${g},${b},${.02*p})`);
    gr.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx,cy,200,0,Math.PI*2);
    ctx.fillStyle=gr; ctx.fill();
  }

  /* ─── Setup ─── */
  let stars, nodes;
  function init() {
    resize();
    stars = Array.from({length:200}, (_,i)=>new Star(i<180));
    nodes = Array.from({length:cfg.nodes}, ()=>new Node());
  }

  function resize() {
    W=canvas.width=window.innerWidth;
    H=canvas.height=window.innerHeight;
  }

  /* ─── Loop ─── */
  function loop() {
    time++;
    ctx.clearRect(0,0,W,H);
    const lt = document.documentElement.getAttribute('data-theme')==='light';
    ctx.fillStyle = lt ? 'rgba(238,243,255,.28)' : 'rgba(5,8,15,.3)';
    ctx.fillRect(0,0,W,H);

    drawNebula();
    drawCenterAura();
    stars.forEach(s=>{s.update();s.draw();});
    drawWeb(nodes);
    nodes.forEach(n=>{n.update();n.draw();});

    animId=requestAnimationFrame(loop);
  }

  /* ─── Public API ─── */
  window.ParticleSystem = {
    init() { init(); loop(); },
    setEmotion(e) {
      cfg = { ...(ECFG[e]||ECFG.neutral) };
      while(nodes.length<cfg.nodes) nodes.push(new Node());
      while(nodes.length>cfg.nodes) nodes.pop();
    },
    setVoiceActive(v) { voiceActive=v; },
    setThinking(v)    { thinking=v; },
    destroy() { if(animId)cancelAnimationFrame(animId); },
  };

  window.addEventListener('resize', ()=>{
    resize();
    stars.forEach(s=>{s.x=Math.random()*W;s.y=Math.random()*H;});
    nodes.forEach(n=>{n.x=Math.random()*W;n.y=Math.random()*H;});
  });
  window.addEventListener('mousemove', e=>{mouseX=e.clientX;mouseY=e.clientY;});
  window.addEventListener('mouseleave',()=>{mouseX=-9999;mouseY=-9999;});

  document.addEventListener('DOMContentLoaded', ()=>window.ParticleSystem.init());
})();
