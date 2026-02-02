
(async function () {
  const { Timer, SFX, showPreview } = window.AppUtil;

  // ---- Load data
  const DATA = await (await fetch('data/shoot.json')).json();

  // ---- DOM helpers
  const $  = s => document.querySelector(s);
  const $$ = (s, r = document) => Array.from((r || document).querySelectorAll(s));

  // ---- UI refs
  const selCat   = $('#shootCat');
  const selSub   = $('#shootSub');
  const selMode  = $('#shootMode');
  const stage    = $('#shootStage');
  const player   = $('#shootPlayer');

  const tOut     = $('#shootTime');
  const cOut     = $('#shootCorrect');
  const sOut     = $('#shootScore');
  const hOut     = $('#shootHigh');
  const hintEl   = $('#shootHint');
  const roundEl  = $('#shootRound');
  const progEl   = $('#shootTarget');

  const timer = new Timer(tOut);

  // ---- Tunables (sizes/speeds)
  const PLAYER_W = 48, PLAYER_H = 64;
  const SHIP_W   = 48, SHIP_H   = 48;
  const TOKEN_FONT = 16;
  const PLAYER_STEP_KEY = 14;     // px per left/right key press
  const PLAYER_STEP_TAP = 44;    // px per mobile tap
  const COOLDOWN_MS = 200;       // delay between shots
  
  // --- Custom Sound Effects ---
  const sndShoot  = new Audio('sounds/laser-shoot.mp3');
  //const sndHit    = new Audio('sounds/explosion-fx.mp3');
  const sndVic    = new Audio('sounds/success-fanfare-trumpets.mp3');
  //const sndMiss   = new Audio('sounds/hit-miss.mp3');
  //const sndWrong  = new Audio('sounds/hit-wrong.mp3');  // optional if different
    
  // ---- Game state
  let running = false, rafId = 0;
  let score = 0, correct = 0, combo = 0, wrong = 0;
  let bullets = [];     // {x,y,v}
  let ships   = [];     // [{el,x,y,token,need}]
  let playerX = 0;

  // line (row) control
  let rowSize = 8;      // 8–10
  let rowStep = 36;     // how far to step down on miss/wrong
  let rowY    = 40;     // current row top y
  let fallSpeed = 1;    // used to scale bullet speed (not ship)
  let bulletSpeed = 460;

  // target control
  let mode = 'letter-rounds';
  let rounds = [];   // for letter-rounds: [{hint,target}]
  let roundIndex = 0;
  let targetTokens = [];    // current round tokens (letters or words)
  let nextIndex = 0;        // next needed index
  
  let wordRounds = [];   // for word mode: array of {hint, sentence?, targetWords[], wordBank[]}

 
  const speakToggle = document.querySelector('#shootSpeakHint');
  // --- Web Speech API language selector (no TTS wrapper needed) ---
  const langSelect = document.querySelector('#shootHintLang');
  if (langSelect) {
      const saved = localStorage.getItem('shoot:tts:lang') || 'en-US';
      langSelect.value = saved;
  
      langSelect.addEventListener('change', () => {
          localStorage.setItem('shoot:tts:lang', langSelect.value);
      });
  }

// --- Web Speech helpers (SpeechSynthesis) ---
function canSpeak() {
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function speakText(text, lang) {
  if (!canSpeak()) { console.warn('SpeechSynthesis not supported'); return; }
  const t = (text || '').trim();
  if (!t) return;

  // Cancel any previous utterances to avoid overlaps
  window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(t);
  u.lang = lang || 'en-US';
  u.rate = 1.0;   // 0.1 .. 10
  u.pitch = 1.0;  // 0 .. 2
  // u.volume = 1.0; // optional

  window.speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (!canSpeak()) return;
  window.speechSynthesis.cancel();
}
  
  function fill(sel, items) {
    sel.innerHTML = '';
    items.forEach(v => sel.append(new Option(v, v)));
  }

  // ---- Keys for highscore & leaderboard
  function hsKey() { return `highscore:shoot:${selCat.value}:${selSub.value}:${selMode.value}`; }
  function lbKey() { return `shoot:${selCat.value}:${selSub.value}:${selMode.value}`; }

  function loadHigh() {
    const raw = localStorage.getItem(hsKey());
    const v = raw ? JSON.parse(raw) : 0;
    hOut.textContent = String(v);
  }

  fill(selCat, Object.keys(DATA));
  function updateSub() {
    fill(selSub, Object.keys(DATA[selCat.value] || {}));
    updateModeOptions();
    loadHigh();
  }
  selCat?.addEventListener('change', updateSub);
  selSub?.addEventListener('change', () => { updateModeOptions(); loadHigh(); });
  selMode?.addEventListener('change', loadHigh);
  updateSub();

  // Disable modes that don't exist in selected sub
  function updateModeOptions() {
    if (!selMode) return;
    const list = ((DATA[selCat.value] || {})[selSub.value] || []);
    const hasLR  = list.some(x => x.mode === 'letter-rounds');
    const hasWrd = list.some(x => x.mode === 'word');
    [...selMode.options].forEach(opt => {
      if (opt.value === 'letter-rounds') opt.disabled = !hasLR;
      if (opt.value === 'word')          opt.disabled = !hasWrd;
    });
    if (selMode.selectedOptions[0]?.disabled) {
      selMode.value = hasLR ? 'letter-rounds' : (hasWrd ? 'word' : selMode.value);
    }
  }

  // ---- Progress display (only caught, per your preference)
  function renderProgress() {
    if (!progEl) return;
    if (!targetTokens || nextIndex <= 0) { progEl.textContent = ''; return; }
    const caught = targetTokens.slice(0, nextIndex);
    progEl.innerHTML = caught.map(tok =>
      `<span class="target-token">${String(tok)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`
    ).join(' ');
  }

  // ---- Pick selected config and prepare targets
  function pickItem() {
    const list = ((DATA[selCat.value] || {})[selSub.value] || []);
    if (!list.length) return null;
    mode = selMode?.value || 'letter-rounds';
    const item = list.find(x => x.mode === mode) || list[0];
    
    rowSize     = Number(item.rowSize)     || 10; // 8..10 recommended
    rowStep     = Number(item.rowStep)     || 36;
    bulletSpeed = Number(item.bulletSpeed) || 460;
    fallSpeed   = Number(item.speed)       || 1;

    if (mode === 'letter-rounds') {
      rounds = (item.rounds || []).slice(0, 10);
      roundIndex = 0;
      if (!rounds.length) return null;
      targetTokens = (rounds[0].target || '').split('');
    }  else { // word mode
      wordRounds = (item.wordRounds || []).slice(0, 10);
      roundIndex = 0;
      if (!wordRounds.length) return null;
      targetTokens = (wordRounds[0].targetWords || []).slice();
    }
    return item;
  }

  // ---- Build a new line of ships for the "next needed" token
  function buildLineForNeed(item) {
    // Clear old
    ships.forEach(s => s.el.remove());
    ships = [];

    const need = targetTokens[nextIndex];
    const tokens = [];

    if (mode === 'letter-rounds') {
        const alphabet   = item.alphabet   || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const distractor = item.distractors || '';
        const needStr    = String(need);
        const needU      = needStr.toUpperCase();
        const needL      = needStr.toLowerCase();
      
        // 1) Build confusable preference set (case-insensitive)
        const confStr = (item.confusables?.[needL] || '');
        const conf = confStr.split('')
          .filter(ch => ch.toUpperCase() !== needU);
      
        // 2) Build fallback pool from alphabet + distractors (excluding the need)
        const fallback = (alphabet + distractor).split('')
          .filter(ch => ch.toUpperCase() !== needU);
      
        // Helper to append unique tokens (case-insensitive de-dup)
        const seen = new Set([needU]);
        const addUnique = (arr) => {
          for (const ch of arr) {
            const u = ch.toUpperCase();
            if (!seen.has(u)) {
              tokens.push(ch);
              seen.add(u);
            }
            if (tokens.length >= rowSize) break;
          }
        };
      
        // Always include the needed character first
        tokens.push(need);
      
        // Prefer confusables; then fill from fallback (shuffled)
        addUnique(conf);
        if (tokens.length < rowSize) {
          const fb = fallback.slice().sort(() => Math.random() - 0.5);
          addUnique(fb);
        }
      } else {
        // word mode (unchanged)
        const wr = wordRounds[roundIndex] || {};
        const bank = Array.isArray(wr.wordBank) && wr.wordBank.length
          ? wr.wordBank.slice()
          : targetTokens.slice();
        const idx = bank.indexOf(need);
        if (idx !== -1) bank.splice(idx, 1);
        tokens.push(need);
        while (tokens.length < rowSize && bank.length) {
          const i = Math.floor(Math.random() * bank.length);
          tokens.push(bank.splice(i, 1)[0]);
        }
      }

    // shuffle tokens
    tokens.sort(() => Math.random() - 0.5);

    // place across stage width
    const rect = stage.getBoundingClientRect();
        
    const totalWidth = rect.width;         // ← avoid the hard-coded 540
    const shipW = SHIP_W;
    const cols = Math.min(rowSize, tokens.length);  // ← define cols
    const gap = cols > 1 ? (totalWidth - shipW * cols) / (cols - 1) : 0;

   for (let i = 0; i < cols; i++) {
      const el = document.createElement('div');
      el.className = 'shoot-ship';
      el.style.width  = `${SHIP_W}px`;
      el.style.height = `${SHIP_H}px`;
      
      el.innerHTML = `
        <div class="token ${mode === 'word' ? 'word' : ''}">
          ${tokens[i]}
        </div>
      `;
      stage.appendChild(el);
     
    // Position ships evenly across the row:
      const x = Math.round(i * (shipW + gap));  // ← use ship width + gap
      const y = rowY;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    
      ships.push({ el, x, y, token: tokens[i] });

    }
  }

    // ---- Start round helpers 
    function startRound() {
    if (mode === 'letter-rounds') {
      const r = rounds[roundIndex];
      hintEl && (hintEl.textContent = r?.hint || '');
      roundEl && (roundEl.textContent = `(${roundIndex + 1} / ${rounds.length})`);
      targetTokens = (r?.target || '').split('');
    } else if (mode === 'word') {
      const wr = wordRounds[roundIndex];
      hintEl && (hintEl.textContent = wr?.hint || '');
      roundEl && (roundEl.textContent = `(${roundIndex + 1} / ${wordRounds.length})`);
      targetTokens = (wr?.targetWords || []).slice();
    } else {
      return;
    }
    nextIndex = 0;
    rowY = 40;
    renderProgress();

      // Auto-speak the hint when a new round starts
    {
      const lang = localStorage.getItem('shoot:tts:lang') || 'en-US';
      speakText(hintEl?.textContent || '', lang);
    }  
   // --- FIX: Refresh alien ships for the new round ---
    {
      // get the current item so buildLineForNeed knows distractors/wordBank
      const item = (mode === 'letter-rounds')
        ? (DATA[selCat.value][selSub.value].find(x => x.mode === 'letter-rounds'))
        : (DATA[selCat.value][selSub.value].find(x => x.mode === 'word'));
    
      buildLineForNeed(item);
    }
  }
    
    function nextRoundOrFinish() {
    if (mode === 'letter-rounds') {
      roundIndex++;
      if (roundIndex >= rounds.length) finish(); else startRound();
    } else if (mode === 'word') {
      roundIndex++;
      if (roundIndex >= wordRounds.length) finish(); else startRound();
    } else {
      finish();
    }
  }

  // ---- Start a session
  function start() {
    disablePreviewButtons();
    stopSpeaking();   
    const item = pickItem();

    bullets = []; ships = [];
    score = 0; correct = 0; combo = 0, wrong = 0;
    nextIndex = 0; rowY = 40;

    cOut.textContent = '0'; sOut.textContent = '0';
    if (!item || !targetTokens.length) {
      stage.innerHTML = '<p class="center small">No items for this selection.</p>';
      return;
    }

    // Place player in center
    const rect = stage.getBoundingClientRect();
    playerX = (rect.width - PLAYER_W) / 2;
    player.style.left = `${playerX}px`;
    player.style.width = `${PLAYER_W}px`;
    player.style.height = `${PLAYER_H}px`;

    // Clear ships/bullets
    $$('.shoot-ship', stage).forEach(el => el.remove());
    $$('.shoot-bullet', stage).forEach(el => el.remove());

    // Hint/progress
    //if (mode === 'letter-rounds') startRound(); else { hintEl && (hintEl.textContent = ''); roundEl && (roundEl.textContent = ''); renderProgress(); }
    startRound();
    
    // Build first line
    buildLineForNeed(item);

    // Begin loop
    timer.reset(); timer.start();
    running = true; SFX.click();
    lastShotAt = 0;
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(ts => tick(ts, item));
  }

  // ---- Shooting
  let lastShotAt = 0;
  function shoot() {
    if (!running) return;
    const now = performance.now();
    if (now - lastShotAt < COOLDOWN_MS) return; // cooldown
    lastShotAt = now;

    const b = document.createElement('div');
    b.className = 'shoot-bullet';
    stage.appendChild(b);
    const bx = playerX + (PLAYER_W/2) - 2; // center bullet
    const by = stage.clientHeight - PLAYER_H - 10; // just above player
    b.style.left = `${bx}px`; b.style.top = `${by}px`;
    bullets.push({ el: b, x: bx, y: by, v: -bulletSpeed }); // upward
    
    sndShoot.currentTime = 0;
    sndShoot.play();

  }

  // ---- Collision helpers
  function bulletHitsShip(b, s) {
    return (b.x < s.x + SHIP_W) && (b.x + 4 > s.x) && (b.y < s.y + SHIP_H) && (b.y + 16 > s.y);
  }

  // ---- Scoring
  function award(ok) {
    if (ok) {
      combo++;
      const pts = 50 + Math.min(50, 10 * (combo - 1));
      score += pts;
      
      // ✅ HUD "Correct" update happens here for LETTERS only
      if (mode !== 'word') {
        correct++;
        cOut.textContent = String(correct);
      }
      
     SFX.correct();

    } else {
      wrong++;
      combo = 0;
      score = Math.max(0, score - 10);
      SFX.wrong();
    }
    sOut.textContent = String(score);
  }

  // ---- Step the alien line down on miss/wrong
  function stepDown() {
    rowY += rowStep;
    ships.forEach(s => { s.y = rowY; s.el.style.top = `${rowY}px`; });
    // If ships reach near player → finish (fail)
    const limit = stage.clientHeight - PLAYER_H - 48; // safety band
    if (rowY >= limit) finish();
  }

  // ---- Main loop
  function tick(ts, item) {
    if (!running) return;

    // Move bullets
    bullets.forEach(b => {
      b.y += b.v * (1/60); // approx 60fps delta; it's fine for simple loop
      b.el.style.top = `${b.y}px`;
    });

    // Collisions
    let anyHit = false, hitWasCorrect = false;
    bullets = bullets.filter(b => {
      // out of bounds = miss -> stepDown will be handled below (once)
      if (b.y < -20) { b.el.remove(); return false; }
      for (const s of ships) {
        if (bulletHitsShip(b, s)) {
          // Check if this ship token is the needed
          const need = targetTokens[nextIndex];
          const ok = String(s.token).toUpperCase() === String(need).toUpperCase();
          anyHit = true; hitWasCorrect = ok;
          award(ok);

          // remove bullet and ship
          b.el.remove(); s.el.remove();
          ships = ships.filter(x => x !== s);

          if (ok) {
            // advance progress / round
            nextIndex++;
            renderProgress();
           if (nextIndex >= targetTokens.length) {
              // ✅ For word mode: count 1 "correct" per completed sentence
              if (mode === 'word') {
                correct++;
                cOut.textContent = String(correct);
              }
            
              nextRoundOrFinish();
              return false;
            } else {
              // Build a fresh line for the next needed token
              buildLineForNeed(item);
            }
          } else {
            // wrong hit: line steps down
            stepDown();
            // rebuild current need (keep same nextIndex)
            buildLineForNeed(item);
          }
          return false;
        }
      }
      return true;
    });

    // If a bullet went off‑screen and nothing was hit → step down once
    if (!anyHit) {
      const off = bullets.find(b => b.y < -20);
      if (off) stepDown();
    }

    rafId = requestAnimationFrame(ts2 => tick(ts2, item));
  }

  // ---- Finish
  function finish() {
    enablePreviewButtons();
    stopSpeaking();
    
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    timer.stop();

    const totalMs = timer.elapsedMs();

    // Highscore (number)
    const prev = +(localStorage.getItem(hsKey()) || 0);
    const best = Math.max(prev, score);
    localStorage.setItem(hsKey(), String(best));
    hOut.textContent = String(best);

    // Leaderboard entry (object) — "right" is letters/words caught correctly
    localStorage.setItem(lbKey(), JSON.stringify({ score, right: (mode === 'word'
        ? (roundIndex >= (wordRounds?.length || 0) ? wordRounds.length : roundIndex)
        : (roundIndex >= (rounds?.length || 0) ? rounds.length : nextIndex)),
      wrong, ms: totalMs, date: new Date().toISOString() }));

    
    sndVic.currentTime = 0;  // or a "victory" sound
    sndVic.play();

  }

    // --- Letter hot-shoot helper: move under matching ship and fire ---
    function jumpUnderShipAndShoot(ch) {
      if (!running) return false;
      if (!ch || typeof ch !== 'string') return false;
    
      // Normalize and compare case-insensitively (works with ä, ö, ü, ß, etc.)
      const target = ch.normalize('NFC').toUpperCase();
    
      // Only consider ships whose token is a single character
      const candidates = ships.filter(s => String(s.token).length === 1);
    
      if (!candidates.length) return false;
    
      // Find all ships that match the pressed letter
      const matches = candidates.filter(s =>
        String(s.token).normalize('NFC').toUpperCase() === target
      );
    
      if (!matches.length) return false;
    
      // If multiple ships match (rare), pick the one nearest to current playerX
      const rect = stage.getBoundingClientRect();
      const playerCenter = playerX + (PLAYER_W / 2);
    
      let best = matches[0];
      let bestDist = Math.abs((best.x + SHIP_W / 2) - playerCenter);
    
      for (let i = 1; i < matches.length; i++) {
        const cand = matches[i];
        const dist = Math.abs((cand.x + SHIP_W / 2) - playerCenter);
        if (dist < bestDist) { best = cand; bestDist = dist; }
      }
    
      // Move player so its center is under the ship center, clamp to stage
      const targetX = Math.round((best.x + (SHIP_W / 2)) - (PLAYER_W / 2));
      playerX = Math.max(0, Math.min(rect.width - PLAYER_W, targetX));
      player.style.left = `${playerX}px`;
    
      // Fire (respects your COOLDOWN_MS and lastShotAt guard)
      shoot();
      return true;
    }
  
  // ---- Controls
  function onKey(e) {
  if (!running) return;

  // --- Letter hot-shoot: try this first ---
  // If a single printable character is pressed, try to shoot by that letter.
  if (e.key && e.key.length === 1) {
    const letter = e.key;
    // Only trigger in letter-rounds OR when all tokens are one-char
    const inLetterMode = (mode === 'letter-rounds');
    const allSingleChar = ships.length && ships.every(s => String(s.token).length === 1);
    if (inLetterMode || allSingleChar) {
      const didShoot = jumpUnderShipAndShoot(letter);
      if (didShoot) { e.preventDefault(); return; }
    }
  }

  // --- Existing movement / fire controls ---
  const rect = stage.getBoundingClientRect();

  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    playerX = Math.max(0, playerX - PLAYER_STEP_KEY);
    player.style.left = `${playerX}px`; e.preventDefault();
  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    playerX = Math.min(rect.width - PLAYER_W, playerX + PLAYER_STEP_KEY);
    player.style.left = `${playerX}px`; e.preventDefault();
  } else if (e.key === ' ' || e.code === 'Space') {
    shoot(); e.preventDefault();
  }
}
  
  document.addEventListener('keydown', onKey);

  // Mobile buttons (null-safe)
  const btnL = $('#shootLeft'), btnR = $('#shootRight'), btnF = $('#shootFire');
  btnL && btnL.addEventListener('click', () => {
    const rect = stage.getBoundingClientRect();
    playerX = Math.max(0, playerX - PLAYER_STEP_TAP);
    player.style.left = `${playerX}px`;
  });
  btnR && btnR.addEventListener('click', () => {
    const rect = stage.getBoundingClientRect();
    playerX = Math.min(rect.width - PLAYER_W, playerX + PLAYER_STEP_TAP);
    player.style.left = `${playerX}px`;
  });
  btnF && btnF.addEventListener('click', shoot);

  // --- Speak Again button ---
  const speakBtn = document.querySelector('#shootHintSpeakBtn');
  speakBtn && speakBtn.addEventListener('click', () => {
    const text = hintEl?.textContent || '';
    const lang = localStorage.getItem('shoot:tts:lang') || 'en-US';
    speakText(text, lang);
  });
  
    //const text = hintEl?.textContent || '';
    //if (!text.trim()) return;
  
    // Load selected language from localStorage
   // const lang = localStorage.getItem('shoot:tts:lang') || 'en-US';
  
    //TTS.speak(text, lang, { rate: 1.0, pitch: 1.0 });
  //});
  
  // Preview
  $('#shootPreview')?.addEventListener('click', () => {
    const list = ((DATA[selCat.value] || {})[selSub.value] || []);
    if (!list.length) { showPreview('Shoot Preview', '<p>No items.</p>'); return; }
    const m = selMode?.value || 'letter-rounds';
    const html = list.filter(it => it.mode === m).map((it, i) => {
    if (m === 'letter-rounds') {
      const seq = (it.rounds || []).map(r => r.target).join(', ');
      return `<p>${i+1}. ${seq}</p>`;
    } else {
      const seq = (it.wordRounds || []).map((wr, idx) => {
        const label = wr.sentence ? wr.sentence : (wr.targetWords || []).join(' ');
        return `${idx+1}) ${label}`;
      }).join('<br>');
      return `<p>${i+1}.<br>${seq}</p>`;
    }
  }).join('');
    showPreview(`Shoot Preview — ${selCat.value} / ${selSub.value} (${m})`, html || '<p>No matching items.</p>');
  });

  // Start
  $('#shootStart')?.addEventListener('click', start);
})();
