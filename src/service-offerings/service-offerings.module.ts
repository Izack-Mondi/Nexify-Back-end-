import { Module } from '@nestjs/common';
import { ServiceOfferingsResolver } from './service-offerings.resolver';
import { ServiceOfferingsService } from './service-offerings.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MediaModule, AuthModule],
  providers: [ServiceOfferingsResolver, ServiceOfferingsService],
  exports: [ServiceOfferingsService],
})
export class ServiceOfferingsModule {}
