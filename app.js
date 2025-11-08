// ---------------------- Imports (giữ nguyên) ----------------------
import { runJsEval } from './adapters/js-eval.js';
import { runRegexCheck } from './adapters/regex.js';
import { runIOSim } from './adapters/io-sim.js';

// ---------------------- Helpers & State ----------------------
const $ = s => document.querySelector(s);

const state = {
  view: 'home',
  tracks: [],
  currentTrack: null,
  idx: 0,
  score: 0,
  timer: null,
  timeLeft: 0,
  answers: []   // ✅ NEW: lưu đáp án đã chọn theo chỉ số câu
};

const templates = {
  home: () => $('#tpl-home').content.cloneNode(true),
  tracks: () => $('#tpl-tracks').content.cloneNode(true),
  quiz: () => $('#tpl-quiz').content.cloneNode(true),
  progress: () => $('#tpl-progress').content.cloneNode(true),
  about: () => $('#tpl-about').content.cloneNode(true),
};

// ---------------------- Global nav ----------------------
document.addEventListener('click', (e) => {
  const nav = e.target?.dataset?.nav;
  if (nav) render(nav);
});

// ---------------------- Persistence ----------------------
function saveProgress() {
  const key = `pcq_${state.currentTrack?.id || 'global'}`;
  localStorage.setItem(key, JSON.stringify({
    score: state.score, idx: state.idx
  }));
}

// ---------------------- Load tracks ----------------------
function loadTracks() {
  // Danh sách file track JSON (bạn thêm thoải mái)
  const files = [
    './tracks/javascript.json',
    './tracks/python.json',
    './tracks/c_cpp.json',
    './tracks/java.json',
    './tracks/sql.json'
  ];
  return Promise.all(files.map(f => fetch(f).then(r => r.json())))
      .then(arr => state.tracks = arr);
}

// ---------------------- Render views ----------------------
function render(view='home') {
  state.view = view;
  const root = $('#view');
  root.innerHTML = '';
  const frag = templates[view]();
  root.appendChild(frag);

  if (view === 'tracks') paintTracks();
  if (view === 'progress') paintProgress();
  if (view === 'home') {}   // nothing
  if (view === 'about') {}  // nothing
}

// ---------------------- Tracks list (có Thi Hỗn Hợp) ----------------------
function paintTracks() {
  const list = $('#track-list');
  list.innerHTML = '';
  state.tracks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'track-card';
    el.innerHTML = `
      <h4>${t.title}</h4>
      <p>${t.description}</p>

      <button>Thi ngay</button>
    `;
    el.querySelector('button').onclick = () => startTrack(t);
    list.appendChild(el);
  });

  // ✅ Card "Thi Hỗn Hợp"
  const mix = document.createElement('div');
  mix.className = 'track-card special';
  mix.innerHTML = `
    <h4>🌀 Thi Hỗn Hợp</h4>
    <p>15 câu hỏi ngẫu nhiên từ tất cả chủ đề.</p>
    <button>Thi ngay</button>
  `;
  mix.querySelector('button').onclick = startMixedMode;
  list.appendChild(mix);
}

// ---------------------- Mixed mode ----------------------
async function startMixedMode() {
  const files = [
    './tracks/javascript.json',
    './tracks/python.json',
    './tracks/c_cpp.json',
    './tracks/java.json',
    './tracks/sql.json'
  ];

  // Tải toàn bộ các file đề
  const data = await Promise.all(files.map(f => fetch(f).then(r => r.json())));
  let allQs = [];
  data.forEach(track => {
    allQs.push(...track.challenges.filter(c => c.type === 'mcq'));
  });

  // Trộn toàn bộ và lấy ngẫu nhiên 15 câu, xáo trộn đáp án
  shuffle(allQs);
  const mixedQs = allQs.slice(0, 15).map(shuffleOptions);

  // Tạo track "ảo" cho chế độ hỗn hợp
  const mixedTrack = {
    id: 'Hỗn hợp',
    title: 'Thi Hỗn Hợp (15 câu ngẫu nhiên)',
    description: 'Kết hợp 5 chủ đề: Python, JS, C/C++, Java, SQL',
    challenges: mixedQs
  };

  startTrack(mixedTrack);
}

// ---------------------- Shuffle utils ----------------------
function shuffle(arr){
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleOptions(q) {
  if (!Array.isArray(q.options)) return q;
  const idx = q.options.map((_, i) => i);
  shuffle(idx);
  q.options = idx.map(i => q.options[i]);
  q.answer  = idx.indexOf(q.answer); // remap đáp án đúng
  return q;
}

// ---------------------- Start a track ----------------------
function startTrack(track) {
  // clone để không sửa dữ liệu gốc đã load
  state.currentTrack = JSON.parse(JSON.stringify(track));

  // chỉ lấy MCQ, xáo trộn, cắt còn 15 câu, và xáo trộn đáp án
  let qs = state.currentTrack.challenges.filter(c => c.type === 'mcq');
  shuffle(qs);
  qs = qs.slice(0, 15).map(shuffleOptions);
  state.currentTrack.challenges = qs;

  state.idx = 0;
  state.score = 0;
  state.answers = new Array(qs.length).fill(null);  // ✅ NEW: khởi tạo mảng đáp án

  render('quiz');
  loadQuestion();
}

// ---------------------- Load a question (có nút Câu trước & khôi phục chọn) ----------------------
function loadQuestion() {
  const t = state.currentTrack;
  const q = t.challenges[state.idx];

  $('#q-title').textContent = q.title;
  $('#q-lang').textContent = `Ngôn ngữ: ${t.id}`;
  $('#q-type').textContent = `Dạng: ${q.type}`;
  $('#q-idx').textContent = `Câu ${state.idx+1}/${t.challenges.length}`;
  $('#q-score').textContent = `Điểm: ${state.score}`;
  $('#q-code').textContent = q.code || '';

  // Hiển thị IO / Editor theo type
  $('#q-io').classList.toggle('hidden', q.type !== 'io');
  $('#editor-box').classList.toggle('hidden', !(q.type === 'regex' || q.type === 'js-eval'));

  // Render đáp án
  const ans = $('#answers');
  ans.innerHTML = '';
  if (q.options?.length) {
    q.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.textContent = opt;
      b.onclick = () => selectChoice(i, q);
      ans.appendChild(b);
    });
  }

  // ✅ Khôi phục lựa chọn trước đó (nếu có)
  const prevPicked = state.answers[state.idx];
  if (prevPicked !== null && prevPicked !== undefined) {
    const btns = [...document.querySelectorAll('#answers button')];
    btns.forEach((b, idx) => {
      if (idx === prevPicked) b.classList.add('selected'); // đánh dấu đã chọn
    });
  }

  // Timer (tuỳ chọn)
  startTimer(q.timeLimit || 0);

  // Nút hành động
  $('#btn-run').onclick  = () => grade(q);
  $('#btn-next').onclick = nextQuestion;

  // ✅ Nút "Câu trước"
  const prevBtn = $('#btn-prev');
  if (prevBtn) {
    prevBtn.onclick = prevQuestion;
    prevBtn.disabled = state.idx === 0; // ở câu đầu thì disable
  }

  $('#feedback').textContent = '';
}

// ---------------------- Timer ----------------------
function startTimer(sec) {
  const box = $('#q-timer');
  clearInterval(state.timer);
  if (!sec) { box.textContent = ''; return; }
  state.timeLeft = sec;
  box.textContent = `⏱ ${sec}s`;
  state.timer = setInterval(() => {
    state.timeLeft--;
    box.textContent = `⏱ ${state.timeLeft}s`;
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      $('#btn-run').click();
    }
  }, 1000);
}

// ---------------------- Select choice (cho phép sửa đáp án) ----------------------
function selectChoice(i, q) {
  // 🎭 Chế độ trêu
  const teaseMessages = [
    "😏 Bạn chắc chưa?",
    "🤔 Có gì đó sai sai...",
    "😜 Nghĩ lại xem nào!",
    "😂 Câu này dễ mà, sao phải chọn nhanh vậy?"
  ];
  const teaseOptions = [1, 2, 3, 4];
  const teaseChance = Math.random() < 0.6;
  if (teaseOptions.includes(i) && teaseChance) {
    toast(teaseMessages[Math.floor(Math.random() * teaseMessages.length)]);
    return;
  }

  // ✅ Lưu đáp án và cập nhật điểm
  state.answers[state.idx] = i;
  recomputeScore();

  // ✅ Tô màu đáp án
  const btns = [...document.querySelectorAll('#answers button')];
  btns.forEach((b, idx) => {
    b.classList.remove('correct', 'wrong', 'selected');
    if (idx === i) b.classList.add('selected');
    if (idx === q.answer) b.classList.add('correct');
    if (idx === i && i !== q.answer) b.classList.add('wrong');
  });

  // ✅ Hiển thị kết quả và giải thích tách biệt
  const feedback = $('#feedback');
  feedback.innerHTML = '';

  const resultText = document.createElement('div');
  resultText.className = i === q.answer ? 'result-right' : 'result-wrong';
  resultText.textContent = i === q.answer ? '✅ Chính xác!' : '❌ Sai rồi!';

  const explainBox = document.createElement('div');
  explainBox.className = 'explanation';
  explainBox.innerHTML = `${q.explanation || 'Không có giải thích cho câu này.'}`;

  feedback.appendChild(resultText);
  feedback.appendChild(explainBox);

  $('#q-score').textContent = `Điểm: ${state.score}`;
  saveProgress();
}




// ---------------------- Recompute score (điểm cập nhật khi sửa đáp án) ----------------------
function recomputeScore() {
  const t = state.currentTrack;
  let total = 0;
  state.answers.forEach((ans, idx) => {
    if (ans !== null && ans === t.challenges[idx].answer) total++;
  });
  state.score = total;
}

// ---------------------- Grade (giữ nguyên cho các type khác) ----------------------
async function grade(q) {
  const fb = $('#feedback');
  try {
    let result = { ok:false, msg:'' };
    if (q.type === 'regex') {
      const user = $('#user-code').value || '';
      result = runRegexCheck(user, q.expect);
    } else if (q.type === 'js-eval') {
      const user = $('#user-code').value || '';
      result = await runJsEval(user, q.tests || []);
    } else if (q.type === 'io') {
      const input = $('#user-input').value || '';
      result = runIOSim(input, q.expected || '');
    } else if (q.type === 'mcq') {
      result = { ok:false, msg:'Đây là câu trắc nghiệm, chọn đáp án!' };
    }
    if (result.ok) { state.score++; fb.textContent = '🎉 Đúng! ' + (result.msg||''); }
    else fb.textContent = '🤔 ' + (result.msg || 'Chưa đúng.');
  } catch (e) {
    fb.textContent = 'Lỗi chạy/chấm: ' + e.message;
  }
  $('#q-score').textContent = `Điểm: ${state.score}`;
  saveProgress();
}

// ---------------------- Next / Prev question ----------------------
function nextQuestion() {
  const t = state.currentTrack;
  
  // ⚠️ Kiểm tra xem đã chọn đáp án chưa
  if (state.answers[state.idx] === null) {
    toast("⚠️ Vui lòng chọn đáp án trước khi qua câu tiếp theo!");
    return; // không cho qua
  }

  if (state.idx < t.challenges.length - 1) {
    state.idx++;
    loadQuestion();
  } else {
    finishTrack();
  }
}


// ---------------------- Finish ----------------------
function finishTrack() {
  const total = state.currentTrack.challenges.length;
  const root = $('#view');
  root.innerHTML = `
    <section class="hero">
      <h2>Hoàn thành Track: ${state.currentTrack.title} ✅</h2>
      <p>Điểm: <b>${state.score}</b> / ${total}</p>
      <button class="cta" data-nav="tracks">Chọn track khác</button>
      
    </section>
  `;
}

// ---------------------- Toast ----------------------
function toast(msg){ const fb=$('#feedback'); fb.textContent = msg; }

// ---------------------- Boot ----------------------
async function boot() {
  await loadTracks();
  render('home');
}
boot();
