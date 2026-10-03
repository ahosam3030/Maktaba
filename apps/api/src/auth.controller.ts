import { Body, Controller, Delete, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, JwtAuthGuard } from './auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  login(@Body() body: { email?: string; password?: string }) {
    return this.auth.login(body);
  }

  /** حذف المكتبة وكل بياناتها — للمالك فقط (مسجّل دخول) */
  @Delete('organization')
  @UseGuards(JwtAuthGuard)
  deleteOrganization(@CurrentUser() user: AuthUser, @Body() body: { confirmSlug?: string }) {
    return this.auth.deleteOrganization(user, body?.confirmSlug);
  }

  /** حذف المكتبة من صفحة الدخول بعد التحقق بالبريد وكلمة المرور (مالك فقط) */
  @Post('delete-organization')
  deleteOrganizationPublic(
    @Body() body: { email?: string; password?: string; confirmSlug?: string },
  ) {
    return this.auth.deleteOrganizationWithCredentials(body);
  }
}
