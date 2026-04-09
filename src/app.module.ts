import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [UsersModule, PostsModule, CommentsModule, CommonModule],
})
export class AppModule {}
