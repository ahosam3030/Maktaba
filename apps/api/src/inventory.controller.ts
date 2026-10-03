import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { CurrentUser, JwtAuthGuard, PermissionsGuard, RequirePermission, AuthUser } from './auth';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('inventory')
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const products = await this.prisma.product.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: 'asc' },
      include: {
        purchaseItems: { where: { invoice: { organizationId: user.organizationId } } },
        returnItems: { where: { purchaseReturn: { organizationId: user.organizationId } }, include: { invoiceItem: true } },
        stockMovements: { where: { organizationId: user.organizationId } },
      },
    });
    return products.map((product) => {
      const purchased = product.purchaseItems.reduce(
        (sum, item) => sum + Number(item.quantity) * (item.unit === 'PACK' ? item.piecesPerPack : 1),
        0,
      );
      const returned = product.returnItems.reduce(
        (sum, item) => sum + Number(item.quantity) * (item.invoiceItem.unit === 'PACK' ? item.invoiceItem.piecesPerPack : 1),
        0,
      );
      const sold = -product.stockMovements
        .filter((m) => m.type === 'SALE')
        .reduce((sum, m) => sum + Number(m.quantity), 0);
      const adjusted = product.stockMovements
        .filter((m) => m.type !== 'SALE')
        .reduce((sum, m) => sum + Number(m.quantity), 0);
      return {
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        unit: product.unit,
        piecesPerPack: product.piecesPerPack,
        currentCost: Number(product.currentCost),
        salePrice: Number(product.salePrice),
        purchased,
        returned,
        sold,
        adjusted,
        stock: purchased - returned - sold + adjusted,
      };
    });
  }

  @Post('adjustments')
  async adjust(@CurrentUser() user: AuthUser, @Body() body: { productId?: string; quantity?: number; reason?: string; notes?: string }) {
    const productId = body.productId?.trim();
    const quantity = Number(body.quantity);
    const reason = body.reason?.trim();
    if (!productId || !Number.isFinite(quantity) || quantity === 0 || !reason) {
      throw new BadRequestException('اختر الصنف وأدخل كمية تعديل غير صفرية وسبب التعديل.');
    }
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({ where: { id: productId, organizationId: user.organizationId } });
      if (!product) throw new BadRequestException('الصنف غير موجود في مكتبتك.');
      const current = await this.currentStockTx(tx, user.organizationId, productId);
      if (current + quantity < 0) throw new BadRequestException('لا يمكن أن يصبح رصيد الصنف بالسالب.');
      return tx.stockMovement.create({
        data: {
          organizationId: user.organizationId,
          productId,
          quantity: new Prisma.Decimal(quantity),
          type: 'ADJUSTMENT',
          reason,
          notes: body.notes?.trim() || null,
        },
        include: { product: { select: { id: true, name: true, barcode: true } } },
      });
    });
  }

  @Patch('products/:id')
  async updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: { salePrice?: number; barcode?: string },
  ) {
    const product = await this.prisma.product.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!product) throw new BadRequestException('الصنف غير موجود في مكتبتك.');
    const data: Prisma.ProductUpdateInput = {};
    if (body.salePrice !== undefined) {
      const price = Number(body.salePrice);
      if (!Number.isFinite(price) || price < 0) throw new BadRequestException('سعر البيع غير صحيح.');
      data.salePrice = price;
    }
    if (body.barcode !== undefined) {
      data.barcode = body.barcode.trim() || null;
    }
    if (Object.keys(data).length === 0) throw new BadRequestException('لا توجد حقول لتحديثها.');
    return this.prisma.product.update({ where: { id }, data });
  }

  private async currentStockTx(tx: Prisma.TransactionClient, organizationId: string, productId: string) {
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
    return purchased - returned + product.stockMovements.reduce((sum, item) => sum + Number(item.quantity), 0);
  }
}
