export function formatUsd(amount: number): string {
  if (amount <= 0) return '$0.00';
  if (amount < 0.0001) return '< $0.0001';
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(3)}`;
}
