import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  /** New slug. If changed, the on-disk project dir is renamed (versions move with it). */
  @IsOptional()
  @IsString()
  @Length(1, 63)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  commentsEnabled?: boolean;

  @ValidateIf((o) => o.commentsEnabled === true)
  @IsString()
  @IsNotEmpty({ message: 'A PageLoop project id is required when comments are enabled.' })
  @MaxLength(200)
  pageloopProjectId?: string;
}
