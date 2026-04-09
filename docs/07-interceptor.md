# 챕터 7 - Interceptor (인터셉터)

> **이전 챕터 요약**: 챕터 6에서 SimpleAuthGuard로 게시글/댓글 작성·수정·삭제에 인증을 적용했다. 이번 챕터에서는 **Interceptor**를 학습하여 모든 API 응답을 일관된 형태로 변환한다.


## 목차

### 1단계: 개념 학습
1. [Interceptor란 무엇인가](#1-interceptor란-무엇인가)
2. [NestInterceptor 인터페이스와 intercept 메서드](#2-nestinterceptor-인터페이스와-intercept-메서드)
3. [CallHandler와 RxJS Observable](#3-callhandler와-rxjs-observable)
4. [인터셉터 바인딩 레벨](#4-인터셉터-바인딩-레벨)

### 2단계: 기본 예제
5. [주요 활용 패턴](#5-주요-활용-패턴)
   - [5-1. LoggingInterceptor (실행 시간 측정)](#5-1-logginginterceptor-실행-시간-측정)
   - [5-2. TransformInterceptor (응답 래핑)](#5-2-transforminterceptor-응답-래핑)
   - [5-3. TimeoutInterceptor (타임아웃 처리)](#5-3-timeoutinterceptor-타임아웃-처리)
   - [5-4. ExceptionMappingInterceptor (예외 매핑)](#5-4-exceptionmappinginterceptor-예외-매핑)
   - [5-5. CacheInterceptor (Stream Overriding)](#5-5-cacheinterceptor-stream-overriding--nexthandle-미호출)

### 3단계: 블로그 API 적용
6. [블로그 API에 적용하기](#6-블로그-api에-적용하기)
7. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
8. [정리](#정리)
9. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---


## 1. Interceptor란 무엇인가

이전 챕터까지 블로그 API에 Guard(인증/인가)와 Pipe(유효성 검사)를 적용했다. 이제 한 가지 불편한 점이 있다. API마다 응답 형태가 제각각이라는 것이다.

```json
// GET /posts → 배열이 바로 온다
[{ "id": 1, "title": "첫 번째 글" }, ...]

// GET /posts/1 → 객체가 바로 온다
{ "id": 1, "title": "첫 번째 글", "content": "..." }

// POST /posts → 또 다른 형태
{ "id": 2, "title": "새 글" }
```

프론트엔드 개발자 입장에서는 매번 응답 형태를 확인해야 하니 불편하다. **모든 응답을 `{ success: true, data: ..., timestamp: ... }` 형태로 통일**할 수 있다면 얼마나 좋을까?

바로 이런 일을 하는 것이 **Interceptor(인터셉터)** 다.

### Interceptor는 "요청 전/후에 끼워넣는 도구"다

Interceptor는 **AOP(Aspect-Oriented Programming, 관점 지향 프로그래밍)** 에서 영감을 받은 개념이다. AOP라고 하면 어렵게 들리지만, 핵심은 간단하다.

> 비즈니스 로직(게시글 CRUD)과 직접 관련 없는 **공통 관심사**(로깅, 응답 변환, 캐싱 등)를 분리해서 관리하자!

쉽게 비유하면, 인터셉터는 **고속도로 톨게이트** 같은 것이다. 차(요청)가 들어올 때 한 번, 나갈 때 한 번 처리한다. 톨게이트가 차의 목적지를 바꾸지는 않지만, 통행료를 징수하거나(로깅), 영수증을 붙여주거나(응답 래핑), 너무 오래 걸리면 차단하는(타임아웃) 일을 할 수 있다.

### NestJS 요청 라이프사이클에서의 위치

```
Client Request
    → Middleware          (챕터 4에서 학습)
    → Guard               (챕터 6에서 학습)
    → Interceptor (전)    ← 지금 배우는 것!
    → Pipe                (챕터 5에서 학습)
    → Route Handler       (컨트롤러 메서드 실행)
    → Interceptor (후)    ← 지금 배우는 것!
    → Exception Filter    (챕터 8에서 학습)
    → Client Response
```

Guard 이후, Route Handler **전후** 양쪽에서 실행된다는 점이 핵심이다. 미들웨어는 요청 시점에만 개입하지만, 인터셉터는 **응답까지 가로챌 수 있다**.

### 인터셉터가 할 수 있는 일

| 활용 | 설명 | 예시 |
|------|------|------|
| 응답 매핑 | 핸들러가 반환한 값을 변환 | `data` → `{ success: true, data }` |
| 로깅 | 요청/응답 정보와 처리 시간 기록 | `GET /posts - 12ms` |
| 캐싱 | 이전 결과를 저장해두고 재사용 | 동일 요청 시 DB 조회 생략 |
| 타임아웃 | 응답이 너무 오래 걸리면 에러 | 5초 초과 시 408 에러 |
| 예외 매핑 | 특정 에러를 다른 에러로 변환 | DB 에러 → 502 Bad Gateway |

---

## 2. NestInterceptor 인터페이스와 intercept 메서드

모든 인터셉터는 [`@Injectable()`](references/decorators.md#injectableoptions) 데코레이터가 붙은 클래스이며, `NestInterceptor` 인터페이스를 구현해야 한다.

### 인터페이스 구조

```typescript
// NestInterceptor 인터페이스 (NestJS 내부 정의)
import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

export interface NestInterceptor<T = any, R = any> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<R> | Promise<Observable<R>>;
}
```

### intercept() 메서드의 두 인자

| 인자 | 타입 | 설명 |
|------|------|------|
| `context` | `ExecutionContext` | 현재 요청에 대한 정보를 담고 있다. 챕터 6의 Guard에서 사용한 것과 동일한 객체다. |
| `next` | `CallHandler` | 라우트 핸들러를 호출하기 위한 객체. `handle()` 메서드를 통해 핸들러를 실행한다. |

### NestInterceptor 제네릭 타입 파라미터

`NestInterceptor<T, R>` 인터페이스는 두 개의 타입 파라미터를 받는다.

| 파라미터 | 의미 |
|----------|------|
| `T` | 핸들러가 반환하는 원본 값의 타입 (`next.handle()`의 스트림 타입) |
| `R` | 인터셉터가 최종적으로 반환하는 값의 타입 |

응답을 변환하는 인터셉터를 만들 때 이 두 파라미터를 명시하면 TypeScript의 타입 안전성을 확보할 수 있다.

```typescript
// src/common/interceptors/transform.interceptor.ts (타입 명시 버전)
import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// NestInterceptor<T, ApiResponse<T>>:
//   T = 핸들러 원본 반환 타입, ApiResponse<T> = 최종 응답 타입
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({ success: true, data })),
    );
  }
}
```

> **팁:** 단순 로깅처럼 응답을 변환하지 않는 인터셉터는 `NestInterceptor`(제네릭 없음)로 충분하다. 응답 타입이 바뀌는 경우에만 `<T, R>`을 명시하자.

### 가장 단순한 인터셉터

```typescript
// src/common/interceptors/simple.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class SimpleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('핸들러 실행 전');    // ① 요청이 핸들러에 도달하기 전

    return next.handle().pipe(       // ② 핸들러 실행
      tap(() => {
        console.log('핸들러 실행 후'); // ③ 핸들러가 응답을 반환한 후
      }),
    );
  }
}
```

실행 순서를 정리하면:

```
요청 도착 → ① "핸들러 실행 전" 출력 → ② 컨트롤러 핸들러 실행 → ③ "핸들러 실행 후" 출력 → 응답 반환
```

> **팁:** `next.handle()` 앞에 작성한 코드는 **요청(before)** 시점에, `pipe()` 안에 작성한 코드는 **응답(after)** 시점에 실행된다. 이것이 인터셉터가 "전/후 모두 처리할 수 있다"는 의미다.

---

## 3. CallHandler와 RxJS Observable

### CallHandler가 뭔가요?

`CallHandler`는 `handle()` 메서드 하나만 가진 인터페이스다.

```typescript
// CallHandler 인터페이스 (NestJS 내부 정의)
export interface CallHandler<T = any> {
  handle(): Observable<T>;
}
```

핵심 포인트 두 가지:

1. **`next.handle()`을 호출하지 않으면** 라우트 핸들러는 **절대 실행되지 않는다**. 캐싱 인터셉터는 이 특성을 활용한다.
2. **`handle()`은 RxJS Observable을 반환**한다. 이 Observable을 통해 응답 값을 자유롭게 조작할 수 있다.

### RxJS를 모르면 어쩌죠?

걱정할 필요 없다. 인터셉터에서 자주 쓰는 RxJS 연산자는 딱 4~5개뿐이다.

| 연산자 | 역할 | 쉬운 비유 |
|--------|------|----------|
| `tap` | 값을 변경하지 않고 부수 효과만 실행 | "지나가는 차를 구경만 한다" (로깅) |
| `map` | 값을 변환해서 반환 | "지나가는 차에 스티커를 붙인다" (응답 래핑) |
| `catchError` | 에러를 잡아서 처리 | "사고난 차를 견인한다" (예외 매핑) |
| `timeout` | 시간 초과 시 에러 발생 | "너무 느린 차는 퇴장" (타임아웃) |
| `of` | 즉시 값을 방출하는 Observable 생성 | "미리 준비한 차를 보낸다" (캐싱) |

```typescript
// 연산자 import 방법
import { tap, map, catchError, timeout } from 'rxjs/operators';
import { of, throwError, TimeoutError } from 'rxjs';
```

---

## 4. 인터셉터 바인딩 레벨

Guard와 마찬가지로, 인터셉터도 세 가지 레벨에서 바인딩할 수 있다.

### 4-1. 메서드 레벨

특정 라우트 핸들러에만 인터셉터를 적용한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('posts')
export class PostsController {
  @Get()
  @UseInterceptors(LoggingInterceptor) // 이 핸들러에만 적용
  findAll() {
    return [];
  }
}
```

### 4-2. 컨트롤러 레벨

해당 컨트롤러의 모든 라우트 핸들러에 적용한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@UseInterceptors(LoggingInterceptor) // 모든 핸들러에 적용
@Controller('posts')
export class PostsController {
  @Get()
  findAll() {
    return [];
  }

  @Get(':id')
  findOne() {
    return {};
  }
}
```

### 4-3. 글로벌 레벨

애플리케이션의 모든 라우트 핸들러에 적용한다.

**방법 1: main.ts에서 직접 등록**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(3000);
}
bootstrap();
```

> **주의:** 이 방식은 DI 컨테이너 외부에서 인스턴스를 직접 생성(`new`)하므로, 인터셉터 내부에서 다른 서비스를 주입받을 수 없다.

**방법 2: 모듈에서 APP_INTERCEPTOR 토큰으로 등록 (권장)**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
```

> **팁:** `APP_INTERCEPTOR` 토큰 방식을 사용하면 DI 컨테이너가 인터셉터를 관리하므로, 생성자에서 다른 서비스를 주입받을 수 있다. 실무에서는 이 방식을 권장한다.

---

# 2단계: 기본 예제

---

## 5. 주요 활용 패턴

### 5-1. LoggingInterceptor (실행 시간 측정)

가장 기본적이면서 실무에서 가장 많이 쓰이는 패턴이다. 어떤 요청이 왔고, 처리하는 데 얼마나 걸렸는지 기록한다.

```typescript
// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    // ① 요청 시점: 어떤 요청이 들어왔는지 기록
    this.logger.log(`[Request] ${method} ${url}`);

    return next.handle().pipe(
      // ② 응답 시점: 처리 시간을 기록
      tap(() => {
        const elapsed = Date.now() - now;
        this.logger.log(`[Response] ${method} ${url} - ${elapsed}ms`);
      }),
    );
  }
}
```

출력 예시:

```
[LoggingInterceptor] [Request] GET /posts
[LoggingInterceptor] [Response] GET /posts - 12ms
```

**코드 해설:**

- `Date.now()`를 요청 시점에 저장하고, 응답 시점에 차이를 계산하면 처리 시간이 된다.
- `tap` 연산자는 값을 변경하지 않고 "구경만" 하므로, 원래 응답에 영향을 주지 않는다.

### 5-2. TransformInterceptor (응답 래핑)

모든 API 응답을 통일된 형식으로 감싸는 패턴이다.

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

적용 전후 비교:

```json
// 적용 전: 핸들러가 반환하는 원본 데이터
{ "id": 1, "title": "첫 번째 글", "content": "안녕하세요" }

// 적용 후: 통일된 형태로 래핑
{
  "success": true,
  "data": { "id": 1, "title": "첫 번째 글", "content": "안녕하세요" },
  "timestamp": "2026-04-09T09:30:00.000Z"
}
```

**코드 해설:**

- `map` 연산자는 `tap`과 달리 **값을 바꿔서 반환**한다. 핸들러가 반환한 `data`를 `{ success, data, timestamp }` 객체로 감싼다.
- 제네릭 `<T>`를 사용하면 어떤 타입의 데이터든 래핑할 수 있다.

### 5-3. TimeoutInterceptor (타임아웃 처리)

외부 API 호출이나 복잡한 쿼리로 인해 응답이 너무 오래 걸리는 상황을 방지한다.

```typescript
// src/common/interceptors/timeout.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000), // 5초 안에 응답이 없으면...
      catchError((err) => {
        if (err instanceof TimeoutError) {
          // ...타임아웃 에러로 변환
          return throwError(() => new RequestTimeoutException());
        }
        return throwError(() => err);
      }),
    );
  }
}
```

**코드 해설:**

- `timeout(5000)`은 5초 안에 Observable이 완료되지 않으면 `TimeoutError`를 발생시킨다.
- `catchError`로 `TimeoutError`를 잡아서 NestJS의 `RequestTimeoutException`(408)으로 변환한다.
- 타임아웃이 아닌 다른 에러는 그대로 다시 throw한다.

### 5-4. ExceptionMappingInterceptor (예외 매핑)

특정 예외를 다른 예외로 변환하는 패턴이다. 예를 들어, 데이터베이스 레이어에서 발생한 저수준 에러를 클라이언트에 적합한 HTTP 예외로 바꿀 때 사용한다.

```typescript
// src/common/interceptors/exception-mapping.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadGatewayException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

// 가상의 외부 서비스 에러 클래스
class ExternalServiceError extends Error {}

@Injectable()
export class ExceptionMappingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((err) => {
        if (err instanceof ExternalServiceError) {
          // 외부 서비스 오류 → 502 Bad Gateway로 변환
          return throwError(() => new BadGatewayException('외부 서비스에 일시적인 문제가 발생했습니다.'));
        }
        // 그 외 에러는 그대로 전달
        return throwError(() => err);
      }),
    );
  }
}
```

**코드 해설:**

- `catchError` 연산자는 스트림에서 에러가 발생했을 때 실행된다.
- 에러 타입을 확인해서 특정 에러만 변환하고, 나머지는 `throwError`로 그대로 전달한다.
- 이렇게 하면 컨트롤러나 서비스 코드를 수정하지 않고도 에러 포맷을 일괄 변환할 수 있다.

> **참고:** 예외를 한 곳에서 통합 처리하고 싶다면 챕터 8의 **Exception Filter**가 더 적합하다. 인터셉터의 예외 매핑은 "특정 타입의 에러를 다른 타입으로 바꾸는" 용도에 주로 쓴다.

### 5-5. CacheInterceptor (Stream Overriding — next.handle() 미호출)

지금까지 본 모든 예제는 `next.handle()`을 호출해서 실제 핸들러를 실행했다. 하지만 `next.handle()`을 **호출하지 않고** 직접 Observable을 반환하면 핸들러 자체를 건너뛸 수 있다. 캐시 인터셉터가 대표적인 예다.

```typescript
// src/common/interceptors/cache.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  // 간단한 메모리 캐시 (실무에서는 Redis 등을 사용)
  private readonly cache = new Map<string, unknown>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = request.url;

    // 캐시에 데이터가 있으면 next.handle()을 호출하지 않고 즉시 반환
    if (this.cache.has(cacheKey)) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return of(this.cache.get(cacheKey)); // ← 핸들러를 실행하지 않는다!
    }

    // 캐시가 없으면 핸들러를 실행하고 결과를 캐시에 저장
    console.log(`[Cache MISS] ${cacheKey}`);
    return next.handle().pipe(
      tap((response) => {
        this.cache.set(cacheKey, response);
      }),
    );
  }
}
```

실행 흐름:

```
첫 번째 요청:
  → [Cache MISS] /posts
  → next.handle() 호출 → 컨트롤러 실행 → DB 조회
  → tap()에서 결과를 캐시에 저장
  → 응답 반환

두 번째 요청 (동일 URL):
  → [Cache HIT] /posts
  → of(캐시된 데이터) 즉시 반환 ← 컨트롤러, DB 전혀 실행 안 됨!
```

**코드 해설:**

- `of(값)`은 RxJS의 생성 함수로, 전달받은 값을 즉시 방출하는 Observable을 만든다.
- `next.handle()`을 호출하지 않으면 Guard 이후의 모든 로직(Pipe, Route Handler)이 실행되지 않는다.
- 이 특성은 캐싱 외에도 **특정 조건에서 핸들러를 아예 건너뛰어야 하는 경우**에 활용할 수 있다.

> **주의:** 이 예제는 개념 이해를 위한 단순 구현이다. 실무에서는 캐시 키 설계, TTL(만료 시간), POST/PUT 등 변경 요청 제외 로직이 추가로 필요하다. NestJS는 `@nestjs/cache-manager` 패키지로 더 완성도 높은 캐시 기능을 제공한다.

---

# 3단계: 블로그 API 적용

---

## 6. 블로그 API에 적용하기

지금까지 배운 인터셉터를 블로그 API에 실제로 적용해보자. 이 챕터를 마치면 **모든 API 응답이 일관된 포맷**으로 반환된다.

### 6-1. TransformInterceptor 만들기

모든 응답을 `{ success: true, data: ..., timestamp: ... }` 형태로 통일한다.

```typescript
// src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
```

### 6-2. LoggingInterceptor 만들기

모든 요청의 메서드, URL, 컨트롤러명, 핸들러명, 처리 시간을 기록한다.

```typescript
// src/common/interceptors/logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;

    // 어떤 컨트롤러의 어떤 메서드가 호출되는지도 알 수 있다
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;

    this.logger.log(`[Request] ${method} ${url} → ${className}.${handlerName}()`);

    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          // 성공 응답
          const response = context.switchToHttp().getResponse();
          const elapsed = Date.now() - now;
          this.logger.log(
            `[Response] ${method} ${url} - ${response.statusCode} - ${elapsed}ms`,
          );
        },
        error: (error) => {
          // 에러 응답
          const elapsed = Date.now() - now;
          this.logger.error(
            `[Error] ${method} ${url} - ${error.status || 500} - ${elapsed}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
```

> **팁:** `tap`에 객체 형태(`{ next, error }`)를 전달하면 성공과 에러를 각각 처리할 수 있다. 에러 로그도 함께 남기면 디버깅할 때 매우 유용하다.

### 6-3. 글로벌 적용하기

두 인터셉터를 `APP_INTERCEPTOR` 토큰으로 글로벌 등록한다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [CommonModule, PostsModule, UsersModule, CommentsModule],
  providers: [
    // 순서: LoggingInterceptor → TransformInterceptor
    // Logging이 먼저 등록되므로, 요청 시점에는 Logging이 먼저,
    // 응답 시점에는 Transform이 먼저 실행된다.
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
```

> **팁:** 글로벌 인터셉터가 여러 개일 때 실행 순서가 중요하다. `providers` 배열에서 **먼저 등록된 인터셉터가 바깥쪽**에서 감싼다. 즉, `LoggingInterceptor`가 `TransformInterceptor`를 감싸므로, 로깅에는 래핑된 최종 응답이 아니라 전체 흐름이 기록된다.

### 6-4. curl로 동작 확인

서버를 실행하고 실제로 확인해보자.

```bash
# 서버 실행
npm run start:dev
```

**게시글 목록 조회:**

```bash
curl -s http://localhost:3000/posts | jq
```

이전 챕터까지의 응답:

```json
[
  { "id": 1, "title": "첫 번째 글", "content": "안녕하세요" },
  { "id": 2, "title": "두 번째 글", "content": "반갑습니다" }
]
```

**이제는 이렇게 바뀐다:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "title": "첫 번째 글", "content": "안녕하세요" },
    { "id": 2, "title": "두 번째 글", "content": "반갑습니다" }
  ],
  "timestamp": "2026-04-09T09:30:00.000Z"
}
```

**게시글 단건 조회:**

```bash
curl -s http://localhost:3000/posts/1 | jq
```

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "첫 번째 글",
    "content": "안녕하세요"
  },
  "timestamp": "2026-04-09T09:30:15.000Z"
}
```

**게시글 생성:**

```bash
curl -s -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{"title": "새 글", "content": "인터셉터 적용 완료!"}' | jq
```

```json
{
  "success": true,
  "data": {
    "id": 3,
    "title": "새 글",
    "content": "인터셉터 적용 완료!"
  },
  "timestamp": "2026-04-09T09:31:00.000Z"
}
```

**서버 콘솔 로그:**

```
[HTTP] [Request] GET /posts → PostsController.findAll()
[HTTP] [Response] GET /posts - 200 - 3ms
[HTTP] [Request] GET /posts/1 → PostsController.findOne()
[HTTP] [Response] GET /posts/1 - 200 - 1ms
[HTTP] [Request] POST /posts → PostsController.create()
[HTTP] [Response] POST /posts - 201 - 5ms
```

모든 엔드포인트의 응답이 동일한 형태로 통일되었고, 서버 콘솔에는 요청/응답 로그가 자동으로 기록된다.

### 6-5. 컨트롤러 코드는 변경할 필요 없다!

인터셉터의 가장 큰 장점은 **컨트롤러 코드를 전혀 수정하지 않아도 된다**는 것이다. 기존 컨트롤러는 그대로 둔다.

```typescript
// src/posts/posts.controller.ts
// 아무것도 바꿀 필요 없다! 인터셉터가 알아서 응답을 래핑한다.
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.postsService.findAll(query);
    // 원래: [{ id: 1, title: "..." }, ...]
    // TransformInterceptor 적용 후: { success: true, data: [...], timestamp: "..." }
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
    // 원래: { id: 1, title: "..." }
    // TransformInterceptor 적용 후: { success: true, data: { id: 1, ... }, timestamp: "..." }
  }

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }
}
```

컨트롤러가 반환하는 값이 무엇이든, `TransformInterceptor`가 자동으로 `{ success, data, timestamp }` 형태로 감싸준다.

---

## 프로젝트 구조

```
src/
├── app.module.ts                    ← APP_INTERCEPTOR 등록
├── common/
│   ├── common.module.ts
│   ├── common.service.ts
│   ├── middleware/
│   ├── dto/
│   ├── data/
│   ├── enums/
│   ├── decorators/
│   ├── guards/
│   └── interceptors/
│       ├── transform.interceptor.ts ← [이번 챕터 추가]
│       └── logging.interceptor.ts   ← [이번 챕터 추가]
├── users/
├── posts/
└── comments/
```

---

## 정리

| 항목 | 설명 |
|------|------|
| **인터페이스** | `NestInterceptor<T, R>` 구현, `intercept()` 메서드 정의 |
| **핵심 메커니즘** | `CallHandler.handle()`이 반환하는 RxJS Observable을 통해 응답 스트림 제어 |
| **실행 시점** | 라우트 핸들러 실행 **전후** (Guard 이후, Exception Filter 이전) |
| **바인딩** | [`@UseInterceptors()`](references/decorators.md#useinterceptorsinterceptors) (메서드/컨트롤러), `APP_INTERCEPTOR` (글로벌) |
| **주요 연산자** | `map` (응답 변환), `tap` (로깅), `catchError` (예외 매핑), `timeout` (시간 제한), `of` (스트림 오버라이딩) |
| **Stream Overriding** | `next.handle()` 미호출 + `of(값)` 반환으로 핸들러를 완전히 건너뜀 (캐시 패턴) |
| **제네릭 타입** | `NestInterceptor<T, R>`: T = 원본 타입, R = 변환 후 타입 |

### 이번 챕터에서 블로그 API에 추가된 것

| 추가 항목 | 내용 |
|-----------|------|
| `TransformInterceptor` | 모든 응답을 `{ success, data, timestamp }` 형태로 통일 |
| `LoggingInterceptor` | 모든 요청의 메서드, URL, 처리 시간을 자동 로깅 |
| 글로벌 등록 | `APP_INTERCEPTOR` 토큰으로 전체 적용 |

> **다음 챕터 예고**: 지금은 성공 응답만 `{ success: true, data, timestamp }` 형태로 통일했다. 그런데 에러가 발생하면? `{ statusCode: 404, message: "Not Found" }` 같은 NestJS 기본 형태가 반환된다. 챕터 8에서는 **Exception Filter**를 사용해서 에러 응답도 `{ success: false, error: ..., timestamp: ... }` 형태로 통일할 것이다.
---

## 다음 챕터 예고

챕터 8에서는 **Exception Filter**를 학습한다. 성공 응답(챕터 7)과 짝이 되는 에러 응답 포맷을 통일한다. 이 두 챕터를 합치면 블로그 API의 모든 응답이 일관된 구조를 갖게 된다.

