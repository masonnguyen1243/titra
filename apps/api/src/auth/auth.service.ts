import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_HOURS = 24;
const RESET_TOKEN_TTL_HOURS = 1;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
        passwordHash: true,
      },
    });

    const isValid =
      user?.passwordHash != null &&
      (await bcrypt.compare(dto.password, user.passwordHash));

    if (!user || !isValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Vui lòng xác nhận email trước khi đăng nhập');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Tài khoản đã bị vô hiệu hoá');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_SECRET'],
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env['JWT_REFRESH_SECRET'],
      expiresIn: REFRESH_TOKEN_TTL,
    });

    this.setTokenCookies(res, accessToken, refreshToken);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  }

  async refresh(req: Request, res: Response) {
    const token: string | undefined = (req.cookies as Record<string, string>)['refresh_token'];
    if (!token) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    let payload: { sub: string; email: string; role: string };
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env['JWT_REFRESH_SECRET'],
      }) as typeof payload;
    } catch {
      throw new UnauthorizedException('Refresh token đã hết hạn hoặc không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true, emailVerified: true },
    });

    if (!user || !user.isActive || !user.emailVerified) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const newPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(newPayload, {
      secret: process.env['JWT_SECRET'],
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshToken = this.jwtService.sign(newPayload, {
      secret: process.env['JWT_REFRESH_SECRET'],
      expiresIn: REFRESH_TOKEN_TTL,
    });

    this.setTokenCookies(res, accessToken, refreshToken);

    return { ok: true };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token },
      select: { id: true, emailVerified: true, verificationTokenExpiry: true },
    });

    if (!user) {
      throw new BadRequestException('Liên kết xác nhận không hợp lệ');
    }

    if (user.emailVerified) {
      return { ok: true };
    }

    if (!user.verificationTokenExpiry || user.verificationTokenExpiry < new Date()) {
      throw new BadRequestException('Liên kết xác nhận đã hết hạn');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, name: true, email: true, isActive: true },
    });

    // Always return ok to prevent user enumeration
    if (!user || !user.isActive) {
      return { ok: true };
    }

    const resetToken = randomUUID();
    const resetExpiry = new Date(
      Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: resetToken, passwordResetExpiry: resetExpiry },
    });

    await this.sendPasswordResetEmail(user.email, user.name, resetToken);

    return { ok: true };
  }

  logout(res: Response) {
    const cookieBase = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
    };
    res.clearCookie('access_token', cookieBase);
    res.clearCookie('refresh_token', cookieBase);
    return { ok: true };
  }

  private setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
    const cookieBase = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
    };

    res.cookie('access_token', accessToken, { ...cookieBase, maxAge: 15 * 60 * 1000 });
    res.cookie('refresh_token', refreshToken, { ...cookieBase, maxAge: REFRESH_TOKEN_TTL_MS });
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const verificationToken = randomUUID();
    const verificationTokenExpiry = new Date(
      Date.now() + VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        verificationToken,
        verificationTokenExpiry,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    await this.sendVerificationEmail(dto.email, dto.name, verificationToken);

    return user;
  }

  private async sendPasswordResetEmail(
    email: string,
    name: string,
    token: string,
  ) {
    const appUrl =
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(`[DEV] Password reset link for ${email}: ${resetUrl}`);
      return;
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: process.env['EMAIL_FROM'] ?? 'onboarding@resend.dev',
        to: email,
        subject: 'Đặt lại mật khẩu — Titra',
        html: `
          <p>Xin chào ${escapeHtml(name)},</p>
          <p>Nhấn vào liên kết dưới đây để đặt lại mật khẩu. Liên kết có hiệu lực trong 1 giờ.</p>
          <p><a href="${resetUrl}">${resetUrl}</a></p>
          <p>Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send password reset email to ${email}`, err);
    }
  }

  private async sendVerificationEmail(
    email: string,
    name: string,
    token: string,
  ) {
    const appUrl =
      process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    const resendApiKey = process.env['RESEND_API_KEY'];
    if (!resendApiKey) {
      this.logger.log(
        `[DEV] Verification link for ${email}: ${verifyUrl}`,
      );
      return;
    }

    try {
      const { Resend } = await import('resend');
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: process.env['EMAIL_FROM'] ?? 'onboarding@resend.dev',
        to: email,
        subject: 'Xác nhận email của bạn — Titra',
        html: `
          <p>Xin chào ${escapeHtml(name)},</p>
          <p>Nhấn vào liên kết dưới đây để xác nhận email. Liên kết có hiệu lực trong 24 giờ.</p>
          <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          <p>Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${email}`, err);
    }
  }
}
