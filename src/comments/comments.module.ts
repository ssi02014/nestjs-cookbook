import { Module } from '@nestjs/common';
import { PostsModule } from '@/posts/posts.module';
import { UsersModule } from '@/users/users.module';
import { CommonModule } from '@/common/common.module';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [CommonModule, UsersModule, PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
