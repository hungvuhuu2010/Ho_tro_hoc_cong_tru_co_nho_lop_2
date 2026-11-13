// --- SOUND SYNTHESIZER (Web Audio API) ---
let audioCtx = null;
let soundEnabled = true;

function getAudioContext() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playSound(type) {
    if (!soundEnabled) return;
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'correct') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'wrong') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.linearRampToValueAtTime(150, now + 0.2);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'complete') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.connect(g);
                g.connect(ctx.destination);
                o.type = 'sine';
                o.frequency.setValueAtTime(freq, now + idx * 0.1);
                g.gain.setValueAtTime(0.15, now + idx * 0.1);
                g.gain.linearRampToValueAtTime(0.01, now + idx * 0.1 + 0.2);
                o.start(now + idx * 0.1);
                o.stop(now + idx * 0.1 + 0.2);
            });
        }
    } catch (e) {
        console.error("Audio error:", e);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const btn = document.getElementById('sound-toggle-btn');
    btn.textContent = soundEnabled ? '🔊' : '🔇';
    playSound('click');
}

// --- GAME STATE VARIABLES ---
let currentMode = ''; // 'addition' or 'subtraction'
let problemsList = [];
let currentIndex = 0;
let score = 0;
let correctCount = 0;
let currentInput = '';
let currentProblem = null;
let questionAnswered = false;

// --- PROBLEM GENERATION LOGIC (STRICT RULES) ---

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Generate Addition Problems (Crossing 10: a+b > 10, a+b <= 20, 1 <= a,b <= 10)
function generateAdditionProblemsList() {
    let list = [];
    for (let a = 1; a <= 10; a++) {
        for (let b = 1; b <= 10; b++) {
            if (a + b > 10 && a + b <= 20) {
                list.push({
                    type: 'addition',
                    num1: a,
                    num2: b,
                    operator: '+',
                    answer: a + b
                });
            }
        }
    }
    shuffleArray(list);
    return list.slice(0, 10);
}

// Generate Subtraction Problems (Borrowing within 20)
function generateSubtractionProblemsList() {
    let list = [];
    let seen = new Set();
    
    for (let minuend = 11; minuend <= 19; minuend++) {
        for (let subtrahend = 1; subtrahend < minuend; subtrahend++) {
            let ones = minuend % 10;
            if (ones < subtrahend) {
                let key = `${minuend}-${subtrahend}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        type: 'subtraction',
                        num1: minuend,
                        num2: subtrahend,
                        operator: '-',
                        answer: minuend - subtrahend
                    });
                }
            }
        }
    }
    shuffleArray(list);
    return list.slice(0, 10);
}

function generateVerticalAdditionProblemsList(count = 10) {
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push(generateRegroupingProblem('add'));
    }
    return list;
}

function generateVerticalSubtractionProblemsList(count = 10) {
    const list = [];
    for (let i = 0; i < count; i++) {
        list.push(generateRegroupingProblem('sub'));
    }
    return list;
}

function startPractice(mode) {
    playSound('click');
    getAudioContext(); 
    currentMode = mode;
    score = 0;
    correctCount = 0;
    currentIndex = 0;

    const badge = document.getElementById('game-mode-badge');

    if (mode === 'addition') {
        problemsList = generateAdditionProblemsList();
        badge.className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 text-amber-700";
        badge.innerHTML = "🌟 TẬP CỘNG";
    } else if (mode === 'subtraction') {
        problemsList = generateSubtractionProblemsList();
        badge.className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-100 text-sky-700";
        badge.innerHTML = "➖ TẬP TRỪ";
    } else if (mode === 'vertical_addition') {
        problemsList = generateVerticalAdditionProblemsList();
        badge.className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-100 text-emerald-700";
        badge.innerHTML = "➕ CỘNG ĐẶT TÍNH";
    } else if (mode === 'vertical_subtraction') {
        problemsList = generateVerticalSubtractionProblemsList();
        badge.className = "font-bold text-sm sm:text-base flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-100 text-purple-700";
        badge.innerHTML = "➖ TRỪ ĐẶT TÍNH";
    }

    document.getElementById('view-home').classList.add('hidden');
    document.getElementById('view-summary').classList.add('hidden');
    document.getElementById('view-game').classList.remove('hidden');
    document.getElementById('view-game').classList.add('flex');
    document.getElementById('home-btn').classList.remove('hidden');

    loadQuestion();
}


function loadQuestion() {
    if (currentIndex >= problemsList.length) {
        showSummary();
        return;
    }

    currentProblem = problemsList[currentIndex];
    currentInput = '';
    questionAnswered = false;

    const scoreDisplay = document.getElementById('score-display');
    const questionNumber = document.getElementById('current-q-num');
    const displayArea = document.getElementById('equation-display-area');
    const feedback = document.getElementById('feedback-text');
    const actionButtons = document.getElementById('action-buttons-container');
    const nextButton = document.getElementById('btn-next');
    const keypad = document.getElementById('keypad-container');

    if (!displayArea || !feedback) {
        console.error('Thiếu equation-display-area hoặc feedback-text trong HTML.');
        return;
    }

    if (scoreDisplay) scoreDisplay.textContent = score;
    if (questionNumber) questionNumber.textContent = currentIndex + 1;

    const isVertical = currentMode === 'vertical_addition' ||
                       currentMode === 'vertical_subtraction';

    if (isVertical) {
        displayArea.innerHTML = `
				<div class="flex flex-col items-center justify-center py-2 w-full">
					<div class="flex flex-col items-end font-mono text-4xl sm:text-5xl font-extrabold text-purple-900 border-b-4 border-purple-800 pb-2 px-6 relative tracking-widest min-w-[130px]">
						<span class="absolute left-1 top-1/2 -translate-y-1/2 text-3xl sm:text-4xl text-purple-600 font-bold">${currentProblem.operator}</span>
						<span class="leading-tight">${currentProblem.num1}</span>
						<span class="leading-tight">${currentProblem.num2}</span>
					</div>

					<!-- Hai o dap an nam ngang, can giua duoi cot so -->
					<div class="mt-4 flex flex-row items-center justify-center gap-2 w-full">
						<span id="answer-tens"
							class="w-12 h-14 shrink-0 flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-4xl font-extrabold text-purple-900 border-b-4 border-purple-800">
						</span>
						<span id="answer-ones"
							class="w-12 h-14 shrink-0 flex items-center justify-center rounded-xl border-2 border-purple-500 bg-purple-50 text-4xl font-extrabold text-purple-900 border-b-4 border-purple-800 ring-2 ring-purple-200">
						</span>
					</div>
				</div>
				`;
        updateVerticalAnswerDisplay();
    } else {
        displayArea.innerHTML = `
            <div class="text-4xl sm:text-5xl font-extrabold tracking-wider text-purple-900 my-4 flex items-center justify-center gap-3">
                <span id="problem-text">${currentProblem.num1} ${currentProblem.operator} ${currentProblem.num2}</span>
                <span class="text-purple-400">=</span>
                <span id="user-answer-display" class="min-w-[80px] px-4 py-1 bg-purple-50 border-3 border-dashed border-purple-300 rounded-2xl text-purple-700 text-center inline-block">?</span>
            </div>
        `;
    }

    feedback.textContent = 'Hãy nhập đáp án bên dưới nhé!';
    feedback.className = 'text-base sm:text-lg font-semibold text-slate-500';

    if (actionButtons) actionButtons.classList.add('hidden');
    if (nextButton) nextButton.classList.add('hidden');
    if (keypad) keypad.classList.remove('hidden');
}

function updateVerticalAnswerDisplay() {
    const onesBox = document.getElementById('answer-ones');
    const tensBox = document.getElementById('answer-tens');

    if (!onesBox || !tensBox) return;

    onesBox.textContent = currentInput.length >= 1 ? currentInput[0] : '';
    tensBox.textContent = currentInput.length >= 2 ? currentInput[1] : '';

    const activeClass = ['border-purple-500', 'bg-purple-50', 'ring-2', 'ring-purple-200'];
    const inactiveClass = ['border-slate-300', 'bg-slate-50'];

    onesBox.classList.remove(...activeClass, ...inactiveClass);
    tensBox.classList.remove(...activeClass, ...inactiveClass);

    if (currentInput.length === 0) {
        onesBox.classList.add(...activeClass);
        tensBox.classList.add(...inactiveClass);
    } else if (currentInput.length === 1) {
        onesBox.classList.add(...inactiveClass);
        tensBox.classList.add(...activeClass);
    } else {
        onesBox.classList.add(...inactiveClass);
        tensBox.classList.add(...inactiveClass);
    }
}


// --- KEYPAD INPUT HANDLING ---
function appendNumber(num) {
    playSound('click');
    if (questionAnswered) return;

    const isVertical = currentMode === 'vertical_addition' ||
                       currentMode === 'vertical_subtraction';

    if (currentInput.length >= 2) return;

    currentInput += String(num);

    if (isVertical) {
        updateVerticalAnswerDisplay();
    } else {
        const answerDisplay = document.getElementById('user-answer-display');
        if (answerDisplay) {
            answerDisplay.textContent = currentInput;
            answerDisplay.classList.remove('border-dashed');
            answerDisplay.classList.add('border-solid', 'border-purple-500');
        }
    }
}

function deleteNumber() {
    playSound('click');
    if (questionAnswered) return;

    currentInput = currentInput.slice(0, -1);

    const isVertical = currentMode === 'vertical_addition' ||
                       currentMode === 'vertical_subtraction';

    if (isVertical) {
        updateVerticalAnswerDisplay();
    } else {
        const answerDisplay = document.getElementById('user-answer-display');
        if (answerDisplay) {
            answerDisplay.textContent = currentInput || '?';
            if (currentInput === '') {
                answerDisplay.classList.add('border-dashed');
                answerDisplay.classList.remove('border-solid', 'border-purple-500');
            }
        }
    }
}

// --- ANSWER SUBMISSION & VERIFICATION ---
function submitAnswer() {
    if (questionAnswered || currentInput === '') return;

    const feedback = document.getElementById('feedback-text');
    const keypad = document.getElementById('keypad-container');
    const actions = document.getElementById('action-buttons-container');
    const btnRetry = document.getElementById('btn-retry');
    const btnHint = document.getElementById('btn-hint');
    const btnNext = document.getElementById('btn-next');

    if (!currentProblem || !feedback || !keypad || !actions) {
        console.error('Thiếu thành phần cần thiết:', {
            currentProblem,
            feedback: !!feedback,
            keypad: !!keypad,
            actions: !!actions
        });
        return;
    }

    const isVertical = currentMode === 'vertical_addition' ||
                       currentMode === 'vertical_subtraction';

    // Với phép tính đặt tính, bắt buộc nhập đủ hai ô.
    if (isVertical && currentInput.length < 2) {
        feedback.textContent = 'Bé nhập tiếp chữ số hàng chục nhé!';
        feedback.className = 'text-base sm:text-lg font-semibold text-amber-600';
        return;
    }

    // Đảo thứ tự nhập để tạo số: nhập đơn vị trước, chục sau.
    const userAns = isVertical
        ? Number(currentInput[1] + currentInput[0])
        : Number(currentInput);

    const correctAns = Number(currentProblem.answer ?? currentProblem.correctAnswer);

    if (!Number.isFinite(correctAns)) {
        console.error('Câu hỏi chưa có đáp án hợp lệ:', currentProblem);
        feedback.textContent = 'Có lỗi khi tạo câu hỏi. Bé hãy chọn bài luyện tập lại nhé!';
        feedback.className = 'text-base sm:text-lg font-bold text-rose-600';
        return;
    }

    questionAnswered = true;
    keypad.classList.add('hidden');
    actions.classList.remove('hidden');

    if (userAns === correctAns) {
        playSound('correct');
        score += 1;
        correctCount += 1;

        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) scoreDisplay.textContent = score;

        feedback.textContent = '🎉 Chính xác! Tuyệt vời quá!';
        feedback.className = 'text-base sm:text-lg font-bold text-emerald-600 animate-bounce-gentle';

        if (btnRetry) btnRetry.classList.add('hidden');
        if (btnHint) btnHint.classList.add('hidden');
        if (btnNext) btnNext.classList.remove('hidden');
    } else {
        playSound('wrong');
        feedback.textContent = '😊 Chưa đúng rồi! Bé thử lại hoặc xem gợi ý nhé.';
        feedback.className = 'text-base sm:text-lg font-bold text-amber-600';

        if (btnRetry) btnRetry.classList.remove('hidden');
        if (btnHint) btnHint.classList.remove('hidden');
        if (btnNext) btnNext.classList.add('hidden');
    }
}



function retryQuestion() {
    playSound('click');
    currentInput = '';
    questionAnswered = false;

    const isVertical = currentMode === 'vertical_addition' ||
                       currentMode === 'vertical_subtraction';

    if (isVertical) {
        updateVerticalAnswerDisplay();
    } else {
        const answerDisplay = document.getElementById('user-answer-display');
        if (answerDisplay) {
            answerDisplay.textContent = '?';
            answerDisplay.classList.add('border-dashed');
            answerDisplay.classList.remove('border-solid', 'border-purple-500');
        }
    }

    const feedback = document.getElementById('feedback-text');
    const actions = document.getElementById('action-buttons-container');
    const keypad = document.getElementById('keypad-container');

    if (feedback) {
        feedback.textContent = 'Hãy nhập đáp án bên dưới nhé!';
        feedback.className = 'text-base sm:text-lg font-semibold text-slate-500';
    }
    if (actions) actions.classList.add('hidden');
    if (keypad) keypad.classList.remove('hidden');
}

function nextQuestion() {
    playSound('click');
    currentIndex++;
    loadQuestion();
}

// --- CUSTOM VISUAL HINTS ---
function showHintModal() {
    playSound('click');
    const hintContent = document.getElementById('hint-content');
    const a = currentProblem.num1;
    const b = currentProblem.num2;

    if (currentProblem.type === 'addition') {
        let needed = 10 - a;
        let remainder = b - needed;
        hintContent.innerHTML = `
            <p><b>Phép cộng qua 10:</b> <code>${a} + ${b}</code></p>
            <ul class="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Số ${a} cần thêm <b>${needed}</b> để tròn 10.</li>
                <li>Tách ${b} thành <b>${needed} + ${remainder}</b>.</li>
                <li>Lấy ${a} + ${needed} = 10.</li>
                <li>Sau đó lấy 10 + ${remainder} = <b>${a + b}</b>.</li>
            </ul>
        `;
    } else {
        let ones = a % 10;
        hintContent.innerHTML = `
            <p><b>Phép trừ có nhớ:</b> <code>${a} - ${b}</code></p>
            <ul class="list-disc pl-5 space-y-1 text-sm sm:text-base">
                <li>Hàng đơn vị số bị trừ là ${ones}, nhỏ hơn số trừ (${b}), nên <b>không trừ được</b>.</li>
                <li>Đổi 1 chục thành 10 đơn vị.</li>
                <li>Ta có: ${a} = 10 + ${ones}, mượn 1 chục thành ${10 + ones} đơn vị.</li>
                <li>Thực hiện: ${10 + ones} - ${b} = <b>${a - b}</b>.</li>
            </ul>
        `;
    }

    document.getElementById('hint-modal').classList.remove('hidden');
}

function closeHintModal() {
    playSound('click');
    document.getElementById('hint-modal').classList.add('hidden');
}

// --- SUMMARY SCREEN ---
function showSummary() {
    playSound('complete');
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-summary').classList.remove('hidden');
    document.getElementById('view-summary').classList.add('flex');

    document.getElementById('final-score').textContent = `${score}/10`;
    document.getElementById('final-correct-count').textContent = `${correctCount}/10`;
}

function restartCurrentMode() {
    startPractice(currentMode);
}


// 1. HÀM TẠO PHÉP TÍNH CÓ NHỚ
function generateRegroupingProblem(type = 'random') {
    const op = type === 'random'
        ? (Math.random() < 0.5 ? 'add' : 'sub')
        : type;

    let a, b, answer;

    if (op === 'add') {
        do {
            a = Math.floor(Math.random() * 80) + 10; // 10..89
            b = Math.floor(Math.random() * 80) + 10; // 10..89
        } while ((a % 10) + (b % 10) < 10 || a + b >= 100);

        answer = a + b;
    } else {
        do {
            a = Math.floor(Math.random() * 89) + 11; // 11..99
            b = Math.floor(Math.random() * (a - 10)) + 10;
        } while ((a % 10) >= (b % 10));

        answer = a - b;
    }

    return {
        type: op === 'add' ? 'addition' : 'subtraction',
        num1: a,
        num2: b,
        operator: op === 'add' ? '+' : '-',
        answer: answer
    };
}

// 2. HTML RENDER VỚI CẤU TRÚC THEO CỘT (ĐẶT TÍNH RỒI TÍNH)
function renderVerticalProblem(problemContainerId, problem) {
    const container = document.getElementById(problemContainerId);
    if (!container) return;

    container.innerHTML = `
        <div class="vertical-math-card">
            <div class="column-math">
                <div class="operator-sign">${problem.operator}</div>
                <div class="numbers-block">
                    <div class="num-row">${problem.num1}</div>
                    <div class="num-row">${problem.num2}</div>
                </div>
            </div>
            <div class="math-line"></div>
            <div class="answer-row">
                <input type="number" id="user-answer-input" class="column-answer-input" placeholder="?" autocomplete="off" autofocus />
            </div>
        </div>
    `;
}

// --- GO HOME & CONFIRMATION ---
function confirmGoHome() {
    playSound('click');
    if (!document.getElementById('view-game').classList.contains('hidden')) {
        document.getElementById('confirm-modal').classList.remove('hidden');
    } else {
        goHome();
    }
}

function closeConfirmModal() {
    playSound('click');
    document.getElementById('confirm-modal').classList.add('hidden');
}

function executeGoHome() {
    playSound('click');
    closeConfirmModal();
    goHome();
}

function goHome() {
    document.getElementById('view-game').classList.add('hidden');
    document.getElementById('view-summary').classList.add('hidden');
    document.getElementById('view-home').classList.remove('hidden');
    document.getElementById('home-btn').classList.add('hidden');
}



