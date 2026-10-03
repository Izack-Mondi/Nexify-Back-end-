import { Resolver, Query, Args, Context, Mutation, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FeedService } from './feed.service';
import { FeedInput, FeedConnection, PostType, MediaType, PostContact, PlaybackResponse } from './feed.types';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Resolver()
export class FeedResolver {
  constructor(private readonly feedService: FeedService) {}

  @Query(() => FeedConnection)
  @UseGuards(GqlAuthGuard)
  async homeFeed(@Args('input') input: FeedInput): Promise<FeedConnection> {
    return this.feedService.getFeed(input);
  }

  @Query(() => PostContact)
  @UseGuards(GqlAuthGuard)
  async postContact(@Args('postId') postId: string): Promise<PostContact> {
    return this.feedService.getPostContact(postId);
  }

  @Query(() => PlaybackResponse)
  @UseGuards(GqlAuthGuard)
  async playback(@Args('postId', { type: () => ID }) postId: string): Promise<PlaybackResponse> {
    return this.feedService.getPlayback(postId);
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createPost(
    @CurrentUser() user: any,
    @Args('type') type: PostType,
    @Args('caption', { nullable: true }) caption?: string,
    @Args('mediaUrl', { nullable: true }) mediaUrl?: string,
    @Args('thumbnailUrl', { nullable: true }) thumbnailUrl?: string,
    @Args('mediaType', { nullable: true }) mediaType?: MediaType,
    @Args('mediaAssetId', { nullable: true }) mediaAssetId?: string,
    @Args('productId', { nullable: true }) productId?: string,
    @Args('serviceId', { nullable: true }) serviceId?: string,
  ): Promise<string> {
    const post = await this.feedService.createPost({
      authorId: user.sub,
      type,
      caption,
      mediaUrl,
      thumbnailUrl,
      mediaType,
      mediaAssetId,
      productId,
      serviceId,
    });

    return post.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createProduct(
    @CurrentUser() user: any,
    @Args('name') name: string,
    @Args('price') price: number,
    @Args('unit') unit: string,
    @Args('category') category: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('location', { nullable: true }) location?: string,
    @Args('mediaUrl', { nullable: true }) mediaUrl?: string,
    @Args('thumbnailUrl', { nullable: true }) thumbnailUrl?: string,
    @Args('mediaType', { nullable: true }) mediaType?: MediaType,
    @Args('mediaAssetId', { nullable: true }) mediaAssetId?: string,
  ): Promise<string> {
    const product = await this.feedService.createProduct({
      name,
      description,
      price,
      unit,
      category,
      location,
      mediaUrl,
      thumbnailUrl,
      mediaType,
      mediaAssetId,
      sellerId: user.sub,
    });

    return product.id;
  }

  @Mutation(() => String)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createService(
    @CurrentUser() user: any,
    @Args('name') name: string,
    @Args('category') category: string,
    @Args('description', { nullable: true }) description?: string,
    @Args('location', { nullable: true }) location?: string,
    @Args('price', { nullable: true }) price?: string,
    @Args('availability', { nullable: true }) availability?: string,
    @Args('experience', { nullable: true }) experience?: string,
    @Args('mediaUrl', { nullable: true }) mediaUrl?: string,
    @Args('thumbnailUrl', { nullable: true }) thumbnailUrl?: string,
    @Args('mediaType', { nullable: true }) mediaType?: MediaType,
  ): Promise<string> {
    const service = await this.feedService.createService({
      name,
      description,
      category,
      location,
      price,
      availability,
      experience,
      mediaUrl,
      thumbnailUrl,
      mediaType,
      providerId: user.sub,
    });

    return service.id;
  }
}