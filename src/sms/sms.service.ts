import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly twilioConfigured: boolean;
  private readonly client: Twilio | null;
  private readonly fromNumber: string;

  constructor(private readonly configService: ConfigService) {
    const accountSid = this.configService.get('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get('TWILIO_AUTH_TOKEN');
    this.fromNumber = this.configService.get('TWILIO_FROM_NUMBER') || '';

    this.twilioConfigured = !!(accountSid && authToken && this.fromNumber);

    if (this.twilioConfigured) {
      this.client = new Twilio(accountSid, authToken);
    } else {
      this.client = null;
      this.logger.warn('Twilio not configured. SMS will be logged to console.');
    }
  }

  async sendVerificationSms(phoneNumber: string, code: string): Promise<void> {
    this.logger.log(`Attempting to send SMS to ${phoneNumber} with code ${code}`);
    this.logger.log(`Twilio configured: ${this.twilioConfigured}`);
    this.logger.log(`From number: ${this.fromNumber}`);
    
    if (this.twilioConfigured && this.client) {
      try {
        this.logger.log(`Using Twilio client to send SMS...`);
        await this.client.messages.create({
          body: `Your Nexify verification code is: ${code}`,
          from: this.fromNumber,
          to: phoneNumber,
        });
        this.logger.log(`SMS sent successfully to ${phoneNumber}`);
      } catch (error) {
        this.logger.error(`Failed to send SMS to ${phoneNumber}: ${error instanceof Error ? error.message : String(error)}`);
        // Fallback to console logging when Twilio fails
        this.logger.log(`[FALLBACK] Verification code for ${phoneNumber}: ${code}`);
        // Don't throw error - allow registration to continue with console fallback
      }
    } else {
      // Fallback to console logging when Twilio is not configured
      this.logger.log(`[DEV MODE] Verification code for ${phoneNumber}: ${code}`);
    }
  }
}