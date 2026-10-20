import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Metadata fields that accompany a zip upload (multipart text fields, so values
 * arrive as strings). The file itself comes via `@UploadedFile`, not here.
 */
export class CreateVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  /** "true"/"false" — whether to make the new version current. Defaults true. */
  @IsOptional()
  @IsString()
  promote?: string;
}
