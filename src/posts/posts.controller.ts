import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { CommonService } from '@src/common/common.service';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly commonService: CommonService) {}

  private posts = [
    {
      id: 1,
      title: 'First Post',
      content: 'NestJS를 배우기 시작했습니다!',
      authorId: 1,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    },
    {
      id: 2,
      title: 'Second Post',
      content: 'NestJS를 배우기 시작했습니다! 두 번째 게시글',
      authorId: 2,
      createdAt: '2025-01-02',
      updatedAt: '2025-01-02',
    },
  ];
  private nextId = 3;

  /**
   * GET /posts?page=1&limit=10&search=nest
   * 게시글 목록 조회 (페이지네이션, 검색)
   */
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string
  ) {
    let result = this.posts;

    if (search) {
      result = result.filter((post) => post.title.includes(search));
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 10;
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;

    return {
      data: result.slice(start, end),
      total: result.length,
      page: pageNum,
      limit: limitNum,
    };
  }

  /**
   * GET /posts/:id
   * 게시글 상세 조회
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    const post = this.posts.find((post) => post.id === +id);

    if (!post) {
      return { message: `Post #${id}를 찾을 수 없습니다` };
    }

    return post;
  }

  /**
   * POST /posts
   * 게시글 작성
   */
  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    const now = this.commonService.formatDate(new Date());
    const newPost = {
      ...createPostDto,
      id: this.nextId++,
      createdAt: now,
      updatedAt: now,
    };
    this.posts.push(newPost);
    return newPost;
  }

  /**
   * PATCH /posts/:id
   * 게시글 수정
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    const index = this.posts.findIndex((post) => post.id === +id);

    if (index === -1) {
      return { message: `Post #${id}를 찾을 수 없습니다` };
    }

    const now = this.commonService.formatDate(new Date());
    this.posts[index] = {
      ...this.posts[index],
      ...updatePostDto,
      updatedAt: now,
    };
    return this.posts[index];
  }

  /**
   * DELETE /posts/:id
   * 게시글 삭제
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.posts = this.posts.filter((p) => p.id !== +id);
  }
}
