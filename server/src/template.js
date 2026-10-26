const VAR = /\{\{\s*([^{}\s]+)\s*\}\}/g;

export function templateVars(body) {
  return [...new Set([...body.matchAll(VAR)].map((m) => m[1]))];
}

// აბრუნებს { text } ან { missing: [...] } თუ რომელიმე ცვლადს მნიშვნელობა არ აქვს
export function render(body, vars = {}) {
  const missing = templateVars(body).filter((k) => vars[k] === undefined || String(vars[k]).trim() === '');
  if (missing.length) return { missing };
  return { text: body.replace(VAR, (_, k) => String(vars[k]).trim()) };
}
