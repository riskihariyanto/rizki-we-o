export function freeSlots(capacity, filled, blocks) {
  let closed = 0;

  for (const block of blocks) {
    if (block.slotDitutup === "semua") {
      closed = capacity;
      break;
    }
    closed += Number(block.slotDitutup) || 0;
  }

  closed = Math.min(closed, capacity);

  return {
    closed,
    free: Math.max(0, capacity - closed - filled),
    blocked: closed >= capacity
  };
}
