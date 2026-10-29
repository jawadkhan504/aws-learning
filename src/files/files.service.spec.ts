import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { FilesService, LINK_EXPIRES_IN_SECONDS } from './files.service.js';

describe('FilesService', () => {
  let s3: S3Client;
  let send: ReturnType<typeof vi.fn>;
  let service: FilesService;

  beforeEach(() => {
    process.env.S3_BUCKET = 'test-bucket';
    // Fake credentials: presigning works offline, and every network call goes to the mock
    s3 = new S3Client({
      region: 'ap-southeast-2',
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });
    send = vi.fn().mockResolvedValue({});
    s3.send = send as unknown as S3Client['send'];
    service = new FilesService(s3);
  });

  afterEach(() => {
    delete process.env.S3_BUCKET;
  });

  describe('upload', () => {
    it('stores the file under uploads/ with a unique, safe key', async () => {
      const file = {
        originalname: 'my photo (1).png',
        mimetype: 'image/png',
        buffer: Buffer.from('fake image'),
      } as Express.Multer.File;

      const { key } = await service.upload(file);

      expect(key).toMatch(/^uploads\/[0-9a-f-]{36}-my_photo__1_\.png$/);
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Key: key,
        ContentType: 'image/png',
      });
    });

    it('fails clearly when S3_BUCKET is not set', async () => {
      delete process.env.S3_BUCKET;

      await expect(
        service.upload({ originalname: 'a.txt' } as Express.Multer.File),
      ).rejects.toThrow('S3_BUCKET is not set');
    });
  });

  describe('list', () => {
    it('only lists files under uploads/', async () => {
      send.mockResolvedValue({
        Contents: [{ Key: 'uploads/abc-a.txt', Size: 5 }],
      });

      const files = await service.list();

      const command = send.mock.calls[0][0] as ListObjectsV2Command;
      expect(command.input).toMatchObject({
        Bucket: 'test-bucket',
        Prefix: 'uploads/',
      });
      expect(files).toEqual([
        { key: 'uploads/abc-a.txt', size: 5, lastModified: undefined },
      ]);
    });
  });

  describe('createDownloadLink', () => {
    it('returns a temporary signed link for an uploaded file', async () => {
      const link = await service.createDownloadLink('uploads/abc-a.txt');

      expect(send.mock.calls[0][0]).toBeInstanceOf(HeadObjectCommand);
      expect(link.expiresInSeconds).toBe(LINK_EXPIRES_IN_SECONDS);
      expect(link.url).toContain('test-bucket');
      expect(link.url).toContain('uploads/abc-a.txt');
      expect(link.url).toContain('X-Amz-Signature=');
      expect(link.url).toContain(`X-Amz-Expires=${LINK_EXPIRES_IN_SECONDS}`);
    });

    it.each([undefined, '', 'diary.txt', 'public/hello.txt'])(
      'refuses keys outside uploads/ (%s)',
      async (key) => {
        await expect(service.createDownloadLink(key)).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(send).not.toHaveBeenCalled();
      },
    );

    it('returns 404 when the file does not exist', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('NotFound'), { name: 'NotFound' }),
      );

      await expect(
        service.createDownloadLink('uploads/missing.txt'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
