const { strict: assert } = require('node:assert');
const { test } = require('node:test');

// Inline minimal copy of stock.util for zero-deps CI, or require compiled - use dynamic import of ts via eval of logic

function piecesFromPurchaseLine(line) {
  const qty = Number(line.quantity) || 0;
  const unit = (line.unit || '').toUpperCase();
  const ppp = Math.max(1, Number(line.piecesPerPack) || 1);
  if (unit === 'PACK' || unit === 'علبة') return qty * ppp;
  return qty;
}

function computeStockPieces(input) {
  const purchased = input.purchases.reduce((s, l) => s + piecesFromPurchaseLine(l), 0);
  const returned = input.returns.reduce((s, l) => s + piecesFromPurchaseLine(l), 0);
  const moved = input.movements.reduce((s, m) => s + (Number(m.quantity) || 0), 0);
  return purchased - returned + moved;
}

function assertSufficientStock(available, requested, productName) {
  if (requested > available + 1e-9) {
    throw new Error(`الرصيد غير كافٍ للصنف ${productName}. المتاح: ${Math.round(available * 1000) / 1000}`);
  }
}

test('piecesFromPurchaseLine', () => {
  assert.equal(piecesFromPurchaseLine({ quantity: 5, unit: 'قطعة' }), 5);
  assert.equal(piecesFromPurchaseLine({ quantity: 2, unit: 'PACK', piecesPerPack: 10 }), 20);
});

test('computeStockPieces', () => {
  assert.equal(
    computeStockPieces({
      purchases: [{ quantity: 10, unit: 'قطعة' }, { quantity: 1, unit: 'PACK', piecesPerPack: 10 }],
      returns: [{ quantity: 2, unit: 'قطعة' }],
      movements: [{ quantity: -5 }, { quantity: 1 }],
    }),
    14,
  );
});

test('assertSufficientStock', () => {
  assert.throws(() => assertSufficientStock(3, 5, 'قلم'), /الرصيد غير كاف/);
  assert.doesNotThrow(() => assertSufficientStock(5, 5, 'قلم'));
});
