# 챕터 14 - Swagger (OpenAPI)

> **이전 챕터 요약**: 챕터 13에서 단위 테스트, 통합 테스트, E2E 테스트로 블로그 API의 핵심 로직을 검증했다. 이번 챕터에서는 **Swagger**로 API 문서를 자동 생성한다. `http://localhost:3000/api-docs`에서 모든 엔드포인트를 문서로 확인하고 직접 테스트할 수 있게 된다.



## 목차

1. [Swagger/OpenAPI란?](#swaggeropenapi란)
2. [@nestjs/swagger 패키지와 핵심 구성 요소](#nestjsswagger-패키지와-핵심-구성-요소)
3. [주요 데코레이터 정리](#주요-데코레이터-정리)
4. [DTO에서 자동 스키마 생성](#dto에서-자동-스키마-생성)
5. [Swagger CLI 플러그인](#swagger-cli-플러그인)
6. [기본 예제: Swagger 설정하기](#기본-예제-swagger-설정하기)
7. [기본 예제: DTO에 @ApiProperty 추가하기](#기본-예제-dto에-apiproperty-추가하기)
8. [기본 예제: 인증 설정하기](#기본-예제-인증-설정하기)
9. [API 버전 관리](#api-버전-관리)
10. [블로그 API 적용: 패키지 설치 및 Swagger 설정](#블로그-api-적용-패키지-설치-및-swagger-설정)
11. [블로그 API 적용: 컨트롤러에 Swagger 데코레이터 추가](#블로그-api-적용-컨트롤러에-swagger-데코레이터-추가)
12. [블로그 API 적용: DTO에 @ApiProperty 추가](#블로그-api-적용-dto에-apiproperty-추가)
13. [블로그 API 적용: Bearer 인증 설정](#블로그-api-적용-bearer-인증-설정)
14. [정리](#정리)

---

## Swagger/OpenAPI란?

API를 개발하면 "이 API는 어떤 파라미터를 받고, 어떤 응답을 돌려주는가?"를 문서로 정리해야 한다. 하지만 코드를 수정할 때마다 문서를 직접 고치는 것은 번거롭고, 결국 문서와 실제 코드가 어긋나게 된다.

**Swagger**는 이 문제를 해결하는 도구다. 코드에 데코레이터를 붙이면 API 문서가 **자동으로 생성**되고, 브라우저에서 바로 API를 **테스트**할 수도 있다.

### 핵심 용어

| 용어 | 설명 |
|------|------|
| **OpenAPI** | RESTful API를 기술하기 위한 표준 스펙이다. 예전에는 Swagger Specification이라 불렸고, 3.0부터 OpenAPI Specification(OAS)으로 이름이 바뀌었다 |
| **Swagger** | OpenAPI 스펙을 기반으로 API 문서를 자동 생성하고, 브라우저에서 직접 API를 테스트할 수 있는 UI를 제공하는 도구 모음이다 |
| **Swagger UI** | 생성된 API 문서를 웹 브라우저에서 인터랙티브하게 볼 수 있는 화면이다 |

### Swagger를 사용하는 이유

- **자동 문서화**: 코드에서 직접 API 문서가 생성되므로 문서와 코드의 불일치를 방지한다
- **인터랙티브 테스트**: Swagger UI에서 직접 API를 호출하고 응답을 확인할 수 있다. Postman 없이도 빠르게 테스트 가능하다
- **팀 협업**: 프론트엔드 개발자가 백엔드 API 스펙을 쉽게 파악할 수 있다
- **표준화**: OpenAPI 스펙을 따르므로 코드 생성기, 테스트 도구 등 다양한 도구와 호환된다

> **팁:**: 실무에서 프론트엔드 개발자는 백엔드 API의 요청/응답 형태를 파악하기 위해 Swagger UI를 매우 자주 사용한다. Swagger를 잘 작성하면 별도의 API 명세서를 따로 만들 필요가 없다.

---

## @nestjs/swagger 패키지와 핵심 구성 요소

NestJS에서는 `@nestjs/swagger` 패키지를 통해 데코레이터 기반으로 간편하게 API 문서를 생성할 수 있다. 핵심 구성 요소는 다음 세 가지다.

### DocumentBuilder

Swagger 문서의 기본 정보(제목, 설명, 버전, 인증 방식 등)를 설정하는 빌더 클래스다.

| 메서드 | 설명 |
|--------|------|
| `setTitle(title)` | API 문서의 제목 설정 |
| `setDescription(desc)` | API 문서의 설명 설정 |
| `setVersion(version)` | API 버전 설정 |
| `addTag(tag, description?)` | 태그 추가 (컨트롤러를 그룹으로 묶을 때 사용) |
| `addBearerAuth()` | Bearer 토큰(JWT) 인증 스키마 추가 |
| `addBasicAuth()` | Basic 인증 스키마 추가 |
| `addApiKey()` | API Key 인증 스키마 추가 |
| `addCookieAuth()` | 쿠키 기반 인증 스키마 추가 |
| `addServer(url)` | 서버 URL 추가 |
| `build()` | 설정을 완료하고 OpenAPI 문서 객체 반환 |

### SwaggerModule.createDocument

`DocumentBuilder`로 만든 설정과 NestJS 애플리케이션을 받아서 OpenAPI 문서 객체를 생성한다.

### SwaggerModule.setup

생성된 OpenAPI 문서를 특정 경로(예: `/api-docs`)에 Swagger UI로 마운트한다. 서버를 실행한 뒤 해당 경로에 접속하면 API 문서를 볼 수 있다.

---

## 주요 데코레이터 정리

`@nestjs/swagger`가 제공하는 데코레이터를 역할별로 정리한다.

### 컨트롤러/엔드포인트용 데코레이터

| 데코레이터 | 적용 위치 | 설명 |
|------------|-----------|------|
| [`@ApiTags('태그명')`](references/decorators.md#apitagstag) | 컨트롤러 또는 메서드 | Swagger UI에서 API를 태그별로 그룹핑한다 |
| [`@ApiOperation({ summary, description })`](references/decorators.md#apioperationoptions) | 메서드 | 각 엔드포인트의 요약과 상세 설명을 작성한다 |
| [`@ApiResponse({ status, description, type })`](references/decorators.md#apiresponse-계열) | 메서드 | 응답 상태 코드와 응답 본문 구조를 문서화한다 |
| [`@ApiParam({ name, description, type })`](references/decorators.md#apiparam-apiquery-apibody) | 메서드 | 경로 파라미터(`:id` 등)를 문서화한다 |
| [`@ApiQuery({ name, description, type })`](references/decorators.md#apiparam-apiquery-apibody) | 메서드 | 쿼리 스트링 파라미터를 문서화한다 |
| [`@ApiBody({ type })`](references/decorators.md#apiparam-apiquery-apibody) | 메서드 | 요청 본문의 타입을 명시한다 |
| [`@ApiBearerAuth()`](references/decorators.md#apibearerauth) | 컨트롤러 또는 메서드 | JWT Bearer 토큰 인증이 필요함을 표시한다 |
| [`@ApiExcludeEndpoint()`](references/decorators.md#apiresponse-계열) | 메서드 | 해당 엔드포인트를 Swagger 문서에서 제외한다 |

### 응답 데코레이터 축약형

자주 사용하는 HTTP 상태 코드별 축약 데코레이터가 제공된다.

| 데코레이터 | HTTP 상태 코드 |
|------------|---------------|
| [`@ApiOkResponse()`](references/decorators.md#apiresponse-계열) | 200 |
| [`@ApiCreatedResponse()`](references/decorators.md#apiresponse-계열) | 201 |
| [`@ApiBadRequestResponse()`](references/decorators.md#apiresponse-계열) | 400 |
| [`@ApiUnauthorizedResponse()`](references/decorators.md#apiresponse-계열) | 401 |
| `@ApiForbiddenResponse()` | 403 |
| [`@ApiNotFoundResponse()`](references/decorators.md#apiresponse-계열) | 404 |
| `@ApiConflictResponse()` | 409 |
| `@ApiInternalServerErrorResponse()` | 500 |

### DTO 속성용 데코레이터

| 데코레이터 | 설명 |
|------------|------|
| [`@ApiProperty({ description, example, ... })`](references/decorators.md#apipropertyoptions) | DTO 속성의 타입, 설명, 예시 등을 정의한다 (기본적으로 필수) |
| [`@ApiPropertyOptional({ ... })`](references/decorators.md#apipropertyoptions) | [`@ApiProperty({ required: false })`](references/decorators.md#apipropertyoptions)의 축약형이다. 선택적 속성에 사용한다 |

[`@ApiProperty`](references/decorators.md#apipropertyoptions)의 주요 옵션:

| 옵션 | 설명 |
|------|------|
| `description` | 속성에 대한 설명 |
| `example` | 예시 값 (Swagger UI의 "Try it out"에서 기본값으로 사용됨) |
| `required` | 필수 여부 (기본값: `true`) |
| `default` | 기본값 |
| `enum` | 열거형 값 목록 |
| `type` | 타입 지정 (복잡한 타입일 때 명시적으로 사용) |
| `isArray` | 배열 여부 |
| `minimum` / `maximum` | 숫자 최소/최대값 |
| `minLength` / `maxLength` | 문자열 최소/최대 길이 |
| `nullable` | null 허용 여부 |

---

## DTO에서 자동 스키마 생성

`@nestjs/swagger`는 DTO 클래스에 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 선언하면 자동으로 OpenAPI 스키마를 생성한다. `class-validator`와 함께 사용하면 **검증과 문서화를 동시에** 처리할 수 있어 매우 편리하다.

### PartialType, PickType, OmitType, IntersectionType

`@nestjs/swagger`에서 제공하는 유틸리티 타입을 사용하면 기존 DTO를 기반으로 새로운 DTO를 생성하면서 Swagger 스키마도 자동으로 반영된다.

| 유틸리티 | 설명 | 예시 |
|----------|------|------|
| `PartialType(DTO)` | 모든 속성을 optional로 변환 | `UpdatePostDto extends PartialType(CreatePostDto)` |
| `PickType(DTO, [keys])` | 특정 속성만 선택 | `LoginDto extends PickType(CreateUserDto, ['email', 'password'])` |
| `OmitType(DTO, [keys])` | 특정 속성을 제외 | `UserResponseDto extends OmitType(CreateUserDto, ['password'])` |
| `IntersectionType(A, B)` | 두 DTO를 합침 | `UserWithPostsDto extends IntersectionType(UserDto, PostsDto)` |

> **주의:**: `@nestjs/mapped-types`가 아닌 **`@nestjs/swagger`에서** `PartialType`, `PickType` 등을 import해야 Swagger 스키마에 정상 반영된다. import 경로를 반드시 확인하자.

---

## Swagger CLI 플러그인

매번 모든 DTO 속성에 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 일일이 붙이는 것은 번거롭다. `@nestjs/swagger`의 CLI 플러그인을 활성화하면 TypeScript 타입 정보를 기반으로 **자동으로 스키마를 생성**할 수 있다.

### nest-cli.json에 플러그인 설정 추가

프로젝트 루트의 `nest-cli.json` 파일에 아래와 같이 `plugins` 항목을 추가한다.

```json
// nest-cli.json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "plugins": [
      {
        "name": "@nestjs/swagger",
        "options": {
          "classValidatorShim": true,
          "introspectComments": true,
          "dtoFileNameSuffix": [".dto.ts", ".entity.ts"]
        }
      }
    ]
  }
}
```

> **주의:**: 플러그인은 NestJS CLI(`nest build`, `nest start`)로 빌드할 때만 적용된다. `tsc`로 직접 컴파일하면 플러그인이 동작하지 않는다.

### 플러그인 옵션

| 옵션 | 기본값 | 설명 |
|------|--------|------|
| `classValidatorShim` | `true` | `class-validator` 데코레이터에서 제약 조건을 자동 추출한다 (`@IsEmail()` → `format: email` 등) |
| `introspectComments` | `false` | JSDoc 주석(`/** ... */`)을 `description`으로 자동 변환한다 |
| `dtoFileNameSuffix` | `['.dto.ts']` | 플러그인이 분석할 파일 접미사 목록 |
| `controllerFileNameSuffix` | `['.controller.ts']` | 컨트롤러 파일 접미사 |

### 플러그인 적용 전후 코드 비교

플러그인 적용 전후의 DTO 코드를 비교하면 차이가 명확하다.

**플러그인 미적용 (수동으로 [`@ApiProperty`](references/decorators.md#apipropertyoptions) 선언 필요)**:

```typescript
// dto/create-post.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: 'NestJS 입문',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: 'NestJS를 배워봅시다.',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  content: string;

  @ApiPropertyOptional({
    description: '게시글 태그 목록',
    example: ['nestjs', 'typescript'],
    isArray: true,
    type: String,
  })
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
```

**플러그인 적용 후 ([`@ApiProperty`](references/decorators.md#apipropertyoptions) 없이 동일한 Swagger 문서 생성)**:

```typescript
// dto/create-post.dto.ts
import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class CreatePostDto {
  /**
   * 게시글 제목
   * @example 'NestJS 입문'
   */
  @IsString()
  @MaxLength(100)
  title: string;

  /**
   * 게시글 내용
   * @example 'NestJS를 배워봅시다.'
   */
  @IsString()
  @MinLength(10)
  content: string;

  /**
   * 게시글 태그 목록
   * @example ['nestjs', 'typescript']
   */
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
```

플러그인이 수행하는 작업:

| 항목 | 동작 |
|------|------|
| 타입 추론 | `string`, `number`, `boolean`, `Date` 등을 TypeScript 타입에서 자동 감지 |
| optional 추론 | `?` 표시가 붙은 속성을 `required: false`로 자동 처리 |
| class-validator 연동 | `@MinLength(10)` → `minLength: 10`, `@IsEmail()` → `format: 'email'` 등 자동 변환 |
| JSDoc 변환 | `/** 게시글 제목 */` → `description: '게시글 제목'` 자동 변환 (`introspectComments: true` 필요) |
| 배열 추론 | `string[]` 타입을 `isArray: true, type: String`으로 자동 처리 |

> **팁:**: 플러그인을 사용하더라도 `enum`, `example`, `minimum/maximum` 같은 세부 옵션이 필요한 경우에는 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 직접 선언해야 한다. 실무에서는 플러그인 + 필요한 곳에만 수동 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 병행하는 방식이 많다.

---

## 기본 예제: Swagger 설정하기

가장 기본적인 Swagger 설정부터 살펴보자. `main.ts`에 몇 줄만 추가하면 된다.

### 패키지 설치

```bash
npm install @nestjs/swagger swagger-ui-express
```

> Fastify를 사용하는 경우 `swagger-ui-express` 대신 `@fastify/swagger`와 `@fastify/swagger-ui`를 설치한다.

### main.ts 기본 설정

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. DocumentBuilder로 문서 기본 정보 설정
  const config = new DocumentBuilder()
    .setTitle('My API')                    // API 제목
    .setDescription('My API 문서입니다.')    // API 설명
    .setVersion('1.0')                     // API 버전
    .build();

  // 2. OpenAPI 문서 객체 생성
  const document = SwaggerModule.createDocument(app, config);

  // 3. '/api-docs' 경로에 Swagger UI 마운트
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
```

서버를 실행한 후 `http://localhost:3000/api-docs`에 접속하면 Swagger UI를 확인할 수 있다.

> **팁:**: `SwaggerModule.setup`의 첫 번째 인자가 Swagger UI의 경로가 된다. `'api-docs'`로 설정하면 `http://localhost:3000/api-docs`에서 확인할 수 있고, `'docs'`로 바꾸면 `http://localhost:3000/docs`가 된다.

---

## 기본 예제: DTO에 [@ApiProperty](references/decorators.md#apipropertyoptions) 추가하기

DTO에 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 추가하면 Swagger UI에서 요청/응답의 스키마를 자동으로 보여준다. `class-validator`와 함께 사용하는 패턴이 가장 흔하다.

```typescript
// dto/create-user.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
    minLength: 2,
    maxLength: 20,
  })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({
    description: '비밀번호 (최소 8자)',
    example: 'MyStr0ngP@ss!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    description: '사용자 나이',
    example: 25,
    minimum: 0,
    maximum: 150,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  age?: number;
}
```

컨트롤러에서 이 DTO를 [`@Body()`](references/decorators.md#bodykey)로 받으면 Swagger UI의 "Request Body" 섹션에 자동으로 스키마가 표시된다.

```typescript
// users.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCreatedResponse, ApiBadRequestResponse } from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  @Post()
  @ApiOperation({ summary: '사용자 생성', description: '새로운 사용자를 등록합니다.' })
  @ApiCreatedResponse({ description: '사용자가 성공적으로 생성됨' })
  @ApiBadRequestResponse({ description: '잘못된 요청 데이터' })
  create(@Body() createUserDto: CreateUserDto) {
    return { id: 1, ...createUserDto };
  }
}
```

> **팁:**: [`@ApiProperty`](references/decorators.md#apipropertyoptions)의 `example` 값은 Swagger UI에서 "Try it out" 버튼을 눌렀을 때 기본값으로 채워진다. 실제 테스트하기 좋은 값을 넣어두면 편리하다.

---

## 기본 예제: 인증 설정하기

JWT 인증을 사용하는 API라면 Swagger UI에서도 토큰을 입력하여 테스트할 수 있도록 설정해야 한다. 두 단계로 구성된다.

### 1단계: DocumentBuilder에 인증 스키마 추가

```typescript
// main.ts
const config = new DocumentBuilder()
  .setTitle('My API')
  .setVersion('1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT 토큰을 입력하세요 (Bearer 접두사 불필요)',
    },
    'access-token',  // 인증 스키마 이름 (생략 가능)
  )
  .build();
```

### 2단계: 컨트롤러에 [@ApiBearerAuth](references/decorators.md#apibearerauth) 추가

```typescript
// users.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('users')
@ApiBearerAuth('access-token')  // DocumentBuilder에서 지정한 이름과 일치시킨다
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  @Get('profile')
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  getProfile() {
    return { message: '내 프로필' };
  }
}
```

이렇게 설정하면 Swagger UI 상단에 "Authorize" 버튼이 나타난다. 버튼을 클릭하고 JWT 토큰을 입력하면, 이후 요청에 자동으로 `Authorization: Bearer <토큰>` 헤더가 추가된다.

> **팁:**: `addBearerAuth()`에서 두 번째 인자(인증 스키마 이름)를 생략하면 기본값 `'bearer'`가 사용된다. 이 경우 [`@ApiBearerAuth()`](references/decorators.md#apibearerauth)도 인자 없이 사용하면 된다.

---

## API 버전 관리

API를 운영하다 보면 기존 클라이언트와의 호환성을 유지하면서 새로운 스펙을 도입해야 하는 상황이 생긴다. 이때 **API 버전 관리(Versioning)**를 사용하면 `/v1/posts`, `/v2/posts`처럼 버전별로 엔드포인트를 분리할 수 있다.

### VersioningType 종류

NestJS는 `@nestjs/common`의 `VersioningType` 열거형을 통해 네 가지 버전 관리 방식을 지원한다.

| 방식 | 설명 | 예시 |
|------|------|------|
| `VersioningType.URI` | URL 경로에 버전 포함 | `/v1/posts`, `/v2/posts` |
| `VersioningType.HEADER` | 커스텀 헤더로 버전 지정 | `X-API-Version: 1` |
| `VersioningType.MEDIA_TYPE` | Accept 헤더의 미디어 타입으로 지정 | `Accept: application/json;v=1` |
| `VersioningType.CUSTOM` | 직접 정의한 함수로 버전 추출 | 커스텀 로직 |

가장 많이 사용하는 방식은 **URI 버전 관리**다. URL만 봐도 버전을 알 수 있어 직관적이다.

### app.enableVersioning() 설정

`main.ts`에서 `app.enableVersioning()`을 호출하여 URI 버전 관리를 활성화한다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // URI 버전 관리 활성화 (/v1/..., /v2/... 형태)
  app.enableVersioning({
    type: VersioningType.URI,
    // prefix 기본값은 'v'이다. 변경하려면 prefix: '버전' 옵션을 사용한다.
    // defaultVersion: '1',  // 버전 미지정 엔드포인트의 기본 버전
  });

  const config = new DocumentBuilder()
    .setTitle('Blog API')
    .setDescription('블로그 REST API 문서입니다.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(3000);
}
bootstrap();
```

### 컨트롤러에 버전 지정

[`@Controller`](references/decorators.md#controllerprefix) 데코레이터에 `version` 옵션을 추가하거나, `@Version()` 데코레이터를 메서드에 붙인다.

**컨트롤러 단위로 버전 지정**:

```typescript
// src/posts/posts-v1.controller.ts
import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('posts')
@Controller({ path: 'posts', version: '1' })  // /v1/posts
export class PostsV1Controller {
  @Get()
  @ApiOperation({ summary: '게시글 목록 조회 (v1)' })
  findAll() {
    return { version: 'v1', data: [] };
  }
}
```

**메서드 단위로 버전 지정**:

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Version } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  @Get()
  @Version('1')  // /v1/posts
  @ApiOperation({ summary: '게시글 목록 조회 (v1)' })
  findAllV1() {
    return { version: 'v1', data: [] };
  }

  @Get()
  @Version('2')  // /v2/posts
  @ApiOperation({ summary: '게시글 목록 조회 (v2) - 페이지네이션 추가' })
  findAllV2() {
    return { version: 'v2', total: 0, page: 1, data: [] };
  }
}
```

### Swagger에서 버전별 API 표시

버전 관리를 활성화하면 Swagger UI에서 `/v1/posts`, `/v2/posts`처럼 버전이 포함된 경로가 자동으로 표시된다. 별도의 Swagger 설정 없이 NestJS가 라우팅 정보를 그대로 OpenAPI 스펙에 반영한다.

버전별로 **별도의 Swagger 문서를 분리**하고 싶다면 `createDocument`에 `include` 옵션을 사용한다.

```typescript
// src/main.ts (버전별 Swagger 문서 분리 예제)
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PostsV1Module } from './posts/posts-v1.module';
import { PostsV2Module } from './posts/posts-v2.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI });

  const baseConfig = new DocumentBuilder()
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  // v1 전용 Swagger 문서
  const v1Config = new DocumentBuilder()
    .setTitle('Blog API v1')
    .setDescription('Blog API 버전 1 문서입니다.')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const v1Document = SwaggerModule.createDocument(app, v1Config, {
    include: [PostsV1Module],  // v1 모듈만 포함
  });
  SwaggerModule.setup('api-docs/v1', app, v1Document);

  // v2 전용 Swagger 문서
  const v2Config = new DocumentBuilder()
    .setTitle('Blog API v2')
    .setDescription('Blog API 버전 2 문서입니다.')
    .setVersion('2.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .build();

  const v2Document = SwaggerModule.createDocument(app, v2Config, {
    include: [PostsV2Module],  // v2 모듈만 포함
  });
  SwaggerModule.setup('api-docs/v2', app, v2Document);

  await app.listen(3000);
  console.log('Swagger v1: http://localhost:3000/api-docs/v1');
  console.log('Swagger v2: http://localhost:3000/api-docs/v2');
}
bootstrap();
```

이렇게 하면 `http://localhost:3000/api-docs/v1`에서는 v1 API만, `http://localhost:3000/api-docs/v2`에서는 v2 API만 확인할 수 있다.

> **팁:**: 실무에서는 버전을 너무 많이 만들지 않는 것이 좋다. 새 버전이 늘어날수록 유지보수 비용이 커진다. 가능하면 하위 호환성을 유지하되, 파괴적 변경(breaking change)이 불가피할 때만 새 버전을 생성한다.

---

## 블로그 API 적용: 패키지 설치 및 Swagger 설정

여기서부터는 이전 챕터까지 구축해온 **블로그 API**에 Swagger를 적용한다. 챕터 12에서 JWT 인증을 구현했고, 챕터 13에서 테스트를 작성했으므로, 이제 API 문서를 자동 생성하는 단계다.

### 패키지 설치

```bash
npm install @nestjs/swagger swagger-ui-express
```

### main.ts에 Swagger 설정 추가

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 글로벌 ValidationPipe (챕터 5에서 설정한 것)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger 설정
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Blog API')
      .setDescription(
        `블로그 REST API 문서입니다.

## 인증 방법
1. \`POST /auth/login\`으로 로그인하여 JWT 토큰을 발급받습니다.
2. 우측 상단의 **Authorize** 버튼을 클릭합니다.
3. 발급받은 토큰을 입력합니다 (Bearer 접두사 불필요).
4. 이후 인증이 필요한 API를 자유롭게 테스트할 수 있습니다.
      `)
      .setVersion('1.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT 토큰을 입력하세요',
        },
        'access-token',
      )
      .addTag('auth', '인증 관련 API (로그인, 회원가입, 토큰 갱신)')
      .addTag('users', '사용자 관련 API')
      .addTag('posts', '게시글 관련 API')
      .addTag('comments', '댓글 관련 API')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,  // 페이지 새로고침 시에도 인증 정보 유지
        tagsSorter: 'alpha',         // 태그를 알파벳 순으로 정렬
        operationsSorter: 'method',  // 엔드포인트를 HTTP 메서드 순으로 정렬
      },
    });
  }

  await app.listen(process.env.PORT ?? 3000);
  console.log('Swagger: http://localhost:3000/api-docs');
}
bootstrap();
```

> **팁:**: `process.env.NODE_ENV !== 'production'` 조건으로 감싸면 운영 환경에서는 Swagger가 노출되지 않는다. API 스펙이 외부에 공개되면 보안 위험이 될 수 있으므로, 운영 환경에서는 반드시 비활성화하자.

---

## 블로그 API 적용: 컨트롤러에 Swagger 데코레이터 추가

모든 컨트롤러에 [`@ApiTags`](references/decorators.md#apitagstag)를 추가하고, 모든 엔드포인트에 [`@ApiOperation`](references/decorators.md#apioperationoptions)과 [`@ApiResponse`](references/decorators.md#apiresponse-계열)를 추가한다.

### AuthController

```typescript
// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { TokenResponseDto } from './dto/token-response.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: '회원가입',
    description: '이메일, 비밀번호, 이름으로 새로운 사용자를 등록합니다.',
  })
  @ApiCreatedResponse({
    description: '회원가입 성공. JWT 토큰이 발급됩니다.',
    type: TokenResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 요청 데이터 (이메일 형식 오류, 비밀번호 길이 부족 등)' })
  signup(@Body() signupDto: SignupDto): Promise<TokenResponseDto> {
    return this.authService.signup(signupDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({
    summary: '로그인',
    description: '이메일과 비밀번호로 로그인하여 JWT 토큰을 발급받습니다.',
  })
  @ApiOkResponse({
    description: '로그인 성공. JWT 토큰이 발급됩니다.',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '이메일 또는 비밀번호가 올바르지 않음' })
  login(@Body() loginDto: LoginDto, @Request() req): Promise<TokenResponseDto> {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '토큰 갱신',
    description: 'Refresh Token을 사용하여 새로운 Access Token을 발급받습니다.',
  })
  @ApiOkResponse({
    description: '토큰 갱신 성공',
    type: TokenResponseDto,
  })
  @ApiUnauthorizedResponse({ description: '유효하지 않거나 만료된 Refresh Token' })
  refresh(@Body() refreshTokenDto: RefreshTokenDto): Promise<TokenResponseDto> {
    return this.authService.refresh(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '로그아웃',
    description: '현재 사용자의 Refresh Token을 무효화합니다.',
  })
  @ApiOkResponse({ description: '로그아웃 성공' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  logout(@Request() req): Promise<void> {
    return this.authService.logout(req.user.id);
  }
}
```

### PostsController

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostResponseDto } from './dto/post-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '게시글 작성',
    description: '새로운 게시글을 작성합니다. 인증이 필요합니다.',
  })
  @ApiCreatedResponse({
    description: '게시글이 성공적으로 작성됨',
    type: PostResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 요청 데이터 (제목 누락, 내용 길이 부족 등)' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  create(
    @Body() createPostDto: CreatePostDto,
    @Request() req,
  ): Promise<PostResponseDto> {
    return this.postsService.create(createPostDto, req.user.id);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: '게시글 목록 조회',
    description: '페이지네이션과 검색을 지원하는 게시글 목록을 반환합니다.',
  })
  @ApiOkResponse({
    description: '게시글 목록 반환',
    type: [PostResponseDto],
  })
  findAll(@Query() paginationQuery: PaginationQueryDto): Promise<PostResponseDto[]> {
    return this.postsService.findAll(paginationQuery);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '게시글 상세 조회' })
  @ApiParam({ name: 'id', description: '게시글 ID', type: Number, example: 1 })
  @ApiOkResponse({ description: '게시글 정보 반환', type: PostResponseDto })
  @ApiNotFoundResponse({ description: '해당 게시글을 찾을 수 없음' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<PostResponseDto> {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '게시글 수정',
    description: '자신이 작성한 게시글을 수정합니다. 작성자만 수정할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '게시글 ID', type: Number, example: 1 })
  @ApiOkResponse({ description: '게시글이 성공적으로 수정됨', type: PostResponseDto })
  @ApiBadRequestResponse({ description: '유효하지 않은 요청 데이터' })
  @ApiNotFoundResponse({ description: '해당 게시글을 찾을 수 없음' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({ description: '수정 권한이 없음 (작성자가 아님)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req,
  ): Promise<PostResponseDto> {
    return this.postsService.update(id, updatePostDto, req.user.id);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '게시글 삭제',
    description: '자신이 작성한 게시글을 삭제합니다. 작성자만 삭제할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '게시글 ID', type: Number, example: 1 })
  @ApiNoContentResponse({ description: '게시글이 성공적으로 삭제됨' })
  @ApiNotFoundResponse({ description: '해당 게시글을 찾을 수 없음' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({ description: '삭제 권한이 없음 (작성자가 아님)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<void> {
    return this.postsService.remove(id, req.user.id);
  }
}
```

### CommentsController

```typescript
// src/comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentResponseDto } from './dto/comment-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post('posts/:postId/comments')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '댓글 작성',
    description: '특정 게시글에 댓글을 작성합니다. 인증이 필요합니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: Number, example: 1 })
  @ApiCreatedResponse({
    description: '댓글이 성공적으로 작성됨',
    type: CommentResponseDto,
  })
  @ApiBadRequestResponse({ description: '유효하지 않은 요청 데이터' })
  @ApiNotFoundResponse({ description: '해당 게시글을 찾을 수 없음' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() createCommentDto: CreateCommentDto,
    @Request() req,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(postId, createCommentDto, req.user.id);
  }

  @Get('posts/:postId/comments')
  @Public()
  @ApiOperation({
    summary: '댓글 목록 조회',
    description: '특정 게시글의 댓글 목록을 반환합니다.',
  })
  @ApiParam({ name: 'postId', description: '게시글 ID', type: Number, example: 1 })
  @ApiOkResponse({
    description: '댓글 목록 반환',
    type: [CommentResponseDto],
  })
  @ApiNotFoundResponse({ description: '해당 게시글을 찾을 수 없음' })
  findAll(
    @Param('postId', ParseIntPipe) postId: number,
  ): Promise<CommentResponseDto[]> {
    return this.commentsService.findAllByPost(postId);
  }

  @Delete('comments/:id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: '댓글 삭제',
    description: '자신이 작성한 댓글을 삭제합니다. 작성자만 삭제할 수 있습니다.',
  })
  @ApiParam({ name: 'id', description: '댓글 ID', type: Number, example: 1 })
  @ApiNoContentResponse({ description: '댓글이 성공적으로 삭제됨' })
  @ApiNotFoundResponse({ description: '해당 댓글을 찾을 수 없음' })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  @ApiForbiddenResponse({ description: '삭제 권한이 없음 (작성자가 아님)' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<void> {
    return this.commentsService.remove(id, req.user.id);
  }
}
```

### UsersController

```typescript
// src/users/users.controller.ts
import { Controller, Get, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: '내 프로필 조회',
    description: '현재 로그인한 사용자의 프로필 정보를 반환합니다.',
  })
  @ApiOkResponse({ description: '프로필 정보 반환', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: '인증되지 않은 요청' })
  getMe(@Request() req): Promise<UserResponseDto> {
    return this.usersService.findOne(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: '사용자 프로필 조회' })
  @ApiParam({ name: 'id', description: '사용자 ID', type: Number, example: 1 })
  @ApiOkResponse({ description: '사용자 정보 반환', type: UserResponseDto })
  @ApiNotFoundResponse({ description: '해당 사용자를 찾을 수 없음' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }
}
```

---

## 블로그 API 적용: DTO에 [@ApiProperty](references/decorators.md#apipropertyoptions) 추가

모든 DTO에 [`@ApiProperty`](references/decorators.md#apipropertyoptions)를 추가하여 요청/응답의 스키마가 Swagger UI에 정확하게 표시되도록 한다. `description`과 `example`을 반드시 포함하자.

### Auth 관련 DTO

```typescript
// src/auth/dto/signup.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '비밀번호 (최소 8자)',
    example: 'MyStr0ngP@ss!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
    minLength: 2,
    maxLength: 20,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name: string;
}
```

```typescript
// src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: '비밀번호',
    example: 'MyStr0ngP@ss!',
  })
  @IsString()
  password: string;
}
```

```typescript
// src/auth/dto/refresh-token.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh Token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  refreshToken: string;
}
```

```typescript
// src/auth/dto/token-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class TokenResponseDto {
  @ApiProperty({
    description: 'Access Token (API 요청에 사용)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh Token (토큰 갱신에 사용)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  refreshToken: string;
}
```

### Post 관련 DTO

```typescript
// src/posts/dto/create-post.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({
    description: '게시글 제목',
    example: 'NestJS Swagger 사용법',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: '게시글 내용',
    example: 'NestJS에서 Swagger를 설정하는 방법을 알아봅니다. @nestjs/swagger 패키지를 사용하면 ...',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  content: string;
}
```

```typescript
// src/posts/dto/update-post.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreatePostDto } from './create-post.dto';

// 모든 속성이 optional로 변환됨 (Swagger 스키마 자동 반영)
export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

```typescript
// src/posts/dto/post-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class PostAuthorDto {
  @ApiProperty({ description: '작성자 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '작성자 이름', example: '홍길동' })
  name: string;
}

export class PostResponseDto {
  @ApiProperty({ description: '게시글 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '게시글 제목', example: 'NestJS Swagger 사용법' })
  title: string;

  @ApiProperty({ description: '게시글 내용', example: 'NestJS에서 Swagger를 설정하는 방법을 알아봅니다...' })
  content: string;

  @ApiProperty({ description: '작성자 정보', type: PostAuthorDto })
  author: PostAuthorDto;

  @ApiProperty({ description: '생성일', example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ description: '수정일', example: '2025-01-15T12:00:00.000Z' })
  updatedAt: Date;
}
```

### Comment 관련 DTO

```typescript
// src/comments/dto/create-comment.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({
    description: '댓글 내용',
    example: '좋은 글 감사합니다!',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  content: string;
}
```

```typescript
// src/comments/dto/comment-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CommentAuthorDto {
  @ApiProperty({ description: '작성자 ID', example: 2 })
  id: number;

  @ApiProperty({ description: '작성자 이름', example: '김철수' })
  name: string;
}

export class CommentResponseDto {
  @ApiProperty({ description: '댓글 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '댓글 내용', example: '좋은 글 감사합니다!' })
  content: string;

  @ApiProperty({ description: '작성자 정보', type: CommentAuthorDto })
  author: CommentAuthorDto;

  @ApiProperty({ description: '생성일', example: '2025-01-02T10:30:00.000Z' })
  createdAt: Date;
}
```

### User 관련 DTO

```typescript
// src/users/dto/user-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: '사용자 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '이메일', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: '이름', example: '홍길동' })
  name: string;

  @ApiPropertyOptional({ description: '역할', example: 'user' })
  role?: string;

  @ApiProperty({ description: '가입일', example: '2025-01-01T00:00:00.000Z' })
  createdAt: Date;
}
```

### 공통 DTO

```typescript
// src/common/dto/pagination-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: '페이지 번호 (1부터 시작)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: '페이지당 항목 수',
    default: 10,
    minimum: 1,
    maximum: 100,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: '검색 키워드 (제목, 내용에서 검색)',
    example: 'NestJS',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
```

---

## 블로그 API 적용: Bearer 인증 설정

챕터 12에서 구현한 JWT 인증과 Swagger를 연동한다. 핵심은 세 가지다.

### 1. main.ts의 DocumentBuilder에서 addBearerAuth 설정

위의 [main.ts 설정](#블로그-api-적용-패키지-설치-및-swagger-설정)에서 이미 추가했다.

```typescript
// main.ts (발췌)
.addBearerAuth(
  {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'JWT 토큰을 입력하세요',
  },
  'access-token',
)
```

### 2. 인증이 필요한 엔드포인트에 [@ApiBearerAuth](references/decorators.md#apibearerauth) 추가

인증이 필요한 모든 엔드포인트(또는 컨트롤러)에 [`@ApiBearerAuth('access-token')`](references/decorators.md#apibearerauth)을 추가한다. 위의 컨트롤러 예제에서 이미 적용했다.

```typescript
// 인증이 필요한 엔드포인트에 추가
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
```

### 3. Swagger UI에서 테스트하는 방법

1. `http://localhost:3000/api-docs`에 접속한다
2. `POST /auth/login` 엔드포인트에서 "Try it out"을 클릭한다
3. 이메일과 비밀번호를 입력하고 "Execute"를 클릭한다
4. 응답에서 `accessToken` 값을 복사한다
5. 페이지 상단의 **Authorize** 버튼을 클릭한다
6. 복사한 토큰을 붙여넣고 "Authorize"를 클릭한다
7. 이제 인증이 필요한 모든 API를 테스트할 수 있다

> **팁:**: `swaggerOptions.persistAuthorization: true`를 설정했으므로, 페이지를 새로고침해도 입력한 토큰이 유지된다. 개발 중에 반복 로그인하는 번거로움을 줄여준다.

---

## 정리

이 챕터에서 학습한 내용을 정리한다.

### 핵심 개념

| 항목 | 설명 |
|------|------|
| Swagger/OpenAPI | API 문서를 자동 생성하고 브라우저에서 테스트할 수 있는 도구 |
| `DocumentBuilder` | API 문서의 제목, 설명, 인증 방식 등을 설정하는 빌더 |
| `SwaggerModule.setup` | 특정 경로에 Swagger UI를 마운트 |
| Swagger CLI 플러그인 | `nest-cli.json`에 설정하여 [`@ApiProperty`](references/decorators.md#apipropertyoptions) 없이도 DTO 스키마를 자동 생성 |
| `VersioningType.URI` | `/v1/posts`, `/v2/posts` 형태의 URI 기반 API 버전 관리 |
| `app.enableVersioning()` | NestJS 애플리케이션 전체에 버전 관리 전략 적용 |

### 주요 데코레이터

| 데코레이터 | 역할 |
|------------|------|
| [`@ApiTags()`](references/decorators.md#apitagstag) | 컨트롤러를 태그로 그룹핑 |
| [`@ApiOperation()`](references/decorators.md#apioperationoptions) | 엔드포인트의 요약과 설명 작성 |
| [`@ApiResponse()`](references/decorators.md#apiresponse-계열) (및 축약형들) | 응답 상태 코드와 타입 문서화 |
| [`@ApiProperty()`](references/decorators.md#apipropertyoptions) / [`@ApiPropertyOptional()`](references/decorators.md#apipropertyoptions) | DTO 속성의 타입, 설명, 예시 정의 |
| [`@ApiParam()`](references/decorators.md#apiparam-apiquery-apibody) / [`@ApiQuery()`](references/decorators.md#apiparam-apiquery-apibody) | 경로/쿼리 파라미터 문서화 |
| [`@ApiBearerAuth()`](references/decorators.md#apibearerauth) | JWT 인증 필요 표시 |

### DTO 유틸리티

| 유틸리티 | 설명 |
|----------|------|
| `PartialType` | 모든 속성을 optional로 (수정 DTO에 유용) |
| `PickType` | 특정 속성만 선택 |
| `OmitType` | 특정 속성을 제외 |
| `IntersectionType` | 두 DTO를 합침 |

### 블로그 API 적용 결과

이 챕터를 마치면 블로그 API의 모든 엔드포인트가 Swagger 문서로 자동 생성된다.

- `http://localhost:3000/api-docs` 에서 전체 API 문서를 확인할 수 있다
- 모든 엔드포인트에 설명과 응답 코드가 문서화되어 있다
- 모든 DTO의 스키마(필드 설명, 예시값, 필수 여부)가 표시된다
- Swagger UI에서 JWT 토큰을 입력하고 인증이 필요한 API도 바로 테스트할 수 있다
- 프론트엔드 개발자가 별도의 API 명세서 없이 Swagger UI만으로 API를 파악할 수 있다

## 다음 챕터 예고

**챕터 15 - WebSocket**에서는 실시간 댓글 알림 기능을 구현한다. 게시글을 보고 있는 사용자에게 새 댓글이 작성되면 실시간으로 알림을 전송하는 기능을 `@nestjs/websockets`와 Socket.IO로 구현한다.
