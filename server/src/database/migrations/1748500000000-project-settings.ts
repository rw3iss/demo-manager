import { MigrationInterface, QueryRunner } from 'typeorm';

/** Add an arbitrary-settings jsonb column to project (comments/PageLoop, etc.). */
export class ProjectSettings1748500000000 implements MigrationInterface {
  name = 'ProjectSettings1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "settings" jsonb NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "project" DROP COLUMN IF EXISTS "settings"`);
  }
}
