# NestJS 데코레이터 레퍼런스

이 문서는 NestJS에서 사용하는 데코레이터를 **독립적으로** 이해할 수 있도록 작성된 참고 문서입니다.
각 데코레이터마다 무엇인지, 왜 쓰는지, 어떻게 쓰는지를 설명합니다.

---

## 목차

1. [모듈 데코레이터](#1-모듈-데코레이터)
2. [컨트롤러 & 라우팅 데코레이터](#2-컨트롤러-라우팅-데코레이터)
3. [요청 데이터 추출 데코레이터](#3-요청-데이터-추출-데코레이터)
4. [응답 제어 데코레이터](#4-응답-제어-데코레이터)
5. [Provider 데코레이터](#5-provider-데코레이터)
6. [Guard / Pipe / Filter / Interceptor 바인딩 데코레이터](#6-guard-pipe-filter-interceptor-바인딩-데코레이터)
7. [TypeORM Entity 데코레이터](#7-typeorm-entity-데코레이터)
8. [Swagger 데코레이터](#8-swagger-데코레이터)
9. [커스텀 데코레이터 생성 함수](#9-커스텀-데코레이터-생성-함수)
10. [데코레이터 적용 범위 정리 표](#10-데코레이터-적용-범위-정리-표)
11. [자주 묻는 질문 FAQ](#11-자주-묻는-질문-faq)

---

## 데코레이터란?

TypeScript의 데코레이터(`@`)는 클래스, 메서드, 프로퍼티, 파라미터에 **추가 정보(메타데이터)를 붙이거나 동작을 변경**하는 문법입니다.

NestJS는 데코레이터를 적극적으로 활용하여, 개발자가 클래스와 메서드에 `@Controller()`, `@Get()`, `@Injectable()` 등을 붙이는 것만으로 라우팅, DI, 미들웨어 연결 등의 복잡한 설정을 자동으로 처리합니다.

데코레이터 없이 Express를 직접 쓴다면 아래처럼 라우터를 일일이 등록해야 합니다:

```typescript
// Express 방식 — 수동 등록
app.get('/posts', postsController.findAll);
app.post('/posts', postsController.create);
```

NestJS 데코레이터 방식은 클래스 자체에 의미를 부여하므로 코드가 선언적이고 읽기 쉽습니다:

```typescript
// NestJS 방식 — 선언적
@Controller('posts')
export class PostsController {
  @Get()
  findAll() {}

  @Post()
  create() {}
}
```

---

## 1. 모듈 데코레이터

### `@Module(options)`

**무엇인가:** 클래스를 NestJS **모듈**로 선언하는 데코레이터입니다. 모듈은 NestJS 애플리케이션을 구성하는 기본 단위로, 관련된 컨트롤러·서비스·설정을 하나로 묶습니다.

**왜 쓰는가:** 애플리케이션이 커질수록 모든 코드를 하나의 파일에 몰아넣으면 관리가 어렵습니다. 모듈로 나누면 각 기능(게시글, 사용자, 인증 등)을 독립적으로 개발하고 테스트할 수 있고, 필요한 부분만 다른 모듈에서 가져다 쓸 수 있습니다.

**사용법:**

| 속성 | 타입 | 설명 |
|------|------|------|
| `imports` | `Module[]` | 이 모듈에서 사용할 외부 모듈. 다른 모듈이 `exports`로 공개한 프로바이더를 사용하려면 반드시 여기에 등록해야 합니다. |
| `controllers` | `Controller[]` | 이 모듈에 속하는 컨트롤러. NestJS가 라우트로 인식합니다. |
| `providers` | `Provider[]` | 이 모듈 내에서 DI로 주입할 수 있는 서비스·팩토리·값 등입니다. |
| `exports` | `Provider[]` | 다른 모듈이 `imports`로 가져갔을 때 사용할 수 있게 공개할 프로바이더입니다. 기본적으로 프로바이더는 모듈 밖에서 접근 불가입니다. |

**예제 코드:**

```typescript
// posts.module.ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { AuthModule } from '../auth/auth.module'; // AuthModule의 exports를 사용하기 위해

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]), // TypeORM 모듈 등록
    AuthModule,                        // AuthModule이 exports한 서비스 사용 가능
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService], // 이 모듈을 imports한 다른 모듈에서 PostsService를 주입 가능
})
export class PostsModule {}

// app.module.ts — 루트 모듈
@Module({
  imports: [PostsModule, UsersModule, AuthModule],
})
export class AppModule {}
```

> **팁:** `exports`에 등록하지 않은 프로바이더는 해당 모듈 안에서만 사용할 수 있습니다. 다른 모듈에서 `imports`로 가져왔더라도 `exports`에 없으면 주입할 수 없습니다.

---

### `@Global()`

**무엇인가:** 모듈을 **전역 모듈**로 등록하는 데코레이터입니다. 전역 모듈은 다른 모듈이 `imports`에 명시하지 않아도 해당 모듈이 `exports`한 프로바이더를 바로 주입받을 수 있습니다.

**왜 쓰는가:** `ConfigService`, `LoggerService`처럼 애플리케이션 전반에서 공통으로 사용하는 서비스를 매번 `imports`에 추가하는 것은 번거롭습니다. `@Global()`을 붙이면 한 번만 등록해도 어디서나 사용할 수 있습니다.

**예제 코드:**

```typescript
// config.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Global()  // 전역 모듈로 선언
@Module({
  providers: [ConfigService],
  exports: [ConfigService], // exports는 여전히 필요합니다
})
export class ConfigModule {}

// app.module.ts — 루트에 한 번만 등록
@Module({
  imports: [ConfigModule], // 한 번만 등록하면 전체에서 사용 가능
})
export class AppModule {}

// posts.service.ts — imports 없이 바로 주입 가능
@Injectable()
export class PostsService {
  constructor(private readonly configService: ConfigService) {} // 그냥 주입됨
}
```

> **주의:** `@Global()`은 남용하면 모듈 간 의존 관계가 불명확해져 유지보수가 어려워집니다. 정말로 전역에서 필요한 서비스(설정, 로거 등)에만 사용하세요. 일반 비즈니스 서비스는 `imports`를 통해 명시적으로 의존 관계를 드러내는 것이 좋습니다.

---

## 2. 컨트롤러 & 라우팅 데코레이터

### `@Controller(prefix?)`

**무엇인가:** 클래스를 **컨트롤러**로 선언하는 데코레이터입니다. 컨트롤러는 클라이언트의 HTTP 요청을 받아 적절한 서비스를 호출하고 응답을 반환하는 역할을 합니다.

**왜 쓰는가:** NestJS가 이 클래스를 라우터로 인식하도록 알려줍니다. `prefix`를 지정하면 해당 컨트롤러의 모든 라우트에 공통 경로 접두사가 붙어 코드 중복을 줄입니다.

**사용법:**

| 옵션 | 설명 |
|------|------|
| `prefix` (문자열) | 이 컨트롤러의 모든 라우트에 붙는 URL 접두사. 생략하면 루트(`/`)가 됩니다. |
| `host` (문자열/배열) | 특정 호스트에서만 이 컨트롤러가 동작하도록 제한합니다. |

**예제 코드:**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('posts')         // 모든 라우트가 /posts/... 형태
export class PostsController {
  @Get()          // GET /posts
  findAll() {}

  @Get(':id')     // GET /posts/:id
  findOne() {}
}

@Controller('api/v1/posts')  // 중첩 경로: /api/v1/posts/...
export class PostsV1Controller {}

@Controller()    // 접두사 없음: / 루트
export class AppController {}
```

> **팁:** 버전 관리가 필요하다면 `'api/v1/posts'`처럼 직접 경로에 포함하거나, NestJS의 `Versioning` 기능을 활용하세요.

---

### HTTP 메서드 데코레이터

`@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, `@All()`

**무엇인가:** 메서드에 특정 HTTP 메서드와 경로를 매핑하는 **라우트 데코레이터**입니다.

**왜 쓰는가:** REST API 설계에서 각 HTTP 메서드는 고유한 의미를 가집니다. 적절한 메서드를 사용해야 API 소비자가 의도를 명확히 이해할 수 있습니다.

**각 HTTP 메서드의 의미와 사용 맥락:**

| 데코레이터 | HTTP 메서드 | 의미 | 주요 사용 시 |
|------------|-------------|------|-------------|
| `@Get(path?)` | GET | 리소스 **조회** | 목록 조회, 상세 조회 |
| `@Post(path?)` | POST | 리소스 **생성** | 새 데이터 등록 |
| `@Put(path?)` | PUT | 리소스 **전체 교체** | 전체 필드를 새 값으로 교체 |
| `@Patch(path?)` | PATCH | 리소스 **부분 수정** | 일부 필드만 변경 |
| `@Delete(path?)` | DELETE | 리소스 **삭제** | 데이터 삭제 |
| `@All(path?)` | 모든 메서드 | **모든 HTTP 메서드** 처리 | 메서드 무관 공통 처리 |

**예제 코드:**

```typescript
import { Controller, Get, Post, Put, Patch, Delete, All } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get()              // GET /posts — 게시글 목록
  findAll() {}

  @Get(':id')         // GET /posts/123 — 게시글 상세
  findOne() {}

  @Post()             // POST /posts — 게시글 생성
  create() {}

  @Put(':id')         // PUT /posts/123 — 게시글 전체 교체
  replace() {}

  @Patch(':id')       // PATCH /posts/123 — 게시글 일부 수정
  update() {}

  @Delete(':id')      // DELETE /posts/123 — 게시글 삭제
  remove() {}

  @All('health')      // 모든 메서드로 /posts/health 처리
  healthCheck() {}
}
```

**와일드카드 라우트 패턴:**

경로에 특수 문자를 사용하면 유연한 라우트 매칭이 가능합니다.

| 패턴 | 설명 | 매칭 예시 |
|------|------|-----------|
| `*` | 0개 이상의 임의 문자열 | `'ab*cd'` → `abcd`, `ab123cd`, `ab_cd` |
| `?` | 0개 또는 1개의 임의 문자 | `'ab?cd'` → `abcd`, `abecd` |
| `+` | 1개 이상의 임의 문자열 | `'ab+cd'` → `abecd`, `ab123cd` |

```typescript
@Get('ab*cd')     // /abcd, /ab123cd, /ab_cd 모두 매칭
findWildcard() {}

@Get('file?.txt') // /file.txt, /filea.txt 매칭
findFile() {}
```

> **주의:** 와일드카드 라우트는 구체적인 경로보다 **나중에** 선언해야 합니다. NestJS는 선언 순서대로 라우트를 매칭하므로, 와일드카드가 먼저 오면 구체적인 경로가 가려질 수 있습니다.

---

## 3. 요청 데이터 추출 데코레이터

### `@Param(key?)`

**무엇인가:** URL 경로에 포함된 **동적 파라미터**를 추출하는 데코레이터입니다.

**왜 쓰는가:** `/posts/123`처럼 URL 경로에 식별자가 포함된 경우, 해당 값을 메서드 파라미터로 받아야 합니다. `@Param()`이 없으면 `req.params`를 직접 파싱해야 합니다.

> **URL 파라미터 vs 쿼리스트링 차이:**
> - URL 파라미터(`@Param`): 경로의 일부. `/posts/:id`에서 `:id`에 해당. 특정 리소스 식별에 사용.
> - 쿼리스트링(`@Query`): `?` 뒤의 값. `/posts?page=2&limit=10`에서 `page`, `limit`. 필터링·페이지네이션에 사용.

**사용법:**

| 형태 | 설명 |
|------|------|
| `@Param()` | 모든 파라미터를 객체로 반환 (`{ id: '123', slug: 'hello' }`) |
| `@Param('key')` | 특정 파라미터 값만 문자열로 반환 |

**예제 코드:**

```typescript
import { Controller, Get, Param } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  // 단일 파라미터
  @Get(':id')
  findOne(@Param('id') id: string) {
    // GET /posts/123 → id = '123'
    return { id };
  }

  // 여러 파라미터
  @Get(':categoryId/posts/:postId')
  findInCategory(
    @Param('categoryId') categoryId: string,
    @Param('postId') postId: string,
  ) {
    // GET /tech/posts/42 → categoryId = 'tech', postId = '42'
  }

  // 파라미터 전체를 객체로
  @Get(':id/comments/:commentId')
  findComment(@Param() params: { id: string; commentId: string }) {
    console.log(params); // { id: '1', commentId: '5' }
  }
}
```

> **주의:** URL 파라미터로 받은 값은 항상 **문자열**입니다. 숫자가 필요하면 `+id` 또는 `Number(id)`로 변환하거나, `ParseIntPipe`를 사용하세요.
> ```typescript
> @Get(':id')
> findOne(@Param('id', ParseIntPipe) id: number) {}
> ```

---

### `@Query(key?)`

**무엇인가:** URL의 쿼리스트링(`?key=value`) 값을 추출하는 데코레이터입니다.

**왜 쓰는가:** 검색, 필터링, 페이지네이션처럼 리소스 자체가 아닌 **조회 조건**을 전달할 때 쿼리스트링을 씁니다. `@Query()`로 손쉽게 값을 추출할 수 있습니다.

**사용법:**

| 형태 | 설명 |
|------|------|
| `@Query()` | 전체 쿼리 객체 반환 (`{ page: '1', limit: '10' }`) |
| `@Query('key')` | 특정 키의 값만 문자열로 반환 |

**예제 코드:**

```typescript
import { Controller, Get, Query } from '@nestjs/common';

// 페이지네이션용 DTO
class PaginationQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  order?: 'ASC' | 'DESC';
}

@Controller('posts')
export class PostsController {
  // 개별 쿼리 파라미터
  @Get()
  findAll(
    @Query('page') page: string,     // ?page=1
    @Query('limit') limit: string,   // ?limit=10
    @Query('search') search: string, // ?search=nestjs
  ) {
    // GET /posts?page=1&limit=10&search=nestjs
  }

  // DTO 객체로 한번에 받기 (권장)
  @Get('search')
  search(@Query() query: PaginationQueryDto) {
    // GET /posts/search?page=2&limit=20&order=DESC
    const { page, limit, search, order } = query;
  }
}
```

> **팁:** 쿼리스트링 값도 기본적으로 **문자열**입니다. `ValidationPipe`와 `class-transformer`의 `@Type(() => Number)`를 함께 사용하면 자동으로 타입 변환이 됩니다.

---

### `@Body(key?)`

**무엇인가:** POST, PUT, PATCH 요청의 **본문(JSON 데이터)**을 추출하는 데코레이터입니다.

**왜 쓰는가:** 클라이언트가 서버로 새 데이터를 생성하거나 수정할 때, URL에 담을 수 없는 복잡한 구조의 데이터를 요청 본문(body)에 담아 전송합니다. `@Body()`를 사용해야 이 데이터를 편리하게 꺼낼 수 있습니다.

**사용법:**

| 형태 | 설명 |
|------|------|
| `@Body()` | 전체 본문 객체 반환 |
| `@Body('key')` | 특정 필드만 추출 |

**예제 코드:**

```typescript
import { Controller, Post, Put, Patch, Body } from '@nestjs/common';

// DTO (Data Transfer Object) — 들어오는 데이터의 형태를 정의
class CreatePostDto {
  title: string;
  content: string;
  tags?: string[];
}

class UpdatePostDto {
  title?: string;
  content?: string;
}

@Controller('posts')
export class PostsController {
  // 전체 본문을 DTO로 받기 (권장)
  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    // 요청 본문: { "title": "안녕", "content": "내용", "tags": ["nest"] }
    console.log(createPostDto.title);
  }

  // 특정 필드만 추출
  @Post('title-only')
  createTitle(@Body('title') title: string) {
    // 요청 본문에서 title 필드만 추출
  }

  // PUT: 전체 교체
  @Put(':id')
  replace(@Body() dto: CreatePostDto) {}

  // PATCH: 부분 수정
  @Patch(':id')
  update(@Body() dto: UpdatePostDto) {}
}
```

> **팁:** `@Body()`와 `ValidationPipe`를 함께 사용하면 들어온 데이터의 유효성을 자동 검사할 수 있습니다.
> ```typescript
> // main.ts에서 전역 설정
> app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
> ```

---

### `@Headers(key?)`

**무엇인가:** HTTP 요청의 **헤더 값**을 추출하는 데코레이터입니다.

**왜 쓰는가:** 인증 토큰(`Authorization`), 컨텐츠 타입(`Content-Type`), 사용자 에이전트(`User-Agent`) 등 헤더에 담긴 정보를 메서드에서 바로 사용할 때 씁니다.

**예제 코드:**

```typescript
import { Controller, Get, Post, Headers } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  // 특정 헤더만 추출
  @Get()
  findAll(@Headers('authorization') authorization: string) {
    // 헤더: Authorization: Bearer eyJhbGci...
    console.log(authorization); // 'Bearer eyJhbGci...'
  }

  // 전체 헤더 객체
  @Post()
  create(@Headers() headers: Record<string, string>) {
    const contentType = headers['content-type'];
    const userAgent = headers['user-agent'];
  }
}
```

> **팁:** 인증 처리에는 `@Headers('authorization')`를 직접 쓰기보다 **Guard**를 활용하는 것이 더 적합합니다. Guard는 요청이 컨트롤러에 도달하기 전에 인증을 검사합니다.

---

### `@Req()` / `@Res()`

**무엇인가:** Express(또는 Fastify)의 **원본 Request/Response 객체**에 직접 접근하는 데코레이터입니다.

**왜 쓰는가:** NestJS 추상화로 해결할 수 없는 저수준 HTTP 작업이 필요할 때 사용합니다. 예를 들어, `req.rawBody`에 접근하거나 스트리밍 응답을 직접 제어할 때입니다.

**예제 코드:**

```typescript
import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('posts')
export class PostsController {
  @Get()
  findAll(@Req() req: Request) {
    console.log(req.headers);       // 전체 헤더
    console.log(req.ip);            // 클라이언트 IP
    console.log(req.method);        // HTTP 메서드
  }

  // @Res()를 사용하면 응답을 직접 제어해야 합니다
  @Get('stream')
  getStream(@Res() res: Response) {
    res.set('Content-Type', 'text/plain');
    res.send('직접 응답 전송');
    // NestJS의 자동 직렬화/인터셉터 동작이 비활성화됩니다
  }
}
```

> **주의:** `@Res()`를 사용하면 NestJS의 응답 파이프라인(인터셉터, 직렬화 등)이 **비활성화**됩니다. 반드시 `res.send()`, `res.json()` 등으로 직접 응답해야 하며, 그렇지 않으면 요청이 무한 대기 상태가 됩니다.
>
> **인터셉터와 함께 쓰려면** `@Res({ passthrough: true })`를 사용하세요:
> ```typescript
> @Get()
> findAll(@Res({ passthrough: true }) res: Response) {
>   res.setHeader('X-Custom', 'value');
>   return { data: [] }; // NestJS가 자동으로 JSON 응답 처리
> }
> ```

---

### `@Ip()`

**무엇인가:** 클라이언트의 **IP 주소**를 추출하는 데코레이터입니다.

**예제 코드:**

```typescript
import { Controller, Post, Ip } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  login(@Ip() ip: string) {
    console.log(`로그인 시도 IP: ${ip}`);
    // 특정 IP 차단, 로그 기록 등에 활용
  }
}
```

---

### `@HostParam(key?)`

**무엇인가:** **호스트 이름의 동적 부분**을 추출하는 데코레이터입니다. 서브도메인 기반 라우팅에서 사용합니다.

**예제 코드:**

```typescript
import { Controller, Get, HostParam } from '@nestjs/common';

// host 옵션으로 서브도메인 패턴 지정
@Controller({ host: ':tenant.example.com' })
export class TenantController {
  @Get()
  getInfo(@HostParam('tenant') tenant: string) {
    // company1.example.com 접속 시 → tenant = 'company1'
    return { tenant };
  }
}
```

---

## 4. 응답 제어 데코레이터

### `@HttpCode(statusCode)`

**무엇인가:** 핸들러 메서드가 반환하는 **HTTP 상태 코드를 지정**하는 데코레이터입니다.

**왜 쓰는가:** NestJS의 기본 상태 코드는 `GET` = 200, `POST` = 201입니다. 이 기본값을 변경하고 싶을 때 사용합니다. 예를 들어 DELETE 요청이 성공했지만 반환할 내용이 없을 때 204를 명시적으로 지정합니다.

> **기본값이 GET=200, POST=201인 이유:**
> - `200 OK`: 요청이 성공적으로 처리되어 데이터를 반환함 (조회에 적합)
> - `201 Created`: 서버에 새 리소스가 생성됨 (생성에 적합)
>
> REST 표준 관례에 따른 것이며, 클라이언트(브라우저, 앱)가 이 코드를 보고 응답의 의미를 파악합니다.

**예제 코드:**

```typescript
import { Controller, Delete, Post, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Delete(':id')
  @HttpCode(204)  // No Content — 삭제 성공, 반환 내용 없음
  remove() {
    // void 반환
  }

  @Post('action')
  @HttpCode(HttpStatus.OK)  // HttpStatus enum 활용 (권장, 가독성 향상)
  doAction() {}
}
```

**자주 쓰는 HTTP 상태 코드:**

| 상태 코드 | 의미 | 사용 상황 |
|-----------|------|----------|
| `200` OK | 성공 | GET 기본값, 일반 성공 응답 |
| `201` Created | 생성 완료 | POST 기본값, 리소스 생성 |
| `204` No Content | 내용 없음 | DELETE 성공, 업데이트 성공(내용 불필요) |
| `400` Bad Request | 잘못된 요청 | 유효성 검사 실패 |
| `401` Unauthorized | 인증 필요 | 로그인 안 된 경우 |
| `403` Forbidden | 권한 없음 | 로그인은 됐지만 권한 부족 |
| `404` Not Found | 없음 | 리소스가 존재하지 않음 |
| `500` Internal Server Error | 서버 오류 | 예기치 않은 서버 에러 |

---

### `@Header(name, value)`

**무엇인가:** 응답에 **커스텀 HTTP 헤더를 추가**하는 데코레이터입니다.

**왜 쓰는가:** 캐시 정책, CORS 설정, 커스텀 토큰 등 응답 헤더에 특정 값을 항상 포함시켜야 할 때 사용합니다.

**예제 코드:**

```typescript
import { Controller, Get, Header } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get()
  @Header('Cache-Control', 'max-age=3600, public')  // 1시간 캐싱
  @Header('X-Powered-By', 'NestJS')                 // 커스텀 헤더
  findAll() {
    return [];
  }

  @Get('file')
  @Header('Content-Disposition', 'attachment; filename="data.csv"')
  downloadFile() {
    // 파일 다운로드 응답
  }
}
```

> **팁:** 동적으로 헤더를 설정해야 한다면 `@Res({ passthrough: true })`로 Response 객체를 받아 `res.setHeader()`를 사용하거나, **Interceptor**에서 처리하는 것이 좋습니다.

---

### `@Redirect(url, statusCode?)`

**무엇인가:** 클라이언트를 **다른 URL로 리다이렉트**하는 데코레이터입니다.

**왜 쓰는가:** 구버전 URL을 새 URL로 영구 이동시키거나, 특정 조건에 따라 다른 페이지로 보내야 할 때 사용합니다.

**사용법:**

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `url` | (필수) | 리다이렉트할 URL |
| `statusCode` | `302` | HTTP 리다이렉트 코드. 영구 이동이면 `301`, 임시 이동이면 `302` |

**예제 코드:**

```typescript
import { Controller, Get, Redirect } from '@nestjs/common';

@Controller()
export class AppController {
  // 정적 리다이렉트 — 항상 같은 URL로
  @Get('docs')
  @Redirect('https://docs.nestjs.com', 301) // 301: 영구 이동
  getDocs() {}

  // 동적 리다이렉트 — 조건에 따라 다른 URL로
  @Get('version')
  @Redirect('https://docs.nestjs.com') // 기본 URL (오버라이드 가능)
  getVersion(@Query('v') version: string) {
    if (version === 'v9') {
      // 반환 객체로 url/statusCode를 오버라이드
      return { url: 'https://docs.nestjs.com/v9', statusCode: 302 };
    }
    // 반환이 없으면 @Redirect에 지정한 기본 URL로 이동
  }
}
```

---

## 5. Provider 데코레이터

### `@Injectable(options?)`

**무엇인가:** 클래스를 NestJS의 **DI(의존성 주입) 컨테이너가 관리하는 Provider**로 선언하는 데코레이터입니다.

**왜 쓰는가:** DI란 객체가 필요한 의존성을 직접 생성하지 않고, 외부(프레임워크)로부터 주입받는 패턴입니다. `@Injectable()` 없이 서비스를 직접 생성하면 `new PostsService(new PostsRepository(db))`처럼 의존 관계를 수동으로 관리해야 합니다. NestJS DI 컨테이너가 이를 자동화해줍니다.

**scope 옵션 — 인스턴스 생명주기 제어:**

| scope 값 | 동작 방식 | 사용 시기 |
|----------|-----------|----------|
| `Scope.DEFAULT` | **싱글톤** (기본값). 앱 시작 시 하나만 생성, 모든 요청에서 공유 | 대부분의 서비스. 상태를 공유해도 되는 경우 |
| `Scope.REQUEST` | **요청마다 새 인스턴스** 생성. 해당 요청이 끝나면 소멸 | 요청별 컨텍스트가 필요할 때 (예: 요청한 사용자 정보를 서비스에 주입) |
| `Scope.TRANSIENT` | **주입될 때마다 새 인스턴스** 생성. 여러 소비자가 각자 독립된 인스턴스를 가짐 | 각 소비자가 독립적인 상태를 유지해야 할 때 |

**예제 코드:**

```typescript
import { Injectable, Scope } from '@nestjs/common';

// 기본 싱글톤 — 앱 전체에서 하나의 인스턴스
@Injectable()
export class PostsService {
  private count = 0; // 모든 요청이 같은 count를 공유함
}

// 요청 스코프 — 요청마다 새 인스턴스
@Injectable({ scope: Scope.REQUEST })
export class RequestContextService {
  // 이 요청을 보낸 사용자 정보를 안전하게 담을 수 있음
  private currentUser: User;

  setUser(user: User) { this.currentUser = user; }
  getUser() { return this.currentUser; }
}

// 트랜지언트 스코프 — 주입마다 새 인스턴스
@Injectable({ scope: Scope.TRANSIENT })
export class LoggerService {
  private context: string; // 주입받는 클래스마다 독립적인 컨텍스트 가짐

  setContext(context: string) { this.context = context; }
  log(message: string) { console.log(`[${this.context}] ${message}`); }
}
```

> **팁:** `Scope.REQUEST`를 사용하면 해당 서비스를 주입받는 상위 컨트롤러, 가드, 인터셉터도 **전부 REQUEST 스코프**가 됩니다. 성능에 영향을 줄 수 있으므로 꼭 필요한 경우에만 사용하세요.

---

### `@Inject(token)`

**무엇인가:** 생성자 주입 시 **특정 토큰을 명시적으로 지정**하는 데코레이터입니다.

**왜 쓰는가:** NestJS의 기본 DI는 클래스 타입을 토큰으로 사용합니다 (`constructor(private service: PostsService)`). 하지만 문자열이나 심볼로 등록된 커스텀 프로바이더(값, 팩토리 등)는 클래스 타입이 없으므로, `@Inject(토큰)`으로 어떤 프로바이더를 주입받을지 명시해야 합니다.

**예제 코드:**

```typescript
import { Injectable, Inject } from '@nestjs/common';

// 커스텀 프로바이더 등록 (모듈에서)
const CONFIG_TOKEN = 'APP_CONFIG';

@Module({
  providers: [
    {
      provide: CONFIG_TOKEN,           // 문자열 토큰으로 등록
      useValue: { apiUrl: 'https://api.example.com', timeout: 3000 },
    },
    {
      provide: 'DATABASE_CONNECTION',  // 또 다른 문자열 토큰
      useFactory: () => createConnection(),
    },
  ],
})
export class AppModule {}

// 주입받을 때 — 클래스 타입이 없으므로 @Inject() 필요
@Injectable()
export class PostsService {
  constructor(
    @Inject(CONFIG_TOKEN) private config: { apiUrl: string; timeout: number },
    @Inject('DATABASE_CONNECTION') private db: Connection,
  ) {}
}
```

> **팁:** 문자열 토큰 대신 `Symbol`을 사용하면 이름 충돌을 방지할 수 있습니다.
> ```typescript
> export const CONFIG_TOKEN = Symbol('APP_CONFIG');
> ```

---

### `@Optional()`

**무엇인가:** 주입할 프로바이더가 존재하지 않아도 **에러 없이 `undefined`로 처리**하는 데코레이터입니다.

**왜 쓰는가:** 기본적으로 DI 컨테이너가 주입 대상을 찾지 못하면 에러가 발생합니다. 선택적으로 사용할 수 있는 서비스(예: 로거, 캐시)는 없어도 앱이 동작해야 할 때 `@Optional()`을 사용합니다.

**예제 코드:**

```typescript
import { Injectable, Optional, Inject } from '@nestjs/common';

@Injectable()
export class PostsService {
  constructor(
    private readonly postsRepository: PostsRepository,
    // LoggerService가 등록되지 않아도 에러 없이 undefined로 처리
    @Optional() private readonly logger?: LoggerService,
    // 커스텀 토큰도 Optional 가능
    @Optional() @Inject('CACHE_SERVICE') private readonly cache?: CacheService,
  ) {}

  findAll() {
    this.logger?.log('findAll called'); // 없으면 그냥 실행 안 됨
    return [];
  }
}
```

---

## 6. Guard / Pipe / Filter / Interceptor 바인딩 데코레이터

### `@UseGuards(...guards)`

**무엇인가:** **Guard**를 컨트롤러 또는 메서드에 바인딩하는 데코레이터입니다. Guard는 요청이 핸들러에 도달하기 전에 **인증/인가 여부를 결정**합니다.

**왜 쓰는가:** 특정 엔드포인트를 로그인한 사용자만, 또는 특정 역할(관리자 등)만 접근할 수 있도록 제한할 때 사용합니다.

**Guard 실행 순서:** 여러 Guard를 나열하면 **왼쪽에서 오른쪽** 순서로 실행됩니다. 하나라도 `false`를 반환하면 이후 Guard는 실행되지 않고 `403 Forbidden`이 반환됩니다.

**예제 코드:**

```typescript
import { Controller, Get, Post, Delete, UseGuards } from '@nestjs/common';

// 단일 Guard
@UseGuards(JwtAuthGuard)
@Get('me')
getProfile() {}

// 여러 Guard — JwtAuthGuard 먼저, 통과하면 RolesGuard 실행
@UseGuards(JwtAuthGuard, RolesGuard)
@Delete(':id')
remove() {}

// 인스턴스로 전달 (옵션 주입 시)
@UseGuards(new JwtAuthGuard({ secret: 'custom' }))
@Get('admin')
adminOnly() {}

// 컨트롤러 전체에 적용
@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  // 모든 메서드에 JwtAuthGuard 적용

  @UseGuards(RolesGuard)  // 추가로 RolesGuard도 적용
  @Delete(':id')
  remove() {}
}
```

> **팁:** 메서드 레벨 Guard는 컨트롤러 레벨 Guard가 실행된 **이후**에 실행됩니다.

---

### `@UsePipes(...pipes)`

**무엇인가:** **Pipe**를 바인딩하는 데코레이터입니다. Pipe는 입력 데이터를 **변환**하거나 **유효성 검사**하는 역할을 합니다.

**왜 쓰는가:** 클라이언트로부터 받은 데이터가 올바른 형식인지 검증하고, 필요하면 변환(문자열→숫자 등)합니다. 컨트롤러 메서드 내에서 일일이 검증 코드를 작성하는 대신 Pipe로 선언적으로 처리할 수 있습니다.

**Pipe 적용 레벨:**

| 레벨 | 적용 방법 | 적용 범위 |
|------|----------|----------|
| 파라미터 레벨 | `@Param('id', ParseIntPipe)` | 해당 파라미터만 |
| 메서드 레벨 | `@UsePipes(ValidationPipe)` | 메서드의 모든 파라미터 |
| 컨트롤러 레벨 | 클래스에 `@UsePipes(...)` | 해당 컨트롤러의 모든 메서드 |
| 글로벌 레벨 | `app.useGlobalPipes(...)` | 앱 전체 |

**예제 코드:**

```typescript
import { Controller, Get, Post, Body, Param, UsePipes, ParseIntPipe, ValidationPipe } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  // 파라미터 레벨 Pipe — id를 자동으로 정수로 변환
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // id가 정수가 아니면 400 에러 자동 반환
  }

  // 메서드 레벨 Pipe — 이 메서드에 오는 모든 파라미터에 적용
  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() dto: CreatePostDto) {}

  // 컨트롤러 레벨 Pipe
  // @UsePipes(ValidationPipe) — 컨트롤러 전체 적용
}
```

---

### `@UseFilters(...filters)`

**무엇인가:** **Exception Filter**를 바인딩하는 데코레이터입니다. Exception Filter는 컨트롤러에서 발생한 예외를 잡아 **일관된 에러 응답 형식**으로 변환합니다.

**왜 쓰는가:** 기본 NestJS 예외 응답 형식을 커스터마이징하거나, 특정 예외 타입을 특별히 처리하고 싶을 때 사용합니다.

**예제 코드:**

```typescript
import { Controller, Get, Post, UseFilters } from '@nestjs/common';

// 커스텀 Exception Filter 정의
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// 사용
@Controller('posts')
export class PostsController {
  // 메서드 레벨 적용
  @UseFilters(HttpExceptionFilter)
  @Get(':id')
  findOne() {}

  // 인스턴스로 전달
  @UseFilters(new HttpExceptionFilter())
  @Post()
  create() {}
}

// 컨트롤러 전체 적용
@UseFilters(HttpExceptionFilter)
@Controller('posts')
export class PostsController {}
```

> **팁:** 인스턴스(`new HttpExceptionFilter()`) 대신 클래스(`HttpExceptionFilter`)를 전달하면 NestJS가 DI를 통해 인스턴스를 관리하므로, 의존성 주입이 필요한 경우 클래스를 전달하는 것이 좋습니다.

---

### `@UseInterceptors(...interceptors)`

**무엇인가:** **Interceptor**를 바인딩하는 데코레이터입니다. Interceptor는 요청/응답 파이프라인 앞뒤에 끼어들어 **로깅, 응답 변환, 캐싱** 등의 공통 로직을 처리합니다.

**왜 쓰는가:** 모든 응답 데이터를 `{ data: ..., statusCode: 200 }` 형식으로 감싸거나, 처리 시간을 측정하거나, 응답을 캐시하는 등의 횡단 관심사를 컨트롤러 코드와 분리하고 싶을 때 사용합니다.

**Interceptor 실행 순서:** 요청 시에는 바인딩 순서대로(위→아래), 응답 시에는 역순(아래→위)으로 실행됩니다.

**예제 코드:**

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

// 로깅 인터셉터
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    return next.handle().pipe(
      tap(() => console.log(`처리 시간: ${Date.now() - start}ms`)),
    );
  }
}

// 응답 변환 인터셉터
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => ({ data, statusCode: 200, timestamp: new Date().toISOString() })),
    );
  }
}

// 사용
@Controller('posts')
export class PostsController {
  // 단일 인터셉터
  @UseInterceptors(LoggingInterceptor)
  @Get()
  findAll() {}

  // 여러 인터셉터 — 요청 시 LoggingInterceptor → TransformInterceptor 순
  @UseInterceptors(LoggingInterceptor, TransformInterceptor)
  @Get(':id')
  findOne() {}
}
```

---

### `@SetMetadata(key, value)`

**무엇인가:** 핸들러 또는 클래스에 **커스텀 메타데이터를 첨부**하는 데코레이터입니다. Guard나 Interceptor에서 `Reflector`로 이 메타데이터를 읽어 동작을 결정합니다.

**왜 쓰는가:** 예를 들어, 어떤 라우트는 관리자만 접근 가능하고 어떤 라우트는 누구나 접근 가능하게 만들고 싶을 때, 각 라우트에 `roles: ['admin']` 또는 `isPublic: true` 같은 메타데이터를 붙이고 Guard에서 이를 읽어 판단합니다.

**예제 코드:**

```typescript
import { SetMetadata, UseGuards, Controller, Get, Delete } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// 라우트에 메타데이터 첨부
@Controller('posts')
export class PostsController {
  @SetMetadata('isPublic', true)
  @Get()
  findAll() {} // 누구나 접근 가능

  @SetMetadata('roles', ['admin', 'moderator'])
  @Delete(':id')
  remove() {} // 관리자·모더레이터만 접근 가능
}

// Guard에서 메타데이터 읽기
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!roles) return true; // 메타데이터 없으면 통과
    const user = context.switchToHttp().getRequest().user;
    return roles.some(role => user.roles.includes(role));
  }
}
```

> **팁:** `@SetMetadata()`를 직접 쓰기보다 커스텀 데코레이터로 감싸서 사용하는 것이 권장됩니다. 타입 안전성과 재사용성이 높아집니다.
> ```typescript
> // 커스텀 데코레이터로 감싸기
> export const Roles = (...roles: string[]) => SetMetadata('roles', roles);
> export const Public = () => SetMetadata('isPublic', true);
>
> // 사용 — 훨씬 직관적
> @Roles('admin', 'moderator')
> @Delete(':id')
> remove() {}
>
> @Public()
> @Get()
> findAll() {}
> ```

---

### `@Catch(exceptionType?)`

**무엇인가:** Exception Filter 클래스가 **어떤 예외 타입을 처리할지 선언**하는 데코레이터입니다.

**왜 쓰는가:** 발생한 예외 중 특정 타입만 선택적으로 처리하고 싶을 때 사용합니다. `@Catch()` 없이 구현하면 모든 예외를 처리하게 됩니다.

**예제 코드:**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, NotFoundException } from '@nestjs/common';

// 특정 예외 타입만 처리
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const status = exception.getStatus();
    response.status(status).json({ message: exception.message });
  }
}

// 여러 예외 타입 처리
@Catch(NotFoundException, UnauthorizedException)
export class NotFoundOrUnauthorizedFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // NotFoundException 또는 UnauthorizedException만 여기서 처리
  }
}

// 모든 예외 처리 (타입 지정 없음)
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 타입 불문 모든 예외 처리
  }
}
```

---

## 7. TypeORM Entity 데코레이터

> **ORM이란?** 객체 지향 코드(TypeScript 클래스)와 관계형 데이터베이스 테이블을 연결해주는 도구입니다. SQL을 직접 쓰지 않고 TypeScript 코드로 DB를 다룰 수 있게 해줍니다. TypeORM은 NestJS와 가장 많이 함께 사용되는 ORM입니다.

---

### `@Entity(tableName?)`

**무엇인가:** 클래스를 **데이터베이스 테이블과 매핑**하는 데코레이터입니다.

**왜 쓰는가:** TypeORM이 이 클래스를 DB 테이블로 인식하도록 알려줍니다. `@Entity()`가 없으면 일반 TypeScript 클래스와 구분할 수 없습니다.

**예제 코드:**

```typescript
import { Entity } from 'typeorm';

@Entity('posts')   // DB에서 테이블명이 'posts'
export class Post {}

@Entity()          // 테이블명을 지정하지 않으면 클래스명 소문자가 테이블명 → 'post'
export class Post {}
```

---

### `@PrimaryGeneratedColumn()` / `@PrimaryGeneratedColumn('uuid')`

**무엇인가:** **자동으로 값이 생성되는 기본키(PK) 컬럼**을 정의하는 데코레이터입니다.

**두 방식의 차이와 선택 기준:**

| 방식 | 생성 값 예시 | 특징 | 선택 기준 |
|------|-------------|------|----------|
| `@PrimaryGeneratedColumn()` | `1`, `2`, `3`, ... | 정수 자동 증가(AUTO_INCREMENT). 간단하고 조회가 빠름 | 내부용 ID, 순서가 중요할 때 |
| `@PrimaryGeneratedColumn('uuid')` | `'550e8400-e29b-...'` | UUID v4. 전역 고유성 보장, 예측 불가 | 분산 시스템, 외부 공개 ID, 보안이 중요할 때 |

**예제 코드:**

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

// 정수 자동 증가 PK
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number; // 1, 2, 3, ...
}

// UUID PK
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string; // '550e8400-e29b-41d4-a716-446655440000'
}
```

> **팁:** 정수 PK는 URL에 그대로 노출되면 총 레코드 수를 추측할 수 있어 보안 문제가 될 수 있습니다. 외부에 노출되는 ID는 UUID를 권장합니다.

---

### 컬럼 데코레이터

#### `@Column(options)`

**무엇인가:** 클래스 프로퍼티를 **DB 테이블의 컬럼**으로 매핑하는 데코레이터입니다.

**주요 옵션:**

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `type` | string | TypeScript 타입 추론 | DB 컬럼 타입 (`'varchar'`, `'text'`, `'int'`, `'boolean'`, `'json'` 등) |
| `length` | number | — | 문자열 최대 길이 (`'varchar'` 타입에 사용) |
| `nullable` | boolean | `false` | `NULL` 허용 여부 |
| `default` | any | — | 컬럼 기본값 |
| `unique` | boolean | `false` | UNIQUE 제약 조건 |
| `name` | string | 프로퍼티명 | 실제 DB 컬럼명 (다를 때 사용) |
| `select` | boolean | `true` | `false`이면 기본 조회 시 이 컬럼 제외 (비밀번호 등) |
| `comment` | string | — | DB 컬럼 주석 |

**예제 코드:**

```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 200, nullable: false })
  title: string; // VARCHAR(200) NOT NULL

  @Column({ type: 'text' })
  content: string; // TEXT

  @Column({ default: false })
  isPublished: boolean; // BOOLEAN DEFAULT FALSE

  @Column({ unique: true, length: 100 })
  slug: string; // VARCHAR(100) UNIQUE

  @Column({ name: 'view_count', default: 0 })
  viewCount: number; // DB 컬럼명은 view_count

  @Column({ select: false })
  password: string; // 기본 SELECT 쿼리에서 제외됨

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>; // JSON 타입
}
```

---

### `@CreateDateColumn()`, `@UpdateDateColumn()`, `@DeleteDateColumn()`

**무엇인가:** **자동으로 관리되는 타임스탬프 컬럼** 데코레이터들입니다.

| 데코레이터 | 동작 | 사용 시기 |
|------------|------|----------|
| `@CreateDateColumn()` | 레코드가 **생성될 때** 현재 시각 자동 기록 | 생성일 추적 |
| `@UpdateDateColumn()` | 레코드가 **수정될 때마다** 현재 시각 자동 갱신 | 최종 수정일 추적 |
| `@DeleteDateColumn()` | **소프트 삭제** 시 현재 시각 기록. `NULL`이면 삭제되지 않은 것 | 소프트 삭제(데이터 보존) |

**예제 코드:**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @CreateDateColumn()
  createdAt: Date; // 자동 기록, 수동 설정 불필요

  @UpdateDateColumn()
  updatedAt: Date; // save() 호출 시마다 자동 갱신

  @DeleteDateColumn()
  deletedAt: Date | null; // null이면 삭제 안 됨, 소프트 삭제 시 시각 기록
}
```

> **팁:** `@DeleteDateColumn()`을 사용하면 `repository.softDelete(id)`로 소프트 삭제가 가능합니다. 소프트 삭제된 레코드는 기본 조회에서 자동으로 제외됩니다(TypeORM이 `WHERE deletedAt IS NULL`을 자동 추가).

---

### 관계 데코레이터

`@OneToOne`, `@OneToMany`, `@ManyToOne`, `@ManyToMany`

**무엇인가:** 엔티티 간의 **관계를 정의**하는 데코레이터들입니다.

**각 관계의 개념 (블로그 예제: User - Post - Comment):**

| 데코레이터 | 관계 | 예시 |
|------------|------|------|
| `@OneToOne` | 1:1 — 한 쪽이 오직 하나와 연결 | User ↔ Profile (유저는 프로필을 하나만 가짐) |
| `@OneToMany` | 1:N — 한 쪽이 여러 개와 연결 (부모 쪽) | User → Posts (유저는 여러 게시글 작성 가능) |
| `@ManyToOne` | N:1 — 여러 개가 하나와 연결 (자식 쪽) | Post → User (게시글은 작성자 한 명) |
| `@ManyToMany` | N:N — 양쪽이 여러 개와 연결 | Post ↔ Tag (게시글에 여러 태그, 태그는 여러 게시글) |

**예제 코드:**

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, OneToMany, ManyToOne, ManyToMany,
  JoinColumn, JoinTable
} from 'typeorm';

// === User 엔티티 ===
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  // 1:1 — User는 Profile 하나를 가짐
  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  @JoinColumn() // FK가 users 테이블에 생성됨
  profile: Profile;

  // 1:N — User는 여러 Post를 가짐
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[]; // FK는 Post 쪽에 있으므로 @JoinColumn 불필요
}

// === Profile 엔티티 ===
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  bio: string;

  // 1:1의 반대편
  @OneToOne(() => User, (user) => user.profile)
  user: User;
}

// === Post 엔티티 ===
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  // N:1 — Post는 작성자(User) 하나를 가짐
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  author: User; // author_id FK 컬럼이 posts 테이블에 생성됨

  // 1:N — Post는 여러 Comment를 가짐
  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];

  // N:N — Post는 여러 Tag를 가짐
  @ManyToMany(() => Tag, (tag) => tag.posts)
  @JoinTable() // 중간 테이블(post_tag) 생성. 소유 측에만 @JoinTable 필요
  tags: Tag[];
}

// === Tag 엔티티 ===
@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  // N:N의 반대편
  @ManyToMany(() => Post, (post) => post.tags)
  posts: Post[];
}
```

**관계 주요 옵션:**

| 옵션 | 설명 |
|------|------|
| `eager: true` | 이 관계를 조회 시 항상 자동으로 함께 로드 |
| `lazy: true` | 실제 접근할 때 로드 (Promise 반환) |
| `cascade: true` | 부모 저장/삭제 시 연관 엔티티에도 자동 적용 |
| `onDelete: 'CASCADE'` | 부모 삭제 시 FK 처리 방식 (DB 레벨) |
| `nullable: false` | 이 관계가 필수임을 지정 |

---

### `@JoinColumn()`, `@JoinTable()`

**무엇인가:** 관계에서 **외래키(FK) 또는 중간 테이블의 위치를 지정**하는 데코레이터입니다.

| 데코레이터 | 용도 | 사용 위치 |
|------------|------|----------|
| `@JoinColumn()` | FK 컬럼이 생성될 위치 지정 | `@OneToOne`에서 **필수**, `@ManyToOne`에서 선택 |
| `@JoinTable()` | N:N 중간 테이블 생성 지정 | `@ManyToMany`에서 **소유 측에 필수** |

**예제 코드:**

```typescript
// @JoinColumn — FK 컬럼명 커스터마이징
@OneToOne(() => Profile)
@JoinColumn({ name: 'profile_id' }) // users 테이블에 profile_id 컬럼 생성
profile: Profile;

// @JoinTable — 중간 테이블 커스터마이징
@ManyToMany(() => Tag)
@JoinTable({
  name: 'post_tags',                  // 중간 테이블명
  joinColumn: { name: 'post_id' },    // 이 엔티티 FK
  inverseJoinColumn: { name: 'tag_id' } // 반대 엔티티 FK
})
tags: Tag[];
```

---

### `@InjectRepository(Entity)`

**무엇인가:** TypeORM의 **Repository를 NestJS DI로 주입**받는 데코레이터입니다.

**왜 쓰는가:** Repository는 특정 엔티티에 대한 DB 작업(CRUD)을 담당합니다. `@InjectRepository()`를 통해 서비스에서 Repository를 주입받아 사용합니다.

**예제 코드:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  findAll(): Promise<Post[]> {
    return this.postsRepository.find();
  }

  findOne(id: number): Promise<Post | null> {
    return this.postsRepository.findOneBy({ id });
  }

  async create(dto: CreatePostDto): Promise<Post> {
    const post = this.postsRepository.create(dto);
    return this.postsRepository.save(post);
  }

  async remove(id: number): Promise<void> {
    await this.postsRepository.delete(id);
  }
}

// 모듈에서 TypeOrmModule.forFeature()로 Repository 등록 필수
@Module({
  imports: [TypeOrmModule.forFeature([Post])], // 이 모듈에서 Post Repository 사용 가능
  providers: [PostsService],
})
export class PostsModule {}
```

---

## 8. Swagger 데코레이터

> **Swagger(OpenAPI)란?** API 명세를 자동으로 생성하고 브라우저에서 테스트할 수 있게 해주는 도구입니다. `@nestjs/swagger` 패키지를 설치하면 아래 데코레이터들로 API 문서를 자동 생성할 수 있습니다.

---

### `@ApiTags(tag)`

**무엇인가:** Swagger UI에서 **컨트롤러를 그룹으로 묶는** 데코레이터입니다.

**왜 쓰는가:** API가 많아지면 Swagger UI에서 컨트롤러별로 그룹을 나눠 표시해야 찾기 쉬워집니다.

**예제 코드:**

```typescript
import { ApiTags } from '@nestjs/swagger';

@ApiTags('게시글')          // Swagger UI에서 '게시글' 그룹으로 표시
@Controller('posts')
export class PostsController {}

@ApiTags('사용자', '인증') // 여러 태그에 동시 포함
@Controller('users')
export class UsersController {}
```

---

### `@ApiOperation(options)`

**무엇인가:** 각 엔드포인트의 **설명을 문서화**하는 데코레이터입니다.

| 옵션 | 설명 |
|------|------|
| `summary` | Swagger UI에서 엔드포인트 옆에 표시되는 **짧은 제목** |
| `description` | 상세 클릭 시 보이는 **긴 설명** |
| `deprecated` | `true`로 설정하면 Swagger에서 취소선으로 표시 |

**예제 코드:**

```typescript
import { ApiOperation } from '@nestjs/swagger';

@ApiOperation({
  summary: '게시글 목록 조회',
  description: '페이지네이션을 지원하는 게시글 목록을 반환합니다. 로그인 없이 조회 가능합니다.',
})
@Get()
findAll() {}

@ApiOperation({ summary: '게시글 삭제', deprecated: true })
@Delete(':id')
remove() {} // Swagger에서 취소선으로 표시됨
```

---

### `@ApiResponse` 계열

**무엇인가:** 각 **HTTP 상태 코드별 응답을 문서화**하는 데코레이터들입니다.

| 데코레이터 | 상태 코드 |
|------------|----------|
| `@ApiOkResponse` | 200 |
| `@ApiCreatedResponse` | 201 |
| `@ApiNoContentResponse` | 204 |
| `@ApiBadRequestResponse` | 400 |
| `@ApiUnauthorizedResponse` | 401 |
| `@ApiForbiddenResponse` | 403 |
| `@ApiNotFoundResponse` | 404 |
| `@ApiInternalServerErrorResponse` | 500 |
| `@ApiResponse({ status: N })` | 임의 상태 코드 |

**예제 코드:**

```typescript
import {
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse,
  ApiUnauthorizedResponse, ApiNotFoundResponse, ApiResponse
} from '@nestjs/swagger';

@ApiOperation({ summary: '게시글 목록 조회' })
@ApiOkResponse({ description: '조회 성공', type: [PostResponseDto] })
@Get()
findAll() {}

@ApiOperation({ summary: '게시글 생성' })
@ApiCreatedResponse({ description: '생성 성공', type: PostResponseDto })
@ApiBadRequestResponse({ description: '유효성 검사 실패' })
@ApiUnauthorizedResponse({ description: '로그인 필요' })
@Post()
create() {}

@ApiOperation({ summary: '게시글 상세 조회' })
@ApiOkResponse({ type: PostResponseDto })
@ApiNotFoundResponse({ description: '게시글을 찾을 수 없음' })
@ApiResponse({ status: 429, description: '요청 횟수 초과' }) // 임의 상태 코드
@Get(':id')
findOne() {}
```

---

### `@ApiProperty(options)`

**무엇인가:** DTO 클래스의 **각 필드를 Swagger에 문서화**하는 데코레이터입니다.

**왜 쓰는가:** TypeScript 타입 정보만으로는 Swagger가 DTO 구조를 자동으로 알 수 없습니다. `@ApiProperty()`를 붙여야 Swagger UI에서 요청/응답 스키마를 표시합니다.

**주요 옵션:**

| 옵션 | 설명 |
|------|------|
| `description` | 필드 설명 |
| `example` | 예시 값 |
| `required` | 필수 여부 (기본 `true`) |
| `type` | 타입 명시 (배열 등 복잡한 타입) |
| `enum` | 열거형 값 목록 |
| `minimum` / `maximum` | 숫자 최솟값/최댓값 |

**예제 코드:**

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: 'NestJS 시작하기',
    minLength: 1,
    maxLength: 200,
  })
  title: string;

  @ApiProperty({
    description: '게시글 본문',
    example: '오늘은 NestJS에 대해 알아보겠습니다.',
  })
  content: string;

  @ApiPropertyOptional({              // required: false와 동일
    description: '태그 목록',
    example: ['nestjs', 'typescript'],
    type: [String],
  })
  tags?: string[];

  @ApiProperty({
    description: '게시글 상태',
    enum: ['draft', 'published', 'archived'],
    example: 'draft',
  })
  status: 'draft' | 'published' | 'archived';
}
```

---

### `@ApiBearerAuth()`

**무엇인가:** 해당 엔드포인트가 **JWT Bearer 토큰 인증을 요구함**을 Swagger에 표시하는 데코레이터입니다.

**설정 방법:**

```typescript
// main.ts — Swagger 설정에서 Bearer 인증 스키마 등록
const config = new DocumentBuilder()
  .setTitle('API 문서')
  .addBearerAuth() // Bearer 인증 스키마 등록 (이게 있어야 @ApiBearerAuth가 동작)
  .build();

// 컨트롤러에서 사용
import { ApiBearerAuth } from '@nestjs/swagger';

@ApiBearerAuth()      // Swagger UI에 자물쇠 아이콘 표시, 토큰 입력창 활성화
@UseGuards(JwtAuthGuard)
@Post()
create() {}

// 컨트롤러 전체에 적용
@ApiBearerAuth()
@ApiTags('게시글')
@Controller('posts')
export class PostsController {}
```

---

### `@ApiParam`, `@ApiQuery`, `@ApiBody`

**무엇인가:** 경로 파라미터, 쿼리스트링, 요청 본문을 **Swagger에 상세히 문서화**하는 데코레이터들입니다.

> **팁:** DTO와 `@ApiProperty()`를 잘 정의하면 대부분의 경우 `@ApiBody()`는 자동으로 추론됩니다. `@ApiParam`과 `@ApiQuery`는 자동 추론이 안 되는 경우를 보완합니다.

**예제 코드:**

```typescript
import { ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';

@ApiParam({
  name: 'id',
  description: '게시글 ID',
  type: Number,
  example: 1,
})
@ApiQuery({
  name: 'page',
  description: '페이지 번호',
  required: false,
  type: Number,
  example: 1,
})
@ApiQuery({
  name: 'limit',
  required: false,
  type: Number,
  example: 10,
})
@Get(':id')
findOne(@Param('id') id: string, @Query('page') page: string) {}

@ApiBody({
  description: '게시글 생성 데이터',
  type: CreatePostDto,
  examples: {
    example1: {
      summary: '일반 게시글',
      value: { title: '안녕하세요', content: '내용입니다.' },
    },
  },
})
@Post()
create(@Body() dto: CreatePostDto) {}
```

---

## 9. 커스텀 데코레이터 생성 함수

### `createParamDecorator(factory)`

**무엇인가:** **커스텀 파라미터 데코레이터**를 만드는 함수입니다. `@Param()`, `@Query()` 같은 내장 데코레이터처럼, 요청에서 원하는 데이터를 추출하는 나만의 데코레이터를 정의할 수 있습니다.

**왜 쓰는가:** 여러 컨트롤러에서 반복적으로 `req.user`, `req.headers['x-tenant-id']` 같은 값을 추출하는 코드를 각 메서드마다 쓰는 것은 비효율적입니다. 커스텀 데코레이터로 만들면 재사용성과 가독성이 높아집니다.

**`data`와 `ctx` 파라미터:**
- `data`: 데코레이터 호출 시 전달한 인자. `@CurrentUser('id')`이면 `data = 'id'`, `@CurrentUser()`이면 `data = undefined`
- `ctx`: `ExecutionContext`. HTTP, WebSocket, gRPC 등 현재 실행 컨텍스트 정보를 담고 있음

**예제 코드:**

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

// 현재 로그인 사용자를 추출하는 데코레이터
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user; // JwtAuthGuard가 주입한 user 객체

    // data가 있으면 특정 필드만, 없으면 전체 user 객체 반환
    return data ? user?.[data] : user;
  },
);

// 테넌트 ID를 헤더에서 추출하는 데코레이터
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers['x-tenant-id'] as string;
  },
);

// 사용
@Controller('posts')
export class PostsController {
  @Get('me')
  getMyPosts(
    @CurrentUser() user: User,         // 전체 user 객체
  ) {}

  @Get('profile')
  getProfile(
    @CurrentUser('id') userId: string, // user.id만 추출
    @CurrentUser('email') email: string,
  ) {}

  @Get()
  findByTenant(@TenantId() tenantId: string) {}
}
```

---

### `applyDecorators(...decorators)`

**무엇인가:** **여러 데코레이터를 하나로 합성**하는 함수입니다. 자주 함께 쓰는 데코레이터 조합을 단일 커스텀 데코레이터로 만들 수 있습니다.

**왜 쓰는가:** 인증이 필요한 엔드포인트마다 `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`, `@ApiUnauthorizedResponse()` 세 개를 매번 붙이면 코드가 길어집니다. `applyDecorators`로 합성하면 `@Auth()`처럼 하나만 붙이면 됩니다.

**예제 코드:**

```typescript
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';

// 인증 + 인가 + Swagger를 합친 커스텀 데코레이터
export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(JwtAuthGuard, RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: '로그인이 필요합니다.' }),
    ApiForbiddenResponse({ description: '접근 권한이 없습니다.' }),
  );
}

// 공개 엔드포인트를 표시하는 커스텀 데코레이터
export function Public() {
  return applyDecorators(
    SetMetadata('isPublic', true),
    ApiOperation({ summary: '공개 엔드포인트' }), // 추가 데코레이터도 합성 가능
  );
}

// 사용 — 데코레이터가 하나로 간결해짐
@Controller('posts')
export class PostsController {
  @Public()
  @Get()
  findAll() {} // 누구나 접근 가능

  @Auth()                 // 로그인만 하면 됨
  @Post()
  create() {}

  @Auth('admin', 'moderator')  // 관리자 또는 모더레이터만
  @Delete(':id')
  remove() {}
}
```

---

## 10. 데코레이터 적용 범위 정리 표

| 데코레이터 | 클래스 | 메서드 | 파라미터 | 프로퍼티 |
|------------|:------:|:------:|:--------:|:--------:|
| `@Module()` | ✓ | | | |
| `@Global()` | ✓ | | | |
| `@Controller()` | ✓ | | | |
| `@Get()`, `@Post()`, `@Put()`, `@Patch()`, `@Delete()`, `@All()` | | ✓ | | |
| `@HttpCode()` | | ✓ | | |
| `@Header()` | | ✓ | | |
| `@Redirect()` | | ✓ | | |
| `@Param()`, `@Query()`, `@Body()` | | | ✓ | |
| `@Headers()`, `@Ip()`, `@HostParam()` | | | ✓ | |
| `@Req()`, `@Res()` | | | ✓ | |
| `@Injectable()` | ✓ | | | |
| `@Inject()` | | | ✓ | ✓ |
| `@Optional()` | | | ✓ | ✓ |
| `@UseGuards()` | ✓ | ✓ | | |
| `@UsePipes()` | ✓ | ✓ | | |
| `@UseFilters()` | ✓ | ✓ | | |
| `@UseInterceptors()` | ✓ | ✓ | | |
| `@SetMetadata()` | ✓ | ✓ | | |
| `@Catch()` | ✓ | | | |
| `@Entity()` | ✓ | | | |
| `@PrimaryGeneratedColumn()` | | | | ✓ |
| `@Column()` | | | | ✓ |
| `@CreateDateColumn()`, `@UpdateDateColumn()`, `@DeleteDateColumn()` | | | | ✓ |
| `@OneToOne()`, `@OneToMany()`, `@ManyToOne()`, `@ManyToMany()` | | | | ✓ |
| `@JoinColumn()`, `@JoinTable()` | | | | ✓ |
| `@ApiTags()` | ✓ | | | |
| `@ApiOperation()` | | ✓ | | |
| `@ApiResponse` 계열 | | ✓ | | |
| `@ApiBearerAuth()` | ✓ | ✓ | | |
| `@ApiProperty()`, `@ApiPropertyOptional()` | | | | ✓ |
| `@ApiParam()`, `@ApiQuery()`, `@ApiBody()` | | ✓ | | |

---

## 11. 자주 묻는 질문 FAQ

**Q1. `@Res()`를 사용했더니 응답이 안 오고 요청이 무한 대기 상태가 됩니다.**

`@Res()`를 사용하면 NestJS의 자동 응답 처리가 비활성화됩니다. 반드시 `res.send()`, `res.json()`, `res.end()` 등으로 직접 응답을 종료해야 합니다.

```typescript
// 잘못된 예
@Get()
findAll(@Res() res: Response) {
  return []; // 이 return은 NestJS가 처리하지 않음 → 무한 대기
}

// 올바른 예
@Get()
findAll(@Res() res: Response) {
  res.json([]); // 직접 응답
}

// 또는 passthrough 옵션 사용
@Get()
findAll(@Res({ passthrough: true }) res: Response) {
  res.setHeader('X-Custom', 'value');
  return []; // NestJS가 자동 처리
}
```

---

**Q2. `@Module()`의 `providers`와 `exports`의 차이가 헷갈립니다.**

- `providers`: 이 모듈 **안에서** 사용할 서비스를 등록합니다. 이 모듈의 컨트롤러나 다른 프로바이더가 주입받을 수 있습니다.
- `exports`: 이 모듈을 `imports`로 가져간 **다른 모듈**에서도 사용할 수 있게 공개합니다.

```typescript
@Module({
  providers: [PostsService, PostsRepository], // 이 모듈 내부에서만 사용 가능
  exports: [PostsService],                    // 다른 모듈에서도 주입 받을 수 있음
})
export class PostsModule {}

// CommentsModule에서 PostsModule을 imports하면 PostsService는 주입 가능
// 하지만 PostsRepository는 PostsModule 내부 전용이므로 주입 불가
```

---

**Q3. `@Injectable()`의 scope를 `REQUEST`로 설정하면 성능에 문제가 생기나요?**

네, 주의가 필요합니다. `Scope.REQUEST`는 **요청마다 새 인스턴스를 생성**하기 때문에 두 가지 문제가 발생할 수 있습니다:

1. **성능**: 매 요청마다 객체 생성 비용이 발생합니다. 요청이 많으면 GC 부담이 커집니다.
2. **전파**: REQUEST 스코프 서비스를 주입받는 상위 서비스·컨트롤러도 모두 REQUEST 스코프가 됩니다.

대부분의 경우 `Scope.DEFAULT`(싱글톤)으로 충분합니다. 요청별 컨텍스트가 필요하다면 `REQUEST` 스코프 대신, Guard에서 `req.user`를 설정하고 컨트롤러에서 `@CurrentUser()` 커스텀 데코레이터로 꺼내는 패턴을 먼저 검토하세요.

---

**Q4. `@UseGuards()`, `@UsePipes()`, `@UseFilters()`, `@UseInterceptors()`를 클래스와 메서드 양쪽에 달면 어떤 순서로 실행되나요?**

실행 순서는 다음과 같습니다 (요청 기준):

```
글로벌 Guard → 컨트롤러 Guard → 메서드 Guard
글로벌 Interceptor → 컨트롤러 Interceptor → 메서드 Interceptor
글로벌 Pipe → 컨트롤러 Pipe → 메서드 Pipe
(핸들러 실행)
메서드 Filter → 컨트롤러 Filter → 글로벌 Filter (예외 발생 시)
```

Interceptor의 응답 처리는 역순(메서드 → 컨트롤러 → 글로벌)으로 실행됩니다.

---

**Q5. `@Entity()`에서 테이블명을 지정하지 않으면 어떻게 됩니까?**

클래스명을 소문자로 변환한 이름이 테이블명이 됩니다.

```typescript
@Entity()
export class Post {}     // 테이블명: 'post'

@Entity()
export class UserProfile {}  // 테이블명: 'user_profile' (TypeORM이 카멜케이스를 스네이크로 변환)
```

일관된 테이블명 관리를 위해 `@Entity('테이블명')`으로 명시적으로 지정하는 것을 권장합니다.
