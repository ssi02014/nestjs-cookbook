# 챕터 8 - Exception Filter (예외 필터)

> **이전 챕터 요약**: 챕터 7에서 TransformInterceptor로 성공 응답을 `{ success: true, data, timestamp }` 형태로 통일했다. 이번 챕터에서는 **Exception Filter**로 에러 응답도 `{ success: false, error: { ... } }` 형태로 통일하여 API 응답 포맷을 완전히 일관되게 만든다.


## 목차

- [1단계: 개념 학습](#1단계-개념-학습)
  - [1-1. Exception Filter란?](#1-1-exception-filter란)
  - [1-2. NestJS 내장 예외 클래스](#1-2-nestjs-내장-예외-클래스)
  - [1-3. 기본 예외 처리 동작 방식](#1-3-기본-예외-처리-동작-방식)
  - [1-4. 커스텀 예외 만들기](#1-4-커스텀-예외-만들기)
  - [1-5. @Catch() 데코레이터와 ExceptionFilter 인터페이스](#1-5-catch-데코레이터와-exceptionfilter-인터페이스)
  - [1-6. ArgumentsHost 활용](#1-6-argumentshost-활용)
  - [1-7. 필터 바인딩 레벨](#1-7-필터-바인딩-레벨)
- [2단계: 기본 예제](#2단계-기본-예제)
  - [2-1. 기본 HttpException 사용](#2-1-기본-httpexception-사용)
  - [2-2. 커스텀 예외 필터 만들기](#2-2-커스텀-예외-필터-만들기)
  - [2-3. 전역 예외 필터 (AllExceptionsFilter)](#2-3-전역-예외-필터-allexceptionsfilter)
- [3단계: 블로그 API 적용](#3단계-블로그-api-적용)
  - [3-1. HttpExceptionFilter 작성](#3-1-httpexceptionfilter-작성)
  - [3-2. 글로벌 필터 등록](#3-2-글로벌-필터-등록)
  - [3-3. PostsService에서 예외 활용](#3-3-postsservice에서-예외-활용)
  - [3-4. 인터셉터의 성공 응답과 짝을 이루는 에러 응답](#3-4-인터셉터의-성공-응답과-짝을-이루는-에러-응답)
  - [3-5. 최종 통합 테스트](#3-5-최종-통합-테스트)
- [핵심 요약](#핵심-요약)

---


## 1단계: 개념 학습

### 1-1. Exception Filter란?

웹 API를 만들다 보면 에러는 반드시 발생한다. 존재하지 않는 게시글을 조회하거나, 권한이 없는 사용자가 삭제를 시도하거나, 서버 내부에서 예상치 못한 오류가 일어날 수 있다. 이때 중요한 것은 **"에러가 발생했을 때 클라이언트에게 어떤 응답을 보낼 것인가"** 이다.

**Exception Filter(예외 필터)** 는 바로 이 역할을 한다. 애플리케이션 어디에서든 throw된 예외를 잡아서, 클라이언트에게 보낼 HTTP 응답으로 변환하는 계층이다.

```
Client Request
    |
    v
Middleware -> Guard -> Interceptor(pre) -> Pipe -> Controller -> Service
    |                                                              |
    |                  예외 발생 시 어디서든                          |
    |<-------------- Exception Filter <----------------------------+
    |
    v
Client Response (에러 응답)
```

**핵심 역할 4가지:**

1. 처리되지 않은 예외를 잡아서 사용자 친화적인 에러 응답으로 변환
2. 에러 응답 포맷을 통일 (프론트엔드 개발자가 일관된 에러 처리 가능)
3. 에러 로깅, 모니터링 등 부가 작업 수행
4. 예외 타입에 따라 다른 처리 로직 적용

> **팁:** Exception Filter는 NestJS 요청 라이프사이클에서 **가장 마지막**에 위치한다. 즉, 컨트롤러, 서비스, 파이프, 가드, 인터셉터 중 어디에서 예외가 발생하든 Exception Filter가 최종적으로 처리한다.

---

### 1-2. NestJS 내장 예외 클래스

NestJS는 `@nestjs/common` 패키지에서 다양한 HTTP 예외 클래스를 제공한다. 모든 내장 예외는 **HttpException**을 상속한다.

#### HttpException (기본 클래스)

가장 기본이 되는 예외 클래스다. 직접 사용할 수도 있고, 이를 상속하여 커스텀 예외를 만들 수도 있다.

```typescript
// 기본 사용법 - 문자열 메시지
throw new HttpException('접근이 금지되었습니다', HttpStatus.FORBIDDEN);
// -> { "statusCode": 403, "message": "접근이 금지되었습니다" }

// 객체로 응답 본문 커스터마이즈
throw new HttpException(
  {
    statusCode: HttpStatus.FORBIDDEN,
    message: '접근 권한이 없습니다',
    error: 'Forbidden',
  },
  HttpStatus.FORBIDDEN,
);
// -> { "statusCode": 403, "message": "접근 권한이 없습니다", "error": "Forbidden" }
```

#### 자주 사용하는 내장 예외 클래스

NestJS가 미리 만들어둔 예외 클래스들이다. `HttpException`을 직접 사용하는 것보다 가독성이 좋다.

| 예외 클래스 | HTTP 상태 코드 | 설명 | 사용 예시 |
|------------|---------------|------|----------|
| `BadRequestException` | 400 | 잘못된 요청 | 유효하지 않은 데이터 |
| `UnauthorizedException` | 401 | 인증 실패 | 로그인하지 않은 사용자 |
| `ForbiddenException` | 403 | 권한 부족 | 다른 사람의 게시글 삭제 시도 |
| `NotFoundException` | 404 | 리소스 없음 | 존재하지 않는 게시글 조회 |
| `MethodNotAllowedException` | 405 | 허용되지 않은 메서드 | GET만 허용하는데 POST 요청 |
| `ConflictException` | 409 | 리소스 충돌 | 이미 존재하는 이메일로 회원가입 |
| `UnprocessableEntityException` | 422 | 처리 불가 엔티티 | 형식은 맞지만 의미가 틀린 데이터 |
| `InternalServerErrorException` | 500 | 서버 내부 오류 | 예상치 못한 서버 에러 |

> **팁:** 상태 코드를 직접 외울 필요 없다. `new NotFoundException('게시글을 찾을 수 없습니다')` 이렇게 쓰면 자동으로 404 응답이 된다.

---

### 1-3. 기본 예외 처리 동작 방식

NestJS에는 **기본 내장 예외 필터(Built-in Exception Filter)** 가 이미 전역으로 등록되어 있다. 별도의 Exception Filter를 작성하지 않아도 예외가 자동으로 처리된다.

#### 동작 규칙

1. **HttpException 또는 그 하위 클래스**가 throw되면 -> 해당 상태 코드와 메시지로 JSON 응답 생성
2. **HttpException이 아닌 일반 예외**(TypeError 등)가 throw되면 -> `500 Internal Server Error`로 응답

#### 기본 응답 형태

```json
// NotFoundException을 throw한 경우
{
  "statusCode": 404,
  "message": "게시글을 찾을 수 없습니다",
  "error": "Not Found"
}

// 일반 Error를 throw한 경우 (TypeError 등)
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

이 기본 응답 포맷이 프로젝트에 맞지 않을 때, **커스텀 Exception Filter**를 만들어 응답 형태를 바꿀 수 있다. 이것이 이번 챕터에서 다루는 핵심이다.

---

### 1-4. 커스텀 예외 만들기

비즈니스 로직에 맞는 의미 있는 예외를 만들려면 `HttpException`을 상속하면 된다.

```typescript
// src/common/exceptions/business.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';

// 비즈니스 예외의 기본 클래스
export class BusinessException extends HttpException {
  private readonly errorCode: string;

  constructor(message: string, errorCode: string, status: HttpStatus) {
    super({ message, errorCode }, status);
    this.errorCode = errorCode;
  }

  getErrorCode(): string {
    return this.errorCode;
  }
}
```

```typescript
// src/common/exceptions/entity-not-found.exception.ts
import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './business.exception';

// "엔티티를 찾을 수 없음" 예외
export class EntityNotFoundException extends BusinessException {
  constructor(entity: string, id: string | number) {
    super(
      `${entity}(ID: ${id})를 찾을 수 없습니다`,
      'ENTITY_NOT_FOUND',
      HttpStatus.NOT_FOUND,
    );
  }
}
```

**왜 커스텀 예외를 만들까?**

- `errorCode`를 포함하여 프론트엔드에서 에러 타입별 분기 처리가 쉬워진다
- 예외 이름만 봐도 어떤 상황인지 알 수 있다 (`EntityNotFoundException` vs `NotFoundException`)
- 도메인별로 일관된 에러 패턴을 유지할 수 있다

> **팁:** 작은 프로젝트에서는 NestJS 내장 예외(`NotFoundException`, `ForbiddenException` 등)만으로 충분하다. 커스텀 예외는 프로젝트가 커지고 에러 코드 관리가 필요해질 때 도입하면 된다.

---

### 1-5. [@Catch()](../references/decorators.md#catchexceptiontype) 데코레이터와 ExceptionFilter 인터페이스

커스텀 Exception Filter를 만들기 위해 필요한 두 가지 핵심 요소가 있다.

#### ExceptionFilter 인터페이스

`catch()` 메서드 하나를 정의하는 인터페이스다. 이 메서드 안에서 에러 응답을 직접 구성한다.

```typescript
export interface ExceptionFilter<T = any> {
  catch(exception: T, host: ArgumentsHost): any;
}
```

| 인자 | 타입 | 설명 |
|------|------|------|
| `exception` | `T` | 현재 처리 중인 예외 객체 |
| `host` | `ArgumentsHost` | 요청/응답 객체에 접근할 수 있는 유틸리티 |

#### [@Catch()](../references/decorators.md#catchexceptiontype) 데코레이터

이 필터가 **어떤 예외 타입**을 처리할지 지정한다.

```typescript
// 특정 예외만 처리
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter { ... }

// 여러 예외 타입 동시 처리
@Catch(HttpException, TypeError)
export class MultiExceptionFilter implements ExceptionFilter { ... }

// 모든 예외 처리 (인자 없이 사용)
@Catch()
export class AllExceptionsFilter implements ExceptionFilter { ... }
```

#### 기본적인 커스텀 필터 구조

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException) // HttpException과 그 하위 클래스를 잡는다
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // 1. HTTP 컨텍스트에서 요청/응답 객체를 꺼낸다
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 2. 예외에서 상태 코드와 메시지를 추출한다
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message;

    // 3. 원하는 형태로 응답을 보낸다
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
```

---

### 1-6. ArgumentsHost 활용

`ArgumentsHost`는 현재 실행 컨텍스트의 요청/응답 객체에 접근할 수 있게 해주는 유틸리티 클래스다. NestJS는 HTTP뿐만 아니라 WebSocket, gRPC 등 다양한 전송 계층을 지원하기 때문에, 각 컨텍스트에 맞는 메서드를 제공한다.

#### HTTP 컨텍스트 (가장 많이 사용)

```typescript
catch(exception: HttpException, host: ArgumentsHost) {
  // 현재 실행 컨텍스트 타입 확인
  console.log(host.getType()); // 'http' | 'ws' | 'rpc'

  // HTTP 컨텍스트로 전환
  const ctx = host.switchToHttp();

  // Request 객체 - 클라이언트가 보낸 요청 정보
  const request = ctx.getRequest<Request>();
  request.url;     // 요청 URL (예: '/posts/1')
  request.method;  // HTTP 메서드 (예: 'GET')
  request.body;    // 요청 본문
  request.params;  // URL 파라미터 (예: { id: '1' })
  request.query;   // 쿼리 파라미터 (예: { page: '1' })
  request.ip;      // 클라이언트 IP

  // Response 객체 - 클라이언트에게 보낼 응답
  const response = ctx.getResponse<Response>();
  response.status(404).json({ message: 'Not Found' });
}
```

#### WebSocket / RPC 컨텍스트 (참고)

```typescript
// WebSocket
const wsCtx = host.switchToWs();
const client = wsCtx.getClient(); // 소켓 클라이언트
const data = wsCtx.getData();     // 수신 데이터

// RPC (마이크로서비스)
const rpcCtx = host.switchToRpc();
const data = rpcCtx.getData();       // 요청 데이터
const context = rpcCtx.getContext(); // 컨텍스트 정보
```

> **팁:** 블로그 API처럼 일반적인 REST API를 만든다면 `host.switchToHttp()`만 알면 된다. WebSocket이나 RPC는 해당 기능을 사용할 때 배우면 된다.

---

### 1-7. 필터 바인딩 레벨

Exception Filter는 3가지 레벨에서 바인딩할 수 있다. Guard, Interceptor와 동일한 패턴이다.

#### 메서드 레벨 - 특정 핸들러에만 적용

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, UseFilters } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

@Controller('posts')
export class PostsController {
  @Get(':id')
  @UseFilters(HttpExceptionFilter) // 이 메서드에서 발생한 예외만 처리
  findOne() { ... }
}
```

#### 컨트롤러 레벨 - 해당 컨트롤러 전체에 적용

```typescript
// src/posts/posts.controller.ts
@UseFilters(HttpExceptionFilter) // 컨트롤러의 모든 핸들러에 적용
@Controller('posts')
export class PostsController { ... }
```

#### 글로벌 레벨 - 애플리케이션 전체에 적용

**방법 A: main.ts에서 직접 등록**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new HttpExceptionFilter()); // DI 불가
  await app.listen(3000);
}
bootstrap();
```

**방법 B: APP_FILTER 토큰으로 등록 (권장)**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
```

> **팁:** 방법 A는 `new`로 직접 인스턴스를 만들기 때문에 DI(의존성 주입)를 사용할 수 없다. 필터 안에서 Logger 같은 서비스를 주입해야 한다면 반드시 방법 B를 사용한다.

#### 바인딩 우선순위

```
메서드 레벨 > 컨트롤러 레벨 > 글로벌 레벨
```

더 좁은 범위의 필터가 우선 적용된다. 메서드 레벨 필터가 예외를 처리하면 컨트롤러/글로벌 레벨 필터는 실행되지 않는다.

---

## 2단계: 기본 예제

### 2-1. 기본 HttpException 사용

Exception Filter를 만들기 전에, 먼저 NestJS의 기본 예외 처리가 어떻게 동작하는지 확인하자.

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

@Controller('posts')
export class PostsController {
  // 예시 1: HttpException 직접 사용
  @Get('error-test')
  throwBasicError() {
    throw new HttpException(
      '이것은 테스트 에러입니다',
      HttpStatus.BAD_REQUEST,
    );
    // 응답: { "statusCode": 400, "message": "이것은 테스트 에러입니다" }
  }

  // 예시 2: 내장 예외 사용 (권장 - 가독성이 좋다)
  @Get(':id')
  findOne(@Param('id') id: string) {
    const post = null; // 게시글이 없다고 가정

    if (!post) {
      throw new NotFoundException(`ID ${id}인 게시글을 찾을 수 없습니다`);
      // 응답: { "statusCode": 404, "message": "ID 1인 게시글을 찾을 수 없습니다", "error": "Not Found" }
    }

    return post;
  }

  // 예시 3: ForbiddenException
  @Get(':id/delete')
  deletePost(@Param('id') id: string) {
    const isOwner = false; // 작성자가 아니라고 가정

    if (!isOwner) {
      throw new ForbiddenException('본인이 작성한 게시글만 삭제할 수 있습니다');
      // 응답: { "statusCode": 403, "message": "본인이 작성한 게시글만 삭제할 수 있습니다", "error": "Forbidden" }
    }
  }
}
```

> **팁:** 기본 내장 예외 필터만으로도 동작은 하지만, 응답 포맷이 `{ statusCode, message, error }` 형태로 고정된다. 프로젝트에 맞는 에러 응답 포맷을 원한다면 커스텀 필터가 필요하다.

---

### 2-2. 커스텀 예외 필터 만들기

에러 응답에 `timestamp`, `path`, `method` 등 추가 정보를 포함시키는 커스텀 필터를 만들어 보자.

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // exception.getResponse()가 문자열일 수도, 객체일 수도 있다
    const exceptionResponse = exception.getResponse();
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || exception.message;

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // 로깅: 4xx는 경고, 5xx는 에러
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status}`,
        exception.stack,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} ${status} - ${message}`);
    }

    response.status(status).json(errorResponse);
  }
}
```

**사용:**

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, UseFilters, NotFoundException } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

@UseFilters(HttpExceptionFilter) // 컨트롤러 레벨 적용
@Controller('posts')
export class PostsController {
  @Get(':id')
  findOne() {
    throw new NotFoundException('게시글을 찾을 수 없습니다');
  }
}
```

**응답 결과:**

```json
{
  "statusCode": 404,
  "timestamp": "2026-04-09T12:00:00.000Z",
  "path": "/posts/1",
  "method": "GET",
  "message": "게시글을 찾을 수 없습니다"
}
```

기본 응답과 비교하면 `timestamp`, `path`, `method` 정보가 추가되었다. 에러를 디버깅할 때 유용한 정보들이다.

---

### 2-3. 전역 예외 필터 (AllExceptionsFilter)

[`@Catch(HttpException)`](../references/decorators.md#catchexceptiontype)은 HttpException 계열만 잡는다. 만약 코드에서 `TypeError`나 `ReferenceError` 같은 일반 JavaScript 에러가 발생하면 이 필터를 통과해버린다. **모든 예외를 빠짐없이 잡으려면** [`@Catch()`](../references/decorators.md#catchexceptiontype) 인자를 비워두면 된다.

```typescript
// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // 인자 없음 = 모든 예외를 잡는다
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // HttpException인지 일반 Error인지에 따라 분기
    let status: number;
    let message: string | string[];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as any).message || exception.message;
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '서버 내부 오류가 발생했습니다'; // 실제 에러 메시지는 숨긴다 (보안)

      // 예상치 못한 에러는 스택 트레이스를 반드시 로깅
      this.logger.error(
        `Unexpected error: ${exception.message}`,
        exception.stack,
      );
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = '알 수 없는 오류가 발생했습니다';
      this.logger.error(`Unknown exception: ${JSON.stringify(exception)}`);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    });
  }
}
```

> **Tip (보안):** 5xx 서버 에러가 발생했을 때, 실제 에러 메시지(예: "Cannot read property 'x' of undefined")를 클라이언트에게 그대로 보내면 안 된다. 내부 구조가 노출될 수 있기 때문이다. 서버 로그에만 기록하고, 클라이언트에게는 "서버 내부 오류가 발생했습니다" 같은 일반적인 메시지만 보낸다.

---

## 3단계: 블로그 API 적용

이제 실제 블로그 API에 Exception Filter를 적용한다. 챕터 7에서 만든 `TransformInterceptor`가 **성공 응답**을 래핑했다면, 이번에 만드는 `HttpExceptionFilter`는 **에러 응답**을 래핑한다. 둘이 짝을 이루어 **일관된 API 응답 포맷**을 완성한다.

### 3-1. HttpExceptionFilter 작성

블로그 API의 에러 응답을 `{ success: false, error: { statusCode, message, path, timestamp } }` 형태로 통일하는 필터다.

```typescript
// src/common/filters/http-exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() // 모든 예외를 잡는다
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1) HttpException인지 일반 Error인지 판별
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception);

    // 2) 에러 응답 포맷 구성
    const errorResponse = {
      success: false,
      error: {
        statusCode: status,
        message,
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    };

    // 3) 로깅
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${status} - ${message}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${status} - ${message}`,
      );
    }

    // 4) 응답 전송
    response.status(status).json(errorResponse);
  }

  // 예외 객체에서 메시지를 추출하는 헬퍼 메서드
  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      // ValidationPipe가 던지는 예외는 message가 배열일 수 있다
      return (response as any).message || exception.message;
    }

    if (exception instanceof Error) {
      // 5xx 에러는 실제 메시지를 숨긴다 (보안)
      return '서버 내부 오류가 발생했습니다';
    }

    return '알 수 없는 오류가 발생했습니다';
  }
}
```

**왜 [`@Catch()`](../references/decorators.md#catchexceptiontype)에 인자를 넣지 않았을까?**

[`@Catch(HttpException)`](../references/decorators.md#catchexceptiontype)으로 하면 HttpException만 잡는다. 하지만 서비스 로직에서 예상치 못한 `TypeError`나 `RangeError` 같은 일반 에러가 발생할 수도 있다. [`@Catch()`](../references/decorators.md#catchexceptiontype)로 모든 예외를 잡아서 통일된 포맷으로 응답하면, 클라이언트 입장에서 어떤 에러든 같은 구조로 처리할 수 있다.

---

### 3-2. 글로벌 필터 등록

`APP_FILTER` 토큰을 사용하여 DI가 가능한 방식으로 전역 등록한다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PostsModule } from './posts/posts.module';

@Module({
  imports: [PostsModule],
  providers: [
    // 전역 예외 필터 등록
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    // 전역 인터셉터 등록 (챕터 7에서 만든 것)
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
```

> **팁:** `APP_FILTER`와 `APP_INTERCEPTOR`를 함께 등록하면, 성공 응답은 인터셉터가, 에러 응답은 필터가 각각 담당한다. 예외가 발생하면 인터셉터의 `map()` 연산자는 실행되지 않고, Exception Filter가 직접 응답을 보낸다.

---

### 3-3. PostsService에서 예외 활용

블로그 서비스에서 적절한 예외를 던지면, 위에서 만든 필터가 자동으로 에러 응답을 생성한다.

```typescript
// src/posts/posts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;
}

@Injectable()
export class PostsService {
  private posts: Post[] = [
    { id: 1, title: '첫 번째 게시글', content: 'NestJS 시작하기', authorId: 1 },
    { id: 2, title: '두 번째 게시글', content: 'Exception Filter 배우기', authorId: 2 },
  ];
  private nextId = 3;

  findAll(): Post[] {
    return this.posts;
  }

  findOne(id: number): Post {
    const post = this.posts.find((p) => p.id === id);

    if (!post) {
      // NotFoundException -> 404 응답
      throw new NotFoundException(`ID ${id}인 게시글을 찾을 수 없습니다`);
    }

    return post;
  }

  create(createPostDto: CreatePostDto, authorId: number): Post {
    // 같은 제목의 게시글이 있는지 확인
    const exists = this.posts.find((p) => p.title === createPostDto.title);

    if (exists) {
      // ConflictException -> 409 응답
      throw new ConflictException(
        `"${createPostDto.title}" 제목의 게시글이 이미 존재합니다`,
      );
    }

    const newPost: Post = {
      id: this.nextId++,
      title: createPostDto.title,
      content: createPostDto.content,
      authorId,
    };

    this.posts.push(newPost);
    return newPost;
  }

  update(id: number, updatePostDto: UpdatePostDto, userId: number): Post {
    const post = this.findOne(id); // 게시글이 없으면 NotFoundException

    // 작성자만 수정 가능
    if (post.authorId !== userId) {
      // ForbiddenException -> 403 응답
      throw new ForbiddenException('본인이 작성한 게시글만 수정할 수 있습니다');
    }

    // 수정 적용
    if (updatePostDto.title) post.title = updatePostDto.title;
    if (updatePostDto.content) post.content = updatePostDto.content;

    return post;
  }

  remove(id: number, userId: number): void {
    const post = this.findOne(id); // 게시글이 없으면 NotFoundException

    // 작성자만 삭제 가능
    if (post.authorId !== userId) {
      // ForbiddenException -> 403 응답
      throw new ForbiddenException('본인이 작성한 게시글만 삭제할 수 있습니다');
    }

    this.posts = this.posts.filter((p) => p.id !== id);
  }
}
```

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    // 실제로는 Guard에서 인증된 userId를 받지만, 여기서는 하드코딩
    const userId = 1;
    return this.postsService.create(createPostDto, userId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const userId = 1;
    return this.postsService.update(id, updatePostDto, userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    const userId = 1;
    this.postsService.remove(id, userId);
    return { deleted: true };
  }
}
```

---

### 3-4. 인터셉터의 성공 응답과 짝을 이루는 에러 응답

챕터 7에서 만든 `TransformInterceptor`의 성공 응답과 이번 `HttpExceptionFilter`의 에러 응답을 나란히 비교해 보자.

#### 성공 응답 (TransformInterceptor가 처리)

```json
// GET /posts/1 - 게시글 조회 성공
{
  "success": true,
  "statusCode": 200,
  "data": {
    "id": 1,
    "title": "첫 번째 게시글",
    "content": "NestJS 시작하기",
    "authorId": 1
  },
  "timestamp": "2026-04-09T12:00:00.000Z",
  "path": "/posts/1"
}
```

#### 에러 응답 (HttpExceptionFilter가 처리)

```json
// GET /posts/999 - 존재하지 않는 게시글 조회
{
  "success": false,
  "error": {
    "statusCode": 404,
    "message": "ID 999인 게시글을 찾을 수 없습니다",
    "path": "/posts/999",
    "timestamp": "2026-04-09T12:00:00.000Z"
  }
}
```

**패턴 비교:**

| 항목 | 성공 응답 | 에러 응답 |
|------|----------|----------|
| `success` | `true` | `false` |
| 데이터 위치 | `data` 필드 | `error` 필드 |
| 상태 코드 | `statusCode` | `error.statusCode` |
| 담당 | TransformInterceptor | HttpExceptionFilter |

프론트엔드에서는 `success` 필드만 확인하면 성공/실패를 바로 알 수 있다.

```typescript
// 프론트엔드 코드 예시
const response = await fetch('/api/posts/1');
const result = await response.json();

if (result.success) {
  // 성공: result.data 사용
  console.log(result.data);
} else {
  // 실패: result.error 사용
  console.error(result.error.message);
}
```

---

### 3-5. 최종 통합 테스트

블로그 API에 다양한 요청을 보내서 성공/에러 응답이 일관되게 나오는지 확인한다.

```bash
# 1. 게시글 전체 조회 (성공)
GET /posts

# 응답:
{
  "success": true,
  "statusCode": 200,
  "data": [
    { "id": 1, "title": "첫 번째 게시글", "content": "NestJS 시작하기", "authorId": 1 },
    { "id": 2, "title": "두 번째 게시글", "content": "Exception Filter 배우기", "authorId": 2 }
  ],
  "timestamp": "2026-04-09T12:00:00.000Z",
  "path": "/posts"
}
```

```bash
# 2. 존재하지 않는 게시글 조회 (404 에러)
GET /posts/999

# 응답:
{
  "success": false,
  "error": {
    "statusCode": 404,
    "message": "ID 999인 게시글을 찾을 수 없습니다",
    "path": "/posts/999",
    "timestamp": "2026-04-09T12:00:00.000Z"
  }
}
```

```bash
# 3. 다른 사람의 게시글 수정 시도 (403 에러)
# (userId=1인 사용자가 authorId=2인 게시글을 수정하려고 함)
PUT /posts/2
{ "title": "수정된 제목" }

# 응답:
{
  "success": false,
  "error": {
    "statusCode": 403,
    "message": "본인이 작성한 게시글만 수정할 수 있습니다",
    "path": "/posts/2",
    "timestamp": "2026-04-09T12:00:00.000Z"
  }
}
```

```bash
# 4. 중복 제목으로 게시글 생성 (409 에러)
POST /posts
{ "title": "첫 번째 게시글", "content": "중복 테스트" }

# 응답:
{
  "success": false,
  "error": {
    "statusCode": 409,
    "message": "\"첫 번째 게시글\" 제목의 게시글이 이미 존재합니다",
    "path": "/posts",
    "timestamp": "2026-04-09T12:00:00.000Z"
  }
}
```

```bash
# 5. 잘못된 파라미터 (400 에러 - ParseIntPipe)
GET /posts/abc

# 응답:
{
  "success": false,
  "error": {
    "statusCode": 400,
    "message": "Validation failed (numeric string is expected)",
    "path": "/posts/abc",
    "timestamp": "2026-04-09T12:00:00.000Z"
  }
}
```

> **팁:** `ParseIntPipe`가 던지는 `BadRequestException`도 우리가 만든 HttpExceptionFilter가 잡아서 동일한 에러 포맷으로 응답한다. Pipe, Guard 등 어디에서 예외가 발생하든 항상 같은 포맷이 보장된다.

---

## 핵심 요약

| 개념 | 설명 |
|------|------|
| **Exception Filter** | 예외를 잡아 HTTP 응답으로 변환하는 계층, 라이프사이클의 마지막 단계 |
| **HttpException** | 모든 내장 HTTP 예외의 기본 클래스 |
| **@Catch()** | 필터가 처리할 예외 타입을 지정하는 데코레이터. 인자 없으면 모든 예외 |
| **ExceptionFilter** | 커스텀 필터가 구현해야 하는 인터페이스 (`catch()` 메서드) |
| **ArgumentsHost** | 실행 컨텍스트의 요청/응답 객체 접근 유틸리티 |
| **@UseFilters()** | 메서드/컨트롤러 레벨에서 필터를 바인딩하는 데코레이터 |
| **APP_FILTER** | 모듈에서 글로벌 필터를 DI와 함께 등록할 때 사용하는 토큰 |

### 이 챕터에서 완성한 것

```
성공 응답 (TransformInterceptor)     에러 응답 (HttpExceptionFilter)
{                                    {
  "success": true,                     "success": false,
  "statusCode": 200,                   "error": {
  "data": { ... },                       "statusCode": 404,
  "timestamp": "...",                    "message": "...",
  "path": "/posts"                       "path": "/posts/999",
}                                        "timestamp": "..."
                                       }
                                     }
```

**인터셉터(챕터 7)의 성공 응답 + 예외 필터(챕터 8)의 에러 응답 = 일관된 API 응답 포맷 완성**

### 베스트 프랙티스

1. **전역 필터를 등록**하여 에러 응답 포맷을 통일한다
2. **APP_FILTER 토큰**을 사용하여 DI가 가능한 방식으로 글로벌 필터를 등록한다
3. **5xx 에러는 상세 정보를 숨기고** 서버 로그에만 기록한다 (보안)
4. **4xx 에러는 클라이언트에 구체적인 메시지**를 제공한다 (사용성)
5. **Service에서 적절한 예외를 throw**하고, 필터에서 일괄 처리한다
6. 인터셉터와 예외 필터를 **짝으로** 사용하여 성공/에러 응답 포맷을 맞춘다
---

## 다음 챕터 예고

챕터 9에서는 **Custom Decorator**를 학습한다. `@CurrentUser()` 데코레이터를 만들어 컨트롤러에서 현재 유저 정보를 간결하게 추출하고, `@Public()`을 정식 데코레이터로 리팩토링한다. Phase 1~3의 마지막 챕터다.

