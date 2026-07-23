/**
 * Generate a fresh unique id for a consent record. Prefers `crypto.randomUUID`,
 * falls back to building a v4-style UUID from `crypto.getRandomValues` (Safari
 * <15.4), and as a last resort uses `Math.random` (non-crypto, but this is an
 * identifier, not a secret).
 */
export function newRecordId(): string {
  const cryptoObj: Crypto | undefined =
    typeof crypto !== 'undefined' ? crypto : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    // Set version (4) and variant (10) bits per RFC 4122.
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }

  // Last-resort fallback: non-crypto, but acceptable for a non-secret identifier.
  const hexDigit = () => Math.floor(Math.random() * 16).toString(16);
  const hexDigits = (n: number) => Array.from({ length: n }, hexDigit).join('');
  const variantDigit = ((Math.random() * 4) | 8).toString(16); // one of 8, 9, a, b
  return `${hexDigits(8)}-${hexDigits(4)}-4${hexDigits(3)}-${variantDigit}${hexDigits(3)}-${hexDigits(12)}`;
}
