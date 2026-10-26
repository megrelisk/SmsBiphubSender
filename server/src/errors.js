// შეცდომების კლასიფიკაცია.
//   PERMANENT - ხელახლა გაგზავნას აზრი არ აქვს (არასწორი ნომერი, დაბლოკილი აბონენტი...)
//   TEMPORARY - ღირს ხელახლა ცდა (სერვერის შეცდომა, აბონენტი გამორთულია, TTL გავიდა...)
//   CONFIG    - ჩვენი პარამეტრების პრობლემაა (API key, sender); ცდას არ ვხარჯავთ, ვაჩერებთ და ვუცდით
//   THROTTLED - rate limit; ცდას არ ვხარჯავთ

const PERMANENT_SEND_CODES = new Set(['VALIDATION_FAILED', 'INVALID_PHONE_NUMBER', 'RESOURCE_NOT_FOUND']);
const CONFIG_CODES = new Set(['AUTH_INVALID', 'AUTH_FORBIDDEN']);

// failureReason-ის შესაძლო მნიშვნელობები დოკუმენტაციაში ჩამოთვლილი არ არის.
// ცნობილი "მუდმივი" ტიპის სიტყვები აქ ემატება; დანარჩენი ითვლება დროებით.
// რეალური მნიშვნელობების ნახვის შემდეგ ეს სია დააზუსტეთ.
const PERMANENT_FAILURE_RE =
  /invalid|unknown|unallocated|not[_ ]?exist|barred|blacklist|blocked|unsubscrib|opt[_ ]?out|reject|forbidden|not[_ ]?allowed|unroutable|unsupported/i;

export function classifySendRejection({ code, retryable }) {
  if (PERMANENT_SEND_CODES.has(code)) return 'PERMANENT';
  if (CONFIG_CODES.has(code)) return 'CONFIG';
  if (code === 'RATE_LIMITED') return 'THROTTLED';
  if (retryable === false) return 'PERMANENT';
  return 'TEMPORARY';
}

export function classifyHttpError(status, code) {
  if (CONFIG_CODES.has(code) || status === 401 || status === 403) return 'CONFIG';
  if (status === 429) return 'THROTTLED';
  if (status >= 500) return 'TEMPORARY';
  return 'PERMANENT';
}

export function classifyDeliveryFailure(deliveryStatus, failureReason) {
  if (deliveryStatus === 'EXPIRED') return 'TEMPORARY';
  return failureReason && PERMANENT_FAILURE_RE.test(failureReason) ? 'PERMANENT' : 'TEMPORARY';
}
