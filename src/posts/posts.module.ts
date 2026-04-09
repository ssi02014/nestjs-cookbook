import { Module } from '@nestjs/common';
import { CommonModule } from '@/common/common.module';
import { UsersModule } from '@/users/users.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [CommonModule, UsersModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
