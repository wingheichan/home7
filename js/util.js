
(function(){
  class Timer { constructor(out){ this.out=out; this._t0=null; this._h=null; }
    start(){ this._t0=performance.now(); this._h && cancelAnimationFrame(this._h); const tick=()=>{ const ms=this.elapsedMs(); if(this.out) this.out.textContent = Timer.format(ms); this._h=requestAnimationFrame(tick); }; this._h=requestAnimationFrame(tick); }
    stop(){ this._h && cancelAnimationFrame(this._h); this._h=null; }
    reset(){ this._t0=performance.now(); if(this.out) this.out.textContent='00:00'; }
    elapsedMs(){ return this._t0 ? (performance.now()-this._t0) : 0; }
    static format(ms){ const s=Math.floor(ms/1000), m=Math.floor(s/60), ss=s%60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; }
  }
  let muted = (localStorage.getItem('sfx') === 'off');
  function setMuted(v){ muted = v; localStorage.setItem('sfx', v ? 'off' : 'on'); }
  const ctx = new (window.AudioContext||window.webkitAudioContext)();
  function beep({freq=440,type='sine',duration=.15,volume=.25}){ if(muted) return; const o=ctx.createOscillator(), g=ctx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=volume; o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime+duration); }
  const SFX = { click(){beep({freq:500,type:'square',duration:.07,volume:.18});}, correct(){beep({freq:880});}, wrong(){beep({freq:220,type:'sawtooth'});}, success(){beep({freq:660,type:'triangle',duration:.25});}, match(){beep({freq:720});}, toggle(){ setMuted(!muted); }, isMuted(){ return muted; } };
  window.AppUtil = { Timer, SFX };
})();

// ===== Preview Overlay helper (global under AppUtil) =====
(function () {
  function showPreview(title, innerHTML) {
    const existing = document.getElementById('previewOverlay');
    if (existing) existing.remove();

    // Backdrop
    const wrap = document.createElement('div');
    wrap.id = 'previewOverlay';
    wrap.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2000',
      'background:rgba(0,0,0,.6)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'padding:20px'
    ].join(';');

    // Card
    const card = document.createElement('div');
    card.style.cssText = [
      'max-width:min(900px, 90vw)',
      'max-height:min(80vh, 80vh)',
      'overflow:auto',
      'background:var(--card)',
      'color:var(--text)',
      'border:1px solid var(--border)',
      'border-radius:12px',
      'box-shadow:var(--shadow)',
      'padding:16px'
    ].join(';');

    // Actual title + Close + content
    card.innerHTML =
      `<div style="display:flex;align-items:center;gap:12px;position:sticky;top:0;background:var(--card);padding:6px 0 8px">` +
      `<h2 style="margin:0;font-size:18px">${title}</h2>` +
      `<button id="closePreview" class="btn" style="margin-left:auto">Close</button>` +
      `</div>` +
      `<div class="small" style="opacity:.8;margin-bottom:8px">Preview (read-only)</div>` +
      `<div>${innerHTML}</div>`;

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    // Close behavior
    const close = () => wrap.remove();
    document.getElementById('closePreview').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  }

  // Expose via AppUtil (alongside Timer/SFX)
  window.AppUtil = window.AppUtil || {};
  window.AppUtil.showPreview = showPreview;
})();

// util.js (near your AppUtil stuff)
(function () {
  const synth = window.speechSynthesis;
  const storeKey = 'shoot:tts:enabled';

  function canSpeak() {
    return !!synth;
  }

  function getEnabled() {
    try { return JSON.parse(localStorage.getItem(storeKey)) === true; }
    catch { return false; }
  }

  function setEnabled(v) {
    localStorage.setItem(storeKey, JSON.stringify(!!v));
  }

  // Optional: cache voices once available
  let voices = [];
  function loadVoices() {
    voices = synth ? synth.getVoices() : [];
  }
  if (canSpeak()) {
    loadVoices();
    // Some browsers load voices asynchronously
    synth.addEventListener?.('voiceschanged', loadVoices);
  }

  // Pick a voice by BCP-47 language tag (e.g., 'en-US', 'es-ES')
  function pickVoice(lang) {
    if (!voices?.length) return null;
    if (!lang) return voices[0] || null;
    // Prefer exact language match; fallback to same base language
    const exact = voices.find(v => v.lang?.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const base = lang.split('-')[0].toLowerCase();
    return voices.find(v => v.lang?.toLowerCase().startsWith(base)) || voices[0] || null;
  }

  function stop() {
    if (canSpeak()) synth.cancel();
  }

  function speak(text, lang = 'en-US', opts = {}) {
    if (!canSpeak() || !getEnabled() || !text) return;
    stop(); // cancel anything queued/playing
    const u = new SpeechSynthesisUtterance(String(text));
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || lang;
    u.rate = typeof opts.rate === 'number' ? opts.rate : 1.0;   // 0.1 .. 10
    u.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.0; // 0 .. 2
    u.volume = typeof opts.volume === 'number' ? opts.volume : 1.0; // 0 .. 1
    synth.speak(u);
  }

  window.TTS = { canSpeak, getEnabled, setEnabled, speak, stop };
})();
