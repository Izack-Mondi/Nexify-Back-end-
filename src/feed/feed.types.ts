import { Field, ObjectType, InputType, ID, registerEnumType, Int, Float } from '@nestjs/graphql';
import { Vertical } from '../common/vertical-assignment';
import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { MediaAssetKind } from '../media/media.types';

export enum PostType {
  GENERAL = 'GENERAL',
  MARKETPLACE = 'MARKETPLACE',
  SERVICE = 'SERVICE',
  OPPORTUNITY = 'OPPORTUNITY',
}

registerEnumType(PostType, {
  name: 'PostType',
});

registerEnumType(Vertical, {
  name: 'PostVertical',
});

export enum FeedTab {
  ALL = 'ALL',
  BUSINESS = 'BUSINESS',
  AGRICULTURE = 'AGRICULTURE',
  OPPORTUNITY = 'OPPORTUNITY',
}

registerEnumType(FeedTab, {
  name: 'FeedTab',
});

export enum MediaType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
}

registerEnumType(MediaType, {
  name: 'MediaType',
});

export enum PostStatus {
  PUBLISHED = 'PUBLISHED',
  PROCESSING = 'PROCESSING',
}

registerEnumType(PostStatus, {
  name: 'PostStatus',
});

@ObjectType()
export class PostAuthor {
  @Field(() => ID)
  id: string;

  @Field()
  fullName: string;

  @Field({ nullable: true })
  location?: string;

  @Field()
  isVerified: boolean;
}

@ObjectType()
export class PostContact {
  @Field(() => ID)
  id: string;

  @Field()
  fullName: string;

  @Field({ nullable: true })
  phoneNumber?: string;
}

@ObjectType()
export class PostMedia {
  @Field(() => MediaAssetKind)
  kind: MediaAssetKind;

  @Field()
  thumbnailUrl: string;

  @Field()
  previewUrl: string;

  @Field()
  blurhash: string;

  @Field(() => Float, { nullable: true })
  durationSec?: number;

  @Field(() => Int, { nullable: true })
  width?: number;

  @Field(() => Int, { nullable: true })
  height?: number;

  @Field()
  hasVideo: boolean;
}

@ObjectType()
export class PostServiceOffering {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  category: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => [String])
  skills: string[];

  @Field(() => Int)
  yearsExperience: number;

  @Field(() => Float, { nullable: true })
  startingPrice?: number;

  @Field({ nullable: true })
  priceUnit?: string;

  @Field({ nullable: true })
  county?: string;
}

@ObjectType()
export class PostProduct {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  price: number;

  @Field()
  unit: string;

  @Field()
  category: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field(() => MediaType)
  mediaType: MediaType;
}

@ObjectType()
export class PostService {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field()
  category: string;

  @Field({ nullable: true })
  location?: string;

  @Field({ nullable: true })
  price?: string;

  @Field({ nullable: true })
  availability?: string;

  @Field({ nullable: true })
  experience?: string;

  @Field({ nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field(() => MediaType)
  mediaType: MediaType;

  @Field()
  rating: number;

  @Field()
  reviews: number;
}

@ObjectType()
export class Post {
  @Field(() => ID)
  id: string;

  @Field(() => PostAuthor)
  author: PostAuthor;

  @Field(() => PostType)
  type: PostType;

  @Field(() => Vertical)
  vertical: Vertical;

  @Field({ nullable: true })
  caption?: string;

  @Field({ nullable: true })
  mediaUrl?: string;

  @Field({ nullable: true })
  thumbnailUrl?: string;

  @Field(() => MediaType)
  mediaType: MediaType;

  @Field({ nullable: true })
  media?: PostMedia;

  @Field({ nullable: true })
  offering?: PostServiceOffering;

  @Field({ nullable: true })
  product?: PostProduct;

  @Field({ nullable: true })
  service?: PostService;

  @Field(() => PostStatus)
  status: PostStatus;

  @Field(() => Int)
  likesCount: number;

  @Field(() => Int)
  commentsCount: number;

  @Field(() => Int)
  viewsCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;
}

@ObjectType()
export class PostEdge {
  @Field(() => Post)
  node: Post;

  @Field()
  cursor: string;
}

@ObjectType()
export class FeedConnection {
  @Field(() => [PostEdge])
  edges: PostEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}

@InputType()
export class FeedInput {
  @Field(() => Int, { nullable: true, defaultValue: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  first?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  after?: string;

  @Field(() => PostType, { nullable: true, description: 'Deprecated: Use tab instead' })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @Field(() => FeedTab, { nullable: true, defaultValue: FeedTab.ALL })
  @IsOptional()
  @IsEnum(FeedTab)
  tab?: FeedTab;
}

@ObjectType()
export class PlaybackResponse {
  @Field()
  postId: string;

  @Field()
  hlsUrl: string;

  @Field(() => Float)
  durationSec: number;

  @Field()
  expiresAt: Date;
}