import { Module, DynamicModule, Global } from '@nestjs/common';
import { QuestdbService } from './questdb.service';
import { QuestdbController } from './questdb.controller';
import { QUESTDB_OPTIONS } from './questdb.constants';

export interface QuestdbModuleOptions {
  host: string;
  pgPort: number;
  username?: string;
  password?: string;
}

export interface QuestdbModuleAsyncOptions {
  imports?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<QuestdbModuleOptions> | QuestdbModuleOptions;
  inject?: any[];
}

@Global()
@Module({})
export class QuestdbModule {
  static forRoot(options: QuestdbModuleOptions): DynamicModule {
    return {
      module: QuestdbModule,
      providers: [
        {
          provide: QUESTDB_OPTIONS,
          useValue: options,
        },
        QuestdbService,
      ],
      controllers: [QuestdbController],
      exports: [QuestdbService],
    };
  }

  static forRootAsync(options: QuestdbModuleAsyncOptions): DynamicModule {
    return {
      module: QuestdbModule,
      imports: options.imports || [],
      providers: [
        {
          provide: QUESTDB_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        QuestdbService,
      ],
      controllers: [QuestdbController],
      exports: [QuestdbService],
    };
  }
}
