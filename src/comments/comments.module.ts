import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import {
  CommentsController,
  PostCommentsController,
} from './comments.controller';
import { CommentsService } from './comments.service';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [CommonModule, UsersModule, PostsModule],
  controllers: [PostCommentsController, CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
