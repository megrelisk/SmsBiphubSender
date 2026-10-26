// SMS fragment-ების დათვლა Beephub-ის წესით:
// GSM-7: 160 / 153, UCS-2 (მათ შორის ქართული): 70 / 67, მაქსიმუმ 10 fragment.
// (იგივე ლოგიკაა client/src/gsm.js-შიც)

const BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const EXTENDED = '^{}\\[~]|€'; // თითო სიმბოლო 2 ადგილს იკავებს

export const MAX_FRAGMENTS = 10;

export function smsInfo(text) {
  let units = 0;
  let gsm = true;
  for (const ch of text) {
    if (BASIC.includes(ch)) units += 1;
    else if (EXTENDED.includes(ch)) units += 2;
    else { gsm = false; break; }
  }
  if (!gsm) {
    units = text.length; // UTF-16 code unit-ები
    return { encoding: 'UCS-2', length: units, fragments: units === 0 ? 0 : units <= 70 ? 1 : Math.ceil(units / 67) };
  }
  return { encoding: 'GSM-7', length: units, fragments: units === 0 ? 0 : units <= 160 ? 1 : Math.ceil(units / 153) };
}
