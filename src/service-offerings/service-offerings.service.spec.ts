import { UnauthorizedException } from '@nestjs/common';
import { ServiceOfferingsService } from './service-offerings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ServiceOfferingsService', () => {
  let service: ServiceOfferingsService;
  let prisma: any;
  let transaction: any;

  beforeEach(() => {
    transaction = {
      serviceOffering: { create: jest.fn().mockResolvedValue({ id: 'offering-1' }) },
      post: { create: jest.fn().mockResolvedValue({ id: 'post-1' }) },
    };
    prisma = {
      mediaAsset: { findUnique: jest.fn() },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    service = new ServiceOfferingsService(prisma as PrismaService);
  });

  it('creates an agriculture service offering and its feed post atomically', async () => {
    const result = await service.createServiceOffering('provider-1', {
      title: 'Irrigation installation',
      category: 'irrigation',
      skills: ['Drip systems'],
      yearsExperience: 4,
      county: 'Nairobi',
    });

    expect(result).toEqual({ offeringId: 'offering-1', postId: 'post-1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ vertical: 'AGRICULTURE', offeringId: 'offering-1' }),
    });
  });

  it('rejects a demo asset owned by another user', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-a',
      kind: 'VIDEO',
      status: 'READY',
    });

    await expect(service.createServiceOffering('user-b', {
      title: 'Photography',
      category: 'photography',
      skills: [],
      yearsExperience: 0,
      demoAssetId: 'asset-1',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows a processing video asset and creates a post that remains feed-hidden', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'provider-1',
      kind: 'VIDEO',
      status: 'PROCESSING',
    });

    await service.createServiceOffering('provider-1', {
      title: 'Photography',
      category: 'photography',
      skills: [],
      yearsExperience: 2,
      demoAssetId: 'asset-1',
    });

    expect(transaction.post.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ mediaAssetId: 'asset-1', vertical: 'BUSINESS' }),
    });
  });
});