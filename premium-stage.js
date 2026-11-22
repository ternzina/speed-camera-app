// The row is [copy of last, ...slides, copy of first]. A settle on either
// copy names the real slot to show instead, with the same card in view.
export function stagePlacement(count, slot) {
  const total = Math.max(0, count);
  if (total < 2) return { slot: 0, page: 0, recenter: null };
  const max = total + 1;
  const bounded = Math.max(0, Math.min(max, slot));
  if (bounded === 0) return { slot: bounded, page: total - 1, recenter: total };
  if (bounded === max) return { slot: bounded, page: 0, recenter: 1 };
  return { slot: bounded, page: bounded - 1, recenter: null };
}
