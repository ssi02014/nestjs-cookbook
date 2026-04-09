import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, UsersModule, PostsModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
