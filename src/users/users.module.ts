import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersController } from './users.controller';
import { UsersController } from './users.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
