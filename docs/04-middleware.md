# 챕터 4 - Middleware

> **이전 챕터 요약**: 챕터 3에서 Service를 만들고 DI로 Controller에 주입하여, 메모리 기반의 블로그 CRUD API를 완성했다. 이번 챕터에서는 **Middleware**를 추가하여 모든 요청을 로깅한다.


## 목차

1. [Middleware란 무엇인가](#1-middleware란-무엇인가)
2. [NestJS 요청 라이프사이클에서 미들웨어의 위치](#2-nestjs-요청-라이프사이클에서-미들웨어의-위치)
3. [클래스 미들웨어 (NestMiddleware)](#3-클래스-미들웨어-nestmiddleware)
4. [함수형 미들웨어](#4-함수형-미들웨어)
5. [미들웨어 적용 방법 (NestModule configure)](#5-미들웨어-적용-방법-nestmodule-configure)
6. [특정 라우트/컨트롤러에만 적용하기](#6-특정-라우트컨트롤러에만-적용하기)
7. [글로벌 미들웨어](#7-글로벌-미들웨어)
8. [여러 미들웨어 체이닝](#8-여러-미들웨어-체이닝)
9. [기본 예제](#9-기본-예제)
10. [블로그 API에 적용하기](#10-블로그-api에-적용하기)
11. [CORS 설정](#11-cors-설정)
12. [에러 발생 시 미들웨어 동작](#12-에러-발생-시-미들웨어-동작)

---

## 1. Middleware란 무엇인가

Middleware(미들웨어)는 **라우트 핸들러가 실행되기 전에** 호출되는 함수다. "미들(middle)"이라는 이름처럼, 클라이언트의 요청과 서버의 응답 **사이에서** 실행된다.

```
클라이언트 요청 --> [ Middleware ] --> 라우트 핸들러 --> 응답
```

미들웨어 함수는 다음 세 가지 객체에 접근할 수 있다:

- **`request`** (req): 클라이언트가 보낸 요청 정보
- **`response`** (res): 서버가 보낼 응답 정보
- **`next()`**: 다음 미들웨어 또는 라우트 핸들러로 제어를 넘기는 함수

### Express 미들웨어와의 관계

NestJS의 미들웨어는 **Express 미들웨어와 동일**하다. Express를 써본 적이 있다면 이미 익숙한 개념이다. Express 공식 문서에서 설명하는 미들웨어의 모든 기능을 NestJS에서도 그대로 사용할 수 있다.

미들웨어가 할 수 있는 일:

- 어떤 코드든 실행할 수 있다 (로깅, 인증 검사 등)
- `request`, `response` 객체를 변경할 수 있다 (헤더 추가, 바디 파싱 등)
- `request-response` 사이클을 종료할 수 있다 (에러 시 바로 응답 반환)
- 스택의 다음 미들웨어 함수를 호출할 수 있다 (`next()`)

> **주의:**: 미들웨어가 `request-response` 사이클을 종료하지 않으면, 반드시 `next()`를 호출해야 한다. `next()`를 호출하지 않으면 요청이 영원히 멈춘다(hang). 브라우저가 계속 로딩 중인 상태로 남게 되므로 꼭 기억하자.

NestJS에서는 미들웨어를 **클래스** 또는 **함수**, 두 가지 방식으로 구현할 수 있다.

---

## 2. NestJS 요청 라이프사이클에서 미들웨어의 위치

NestJS는 요청이 들어오면 정해진 순서대로 여러 단계를 거친다. 미들웨어는 이 중 **가장 먼저 실행**된다.

```
요청 (Request)
  |
  v
1. Middleware        <-- 가장 먼저 실행!
  |
  v
2. Guard             <-- 인가(Authorization) 검사
  |
  v
3. Interceptor (전)  <-- 요청 전처리
  |
  v
4. Pipe              <-- 데이터 변환/유효성 검사
  |
  v
5. Route Handler     <-- 실제 컨트롤러 메서드 실행
  |
  v
6. Interceptor (후)  <-- 응답 후처리
  |
  v
7. Exception Filter  <-- 예외 발생 시 처리
  |
  v
응답 (Response)
```

> **팁:**: 미들웨어는 Guard나 Interceptor보다 먼저 실행된다. 따라서 요청 로깅, CORS 설정, 바디 파싱 같은 **모든 요청에 공통으로 필요한 전처리**에 적합하다. 반면, 특정 핸들러에 대한 인가(authorization) 검사는 Guard가 더 적합하다. Guard는 `ExecutionContext`를 통해 다음에 실행될 핸들러를 알 수 있지만, 미들웨어는 `next()`를 호출한 후 어떤 핸들러가 실행될지 알 수 없기 때문이다.

---

## 3. 클래스 미들웨어 (NestMiddleware)

클래스 미들웨어는 [`@Injectable()`](../references/decorators.md#injectableoptions) 데코레이터를 붙이고, `NestMiddleware` 인터페이스를 구현해서 만든다.

```typescript
// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[Request] ${req.method} ${req.originalUrl}`);
    next(); // 반드시 호출해야 다음 단계로 넘어간다!
  }
}
```

**핵심 포인트:**

| 요소 | 설명 |
|------|------|
| [`@Injectable()`](../references/decorators.md#injectableoptions) | NestJS의 DI 컨테이너에 등록한다. 다른 서비스를 주입받을 수 있다 |
| `NestMiddleware` | `use()` 메서드를 반드시 구현해야 하는 인터페이스 |
| `use(req, res, next)` | 실제 미들웨어 로직을 작성하는 메서드 |

### 클래스 미들웨어의 가장 큰 장점: 의존성 주입(DI)

클래스 미들웨어는 [`@Injectable()`](../references/decorators.md#injectableoptions)이므로, 생성자를 통해 다른 서비스를 주입받을 수 있다. 챕터 3에서 배운 DI가 여기서도 동작한다.

```typescript
// src/common/middleware/auth-check.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthCheckMiddleware implements NestMiddleware {
  // 생성자를 통해 ConfigService를 주입받을 수 있다!
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const apiKey = this.configService.get<string>('API_KEY');
    // apiKey를 활용한 로직 ...
    next();
  }
}
```

> **팁:**: DI가 필요하면 클래스 미들웨어를 사용하자. DI가 필요 없는 단순한 로직이라면 다음에 나오는 함수형 미들웨어가 더 간결하다.

---

## 4. 함수형 미들웨어

의존성 주입이 필요 없는 단순한 미들웨어는 **함수**로 작성하는 것이 더 간결하다. NestJS 공식 문서에서도 특별한 의존성이 없다면 함수형 미들웨어를 권장한다.

```typescript
// src/common/middleware/simple-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function simpleLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
}
```

클래스와 비교하면 훨씬 짧다. [`@Injectable()`](../references/decorators.md#injectableoptions)도, `implements NestMiddleware`도 필요 없다.

### 클래스 vs 함수형 미들웨어 비교

| 구분 | 클래스 미들웨어 | 함수형 미들웨어 |
|------|----------------|----------------|
| DI 지원 | O (다른 서비스 주입 가능) | X |
| 코드량 | 상대적으로 많음 | 간결함 |
| 사용 시점 | 서비스 주입이 필요할 때 | 단순 로직일 때 |
| NestJS 권장 | 복잡한 미들웨어 | **단순 미들웨어에 권장** |

> **팁:**: "이 미들웨어가 다른 서비스(ConfigService, Logger 등)를 주입받아야 하나?" 라고 자문해보자. "아니오"라면 함수형이 적합하다.

---

## 5. 미들웨어 적용 방법 (NestModule configure)

미들웨어는 [`@Module()`](../references/decorators.md#moduleoptions) 데코레이터 안에 넣는 것이 아니다. 모듈 클래스에서 `NestModule` 인터페이스를 구현하고, `configure()` 메서드 안에서 설정한다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { PostsModule } from './posts/posts.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [PostsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)       // 어떤 미들웨어를 적용할지
      .forRoutes('posts');           // 어떤 경로에 적용할지
  }
}
```

**단계별로 이해하기:**

1. 모듈 클래스에 `implements NestModule`을 추가한다
2. `configure(consumer: MiddlewareConsumer)` 메서드를 구현한다
3. `consumer.apply(미들웨어).forRoutes(경로)` 체이닝으로 미들웨어를 등록한다

`MiddlewareConsumer`는 미들웨어를 관리하기 위한 헬퍼 클래스로, 다음 메서드를 체이닝할 수 있다:

| 메서드 | 역할 |
|--------|------|
| `apply()` | 적용할 미들웨어를 지정 |
| `forRoutes()` | 미들웨어를 적용할 라우트를 지정 |
| `exclude()` | 특정 라우트를 제외 |

---

## 6. 특정 라우트/컨트롤러에만 적용하기

### 6-1. 문자열 경로로 지정

가장 간단한 방법이다. 문자열로 경로를 지정하면 해당 경로의 모든 HTTP 메서드(GET, POST, PATCH 등)에 적용된다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('posts'); // '/posts' 경로의 모든 메서드에 적용
  }
}
```

### 6-2. HTTP 메서드와 경로 조합으로 지정

특정 HTTP 메서드에만 적용하고 싶다면 객체 형태로 지정한다.

```typescript
// src/app.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(
        { path: 'posts', method: RequestMethod.GET },
        { path: 'posts', method: RequestMethod.POST },
      );
    // GET /posts, POST /posts 에만 미들웨어가 동작한다
    // PATCH /posts/:id, DELETE /posts/:id 에는 동작하지 않는다
  }
}
```

### 6-3. 컨트롤러 클래스로 지정

컨트롤러 클래스를 직접 전달하면 해당 컨트롤러의 모든 라우트에 미들웨어가 적용된다. 가장 실용적인 방법이다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { PostsController } from './posts/posts.controller';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes(PostsController); // PostsController의 모든 라우트에 적용
  }
}
```

### 6-4. 특정 라우트 제외하기 (exclude)

`exclude()` 메서드로 특정 경로를 미들웨어 적용에서 제외할 수 있다.

```typescript
// src/app.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        { path: 'posts/health', method: RequestMethod.GET }, // 헬스체크는 제외
      )
      .forRoutes('posts');
  }
}
```

> **팁:**: `exclude()`는 반드시 `forRoutes()` 앞에 호출해야 한다. 순서가 바뀌면 동작하지 않는다.

### 6-5. 와일드카드 패턴

`forRoutes()`에서 와일드카드 패턴을 사용할 수 있다. `path-to-regexp` 패키지의 패턴을 따른다.

```typescript
// 'ab'로 시작하고 'cd'로 끝나는 모든 경로 (예: abcd, ab123cd)
forRoutes({ path: 'ab*cd', method: RequestMethod.ALL });
```

---

## 7. 글로벌 미들웨어

모든 라우트에 미들웨어를 적용하는 방법은 두 가지가 있다.

### 방법 1: main.ts에서 app.use() (함수형 미들웨어만 가능)

`main.ts`에서 `app.use()`를 사용하면 전역으로 적용된다. 이 방식은 DI 컨테이너 밖에서 동작하므로 **함수형 미들웨어만 사용할 수 있다**.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { simpleLoggerMiddleware } from './common/middleware/simple-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 글로벌 미들웨어 적용 (함수형만 가능)
  app.use(simpleLoggerMiddleware);

  await app.listen(3000);
}
bootstrap();
```

### 방법 2: AppModule에서 forRoutes('*') (클래스 미들웨어도 가능)

클래스 미들웨어를 전역으로 적용하고 싶다면, `AppModule`의 `configure()` 메서드에서 `forRoutes('*')`를 사용한다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*'); // 모든 라우트에 적용 (DI도 사용 가능!)
  }
}
```

> **팁:**: 클래스 미들웨어에서 DI를 사용해야 한다면 방법 2를 사용하자. DI가 필요 없는 단순한 미들웨어라면 방법 1이 더 간편하다.

---

## 8. 여러 미들웨어 체이닝

`apply()` 메서드에 여러 미들웨어를 쉼표로 구분하여 전달하면, **왼쪽에서 오른쪽 순서로** 실행된다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { PostsController } from './posts/posts.controller';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 여러 미들웨어를 순서대로 적용
    consumer
      .apply(LoggerMiddleware, AuthMiddleware)
      .forRoutes(PostsController);
  }
}
```

실행 순서:

```
요청 --> LoggerMiddleware --> AuthMiddleware --> PostsController 핸들러
```

서로 다른 라우트에 서로 다른 미들웨어를 적용할 수도 있다. `configure()` 안에서 `consumer`를 여러 번 호출하면 된다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { AuthMiddleware } from './common/middleware/auth.middleware';
import { PostsController } from './posts/posts.controller';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 1. 로깅 미들웨어: 모든 라우트에 적용
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');

    // 2. 인증 미들웨어: PostsController에만 적용
    consumer
      .apply(AuthMiddleware)
      .forRoutes(PostsController);
  }
}
```

---

## 9. 기본 예제

여기서부터는 직접 코드를 작성해보는 실습이다. 간단한 예제부터 시작해서, 마지막에 블로그 API에 적용한다.

### 예제 1: 간단한 LoggerMiddleware

모든 요청의 HTTP 메서드와 URL을 콘솔에 출력하는 가장 기본적인 미들웨어다.

```typescript
// src/common/middleware/logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log(`[LOG] ${req.method} ${req.originalUrl}`);
    next();
  }
}
```

적용:

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
```

서버를 실행하고 `GET /posts`로 요청하면 콘솔에 다음과 같이 출력된다:

```
[LOG] GET /posts
```

### 예제 2: 함수형 미들웨어

위와 동일한 기능을 함수형으로 구현한 버전이다. DI가 필요 없으니 훨씬 간결하다.

```typescript
// src/common/middleware/simple-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function simpleLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
}
```

적용 (main.ts에서 글로벌로):

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { simpleLoggerMiddleware } from './common/middleware/simple-logger.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(simpleLoggerMiddleware);
  await app.listen(3000);
}
bootstrap();
```

### 예제 3: 특정 라우트에만 적용하는 미들웨어

게시글 작성/수정/삭제 요청에만 미들웨어를 적용하고, 조회 요청은 제외하는 예제다.

```typescript
// src/common/middleware/write-log.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function writeLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(`[WRITE] ${req.method} ${req.originalUrl} - 데이터 변경 요청`);
  next();
}
```

적용:

```typescript
// src/app.module.ts
import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from '@nestjs/common';
import { writeLogMiddleware } from './common/middleware/write-log.middleware';

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(writeLogMiddleware)
      .forRoutes(
        { path: 'posts', method: RequestMethod.POST },      // 게시글 작성
        { path: 'posts/:id', method: RequestMethod.PATCH },  // 게시글 수정
        { path: 'posts/:id', method: RequestMethod.DELETE },  // 게시글 삭제
      );
    // GET /posts, GET /posts/:id 에는 적용되지 않는다
  }
}
```

---

## 10. 블로그 API에 적용하기

이제 챕터 3에서 만든 블로그 API에 **LoggerMiddleware**를 추가한다. 모든 요청의 HTTP 메서드, URL, 응답 시간을 로깅하는 미들웨어를 만들어보자.

### 10-1. LoggerMiddleware 만들기

NestJS에 내장된 `Logger` 클래스를 사용해서 깔끔한 로그를 출력한다. `console.log` 대신 `Logger`를 사용하면 로그 레벨, 타임스탬프, 컨텍스트 정보가 자동으로 포함되어 더 실용적이다.

```typescript
// src/common/middleware/logger.middleware.ts
import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const start = Date.now();

    // 응답이 완료되었을 때 로그를 출력한다
    res.on('finish', () => {
      const duration = Date.now() - start;
      const { statusCode } = res;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} - ${duration}ms`,
      );
    });

    next();
  }
}
```

**코드 설명:**

1. `new Logger('HTTP')`: NestJS 내장 Logger를 생성한다. `'HTTP'`는 로그 출처를 나타내는 컨텍스트 이름이다
2. `const start = Date.now()`: 요청이 들어온 시점의 타임스탬프를 기록한다
3. `res.on('finish', ...)`: Express의 이벤트 리스너다. 응답이 클라이언트에 전송 완료된 후 콜백이 실행된다. 이 시점에서 `Date.now() - start`를 계산하면 정확한 응답 시간을 구할 수 있다
4. `next()`: 다음 미들웨어 또는 라우트 핸들러로 제어를 넘긴다

> **팁:**: `res.on('finish')` 이벤트를 사용하는 이유는, `next()` 호출 이후에 라우트 핸들러가 실행되고 응답이 완성되기 때문이다. 요청 시점이 아니라 **응답 완료 시점**에 로그를 남겨야 상태 코드와 응답 시간을 정확히 기록할 수 있다.

### 10-2. AppModule에 미들웨어 적용하기

`AppModule`에서 `NestModule`을 구현하고, `LoggerMiddleware`를 모든 라우트에 적용한다.

```typescript
// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';

@Module({
  imports: [UsersModule, PostsModule, CommentsModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // LoggerMiddleware를 모든 라우트에 적용
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
  }
}
```

> **팁:**: `forRoutes('*')`를 사용해서 모든 라우트에 적용했다. 클래스 미들웨어이므로 `main.ts`의 `app.use()` 대신 이 방법을 사용한다. `app.use()`는 함수형 미들웨어만 지원하기 때문이다.

### 10-3. 블로그 API 실행하고 로그 확인하기

서버를 실행한다:

```bash
npm run start:dev
```

이제 블로그 API에 요청을 보내면 콘솔에 로그가 출력된다. curl 또는 Postman으로 테스트해보자:

```bash
# 게시글 목록 조회
curl http://localhost:3000/posts

# 게시글 작성
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "첫 번째 글", "content": "안녕하세요!"}'

# 게시글 상세 조회
curl http://localhost:3000/posts/1
```

콘솔에 다음과 같은 로그가 출력된다:

```
[Nest] 12345  - 04/09/2026, 10:30:00 AM  LOG [HTTP] GET /posts 200 - 3ms
[Nest] 12345  - 04/09/2026, 10:30:05 AM  LOG [HTTP] POST /posts 201 - 5ms
[Nest] 12345  - 04/09/2026, 10:30:10 AM  LOG [HTTP] GET /posts/1 200 - 2ms
```

`[HTTP]` 컨텍스트와 함께 HTTP 메서드, URL, 상태 코드, 응답 시간이 깔끔하게 기록된다.

### 10-4. 현재까지의 블로그 프로젝트 구조

```
src/
├── app.module.ts                  ← NestModule 구현, LoggerMiddleware 적용
├── main.ts
│
├── common/
│   └── middleware/
│       └── logger.middleware.ts   ← [이번 챕터에서 추가]
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   └── users.service.ts
│
├── posts/
│   ├── posts.module.ts
│   ├── posts.controller.ts
│   └── posts.service.ts
│
└── comments/
    ├── comments.module.ts
    ├── comments.controller.ts
    └── comments.service.ts
```

---

## 11. CORS 설정

CORS(Cross-Origin Resource Sharing)는 **브라우저가 다른 출처(origin)의 서버에 HTTP 요청을 보낼 때 적용되는 보안 정책**이다. 예를 들어 `http://localhost:3000`에서 실행 중인 프론트엔드가 `http://localhost:3001`의 API를 호출하면, 출처가 달라 브라우저가 요청을 차단한다. 서버에서 CORS를 허용해줘야 브라우저가 정상적으로 응답을 받을 수 있다.

### CORS 활성화 방법

#### 방법 1: 기본 활성화 (app.enableCors())

`main.ts`에서 `app.enableCors()`를 호출하면 모든 출처에서의 요청을 허용한다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 모든 출처 허용 (개발 초기에 빠르게 확인할 때 유용)
  app.enableCors();

  await app.listen(3000);
}
bootstrap();
```

#### 방법 2: 세부 설정으로 활성화

출처, 인증 정보 전송 여부, 허용 메서드 등을 세밀하게 제어할 수 있다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3001',   // 허용할 프론트엔드 출처
    credentials: true,                  // 쿠키/인증 헤더 전송 허용
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3000);
}
bootstrap();
```

> **팁:**: `credentials: true`를 사용할 때는 `origin`을 `'*'`(와일드카드)로 설정할 수 없다. 반드시 명시적인 출처를 지정해야 한다. 쿠키 기반 인증을 사용한다면 이 설정이 필수다.

### 개발 환경과 운영 환경에서의 CORS 설정 차이

개발 중에는 여러 출처에서 테스트해야 할 수 있지만, 운영 환경에서는 허용 출처를 엄격하게 제한해야 한다. 환경 변수를 활용해 환경별로 다른 CORS 설정을 적용하는 것이 좋다.

```typescript
// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === 'production';

  app.enableCors({
    // 개발: 로컬 프론트엔드 허용 / 운영: 실제 도메인만 허용
    origin: isProduction
      ? 'https://my-blog.com'
      : 'http://localhost:3001',
    credentials: true,
  });

  await app.listen(3000);
}
bootstrap();
```

> **팁:**: 운영 환경에서 `origin: '*'`(전체 허용)은 보안 위협이 될 수 있으므로 피하자. 허용할 도메인 목록을 배열로 명시하거나(`origin: ['https://my-blog.com', 'https://www.my-blog.com']`), 정규식으로 패턴을 지정하는 방법도 있다.

---

## 12. 에러 발생 시 미들웨어 동작

미들웨어 실행 중 에러가 발생했을 때의 처리 방법을 알아두자.

### next(err)로 에러 전달

Express 스타일의 방법으로, `next(err)`에 에러 객체를 전달하면 NestJS의 **Exception Filter**로 제어가 넘어간다.

```typescript
// src/common/middleware/safe-logger.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SafeLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    try {
      // 미들웨어 로직 실행
      console.log(`[LOG] ${req.method} ${req.originalUrl}`);
      next();
    } catch (err) {
      // 에러 발생 시 next(err)로 전달 → Exception Filter가 처리
      next(err);
    }
  }
}
```

### throw로 NestJS 예외 던지기

NestJS에서 권장하는 방법으로, `HttpException` 또는 그 하위 클래스를 `throw`하면 Exception Filter가 자동으로 잡아서 처리한다.

```typescript
// src/common/middleware/auth-check.middleware.ts
import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AuthCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers['authorization'];

    if (!token) {
      // NestJS 예외를 throw → Exception Filter가 401 응답을 자동으로 생성
      throw new UnauthorizedException('인증 토큰이 없습니다.');
    }

    next();
  }
}
```

> **팁:**: `next(err)` 방식과 `throw` 방식 모두 Exception Filter로 전달된다. NestJS 스타일에 맞추려면 `HttpException` 계열의 예외를 `throw`하는 것이 더 권장된다. 두 방식 모두 `next()`를 직접 호출하지 않으므로 요청이 라우트 핸들러로 넘어가지 않는다.

---

## 핵심 정리

| 개념 | 설명 |
|------|------|
| **Middleware** | 라우트 핸들러 전에 실행되는 함수. Express 미들웨어와 동일 |
| **라이프사이클 위치** | 요청 파이프라인에서 가장 먼저 실행됨 (Guard, Pipe보다 앞) |
| **클래스 미들웨어** | [`@Injectable()`](../references/decorators.md#injectableoptions) + `NestMiddleware` 구현. DI 가능 |
| **함수형 미들웨어** | 단순 함수. DI 불가. 단순 로직에 권장 |
| **적용 방법** | `NestModule`의 `configure()` 메서드에서 `consumer.apply().forRoutes()` |
| **forRoutes()** | 문자열 경로, `{ path, method }` 객체, 컨트롤러 클래스로 지정 가능 |
| **exclude()** | 특정 라우트를 미들웨어 적용에서 제외 |
| **글로벌 적용** | `app.use()` (함수형만) 또는 `forRoutes('*')` (클래스도 가능) |
| **체이닝** | `apply(A, B, C)` 순서로 실행됨 |

> **다음 챕터 예고**: 챕터 5에서는 **Pipe**를 배운다. 클라이언트가 보낸 데이터를 변환하고 유효성을 검사하는 방법을 다룬다. 블로그 API에 `CreatePostDto`, `UpdatePostDto` 등의 DTO를 만들고 `ValidationPipe`으로 입력값을 검증할 것이다.


```

> **팁:** 미들웨어에서 발생한 에러는 NestJS의 Exception Filter가 처리합니다 (챕터 8 참고).
---

## 다음 챕터 예고

챕터 5에서는 **Pipe**를 학습한다. 클라이언트가 보낸 데이터를 검증하는 DTO와 ValidationPipe를 블로그 API에 적용한다. 잘못된 데이터가 들어오면 자동으로 400 에러가 반환되도록 만든다.

