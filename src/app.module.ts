import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AaveMarketStatusEntity } from './aave/entities/aave-market-status.entity';
import { AaveMarketEntity } from './aave/entities/aave-market.entity';
import { AccountEntity } from './aave/entities/accounts.entity';
import { AaveModule } from './aave/aave.module';
import { EthereumModule } from './ethereum/ethereum.module';
import { CoingeckoModule } from './coingecko/coingecko.module';
import { QuestdbModule } from './questdb/questdb.module';
import { HistoricalPriceDataModule } from './historical-price-data/historical-price-data.module';
import { CronModule } from './cron/cron.module';
import { UserEntity } from './ethereum/entities/users.entity';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './ethereum/guards/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST'),
        port: configService.get<number>('DATABASE_PORT'),
        username: configService.get<string>('DATABASE_USERNAME'),
        password: configService.get<string>('DATABASE_PASSWORD'),
        database: configService.get<string>('DATABASE_NAME'),
        synchronize: true,
        entities: [
          AccountEntity,
          AaveMarketEntity,
          AaveMarketStatusEntity,
          UserEntity,
        ],
        logging: true,
      }),
      inject: [ConfigService],
    }),
    EthereumModule,
    AaveModule,
    CoingeckoModule,
    QuestdbModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        host: configService.get<string>('QUESTDB_HOST', 'localhost'),
        pgPort: configService.get<number>('QUESTDB_PG_PORT', 8812),
        username: configService.get<string>('QUESTDB_USERNAME', 'admin'),
        password: configService.get<string>('QUESTDB_PASSWORD', 'quest'),
      }),
      inject: [ConfigService],
    }),
    HistoricalPriceDataModule,
    CronModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {
  constructor(private dataSource: DataSource) {}
}
