import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CurrentUser, JwtAuthGuard, PermissionsGuard, RequirePermission, AuthUser } from './auth';
import { computeStockPieces, assertSufficientStock, roundStock } from './stock.util';

type SaleDraft = {
  productId?: string;
  productName?: string;
  unit?: string;
  quantity?: number;
  unitPrice?: number;
};

@Controller('sales')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('sales')
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.sale.findMany({
      where: { organizationId: user.organizationId },
      include: { items: true },
      orderBy: { saleDate: 'desc' },
      take: 300,
    });
  }

  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body()
    body: {
      invoiceNumber?: string;
      saleDate?: string;
      customerName?: string;
      discount?: number;
      paidAmount?: number;
      notes?: string;
      items?: SaleDraft[];
    },
  ) {
    const invoiceNumber = body.invoiceNumber?.trim();
    if (!invoiceNumber || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('رقم الفاتورة وبند واحد على الأقل مطلوبان.');
    }
    const date = body.saleDate ? new Date(body.saleDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('تاريخ البيع غير صحيح.');

    type ParsedLine = {
      productId: string | null;
      productName: string;
      unit: string | null;
      quantity: number;
      unitPrice: number;
    };

    const parsed: ParsedLine[] = body.items.map((item) => {
      const productId = item.productId?.trim() || null;
      const productName = (item.productName || '').trim();
      const unit = item.unit?.trim() || null;
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException('راجع الكمية وسعر البيع لكل بند.');
      }
      if (!productId && !productName) {
        throw new BadRequestException('كل بند يحتاج اسم خدمة أو صنف من المخزون.');
      }
      return { productId, productName, unit, quantity, unitPrice };
    });

    // تجميع كميات المخزون فقط (بنود لها productId)
    const grouped = new Map<string, number>();
    for (const item of parsed) {
      if (!item.productId) continue;
      grouped.set(item.productId, (grouped.get(item.productId) || 0) + item.quantity);
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
        const products = new Map<string, { id: string; name: string; currentCost: Prisma.Decimal }>();
        // قفل صفوف المنتجات ثم إعادة فحص الرصيد داخل نفس المعاملة
        for (const [productId, requested] of grouped) {
          await this.lockProductRow(tx, user.organizationId, productId);
          const product = await tx.product.findFirst({
            where: { id: productId, organizationId: user.organizationId },
          });
          if (!product) throw new BadRequestException('أحد الأصناف غير موجود في مكتبتك.');
          const stock = await this.currentStockTx(tx, user.organizationId, productId);
          try {
            assertSufficientStock(stock, requested, product.name);
          } catch (e) {
            throw new BadRequestException(e instanceof Error ? e.message : 'رصيد غير كافٍ.');
          }
          products.set(productId, {
            id: product.id,
            name: product.name,
            currentCost: product.currentCost,
          });
        }

        const lines = parsed.map((item) => {
          if (item.productId) {
            const product = products.get(item.productId)!;
            return {
              productId: product.id,
              productName: product.name,
              unit: item.unit,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: Number(product.currentCost),
              lineTotal: item.quantity * item.unitPrice,
            };
          }
          return {
            productId: null as string | null,
            productName: item.productName,
            unit: item.unit || 'خدمة',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: 0,
            lineTotal: item.quantity * item.unitPrice,
          };
        });

        const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
        const discount = Number(body.discount ?? 0);
        const paidAmount = Number(body.paidAmount ?? 0);
        if (
          !Number.isFinite(discount) ||
          discount < 0 ||
          discount > subtotal ||
          !Number.isFinite(paidAmount) ||
          paidAmount < 0 ||
          paidAmount > subtotal - discount
        ) {
          throw new BadRequestException('الخصم أو المبلغ المدفوع غير صحيح.');
        }

        const sale = await tx.sale.create({
          data: {
            organizationId: user.organizationId,
            invoiceNumber,
            saleDate: date,
            customerName: body.customerName?.trim() || null,
            subtotal: new Prisma.Decimal(subtotal),
            discount: new Prisma.Decimal(discount),
            total: new Prisma.Decimal(subtotal - discount),
            paidAmount: new Prisma.Decimal(paidAmount),
            notes: body.notes?.trim() || null,
            items: {
              create: lines.map((line) => ({
                productId: line.productId,
                productName: line.productName,
                unit: line.unit,
                quantity: new Prisma.Decimal(line.quantity),
                unitPrice: new Prisma.Decimal(line.unitPrice),
                unitCost: new Prisma.Decimal(line.unitCost),
                lineTotal: new Prisma.Decimal(line.lineTotal),
              })),
            },
          },
          include: { items: true },
        });

        for (const [productId, quantity] of grouped) {
          await tx.stockMovement.create({
            data: {
              organizationId: user.organizationId,
              productId,
              quantity: new Prisma.Decimal(-quantity),
              type: 'SALE',
              reason: `بيع ${invoiceNumber}`,
              notes: `خصم آلي من المخزون للفاتورة ${invoiceNumber}`,
            },
          });
        }

        // قيد خزينة تلقائي بالمبلغ المحصّل (إن وُجد)
        if (paidAmount > 0) {
          await tx.cashTransaction.create({
            data: {
              organizationId: user.organizationId,
              userId: user.userId,
              kind: 'INCOME',
              date,
              category: 'مبيعات',
              amount: new Prisma.Decimal(paidAmount),
              method: 'CASH',
              reference: `SALE:${sale.id}`,
              notes: `تحصيل فاتورة بيع ${invoiceNumber}`,
            },
          });
        }
        return sale;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
    } catch (error: unknown) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('رقم فاتورة البيع مستخدم من قبل.');
      }
      // تعارض عزل Serializable
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new BadRequestException('تعارض في المخزون بسبب عملية متزامنة — أعد المحاولة.');
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const sale = await this.prisma.sale.findFirst({
      where: { id, organizationId: user.organizationId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('فاتورة البيع غير موجودة.');

    return this.prisma.$transaction(
      async (tx) => {
      // قفل الأصناف ثم إرجاع الرصيد
      const productIds = [...new Set(sale.items.map((i) => i.productId).filter(Boolean))] as string[];
      for (const productId of productIds) {
        await this.lockProductRow(tx, user.organizationId, productId);
      }
      for (const item of sale.items) {
        if (!item.productId) continue;
        await tx.stockMovement.create({
          data: {
            organizationId: user.organizationId,
            productId: item.productId,
            quantity: item.quantity, // موجب = إرجاع
            type: 'ADJUSTMENT',
            reason: `إلغاء بيع ${sale.invoiceNumber}`,
            notes: `إرجاع رصيد بعد حذف فاتورة البيع ${sale.invoiceNumber}`,
          },
        });
      }
      await tx.cashTransaction.deleteMany({
        where: { organizationId: user.organizationId, reference: `SALE:${sale.id}` },
      });
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
      await tx.sale.delete({ where: { id: sale.id } });
      return { ok: true, invoiceNumber: sale.invoiceNumber };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 5_000,
      timeout: 15_000,
    },
    );
  }

  private async lockProductRow(
    tx: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM "Product"
      WHERE id = ${productId} AND "organizationId" = ${organizationId}
      FOR UPDATE
    `;
  }

  private async currentStockTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    productId: string,
  ): Promise<number> {
    const product = await tx.product.findFirst({
      where: { id: productId, organizationId },
      include: {
        purchaseItems: { where: { invoice: { organizationId } } },
        returnItems: {
          where: { purchaseReturn: { organizationId } },
          include: { invoiceItem: true },
        },
        stockMovements: { where: { organizationId } },
      },
    });
    if (!product) return 0;
    return computeStockPieces({
      purchases: product.purchaseItems.map((item) => ({
        quantity: Number(item.quantity),
        unit: item.unit,
        piecesPerPack: item.piecesPerPack,
      })),
      returns: product.returnItems.map((item) => ({
        quantity: Number(item.quantity),
        unit: item.invoiceItem.unit,
        piecesPerPack: item.invoiceItem.piecesPerPack,
      })),
      movements: product.stockMovements.map((m) => ({
        quantity: Number(m.quantity),
        type: m.type,
      })),
    });
  }
}
