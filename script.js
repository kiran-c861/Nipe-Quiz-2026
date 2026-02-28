/*
=============== NIPE QUIZ Portal ===============
Firebase Firestore — Multi-Device Sync
- Session & quiz-state : localStorage (device only)
- Quizzes, Results, Selections, Congrats: Firestore
- Admin password : Nipe@2026
================================================
*/

// =============================================
//  CONFIG
// =============================================
const ADMIN_PASSWORD = 'Nipe@2026';

// Firestore collection / document references
const MAIN_DOC = () => fsdb.collection('nipe_main').doc('main');
const RESULTS_COL = () => fsdb.collection('nipe_results');

// =============================================
//  IN-MEMORY CACHE (loaded from Firestore once)
// =============================================
const DB = {
    quizzes: [],
    results: [],
    selections: {},
    congrats: {}
};

// =============================================
//  LOAD FROM FIRESTORE
// =============================================
async function loadFromDB() {
    try {
        // Fetch main doc (quizzes, selections, congrats)
        const mainSnap = await MAIN_DOC().get();
        if (mainSnap.exists) {
            const d = mainSnap.data();
            DB.quizzes = d.quizzes || [];
            DB.selections = d.selections || {};
            DB.congrats = d.congrats || {};
        } else {
            // First run — create the main document
            await MAIN_DOC().set({ quizzes: [], selections: {}, congrats: {} });
        }

        // Fetch results (ordered by submittedAt ascending)
        const resultsSnap = await RESULTS_COL().orderBy('submittedAt', 'asc').get();
        DB.results = resultsSnap.docs.map(d => d.data());

        return true;
    } catch (e) {
        console.error('[loadFromDB]', e);
        return false;
    }
}

// =============================================
//  DATA WRITE HELPERS
// =============================================
async function saveQuizzes(quizzes) {
    DB.quizzes = quizzes;
    await MAIN_DOC().update({ quizzes });
}

async function saveSelections(selections) {
    DB.selections = selections;
    await MAIN_DOC().update({ selections });
}

async function saveCongrats(congrats) {
    DB.congrats = congrats;
    await MAIN_DOC().update({ congrats });
}

async function pushResult(result) {
    DB.results.push(result);
    await RESULTS_COL().add(result);
}

// =============================================
//  localStorage HELPERS  (session / quizState)
// =============================================
function lsGet(key, def) {
    try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
}
function lsSet(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
}

// =============================================
//  SESSION (always localStorage — device only)
// =============================================
const Session = {
    get: () => lsGet('NIPE_session', null),
    set: (s) => lsSet('NIPE_session', s),
    clear: () => localStorage.removeItem('NIPE_session'),
};
const QuizState = {
    get: () => lsGet('NIPE_quizState', null),
    set: (s) => lsSet('NIPE_quizState', s),
    clear: () => localStorage.removeItem('NIPE_quizState'),
};

// =============================================
//  ROUTE GUARD
// =============================================
function checkAuth() {
    const page = document.body.getAttribute('data-page');
    const session = Session.get();
    if (page === 'login') {
        // Always show login page — clear any old session so index.html is always the start
        Session.clear();
        QuizState.clear();
    } else {
        if (!session) { window.location.href = 'index.html'; return; }
        if (page === 'admin' && session.role !== 'admin') window.location.href = 'user.html';
        if ((page === 'user' || page === 'quiz') && session.role !== 'user') window.location.href = 'admin.html';
    }
}

function logout() {
    Session.clear();
    QuizState.clear();
    window.location.href = 'index.html';
}

// =============================================
//  APP STARTUP
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    checkAuth();
    const page = document.body.getAttribute('data-page');
    const loader = document.getElementById('db-loader');

    if (page === 'login') {
        initLogin();
        return;
    }

    // Show loading overlay while connecting to Firestore
    if (loader) loader.classList.remove('hidden');

    const ok = await loadFromDB();

    if (loader) loader.classList.add('hidden');

    updateDbBadge(ok);

    if (!ok) {
        showToast('⚠ Could not connect to Firebase. Check your Firebase config / Firestore rules.', 7000);
    }

    if (page === 'admin') initAdmin();
    if (page === 'user') initUser();
    if (page === 'quiz') initQuiz();
});

function updateDbBadge(ok) {
    const badge = document.getElementById('db-status-badge');
    if (!badge) return;
    if (ok) {
        badge.className = 'db-status-badge db-status-ok';
        badge.innerText = '🔥 Firebase: Connected';
    } else {
        badge.className = 'db-status-badge db-status-error';
        badge.innerText = '❌ Firebase: Error';
    }
}

// =============================================
//  LOGIN SYSTEM
// =============================================
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    if (tab === 'user') {
        document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
        document.getElementById('user-login-form').classList.add('active');
    } else {
        document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
        document.getElementById('admin-login-form').classList.add('active');
    }
}

function togglePw() {
    const pw = document.getElementById('admin-password');
    pw.type = pw.type === 'password' ? 'text' : 'password';
}

function initLogin() {
    // Student login
    document.getElementById('user-login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const err = document.getElementById('user-error');
        err.innerText = '';

        const usn1 = document.getElementById('usn1').value.trim().toUpperCase();
        const name1 = document.getElementById('name1').value.trim();
        const usn2 = document.getElementById('usn2').value.trim().toUpperCase();
        const name2 = document.getElementById('name2').value.trim();

        if (!usn1 || !name1 || !usn2 || !name2) {
            err.innerText = 'Error: All four fields are required.'; return;
        }
        if (usn1 === usn2) {
            err.innerText = 'Error: Both students cannot have the same USN.'; return;
        }
        Session.set({ role: 'user', student1: { usn: usn1, name: name1 }, student2: { usn: usn2, name: name2 } });
        window.location.href = 'user.html';
    });

    // Admin login
    document.getElementById('admin-login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const pass = document.getElementById('admin-password').value;
        const err = document.getElementById('admin-error');
        if (pass === ADMIN_PASSWORD) {
            Session.set({ role: 'admin' });
            window.location.href = 'admin.html';
        } else {
            err.innerText = 'Error: Invalid Administrator Password.';
        }
    });
}

// =============================================
//  ADMIN DASHBOARD
// =============================================
let questionCount = 0;

function initAdmin() {
    renderQuizList();
    renderResults();
    addQuestionUI();

    document.getElementById('create-quiz-form').addEventListener('submit', (e) => {
        e.preventDefault();
        saveNewQuiz();
    });

    // CSV drag-and-drop
    const dropZone = document.getElementById('csv-drop-zone');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.name.endsWith('.csv')) handleCsvFile(file);
            else showCsvStatus('error', 'Please drop a valid .csv file.');
        });
    }
}

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tabName).classList.remove('hidden');
    event.target.classList.add('active');
    if (tabName === 'results') renderResults();
    if (tabName === 'quizzes') renderQuizList();
}

function addQuestionUI() {
    questionCount++;
    const container = document.getElementById('questions-container');
    const qBox = document.createElement('div');
    qBox.className = 'q-box';
    qBox.dataset.qid = questionCount;
    qBox.innerHTML = `
        <h4 style="margin-bottom:1.5rem; color:var(--primary);">Question ${questionCount}</h4>
        ${questionCount > 1 ? `<button type="button" class="btn danger-btn small-btn remove-q" onclick="this.parentElement.remove()">✕ Remove</button>` : ''}
        <div class="form-group">
            <label>Question Text</label>
            <input type="text" class="q-text" placeholder="Type the question here..." required>
        </div>
        <div class="options-grid-form">
            <div class="form-group"><label>Option A</label><input type="text" class="q-opt0" placeholder="Option A" required></div>
            <div class="form-group"><label>Option B</label><input type="text" class="q-opt1" placeholder="Option B" required></div>
            <div class="form-group"><label>Option C</label><input type="text" class="q-opt2" placeholder="Option C" required></div>
            <div class="form-group"><label>Option D</label><input type="text" class="q-opt3" placeholder="Option D" required></div>
        </div>
        <div class="form-group">
            <label>Correct Answer</label>
            <select class="q-ans" required>
                <option value="0">A</option>
                <option value="1">B</option>
                <option value="2">C</option>
                <option value="3">D</option>
            </select>
        </div>`;
    container.appendChild(qBox);
}

// =============================================
//  CSV UPLOAD
// =============================================
function handleCsvFile(file) {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { showCsvStatus('error', 'Invalid file type. Please upload a .csv file.'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
        const result = parseCsvToQuestions(e.target.result);
        if (result.errors.length > 0 && result.questions.length === 0) {
            showCsvStatus('error', result.errors.join('<br>')); return;
        }
        document.getElementById('questions-container').innerHTML = '';
        questionCount = 0;
        result.questions.forEach((q) => {
            addQuestionUI();
            const boxes = document.querySelectorAll('.q-box');
            const box = boxes[boxes.length - 1];
            box.querySelector('.q-text').value = q.text;
            box.querySelector('.q-opt0').value = q.options[0];
            box.querySelector('.q-opt1').value = q.options[1];
            box.querySelector('.q-opt2').value = q.options[2];
            box.querySelector('.q-opt3').value = q.options[3];
            box.querySelector('.q-ans').value = q.correct;
        });
        let msg = `✅ Loaded <strong>${result.questions.length}</strong> question(s) from CSV.`;
        if (result.errors.length > 0)
            msg += `<br><span style="color:#b45309">⚠ Skipped ${result.errors.length} row(s): ${result.errors.join(', ')}</span>`;
        showCsvStatus('success', msg);
        document.getElementById('csv-file-input').value = '';
    };
    reader.readAsText(file);
}

function parseCsvToQuestions(text) {
    const questions = [], errors = [], answerMap = { A: 0, B: 1, C: 2, D: 3 };
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    clean.split('\n').forEach((row, idx) => {
        if (!row.trim()) return;
        const cols = []; let inQ = false, cur = '';
        for (let i = 0; i < row.length; i++) {
            const ch = row[i];
            if (ch === '"') { inQ = !inQ; }
            else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        cols.push(cur.trim());

        if (cols.length < 6) {
            const first = (cols[0] || '').toLowerCase().replace(/\./g, '').trim();
            if (['question', 'question text', 'sl no', 'slno', 'sl', 'no', 's no', 'sno', '#', 'sr'].includes(first)) return;
            errors.push(`Row ${idx + 1}: only ${cols.length} col(s). Skipped.`); return;
        }

        let qText, optA, optB, optC, optD, correctRaw;
        const lastCol = (cols[cols.length - 1] || '').trim().toUpperCase();
        const sixthCol = cols.length > 6 ? (cols[6] || '').trim().toUpperCase() : null;

        if (cols.length >= 7 && sixthCol && sixthCol in answerMap) {
            [, qText, optA, optB, optC, optD, correctRaw] = cols;
        } else if (lastCol in answerMap) {
            [qText, optA, optB, optC, optD, correctRaw] = cols;
        } else {
            const firstIsNum = !isNaN(cols[0].replace(/[^0-9]/g, '')) && cols[0].trim() !== '';
            if (cols.length >= 7 && firstIsNum) { [, qText, optA, optB, optC, optD, correctRaw] = cols; }
            else { [qText, optA, optB, optC, optD, correctRaw] = cols; }
        }

        const correctLetter = (correctRaw || '').trim().toUpperCase().replace(/[^A-D]/g, '');
        const lq = (qText || '').toLowerCase().trim();
        if (idx < 3 && (lq === 'question' || lq === 'question text' || lq === 'questions')) return;
        if (!(correctLetter in answerMap)) { errors.push(`Row ${idx + 1}: answer "${correctRaw}" is not A/B/C/D. Skipped.`); return; }
        if (!qText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) { errors.push(`Row ${idx + 1}: empty field. Skipped.`); return; }

        questions.push({ text: qText.trim(), options: [optA.trim(), optB.trim(), optC.trim(), optD.trim()], correct: answerMap[correctLetter] });
    });
    return { questions, errors };
}

function showCsvStatus(type, html) {
    const el = document.getElementById('csv-status');
    el.className = 'csv-status csv-status-' + type;
    el.innerHTML = html;
    el.classList.remove('hidden');
}

function downloadSampleCsv() {
    const sample = [
        'Question Text,Option A,Option B,Option C,Option D,Correct (A/B/C/D)',
        'What is the capital of India?,Mumbai,New Delhi,Chennai,Kolkata,B',
        'Which planet is known as the Red Planet?,Earth,Venus,Mars,Jupiter,C',
        '"What is 5 + 3?",6,7,8,9,C',
        'Who invented the telephone?,Edison,Graham Bell,Tesla,Marconi,B'
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'NIPE_sample_questions.csv'; a.click();
    URL.revokeObjectURL(url);
}

function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function saveNewQuiz() {
    const title = document.getElementById('quiz-title').value.trim();
    const startStr = document.getElementById('quiz-start').value;
    const duration = parseInt(document.getElementById('quiz-duration').value);

    if (!title) { showToast('⚠ Please enter a quiz title.'); return; }
    if (!startStr) { showToast('⚠ Please select a start date & time.'); return; }
    if (!duration || duration < 1) { showToast('⚠ Please enter a valid duration.'); return; }

    const questions = [];
    document.querySelectorAll('.q-box').forEach(box => {
        const text = box.querySelector('.q-text').value.trim();
        const opt0 = box.querySelector('.q-opt0').value.trim();
        const opt1 = box.querySelector('.q-opt1').value.trim();
        const opt2 = box.querySelector('.q-opt2').value.trim();
        const opt3 = box.querySelector('.q-opt3').value.trim();
        if (text && opt0 && opt1 && opt2 && opt3)
            questions.push({ text, options: [opt0, opt1, opt2, opt3], correct: parseInt(box.querySelector('.q-ans').value) });
    });
    if (questions.length === 0) { showToast('⚠ Add at least one complete question.'); return; }

    const newQuiz = { id: generateCode(), title, startTime: new Date(startStr).getTime(), duration, questions };

    const saveBtn = document.querySelector('#create-quiz-form [type=submit]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = 'Saving...'; }

    try {
        await saveQuizzes([...DB.quizzes, newQuiz]);
        document.getElementById('generated-quiz-code').innerText = newQuiz.id;
        document.getElementById('code-modal').classList.add('active');
        document.getElementById('create-quiz-form').reset();
        document.getElementById('questions-container').innerHTML = '';
        questionCount = 0;
        const statusEl = document.getElementById('csv-status');
        if (statusEl) statusEl.classList.add('hidden');
        addQuestionUI();
    } catch (e) {
        showToast('❌ Failed to save quiz. Check Firebase connection.');
        console.error(e);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = 'Save Quiz & Generate Code'; }
    }
}

function renderQuizList() {
    const list = document.getElementById('quiz-list');
    const quizzes = DB.quizzes;
    if (quizzes.length === 0) {
        list.innerHTML = '<p class="text-muted" style="grid-column:1/-1;">No quizzes yet. Go to "Create Quiz" to get started.</p>';
        return;
    }
    list.innerHTML = quizzes.slice().reverse().map(q => `
        <div class="quiz-item">
            <h3>${escHtml(q.title)}</h3>
            <div class="quiz-meta">
                <p><strong>Room Code:</strong> <span style="font-family:monospace;font-size:1.2em;color:var(--primary);">${q.id}</span></p>
                <p><strong>Starts On:</strong> <span id="start-display-${q.id}">${new Date(q.startTime).toLocaleString()}</span></p>
                <p><strong>Duration:</strong> <span id="dur-display-${q.id}">${q.duration} mins</span></p>
                <p><strong>Questions:</strong> ${q.questions.length}</p>
            </div>
            <div class="quiz-item-actions">
                <button onclick="openEditTimeModal('${q.id}')" class="btn secondary-btn small-btn">✎ Edit Time</button>
                <button onclick="deleteQuiz('${q.id}')" class="btn danger-btn small-btn">🗑 Delete</button>
            </div>
        </div>`).join('');
}

async function deleteQuiz(id) {
    if (!confirm('Delete this quiz? This cannot be undone.')) return;
    try {
        await saveQuizzes(DB.quizzes.filter(q => q.id !== id));
        renderQuizList();
        showToast('🗑 Quiz deleted.');
    } catch (e) {
        showToast('❌ Failed to delete quiz.');
        console.error(e);
    }
}

function closeModal() {
    document.getElementById('code-modal').classList.remove('active');
    renderQuizList();
}

// =============================================
//  EDIT QUIZ TIME
// =============================================
function openEditTimeModal(quizId) {
    const quiz = DB.quizzes.find(q => q.id === quizId);
    if (!quiz) return;
    const dt = new Date(quiz.startTime);
    const iso = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    document.getElementById('edit-time-modal').classList.add('active');
    document.getElementById('edit-quiz-id').value = quizId;
    document.getElementById('edit-quiz-start').value = iso;
    document.getElementById('edit-quiz-duration').value = quiz.duration;
}

async function saveQuizTime() {
    const quizId = document.getElementById('edit-quiz-id').value;
    const newStart = document.getElementById('edit-quiz-start').value;
    const newDur = parseInt(document.getElementById('edit-quiz-duration').value);
    if (!newStart || isNaN(newDur) || newDur < 1) { showToast('⚠ Please enter a valid date and duration.'); return; }

    const quizzes = [...DB.quizzes];
    const idx = quizzes.findIndex(q => q.id === quizId);
    if (idx === -1) return;
    quizzes[idx].startTime = new Date(newStart).getTime();
    quizzes[idx].duration = newDur;

    try {
        await saveQuizzes(quizzes);
        const startEl = document.getElementById(`start-display-${quizId}`);
        const durEl = document.getElementById(`dur-display-${quizId}`);
        if (startEl) startEl.innerText = new Date(quizzes[idx].startTime).toLocaleString();
        if (durEl) durEl.innerText = newDur + ' mins';
        closeEditTimeModal();
        showToast('✅ Quiz schedule updated!');
    } catch (e) {
        showToast('❌ Failed to update quiz schedule.');
        console.error(e);
    }
}

function closeEditTimeModal() {
    document.getElementById('edit-time-modal').classList.remove('active');
}

// =============================================
//  RESULTS (Admin view)
// =============================================
function renderResults() {
    const container = document.getElementById('results-container');
    const results = DB.results;
    const quizzes = DB.quizzes;
    const selections = DB.selections;

    if (results.length === 0) {
        container.innerHTML = '<p class="text-muted">No submissions yet. Results will appear here after students submit.</p>';
        return;
    }

    const byQuiz = {};
    results.forEach(r => {
        if (!byQuiz[r.quizId]) byQuiz[r.quizId] = [];
        byQuiz[r.quizId].push(r);
    });

    let html = '';
    Object.entries(byQuiz).forEach(([quizId, subs]) => {
        const quiz = quizzes.find(q => q.id === quizId);
        const quizTitle = quiz ? quiz.title : `Quiz [${quizId}]`;
        subs.sort((a, b) => b.score - a.score);

        const rows = subs.map((sub, rank) => {
            const selKey = `${sub.student1.usn}__${sub.student2.usn}`;
            const isSelected = !!selections[selKey];
            const rankEmoji = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `${rank + 1}.`;
            return `
                <tr class="${isSelected ? 'row-selected' : ''}">
                    <td style="text-align:center;font-size:1.1rem;">${rankEmoji}</td>
                    <td>${escHtml(sub.student1.usn)}<br><small>${escHtml(sub.student1.name)}</small></td>
                    <td>${escHtml(sub.student2.usn)}<br><small>${escHtml(sub.student2.name)}</small></td>
                    <td class="score-cell"><strong>${sub.score} / ${sub.total}</strong><br>
                        <small>${Math.round((sub.score / sub.total) * 100)}%</small></td>
                    <td>${new Date(sub.submittedAt).toLocaleString()}</td>
                    <td>
                        <button onclick="toggleSelection('${selKey}',this)"
                            class="btn ${isSelected ? 'success-btn' : 'secondary-btn'} small-btn select-btn">
                            ${isSelected ? '✅ Selected' : 'Select'}
                        </button>
                    </td>
                </tr>`;
        }).join('');

        const selectedCount = subs.filter(s => selections[`${s.student1.usn}__${s.student2.usn}`]).length;

        html += `
            <div class="result-quiz-block">
                <div class="result-quiz-header">
                    <div>
                        <h3>${escHtml(quizTitle)}</h3>
                        <span class="result-code-badge">Code: ${quizId}</span>
                    </div>
                    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap;">
                        <span class="selected-count-badge">${selectedCount} selected</span>
                        <button onclick="congratulateSelected('${quizId}')" class="btn primary-btn small-btn">🎉 Send Congratulations</button>
                        <button onclick="exportResultsCsv('${quizId}')" class="btn secondary-btn small-btn">⬇ Export CSV</button>
                    </div>
                </div>
                <div style="overflow-x:auto;">
                    <table class="results-table">
                        <thead><tr>
                            <th>#</th><th>Student 1</th><th>Student 2</th><th>Score</th><th>Submitted At</th><th>Select</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

async function toggleSelection(selKey, btn) {
    const selections = { ...DB.selections };
    if (selections[selKey]) {
        delete selections[selKey];
        btn.className = 'btn secondary-btn small-btn select-btn';
        btn.innerText = 'Select';
        btn.closest('tr').classList.remove('row-selected');
    } else {
        selections[selKey] = true;
        btn.className = 'btn success-btn small-btn select-btn';
        btn.innerText = '✅ Selected';
        btn.closest('tr').classList.add('row-selected');
    }
    try {
        await saveSelections(selections);
    } catch (e) { console.error('[toggleSelection]', e); }

    const allBtns = btn.closest('table').querySelectorAll('.select-btn');
    let count = 0;
    allBtns.forEach(b => { if (b.innerText.includes('✅')) count++; });
    const badge = btn.closest('.result-quiz-block').querySelector('.selected-count-badge');
    if (badge) badge.innerText = `${count} selected`;
}

async function congratulateSelected(quizId) {
    const selections = DB.selections;
    const selectedKeys = Object.keys(selections).filter(k => selections[k]);
    if (selectedKeys.length === 0) { alert('No teams selected. Click "Select" on the rows first.'); return; }
    if (!confirm(`Send congratulations to ${selectedKeys.length} team(s)?`)) return;

    const congrats = { ...DB.congrats };
    selectedKeys.forEach(key => { congrats[key] = { quizId, sentAt: Date.now() }; });
    try {
        await saveCongrats(congrats);
        showToast(`🎉 Congratulations sent to ${selectedKeys.length} team(s)!`);
    } catch (e) {
        showToast('❌ Failed to send congratulations.');
        console.error(e);
    }
}

function exportResultsCsv(quizId) {
    const results = DB.results.filter(r => r.quizId === quizId);
    if (results.length === 0) { showToast('No results to export.'); return; }
    const quiz = DB.quizzes.find(q => q.id === quizId);
    const title = quiz ? quiz.title : quizId;
    let csv = 'Rank,Student1 USN,Student1 Name,Student2 USN,Student2 Name,Score,Total,Percentage,Submitted At\n';
    results.slice().sort((a, b) => b.score - a.score).forEach((r, i) => {
        csv += `${i + 1},"${r.student1.usn}","${r.student1.name}","${r.student2.usn}","${r.student2.name}",${r.score},${r.total},${Math.round((r.score / r.total) * 100)}%,"${new Date(r.submittedAt).toLocaleString()}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `NIPE_results_${title.replace(/\s+/g, '_')}.csv`; a.click();
    URL.revokeObjectURL(url);
}

// =============================================
//  USER DASHBOARD (Waiting Room)
// =============================================
let countdownInterval;

function initUser() {
    const session = Session.get();
    const s1 = session.student1, s2 = session.student2;
    document.getElementById('user-welcome').innerText = `${s1.name} (${s1.usn}) & ${s2.name} (${s2.usn})`;
    checkForCongrats(session);

    const activeState = QuizState.get();
    if (activeState && !activeState.submitted && activeState.endTimeMs > Date.now()) {
        document.getElementById('join-code').value = activeState.quizId;
        findQuiz();
    }
}

function checkForCongrats(session) {
    const congrats = DB.congrats;
    const s1 = session.student1, s2 = session.student2;
    const found = congrats[`${s1.usn}__${s2.usn}`] || congrats[`${s2.usn}__${s1.usn}`];
    if (found) {
        const banner = document.getElementById('congrats-banner');
        if (banner) {
            document.getElementById('congrats-names').innerText = `${s1.name} (${s1.usn}) & ${s2.name} (${s2.usn})`;
            banner.classList.remove('hidden');
            launchConfetti();
        }
    }
}

function launchConfetti() {
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    for (let i = 0; i < 60; i++) {
        const p = document.createElement('span');
        p.className = 'confetti-piece';
        p.style.cssText = `left:${Math.random() * 100}vw;background:${colors[Math.floor(Math.random() * colors.length)]};width:${6 + Math.random() * 8}px;height:${6 + Math.random() * 8}px;animation-delay:${Math.random() * 2}s;animation-duration:${2 + Math.random() * 2}s;`;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 5000);
    }
}

function findQuiz() {
    const code = document.getElementById('join-code').value.trim();
    const error = document.getElementById('join-error');
    const infoCard = document.getElementById('quiz-info-card');
    error.innerText = '';
    infoCard.classList.add('hidden');
    clearInterval(countdownInterval);

    if (!code || code.length !== 6 || isNaN(code)) {
        error.innerText = 'Please enter a valid 6-digit room code.'; return;
    }
    const existing = QuizState.get();
    if (existing && existing.quizId === code && existing.submitted) {
        error.innerText = 'You have already submitted this quiz.'; return;
    }
    const quiz = DB.quizzes.find(q => q.id === code);
    if (!quiz) {
        error.innerText = 'Quiz not found. Please check the code and try again.'; return;
    }

    document.getElementById('qi-title').innerText = quiz.title;
    document.getElementById('qi-duration').innerText = quiz.duration;
    document.getElementById('qi-start').innerText = new Date(quiz.startTime).toLocaleString();
    infoCard.classList.remove('hidden');
    checkQuizTime(quiz);
}

function checkQuizTime(quiz) {
    const cdContainer = document.getElementById('countdown-container');
    const startBtn = document.getElementById('start-quiz-btn');
    const cdTimer = document.getElementById('countdown-timer');

    const update = () => {
        const diff = quiz.startTime - Date.now();
        if (diff <= 0) {
            clearInterval(countdownInterval);
            cdContainer.classList.add('hidden');
            startBtn.classList.remove('hidden');
        } else {
            startBtn.classList.add('hidden');
            cdContainer.classList.remove('hidden');
            cdTimer.innerText = `${pad2(Math.floor(diff / 3600000))}:${pad2(Math.floor((diff % 3600000) / 60000))}:${pad2(Math.floor((diff % 60000) / 1000))}`;
        }
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

function startQuiz() {
    const code = document.getElementById('join-code').value.trim();
    const quiz = DB.quizzes.find(q => q.id === code);
    if (!quiz) return;

    let state = QuizState.get();
    if (!state || state.quizId !== code) {
        const now = Date.now();
        state = { quizId: code, startTimeMs: now, endTimeMs: now + quiz.duration * 60 * 1000, answers: {}, submitted: false };
        QuizState.set(state);
    } else if (state.submitted) {
        alert('You have already submitted this quiz.'); return;
    }
    window.location.href = 'quiz.html';
}

// =============================================
//  QUIZ ENGINE
// =============================================
let activeQuiz = null;
let currentQIndex = 0;
let quizInterval;

function initQuiz() {
    const state = QuizState.get();
    if (!state || state.submitted) { window.location.href = 'user.html'; return; }

    activeQuiz = DB.quizzes.find(q => q.id === state.quizId);
    if (!activeQuiz) { window.location.href = 'user.html'; return; }

    if (state.endTimeMs <= Date.now()) { submitQuiz(true); return; }

    document.getElementById('quiz-running-title').innerText = activeQuiz.title;
    startQuizTimer(state.endTimeMs);
    renderDots();
    renderQuestion();
}

function startQuizTimer(endTimeMs) {
    const timerEl = document.getElementById('quiz-time-left');
    const tick = () => {
        const diff = Math.floor((endTimeMs - Date.now()) / 1000);
        if (diff <= 0) { clearInterval(quizInterval); timerEl.innerText = '00:00'; submitQuiz(true); return; }
        const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
        timerEl.innerText = (h > 0 ? pad2(h) + ':' : '') + `${pad2(m)}:${pad2(s)}`;
        timerEl.classList.toggle('timer-warning', diff <= 60);
    };
    tick();
    quizInterval = setInterval(tick, 1000);
}

function renderDots() {
    const dotsEl = document.getElementById('q-nav-dots');
    if (!dotsEl) return;
    const state = QuizState.get();
    dotsEl.innerHTML = activeQuiz.questions.map((_, i) => {
        const answered = state.answers[i] !== undefined;
        const isCurrent = i === currentQIndex;
        return `<span class="q-dot ${isCurrent ? 'active' : ''} ${answered ? 'answered' : ''}" onclick="jumpToQuestion(${i})" title="Q${i + 1}"></span>`;
    }).join('');
}

function jumpToQuestion(idx) { currentQIndex = idx; renderQuestion(); }

function updateProgressBar() {
    const bar = document.getElementById('quiz-progress-bar');
    if (bar) bar.style.width = (((currentQIndex + 1) / activeQuiz.questions.length) * 100) + '%';
}

function renderQuestion() {
    const state = QuizState.get();
    const saved = state.answers[currentQIndex];
    const savedN = (saved !== undefined && saved !== null) ? Number(saved) : undefined;
    const q = activeQuiz.questions[currentQIndex];
    const total = activeQuiz.questions.length;

    document.getElementById('question-progress').innerText = `${currentQIndex + 1} / ${total}`;
    document.getElementById('question-number').innerText = `Q${currentQIndex + 1}`;

    const qtEl = document.getElementById('question-text');
    qtEl.classList.remove('q-slide-in');
    void qtEl.offsetWidth;
    qtEl.innerText = q.text;
    qtEl.classList.add('q-slide-in');

    const optContainer = document.getElementById('options-container');
    optContainer.innerHTML = '';
    q.options.forEach((opt, i) => {
        if (!opt && opt !== 0) return;
        const btn = document.createElement('button');
        btn.className = 'option-btn' + (savedN === i ? ' selected' : '');
        btn.type = 'button';
        btn.innerHTML = `<span class="opt-label">${String.fromCharCode(65 + i)}</span><span class="opt-text">${escHtml(opt)}</span>`;
        btn.addEventListener('click', () => selectOption(i));
        btn.addEventListener('click', function (e) {
            const ripple = document.createElement('span');
            ripple.className = 'ripple';
            const rect = this.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px';
            ripple.style.top = (e.clientY - rect.top) + 'px';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
        optContainer.appendChild(btn);
    });

    document.getElementById('prev-btn').disabled = currentQIndex === 0;
    const isLast = currentQIndex === total - 1;
    document.getElementById('next-btn').classList.toggle('hidden', isLast);
    document.getElementById('submit-btn').classList.toggle('hidden', !isLast);
    updateProgressBar();
    renderDots();
}

function selectOption(optIndex) {
    const state = QuizState.get();
    state.answers[currentQIndex] = optIndex;
    QuizState.set(state);
    renderQuestion();
}

function navQuestion(dir) { currentQIndex += dir; renderQuestion(); }

async function submitQuiz(autoSubmit = false) {
    if (!autoSubmit && !confirm('Submit the quiz? You cannot make changes after submission.')) return;
    clearInterval(quizInterval);

    const state = QuizState.get();
    state.submitted = true;
    QuizState.set(state);

    let score = 0;
    activeQuiz.questions.forEach((q, i) => { if (Number(state.answers[i]) === q.correct) score++; });

    const session = Session.get();
    const newResult = {
        quizId: activeQuiz.id, quizTitle: activeQuiz.title,
        student1: session.student1, student2: session.student2,
        score, total: activeQuiz.questions.length, submittedAt: Date.now()
    };

    try {
        await pushResult(newResult);
    } catch (e) {
        console.error('[submitQuiz] Failed to push result to Firebase:', e);
        // Still show submitted screen — result is in localStorage memory
    }

    document.getElementById('quiz-area').classList.add('hidden');
    const timerBox = document.querySelector('.timer-display');
    if (timerBox) timerBox.classList.add('hidden');

    document.getElementById('submitted-info-box').innerHTML = `
        <div class="submit-badge">
            <p>👤 <strong>${escHtml(session.student1.name)}</strong> — ${escHtml(session.student1.usn)}</p>
            <p>👤 <strong>${escHtml(session.student2.name)}</strong> — ${escHtml(session.student2.usn)}</p>
        </div>`;
    document.getElementById('submitted-area').classList.remove('hidden');
}

function goToDashboard() { QuizState.clear(); window.location.href = 'user.html'; }

// =============================================
//  UTILITIES
// =============================================
function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function pad2(n) { return String(n).padStart(2, '0'); }
function showToast(msg, duration = 4000) {
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-show'), 10);
    setTimeout(() => { toast.classList.remove('toast-show'); setTimeout(() => toast.remove(), 400); }, duration);
}
