// Cảnh báo: eval luôn có rủi ro. Ở template này, ta sandbox tối thiểu.
// KHÔNG truyền code không tin cậy ra production khi chưa sandbox nghiêm ngặt.
export async function runJsEval(source, tests) {
  // Ghép function của người chơi + chạy test
  try {
    // Tạo Function thay vì eval cho phạm vi kín hơn
    const fnFactory = new Function(`${source}; return { ...this };`);
    const exported = fnFactory.call({});
    // Mặc định kỳ vọng người chơi định nghĩa hàm solve(...)
    const solve = exported.solve || (typeof window.solve === 'function' ? window.solve : null);
    if (!solve) return { ok:false, msg:'Không tìm thấy hàm solve(...) trong code.' };

    for (const t of tests) {
      const got = Array.isArray(t.input) ? solve(...t.input) : solve(t.input);
      const ok = JSON.stringify(got) === JSON.stringify(t.output);
      if (!ok) return { ok:false, msg:`Sai test: input=${JSON.stringify(t.input)} → expected=${JSON.stringify(t.output)}, got=${JSON.stringify(got)}` };
    }
    return { ok:true, msg:`Qua ${tests.length} test ✅` };
  } catch(e) {
    return { ok:false, msg:'Lỗi thực thi: '+e.message };
  }
}
