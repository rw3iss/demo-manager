import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

/**
 * Admin CRUD for projects. Thin: validates input (DTOs + global ValidationPipe),
 * delegates to the service, returns plain data (the ResponseInterceptor wraps
 * it, the AllExceptionsFilter shapes errors).
 */
@Controller('api/v1/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  list() {
    return this.projects.list();
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projects.create(dto);
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.projects.detail(slug);
  }

  @Patch(':slug')
  update(@Param('slug') slug: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(slug, dto);
  }

  @Delete(':slug')
  async remove(@Param('slug') slug: string) {
    await this.projects.remove(slug);
    return { slug, deleted: true };
  }
}
