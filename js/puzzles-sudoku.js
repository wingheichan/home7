
(async function(){
  const { Timer, SFX } = window.AppUtil;
  const DATA = await (await fetch('data/sudoku.json')).json();
  const $ = s=>document.querySelector(s); const $$ = s=>Array.from(document.querySelectorAll(s));
  const selDiff = $('#sudDiff'), board = $('#sudBoard'), msg = $('#sudMsg'); const hudTime = $('#sudTime'); const timer = new Timer(hudTime);
  Object.keys(DATA).forEach(d=> selDiff.append(new Option(d,d)));
  let puzzle=null; function load(){ const list = DATA[selDiff.value]; puzzle = list[Math.floor(Math.random()*list.length)]; renderGrid(puzzle.grid); msg.textContent=''; timer.reset(); timer.start(); SFX.click(); }
  function renderGrid(gridStr){ board.innerHTML=''; const t=document.createElement('table'); t.className='sudoku-grid'; for(let r=0;r<9;r++){ const tr=document.createElement('tr'); for(let c=0;c<9;c++){ const td=document.createElement('td'); const i=r*9+c; const v=gridStr[i]; if (v!=='0'){ td.textContent=v; td.style.color='var(--muted)'; } else { const inp=document.createElement('input'); inp.setAttribute('inputmode','numeric'); inp.setAttribute('maxlength','1'); inp.addEventListener('input', ()=>{ inp.value = inp.value.replace(/[^1-9]/g,''); }); td.appendChild(inp); } tr.appendChild(td);} t.appendChild(tr);} board.appendChild(t); }
  function getUserGrid(){ const cells=[]; $$('.sudoku-grid td').forEach(td=>{ const input=td.querySelector('input'); cells.push(input?(input.value||'0'):(td.textContent||'0')); }); return cells.join(''); }
  $('#sudNew').addEventListener('click', load); selDiff.addEventListener('change', load);
  $('#sudCheck').addEventListener('click', ()=>{ const user=getUserGrid(); const sol=puzzle.solution; if (user===sol){ msg.textContent='✅ Correct!'; timer.stop(); const bestKey=`sudoku:${selDiff.value}`; const best=JSON.parse(localStorage.getItem(bestKey)||'null'); const cur={ms: timer.elapsedMs()}; if(!best || cur.ms<best.ms){ localStorage.setItem(bestKey, JSON.stringify(cur)); } SFX.success(); return; } const tds=$$('.sudoku-grid td'); for(let i=0;i<81;i++){ const input=tds[i].querySelector('input'); if (!input) continue; const v=input.value||'0'; input.style.background = v!=='0' && v!==sol[i] ? 'rgba(220,38,38,.25)' : 'transparent'; } msg.textContent='Some cells are incorrect. Keep trying!'; SFX.wrong(); });
  $('#sudReveal').addEventListener('click', ()=>{ renderGrid(puzzle.solution); timer.stop(); msg.textContent='Solution revealed.'; SFX.success(); });
  // default
  selDiff.value = Object.keys(DATA)[0]; load();
})();
