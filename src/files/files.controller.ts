import {
  Controller,
  Get,
  ParseFilePipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service.js';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // Expects a multipart form with the file in a field named "file"
  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  upload(@UploadedFile(new ParseFilePipe()) file: Express.Multer.File) {
    return this.filesService.upload(file);
  }

  @Get()
  list() {
    return this.filesService.list();
  }

  @Get('link')
  createDownloadLink(@Query('key') key?: string) {
    return this.filesService.createDownloadLink(key);
  }
}
