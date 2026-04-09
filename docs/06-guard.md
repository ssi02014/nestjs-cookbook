# 챕터 6 - Guard

> **이전 챕터 요약**: 챕터 5에서 DTO와 ValidationPipe로 입력값 검증을 추가했다. 잘못된 데이터는 자동으로 거부된다. 이번 챕터에서는 **Guard**를 추가하여 인증 없는 사용자가 게시글을 작성/수정/삭제할 수 없도록 막는다.


## 목차

### 1단계: 개념 학습
1. [Guard란 무엇인가](#1-guard란-무엇인가)
2. [CanActivate 인터페이스](#2-canactivate-인터페이스)
3. [ExecutionContext 활용](#3-executioncontext-활용)
4. [가드 바인딩 레벨](#4-가드-바인딩-레벨)
5. [Reflector와 SetMetadata를 활용한 역할 기반 접근 제어(RBAC)](#5-reflector와-setmetadata를-활용한-역할-기반-접근-제어rbac)

### 2단계: 기본 예제
6. [기본 예제: AuthGuard와 RolesGuard](#6-기본-예제-authguard와-rolesguard)

### 3단계: 블로그 API 적용
7. [블로그 API 적용: 인증과 권한 시스템 구축](#7-블로그-api-적용-인증과-권한-시스템-구축)
8. [여러 Guard 동시 적용 시 실행 순서](#8-여러-guard-동시-적용-시-실행-순서)
9. [비동기 Guard](#9-비동기-guard)
10. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
11. [정리](#정리)
12. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---


## 1. Guard란 무엇인가

Guard(가드)는 NestJS에서 **인증(Authentication)** 과 **인가(Authorization)** 를 담당하는 컴포넌트다. 쉽게 말하면 건물 입구의 **경비원**과 같다. 누군가 들어오려 할 때 "신분증이 있는가?"(인증)를 확인하고, "이 구역에 출입할 권한이 있는가?"(인가)를 판단한다.

### 인증 vs 인가

| 구분 | 인증 (Authentication) | 인가 (Authorization) |
|------|----------------------|---------------------|
| 질문 | "너는 누구인가?" | "너는 이 작업을 할 수 있는가?" |
| 예시 | 토큰 검증, 로그인 확인 | 관리자만 접근 가능한 API |
| 실패 시 | 401 Unauthorized | 403 Forbidden |

### Guard의 핵심 특징

- [`@Injectable()`](references/decorators.md#injectableoptions) 데코레이터가 붙은 클래스로, `CanActivate` 인터페이스를 구현한다.
- 요청이 컨트롤러 핸들러에 도달하기 **전에** 실행된다.
- `true`를 반환하면 요청이 계속 진행되고, `false`를 반환하면 `ForbiddenException`(403)이 자동 발생한다.
- 커스텀 예외를 던지고 싶다면 `UnauthorizedException` 등을 직접 throw할 수 있다.

### NestJS 요청 파이프라인에서의 위치

```
[Client] → [Middleware] → [Guard] → [Interceptor(전)] → [Pipe] → [Controller Handler] → [Interceptor(후)] → [Response]
                            ↑
                   인증 & 인가 판단
```

> Guard는 미들웨어 이후, 파이프 이전에 실행된다. 미들웨어와의 결정적 차이점은 Guard가 **ExecutionContext**에 접근할 수 있다는 것이다. 즉, "다음에 어떤 컨트롤러의 어떤 핸들러가 실행될지" 알 수 있다. 이 덕분에 핸들러별로 다른 접근 제어 정책을 적용할 수 있다.

---

## 2. CanActivate 인터페이스

모든 Guard는 `CanActivate` 인터페이스를 구현해야 한다. 이 인터페이스는 단 하나의 메서드 `canActivate()`를 정의한다.

```typescript
// CanActivate 인터페이스 정의 (NestJS 내부)
interface CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
```

반환 타입이 세 가지라는 점에 주목하자.

| 반환 타입 | 설명 |
|-----------|------|
| `boolean` | 동기적으로 즉시 판단 |
| `Promise<boolean>` | 비동기 작업(DB 조회, 외부 API 호출 등) 후 판단 |
| `Observable<boolean>` | RxJS 스트림 기반 판단 |

### 가장 간단한 Guard

```typescript
// src/common/guards/always-true.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class AlwaysTrueGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // 무조건 통과 - 학습용 예제
    console.log('Guard가 실행되었습니다!');
    return true;
  }
}
```

### Guard가 false를 반환하면?

```typescript
// src/common/guards/always-false.guard.ts
import { Injectable, CanActivate } from '@nestjs/common';

@Injectable()
export class AlwaysFalseGuard implements CanActivate {
  canActivate(): boolean {
    return false;
    // NestJS가 자동으로 ForbiddenException(403)을 던진다
  }
}
```

응답 예시:

```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

> Guard에서 `false`를 반환하면 NestJS가 자동으로 `ForbiddenException`을 발생시킨다. 만약 401(Unauthorized)이나 커스텀 메시지를 응답하고 싶다면 `throw new UnauthorizedException('메시지')` 처럼 직접 예외를 던져야 한다.

---

## 3. ExecutionContext 활용

`ExecutionContext`는 `ArgumentsHost`를 확장한 인터페이스로, 현재 실행 중인 요청에 대한 상세 정보를 제공한다.

```typescript
// ExecutionContext 인터페이스 (NestJS 내부)
export interface ExecutionContext extends ArgumentsHost {
  // 현재 핸들러가 속한 컨트롤러 클래스를 반환
  getClass<T = any>(): Type<T>;

  // 현재 실행될 핸들러(메서드)를 반환
  getHandler(): Function;
}
```

### HTTP 요청 정보 접근

```typescript
// ExecutionContext에서 HTTP 요청 정보 꺼내기
const httpContext = context.switchToHttp();
const request = httpContext.getRequest<Request>();   // 요청 객체
const response = httpContext.getResponse<Response>(); // 응답 객체
```

### 핸들러/컨트롤러 정보 접근

```typescript
// src/common/guards/logging.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class LoggingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const controllerClass = context.getClass();
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();

    console.log(`[Guard] ${controllerClass.name}.${handler.name}`);
    console.log(`[Guard] ${request.method} ${request.url}`);
    // 출력 예: [Guard] PostsController.create
    //         [Guard] POST /posts

    return true;
  }
}
```

> `getClass()`와 `getHandler()`는 이후 배울 **Reflector**와 함께 사용하면 강력해진다. 핸들러에 붙어 있는 메타데이터(예: 필요한 역할 정보)를 가드 안에서 읽어올 수 있기 때문이다.

---

## 4. 가드 바인딩 레벨

Guard는 세 가지 레벨에서 적용할 수 있다. 범위가 좁은 것부터 넓은 순서로 살펴본다.

### 4-1. 메서드 레벨

특정 라우트 핸들러에만 Guard를 적용한다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';

@Controller('posts')
export class PostsController {
  @Get()
  findAll() {
    // Guard 없음 - 누구나 접근 가능
    return '게시글 목록 (공개)';
  }

  @Post()
  @UseGuards(AuthGuard)
  create() {
    // AuthGuard 적용 - 인증된 사용자만 접근 가능
    return '게시글 작성 (인증 필요)';
  }
}
```

### 4-2. 컨트롤러 레벨

해당 컨트롤러의 모든 핸들러에 Guard를 적용한다.

```typescript
// src/admin/admin.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';

@UseGuards(AuthGuard)
@Controller('admin')
export class AdminController {
  @Get('dashboard')
  dashboard() {
    // AuthGuard 적용됨
    return '관리자 대시보드';
  }

  @Get('settings')
  settings() {
    // AuthGuard 적용됨
    return '관리자 설정';
  }
}
```

### 4-3. 글로벌 레벨

애플리케이션 전체에 Guard를 적용한다. 두 가지 방법이 있다.

**방법 1: main.ts에서 설정 (의존성 주입 불가)**

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthGuard } from './common/guards/auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(new AuthGuard());
  await app.listen(3000);
}
bootstrap();
```

> 이 방식은 DI 컨테이너 외부에서 Guard를 생성하므로, Guard 내에서 다른 서비스를 주입받을 수 없다.

**방법 2: APP_GUARD 토큰으로 모듈에 등록 (의존성 주입 가능)**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/guards/auth.guard';

@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule {}
```

> `APP_GUARD` 토큰을 사용하면 DI 컨테이너를 통해 Guard가 등록되므로, Guard 내에서 `Reflector`나 다른 서비스를 주입받을 수 있다. **실전에서는 이 방법을 권장한다.**

### 여러 Guard 동시 적용

```typescript
// 여러 가드를 순서대로 적용
@UseGuards(AuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  // 1. AuthGuard 실행 → 통과하면
  // 2. RolesGuard 실행 → 통과하면
  // 3. 핸들러 실행
}
```

Guard는 배열 순서대로 실행되며, 하나라도 `false`를 반환하거나 예외를 던지면 요청이 거부된다.

---

## 5. Reflector와 SetMetadata를 활용한 역할 기반 접근 제어(RBAC)

Guard의 진정한 힘은 **Reflector**와 **SetMetadata**를 결합했을 때 발휘된다. 이를 통해 "이 핸들러는 admin만 접근 가능" 같은 역할 기반 접근 제어(RBAC)를 깔끔하게 구현할 수 있다.

### SetMetadata란?

`SetMetadata`는 라우트 핸들러나 컨트롤러에 **커스텀 메타데이터를 첨부**하는 데코레이터다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Delete, SetMetadata } from '@nestjs/common';

@Controller('posts')
export class PostsController {
  @Delete(':id')
  @SetMetadata('roles', ['admin'])  // 이 핸들러에 'roles' 메타데이터 첨부
  remove() {
    return '게시글 삭제 (관리자 전용)';
  }
}
```

### Reflector란?

`Reflector`는 NestJS가 제공하는 헬퍼 클래스로, Guard 안에서 핸들러에 첨부된 메타데이터를 **읽어오는** 역할을 한다.

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러에 설정된 'roles' 메타데이터를 가져옴
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true; // 역할 제한 없음
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}
```

### Reflector의 메타데이터 조회 메서드

Reflector에는 상황에 따라 사용할 수 있는 세 가지 조회 메서드가 있다.

```typescript
// 1. get() - 특정 대상(핸들러 또는 클래스)의 메타데이터만 조회
const handlerRoles = this.reflector.get<string[]>('roles', context.getHandler());
const classRoles = this.reflector.get<string[]>('roles', context.getClass());

// 2. getAllAndMerge() - 핸들러 + 클래스의 메타데이터를 합침 (합집합)
const mergedRoles = this.reflector.getAllAndMerge<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
// 예: 클래스에 ['user'], 핸들러에 ['admin'] → ['user', 'admin']

// 3. getAllAndOverride() - 배열 순서대로 탐색, 첫 번째 값 반환 (핸들러 우선)
const roles = this.reflector.getAllAndOverride<string[]>('roles', [
  context.getHandler(),
  context.getClass(),
]);
// 예: 핸들러에 ['admin']이 있으면 ['admin'] 반환, 없으면 클래스 값 사용
```

| 메서드 | 동작 | 사용 시점 |
|--------|------|-----------|
| `get()` | 특정 대상의 메타데이터만 조회 | 하나의 레벨만 확인할 때 |
| `getAllAndMerge()` | 핸들러와 클래스의 메타데이터를 **합침** | 여러 레벨의 역할을 모두 허용할 때 |
| `getAllAndOverride()` | 첫 번째로 발견된 값 반환 | 핸들러 설정이 클래스 설정을 **덮어씌울** 때 |

### 커스텀 데코레이터로 깔끔하게 만들기

[`@SetMetadata('roles', ['admin'])`](references/decorators.md#setmetadatakey-value)을 매번 쓰는 것은 번거롭고 오타 위험이 있다. 커스텀 데코레이터를 만들면 깔끔해진다.

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

사용:

```typescript
// 이전: @SetMetadata('roles', ['admin'])
// 이후:
@Roles('admin')
```

### Reflector.createDecorator&lt;T&gt;() — 타입 안전한 메타데이터 키 (NestJS v10+)

`SetMetadata`에 문자열 키(`'roles'`)를 사용하면 오타 위험이 있다. NestJS v10부터는 `Reflector.createDecorator<T>()`로 타입 안전한 메타데이터 데코레이터를 만들 수 있다.

```typescript
// src/common/decorators/roles.decorator.ts
import { Reflector } from '@nestjs/core';

// 문자열 키 없이 타입 안전한 데코레이터 생성
export const Roles = Reflector.createDecorator<string[]>();
```

Guard에서 읽을 때 문자열 키 대신 **데코레이터 참조 자체**를 키로 사용한다.

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 문자열 키 대신 Roles 데코레이터 자체를 키로 사용
    const requiredRoles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}
```

두 방식의 비교:

| 방식 | 데코레이터 정의 | Reflector에서 읽기 | 타입 안전성 |
|------|----------------|-------------------|------------|
| `SetMetadata` + 문자열 키 | `SetMetadata('roles', roles)` | `reflector.get('roles', ...)` | 낮음 (오타 위험) |
| `Reflector.createDecorator<T>()` | `Roles = Reflector.createDecorator<string[]>()` | `reflector.get(Roles, ...)` | 높음 (컴파일 시점 검사) |

> **팁:** 새 프로젝트에서는 `Reflector.createDecorator<T>()`를 사용하는 것이 권장된다. 기존 `SetMetadata` 방식도 여전히 동작하므로 레거시 코드와 혼용 가능하다.

---

# 2단계: 기본 예제

---

## 6. 기본 예제: AuthGuard와 RolesGuard

개념을 이해했으니 두 가지 기본 Guard를 직접 만들어 보자.

### 예제 1: 간단한 AuthGuard

헤더에 `Authorization` 토큰이 있는지 확인하는 가장 기본적인 인증 가드다.

```typescript
// src/common/guards/simple-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SimpleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers.authorization;

    if (!token) {
      throw new UnauthorizedException('인증 토큰이 필요합니다.');
    }

    // 실제로는 JWT 검증 등이 필요하지만, 학습용으로 간단히 구현
    if (token !== 'Bearer my-secret-token') {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // 인증 성공 시 요청 객체에 사용자 정보 첨부
    request.user = { id: 1, name: '홍길동', roles: ['user'] };
    return true;
  }
}
```

```typescript
// src/cats/cats.controller.ts
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SimpleAuthGuard } from '../common/guards/simple-auth.guard';

@Controller('cats')
export class CatsController {
  @Get()
  findAll() {
    return '고양이 목록 (누구나 접근 가능)';
  }

  @Post()
  @UseGuards(SimpleAuthGuard)
  create() {
    return '고양이 등록 (인증 필요)';
  }
}
```

### 예제 2: RolesGuard + @Roles() 데코레이터

역할 기반으로 접근을 제어하는 가드다.

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러에 설정된 역할 메타데이터를 가져옴
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @Roles() 데코레이터가 없으면 접근 허용
    if (!requiredRoles) {
      return true;
    }

    // 요청에서 사용자 정보 추출 (AuthGuard에서 request.user에 저장해둔 것)
    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.roles) {
      throw new ForbiddenException('접근 권한이 없습니다.');
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `이 작업을 수행하려면 다음 역할 중 하나가 필요합니다: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

```typescript
// src/cats/cats.controller.ts
import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { SimpleAuthGuard } from '../common/guards/simple-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('cats')
@UseGuards(SimpleAuthGuard, RolesGuard)
export class CatsController {
  @Get()
  @Roles('user', 'admin')
  findAll() {
    return '고양이 목록 (user 또는 admin)';
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id') id: string) {
    return `고양이 ${id} 삭제 (admin만 가능)`;
  }
}
```

> 두 Guard가 순서대로 실행된다. `SimpleAuthGuard`가 먼저 토큰을 검증하고 `request.user`를 세팅하면, 다음으로 `RolesGuard`가 `request.user.roles`를 확인한다. 인증이 실패하면 401, 역할이 부족하면 403이 반환된다.

---

# 3단계: 블로그 API 적용

---

## 7. 블로그 API 적용: 인증과 권한 시스템 구축

이전 챕터까지 구축한 블로그 API에 Guard를 적용하여 인증과 권한 시스템을 추가한다.

**목표:**
- 게시글/댓글 **목록 조회, 상세 조회**는 누구나 접근 가능 (공개)
- 게시글/댓글 **작성, 수정, 삭제**는 인증된 사용자만 가능
- **관리자(admin)** 는 모든 게시글/댓글을 삭제할 수 있음
- 인증 없이 게시글을 작성하려 하면 **403 에러 발생**

> 이 챕터에서는 JWT 토큰 대신 `x-user-id` 헤더를 사용한 간이 인증을 구현한다. 실제 JWT 인증은 챕터 12에서 다룬다. 간이 인증이지만 Guard의 모든 핵심 개념을 동일하게 학습할 수 있다.

### 7-1. 역할(Role) Enum 정의

```typescript
// src/common/enums/role.enum.ts
export enum Role {
  User = 'user',
  Admin = 'admin',
}
```

### 7-2. @Roles() 데코레이터

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

### 7-3. @Public() 데코레이터

글로벌 Guard를 적용하되, 특정 라우트만 인증 없이 접근 가능하게 만드는 데코레이터다.

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

> `@Public()`은 "이 라우트는 경비원에게 출입증을 보여주지 않아도 된다"는 표시라고 생각하면 된다. 글로벌 Guard가 이 메타데이터를 확인해서 인증을 건너뛴다.

### 7-4. 간이 사용자 데이터 (임시 저장소)

JWT 없이 인증을 시뮬레이션하기 위해 메모리에 사용자 데이터를 준비한다.

```typescript
// src/common/data/users.data.ts

// 간이 사용자 데이터 (실제로는 DB에서 조회)
// 챕터 12(Authentication)에서 JWT 기반 인증으로 대체할 예정
export interface SimpleUser {
  id: number;
  name: string;
  role: string;
}

export const USERS: SimpleUser[] = [
  { id: 1, name: '김블로거', role: 'user' },
  { id: 2, name: '이작가', role: 'user' },
  { id: 3, name: '관리자', role: 'admin' },
];
```

### 7-5. SimpleAuthGuard 구현

`x-user-id` 헤더를 읽어 사용자를 식별하는 간이 인증 가드다.

```typescript
// src/common/guards/simple-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { USERS } from '../data/users.data';

@Injectable()
export class SimpleAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. @Public() 데코레이터가 있으면 인증을 건너뜀
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. x-user-id 헤더에서 사용자 ID 추출
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new ForbiddenException(
        '인증이 필요합니다. x-user-id 헤더를 포함해주세요.',
      );
    }

    // 3. 사용자 ID로 사용자 조회
    const user = USERS.find((u) => u.id === Number(userId));

    if (!user) {
      throw new ForbiddenException(
        `사용자를 찾을 수 없습니다. (id: ${userId})`,
      );
    }

    // 4. 요청 객체에 사용자 정보 첨부 (이후 핸들러나 RolesGuard에서 사용)
    request.user = user;

    return true;
  }
}
```

> **Guard 실행 흐름 한눈에 보기:**
> 1. `@Public()`이 붙어 있으면 바로 통과
> 2. `x-user-id` 헤더 확인 → 없으면 403
> 3. 해당 ID의 사용자 조회 → 없으면 403
> 4. `request.user`에 사용자 정보 저장 → 통과

### 7-6. RolesGuard 구현

`@Roles()` 데코레이터에 지정된 역할과 사용자의 역할을 비교하는 가드다.

```typescript
// src/common/guards/roles.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. 핸들러 또는 클래스에 설정된 역할 메타데이터 조회
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. @Roles() 데코레이터가 없으면 역할 제한 없음 → 통과
    if (!requiredRoles) {
      return true;
    }

    // 3. SimpleAuthGuard에서 저장한 사용자 정보 가져오기
    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('사용자 정보가 없습니다.');
    }

    // 4. 사용자의 역할이 필요한 역할 목록에 포함되는지 확인
    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      throw new ForbiddenException(
        `이 작업을 수행하려면 다음 역할 중 하나가 필요합니다: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

> `SimpleAuthGuard`가 먼저 실행되어 `request.user`를 세팅하고, 그 다음 `RolesGuard`가 실행되어 역할을 확인한다. **Guard의 실행 순서가 중요하다.** 반드시 인증(Auth) 가드가 인가(Roles) 가드보다 먼저 실행되어야 한다.

### 7-7. 글로벌 Guard 등록 (AppModule)

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { SimpleAuthGuard } from './common/guards/simple-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [CommonModule, PostsModule, CommentsModule],
  providers: [
    // 글로벌 가드 등록 (순서대로 실행됨)
    // 1단계: 인증 - "누구인가?"
    {
      provide: APP_GUARD,
      useClass: SimpleAuthGuard,
    },
    // 2단계: 인가 - "권한이 있는가?"
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
```

> `APP_GUARD`를 사용하면 모든 라우트에 가드가 자동 적용된다. `@Public()`을 붙인 라우트만 인증을 건너뛴다. 이 방식이 실전에서 가장 많이 사용되는 패턴이다.

### 7-8. PostsController에 Guard 적용

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // --- 공개 라우트 (인증 불필요) ---

  @Public()
  @Get()
  findAll() {
    // 누구나 게시글 목록을 볼 수 있음
    return this.postsService.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    // 누구나 게시글 상세를 볼 수 있음
    return this.postsService.findOne(id);
  }

  // --- 인증 필요 라우트 ---

  @Post()
  create(@Body() createPostDto: CreatePostDto, @Req() req: any) {
    // SimpleAuthGuard가 인증을 확인하고 request.user를 세팅함
    // @Public()이 없으므로 인증 필수
    const userId = req.user.id;
    return this.postsService.create(createPostDto, userId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @Req() req: any,
  ) {
    // 인증된 사용자만 수정 가능
    const userId = req.user.id;
    return this.postsService.update(id, updatePostDto, userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    // 인증된 사용자만 삭제 가능
    const userId = req.user.id;
    return this.postsService.remove(id, userId);
  }

  // --- 관리자 전용 라우트 ---

  @Delete(':id/force')
  @Roles(Role.Admin)
  forceRemove(@Param('id', ParseIntPipe) id: number) {
    // 관리자만 강제 삭제 가능
    return this.postsService.forceRemove(id);
  }
}
```

### 7-9. CommentsController에 Guard 적용

```typescript
// src/comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // --- 공개 라우트 ---

  @Public()
  @Get()
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    // 누구나 댓글 목록을 볼 수 있음
    return this.commentsService.findAll(postId);
  }

  // --- 인증 필요 라우트 ---

  @Post()
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: any,
  ) {
    // 인증된 사용자만 댓글 작성 가능
    const userId = req.user.id;
    return this.commentsService.create(postId, createCommentDto, userId);
  }

  @Delete(':id')
  remove(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    // 인증된 사용자만 자신의 댓글 삭제 가능
    const userId = req.user.id;
    return this.commentsService.remove(postId, id, userId);
  }

  // --- 관리자 전용 라우트 ---

  @Delete(':id/force')
  @Roles(Role.Admin)
  forceRemove(
    @Param('postId', ParseIntPipe) postId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // 관리자만 어떤 댓글이든 강제 삭제 가능
    return this.commentsService.forceRemove(postId, id);
  }
}
```

### 7-10. API 테스트 시나리오

Guard가 올바르게 동작하는지 확인해보자.

**시나리오 1: 인증 없이 게시글 목록 조회 (성공)**

```bash
# @Public()이 붙어 있으므로 인증 없이 접근 가능
curl http://localhost:3000/posts

# 응답 200
[
  { "id": 1, "title": "첫 번째 게시글", "authorId": 1 },
  { "id": 2, "title": "두 번째 게시글", "authorId": 2 }
]
```

**시나리오 2: 인증 없이 게시글 작성 (실패 - 403)**

```bash
# x-user-id 헤더 없이 POST 요청
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "새 게시글", "content": "내용"}'

# 응답 403
{
  "statusCode": 403,
  "message": "인증이 필요합니다. x-user-id 헤더를 포함해주세요.",
  "error": "Forbidden"
}
```

**시나리오 3: 인증 후 게시글 작성 (성공)**

```bash
# x-user-id 헤더에 사용자 ID를 포함
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "x-user-id: 1" \
  -d '{"title": "새 게시글", "content": "내용"}'

# 응답 201
{
  "id": 3,
  "title": "새 게시글",
  "content": "내용",
  "authorId": 1
}
```

**시나리오 4: 일반 사용자가 강제 삭제 시도 (실패 - 403)**

```bash
# 사용자 1은 role이 'user'이므로 @Roles(Role.Admin) 라우트에 접근 불가
curl -X DELETE http://localhost:3000/posts/1/force \
  -H "x-user-id: 1"

# 응답 403
{
  "statusCode": 403,
  "message": "이 작업을 수행하려면 다음 역할 중 하나가 필요합니다: admin",
  "error": "Forbidden"
}
```

**시나리오 5: 관리자가 강제 삭제 (성공)**

```bash
# 사용자 3은 role이 'admin'
curl -X DELETE http://localhost:3000/posts/1/force \
  -H "x-user-id: 3"

# 응답 200
{
  "message": "게시글 1이 관리자에 의해 삭제되었습니다."
}
```

### 7-11. 전체 흐름 정리

```
1. 클라이언트가 요청을 보냄
   → 헤더: x-user-id: 1

2. SimpleAuthGuard 실행
   → @Public() 확인 → 있으면 바로 통과
   → x-user-id 헤더 확인 → 없으면 403
   → 사용자 조회 → 없으면 403
   → request.user에 사용자 정보 저장 → 통과

3. RolesGuard 실행
   → @Roles() 확인 → 없으면 바로 통과
   → request.user.role이 필요한 역할에 포함되는지 확인
   → 포함되지 않으면 403
   → 포함되면 통과

4. Pipe 실행 (유효성 검사)

5. Controller Handler 실행
```

## 8. 여러 Guard 동시 적용 시 실행 순서

[`@UseGuards()`](references/decorators.md#useguardsguards)에 여러 Guard를 전달하면 **왼쪽에서 오른쪽** 순서로 순차 실행된다.

```typescript
// src/posts/posts.controller.ts
@UseGuards(JwtAuthGuard, RolesGuard) // JwtAuthGuard 먼저, 그 다음 RolesGuard
@Get('admin')
findAll() { ... }
```

### 실행 흐름

```
Request
   │
   ▼
JwtAuthGuard.canActivate()   ← 1번째 실행
   │ true 반환
   ▼
RolesGuard.canActivate()     ← 2번째 실행
   │ true 반환
   ▼
Controller Handler 실행
```

> **중요:** 앞의 Guard가 `false`를 반환하거나 예외를 throw하면 **뒤의 Guard는 실행되지 않는다.** 따라서 인증(AuthGuard)을 인가(RolesGuard)보다 항상 앞에 배치해야 한다. 인증되지 않은 사용자는 역할 검사까지 갈 필요가 없기 때문이다.

### 글로벌 Guard와 로컬 Guard 순서

```
APP_GUARD (글로벌) → @UseGuards() (컨트롤러/메서드 레벨) 순서로 실행
```

```typescript
// 글로벌로 JwtAuthGuard 등록
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]

// 컨트롤러에서 추가로 RolesGuard 적용
@UseGuards(RolesGuard) // 글로벌 JwtAuthGuard 이후에 실행
@Controller('posts')
export class PostsController { ... }
```

---

## 9. 비동기 Guard

Guard는 `async/await`를 지원한다. DB를 조회하거나 외부 서비스를 호출하는 경우 유용하다.

```typescript
// src/common/guards/db-permission.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class DbPermissionGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) return false;

    // DB에서 유저의 최신 권한을 조회
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'role', 'isActive'],
    });

    if (!user || !user.isActive) return false;

    // request에 최신 유저 정보 저장
    request.user = user;
    return true;
  }
}
```

> **언제 쓰는가?** JWT 토큰에는 발급 당시의 역할(role)이 저장된다. 만약 관리자가 특정 유저의 권한을 박탈했어도 토큰이 만료되기 전까지는 그 권한으로 요청할 수 있다. DB를 직접 조회하는 Guard를 사용하면 이런 문제를 방지할 수 있다. 단, 매 요청마다 DB 쿼리가 발생하므로 성능에 주의하자.

---

## 프로젝트 구조

```
src/
├── app.module.ts                    ← APP_GUARD 등록
├── common/
│   ├── common.module.ts
│   ├── common.service.ts
│   ├── middleware/
│   ├── dto/
│   ├── data/
│   │   └── users.data.ts            ← [이번 챕터 추가]
│   ├── enums/
│   │   └── role.enum.ts             ← [이번 챕터 추가]
│   ├── decorators/
│   │   ├── public.decorator.ts      ← [이번 챕터 추가]
│   │   └── roles.decorator.ts       ← [이번 챕터 추가]
│   └── guards/
│       ├── simple-auth.guard.ts     ← [이번 챕터 추가]
│       └── roles.guard.ts           ← [이번 챕터 추가]
├── users/
├── posts/
└── comments/
```

---

## 정리

| 개념 | 핵심 포인트 |
|------|------------|
| Guard의 역할 | 컨트롤러 실행 전에 **인증/인가**를 판단하는 경비원 |
| `CanActivate` | Guard가 구현해야 하는 인터페이스, `canActivate()` 메서드 하나 |
| `ExecutionContext` | 현재 요청의 컨트롤러, 핸들러 정보에 접근 가능한 컨텍스트 |
| [`@UseGuards()`](references/decorators.md#useguardsguards) | Guard를 메서드/컨트롤러에 바인딩하는 데코레이터 |
| `APP_GUARD` | 글로벌 가드를 DI와 함께 등록하는 토큰 (실전 권장) |
| [`@SetMetadata()`](references/decorators.md#setmetadatakey-value) | 핸들러에 커스텀 메타데이터를 첨부하는 데코레이터 |
| `Reflector` | Guard 내에서 메타데이터를 읽어오는 헬퍼 클래스 |
| `Reflector.createDecorator<T>()` | 타입 안전한 메타데이터 데코레이터 생성 (NestJS v10+, `SetMetadata` 대체) |
| `@Public()` | 글로벌 Guard 하에서 특정 라우트를 공개로 표시 |
| `@Roles()` | 핸들러에 필요한 역할을 지정하는 커스텀 데코레이터 |
| Guard 반환값 | `true` → 통과, `false` → 자동 `ForbiddenException`(403) |
| 실행 순서 | Middleware → **Guard** → Interceptor → Pipe → Handler |
---

## 다음 챕터 예고

챕터 7에서는 **Interceptor**를 학습한다. 모든 API 응답을 `{ success, data, timestamp }` 형태로 통일하는 TransformInterceptor를 만들어 글로벌로 적용한다.

