import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Everything this app uploads lives under this prefix ("folder") in the bucket
export const UPLOAD_PREFIX = 'uploads/';
export const LINK_EXPIRES_IN_SECONDS = 300;

export interface StoredFile {
  key: string;
  size: number;
  lastModified?: Date;
}

@Injectable()
export class FilesService {
  constructor(private readonly s3: S3Client) {}

  async upload(file: Express.Multer.File): Promise<{ key: string }> {
    // A random ID in front keeps two uploads with the same name from overwriting each other
    const key = `${UPLOAD_PREFIX}${randomUUID()}-${safeFileName(file.originalname)}`;
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    return { key };
  }

  async list(): Promise<StoredFile[]> {
    const result = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: UPLOAD_PREFIX }),
    );
    return (result.Contents ?? []).map((object) => ({
      key: object.Key ?? '',
      size: object.Size ?? 0,
      lastModified: object.LastModified,
    }));
  }

  async createDownloadLink(
    key: string | undefined,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    // Only hand out links for files this app uploaded, never anything else in the bucket
    if (!key?.startsWith(UPLOAD_PREFIX)) {
      throw new BadRequestException(`key must start with "${UPLOAD_PREFIX}"`);
    }

    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        throw new NotFoundException(`No file with key "${key}"`);
      }
      throw error;
    }

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: LINK_EXPIRES_IN_SECONDS },
    );
    return { url, expiresInSeconds: LINK_EXPIRES_IN_SECONDS };
  }

  // Read lazily so the rest of the app (e.g. /health) still starts without S3 configured
  private get bucket(): string {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new InternalServerErrorException('S3_BUCKET is not set');
    }
    return bucket;
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.-]/g, '_').slice(-100) || 'file';
}
