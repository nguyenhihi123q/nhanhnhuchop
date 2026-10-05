// Sinh ID ổn định phía client.
// Dùng crypto.randomUUID khi có, fallback để chạy được cả môi trường test cũ.

let counter = 0;

export function uid(prefix = 'id'): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    return `${prefix}_${c.randomUUID()}`;
  }
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand}`;
}

/** Chuẩn hóa Unicode NFC + gộp khoảng trắng + trim, dùng cho so sánh. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Khóa so sánh không phân biệt hoa/thường và khoảng trắng. */
export function compareKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('vi');
}
