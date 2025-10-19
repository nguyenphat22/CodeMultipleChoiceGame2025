export function runRegexCheck(source, expect) {
  // expect: { must: [regex...], mustnot: [regex...] }
  const must = expect?.must || [];
  const mustnot = expect?.mustnot || [];
  for (const r of must) {
    const re = new RegExp(r, 'm');
    if (!re.test(source)) return { ok:false, msg:`Thiếu mẫu bắt buộc: /${r}/` };
  }
  for (const r of mustnot) {
    const re = new RegExp(r, 'm');
    if (re.test(source)) return { ok:false, msg:`Có mẫu cấm: /${r}/` };
  }
  return { ok:true, msg:'Thoả các quy tắc cú pháp.' };
}
