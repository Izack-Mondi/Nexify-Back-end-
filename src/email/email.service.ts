import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly smtpConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.smtpConfigured = !!(
      this.configService.get('SMTP_HOST') &&
      this.configService.get('SMTP_PORT') &&
      this.configService.get('SMTP_USER') &&
      this.configService.get('SMTP_PASSWORD')
    );
  }

  async sendVerificationEmail(email: string, code: string): Promise<void> {
    if (this.smtpConfigured) {
      // In production, you would use nodemailer or similar here
      // For now, we'll log since SMTP implementation isn't required
      this.logger.log(`[SMTP] Verification email would be sent to ${email} with code: ${code}`);
    } else {
      // Fallback to console logging when SMTP is not configured
      this.logger.log(`[DEV MODE] Verification code for ${email}: ${code}`);
    }
  }
}
