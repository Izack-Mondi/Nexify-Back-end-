import { Field, ObjectType, InputType, ID, registerEnumType, Int, Float } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsInt, IsEnum, IsOptional, Max, Min } from 'class-validator';

export enum MediaAssetKind {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
}

registerEnumType(MediaAssetKind, {
  name: 'MediaAssetKind',
});

export enum MediaAssetStatus {
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  REJECTED = 'REJECTED',
}

registerEnumType(MediaAssetStatus, {
  name: 'MediaAssetStatus',
});

@ObjectType()
export class MediaAsset {
  @Field(() => ID)
  id: string;

  @Field(() => MediaAssetKind)
  kind: MediaAssetKind;

  @Field(() => MediaAssetStatus)
  status: MediaAssetStatus;

  @Field({ nullable: true })
  rejectionReason?: string;

  @Field()
  mimeType: string;

  @Field(() => Int)
  sizeBytes: number;

  @Field(() => Float, { nullable: true })
  durationSec?: number;

  @Field(() => Int, { nullable: true })
  width?: number;

  @Field(() => Int, { nullable: true })
  height?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@InputType()
export class RequestVideoUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  contentType: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

@ObjectType()
export class UploadUrlResponse {
  @Field(() => ID)
  assetId: string;

  @Field()
  uploadUrl: string;

  @Field()
  expiresAt: Date;

  @Field(() => Int)
  maxSizeBytes: number;

  @Field(() => Int)
  maxDurationSec: number;
}

@InputType()
export class RequestImageUploadInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  contentType: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  sizeBytes: number;
}

@InputType()
export class CompleteUploadInput {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  assetId: string;
}
