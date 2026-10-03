/**
 * يمسح كل البيانات ويعيد مالك واحد.
 * من مجلد apps/api:
 *   npm run seed
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  'purchases',
  'sales',
  'inventory',
  'accounting',
  'printing',
  'reports',
  'users',
];

async function main() {
  console.log('⚠ مسح كل المؤسسات والمستخدمين والبيانات...');

  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.purchaseReturnItem.deleteMany();
  await prisma.purchaseReturn.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.purchaseInvoiceItem.deleteMany();
  await prisma.purchaseInvoice.deleteMany();
  await prisma.cashTransaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.organization.deleteMany();

  const password = process.env.SEED_OWNER_PASSWORD || 'Admin@12345';
  const email = (process.env.SEED_OWNER_EMAIL || 'admin@maktaba.local').toLowerCase();
  const fullName = process.env.SEED_OWNER_NAME || 'المالك';
  const orgName = process.env.SEED_ORG_NAME || 'مركز المهندس للخدمات العلمية والطباعة';
  const slug = (process.env.SEED_ORG_SLUG || 'al-mohandes').toLowerCase();
  const phone = process.env.SEED_ORG_PHONE || '01127897245';

  const passwordHash = await bcrypt.hash(password, 12);
  const org = await prisma.organization.create({
    data: { name: orgName, slug, phone },
  });
  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      fullName,
      email,
      passwordHash,
      role: 'OWNER',
      permissions: JSON.stringify(ALL_PERMISSIONS),
      active: true,
    },
  });

  console.log('✓ تم المسح وإنشاء المالك:');
  console.log(`  المكتبة: ${org.name} (${org.slug})`);
  console.log(`  البريد:     ${user.email}`);
  console.log(`  كلمة المرور: ${password}`);
  console.log('  غيّر كلمة المرور بعد أول دخول من الإعدادات/المستخدمين إن لزم.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
