import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

@Module({
  controllers: [FilesController],
  providers: [
    FilesService,
    // Region and credentials come from the environment (CloudShell, an EC2 role, etc.)
    { provide: S3Client, useFactory: () => new S3Client({}) },
  ],
})
export class FilesModule {}
