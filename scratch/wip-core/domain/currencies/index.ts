export function convertCurrency(
  amount: string,
  fromRate: string,
  toRate: string,
): string {
  const amountVal = Number.parseFloat(amount) || 0;
  const fromR = Number.parseFloat(fromRate) || 1.0;
  const toR = Number.parseFloat(toRate) || 1.0;

  if (fromR <= 0 || toR <= 0) return amountVal.toFixed(2);

  // Convert amount from base currency equivalent and scale
  const baseEquivalent = amountVal * fromR;
  const targetVal = baseEquivalent / toR;

  return targetVal.toFixed(2);
}
