import { BadRequestException, Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CurrentUser, JwtAuthGuard, AuthUser } from './auth';

type SaleDraft = { productId?: string; quantity?: number; unitPrice?: number };

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.sale.findMany({
      where: { organizationId: user.organizationId },
      include: { items: true },
      orderBy: { saleDate: 'desc' }, take: 300,
    });
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: {
    invoiceNumber?: string; saleDate?: string; customerName?: string;
    discount?: number; paidAmount?: number; notes?: string; items?: SaleDraft[];
  }) {
    const invoiceNumber = body.invoiceNumber?.trim();
    if (!invoiceNumber || !Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('رقم الفاتورة وصنف واحد على الأقل مطلوبان.');
    }
    const date = body.saleDate ? new Date(body.saleDate) : new Date();
    if (Number.isNaN(date.getTime())) throw new BadRequestException('تاريخ البيع غير صحيح.');

    const parsed = body.items.map((item) => {
      const productId = item.productId?.trim();
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new BadRequestException('راجع الصنف والكمية وسعر البيع.');
      }
      return { productId, quantity, unitPrice };
    });
    const grouped = new Map<string, number>();
    for (const item of parsed) grouped.set(item.productId, (grouped.get(item.productId) || 0) + item.quantity);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const products = new Map<string, { id: string; name: string; currentCost: Prisma.Decimal }>();
        for (const [productId, requested] of grouped) {
          const product = await tx.product.findFirst({ where: { id: productId, organizationId: user.organizationId } });
          if (!product) throw new BadRequestException('أحد الأصناف غير موجود في مكتبتك.');
          const stock = await this.currentStockTx(tx, user.organizationId, productId);
          if (requested > stock) {
            throw new BadRequestException(`الرصيد غير كافٍ للصنف ${product.name}. المتاح: ${stock}`);
          }
          products.set(productId, { id: product.id, name: product.name, currentCost: product.currentCost });
        }

        const lines = parsed.map((item) => {
          const product = products.get(item.productId)!;
          return {
            ...item,
            productName: product.name,
            unitCost: Number(product.currentCost),
            lineTotal: item.quantity * item.unitPrice,
          };
        });
        const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
        const discount = Number(body.discount ?? 0);
        const paidAmount = Number(body.paidAmount ?? 0);
        if (!Number.isFinite(discount) || discount < 0 || discount > subtotal || !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > subtotal - discount) {
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
        return sale;
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new BadRequestException('رقم فاتورة البيع مستخدم بالفعل.');
      }
      throw error;
    }
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
        returnItems: { where: { purchaseReturn: { organizationId } }, include: { invoiceItem: true } },
        stockMovements: { where: { organizationId } },
      },
    });
    if (!product) return 0;
    const purchased = product.purchaseItems.reduce(
      (sum, item) => sum + Number(item.quantity) * (item.unit === 'PACK' ? item.piecesPerPack : 1),
      0,
    );
    const returned = product.returnItems.reduce(
      (sum, item) => sum + Number(item.quantity) * (item.invoiceItem.unit === 'PACK' ? item.invoiceItem.piecesPerPack : 1),
      0,
    );
    const movements = product.stockMovements.reduce((sum, movement) => sum + Number(movement.quantity), 0);
    return purchased - returned + movements;
  }
}
