/** Fresh unique id for a consent record. */
export function newRecordId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // ponytail: Math.random fallback covers insecure contexts (http:// dev servers,
  // where randomUUID is unavailable). Non-crypto is fine for a non-secret id.
  const hexDigit = () => Math.floor(Math.random() * 16).toString(16);
  const hexDigits = (n: number) => Array.from({ length: n }, hexDigit).join('');
  const variantDigit = ((Math.random() * 4) | 8).toString(16); // one of 8, 9, a, b
  return `${hexDigits(8)}-${hexDigits(4)}-4${hexDigits(3)}-${variantDigit}${hexDigits(3)}-${hexDigits(12)}`;
}
