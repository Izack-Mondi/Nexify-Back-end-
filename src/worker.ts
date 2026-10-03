import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';
import { Worker } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Worker');

  const redisConfig = {
    host: configService.get<string>('REDIS_HOST') || 'localhost',
    port: configService.get<number>('REDIS_PORT') || 6379,
  };

  const videoProcessingWorker = new Worker('video-processing', async (job) => {
    const videoProcessingJob = app.get('VideoProcessingJob');
    await videoProcessingJob.process(job);
  }, {
    connection: redisConfig,
    concurrency: 2,
  });

  videoProcessingWorker.on('completed', (job) => {
    logger.log(`Job ${job.id} completed`);
  });

  videoProcessingWorker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed: ${err.message}`);
  });

  logger.log('Video processing worker started');
}

bootstrap();
