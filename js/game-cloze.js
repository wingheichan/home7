
(async function(){
  let totalMs = 0;
  let totalScore = 0;
  const { Timer, SFX } = window.AppUtil; const DATA = await (await fetch('data/cloze.json')).json();
  const $ = s=>document.querySelector(s);
  const selCat=$('#clozeCat'), selSub=$('#clozeSub'), wrap=$('#clozeWrap'); const tOut=$('#clozeTime'), corrOut=$('#clozeCorrect'), sOut=$('#clozeScore'), hOut=$('#clozeHigh'); const timer=new Timer(tOut);
  function fill(sel, items){ sel.innerHTML=''; items.forEach(v=> sel.append(new Option(v,v))); }
  

  function hsKey() {
    return `highscore:cloze:${selCat.value}:${selSub.value}`;
  }
  function lbKey() {
    return `cloze:${selCat.value}:${selSub.value}`;
  }


function loadHigh() {
  const raw = localStorage.getItem(hsKey());
  const v = raw ? JSON.parse(raw) : 0;
  hOut.textContent = String(v);
}
  
fill(selCat, Object.keys(DATA)); function updateSub(){ fill(selSub, Object.keys(DATA[selCat.value]||{})); loadHigh(); } selCat.addEventListener('change', updateSub); selSub.addEventListener('change', loadHigh); updateSub();
  let items=[], idx=0, correct=0;
  function start(){
    disablePreviewButtons();
    totalMs = 0;
    totalScore = 0;
    items = [ ...(((DATA[selCat.value]||{})[selSub.value])||[]) ].sort(()=>Math.random()-0.5);
    if(!items.length){ wrap.innerHTML='<p>No items.</p>'; return; }
    idx=0; correct=0; corrOut.textContent='0'; sOut.textContent='0'; timer.reset(); timer.start(); render(); SFX.click(); }
  
  
document.getElementById('clozePreview').addEventListener('click', () => {
  const list = ((DATA[selCat.value] || {})[selSub.value] || []);
  if (!list.length) { AppUtil.showPreview('Cloze Preview', '<p>No items.</p>'); return; }
  const html = list.map((it, i) =>
    `<div style="margin:8px 0"><strong>${i+1}.</strong> ${it.s}<br><em>Answer:</em> ${it.a}</div>`
  ).join('');
  AppUtil.showPreview(`Cloze Preview — ${selCat.value} / ${selSub.value}`, html);
});

  //function scoreNow(){ const secs = Math.floor(totalMs / 1000); return (50*correct) + Math.max(0, 51 - secs); }
function scoreNow() { return totalScore; }
  
function finish(){
  enablePreviewButtons();
  
  // Stop last question timer
  timer.stop();
  
  const score = scoreNow();
  sOut.textContent = String(score);

  //const best = Math.max(score, +(localStorage.getItem(bestKey())||0));
  //localStorage.setItem(bestKey(), String(best));
  //hOut.textContent = String(best);

  const totalTime = AppUtil.Timer.format(totalMs);

  wrap.innerHTML = `
    <p><strong>Finished!</strong> Correct: ${correct}/${items.length} — Time: ${totalTime} — Score: ${score}</p>
    <button class="btn" id="clozeAgain">Play again</button>
  `;
  document.getElementById('clozeAgain').addEventListener('click', start);
  SFX.success();

  
  // Highscore (number)
  {
    const prev = +(localStorage.getItem(hsKey()) || 0);
    const best = Math.max(prev, totalScore);
    localStorage.setItem(hsKey(), String(best));
    hOut.textContent = String(best);
  }
  // Leaderboard entry (object)
  localStorage.setItem(lbKey(), JSON.stringify({
    score: totalScore,
    right: correct,   // number of correct fills
    ms: totalMs,
    date: new Date().toISOString()
  }));
  
  }
  ``

  
function render(){
  if (!items.length){ wrap.innerHTML = '<p>No items in this subcategory.</p>'; return; }
  if (idx >= items.length){ finish(); return; }

  const it = items[idx];

  // Build UI
  wrap.innerHTML = `
    <div class="cloze">
      <div class="small">Item ${idx+1} of ${items.length}</div>
      <div class="prompt">${it.s}</div>
      <div class="controls">
        <input id="clozeInput" type="text" placeholder="Your answer" />
        <button id="clozeCheck" class="btn btn-primary">Check</button>
      </div>
      <div id="clozeFeedback" class="small"></div>
    </div>
  `;

  // Per-item timer
  timer.reset();
  timer.start();

  document.getElementById('clozeCheck').addEventListener('click', () => {
    const guess = (document.getElementById('clozeInput').value || '').trim();
    const ok    = guess.localeCompare(it.a, undefined, { sensitivity: 'accent' }) === 0;

    // stop timer and accumulate
    timer.stop();
    const elapsed = timer.elapsedMs();
    totalMs += elapsed;

    // Score calculation:
    // 50 points + (up to 51 additional based on quickness)
    let questionScore = 0;
    const secs = Math.floor(elapsed / 1000);
    if (ok) {
      questionScore = 50 + (secs < 51 ? (51 - secs) : 0);
      totalScore += questionScore;
      }
    
    // feedback
    const fb = document.getElementById('clozeFeedback');
    fb.textContent = ok ? '✅ Correct!' : `❌ ${it.a}`;

    if (ok) {
      correct++;
      corrOut.textContent = String(correct);
      SFX.correct();
    } else {
      SFX.wrong();
    }

    // update score with totalMs
    sOut.textContent = String(scoreNow());

    // Show Next button; disable Check so they can't re-answer
    document.getElementById('clozeCheck').disabled = true;
    const nextRow = document.createElement('div');
    nextRow.className = 'next-row';
    nextRow.innerHTML = '<button id="clozeNext" class="btn btn-primary">Next</button>';
    wrap.appendChild(nextRow);

    document.getElementById('clozeNext').addEventListener('click', () => {
      idx++;
      render();  // next item; timer resets/starts there
    });
  });
}

  document.getElementById('clozeStart').addEventListener('click', start);
})();
