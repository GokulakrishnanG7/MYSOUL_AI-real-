/* ═══════════════════════════════════════════════════════════
   MySoul AI v3 — Voice System
   scripts/voice.js
═══════════════════════════════════════════════════════════ */
'use strict';

const VoiceUI = (() => {
  let rec=null, listening=false, silT=null, onTx=null;
  const SILENCE=2800;

  function init(cb) {
    onTx=cb?.onTranscript;
    _setupSR();
    document.getElementById('micBtn')?.addEventListener('click', toggle);
    document.getElementById('interruptBtn')?.addEventListener('click',()=>{SoulCore.stopSpeak();_setAI(false);});
  }

  function _setupSR() {
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){console.warn('[Voice] SR not supported');return;}
    rec=new SR();rec.continuous=true;rec.interimResults=true;rec.lang='en-US';
    rec.onstart=()=>_setL(true);
    rec.onerror=e=>{if(e.error!=='aborted')_setL(false);};
    rec.onend=()=>{if(listening){try{rec.start();}catch(e){}}};
    rec.onresult=e=>{
      _clrSil(); let fin='',tmp='';
      for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)fin+=t;else tmp+=t;}
      if(fin||tmp)_showTx(fin||tmp,!!fin);
      if(fin){onTx?.(fin.trim());_resetSil();}else _resetSil();
    };
  }

  function toggle(){SoulCore.SFX.click();listening?_stop():_start();}
  function _start(){if(!rec){_sim();return;}try{rec.start();SoulCore.SFX.activate();}catch(e){console.warn(e);}}
  function _stop(){listening=false;_clrSil();try{rec?.stop();}catch(e){}_setL(false);_hideTx();}

  function _setL(on){
    listening=on;
    const mb=document.getElementById('micBtn');
    const mi=document.getElementById('mcIcon');
    const r1=document.getElementById('micField')?.querySelector('.mf-r1');
    const r2=document.getElementById('micField')?.querySelector('.mf-r2');
    const vc=document.getElementById('voiceCorona');
    const ml=document.getElementById('micLegend');
    const core=document.getElementById('soulOrb');
    const fo=document.getElementById('focusOverlay');

    mb?.classList.toggle('active',on);
    if(mi)mi.textContent=on?'■':'◎';
    r1?.classList.toggle('active',on);
    r2?.classList.toggle('active',on);
    vc?.classList.toggle('active',on);
    ml?.classList.toggle('listening',on);
    if(ml)ml.textContent=on?'LISTENING...':'TAP TO SPEAK';
    core?.classList.toggle('speaking',on);
    if(window.ParticleSystem)ParticleSystem.setVoiceActive(on);
    if(on&&fo)fo.style.opacity='.5';
    else if(fo)fo.style.opacity='0';
  }

  function _showTx(t,fin){
    const b=document.getElementById('transcriptBox');
    const tx=document.getElementById('transcriptText');
    b?.classList.remove('hidden');
    if(tx){tx.textContent=t;tx.style.opacity=fin?'1':'.55';}
  }
  function _hideTx(){document.getElementById('transcriptBox')?.classList.add('hidden');}

  function _setAI(on){
    const b=document.getElementById('aiSpeakBar');
    if(on)b?.classList.remove('hidden');else b?.classList.add('hidden');
    document.getElementById('soulOrb')?.classList.toggle('speaking',on);
    if(window.ParticleSystem)ParticleSystem.setVoiceActive(on);
  }

  function _resetSil(){_clrSil();silT=setTimeout(()=>{if(listening)_stop();},SILENCE);}
  function _clrSil(){if(silT){clearTimeout(silT);silT=null;}}

  function _sim(){_setL(true);_showTx('(Demo mode — Speech API unavailable)',false);setTimeout(()=>{onTx?.('I feel really stressed today with everything going on.');_stop();},2200);}

  return {init,toggle,startAI:()=>_setAI(true),stopAI:()=>_setAI(false),isOn:()=>listening};
})();

window.VoiceUI=VoiceUI;

/* ═══════════════════════════════════════════════════════════
   MySoul AI v6 — MediaRecorder → Backend Voice API
   Appended to voice.js
═══════════════════════════════════════════════════════════ */
const MediaVoice = (() => {
  let mediaRec = null, chunks = [], recording = false;

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRec.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
      mediaRec.start(250);
      recording = true;
      return true;
    } catch(e) {
      console.warn('[MediaVoice] Microphone access denied:', e);
      return false;
    }
  }

  async function stopAndSend(onTranscript, onResponse) {
    if(!mediaRec || !recording) return;
    recording = false;
    return new Promise(resolve => {
      mediaRec.onstop = async () => {
        const blob = new Blob(chunks, { type:'audio/webm' });
        // Stop all tracks
        mediaRec.stream.getTracks().forEach(t=>t.stop());
        try {
          const d = await SoulCore.sendVoice(blob);
          if(d.transcript) onTranscript?.(d.transcript);
          if(d.response)   onResponse?.(d);
        } catch(e) {
          // Fallback: use transcript from Web Speech API if available
          console.warn('[MediaVoice] Backend voice failed, using SR transcript');
        }
        resolve();
      };
      mediaRec.stop();
    });
  }

  return { startRecording, stopAndSend, isRecording: ()=>recording };
})();

window.MediaVoice = MediaVoice;
