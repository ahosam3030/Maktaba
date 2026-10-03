import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';
import {
  CurrentUser, JwtAuthGuard, AuthUser, ALL_PERMISSIONS, isAdminRole, parsePermissions, RequirePermission, PermissionsGuard,
} from './auth';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission('users')
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, fullName: true, email: true, role: true, permissions: true, active: true, createdAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      permissions: isAdminRole(r.role) ? [...ALL_PERMISSIONS] : parsePermissions(r.permissions),
    }));
  }

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const row = await this.prisma.user.findFirst({
      where: { id: user.userId, organizationId: user.organizationId },
      select: { id: true, fullName: true, email: true, role: true, permissions: true, active: true },
    });
    if (!row) throw new BadRequestException('المستخدم غير موجود.');
    const permissions = isAdminRole(row.role) ? [...ALL_PERMISSIONS] : parsePermissions(row.permissions);
    return { ...row, permissions };
  }

  @Post()
  @RequirePermission('users')
  async create(
    @CurrentUser() actor: AuthUser,
    @Body() body: { fullName?: string; email?: string; password?: string; role?: string; permissions?: string[] },
  ) {
    if (actor.role !== 'OWNER') throw new ForbiddenException('إنشاء وتعديل المستخدمين متاح لمالك المكتبة فقط.');
    const fullName = body.fullName?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? '';
    let role = (body.role || 'USER').toUpperCase();
    if (!fullName || !email || password.length < 10) {
      throw new BadRequestException('الاسم والبريد وكلمة مرور لا تقل عن 10 أحرف مطلوبة.');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('البريد الإلكتروني غير صحيح.');
    if (!['ADMIN', 'USER'].includes(role)) {
      // only OWNER exists from register; cannot create another OWNER via this endpoint
      role = 'USER';
    }
    if (role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new ForbiddenException('المالك فقط يستطيع إنشاء أدمن.');
    }
    const perms = role === 'ADMIN'
      ? [...ALL_PERMISSIONS]
      : (Array.isArray(body.permissions) ? body.permissions : []).filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p));
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const created = await this.prisma.user.create({
        data: {
          organizationId: actor.organizationId,
          fullName,
          email,
          passwordHash,
          role,
          permissions: JSON.stringify(perms),
          active: true,
        },
        select: { id: true, fullName: true, email: true, role: true, permissions: true, active: true, createdAt: true },
      });
      return { ...created, permissions: parsePermissions(created.permissions) };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new BadRequestException('البريد الإلكتروني مستخدم بالفعل.');
      }
      throw error;
    }
  }

  @Patch(':id')
  @RequirePermission('users')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() body: { fullName?: string; role?: string; permissions?: string[]; active?: boolean; password?: string },
  ) {
    if (actor.role !== 'OWNER') throw new ForbiddenException('إنشاء وتعديل المستخدمين متاح لمالك المكتبة فقط.');
    const target = await this.prisma.user.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!target) throw new BadRequestException('المستخدم غير موجود.');
    if (target.role === 'OWNER' && actor.userId !== target.id) {
      throw new ForbiddenException('لا يمكن تعديل حساب المالك من مستخدم آخر.');
    }
    if (target.id === actor.userId && body.active === false) {
      throw new BadRequestException('لا يمكنك تعطيل حسابك الحالي.');
    }

    const data: {
      fullName?: string;
      role?: string;
      permissions?: string;
      active?: boolean;
      passwordHash?: string;
    } = {};

    if (body.fullName?.trim()) data.fullName = body.fullName.trim();
    if (typeof body.active === 'boolean') data.active = body.active;

    if (body.role) {
      const role = body.role.toUpperCase();
      if (target.role === 'OWNER') {
        // keep OWNER
      } else if (role === 'ADMIN' || role === 'USER') {
        if (role === 'ADMIN' && actor.role !== 'OWNER') {
          throw new ForbiddenException('المالك فقط يستطيع ترقية مستخدم لأدمن.');
        }
        data.role = role;
      }
    }

    if (Array.isArray(body.permissions)) {
      const nextRole = data.role || target.role;
      if (nextRole === 'OWNER' || nextRole === 'ADMIN') {
        data.permissions = JSON.stringify([...ALL_PERMISSIONS]);
      } else {
        data.permissions = JSON.stringify(
          body.permissions.filter((p) => (ALL_PERMISSIONS as readonly string[]).includes(p)),
        );
      }
    }

    if (body.password) {
      if (body.password.length < 10) throw new BadRequestException('كلمة المرور يجب ألا تقل عن 10 أحرف.');
      data.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const updated = await this.prisma.user.update({
      where: { id: target.id },
      data,
      select: { id: true, fullName: true, email: true, role: true, permissions: true, active: true, createdAt: true },
    });
    return {
      ...updated,
      permissions: isAdminRole(updated.role) ? [...ALL_PERMISSIONS] : parsePermissions(updated.permissions),
    };
  }
}
