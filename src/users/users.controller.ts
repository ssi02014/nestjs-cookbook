import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { CommonService } from '@src/common/common.service';

@Controller('users')
export class UsersController {
  constructor(private readonly commonService: CommonService) {}

  private users = [
    {
      id: 1,
      email: 'hong@example.com',
      name: '홍길동',
      createdAt: '2025-01-01',
    },
  ];
  private nextId = 2;

  /**
   * POST /users
   * 회원가입
   */
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    const now = this.commonService.formatDate(new Date());

    const newUser = {
      id: this.nextId++,
      email: createUserDto.email,
      name: createUserDto.name,
      createdAt: now,
    };
    this.users.push(newUser);
    return newUser;
  }

  /**
   * GET /users/:id
   * 프로필 조회
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    const user = this.users.find((u) => u.id === +id);
    if (!user) {
      return { message: `User #${id}를 찾을 수 없습니다` };
    }
    return user;
  }
}
