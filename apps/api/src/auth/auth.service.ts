import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TOKEN_TTL_HOURS = 24;

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

  constructor(private readonly prisma: PrismaService) {}

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
        from: 'Titra <no-reply@titra.app>',
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
