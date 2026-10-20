import { IsOptional, IsString } from 'class-validator';

/**
 * Fields for replacing a version's files (multipart). The zip arrives via
 * `@UploadedFile`; `promote` ("true"/"false") optionally makes it current.
 * Replace never changes the version's name.
 */
export class ReplaceVersionDto {
  @IsOptional()
  @IsString()
  promote?: string;
}
