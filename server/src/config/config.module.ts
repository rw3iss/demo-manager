import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './configuration';
import { envValidationSchema } from './env.validation';
import { AppConfigService } from './app-config.service';

/**
 * Global config module: validates env at boot (Joi), exposes the typed
 * {@link AppConfigService} everywhere. `load` namespaces the resolved config
 * under the `config` key so AppConfigService can hydrate a fully-typed view.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', `.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      load: [() => ({ config: configuration() })],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
