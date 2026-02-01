
// The entire script is wrapped in an async IIFE so we can use await at top level
(async function () {

    // ------------------------------------------------------------
    // INTERNAL STATE VARIABLES (accumulated during one quiz run)
    // ------------------------------------------------------------

    let totalMs = 0;      // Sum of all per-question timers (for total time)
    let totalScore = 0;   // Sum of scores per question

    // ------------------------------------------------------------
    // IMPORTED UTILITIES (from util.js via global window.AppUtil)
    // Timer → handles DOM timer updates, start/stop/reset, formatting
    // SFX   → handles playing sound effects (click/correct/wrong/success)
    // ------------------------------------------------------------
    const { Timer, SFX } = window.AppUtil;

    // ------------------------------------------------------------
    // LOAD QUIZ DATA (from data/quiz.json)
    // This JSON contains:
    // {
    //   "CategoryName": { "SubcategoryName": [ { q, choices[], a }, ... ] }
    // }
    // The user selects category + subcategory → we extract 10 random items
    // ------------------------------------------------------------
    const DATA = await (await fetch('data/quiz.json')).json();

    // ------------------------------------------------------------
    // SHORTHAND SELECTORS
    // $  → querySelector
    // $$ → querySelectorAll (returning real array)
    // ------------------------------------------------------------
    const $  = s => document.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    // ------------------------------------------------------------
    // DOM ELEMENTS FOR QUIZ UI
    // These IDs are defined in index or quiz HTML
    // (game‑quiz.js does not create them; it **expects** them to exist)
    // ------------------------------------------------------------
    const selCat = $('#quizCat');      // <select> category chooser
    const selSub = $('#quizSub');      // <select> subcategory chooser
    const wrap   = $('#quizWrap');     // container where question HTML is injected

    // Output boxes
    const tOut = $('#quizTime');       // timer output (linked to Timer)
    const cOut = $('#quizCorrect');    // number of correct answers so far
    const sOut = $('#quizScore');      // current total score
    const hOut = $('#quizHigh');       // displayed highscore

    // Dedicated Timer instance updating tOut
    const timer = new Timer(tOut);

    // ------------------------------------------------------------
    // POPULATE <select> ELEMENTS WITH DATA
    // ------------------------------------------------------------

    // Utility to fill a <select> with <option>
    function fill(sel, items) {
        sel.innerHTML = '';
        items.forEach(v => sel.append(new Option(v, v)));
    }

    // Highscore (number) → separate key, not the leaderboard key
    function hsKey() {
      return `highscore:quiz:${selCat.value}:${selSub.value}`;
    }
    // Leaderboard entry (object)
    function lbKey() {
      return `quiz:${selCat.value}:${selSub.value}`;
    }

    // Load current highscore for selected category/subcategory
    function loadHigh() {
      const raw = localStorage.getItem(hsKey());
      const v = raw ? JSON.parse(raw) : 0;
      hOut.textContent = String(v);
    }

    // Fill categories from DATA keys
    fill(selCat, Object.keys(DATA));

    // On category change → update subcategories AND reload highscore
    function updateSub() {
        fill(selSub, Object.keys(DATA[selCat.value] || {}));
        loadHigh();
    }

    selCat.addEventListener('change', updateSub);
    selSub.addEventListener('change', loadHigh);

    // Initialize once at load
    updateSub();

    // ------------------------------------------------------------
    // QUIZ SESSION STATE
    // ------------------------------------------------------------
    let idx = 0;        // current question index
    let correct = 0;    // number of questions answered correctly
    let questions = []; // list of 10 shuffled questions for this run

    // ------------------------------------------------------------
    // START A NEW QUIZ SESSION
    // ------------------------------------------------------------
    function start() {
        disablePreviewButtons();
        totalMs = 0; // reset total accumulated time

        // Load selected subcategory question list (array of objects)
        const list = ((DATA[selCat.value] || {})[selSub.value] || []);

        // Select 10 random questions
        questions = [...list]
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        totalScore = 0;
        totalMs = 0;

        if (!questions.length) {
            wrap.innerHTML = `<p>No items.</p>`;
            return;
        }

        idx = 0;
        correct = 0;
        cOut.textContent = '0';
        sOut.textContent = '0';

        // Reset + start timer for question 1
        timer.reset();
        timer.start();

        // Render first question
        render();

        // Play click SFX
        SFX.click();
    }

    // ------------------------------------------------------------
    // PREVIEW: Show all questions/answers in popup modal
    // (Uses AppUtil.showPreview from util.js)
    // ------------------------------------------------------------
    document.getElementById('quizPreview').addEventListener('click', () => {
        const list = ((DATA[selCat.value] || {})[selSub.value] || []);
        if (!list.length) {
            AppUtil.showPreview('Quiz Preview', `<p>No items.</p>`);
            return;
        }
        const html = list.map((it, i) => `
            <p>Q${i + 1}. ${it.q}<br>
               Answer: ${it.choices[it.a]}</p>
        `).join('');
        AppUtil.showPreview(`Quiz Preview — ${selCat.value} / ${selSub.value}`, html);
    });

    // Score is simply accumulated from each question
    function scoreNow() { return totalScore; }

    // ------------------------------------------------------------
    // FINISH QUIZ (when all 10 questions are done)
    // ------------------------------------------------------------
    function finish() {
        enablePreviewButtons();
        // Stop last question timer
        timer.stop();

        const score = scoreNow();
        sOut.textContent = String(score);

        // Format total quiz time (using Timer.format from util.js)
        const totalTime = AppUtil.Timer.format(totalMs);

        // Show summary screen with “Play again”
        wrap.innerHTML = `
            <p>Done! Correct: ${correct}/${questions.length}
               — Time: ${totalTime}
               — Score: ${score}</p>
            <div class="next-row">
                <button id="quizAgain" class="btn">Play again</button>
            </div>
        `;

        // Restart quiz
        document.getElementById('quizAgain').addEventListener('click', start);

        SFX.success();

        // --------- SAVE HIGHSCORE IN LOCALSTORAGE ---------
        
      // Highscore (number) → hsKey()
      {
        const prev = +(localStorage.getItem(hsKey()) || 0);
        const best = Math.max(prev, totalScore);
        localStorage.setItem(hsKey(), String(best));
        hOut.textContent = String(best);
      }
      // Leaderboard entry (object) → lbKey()
      localStorage.setItem(lbKey(), JSON.stringify({
        score: totalScore,
        right: correct,     // number of correct answers
        ms: totalMs,         // total elapsed ms of the run
        date: new Date().toISOString()   
      }));
}

    // ------------------------------------------------------------
    // RENDER A QUESTION
    // ------------------------------------------------------------
    function render() {

        // No questions available
        if (!questions.length) {
            wrap.innerHTML = `<p>No items in this subcategory.</p>`;
            return;
        }

        // If we are past the last question → finish quiz
        if (idx >= questions.length) {
            finish();  // (corrected from "end()" bug)
            return;
        }

        const q = questions[idx];

        // Shuffle choices so they appear in random order
        const choices = q.choices
            .map((c, i) => ({ text: c, index: i }))
            .sort(() => Math.random() - 0.5);

        // Inject question HTML into #quizWrap
        wrap.innerHTML = `
            <p>Q${idx + 1} of ${questions.length}</p>
            <p>${q.q}</p>
            <div class="choices">
                ${choices.map(ch => `
                    <button class="choice btn" data-i="${ch.index}">
                        ${ch.text}
                    </button>
                `).join('')}
            </div>
            <div class="next-row"></div>
        `;

        // Reset + start timer for this question
        timer.reset();
        timer.start();

        // Attach click handler for each answer choice
        $$('.choice', wrap).forEach(btn =>
            btn.addEventListener('click', (e) => {

                const i = +e.currentTarget.dataset.i;
                const ok = (i === q.a);     // correctness check

                // Stop question timer
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

                // Visual feedback: green/red button
                e.currentTarget.classList.add(ok ? 'correct' : 'wrong');

                // Disable all answer buttons so user cannot click again
                $$('.choice', wrap).forEach(b => b.disabled = true);

                // Update counters + play SFX
                if (ok) {
                    correct++;
                    cOut.textContent = String(correct);
                    SFX.correct();
                } else {
                    SFX.wrong();
                }

                // Update total score display
                sOut.textContent = String(scoreNow());

                // Add “Next” button to move to next question
                const nextRow = document.querySelector('.next-row');
                nextRow.innerHTML = `
                    <button id="quizNext" class="btn">Next</button>
                `;

                document.getElementById('quizNext')
                    .addEventListener('click', () => {
                        idx++;
                        render(); // load next question
                    });
            })
        );
    }

    // ------------------------------------------------------------
    // CONNECT START BUTTON (defined in HTML)
    // ------------------------------------------------------------
    $('#quizStart').addEventListener('click', start);

})();
``
