
(function () {
  // -----------------------------
  // Tiny helper = document.querySelector
  // We use it a few times to get top-level nodes.
  // -----------------------------
  const $ = s => document.querySelector(s);

  // -----------------------------
  // Main container where the leaderboard HTML will be injected.
  // Expected to exist in leaderboard.html:
  //   <div id="lbWrap"></div>
  // -----------------------------
  const wrap = $('#lbWrap');

  // =====================================================================
  // parseStorage()
  // ---------------------------------------------------------------------
  // Scans window.localStorage and extracts ONLY the keys used by games.
  // It groups entries by game type (Quiz, Memory, Cloze, Sudoku, Word Search),
  // then returns a structure like:
  //
  //   {
  //     "Quiz": [
  //       { key: "quiz:Category:Subcategory", value: 123 },
  //       ...
  //     ],
  //     "Memory": [
  //       { key: "memory:Cat:Sub:Mode", value: { ms: 12345, moves: 27 } },
  //       ...
  //     ],
  //     ...
  //   }
  //
  // Notes on expected value shapes:
  //  - Quiz:       NUMBER (the best/highest score for cat/sub)
  //  - Memory:     OBJECT { ms: Number, moves: Number }
  //  - Cloze:      OBJECT { right: Number, ms: Number } -> Changed to a number
  //  - Sudoku:     OBJECT { ms: Number }
  //  - WordSearch: OBJECT { ms: Number }
  //
  // Any other localStorage keys are ignored to avoid noise.
  // =====================================================================
  function parseStorage() {
    const data = {}; // grouping object

    // Iterate through all localStorage keys (browser-provided order).
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue; // just in case

      // -----------------------------
      // Decide which group a key belongs to based on its prefix.
      // We only keep keys that START with one of the known game prefixes.
      // -----------------------------
      let group = null;
      if (k.startsWith('quiz:'))        group = 'Quiz';
      else if (k.startsWith('memory:')) group = 'Memory';
      else if (k.startsWith('cloze:'))  group = 'Fill in';
      else if (k.startsWith('shoot:')) group = 'Shoot';
      else if (k.startsWith('sudoku:')) group = 'Sudoku';
      else if (k.startsWith('wordsearch:')) group = 'Word Search';
      else continue; // Ignore unrelated/unknown keys

      // -----------------------------
      // Read the stored value.
      // - Most of our games store JSON-encoded values.
      // - Quiz stores a plain number (as a string); JSON.parse on "123"
      //   returns 123 just fine.
      // If parsing fails, keep raw string to avoid breaking the UI.
      // -----------------------------
      const raw = localStorage.getItem(k);
      let v;
      try {
        v = JSON.parse(raw);
      } catch {
        v = raw;
      }

      // -----------------------------
      // Push { key, value } into the appropriate group.
      // We create the array lazily the first time we see this group.
      // -----------------------------
      (data[group] ||= []).push({ key: k, value: v });
    }

    // -----------------------------
    // Sort entries within each group so the "best" entries appear first.

    Object.keys(data).forEach(g => {
    data[g].sort((a, b) => {
      const va = (typeof a.value === 'object' && typeof a.value.score === 'number')
        ? a.value.score
        : (typeof a.value === 'number' ? a.value : 0);
  
      const vb = (typeof b.value === 'object' && typeof b.value.score === 'number')
        ? b.value.score
        : (typeof b.value === 'number' ? b.value : 0);
  
      return vb - va;   // highest score first
    });
  });

    return data;
  }

  // =====================================================================
  // fmt(ms)
  // ---------------------------------------------------------------------
  // Utility to turn milliseconds into a "m:ss" string.
  // Defensive: coerce ms to number; fallback to 0 if NaN/undefined.
  // =====================================================================
  function fmt(ms) {
    const sec = Math.floor((+ms || 0) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // =====================================================================
  // render()
  // ---------------------------------------------------------------------
  // Builds the entire leaderboard HTML and injects it into #lbWrap.
  // For each group, we produce a table:
  //
  //   <h4>Group</h4>
  //   <table>
  //     <tr><th>Category</th><th>Best</th></tr>
  //     <tr>
  //       <td>Cat › Sub</td>
  //       <td>...status text...</td>
  //     </tr>
  //   </table>
  //
  // The label is derived from the key (split(':').slice(1)):
  //   - Quiz:       quiz:Cat:Sub         → "Cat › Sub"
  //   - Memory:     memory:Cat:Sub:Mode  → "Cat › Sub › Mode"
  //   - Cloze:      cloze:Cat:Sub        → "Cat › Sub"
  //   - Sudoku:     sudoku:Cat:Sub?      → depends on how you structure keys
  //   - WordSearch: wordsearch:Cat:Sub?  → depends on structure
  //
  // The status cell depends on the group and the shape of its value:
  //   - Quiz:       "Score: <number>"
  //   - Memory:     "Best time: m:ss — Moves: n" -> Changed to "Score: <number>"
  //   - Cloze:      "Correct: n — Time: m:ss", -> Changed to "Score: <number>"
  //   - Sudoku:     "Best time: m:ss"
  //   - Word Search:"Best time: m:ss"
  //
  // NOTE:
  // If a game accidentally writes a plain number to a key where the
  // leaderboard expects an object (e.g., cloze: expecting {right, ms} but
  // receives number 123), you'll see "undefined" fields. Fix on the
  // game side: write the correct object shape under the non-highscore key.
  // =====================================================================
  function render() {
    const data = parseStorage();
    const groups = Object.keys(data);

    // If nothing to show, render a friendly message.
    if (!groups.length) {
      wrap.innerHTML = '<p>No entries yet.</p>';
      return;
    }

    // Build group sections
    wrap.innerHTML = groups.map(g => {
      
    const rows = data[g].map(r => {
      // Label: Category › Subcategory › (Mode)
      const label = r.key.split(':').slice(1).join(' › ');
    
      // Normalize value
      let v = r.value;
      if (typeof v === 'number') {
        v = { score: v };
      }
    
      // Build unified "Score — Correct — Time"
      const parts = [];
      if (typeof v.score === 'number') parts.push(`Score: ${v.score}`);
      if (typeof v.right === 'number') parts.push(`Correct: ${v.right}`);
      if (typeof v.ms === 'number')    parts.push(`Time: ${fmt(v.ms)}`);
    
      const stat = parts.join(' — ') || '—';
      const dt = v.date ? new Date(v.date).toLocaleString() : '-';
      
      // ✅ Proper table row
      return `
        <tr>
          <td>${label}</td>
          <td>${stat}</td>
          <td>${dt}</td> 
        </tr>
      `;
    }).join('');

      // Emit the group header + table
      return `
        <h4>${g}</h4>
        <table class="stats-table">
          <tr>
            <td>Category</td>
            <td>Best</td>
            <td>Date</td>
          </tr>
          ${rows}
         </table>
      `;
    }).join('');
  }

  // =====================================================================
  // Button Wiring
  // ---------------------------------------------------------------------
  // Expected in leaderboard.html:
  //   <button id="lbRefresh">Refresh</button>
  //   <button id="lbClear">Clear all</button>
  //   <button id="lbExport">Export JSON</button>
  //
  // - Refresh: re-runs render() to reflect latest localStorage
  // - Clear all: removes ONLY game-related keys (won't nuke everything)
  // - Export JSON: downloads parseStorage() as leaderboard.json
  // =====================================================================

  // Re-render on demand
  document.getElementById('lbRefresh').addEventListener('click', render);

  // Clear all game entries (by known prefixes) then re-render
  document.getElementById('lbClear').addEventListener('click', () => {
    if (!confirm('Clear all leaderboard entries?')) return;

    // If you add a new game, add its prefix here to be clearable.
    ['quiz:', 'memory:', 'cloze:','shoot:','sudoku:', 'wordsearch:'].forEach(pref => {
      // Iterate backwards as we remove items to avoid index shifting problems.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(pref)) localStorage.removeItem(k);
      }
    });

    render();
  });

  // Export current snapshot to a JSON file (one-click download).
  document.getElementById('lbExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(parseStorage(), null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'leaderboard.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });

  // Initial render when page loads.
  render();

  // ---------------------------------------------------------------------
  // NOTE: Your original file contained duplicated event bindings and render()
  // calls below this line (likely from a merge/paste).
  // They are harmless but redundant. We keep behavior identical by leaving
  // the working set above and (optionally) removing the duplicates.
  // ---------------------------------------------------------------------

  // (Duplicates seen in uploaded file—can be safely removed)
  // document.getElementById('lbRefresh').addEventListener('click', render);
  // document.getElementById('lbClear').addEventListener('click', () => { ... });
  // document.getElementById('lbExport').addEventListener('click', () => { ... });
  // render();

})();
