import { Resolver, Mutation, Query, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ServiceOfferingsService } from './service-offerings.service';
import {
  CreateServiceOfferingInput,
  ServiceOffering,
} from './service-offerings.types';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Resolver()
export class ServiceOfferingsResolver {
  constructor(private readonly serviceOfferingsService: ServiceOfferingsService) {}

  @Mutation(() => ID)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createServiceOffering(
    @CurrentUser() user: any,
    @Args('input') input: CreateServiceOfferingInput,
  ): Promise<string> {
    const result = await this.serviceOfferingsService.createServiceOffering(user.sub, input);
    return result.offeringId;
  }

  @Query(() => ServiceOffering)
  @UseGuards(GqlAuthGuard)
  async serviceOffering(@Args('id') id: string): Promise<ServiceOffering> {
    return this.serviceOfferingsService.getServiceOffering(id);
  }
}
