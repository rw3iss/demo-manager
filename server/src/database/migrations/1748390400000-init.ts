import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial schema: project + version. `current_version_id` is intentionally not
 * a FK (avoids a cyclic constraint with version.project_id); integrity is kept
 * in the service layer. Timestamps are bigint epoch seconds.
 */
export class Init1748390400000 implements MigrationInterface {
  name = 'Init1748390400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "project" (
        "id"                 uuid          NOT NULL,
        "slug"               varchar(63)   NOT NULL,
        "name"               varchar(200)  NOT NULL,
        "description"        text          NULL,
        "enabled"            boolean       NOT NULL DEFAULT true,
        "current_version_id" uuid          NULL,
        "created_at"         bigint        NOT NULL,
        "updated_at"         bigint        NOT NULL,
        CONSTRAINT "pk_project" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "uq_project_slug" ON "project" ("slug")`);

    await queryRunner.query(`
      CREATE TABLE "version" (
        "id"          uuid          NOT NULL,
        "project_id"  uuid          NOT NULL,
        "number"      int           NOT NULL,
        "name"        varchar(200)  NULL,
        "enabled"     boolean       NOT NULL DEFAULT true,
        "size_bytes"  bigint        NOT NULL DEFAULT 0,
        "file_count"  int           NOT NULL DEFAULT 0,
        "created_at"  bigint        NOT NULL,
        "updated_at"  bigint        NOT NULL,
        CONSTRAINT "pk_version" PRIMARY KEY ("id"),
        CONSTRAINT "uq_version_project_number" UNIQUE ("project_id", "number"),
        CONSTRAINT "fk_version_project" FOREIGN KEY ("project_id")
          REFERENCES "project" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_version_project" ON "version" ("project_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "version"`);
    await queryRunner.query(`DROP TABLE "project"`);
  }
}
