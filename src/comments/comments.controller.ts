import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { CommonService } from '@src/common/common.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('posts/:postId/comments')
export class PostCommentsController {
  constructor(private readonly commonService: CommonService) {}

  // 여러 컨트롤러에서 같은 데이터를 공유하려면 Service가 필요하다.
  // 지금은 임시로 static 배열을 사용한다.
  static comments = [
    {
      id: 1,
      postId: 1,
      content: '좋은 글이네요!',
      authorId: 1,
      createdAt: '2025-01-01',
    },
  ];
  static nextId = 2;

  /**
   * POST /posts/:postId/comments
   * 댓글 작성
   */
  @Post()
  create(
    @Param('postId') postId: string,
    @Body() createCommentDto: CreateCommentDto
  ) {
    const newComment = {
      ...createCommentDto,
      id: PostCommentsController.nextId++,
      postId: +postId,
      createdAt: this.commonService.formatDate(new Date()),
    };
    PostCommentsController.comments.push(newComment);
    return newComment;
  }

  /**
   * GET /posts/:postId/comments
   * 댓글 목록 조회
   */
  @Get()
  findAll(@Param('postId') postId: string) {
    return PostCommentsController.comments.filter((c) => c.postId === +postId);
  }
}

@Controller('comments')
export class CommentsController {
  /**
   * DELETE /comments/:id
   * 댓글 삭제
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    PostCommentsController.comments = PostCommentsController.comments.filter(
      (c) => c.id !== +id
    );
  }
}
