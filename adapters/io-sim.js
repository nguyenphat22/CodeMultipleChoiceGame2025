export function runIOSim(userInput, expectedOutput) {
  // So sánh chuỗi đã chuẩn hoá (trim + bỏ khoảng trắng đuôi)
  const norm = s => (s||'').replace(/\r\n/g,'\n').trim();
  const ok = norm(userInput) === norm(expectedOutput);
  return ok ? { ok:true, msg:'Kết quả trùng khớp output mẫu.' }
            : { ok:false, msg:'Output chưa khớp với mẫu mong đợi.' };
}
