import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { MediaService } from './media.service';
import {
  RequestVideoUploadInput,
  RequestImageUploadInput,
  UploadUrlResponse,
  MediaAsset,
} from './media.types';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Resolver()
export class MediaResolver {
  constructor(private readonly mediaService: MediaService) {}

  @Mutation(() => UploadUrlResponse)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async requestVideoUpload(
    @CurrentUser() user: any,
    @Args('input') input: RequestVideoUploadInput,
  ): Promise<UploadUrlResponse> {
    return this.mediaService.requestVideoUpload(user.sub, input);
  }

  @Mutation(() => UploadUrlResponse)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async requestImageUpload(
    @CurrentUser() user: any,
    @Args('input') input: RequestImageUploadInput,
  ): Promise<UploadUrlResponse> {
    return this.mediaService.requestImageUpload(user.sub, input);
  }

  @Mutation(() => MediaAsset)
  @UseGuards(GqlAuthGuard)
  async completeUpload(
    @CurrentUser() user: any,
    @Args('assetId', { type: () => ID }) assetId: string,
  ): Promise<MediaAsset> {
    return this.mediaService.completeUpload(user.sub, assetId) as unknown as Promise<MediaAsset>;
  }

  @Query(() => MediaAsset, { name: 'mediaAsset' })
  @UseGuards(GqlAuthGuard)
  async mediaAsset(
    @CurrentUser() user: any,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MediaAsset> {
    return this.mediaService.getMediaAsset(user.sub, id) as unknown as Promise<MediaAsset>;
  }
}
