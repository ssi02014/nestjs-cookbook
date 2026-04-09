# 챕터 2 - Controller

> **이전 챕터 요약**: 챕터 1에서 블로그 API의 모듈 구조(UsersModule, PostsModule, CommentsModule, CommonModule)를 설계하고 뼈대를 만들었다. 이번 챕터에서는 각 모듈에 **Controller**를 추가하여 HTTP 요청을 받는 라우트를 정의한다.



## 목차

- [1단계: 개념 학습](#1단계-개념-학습)
  - [Controller란 무엇인가](#controller란-무엇인가)
  - [@Controller() 데코레이터와 라우트 접두사](#controller-데코레이터와-라우트-접두사)
  - [HTTP 메서드 데코레이터](#http-메서드-데코레이터)
  - [요청 데이터 추출](#요청-데이터-추출)
  - [응답 처리](#응답-처리)
  - [@HttpCode, @Header, @Redirect](#httpcode-header-redirect)
  - [비동기 처리](#비동기-처리)
- [2단계: 기본 예제](#2단계-기본-예제)
  - [CatsController CRUD 예제](#catscontroller-crud-예제)
  - [curl로 API 테스트하기](#curl로-api-테스트하기)
- [3단계: 블로그 API 적용](#3단계-블로그-api-적용)
  - [UsersController](#userscontroller)
  - [PostsController](#postscontroller)
  - [CommentsController](#commentscontroller)
  - [모듈에 컨트롤러 등록](#모듈에-컨트롤러-등록)
  - [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

## Controller란 무엇인가

웹 애플리케이션에서 클라이언트(브라우저, 앱 등)가 서버에 요청을 보내면, 누군가가 그 요청을 받아서 처리해야 한다. NestJS에서 그 역할을 하는 것이 바로 **Controller**다.

Controller를 건물의 **"안내 데스크"**라고 생각하면 쉽다.

```
클라이언트(방문자)가 요청을 보낸다
        |
        v
  Controller(안내 데스크)가 요청을 받는다
        |
        v
  "어떤 요청인지" 파악한다 (GET? POST? 어떤 URL?)
        |
        v
  필요한 데이터를 추출한다 (파라미터, 본문 등)
        |
        v
  실제 업무 담당자(Service)에게 작업을 넘긴다
        |
        v
  결과를 클라이언트에게 돌려준다
```

정리하면 Controller의 역할은 다음과 같다.

- 특정 **URL 경로**로 들어오는 요청을 수신한다
- 요청에 담긴 **데이터를 꺼낸다** (파라미터, 쿼리, 바디 등)
- 비즈니스 로직을 처리하는 **Service에 작업을 위임**한다
- 클라이언트에게 **응답을 반환**한다

> **왜 Controller와 Service를 분리하나요?**
> Controller는 "요청/응답 처리"에만 집중하고, 실제 비즈니스 로직(데이터 조회, 계산, 저장 등)은 Service에 맡기는 것이 좋은 설계다. 이렇게 하면 각각의 역할이 명확해지고, 테스트와 유지보수가 쉬워진다. Service에 대해서는 다음 챕터(Provider & DI)에서 자세히 배운다.

---

## [@Controller()](../references/decorators.md#controllerprefix) 데코레이터와 라우트 접두사

클래스 위에 [`@Controller()`](../references/decorators.md#controllerprefix) 데코레이터를 붙이면, NestJS는 그 클래스를 Controller로 인식한다. 괄호 안에 **라우트 접두사(prefix)**를 문자열로 전달할 수 있다.

```typescript
// cats.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('cats') // 이 컨트롤러의 모든 경로 앞에 '/cats'가 붙는다
export class CatsController {
  @Get() // GET /cats
  findAll(): string {
    return 'This action returns all cats';
  }

  @Get('breed') // GET /cats/breed
  findBreed(): string {
    return 'This action returns cat breeds';
  }
}
```

접두사를 사용하면 관련된 라우트를 하나의 컨트롤러 안에 깔끔하게 그룹화할 수 있다.

| 데코레이터 조합 | 실제 매핑되는 경로 |
|---|---|
| [`@Controller('cats')`](../references/decorators.md#controllerprefix) + [`@Get()`](../references/decorators.md#http-메서드-데코레이터) | `GET /cats` |
| [`@Controller('cats')`](../references/decorators.md#controllerprefix) + [`@Get('breed')`](../references/decorators.md#http-메서드-데코레이터) | `GET /cats/breed` |
| [`@Controller()`](../references/decorators.md#controllerprefix) + [`@Get('cats')`](../references/decorators.md#http-메서드-데코레이터) | `GET /cats` |

> **라우트 접두사는 왜 쓰나요?**
> 접두사 없이 [`@Controller()`](../references/decorators.md#controllerprefix) + [`@Get('cats')`](../references/decorators.md#http-메서드-데코레이터) + [`@Get('cats/breed')`](../references/decorators.md#http-메서드-데코레이터)처럼 매번 전체 경로를 적어도 동작한다. 하지만 접두사를 쓰면 반복을 줄이고, 이 컨트롤러가 어떤 리소스를 담당하는지 한눈에 알 수 있다.

### Controller는 반드시 Module에 등록해야 한다

Controller를 만들기만 하면 동작하지 않는다. 반드시 **Module의 `controllers` 배열에 등록**해야 NestJS가 인식한다.

```typescript
// cats.module.ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';

@Module({
  controllers: [CatsController], // 여기에 등록!
})
export class CatsModule {}
```

---

## HTTP 메서드 데코레이터

웹에서 서버에 요청을 보낼 때는 **HTTP 메서드**라는 것을 사용한다. "무엇을 하고 싶은지"를 나타내는 동사라고 생각하면 된다.

NestJS는 모든 표준 HTTP 메서드에 대한 데코레이터를 제공한다.

| 데코레이터 | HTTP 메서드 | 용도 | 일상적 비유 |
|---|---|---|---|
| [`@Get()`](../references/decorators.md#http-메서드-데코레이터) | GET | 리소스 조회 | "이 정보 좀 보여줘" |
| [`@Post()`](../references/decorators.md#http-메서드-데코레이터) | POST | 리소스 생성 | "이걸 새로 만들어줘" |
| [`@Put()`](../references/decorators.md#http-메서드-데코레이터) | PUT | 리소스 전체 수정 | "이걸 통째로 바꿔줘" |
| [`@Patch()`](../references/decorators.md#http-메서드-데코레이터) | PATCH | 리소스 부분 수정 | "이 부분만 고쳐줘" |
| [`@Delete()`](../references/decorators.md#http-메서드-데코레이터) | DELETE | 리소스 삭제 | "이걸 지워줘" |
| [`@All()`](../references/decorators.md#http-메서드-데코레이터) | 모든 메서드 | 모든 HTTP 메서드 처리 | "뭐든 다 받을게" |

```typescript
// cats.controller.ts
import { Controller, Get, Post, Put, Patch, Delete } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()        // GET /cats
  findAll() {
    return '모든 고양이 조회';
  }

  @Post()       // POST /cats
  create() {
    return '새 고양이 등록';
  }

  @Put(':id')   // PUT /cats/1, /cats/2 ...
  update() {
    return '고양이 정보 전체 수정';
  }

  @Patch(':id') // PATCH /cats/1, /cats/2 ...
  partialUpdate() {
    return '고양이 정보 부분 수정';
  }

  @Delete(':id') // DELETE /cats/1, /cats/2 ...
  remove() {
    return '고양이 삭제';
  }
}
```

> **Put과 Patch의 차이가 뭔가요?**
> `PUT`은 리소스의 **모든 필드**를 보내서 통째로 교체한다. `PATCH`는 **변경할 필드만** 보내서 부분 수정한다. 실무에서는 `PATCH`를 더 많이 사용한다. 예를 들어 고양이의 이름만 바꾸고 싶다면 `PATCH`가 적합하다.

### 라우트 와일드카드

라우트 경로에 와일드카드 패턴을 사용할 수도 있다. `*` 문자는 어떤 문자열 조합과도 매칭된다.

```typescript
@Get('ab*cd')
findAll() {
  // 'abcd', 'ab_cd', 'abecd', 'ab123cd' 등에 매칭
  return 'This route uses a wildcard';
}
```

---

## 요청 데이터 추출

클라이언트가 서버에 요청을 보낼 때 데이터를 함께 전달하는 방법은 여러 가지다. NestJS는 각 방법에 대응하는 **전용 데코레이터**를 제공한다.

### [@Param()](../references/decorators.md#paramkey) - URL 경로의 동적 파라미터

URL 경로 안에 `:파라미터명` 형태로 동적 값을 포함할 수 있다. [`@Param()`](../references/decorators.md#paramkey) 데코레이터로 이 값을 꺼낸다.

```typescript
// cats.controller.ts
import { Controller, Get, Param } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  // GET /cats/3 이라면 id에 "3"이 들어온다
  @Get(':id')
  findOne(@Param('id') id: string): string {
    return `고양이 #${id} 조회`;
  }

  // 파라미터가 여러 개일 때
  // GET /cats/3/toys/7
  @Get(':catId/toys/:toyId')
  findToy(
    @Param('catId') catId: string,
    @Param('toyId') toyId: string,
  ): string {
    return `고양이 #${catId}의 장난감 #${toyId}`;
  }

  // 파라미터 전체를 객체로 받을 수도 있다
  @Get(':id/info')
  findInfo(@Param() params: { id: string }): string {
    return `고양이 #${params.id} 정보`;
  }
}
```

> **주의:**: [`@Param('id')`](../references/decorators.md#paramkey)로 꺼낸 값은 항상 **문자열(string)**이다. 숫자로 쓰려면 `+id` 또는 `parseInt(id)` 등으로 변환하거나, 나중에 배울 `ParseIntPipe`를 사용한다.

### [@Query()](../references/decorators.md#querykey) - URL 쿼리 문자열

URL 뒤에 `?key=value` 형태로 붙는 데이터를 추출한다. 주로 목록 조회 시 검색 조건, 페이지네이션 등에 사용한다.

```typescript
// cats.controller.ts
import { Controller, Get, Query } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  // GET /cats?page=1&limit=10&sort=name
  @Get()
  findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('sort') sort: string,
  ): string {
    return `페이지: ${page}, 제한: ${limit}, 정렬: ${sort}`;
  }

  // 전체 쿼리 객체를 한 번에 받기
  // GET /cats/search?keyword=persian&category=breed
  @Get('search')
  search(@Query() query: { keyword: string; category: string }): string {
    return `검색어: ${query.keyword}, 카테고리: ${query.category}`;
  }
}
```

### [@Body()](../references/decorators.md#bodykey) - 요청 본문 (Request Body)

`POST`, `PUT`, `PATCH` 요청에서 전송되는 데이터 본문을 추출한다. 보통 JSON 형식으로 전달되며, **DTO(Data Transfer Object)**와 함께 사용한다.

**DTO**는 "데이터가 어떤 모양으로 전달되는지"를 정의하는 클래스다. TypeScript의 인터페이스와 비슷하지만, 클래스를 사용하면 나중에 유효성 검사(Pipe 챕터에서 학습) 등 더 많은 기능을 활용할 수 있다.

```typescript
// cats/dto/create-cat.dto.ts
export class CreateCatDto {
  name: string;
  age: number;
  breed: string;
}
```

```typescript
// cats.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { CreateCatDto } from './dto/create-cat.dto';

@Controller('cats')
export class CatsController {
  // Body 전체를 DTO로 받기
  @Post()
  create(@Body() createCatDto: CreateCatDto) {
    return `이름: ${createCatDto.name}, 나이: ${createCatDto.age}세, 품종: ${createCatDto.breed}`;
  }

  // Body에서 특정 필드만 꺼내기
  @Post('name-only')
  createNameOnly(@Body('name') name: string) {
    return `이름만 추출: ${name}`;
  }
}
```

> **왜 DTO에 interface가 아닌 class를 쓰나요?**
> TypeScript의 interface는 컴파일 후 사라져서 런타임에 사용할 수 없다. 반면 class는 컴파일 후에도 남아 있어서, NestJS의 Pipe(유효성 검사)나 Swagger(API 문서화)에서 활용할 수 있다. NestJS 공식 문서에서도 DTO에 class를 사용하는 것을 권장한다.

### [@Headers()](../references/decorators.md#headerskey) - 요청 헤더

HTTP 요청의 헤더 값을 추출한다.

```typescript
// cats.controller.ts
import { Controller, Get, Headers } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(@Headers('authorization') auth: string) {
    console.log('인증 토큰:', auth);
    return '고양이 목록';
  }

  // 헤더 전체를 객체로 받기
  @Get('debug')
  debug(@Headers() headers: Record<string, string>) {
    return headers;
  }
}
```

### 전체 요청 데코레이터 정리

| NestJS 데코레이터 | 추출 대상 | Express 동등 표현 |
|---|---|---|
| [`@Req()`](../references/decorators.md#req-res) / [`@Request()`](../references/decorators.md#req-res) | 요청 객체 전체 | `req` |
| [`@Res()`](../references/decorators.md#req-res) / [`@Response()`](../references/decorators.md#req-res) | 응답 객체 전체 | `res` |
| [`@Param(key?)`](../references/decorators.md#paramkey) | URL 경로 파라미터 | `req.params` / `req.params[key]` |
| [`@Query(key?)`](../references/decorators.md#querykey) | 쿼리 파라미터 | `req.query` / `req.query[key]` |
| [`@Body(key?)`](../references/decorators.md#bodykey) | 요청 본문 | `req.body` / `req.body[key]` |
| [`@Headers(name?)`](../references/decorators.md#http-메서드-데코레이터) | 요청 헤더 | `req.headers` / `req.headers[name]` |
| [`@Ip()`](../references/decorators.md#ip) | 클라이언트 IP | `req.ip` |
| `@Session()` | 세션 객체 | `req.session` |
| [`@HostParam()`](../references/decorators.md#hostparamkey) | 호스트 파라미터 | `req.hosts` |

---

## 응답 처리

NestJS에서 클라이언트에게 응답을 보내는 방법은 크게 두 가지가 있다.

### 방식 1: 표준 방식 (권장)

메서드에서 값을 **return**하면 NestJS가 알아서 처리한다. 이것이 가장 간단하고 권장되는 방식이다.

- **객체/배열을 반환** -> 자동으로 JSON으로 변환(직렬화)
- **문자열을 반환** -> 그대로 텍스트로 응답
- **기본 상태 코드**: `GET`은 `200`, `POST`는 `201`

```typescript
// cats.controller.ts
@Controller('cats')
export class CatsController {
  @Get()
  findAll() {
    // 배열을 return하면 자동으로 JSON 응답, 상태 코드 200
    return [
      { id: 1, name: 'Kitty', age: 2 },
      { id: 2, name: 'Nabi', age: 3 },
    ];
  }

  @Post()
  create(@Body() body: CreateCatDto) {
    // 객체를 return하면 자동으로 JSON 응답, 상태 코드 201 (POST 기본값)
    return { id: 3, ...body };
  }
}
```

### 방식 2: 라이브러리 특정 방식 ([@Res](../references/decorators.md#req-res))

Express의 `Response` 객체를 직접 사용하여 응답을 세밀하게 제어할 수 있다.

```typescript
// cats.controller.ts
import { Controller, Get, Post, Body, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(@Res() res: Response) {
    res.status(HttpStatus.OK).json([
      { id: 1, name: 'Kitty' },
    ]);
  }

  @Post()
  create(@Res() res: Response, @Body() body: CreateCatDto) {
    res.status(HttpStatus.CREATED).json({
      id: 3,
      ...body,
    });
  }
}
```

> **주의:**: [`@Res()`](../references/decorators.md#req-res)를 사용하면 NestJS의 표준 응답 처리(인터셉터 등)가 **비활성화**된다. 표준 방식과 함께 쓰고 싶다면 [`@Res({ passthrough: true })`](../references/decorators.md#req-res)를 사용한다.

```typescript
@Get()
findAll(@Res({ passthrough: true }) res: Response) {
  res.status(HttpStatus.OK);
  // passthrough 모드에서는 return 값이 응답 본문으로 사용된다
  return [{ id: 1, name: 'Kitty' }];
}
```

> **초보자에게 추천하는 방식은?**
> 특별한 이유가 없다면 **표준 방식(return)**을 사용하자. 코드가 간결하고, NestJS의 인터셉터와 예외 필터 등 다양한 기능과 잘 연동된다. [`@Res()`](../references/decorators.md#req-res)는 파일 다운로드, 스트리밍 등 특수한 상황에서만 사용하는 것이 좋다.

---

## [@HttpCode](../references/decorators.md#httpcodestatuscode), @Header, [@Redirect](../references/decorators.md#redirecturl-statuscode)

### [@HttpCode()](../references/decorators.md#httpcodestatuscode) - 상태 코드 변경

기본적으로 `GET`은 `200`, `POST`는 `201`을 반환한다. [`@HttpCode()`](../references/decorators.md#httpcodestatuscode) 데코레이터로 이 기본값을 변경할 수 있다.

```typescript
// cats.controller.ts
import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  // POST인데 201이 아닌 200을 반환하고 싶을 때
  @Post('check')
  @HttpCode(200)
  check() {
    return { available: true };
  }

  // 본문 없이 204(No Content) 응답
  @Post('reset')
  @HttpCode(HttpStatus.NO_CONTENT) // 숫자 204 대신 상수 사용 (가독성 향상)
  reset() {
    // 본문 없이 204 응답
  }
}
```

자주 사용하는 상태 코드 상수는 다음과 같다.

| 상수 | 값 | 의미 |
|---|---|---|
| `HttpStatus.OK` | 200 | 요청 성공 |
| `HttpStatus.CREATED` | 201 | 리소스 생성 성공 |
| `HttpStatus.NO_CONTENT` | 204 | 성공, 응답 본문 없음 |
| `HttpStatus.BAD_REQUEST` | 400 | 잘못된 요청 |
| `HttpStatus.NOT_FOUND` | 404 | 리소스를 찾을 수 없음 |

### @Header() - 응답 헤더 설정

[`@Header()`](../references/decorators.md#http-메서드-데코레이터) 데코레이터로 커스텀 응답 헤더를 추가할 수 있다.

```typescript
// cats.controller.ts
import { Controller, Get, Header } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  @Header('Cache-Control', 'no-store')
  @Header('X-Custom-Header', 'my-value')
  findAll() {
    return [{ id: 1, name: 'Kitty' }];
  }
}
```

### [@Redirect()](../references/decorators.md#redirecturl-statuscode) - 리다이렉트

[`@Redirect()`](../references/decorators.md#redirecturl-statuscode) 데코레이터로 클라이언트를 다른 URL로 이동시킬 수 있다.

```typescript
// cats.controller.ts
import { Controller, Get, Query, Redirect } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  // GET /cats/old -> 302 리다이렉트
  @Get('old')
  @Redirect('/cats', 302)
  redirectToNew() {
    // 데코레이터에 지정된 URL로 리다이렉트
  }

  // 조건에 따라 동적으로 리다이렉트 대상을 변경할 수 있다
  @Get('docs')
  @Redirect('https://docs.nestjs.com', 302)
  getDocs(@Query('version') version: string) {
    if (version === 'v10') {
      // return으로 객체를 반환하면 데코레이터의 기본값을 덮어쓴다
      return { url: 'https://docs.nestjs.com/v10/', statusCode: 301 };
    }
    // 반환값이 없으면 데코레이터에 지정된 기본값 사용
  }
}
```

---

## 비동기 처리

실제 애플리케이션에서는 데이터베이스 조회, 외부 API 호출 등 시간이 걸리는 작업을 처리해야 한다. NestJS의 핸들러 메서드는 `async/await`를 완벽하게 지원한다.

### async/await 방식

```typescript
// cats.controller.ts
import { Controller, Get } from '@nestjs/common';

@Controller('cats')
export class CatsController {
  @Get()
  async findAll(): Promise<any[]> {
    // 데이터베이스 조회, 외부 API 호출 등 비동기 작업을 await로 처리
    const cats = await someAsyncOperation();
    return cats;
  }
}
```

### RxJS Observable 방식

NestJS는 RxJS `Observable`도 지원한다. Observable을 반환하면 NestJS가 자동으로 구독하고 값을 응답으로 사용한다.

```typescript
// cats.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Observable, of } from 'rxjs';

@Controller('cats')
export class CatsController {
  @Get()
  findAll(): Observable<any[]> {
    return of([
      { id: 1, name: 'Kitty', age: 2, breed: 'Persian' },
      { id: 2, name: 'Nabi', age: 3, breed: 'Korean Shorthair' },
    ]);
  }
}
```

> **어떤 방식을 써야 하나요?**
> 두 방식 모두 유효하지만, 일반적으로 **`async/await`가 더 직관적**이고 대부분의 상황에서 충분하다. RxJS에 익숙하다면 Observable을 사용해도 좋다.

---

# 2단계: 기본 예제

## CatsController CRUD 예제

1단계에서 배운 개념들을 모두 활용하여, 고양이(Cat) 리소스에 대한 CRUD(Create, Read, Update, Delete) 컨트롤러를 만들어 보자.

### DTO 정의

먼저, 요청 데이터의 형태를 정의하는 DTO를 만든다.

```typescript
// cats/dto/create-cat.dto.ts
export class CreateCatDto {
  readonly name: string;
  readonly age: number;
  readonly breed: string;
}
```

```typescript
// cats/dto/update-cat.dto.ts
export class UpdateCatDto {
  readonly name?: string;   // 부분 수정이므로 모든 필드가 선택적(optional)
  readonly age?: number;
  readonly breed?: string;
}
```

> **readonly를 붙이는 이유**: DTO는 데이터를 "전달"하는 용도이므로, 컨트롤러에서 실수로 값을 변경하지 않도록 `readonly`를 붙이는 것이 좋은 습관이다.

### Controller 구현

```typescript
// cats/cats.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';

@Controller('cats')
export class CatsController {
  // 이 시점에서는 Service가 없으므로 메모리 배열로 데이터를 관리한다
  private cats = [
    { id: 1, name: 'Kitty', age: 2, breed: 'Persian' },
    { id: 2, name: 'Nabi', age: 3, breed: 'Korean Shorthair' },
  ];
  private nextId = 3;

  // ──────────────────────────────────────
  // 1. 전체 조회 (GET /cats?page=1&limit=10)
  // ──────────────────────────────────────
  @Get()
  @Header('Cache-Control', 'no-cache')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    console.log(`page: ${page}, limit: ${limit}`);
    return this.cats;
  }

  // ──────────────────────────────────────
  // 2. 단건 조회 (GET /cats/:id)
  // ──────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    const cat = this.cats.find((c) => c.id === +id);
    if (!cat) {
      return { message: `Cat #${id} not found` };
    }
    return cat;
  }

  // ──────────────────────────────────────
  // 3. 생성 (POST /cats)
  // ──────────────────────────────────────
  @Post()
  // POST는 기본 상태 코드가 201이므로 별도 @HttpCode 불필요
  create(@Body() createCatDto: CreateCatDto) {
    const newCat = {
      id: this.nextId++,
      ...createCatDto,
    };
    this.cats.push(newCat);
    return newCat;
  }

  // ──────────────────────────────────────
  // 4. 수정 (PATCH /cats/:id)
  // ──────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCatDto: UpdateCatDto) {
    const index = this.cats.findIndex((c) => c.id === +id);
    if (index === -1) {
      return { message: `Cat #${id} not found` };
    }
    this.cats[index] = { ...this.cats[index], ...updateCatDto };
    return this.cats[index];
  }

  // ──────────────────────────────────────
  // 5. 삭제 (DELETE /cats/:id)
  // ──────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT) // 삭제 성공 시 본문 없이 204 응답
  remove(@Param('id') id: string) {
    this.cats = this.cats.filter((c) => c.id !== +id);
  }
}
```

### Module 등록

```typescript
// cats/cats.module.ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';

@Module({
  controllers: [CatsController],
})
export class CatsModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CatsModule } from './cats/cats.module';

@Module({
  imports: [CatsModule],
})
export class AppModule {}
```

---

## curl로 API 테스트하기

서버를 `npm run start:dev`로 실행한 뒤, 터미널에서 다음 명령어로 API를 테스트할 수 있다.

```bash
# 1. 전체 조회
curl http://localhost:3000/cats
# 응답: [{"id":1,"name":"Kitty","age":2,"breed":"Persian"},{"id":2,"name":"Nabi","age":3,"breed":"Korean Shorthair"}]

# 2. 쿼리 파라미터와 함께 조회
curl "http://localhost:3000/cats?page=1&limit=10"

# 3. 단건 조회
curl http://localhost:3000/cats/1
# 응답: {"id":1,"name":"Kitty","age":2,"breed":"Persian"}

# 4. 생성
curl -X POST http://localhost:3000/cats \
  -H "Content-Type: application/json" \
  -d '{"name": "Momo", "age": 1, "breed": "Scottish Fold"}'
# 응답: {"id":3,"name":"Momo","age":1,"breed":"Scottish Fold"}

# 5. 수정 (이름만 변경)
curl -X PATCH http://localhost:3000/cats/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Kitty Updated"}'
# 응답: {"id":1,"name":"Kitty Updated","age":2,"breed":"Persian"}

# 6. 삭제
curl -X DELETE http://localhost:3000/cats/1 -v
# 응답: 204 No Content (본문 없음)
```

> **curl이 익숙하지 않다면?**
> Postman, Insomnia, VS Code의 REST Client 확장 등 GUI 도구를 사용해도 된다. 원리는 동일하다.

---

# 3단계: 블로그 API 적용

이제 배운 내용을 실제 블로그 API에 적용해 보자. 챕터 1에서 만든 모듈 구조(`UsersModule`, `PostsModule`, `CommentsModule`)에 각각 컨트롤러를 추가한다.

> **이 시점의 한계**: 아직 Service(Provider)를 배우지 않았으므로, 컨트롤러 안에서 직접 메모리 배열로 데이터를 관리한다. 다음 챕터(Provider & DI)에서 비즈니스 로직을 Service로 분리할 것이다.

---

## UsersController

사용자 관련 엔드포인트를 정의한다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/users` | 회원가입 |
| `GET` | `/users/:id` | 프로필 조회 |

### DTO 정의

```typescript
// users/dto/create-user.dto.ts
export class CreateUserDto {
  readonly email: string;
  readonly password: string;
  readonly name: string;
}
```

### Controller 구현

```typescript
// users/users.controller.ts
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  private users = [
    { id: 1, email: 'hong@example.com', name: '홍길동', createdAt: '2025-01-01' },
  ];
  private nextId = 2;

  // ──────────────────────────────────────
  // POST /users - 회원가입
  // ──────────────────────────────────────
  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    const newUser = {
      id: this.nextId++,
      email: createUserDto.email,
      name: createUserDto.name,
      // 비밀번호는 응답에 포함하지 않는다 (보안)
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.users.push(newUser);
    return newUser;
  }

  // ──────────────────────────────────────
  // GET /users/:id - 프로필 조회
  // ──────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    const user = this.users.find((u) => u.id === +id);
    if (!user) {
      return { message: `User #${id}를 찾을 수 없습니다` };
    }
    return user;
  }
}
```

### curl 테스트

```bash
# 회원가입
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "kim@example.com", "password": "password123", "name": "김철수"}'

# 프로필 조회
curl http://localhost:3000/users/1
```

---

## PostsController

게시글 관련 CRUD 전체를 정의한다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/posts` | 게시글 목록 (쿼리: page, limit, search) |
| `GET` | `/posts/:id` | 게시글 상세 조회 |
| `POST` | `/posts` | 게시글 작성 |
| `PATCH` | `/posts/:id` | 게시글 수정 |
| `DELETE` | `/posts/:id` | 게시글 삭제 |

### DTO 정의

```typescript
// posts/dto/create-post.dto.ts
export class CreatePostDto {
  readonly title: string;
  readonly content: string;
  readonly authorId: number;
}
```

```typescript
// posts/dto/update-post.dto.ts
export class UpdatePostDto {
  readonly title?: string;
  readonly content?: string;
}
```

### Controller 구현

```typescript
// posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  private posts = [
    {
      id: 1,
      title: '첫 번째 게시글',
      content: 'NestJS를 배우기 시작했습니다!',
      authorId: 1,
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    },
  ];
  private nextId = 2;

  // ──────────────────────────────────────
  // GET /posts?page=1&limit=10&search=nest
  // 게시글 목록 조회 (페이지네이션, 검색)
  // ──────────────────────────────────────
  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    let result = this.posts;

    // 검색어가 있으면 제목에서 필터링
    if (search) {
      result = result.filter((post) =>
        post.title.includes(search),
      );
    }

    // 실제 페이지네이션은 Service에서 처리하겠지만, 여기서는 간단히 구현
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const start = (pageNum - 1) * limitNum;
    const end = start + limitNum;

    return {
      data: result.slice(start, end),
      total: result.length,
      page: pageNum,
      limit: limitNum,
    };
  }

  // ──────────────────────────────────────
  // GET /posts/:id - 게시글 상세 조회
  // ──────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    const post = this.posts.find((p) => p.id === +id);
    if (!post) {
      return { message: `Post #${id}를 찾을 수 없습니다` };
    }
    return post;
  }

  // ──────────────────────────────────────
  // POST /posts - 게시글 작성
  // ──────────────────────────────────────
  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    const now = new Date().toISOString().split('T')[0];
    const newPost = {
      id: this.nextId++,
      ...createPostDto,
      createdAt: now,
      updatedAt: now,
    };
    this.posts.push(newPost);
    return newPost;
  }

  // ──────────────────────────────────────
  // PATCH /posts/:id - 게시글 수정
  // ──────────────────────────────────────
  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePostDto: UpdatePostDto) {
    const index = this.posts.findIndex((p) => p.id === +id);
    if (index === -1) {
      return { message: `Post #${id}를 찾을 수 없습니다` };
    }
    this.posts[index] = {
      ...this.posts[index],
      ...updatePostDto,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    return this.posts[index];
  }

  // ──────────────────────────────────────
  // DELETE /posts/:id - 게시글 삭제
  // ──────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.posts = this.posts.filter((p) => p.id !== +id);
  }
}
```

### curl 테스트

```bash
# 게시글 목록 조회
curl http://localhost:3000/posts

# 검색 + 페이지네이션
curl "http://localhost:3000/posts?search=NestJS&page=1&limit=5"

# 게시글 상세 조회
curl http://localhost:3000/posts/1

# 게시글 작성
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "두 번째 게시글", "content": "Controller를 배웠습니다!", "authorId": 1}'

# 게시글 수정 (제목만 변경)
curl -X PATCH http://localhost:3000/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "제목 수정됨"}'

# 게시글 삭제
curl -X DELETE http://localhost:3000/posts/1 -v
```

---

## CommentsController

댓글은 게시글에 종속된 리소스이므로, URL 구조가 조금 특별하다. 댓글 작성과 조회는 **게시글 하위 경로**(`/posts/:postId/comments`)로, 삭제는 **댓글 자체 경로**(`/comments/:id`)로 설계한다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/posts/:postId/comments` | 댓글 작성 |
| `GET` | `/posts/:postId/comments` | 해당 게시글의 댓글 목록 |
| `DELETE` | `/comments/:id` | 댓글 삭제 |

> **왜 두 가지 경로 패턴을 섞어 쓰나요?**
> 댓글을 작성하고 조회할 때는 "어떤 게시글의 댓글인지"가 중요하므로 `/posts/:postId/comments`가 직관적이다. 하지만 삭제할 때는 댓글 ID만 있으면 충분하므로 `/comments/:id`가 더 깔끔하다. 이런 식으로 RESTful API에서는 맥락에 맞는 URL을 설계한다.

### DTO 정의

```typescript
// comments/dto/create-comment.dto.ts
export class CreateCommentDto {
  readonly content: string;
  readonly authorId: number;
}
```

### Controller 구현

댓글은 두 가지 경로 패턴을 사용하므로, 컨트롤러를 두 개로 나눈다.

```typescript
// comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';

// ──────────────────────────────────────
// 게시글 하위의 댓글 라우트
// POST /posts/:postId/comments
// GET  /posts/:postId/comments
// ──────────────────────────────────────
@Controller('posts/:postId/comments')
export class PostCommentsController {
  // 여러 컨트롤러에서 같은 데이터를 공유하려면 Service가 필요하다.
  // 지금은 임시로 static 배열을 사용한다.
  static comments = [
    { id: 1, postId: 1, content: '좋은 글이네요!', authorId: 1, createdAt: '2025-01-01' },
  ];
  static nextId = 2;

  @Post()
  create(
    @Param('postId') postId: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const newComment = {
      id: PostCommentsController.nextId++,
      postId: +postId,
      ...createCommentDto,
      createdAt: new Date().toISOString().split('T')[0],
    };
    PostCommentsController.comments.push(newComment);
    return newComment;
  }

  @Get()
  findAll(@Param('postId') postId: string) {
    return PostCommentsController.comments.filter(
      (c) => c.postId === +postId,
    );
  }
}

// ──────────────────────────────────────
// 댓글 자체 라우트
// DELETE /comments/:id
// ──────────────────────────────────────
@Controller('comments')
export class CommentsController {
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    PostCommentsController.comments = PostCommentsController.comments.filter(
      (c) => c.id !== +id,
    );
  }
}
```

> **static을 쓴 이유**: 지금은 Service가 없어서 두 컨트롤러가 같은 데이터에 접근해야 한다. `static`으로 선언하면 클래스 인스턴스가 아닌 클래스 자체에 데이터가 저장되어 공유가 가능하다. 하지만 이것은 **임시 방편**이다. 다음 챕터에서 Service를 배우면 데이터 관리를 Service로 옮기게 된다.

### curl 테스트

```bash
# 댓글 작성 (게시글 1번에 댓글 추가)
curl -X POST http://localhost:3000/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "정말 유익한 글입니다!", "authorId": 2}'

# 댓글 목록 조회 (게시글 1번의 댓글들)
curl http://localhost:3000/posts/1/comments

# 댓글 삭제
curl -X DELETE http://localhost:3000/comments/1 -v
```

---

## 모듈에 컨트롤러 등록

각 컨트롤러를 해당 모듈에 등록한다. 챕터 1에서 만든 모듈 구조를 그대로 이어받는다.

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
})
export class UsersModule {}
```

```typescript
// posts/posts.module.ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';

@Module({
  controllers: [PostsController],
})
export class PostsModule {}
```

```typescript
// comments/comments.module.ts
import { Module } from '@nestjs/common';
import { PostCommentsController, CommentsController } from './comments.controller';

@Module({
  controllers: [PostCommentsController, CommentsController], // 두 컨트롤러 모두 등록
})
export class CommentsModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [UsersModule, PostsModule, CommentsModule],
})
export class AppModule {}
```

### 최종 폴더 구조

```
src/
├── app.module.ts
├── main.ts
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── dto/
│       └── create-user.dto.ts
│
├── posts/
│   ├── posts.module.ts
│   ├── posts.controller.ts
│   └── dto/
│       ├── create-post.dto.ts
│       └── update-post.dto.ts
│
└── comments/
    ├── comments.module.ts
    ├── comments.controller.ts
    └── dto/
        └── create-comment.dto.ts
```

---

## 다음 챕터 예고

이번 챕터에서는 Controller 안에서 직접 데이터를 관리했다. 이 방식에는 여러 문제가 있다.

- **컨트롤러가 너무 많은 일을 한다**: 요청 처리 + 데이터 관리 + 비즈니스 로직이 모두 한 곳에 있다
- **데이터 공유가 어렵다**: 댓글 컨트롤러에서 `static`을 써야 했던 것처럼, 여러 곳에서 같은 데이터에 접근하기 까다롭다
- **테스트가 어렵다**: 컨트롤러와 로직이 강하게 결합되어 있어 단위 테스트가 힘들다

다음 챕터 **"Chapter 3 - Provider & DI"**에서는 비즈니스 로직을 **Service**로 분리하고, NestJS의 **의존성 주입(Dependency Injection)** 시스템을 배운다. 컨트롤러는 요청/응답 처리에만 집중하고, 실제 데이터 처리는 Service에 맡기는 깔끔한 구조로 개선할 것이다.

---

## 정리

| 개념 | 데코레이터/키워드 | 설명 |
|---|---|---|
| 컨트롤러 선언 | [`@Controller('prefix')`](../references/decorators.md#controllerprefix) | 클래스를 컨트롤러로 등록, 라우트 접두사 지정 |
| HTTP 메서드 | [`@Get()`](../references/decorators.md#http-메서드-데코레이터), [`@Post()`](../references/decorators.md#http-메서드-데코레이터), [`@Patch()`](../references/decorators.md#http-메서드-데코레이터), [`@Delete()`](../references/decorators.md#http-메서드-데코레이터) 등 | 요청 메서드별 핸들러 지정 |
| 라우트 파라미터 | [`@Param('key')`](../references/decorators.md#paramkey) | URL 경로의 동적 값 추출 (`:id`) |
| 쿼리 파라미터 | [`@Query('key')`](../references/decorators.md#querykey) | 쿼리 문자열 값 추출 (`?key=value`) |
| 요청 본문 | [`@Body()`](../references/decorators.md#bodykey) | 요청 본문 추출, DTO와 함께 사용 |
| 요청 헤더 | [`@Headers('name')`](../references/decorators.md#http-메서드-데코레이터) | HTTP 요청 헤더 값 추출 |
| 상태 코드 | [`@HttpCode(204)`](../references/decorators.md#httpcodestatuscode) | 응답 상태 코드 지정 |
| 헤더 설정 | [`@Header('key', 'value')`](../references/decorators.md#http-메서드-데코레이터) | 응답 헤더 추가 |
| 리다이렉트 | [`@Redirect('url', 301)`](../references/decorators.md#redirecturl-statuscode) | URL 리다이렉트 |
| 비동기 처리 | `async/await`, `Observable` | 비동기 요청 처리 |
| 응답 방식 | `return` (표준) / [`@Res()`](../references/decorators.md#req-res) (Express) | 표준 방식 권장 |
