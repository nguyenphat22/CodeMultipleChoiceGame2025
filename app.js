import { runJsEval } from './adapters/js-eval.js';
import { runRegexCheck } from './adapters/regex.js';
import { runIOSim } from './adapters/io-sim.js';

const $ = s => document.querySelector(s);
const state = {
  view: 'home',
  tracks: [],
  currentTrack: null,
  idx: 0,
  score: 0,
  timer: null,
  timeLeft: 0
};

const templates = {
  home: () => $('#tpl-home').content.cloneNode(true),
  tracks: () => $('#tpl-tracks').content.cloneNode(true),
  quiz: () => $('#tpl-quiz').content.cloneNode(true),
  progress: () => $('#tpl-progress').content.cloneNode(true),
  about: () => $('#tpl-about').content.cloneNode(true),
};

document.addEventListener('click', (e) => {
  const nav = e.target?.dataset?.nav;
  if (nav) render(nav);
});

function saveProgress() {
  const key = `pcq_${state.currentTrack?.id || 'global'}`;
  localStorage.setItem(key, JSON.stringify({
    score: state.score, idx: state.idx
  }));
}

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

function render(view='home') {
  state.view = view;
  const root = $('#view');
  root.innerHTML = '';
  const frag = templates[view]();
  root.appendChild(frag);

  if (view === 'tracks') paintTracks();
  if (view === 'progress') paintProgress();
  if (view === 'home') {} // nothing
  if (view === 'about') {} // nothing
}

function paintTracks() {
  const list = $('#track-list');
  list.innerHTML = '';
  state.tracks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'track-card';
    el.innerHTML = `
      <h4>${t.title}</h4>
      <p>${t.description}</p>
      <small>Thử thách: ${t.challenges.length}</small>
      <button>Chơi track này</button>
    `;
    el.querySelector('button').onclick = () => startTrack(t);
    list.appendChild(el);
  });
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

  // Trộn toàn bộ và lấy ngẫu nhiên 15 câu
  shuffle(allQs);
  const mixedQs = allQs.slice(0, 15).map(shuffleOptions);

  // Tạo track "ảo" cho chế độ hỗn hợp
  const mixedTrack = {
    id: 'mixed',
    title: 'Thi Hỗn Hợp (15 câu ngẫu nhiên)',
    description: 'Kết hợp 5 chủ đề: Python, JS, C/C++, Java, SQL',
    challenges: mixedQs
  };

  startTrack(mixedTrack);
}

function paintProgress() {
  const wrap = $('#prog');
  const keys = Object.keys(localStorage).filter(k => k.startsWith('pcq_'));
  if (!keys.length) { wrap.textContent = 'Chưa có tiến độ.'; return; }
  wrap.innerHTML = '';
  keys.forEach(k => {
    const {score, idx} = JSON.parse(localStorage.getItem(k));
    const el = document.createElement('div');
    el.className = 'track-card';
    el.innerHTML = `<b>${k.replace('pcq_','')}</b> — điểm: ${score}, đã làm: ${idx} câu`;
    wrap.appendChild(el);
  });
  $('#reset-progress').onclick = () => {
    keys.forEach(k => localStorage.removeItem(k));
    paintProgress();
  };
}
// === thêm mới: ở gần đầu file app.js (trước startTrack) ===
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
  render('quiz');
  loadQuestion();
}

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

  // Timer (tuỳ chọn)
  startTimer(q.timeLimit || 0);

  // Nút run
  $('#btn-run').onclick = () => grade(q);
  $('#btn-next').onclick = nextQuestion;
  $('#feedback').textContent = '';
}

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

function selectChoice(i, q) {
  const btns = [...document.querySelectorAll('#answers button')];
  btns.forEach((b, idx) => {
    b.disabled = true;
    if (idx === q.answer) b.classList.add('correct');
    if (idx === i && i !== q.answer) b.classList.add('wrong');
  });
  if (i === q.answer) { state.score++; toast('✅ Chính xác'); }
  else toast('❌ Sai rồi');
  saveProgress();
}

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

function nextQuestion() {
  const t = state.currentTrack;
  if (state.idx < t.challenges.length - 1) {
    state.idx++; loadQuestion();
  } else {
    finishTrack();
  }
}

function finishTrack() {
  const total = state.currentTrack.challenges.length;
  const root = $('#view');
  root.innerHTML = `
    <section class="hero">
      <h2>Hoàn thành Track: ${state.currentTrack.title} ✅</h2>
      <p>Điểm: <b>${state.score}</b> / ${total}</p>
      <button class="cta" data-nav="tracks">Chọn track khác</button>
      <button class="secondary" data-nav="progress">Xem tiến độ</button>
    </section>
  `;
}

function toast(msg){ const fb=$('#feedback'); fb.textContent = msg; }

async function boot() {
  await loadTracks();
  render('home');
}
boot();
