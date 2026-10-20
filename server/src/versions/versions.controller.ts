import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VersionsService } from './versions.service';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';
import { ReplaceVersionDto } from './dto/replace-version.dto';
import { AppError } from '../common/errors/app-error';

/**
 * Version operations for a project. Upload uses multer (configured in the
 * module with DI-driven size limits) to stream the zip to a temp file; the
 * service does the rest.
 */
@Controller('api/v1/projects/:slug/versions')
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  publish(
    @Param('slug') slug: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateVersionDto,
  ) {
    if (!file) {
      throw AppError.validation('No file uploaded. Attach a .zip as the "file" field.');
    }
    return this.versions.publish(slug, file, dto);
  }

  @Put(':number')
  @UseInterceptors(FileInterceptor('file'))
  replace(
    @Param('slug') slug: string,
    @Param('number', ParseIntPipe) number: number,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ReplaceVersionDto,
  ) {
    if (!file) {
      throw AppError.validation('No file uploaded. Attach a .zip as the "file" field.');
    }
    return this.versions.replace(slug, number, file, dto);
  }

  @Patch(':number')
  update(
    @Param('slug') slug: string,
    @Param('number', ParseIntPipe) number: number,
    @Body() dto: UpdateVersionDto,
  ) {
    return this.versions.update(slug, number, dto);
  }

  @Post(':number/promote')
  promote(@Param('slug') slug: string, @Param('number', ParseIntPipe) number: number) {
    return this.versions.promote(slug, number);
  }

  @Delete(':number')
  remove(@Param('slug') slug: string, @Param('number', ParseIntPipe) number: number) {
    return this.versions.remove(slug, number);
  }
}
