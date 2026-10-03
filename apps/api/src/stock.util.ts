/**
 * حساب رصيد الصنف بالقطعة من حركات الشراء والمرتجع والمخزون.
 * يُستخدم في البيع والتسويات والتقارير بنفس المعادلة.
 */
export type PurchaseLineLike = {
  quantity: number;
  unit?: string | null;
  piecesPerPack?: number | null;
};

export type MovementLike = {
  quantity: number;
  type?: string | null;
};

export function piecesFromPurchaseLine(line: PurchaseLineLike): number {
  const qty = Number(line.quantity) || 0;
  const unit = (line.unit || '').toUpperCase();
  const ppp = Math.max(1, Number(line.piecesPerPack) || 1);
  if (unit === 'PACK' || unit === 'علبة') return qty * ppp;
  return qty;
}

export function computeStockPieces(input: {
  purchases: PurchaseLineLike[];
  returns: PurchaseLineLike[];
  movements: MovementLike[];
}): number {
  const purchased = input.purchases.reduce((s, l) => s + piecesFromPurchaseLine(l), 0);
  const returned = input.returns.reduce((s, l) => s + piecesFromPurchaseLine(l), 0);
  const moved = input.movements.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  return purchased - returned + moved;
}

export function assertSufficientStock(available: number, requested: number, productName: string): void {
  if (requested > available + 1e-9) {
    throw new Error(`الرصيد غير كافٍ للصنف ${productName}. المتاح: ${roundStock(available)}`);
  }
}

export function roundStock(n: number): number {
  return Math.round(n * 1000) / 1000;
}
