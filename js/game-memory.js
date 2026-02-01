
(async function(){
  const { Timer, SFX } = window.AppUtil; const DATA = await (await fetch('data/memory.json')).json();
  const $ = s=>document.querySelector(s); const $$ = s=>Array.from(document.querySelectorAll(s));
  const selCat=$('#memCat'), selSub=$('#memSub'), selMode=$('#memMode'); const grid=$('#memGrid'); const tOut=$('#memTime'); const corrOut=$('#memCorrect'); const sOut=$('#memScore'); const hOut=$('#memHigh'); const timer=new Timer(tOut);
  function fill(sel, items){ sel.innerHTML=''; items.forEach(v=> sel.append(new Option(v,v))); }
  

function hsKey() {
   return `highscore:memory:${selCat.value}:${selSub.value}:${selMode.value}`;
 }
 function lbKey() {
   return `memory:${selCat.value}:${selSub.value}:${selMode.value}`;
 }


function loadHigh() {
  const raw = localStorage.getItem(hsKey());
  const v = raw ? JSON.parse(raw) : 0;
  hOut.textContent = String(v);
}
  
fill(selCat, Object.keys(DATA)); function updateSub(){ fill(selSub, Object.keys(DATA[selCat.value]||{})); loadHigh(); } selCat.addEventListener('change', updateSub); selSub.addEventListener('change', loadHigh); selMode.addEventListener('change', loadHigh); updateSub();

  let first=null, lock=false, matches=0, moves=0, totalPairs=8, tilesNodes=[];
  function buildTiles(){
    const pairs = ((DATA[selCat.value]||{})[selSub.value]||[]);
    const pool = pairs.length>=totalPairs ? pairs.slice().sort(()=>Math.random()-0.5).slice(0,totalPairs)
                  : pairs.concat(pairs).slice(0,totalPairs); // ensure at least totalPairs=8
    const tiles = pool.flatMap(p=>[{key:p.a, val:p.a},{key:p.a, val:p.b}]).sort(()=>Math.random()-0.5);
    grid.innerHTML = tiles.map((t,i)=>`<div class="card-tile" data-key="${t.key}" data-i="${i}">${t.val}</div>`).join('');
    tilesNodes = $$('.card-tile');
  }

  document.getElementById('memPreview').addEventListener('click', () => {
    const list = ((DATA[selCat.value] || {})[selSub.value] || []);
    if (!list.length) { AppUtil.showPreview('Memory Preview', '<p>No items.</p>'); return; }
    const html = list.map((p, i) =>
      `<div style="margin:6px 0">${i+1}. <strong>${p.a}</strong> ⇄ <strong>${p.b}</strong></div>`
    ).join('');
    AppUtil.showPreview(`Memory Preview — ${selCat.value} / ${selSub.value}`, html);
  });

  function start(){
    disablePreviewButtons();
    buildTiles(); first=null; lock=false; matches=0; moves=0; corrOut.textContent='0'; sOut.textContent='0'; timer.reset();
    const mode = selMode.value; SFX.click();
    if (mode==='open'){
      tilesNodes.forEach(t=> t.classList.add('revealed'));
      timer.start();
      enableClicks();
    } else if (mode==='preview'){
      tilesNodes.forEach(t=> t.classList.add('revealed'));
      timer.start();
      setTimeout(()=>{ tilesNodes.forEach(t=>{ if(!t.classList.contains('matched')) t.classList.remove('revealed'); }); enableClicks(); }, 10000);
    } else { // closed
      timer.start(); enableClicks();
    }
  }

  function scoreNow(){ const secs=Math.floor(timer.elapsedMs()/1000); return Math.max(0, 1100 - (secs*15)); }

  function enableClicks(){
    tilesNodes.forEach(tile=> tile.addEventListener('click', onTile));
  }

  function onTile(e) {
  const tile = e.currentTarget;

  // Mode flag (open/preview/closed)
  const modeEl = document.getElementById('memMode');
  const isOpenMode = modeEl && modeEl.value === 'open';

  // Block illegal clicks
  if (
    lock ||
    tile.classList.contains('matched') ||
    (tile.classList.contains('revealed') && !isOpenMode)
  ) return;

  // Reveal tile if not already
  if (!tile.classList.contains('revealed')) {
    tile.classList.add('revealed');
  }

  // Apply selected highlight to current click
  tile.classList.add('selected');

  // First of the pair
  if (!first) {
    first = tile;
    return;
  }

  // Second click: check for match
  if (first.dataset.key === tile.dataset.key && first !== tile) {
    // Match
    first.classList.add('matched');
    tile.classList.add('matched');

    // Clear selection highlights (both tiles)
    first.classList.remove('selected');
    tile.classList.remove('selected');

    matches++;
    corrOut.textContent = String(matches);
    SFX.match();
  } else {
    // Mismatch → keep a brief selection highlight, then clear
    SFX.wrong();
  }

  // Resolve and update score
  lock = true;
  setTimeout(() => {
    // Only auto-close non-matched tiles in non-open modes
    if (!isOpenMode) {
      tilesNodes.forEach(t => {
        if (!t.classList.contains('matched')) {
          t.classList.remove('revealed');
        }
      });
    }

    // Always remove 'selected' from any non-matched tiles
    tilesNodes.forEach(t => t.classList.remove('selected'));

    lock = false;
    first = null;
    sOut.textContent = String(scoreNow());

    if (matches === totalPairs) finish();
  }, 550);
}


function finish() {
  enablePreviewButtons();
  timer.stop();
  const score = scoreNow();
  sOut.textContent = String(score);

  // Highscore (number)
  const prev = +(localStorage.getItem(hsKey()) || 0);
  const best = Math.max(prev, score);
  localStorage.setItem(hsKey(), String(best));
  hOut.textContent = String(best);

  // Leaderboard entry (object) — right = matches; also store ms (and moves if you want)
  const totalMs = timer.elapsedMs();
  localStorage.setItem(lbKey(), JSON.stringify({
    score,
    right: matches,     // show "Correct: <matches>" on the leaderboard
    ms: totalMs,
    moves,              // optional; not shown in the unified line, but kept
    date: new Date().toISOString()
  }));

  SFX.success();
}


  $('#memStart').addEventListener('click', start);
})();
