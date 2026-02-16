import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { CoingeckoService } from './coingecko.service';
import { CoingeckoController } from './coingecko.controller';

@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const socketPath = configService.get<string>('REDIS_SOCKET_PATH');
        const socketConfig = socketPath
          ? { path: socketPath }
          : {
              host: configService.get<string>('REDIS_HOST', 'localhost'),
              port: configService.get<number>('REDIS_PORT', 6379),
            };

        return {
          store: await redisStore({
            socket: socketConfig,
            ttl: configService.get<number>('COINGECKO_CACHE_TTL', 24 * 60 * 60 * 1000),
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [CoingeckoService],
  controllers: [CoingeckoController],
  exports: [CoingeckoService],
})
export class CoingeckoModule {}
