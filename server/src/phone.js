// ქართული ნომრის ნორმალიზაცია Beephub-ის ფორმატზე: 995XXXXXXXXX (ციფრები, + და 00 გარეშე)
export function normalizePhone(raw) {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 9 && d.startsWith('5')) d = '995' + d;
  return /^995\d{9}$/.test(d) ? d : null;
}
