import { Body, Controller, Delete, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, JwtAuthGuard } from './auth';
import { checkRateLimit, resetRateLimit } from './rate-limit';
import { AuditService } from './audit.service';
import { HttpException, HttpStatus } from '@nestjs/common';

function clientIp(req: Request): string {
  const xf = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
  return xf || req.ip || req.socket?.remoteAddress || 'unknown';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  /** التسجيل العام معطّل — إنشاء المكتبة عبر سكربت seed أو بمفتاح SETUP_SECRET */
  @Post('register')
  register(
    @Body()
    body: {
      organizationName?: string;
      slug?: string;
      phone?: string;
      fullName?: string;
      email?: string;
      password?: string;
      setupSecret?: string;
    },
  ) {
    return this.auth.register(body);
  }

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }, @Req() req: Request) {
    const email = (body.email || '').trim().toLowerCase();
    const ip = clientIp(req);
    const ua = (req.headers['user-agent'] as string) || '';

    const ipLimit = Number(process.env.LOGIN_RATE_LIMIT_IP || 30);
    const emailLimit = Number(process.env.LOGIN_RATE_LIMIT_EMAIL || 8);
    const windowMs = Number(process.env.LOGIN_RATE_WINDOW_MS || 15 * 60 * 1000);

    const ipCheck = checkRateLimit(`login:ip:${ip}`, ipLimit, windowMs);
    if (!ipCheck.allowed) {
      await this.audit.log({
        action: 'LOGIN_RATE_LIMIT',
        ip,
        userAgent: ua,
        meta: { email, scope: 'ip' },
        success: false,
      });
      throw new HttpException(
        `محاولات كثيرة من هذا الجهاز. حاول بعد ${ipCheck.retryAfterSec} ثانية.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (email) {
      const emailCheck = checkRateLimit(`login:email:${email}`, emailLimit, windowMs);
      if (!emailCheck.allowed) {
        await this.audit.log({
          action: 'LOGIN_RATE_LIMIT',
          ip,
          userAgent: ua,
          meta: { email, scope: 'email' },
          success: false,
        });
        throw new HttpException(
          `محاولات كثيرة لهذا الحساب. حاول بعد ${emailCheck.retryAfterSec} ثانية.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    try {
      const result = await this.auth.login(body);
      if (email) resetRateLimit(`login:email:${email}`);
      await this.audit.log({
        organizationId: result.organization?.id,
        userId: result.user?.id,
        action: 'LOGIN_SUCCESS',
        entity: 'User',
        entityId: result.user?.id,
        ip,
        userAgent: ua,
        success: true,
      });
      return result;
    } catch (err) {
      await this.audit.log({
        action: 'LOGIN_FAIL',
        entity: 'User',
        ip,
        userAgent: ua,
        meta: { email },
        success: false,
      });
      throw err;
    }
  }

  /** حذف المكتبة وكل بياناتها — للمالك فقط (مسجّل دخول) */
  @Delete('organization')
  @UseGuards(JwtAuthGuard)
  async deleteOrganization(
    @CurrentUser() user: AuthUser,
    @Body() body: { confirmSlug?: string },
    @Req() req: Request,
  ) {
    const result = await this.auth.deleteOrganization(user, body?.confirmSlug);
    await this.audit.log({
      organizationId: user.organizationId,
      userId: user.userId,
      action: 'ORG_DELETE',
      entity: 'Organization',
      entityId: user.organizationId,
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) || '',
      meta: { slug: body?.confirmSlug },
      success: true,
    });
    return result;
  }

  /** حذف المكتبة من صفحة الدخول بعد التحقق بالبريد وكلمة المرور (مالك فقط) */
  @Post('delete-organization')
  async deleteOrganizationPublic(
    @Body() body: { email?: string; password?: string; confirmSlug?: string },
    @Req() req: Request,
  ) {
    const result = await this.auth.deleteOrganizationWithCredentials(body);
    await this.audit.log({
      action: 'ORG_DELETE_PUBLIC',
      entity: 'Organization',
      ip: clientIp(req),
      userAgent: (req.headers['user-agent'] as string) || '',
      meta: { email: body.email, slug: body.confirmSlug },
      success: true,
    });
    return result;
  }
}
