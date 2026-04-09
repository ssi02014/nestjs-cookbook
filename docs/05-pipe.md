# 챕터 5 - Pipe (파이프)

> **이전 챕터 요약**: 챕터 4에서 모든 요청을 로깅하는 LoggerMiddleware와 CORS 설정을 블로그 API에 추가했다. 이번 챕터에서는 **Pipe**를 학습하여 클라이언트 입력값을 검증하고 변환하는 DTO를 정의한다.


## 목차

### 1단계: 개념 학습
1. [Pipe란 무엇인가](#1-pipe란-무엇인가)
2. [내장 파이프 종류](#2-내장-파이프-종류)
3. [파이프 바인딩 레벨](#3-파이프-바인딩-레벨)
4. [DTO(Data Transfer Object) 패턴](#4-dtodata-transfer-object-패턴)
5. [class-validator와 class-transformer](#5-class-validator와-class-transformer)
6. [배열 검증](#6-배열-검증)
7. [중첩 객체 검증 (Nested Validation)](#7-중첩-객체-검증-nested-validation)
8. [ValidationPipe 옵션](#8-validationpipe-옵션)
9. [커스텀 파이프 만들기](#9-커스텀-파이프-만들기)

### 2단계: 기본 예제
10. [기본 예제](#10-기본-예제)

### 3단계: 블로그 API 적용
11. [블로그 API에 Pipe 적용하기](#11-블로그-api에-pipe-적용하기)
12. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
13. [정리](#정리)
14. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---

## 1. Pipe란 무엇인가

Pipe는 [`@Injectable()`](references/decorators.md#injectableoptions) 데코레이터가 붙은 클래스로, `PipeTransform` 인터페이스를 구현한다. 컨트롤러 핸들러가 호출되기 **직전**에 실행되며, 두 가지 역할을 수행한다.

### 변환 (Transformation)

입력 데이터를 원하는 형태로 변환한다. 예를 들어 URL 파라미터로 들어온 문자열 `"123"`을 숫자 `123`으로 변환하는 작업이다.

### 유효성 검사 (Validation)

입력 데이터가 올바른지 검증한다. 유효하면 그대로 통과시키고, 유효하지 않으면 예외를 던진다.

### 요청 파이프라인에서의 위치

```
[Client] --> [Middleware] --> [Guard] --> [Pipe] --> [Controller Handler]
                                           ^
                                  변환 & 유효성 검사
```

> **참고:** Pipe에서 예외가 발생하면 컨트롤러 핸들러는 **실행되지 않는다**. 잘못된 데이터가 비즈니스 로직에 도달하는 것을 사전에 차단할 수 있다.

---

## 2. 내장 파이프 종류

NestJS는 `@nestjs/common` 패키지에서 다양한 내장 파이프를 제공한다.

| 파이프 | 설명 |
|--------|------|
| `ValidationPipe` | DTO 클래스 기반 유효성 검사 (class-validator 활용) |
| `ParseIntPipe` | 문자열을 정수(`number`)로 변환 |
| `ParseFloatPipe` | 문자열을 부동소수점(`number`)으로 변환 |
| `ParseBoolPipe` | 문자열을 불리언(`boolean`)으로 변환 |
| `ParseArrayPipe` | 값을 배열로 변환 |
| `ParseUUIDPipe` | 문자열이 UUID 형식인지 검증 |
| `ParseEnumPipe` | 값이 특정 enum에 속하는지 검증 |
| `DefaultValuePipe` | 값이 `null` 또는 `undefined`일 때 기본값 설정 |
| `ParseFilePipe` | 파일 업로드 유효성 검사 (크기, MIME 타입 등) |

> **팁:** 실무에서 가장 많이 쓰는 파이프는 `ValidationPipe`(DTO 검증)와 `ParseIntPipe`(`:id` 파라미터 변환)이다. 이 두 가지만 먼저 익히면 대부분의 상황에 대응할 수 있다.

### 주요 내장 파이프 실전 예시

**ParseEnumPipe** — 쿼리 파라미터가 특정 enum 값인지 검증한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Query, ParseEnumPipe } from '@nestjs/common';

enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Controller('posts')
export class PostsController {
  @Get()
  findAll(
    @Query('status', new ParseEnumPipe(PostStatus)) status: PostStatus,
  ) {
    // GET /posts?status=published  → PostStatus.PUBLISHED
    // GET /posts?status=invalid    → 400 Bad Request
    return this.postsService.findByStatus(status);
  }
}
```

> **팁:** 상태값, 카테고리, 정렬 방식 등 미리 정해진 값 목록을 쿼리로 받을 때 유용하다. enum에 없는 값은 자동으로 400 에러를 반환한다.

**ParseUUIDPipe** — 경로 파라미터가 UUID 형식인지 검증한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get(':uuid')
  findOne(@Param('uuid', new ParseUUIDPipe()) uuid: string) {
    // GET /posts/550e8400-e29b-41d4-a716-446655440000  → uuid 그대로
    // GET /posts/not-a-uuid  → 400 Bad Request
    return this.postsService.findByUuid(uuid);
  }
}
```

UUID 버전을 명시적으로 지정할 수도 있다.

```typescript
// UUID v4만 허용
@Get(':uuid')
findOne(@Param('uuid', new ParseUUIDPipe({ version: '4' })) uuid: string) {
  return this.postsService.findByUuid(uuid);
}
```

**ParseArrayPipe** — 쿼리 파라미터의 쉼표 구분 값을 배열로 변환한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Query, ParseArrayPipe } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get('by-ids')
  findByIds(
    @Query('ids', new ParseArrayPipe({ items: Number, separator: ',' }))
    ids: number[],
  ) {
    // GET /posts/by-ids?ids=1,2,3  → ids = [1, 2, 3]
    return this.postsService.findByIds(ids);
  }
}
```

> **참고:** `ParseArrayPipe`의 `items` 옵션에는 `Number`, `String`, `Boolean` 또는 DTO 클래스를 지정할 수 있다. `separator` 기본값은 `,`이다.

---

## 3. 파이프 바인딩 레벨

파이프는 4가지 레벨에서 바인딩할 수 있다. 범위가 좁은 것부터 넓은 순서로 살펴본다.

### 3-1. 파라미터 레벨 (Parameter-scoped)

특정 파라미터 하나에만 파이프를 적용한다.

```typescript
// posts.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // 'id' 파라미터에만 ParseIntPipe가 적용됨
    // URL의 "123" 문자열이 숫자 123으로 변환됨
    return this.postsService.findOne(id);
  }
}
```

### 3-2. 메서드 레벨 (Method-scoped)

[`@UsePipes()`](references/decorators.md#usepipespipes) 데코레이터로 특정 핸들러의 모든 파라미터에 파이프를 적용한다.

```typescript
// posts.controller.ts
import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostsController {
  @Post()
  @UsePipes(new ValidationPipe())
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }
}
```

### 3-3. 컨트롤러 레벨 (Controller-scoped)

컨트롤러 클래스에 [`@UsePipes()`](references/decorators.md#usepipespipes)를 적용하면 해당 컨트롤러의 모든 핸들러에 파이프가 적용된다.

```typescript
// posts.controller.ts
import { Controller, UsePipes, ValidationPipe } from '@nestjs/common';

@Controller('posts')
@UsePipes(new ValidationPipe())
export class PostsController {
  // 이 컨트롤러의 모든 핸들러에 ValidationPipe가 적용됨
}
```

### 3-4. 글로벌 레벨 (Global-scoped)

애플리케이션 전체에 파이프를 적용한다. 두 가지 방법이 있다.

**방법 1: main.ts에서 설정**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

> 이 방식은 DI 컨테이너 외부에서 등록하므로, 파이프 내에서 의존성 주입을 사용할 수 없다.

**방법 2: 모듈에서 APP_PIPE 토큰으로 등록 (DI 가능)**

```typescript
// src/app.module.ts
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
```

> **팁:** 실무에서는 대부분 **글로벌 레벨**로 `ValidationPipe`를 적용한다. 모든 엔드포인트에서 일관되게 유효성 검사가 적용되므로 누락 위험이 없다. `main.ts` 방식이 간단하고 가장 흔하게 사용된다.

---

## 4. DTO(Data Transfer Object) 패턴

### DTO란?

DTO는 계층 간 데이터 전송을 위한 객체다. NestJS에서는 주로 **클라이언트로부터 받는 요청 데이터의 형태**를 정의하는 데 사용한다.

### DTO를 사용하는 이유

- **타입 안전성**: 요청 데이터의 타입을 명확히 정의
- **유효성 검사**: class-validator 데코레이터를 통한 자동 검증
- **문서화**: 어떤 데이터가 필요한지 코드 자체가 문서 역할
- **재사용성**: 여러 곳에서 동일한 데이터 구조를 재사용

### 왜 interface가 아닌 class를 쓰는가?

```typescript
// Interface 방식 - 컴파일 후 사라짐 (런타임에 존재하지 않음)
interface CreatePostInput {
  title: string;
  content: string;
}

// Class 방식 - 컴파일 후에도 남아 있음 (런타임에 존재함)
class CreatePostDto {
  title: string;
  content: string;
}
```

TypeScript의 interface는 컴파일 과정에서 완전히 제거된다. JavaScript로 변환되면 interface의 흔적이 남지 않는다. 반면 class는 컴파일 후에도 JavaScript 코드로 남아 있다.

`ValidationPipe`는 런타임에 DTO 클래스의 메타데이터를 읽어서 유효성 검사를 수행한다. interface는 런타임에 존재하지 않으므로 메타데이터를 읽을 수 없다. 그래서 NestJS에서 DTO는 반드시 **class**로 정의해야 한다.

> **초보자를 위한 비유:** interface는 설계 도면이고, class는 실제 건물이다. 건물이 지어진 후(컴파일 후) 설계 도면(interface)은 사라지지만, 건물(class)은 그대로 남아 있어 검사관(ValidationPipe)이 확인할 수 있다.

---

## 5. class-validator와 class-transformer

### 패키지 설치

```bash
npm install class-validator class-transformer
```

`class-validator`는 데코레이터 기반으로 유효성 검사 규칙을 선언하는 라이브러리이고, `class-transformer`는 일반 객체를 클래스 인스턴스로 변환하는 라이브러리다. 이 둘은 `ValidationPipe`와 함께 사용된다.

### class-validator 주요 데코레이터

| 데코레이터 | 설명 |
|------------|------|
| `@IsString()` | 문자열인지 검증 |
| `@IsNumber()` | 숫자인지 검증 |
| `@IsBoolean()` | 불리언인지 검증 |
| `@IsEmail()` | 이메일 형식인지 검증 |
| `@IsNotEmpty()` | 빈 값이 아닌지 검증 |
| `@IsOptional()` | 선택적 필드 (값이 없으면 검증 건너뜀) |
| `@MinLength(n)` | 최소 문자열 길이 |
| `@MaxLength(n)` | 최대 문자열 길이 |
| `@Min(n)` | 최소 숫자 값 |
| `@Max(n)` | 최대 숫자 값 |
| `@Matches(regex)` | 정규식 패턴 매칭 |
| `@IsEnum(entity)` | enum 값인지 검증 |
| `@IsArray()` | 배열인지 검증 |
| `@ValidateNested()` | 중첩 객체 검증 |

### class-transformer의 @Type() 데코레이터

쿼리 파라미터는 항상 문자열로 들어온다. `@Type(() => Number)`를 사용하면 문자열을 숫자로 변환할 수 있다. 중첩 객체를 변환할 때도 사용한다.

```typescript
import { Type } from 'class-transformer';
import { IsOptional, IsInt, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number) // 쿼리 문자열 "1"을 숫자 1로 변환
  page?: number;
}
```

---

## 6. 배열 검증

배열 타입의 필드를 검증할 때는 `@IsArray()`, `@ArrayMinSize()`, `@ArrayMaxSize()` 데코레이터를 조합해 사용한다.

### 주요 배열 관련 데코레이터

| 데코레이터 | 설명 |
|------------|------|
| `@IsArray()` | 값이 배열인지 검증 |
| `@ArrayMinSize(n)` | 배열의 최소 원소 개수 |
| `@ArrayMaxSize(n)` | 배열의 최대 원소 개수 |
| `@ArrayNotEmpty()` | 배열이 비어있지 않은지 검증 |
| `@ArrayUnique()` | 배열 원소가 고유한지 검증 |

### 태그 배열 검증 예제

블로그 게시글 작성 시 태그를 최대 5개까지 붙일 수 있는 경우를 예로 들어보자.

```typescript
// dto/create-post.dto.ts
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
} from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: '제목은 필수 입력 항목입니다.' })
  @MaxLength(100, { message: '제목은 100자 이내로 작성해주세요.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '내용은 필수 입력 항목입니다.' })
  @MinLength(10, { message: '내용은 최소 10자 이상이어야 합니다.' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'tags는 배열이어야 합니다.' })
  @ArrayMinSize(1, { message: '태그는 최소 1개 이상이어야 합니다.' })
  @ArrayMaxSize(5, { message: '태그는 최대 5개까지 입력할 수 있습니다.' })
  @IsString({ each: true, message: '각 태그는 문자열이어야 합니다.' })
  @MaxLength(20, { each: true, message: '각 태그는 20자 이내여야 합니다.' })
  tags?: string[];
}
```

> **`{ each: true }` 옵션:** `@IsString({ each: true })`처럼 `each: true`를 붙이면 배열의 **각 원소**에 데코레이터를 적용한다. `each: true` 없이 `@IsString()`만 쓰면 배열 자체가 문자열인지를 검사하므로 항상 실패한다.

유효하지 않은 요청 예시:

```json
// POST /posts
{ "title": "제목", "content": "충분히 긴 내용입니다.", "tags": ["NestJS", "NestJS", "A", "B", "C", "D"] }
```

```json
// 응답 400
{
  "statusCode": 400,
  "message": ["태그는 최대 5개까지 입력할 수 있습니다."],
  "error": "Bad Request"
}
```

---

## 7. 중첩 객체 검증 (Nested Validation)

단순한 스칼라 값이 아니라 **객체 안에 객체**가 중첩된 경우에는 `@ValidateNested()`와 `@Type(() => ...)` 두 데코레이터를 함께 사용해야 한다.

### @Type() 데코레이터가 필요한 이유

`ValidationPipe`가 요청 본문을 받으면 내부적으로 class-transformer를 이용해 일반 JSON 객체를 DTO 클래스 인스턴스로 변환한다. 그런데 **중첩 객체**는 자동으로 변환되지 않는다.

```
클라이언트 JSON    →    일반 Object    →    DTO 클래스 인스턴스
{ "tag": { "name": "NestJS" } }
         ↓ class-transformer
   CreatePostDto {
     tag: { name: "NestJS" }   // ← 여전히 일반 Object! TagDto 인스턴스가 아님
   }
```

`@Type(() => TagDto)`를 붙여야 class-transformer가 중첩된 객체를 `TagDto` 클래스의 인스턴스로 변환한다. 클래스 인스턴스로 변환되어야 비로소 `TagDto`에 정의된 데코레이터(`@IsString()` 등)가 동작한다.

> **참고:** `@ValidateNested()`는 "이 필드 안을 검증하라"는 지시이고, `@Type()`은 "이 필드를 어떤 클래스로 변환할지"를 알려준다. 둘 중 하나라도 빠지면 중첩 검증이 동작하지 않는다.

### 예제 1: 태그 객체 배열 검증

태그에 이름과 색상 정보를 함께 저장하는 경우다.

```typescript
// src/posts/dto/tag.dto.ts
import { IsString, IsNotEmpty, MaxLength, IsHexColor, IsOptional } from 'class-validator';

export class TagDto {
  @IsString()
  @IsNotEmpty({ message: '태그 이름은 필수입니다.' })
  @MaxLength(20, { message: '태그 이름은 20자 이내여야 합니다.' })
  name: string;

  @IsOptional()
  @IsHexColor({ message: '색상은 HEX 코드 형식이어야 합니다. (예: #FF5733)' })
  color?: string;
}
```

```typescript
// src/posts/dto/create-post.dto.ts
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsArray,
  ArrayMaxSize,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TagDto } from './tag.dto';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: '제목은 필수 입력 항목입니다.' })
  @MaxLength(100, { message: '제목은 100자 이내로 작성해주세요.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '내용은 필수 입력 항목입니다.' })
  @MinLength(10, { message: '내용은 최소 10자 이상이어야 합니다.' })
  content: string;

  @IsOptional()
  @IsArray({ message: 'tags는 배열이어야 합니다.' })
  @ArrayMaxSize(5, { message: '태그는 최대 5개까지 입력할 수 있습니다.' })
  @ValidateNested({ each: true }) // 배열의 각 원소(TagDto)를 검증
  @Type(() => TagDto)             // 각 원소를 TagDto 인스턴스로 변환
  tags?: TagDto[];
}
```

유효한 요청:

```json
// POST /posts
{
  "title": "NestJS 파이프 정리",
  "content": "NestJS의 Pipe는 변환과 유효성 검사를 담당합니다.",
  "tags": [
    { "name": "NestJS", "color": "#E0234E" },
    { "name": "백엔드" }
  ]
}
```

유효하지 않은 요청 (태그 이름 누락, 잘못된 색상 코드):

```json
// POST /posts
{
  "title": "NestJS 파이프 정리",
  "content": "NestJS의 Pipe는 변환과 유효성 검사를 담당합니다.",
  "tags": [
    { "name": "", "color": "빨강" }
  ]
}
```

```json
// 응답 400
{
  "statusCode": 400,
  "message": [
    "tags.0.태그 이름은 필수입니다.",
    "tags.0.색상은 HEX 코드 형식이어야 합니다. (예: #FF5733)"
  ],
  "error": "Bad Request"
}
```

### 예제 2: 단일 중첩 객체 검증

게시글에 위치 정보(주소)를 포함하는 경우다.

```typescript
// src/posts/dto/location.dto.ts
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class LocationDto {
  @IsString()
  @IsNotEmpty({ message: '시/도는 필수입니다.' })
  @MaxLength(20)
  city: string;

  @IsString()
  @IsNotEmpty({ message: '구/군은 필수입니다.' })
  @MaxLength(20)
  district: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  detail?: string;
}
```

```typescript
// src/posts/dto/create-post.dto.ts 에 location 필드 추가
import { ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from './location.dto';

export class CreatePostDto {
  // ... title, content 필드 생략

  @IsOptional()
  @ValidateNested()        // 중첩 객체 내부를 검증
  @Type(() => LocationDto) // LocationDto 인스턴스로 변환 (없으면 검증 안 됨!)
  location?: LocationDto;
}
```

> **자주 하는 실수:** `@Type(() => LocationDto)`를 빠뜨리면 `location` 필드가 일반 Object로 남아서 `@ValidateNested()`가 있어도 내부 필드가 **전혀 검증되지 않는다**. 반드시 두 데코레이터를 함께 사용해야 한다.

---

## 8. ValidationPipe 옵션

`ValidationPipe`는 다양한 옵션을 통해 동작을 세밀하게 제어할 수 있다.

### 주요 옵션 상세

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `whitelist` | `boolean` | `false` | DTO에 정의되지 않은 프로퍼티를 자동 제거 |
| `forbidNonWhitelisted` | `boolean` | `false` | DTO에 정의되지 않은 프로퍼티가 있으면 에러 발생 |
| `transform` | `boolean` | `false` | 요청 데이터를 DTO 클래스의 인스턴스로 자동 변환 |
| `disableErrorMessages` | `boolean` | `false` | 에러 메시지를 응답에서 제거 (프로덕션에서 유용) |
| `stopAtFirstError` | `boolean` | `false` | 첫 번째 에러 발생 시 검증 중단 |
| `validationError.target` | `boolean` | `true` | 에러 응답에 원본 객체 포함 여부 |

### whitelist 동작 이해

```typescript
// dto/create-post.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}
```

클라이언트가 DTO에 정의되지 않은 필드를 함께 보냈을 때:

```json
// 요청: POST /posts
{ "title": "제목", "content": "내용", "isAdmin": true }
```

| 옵션 설정 | 결과 |
|-----------|------|
| 기본 (둘 다 false) | `isAdmin`이 그대로 통과됨 (위험!) |
| `whitelist: true` | `isAdmin`이 자동 제거됨 -> `{ "title": "제목", "content": "내용" }` |
| `whitelist: true` + `forbidNonWhitelisted: true` | 400 에러 -> `"property isAdmin should not exist"` |

> **팁:** 보안을 위해 `whitelist: true`는 반드시 켜두는 것을 권장한다. 클라이언트가 보낸 예상치 못한 필드(예: `isAdmin`, `role`)가 그대로 서비스 계층으로 전달되는 것을 방지한다.

### transform 옵션

`transform: true`를 설정하면 두 가지 효과가 있다.

1. **일반 객체를 DTO 클래스 인스턴스로 변환**: [`@Body()`](references/decorators.md#bodykey)로 받은 데이터가 실제 DTO 클래스의 인스턴스가 된다.
2. **원시 타입 자동 변환**: 경로 파라미터와 쿼리 파라미터의 문자열이 TypeScript 타입에 맞게 자동 변환된다.

```typescript
// transform: true 일 때
@Get(':id')
findOne(@Param('id') id: number) {
  console.log(typeof id); // "number" (transform 없이는 "string")
}

@Post()
create(@Body() dto: CreatePostDto) {
  console.log(dto instanceof CreatePostDto); // true (transform 없이는 false)
}
```

---

## 9. 커스텀 파이프 만들기

`PipeTransform` 인터페이스를 구현하여 커스텀 파이프를 만들 수 있다.

### PipeTransform 인터페이스

```typescript
export interface PipeTransform<T = any, R = any> {
  transform(value: T, metadata: ArgumentMetadata): R;
}

export interface ArgumentMetadata {
  type: 'body' | 'query' | 'param' | 'custom';
  metatype?: Type<unknown>;
  data?: string;
}
```

- `value`: 파이프에 전달된 입력 값
- `metadata.type`: 인자의 출처 (body, query, param, custom)
- `metadata.metatype`: 인자의 메타타입 (예: `String`, `CreatePostDto`)
- `metadata.data`: 데코레이터에 전달된 문자열 (예: [`@Body('title')`](references/decorators.md#bodykey)에서 `'title'`)

### 예제: 문자열 트림(Trim) 파이프

요청 본문의 모든 문자열 앞뒤 공백을 제거하는 파이프다.

```typescript
// src/common/pipes/trim-string.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimStringPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    // 문자열이면 trim
    if (typeof value === 'string') {
      return value.trim();
    }

    // 객체이면 모든 문자열 프로퍼티를 trim
    if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string') {
          value[key] = value[key].trim();
        }
      }
    }

    return value;
  }
}
```

```typescript
// posts.controller.ts - 사용 예시
@Post()
create(@Body(TrimStringPipe) createPostDto: CreatePostDto) {
  // "  제목  " -> "제목", "  내용  " -> "내용"
  return this.postsService.create(createPostDto);
}
```

### 예제: 커스텀 ParseIntPipe (한국어 에러 메시지)

```typescript
// src/common/pipes/custom-parse-int.pipe.ts
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class CustomParseIntPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const val = parseInt(value, 10);

    if (isNaN(val)) {
      throw new BadRequestException(
        `"${metadata.data}" 파라미터는 숫자여야 합니다. 받은 값: "${value}"`,
      );
    }

    return val;
  }
}
```

---

# 2단계: 기본 예제

---

## 10. 기본 예제

개념을 코드로 확인하는 간단한 예제 모음이다.

### 예제 1: ParseIntPipe 사용

```typescript
// posts.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpStatus,
} from '@nestjs/common';

@Controller('posts')
export class PostsController {
  // 기본 사용: 문자열 -> 숫자 변환
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // GET /posts/123  -> id = 123 (number)
    // GET /posts/abc  -> 400 Bad Request
    return `게시글 #${id}`;
  }

  // 에러 상태 코드 커스터마이징
  @Get('v2/:id')
  findOneV2(
    @Param(
      'id',
      new ParseIntPipe({ errorHttpStatusCode: HttpStatus.NOT_ACCEPTABLE }),
    )
    id: number,
  ) {
    // GET /posts/v2/abc -> 406 Not Acceptable
    return `게시글 #${id}`;
  }

  // DefaultValuePipe와 조합
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    // GET /posts           -> page=1, limit=10 (기본값)
    // GET /posts?page=2    -> page=2, limit=10
    return `Page: ${page}, Limit: ${limit}`;
  }
}
```

### 예제 2: ValidationPipe + DTO

```typescript
// dto/create-post.dto.ts
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: '제목은 필수입니다.' })
  @MaxLength(100, { message: '제목은 100자 이내로 작성해주세요.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '내용은 필수입니다.' })
  @MinLength(10, { message: '내용은 최소 10자 이상이어야 합니다.' })
  content: string;
}
```

```typescript
// posts.controller.ts
import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';

@Controller('posts')
export class PostsController {
  @Post()
  create(@Body(new ValidationPipe()) body: CreatePostDto) {
    return body;
  }
}
```

유효하지 않은 요청 시 자동 에러 응답:

```json
// POST /posts  { "title": "", "content": "짧음" }
{
  "statusCode": 400,
  "message": [
    "제목은 필수입니다.",
    "내용은 최소 10자 이상이어야 합니다."
  ],
  "error": "Bad Request"
}
```

### 예제 3: 커스텀 파이프

```typescript
// src/common/pipes/trim-string.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class TrimStringPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (typeof value === 'object' && value !== null) {
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'string') {
          value[key] = value[key].trim();
        }
      }
    }
    return value;
  }
}
```

```typescript
// posts.controller.ts - ValidationPipe 전에 TrimStringPipe를 먼저 적용
@Post()
@UsePipes(TrimStringPipe, new ValidationPipe())
create(@Body() createPostDto: CreatePostDto) {
  // "  제목  " -> "제목" (trim 후 유효성 검사)
  return this.postsService.create(createPostDto);
}
```

---

# 3단계: 블로그 API 적용

---

## 11. 블로그 API에 Pipe 적용하기

이전 챕터에서 만든 블로그 API(Users, Posts, Comments)에 DTO 유효성 검사를 추가한다. 이 단계를 마치면 **잘못된 데이터가 들어오면 자동으로 에러가 반환**된다.

### 11-1. 패키지 설치

```bash
npm install class-validator class-transformer
npm install @nestjs/mapped-types
```

> **@nestjs/mapped-types**는 `PartialType`, `PickType`, `OmitType` 등 DTO 변환 유틸리티를 제공하는 패키지다. `UpdatePostDto`를 만들 때 사용한다.

### 11-2. ValidationPipe 글로벌 적용

가장 먼저 `main.ts`에 글로벌 `ValidationPipe`를 설정한다. 이렇게 하면 모든 엔드포인트에서 자동으로 유효성 검사가 적용된다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // DTO에 없는 프로퍼티 자동 제거
      forbidNonWhitelisted: true, // DTO에 없는 프로퍼티가 있으면 에러
      transform: true,            // 자동 타입 변환
    }),
  );

  await app.listen(3000);
}
bootstrap();
```

> **왜 이 3가지 옵션을 켜는가?**
> - `whitelist`: 클라이언트가 `isAdmin: true` 같은 예상치 못한 필드를 보내도 무시된다.
> - `forbidNonWhitelisted`: 허용되지 않은 필드를 보내면 즉시 에러로 알려준다. 개발 단계에서 실수를 빠르게 발견할 수 있다.
> - `transform`: URL 파라미터 `"123"`이 자동으로 숫자 `123`으로 변환된다. `@Type()` 데코레이터와 함께 쿼리 파라미터도 자동 변환된다.

### 11-3. CreateUserDto

사용자 생성 시 이메일, 비밀번호, 이름을 검증한다.

```typescript
// src/users/dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  @IsNotEmpty({ message: '이메일은 필수 입력 항목입니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  @MaxLength(20, { message: '비밀번호는 최대 20자까지 가능합니다.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/, {
    message: '비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.',
  })
  password: string;

  @IsString()
  @IsNotEmpty({ message: '이름은 필수 입력 항목입니다.' })
  @MinLength(2, { message: '이름은 최소 2자 이상이어야 합니다.' })
  @MaxLength(20, { message: '이름은 최대 20자까지 가능합니다.' })
  name: string;
}
```

> **팁:** `message` 옵션으로 한국어 에러 메시지를 지정할 수 있다. 지정하지 않으면 영어 기본 메시지가 나온다. 프론트엔드에서 에러 메시지를 그대로 보여줄 계획이라면 한국어로 작성하는 것이 좋다.

### 11-4. CreatePostDto

게시글 작성 시 제목과 내용을 검증한다.

```typescript
// src/posts/dto/create-post.dto.ts
import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: '제목은 필수 입력 항목입니다.' })
  @MaxLength(100, { message: '제목은 100자 이내로 작성해주세요.' })
  title: string;

  @IsString()
  @IsNotEmpty({ message: '내용은 필수 입력 항목입니다.' })
  @MinLength(10, { message: '내용은 최소 10자 이상이어야 합니다.' })
  content: string;
}
```

### 11-5. UpdatePostDto (PartialType 활용)

게시글 수정 시에는 제목만 수정할 수도 있고, 내용만 수정할 수도 있다. `PartialType`을 사용하면 `CreatePostDto`의 모든 필드를 **선택적(optional)**으로 만들 수 있다.

```typescript
// src/posts/dto/update-post.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {}
// title?: string   (선택)
// content?: string (선택)
// 유효성 검사 데코레이터도 그대로 상속됨
```

> **PartialType이 하는 일:**
> - `CreatePostDto`의 모든 필드를 가져온다.
> - 모든 필드에 `@IsOptional()`을 자동으로 추가한다.
> - 기존 유효성 검사 데코레이터(`@IsString()`, `@MaxLength()` 등)는 유지한다.
>
> 즉, `title`을 보내면 100자 제한이 적용되고, 안 보내도 에러가 나지 않는다.

### 11-6. CreateCommentDto

댓글 작성 시 내용을 검증한다.

```typescript
// src/comments/dto/create-comment.dto.ts
import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: '댓글 내용은 필수 입력 항목입니다.' })
  @MinLength(1, { message: '댓글은 최소 1자 이상이어야 합니다.' })
  content: string;
}
```

### 11-7. PaginationQueryDto

게시글 목록 조회 시 페이지네이션과 검색을 위한 쿼리 파라미터를 검증한다.

```typescript
// src/common/dto/pagination-query.dto.ts
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional()
  @IsInt({ message: 'page는 정수여야 합니다.' })
  @Min(1, { message: 'page는 1 이상이어야 합니다.' })
  @Type(() => Number) // 쿼리 문자열 "1" -> 숫자 1
  page?: number = 1;

  @IsOptional()
  @IsInt({ message: 'limit는 정수여야 합니다.' })
  @Min(1, { message: 'limit는 1 이상이어야 합니다.' })
  @Max(100, { message: 'limit는 100 이하여야 합니다.' })
  @Type(() => Number) // 쿼리 문자열 "10" -> 숫자 10
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;
}
```

> **왜 `@Type(() => Number)`가 필요한가?**
>
> HTTP 쿼리 파라미터는 항상 문자열로 전달된다. `GET /posts?page=2`에서 `page`의 값은 숫자 `2`가 아니라 문자열 `"2"`다.
> `@Type(() => Number)`를 붙이면 class-transformer가 `"2"`를 숫자 `2`로 변환한 뒤, class-validator가 `@IsInt()` 검증을 수행한다.
>
> `transform: true` 옵션만으로도 TypeScript 타입 힌트에 따라 기본 변환이 되지만, `@Type()`을 명시적으로 쓰는 것이 더 안전하고 명확하다.

### 11-8. 컨트롤러에 DTO와 ParseIntPipe 적용

이제 각 컨트롤러에서 DTO와 파이프를 적용한다. `ValidationPipe`는 글로벌로 설정했으므로 각 메서드에 별도로 적용할 필요가 없다.

**UsersController**

```typescript
// src/users/users.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    // ValidationPipe가 자동으로 CreateUserDto 검증
    return this.usersService.create(createUserDto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // ParseIntPipe가 "123" -> 123 변환
    // "abc" 같은 값이 오면 자동으로 400 에러
    return this.usersService.findOne(id);
  }
}
```

**PostsController**

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    // GET /posts?page=2&limit=20&search=NestJS
    // query.page = 2 (number), query.limit = 20 (number), query.search = "NestJS"
    return this.postsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, updatePostDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
```

**CommentsController**

```typescript
// src/comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId/comments')
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, createCommentDto);
  }

  @Get('posts/:postId/comments')
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findAllByPost(postId);
  }

  @Delete('comments/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.remove(id);
  }
}
```

### 11-9. 요청/응답 예시

**회원가입 - 유효한 요청:**

```json
// POST /users
{
  "email": "hong@example.com",
  "password": "MyPass1!",
  "name": "홍길동"
}
```

```json
// 응답 201
{
  "id": 1,
  "email": "hong@example.com",
  "name": "홍길동",
  "createdAt": "2026-04-09T00:00:00.000Z"
}
```

**회원가입 - 유효하지 않은 요청:**

```json
// POST /users
{
  "email": "invalid-email",
  "password": "short",
  "name": "홍"
}
```

```json
// 응답 400
{
  "statusCode": 400,
  "message": [
    "올바른 이메일 형식이 아닙니다.",
    "비밀번호는 최소 8자 이상이어야 합니다.",
    "비밀번호는 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.",
    "이름은 최소 2자 이상이어야 합니다."
  ],
  "error": "Bad Request"
}
```

**게시글 작성 - DTO에 없는 필드 포함:**

```json
// POST /posts
{
  "title": "NestJS 학습",
  "content": "NestJS의 Pipe에 대해 학습합니다.",
  "isAdmin": true
}
```

```json
// 응답 400 (forbidNonWhitelisted: true)
{
  "statusCode": 400,
  "message": ["property isAdmin should not exist"],
  "error": "Bad Request"
}
```

**게시글 수정 - 제목만 변경 (PartialType 덕분에 가능):**

```json
// PATCH /posts/1
{
  "title": "수정된 제목"
}
```

```json
// 응답 200
{
  "id": 1,
  "title": "수정된 제목",
  "content": "기존 내용 유지",
  "updatedAt": "2026-04-09T01:00:00.000Z"
}
```

**잘못된 ID 파라미터:**

```
GET /posts/abc
```

```json
// 응답 400 (ParseIntPipe)
{
  "statusCode": 400,
  "message": "Validation failed (numeric string is expected)",
  "error": "Bad Request"
}
```

**페이지네이션 쿼리 검증:**

```
GET /posts?page=-1&limit=500
```

```json
// 응답 400
{
  "statusCode": 400,
  "message": [
    "page는 1 이상이어야 합니다.",
    "limit는 100 이하여야 합니다."
  ],
  "error": "Bad Request"
}
```

### 11-10. 프로젝트 구조 (챕터 5 완료 후)

```
src/
├── main.ts                          ← ValidationPipe 글로벌 설정
├── app.module.ts
│
├── common/
│   └── dto/
│       └── pagination-query.dto.ts  ← PaginationQueryDto
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts          ← ParseIntPipe 적용
│   ├── users.service.ts
│   └── dto/
│       └── create-user.dto.ts       ← email, password, name 검증
│
├── posts/
│   ├── posts.module.ts
│   ├── posts.controller.ts          ← ParseIntPipe + DTO 적용
│   ├── posts.service.ts
│   └── dto/
│       ├── create-post.dto.ts       ← title, content 검증
│       └── update-post.dto.ts       ← PartialType(CreatePostDto)
│
└── comments/
    ├── comments.module.ts
    ├── comments.controller.ts       ← ParseIntPipe + DTO 적용
    ├── comments.service.ts
    └── dto/
        └── create-comment.dto.ts    ← content 검증
```

---

## 프로젝트 구조

```
src/
├── app.module.ts
├── main.ts                              ← ValidationPipe 글로벌 설정
├── common/
│   ├── common.module.ts
│   ├── common.service.ts
│   ├── middleware/
│   └── dto/
│       └── pagination-query.dto.ts      ← [이번 챕터 추가]
├── users/
├── posts/
└── comments/
```

---

## 정리

| 개념 | 핵심 포인트 |
|------|------------|
| Pipe의 역할 | 데이터 **변환**과 **유효성 검사**, 컨트롤러 직전에 실행 |
| 내장 파이프 | `ValidationPipe`, `ParseIntPipe`, `ParseBoolPipe`, `DefaultValuePipe` 등 |
| `ParseEnumPipe` | enum에 정의된 값만 허용, 그 외 입력은 400 에러 |
| `ParseUUIDPipe` | UUID 형식 검증, `version` 옵션으로 v1/v3/v4/v5 지정 가능 |
| `ParseArrayPipe` | 쉼표 구분 쿼리 파라미터를 배열로 변환, `items`로 원소 타입 지정 |
| 바인딩 레벨 | 파라미터 -> 메서드 -> 컨트롤러 -> 글로벌 (범위 확장) |
| DTO | 요청 데이터 구조를 **class**로 정의 (interface는 런타임에 사라짐) |
| class-validator | 데코레이터 기반 유효성 검사 (`@IsString()`, `@IsEmail()`, `@MinLength()` 등) |
| class-transformer | `@Type()` 등으로 쿼리 파라미터 문자열을 숫자로 변환 |
| ValidationPipe 옵션 | `whitelist`(불필요 필드 제거), `forbidNonWhitelisted`(에러), `transform`(자동 변환) |
| PartialType | `CreateDto`를 기반으로 모든 필드가 선택적인 `UpdateDto` 생성 |
| 커스텀 파이프 | `PipeTransform` 인터페이스의 `transform()` 메서드 구현 |

> **다음 챕터 예고:** 챕터 6에서는 **Guard(가드)**를 학습한다. 게시글 작성/수정/삭제에 인증을 적용하여, 로그인한 사용자만 접근할 수 있도록 만든다. 현재는 누구나 게시글을 작성하고 삭제할 수 있는데, Guard를 적용하면 이를 방지할 수 있다.
---

## 다음 챕터 예고

챕터 6에서는 **Guard**를 학습한다. 게시글 작성/수정/삭제에 인증을 적용하여 로그인한 사용자만 접근할 수 있도록 만든다. `@Public()` 데코레이터로 공개 라우트를 구분하는 방법도 배운다.

