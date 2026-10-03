import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { HealthController } from './health.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard, PermissionsGuard } from './auth';
import { SuppliersController, PurchaseInvoicesController, SupplierPaymentsController, PurchaseReturnsController } from './purchases.controller';
import { PrismaModule } from './prisma.module';
import { InventoryController } from './inventory.controller';
import { SalesController } from './sales.controller';
import { AccountingController } from './accounting.controller';
import { UsersController } from './users.controller';
import { ReportsController } from './reports.controller';
import { ServicesController, ServiceReceiptsController } from './services.controller';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { SettingsController } from './settings.controller';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production.');
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret || 'development-only-change-before-deploy',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    ReportsController,
    SuppliersController,
    PurchaseInvoicesController,
    SupplierPaymentsController,
    PurchaseReturnsController,
    InventoryController,
    SalesController,
    AccountingController,
    ServicesController,
    ServiceReceiptsController,
    AuditController,
    SettingsController,
  ],
  providers: [AuthService, AuditService, JwtAuthGuard, PermissionsGuard],
})
export class AppModule {}
