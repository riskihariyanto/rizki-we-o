const num = (value) => Number(value) || 0;

export function summarize(items) {
  const totalModal = items.reduce((sum, item) => sum + num(item.hargaModal), 0);
  const hargaJual = items.reduce((sum, item) => sum + num(item.hargaJualItem), 0);
  const margin = hargaJual - totalModal;
  const marginPersen = hargaJual > 0 ? (margin / hargaJual) * 100 : 0;

  return { totalModal, hargaJual, margin, marginPersen };
}

export function applyMarkup(hargaModal, percent) {
  return Math.round(num(hargaModal) * (1 + num(percent) / 100));
}
