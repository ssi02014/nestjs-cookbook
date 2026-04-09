# 챕터 9 - Custom Decorator (커스텀 데코레이터)

> **이전 챕터 요약**: 챕터 8에서 HttpExceptionFilter로 에러 응답을 `{ success: false, error: { ... } }` 형태로 통일했다. 이번 챕터에서는 **Custom Decorator**를 만들어 코드를 더 간결하게 리팩토링한다. Phase 1~3의 마지막 챕터다.


## 목차

### 1단계: 개념 학습
1. [데코레이터란?](#데코레이터란)
2. [NestJS에서 데코레이터가 중요한 이유](#nestjs에서-데코레이터가-중요한-이유)
3. [커스텀 파라미터 데코레이터 (createParamDecorator)](#커스텀-파라미터-데코레이터-createparamdecorator)
4. [커스텀 파라미터 데코레이터에 파이프 연결하기](#커스텀-파라미터-데코레이터에-파이프-연결하기)
5. [SetMetadata를 활용한 메타데이터 데코레이터](#setmetadata를-활용한-메타데이터-데코레이터)
6. [applyDecorators로 데코레이터 합성](#applydecorators로-데코레이터-합성)

### 2단계: 기본 예제
7. [@User() 파라미터 데코레이터](#user-파라미터-데코레이터)
8. [@Roles() 메타데이터 데코레이터](#roles-메타데이터-데코레이터)
9. [합성 데코레이터](#합성-데코레이터)

### 3단계: 블로그 API 적용
10. [@CurrentUser() 데코레이터 만들기](#currentuser-데코레이터-만들기)
11. [@Public() 데코레이터 리팩토링](#public-데코레이터-리팩토링)
12. [Controller에 @CurrentUser() 적용하여 코드 간결화](#controller에-currentuser-적용하여-코드-간결화)
13. [리팩토링 전후 비교](#리팩토링-전후-비교)
14. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
15. [정리](#정리)
16. [다음 챕터 예고](#다음-챕터-예고)

---


## 1단계: 개념 학습

### 데코레이터란?

데코레이터(Decorator)는 TypeScript에서 클래스, 메서드, 프로퍼티, 파라미터에 **부가 기능이나 메타데이터를 선언적으로 부여**하는 문법이다. `@` 기호를 붙여서 사용하며, 본질적으로는 **함수**다.

```typescript
// decorator-basic.ts - TypeScript 데코레이터의 정체는 "함수"

// 1. 가장 단순한 클래스 데코레이터
function Logger(constructor: Function) {
  console.log(`${constructor.name} 클래스가 생성되었습니다.`);
}

@Logger
class UserService {
  // Logger 함수가 UserService 클래스 생성 시 호출됨
}

// 2. 메서드 데코레이터 (메서드를 감싸서 부가 기능 추가)
function Log(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(`${propertyKey} 호출됨, 인자: ${JSON.stringify(args)}`);
    return originalMethod.apply(this, args);
  };

  return descriptor;
}

class Calculator {
  @Log
  add(a: number, b: number): number {
    return a + b;
  }
}

// calculator.add(1, 2) 호출 시:
// 콘솔: "add 호출됨, 인자: [1,2]"
// 반환: 3
```

> **팁:** TypeScript에서 데코레이터를 사용하려면 `tsconfig.json`에 아래 설정이 필요하다. NestJS 프로젝트는 기본으로 이 설정이 켜져 있으므로 따로 건드릴 필요 없다.
>
> ```json
> {
>   "compilerOptions": {
>     "experimentalDecorators": true,
>     "emitDecoratorMetadata": true
>   }
> }
> ```

### 데코레이터의 4가지 종류

| 종류 | 적용 대상 | NestJS 예시 |
|------|-----------|-------------|
| 클래스 데코레이터 | 클래스 선언 위 | [`@Controller()`](references/decorators.md#controllerprefix), [`@Injectable()`](references/decorators.md#injectableoptions), [`@Module()`](references/decorators.md#moduleoptions) |
| 메서드 데코레이터 | 메서드 선언 위 | [`@Get()`](references/decorators.md#http-메서드-데코레이터), [`@Post()`](references/decorators.md#http-메서드-데코레이터), [`@UseGuards()`](references/decorators.md#useguardsguards) |
| 프로퍼티 데코레이터 | 프로퍼티 선언 위 | [`@Inject()`](references/decorators.md#injecttoken) |
| 파라미터 데코레이터 | 파라미터 선언 위 | [`@Body()`](references/decorators.md#bodykey), [`@Param()`](references/decorators.md#paramkey), [`@Query()`](references/decorators.md#querykey) |

NestJS 코드를 보면 **거의 모든 곳에 데코레이터가 있다**. 이것이 바로 NestJS가 "데코레이터 기반 프레임워크"라고 불리는 이유다.

---

### NestJS에서 데코레이터가 중요한 이유

NestJS는 이미 많은 내장 데코레이터를 제공하지만, 프로젝트가 커지면 **반복되는 패턴**이 생기기 마련이다. 이때 커스텀 데코레이터를 만들면 코드가 훨씬 깔끔해진다.

```typescript
// 커스텀 데코레이터가 없을 때 - 매번 req.user를 직접 꺼내야 한다
@Get('my-posts')
findMyPosts(@Req() req: Request) {
  const userId = req.user.id;       // 반복!
  return this.postsService.findByAuthor(userId);
}

@Post()
create(@Req() req: Request, @Body() dto: CreatePostDto) {
  const userId = req.user.id;       // 또 반복!
  return this.postsService.create(userId, dto);
}
```

```typescript
// 커스텀 데코레이터를 만든 후 - 의도가 명확하고 간결하다
@Get('my-posts')
findMyPosts(@CurrentUser('id') userId: number) {
  return this.postsService.findByAuthor(userId);
}

@Post()
create(@CurrentUser('id') userId: number, @Body() dto: CreatePostDto) {
  return this.postsService.create(userId, dto);
}
```

커스텀 데코레이터의 핵심 이점:

- **코드 중복 제거**: `req.user`를 꺼내는 로직을 한 곳에서 관리
- **가독성 향상**: `@CurrentUser('id')`만 보면 무엇을 하는지 바로 이해 가능
- **관심사 분리**: 비즈니스 로직과 요청 데이터 추출 로직을 분리
- **재사용성**: 여러 컨트롤러에서 동일한 데코레이터를 가져다 쓸 수 있음

---

### 커스텀 파라미터 데코레이터 ([createParamDecorator](references/decorators.md#createparamdecoratorfactory))

NestJS에서 가장 많이 만드는 커스텀 데코레이터는 **파라미터 데코레이터**다. [`createParamDecorator()`](references/decorators.md#createparamdecoratorfactory) 함수를 사용하면 쉽게 만들 수 있다.

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const MyDecorator = createParamDecorator(
  (data: 데코레이터에_전달한_인자, ctx: ExecutionContext) => {
    // data: @MyDecorator('여기에 넣은 값')
    // ctx: 현재 요청의 실행 컨텍스트 (request, response 등에 접근 가능)

    const request = ctx.switchToHttp().getRequest();
    return request.something; // 여기서 반환한 값이 파라미터에 주입됨
  },
);
```

동작 원리를 정리하면:

1. `@MyDecorator('hello')`라고 사용하면
2. `data`에 `'hello'`가 들어오고
3. `ctx`로 현재 HTTP 요청 객체에 접근할 수 있으며
4. **반환값이 해당 파라미터의 값**이 된다

> **팁:** `ExecutionContext`는 챕터 6(Guard)에서 배운 그 컨텍스트 객체와 동일하다. `switchToHttp().getRequest()`로 HTTP 요청 객체에 접근할 수 있다.

### 커스텀 파라미터 데코레이터에 파이프 연결하기

`createParamDecorator`로 만든 커스텀 데코레이터에도 내장 파이프를 연결할 수 있다. [`@Param('id', ParseIntPipe)`](references/decorators.md#paramkey)처럼 두 번째 인자로 파이프를 전달하면 된다.

```typescript
// src/posts/posts.controller.ts
import { Controller, Get } from '@nestjs/common';
import { User } from '../common/decorators/user.decorator';
import { ParseIntPipe } from '@nestjs/common';

// 예시: 커스텀 데코레이터에서 꺼낸 값에 파이프 적용
// @User()가 request.user.id를 문자열로 반환할 때 숫자로 변환
@Controller('posts')
export class PostsController {
  @Get('my')
  findMyPosts(@User('id', ParseIntPipe) userId: number) {
    return this.postsService.findByUserId(userId);
  }
}
```

파이프를 배열로 전달해 여러 파이프를 순서대로 적용할 수도 있다.

```typescript
@Get('my')
findMyPosts(@User('id', new ParseIntPipe(), new ValidationPipe()) userId: number) {
  // ...
}
```

> **참고:** 커스텀 파라미터 데코레이터에 파이프를 연결하면, 파이프는 데코레이터가 반환한 값에 적용된다. Guard나 Interceptor와 달리 파이프는 파라미터 값 하나를 처리하는 단계이므로, 커스텀 데코레이터와 파이프를 조합하면 강력한 입력 변환·검증 체계를 구성할 수 있다.

---

### SetMetadata를 활용한 메타데이터 데코레이터

`SetMetadata`는 라우트 핸들러(메서드)나 컨트롤러(클래스)에 **메타데이터를 부착**하는 데코레이터다. Guard나 Interceptor에서 `Reflector`를 통해 이 메타데이터를 읽을 수 있다.

```typescript
import { SetMetadata } from '@nestjs/common';

// 직접 사용 (비권장 - 문자열 키가 분산되어 오타 위험)
@SetMetadata('roles', ['admin'])
@Get('admin')
adminOnly() { ... }

// 커스텀 데코레이터로 감싸기 (권장 - 타입 안전, 재사용 가능)
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// 사용
@Roles('admin')
@Get('admin')
adminOnly() { ... }
```

> **팁:** `SetMetadata`를 직접 쓰는 것보다 항상 커스텀 데코레이터로 감싸서 사용하자. 문자열 키(`'roles'`)를 상수(`ROLES_KEY`)로 관리하면 오타를 방지하고, IDE 자동완성도 활용할 수 있다.

---

### applyDecorators로 데코레이터 합성

여러 데코레이터를 자주 함께 사용하는 패턴이 있다면, [`applyDecorators`](references/decorators.md#applydecoratorsdecorators)로 하나로 합칠 수 있다.

```typescript
import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';

// 합성 전 - 매번 3개의 데코레이터를 반복
@SetMetadata('roles', ['admin'])
@UseGuards(AuthGuard, RolesGuard)
@Get('admin')
adminOnly() { ... }

// 합성 후 - 하나의 데코레이터로 깔끔하게
export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata('roles', roles),
    UseGuards(AuthGuard, RolesGuard),
  );
}

@Auth('admin')
@Get('admin')
adminOnly() { ... }
```

> **주의:** [`applyDecorators`](references/decorators.md#applydecoratorsdecorators)로 **파라미터 데코레이터**([`@Body()`](references/decorators.md#bodykey), [`@Param()`](references/decorators.md#paramkey) 등)는 합성할 수 없다. 메서드 데코레이터와 클래스 데코레이터는 합성 가능하다.

---

## 2단계: 기본 예제

개념을 이해했으니, 실제 코드를 작성해보자.

### @User() 파라미터 데코레이터

가장 흔한 사용 사례인 **요청 객체에서 유저 정보를 추출**하는 데코레이터다.

```typescript
// src/common/decorators/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Guard가 request.user에 저장한 유저 정보를 꺼내는 데코레이터
export const User = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // @User('email')처럼 특정 필드만 요청하면 해당 값만 반환
    // @User()처럼 인자 없이 사용하면 전체 유저 객체 반환
    return data ? user?.[data] : user;
  },
);
```

사용 예시:

```typescript
// src/example/example.controller.ts
import { Controller, Get } from '@nestjs/common';
import { User } from '../common/decorators/user.decorator';

@Controller('example')
export class ExampleController {
  @Get('profile')
  getProfile(@User() user: any) {
    // user = { id: 1, email: 'test@test.com', name: '홍길동' }
    return user;
  }

  @Get('my-email')
  getMyEmail(@User('email') email: string) {
    // email = 'test@test.com' (특정 필드만 추출)
    return { email };
  }

  @Get('my-id')
  getMyId(@User('id') userId: number) {
    // userId = 1
    return { userId };
  }
}
```

> **팁:** `@User()`의 `data` 파라미터에 아무것도 안 넣으면 `undefined`가 되어 전체 `user` 객체가 반환된다. `'email'`이나 `'id'` 같은 문자열을 넣으면 해당 필드의 값만 반환된다. 이 패턴은 NestJS 내장 [`@Param()`](references/decorators.md#paramkey), [`@Query()`](references/decorators.md#querykey)와 동일한 방식이다.

---

### @Roles() 메타데이터 데코레이터

챕터 6에서 이미 다뤘던 역할 기반 접근 제어를 위한 데코레이터다. 복습 겸 다시 살펴보자.

```typescript
// src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// @Roles('admin', 'manager') 형태로 사용
// 내부적으로 SetMetadata('roles', ['admin', 'manager'])와 동일
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Guard에서 `Reflector`로 메타데이터를 읽는 방법:

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 핸들러(메서드)에 설정된 roles 메타데이터를 먼저 찾고,
    // 없으면 클래스(컨트롤러)에 설정된 것을 찾는다
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // @Roles() 데코레이터가 없으면 누구나 접근 가능
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user?.roles?.includes(role));
  }
}
```

사용 예시:

```typescript
// src/example/example.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('example')
@UseGuards(RolesGuard)
export class ExampleController {
  @Get('admin')
  @Roles('admin')
  adminOnly() {
    return '관리자만 접근 가능';
  }

  @Get('manager')
  @Roles('admin', 'manager')
  managerOrAdmin() {
    return '관리자 또는 매니저 접근 가능';
  }

  @Get('public-data')
  // @Roles()가 없으므로 RolesGuard가 통과시킴
  publicData() {
    return '역할 제한 없음';
  }
}
```

---

### 합성 데코레이터

인증(Guard) + 역할(메타데이터) + 기타 데코레이터를 하나로 합치는 예제다.

```typescript
// src/common/decorators/auth.decorator.ts
import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';

// @Auth('admin') 하나로 인증 + 인가를 한번에 처리
export function Auth(...roles: string[]) {
  return applyDecorators(
    Roles(...roles),                     // 역할 메타데이터 설정
    UseGuards(AuthGuard, RolesGuard),    // Guard 적용 (AuthGuard -> RolesGuard 순서)
  );
}
```

사용 예시:

```typescript
// src/example/example.controller.ts
import { Controller, Get, Delete, Param } from '@nestjs/common';
import { Auth } from '../common/decorators/auth.decorator';

@Controller('example')
export class ExampleController {
  // 인증만 필요 (roles 인자 없으면 역할 제한 없음)
  @Auth()
  @Get('me')
  getMyProfile() {
    return '인증된 사용자';
  }

  // admin 역할 필요
  @Auth('admin')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { deleted: id };
  }
}
```

> **팁:** 합성 데코레이터는 나중에 Swagger(챕터 14)를 도입하면 더 강력해진다. `ApiBearerAuth()`, `ApiUnauthorizedResponse()` 같은 Swagger 데코레이터도 함께 합성하면, API 문서화까지 자동으로 처리된다.

---

## 3단계: 블로그 API 적용

이제 지금까지 배운 커스텀 데코레이터를 **블로그 API 프로젝트**에 적용한다. 챕터 6에서 만든 `SimpleAuthGuard`, `@Public()` 데코레이터를 정식 커스텀 데코레이터로 리팩토링하고, `@CurrentUser()`를 새로 만들어서 컨트롤러 코드를 간결하게 개선한다.

> **이전 챕터 복습**: 챕터 6(Guard)에서 `SimpleAuthGuard`는 요청 헤더의 `x-user-id`를 확인하고, 해당 유저 정보를 `request.user`에 저장하는 간이 인증 가드였다. `@Public()` 데코레이터는 `SetMetadata`를 사용해 특정 라우트에서 인증을 건너뛰도록 만들었다.

---

### @CurrentUser() 데코레이터 만들기

`request.user`에 저장된 유저 정보를 편리하게 추출하는 파라미터 데코레이터다.

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 요청 객체에서 현재 인증된 유저 정보를 추출하는 파라미터 데코레이터.
 *
 * Guard(SimpleAuthGuard)가 request.user에 저장한 유저 정보를 가져온다.
 *
 * 사용법:
 *   @CurrentUser()          → 유저 객체 전체 반환 { id, email, name, role }
 *   @CurrentUser('id')      → 유저 id만 반환
 *   @CurrentUser('email')   → 유저 email만 반환
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    // data가 있으면 특정 필드만, 없으면 전체 유저 객체 반환
    return data ? user[data] : user;
  },
);
```

**왜 `UnauthorizedException`을 던지지 않는가?**

인증 검사는 Guard의 책임이다. `@CurrentUser()`는 단순히 데이터를 "꺼내는" 역할만 담당한다. 인증이 필요한 라우트에서는 Guard가 이미 인증을 처리했으므로 `request.user`는 항상 존재한다. `@Public()` 라우트에서는 Guard를 건너뛰므로 `request.user`가 없을 수 있는데, 이때는 `null`을 반환한다.

> **팁:** 각 계층의 역할을 명확히 분리하자.
> - **Guard**: 인증 여부 판단 (없으면 401 에러)
> - **파라미터 데코레이터**: 데이터 추출 (있으면 반환, 없으면 null)
> - **Pipe**: 데이터 검증/변환

---

### @Public() 데코레이터 리팩토링

챕터 6에서 이미 `@Public()` 데코레이터를 만들었다. 이번에는 이를 `src/common/decorators/` 폴더로 옮겨 정식 커스텀 데코레이터로 정리한다.

```typescript
// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 전역 AuthGuard가 적용된 상태에서, 특정 라우트를 인증 없이 접근 가능하게 만드는 데코레이터.
 *
 * 사용법:
 *   @Public()
 *   @Get('posts')
 *   findAll() { ... }   // 인증 없이 접근 가능
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

Guard에서 `@Public()`을 인식하는 코드 (챕터 6에서 작성한 것과 동일):

```typescript
// src/common/guards/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class SimpleAuthGuard implements CanActivate {
  // 메모리 기반 유저 데이터 (챕터 6에서 만든 것)
  private users = [
    { id: 1, email: 'admin@blog.com', name: '관리자', role: 'admin' },
    { id: 2, email: 'user@blog.com', name: '사용자', role: 'user' },
  ];

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. @Public() 데코레이터가 있으면 인증 건너뛰기
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. 헤더에서 x-user-id 확인
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('x-user-id 헤더가 필요합니다.');
    }

    // 3. 유저 찾기
    const user = this.users.find((u) => u.id === Number(userId));

    if (!user) {
      throw new UnauthorizedException('존재하지 않는 사용자입니다.');
    }

    // 4. request.user에 유저 정보 저장 → @CurrentUser()에서 사용
    request.user = user;
    return true;
  }
}
```

---

### Controller에 @CurrentUser() 적용하여 코드 간결화

이제 블로그 API의 각 컨트롤러에서 [`@Req() req`](references/decorators.md#req-res)로 직접 `req.user`에 접근하던 코드를 `@CurrentUser()`로 교체한다.

#### PostsController 리팩토링

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
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // 게시글 목록 - 누구나 접근 가능
  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.postsService.findAll(query);
  }

  // 게시글 상세 - 누구나 접근 가능
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  // 게시글 작성 - 인증 필요 (@CurrentUser로 작성자 정보 추출)
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create(userId, createPostDto);
  }

  // 게시글 수정 - 인증 필요
  @Patch(':id')
  update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, userId, updatePostDto);
  }

  // 게시글 삭제 - 인증 필요
  @Delete(':id')
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.remove(id, userId);
  }
}
```

#### CommentsController 리팩토링

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
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // 댓글 목록 - 누구나 접근 가능
  @Public()
  @Get('posts/:postId/comments')
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findByPost(postId);
  }

  // 댓글 작성 - 인증 필요
  @Post('posts/:postId/comments')
  create(
    @CurrentUser('id') userId: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentsService.create(userId, postId, createCommentDto);
  }

  // 댓글 삭제 - 인증 필요
  @Delete('comments/:id')
  remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.commentsService.remove(id, userId);
  }
}
```

#### UsersController에서 @CurrentUser() 활용

```typescript
// src/users/users.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // 내 프로필 조회 - 인증 필요
  @Get('me')
  getMyProfile(@CurrentUser() user: any) {
    // @CurrentUser()가 request.user 전체를 반환
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  // 다른 사용자 프로필 조회 - 누구나 접근 가능
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }
}
```

---

### 리팩토링 전후 비교

`@CurrentUser()` 도입 전후를 비교하면 차이가 확연하다.

#### Before: @Req()로 직접 접근

```typescript
// 리팩토링 전 - req.user를 직접 꺼내야 한다
import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('posts')
export class PostsController {
  @Post()
  create(@Req() req: Request, @Body() createPostDto: CreatePostDto) {
    const userId = (req as any).user.id;  // 타입 단언 필요, 지저분함
    return this.postsService.create(userId, createPostDto);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const userId = (req as any).user.id;  // 또 같은 패턴 반복
    return this.postsService.update(id, userId, updatePostDto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const userId = (req as any).user.id;  // 또 반복...
    return this.postsService.remove(id, userId);
  }
}
```

#### After: @CurrentUser() 사용

```typescript
// 리팩토링 후 - 깔끔하고 의도가 명확하다
import { Controller, Post, Body } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('posts')
export class PostsController {
  @Post()
  create(
    @CurrentUser('id') userId: number,  // 한 줄로 끝
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postsService.create(userId, createPostDto);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: number,  // 동일한 패턴
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, userId, updatePostDto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: number,  // 일관성
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.postsService.remove(id, userId);
  }
}
```

개선된 점:

| 항목 | Before | After |
|------|--------|-------|
| 타입 안전성 | `(req as any).user.id` 타입 단언 필요 | `@CurrentUser('id') userId: number` |
| 코드 중복 | 매 메서드마다 `req.user.id` 추출 | 데코레이터 한 줄로 해결 |
| Express 의존성 | [`@Req() req: Request`](references/decorators.md#req-res) - Express에 종속 | Express 타입 불필요 |
| 가독성 | 메서드 본문에 데이터 추출 로직 섞임 | 파라미터 선언에서 명확히 표현 |

---

## 프로젝트 구조

```
src/
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts ← [이번 챕터 추가]
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   └── guards/
│       └── simple-auth.guard.ts      ← @CurrentUser 연동으로 수정
├── users/
│   └── users.controller.ts           ← @CurrentUser() 적용
├── posts/
│   └── posts.controller.ts           ← @CurrentUser(), @Public() 적용
└── comments/
    └── comments.controller.ts        ← @CurrentUser(), @Public() 적용
```

---

## 정리

| 데코레이터 유형 | 핵심 함수 | 용도 | 블로그 API 적용 |
|-----------------|-----------|------|-----------------|
| 파라미터 데코레이터 | [`createParamDecorator`](references/decorators.md#createparamdecoratorfactory) | 요청에서 데이터 추출 | `@CurrentUser()` |
| 메타데이터 데코레이터 | `SetMetadata` | 라우트에 메타데이터 부착 | `@Public()`, `@Roles()` |
| 합성 데코레이터 | [`applyDecorators`](references/decorators.md#applydecoratorsdecorators) | 여러 데코레이터를 하나로 | `@Auth()` (Swagger 도입 후 확장 예정) |

### Phase 1~3 완료!

이 챕터를 마치면 **메모리 기반 블로그 API**가 완성된다. 지금까지 구축한 것을 정리하면:

| Phase | 챕터 | 구현한 것 |
|-------|-------|-----------|
| Phase 1 | 1~3 | 모듈 분리, 컨트롤러 라우팅, 서비스 비즈니스 로직 (메모리 CRUD) |
| Phase 2 | 4~6 | 요청 로깅, DTO 유효성 검사, 인증/인가 가드 |
| Phase 3 | 7~9 | 응답 래핑, 에러 처리 통일, 커스텀 데코레이터로 코드 간결화 |

> **다음 챕터 예고**: 챕터 10(TypeORM)에서는 메모리 배열을 **실제 데이터베이스(SQLite)**로 교체한다. Entity를 정의하고, Repository 패턴으로 서비스를 리팩토링하게 된다.
---

## 다음 챕터 예고

챕터 10에서는 **TypeORM**으로 실제 데이터베이스를 연동한다. 지금까지 메모리 배열에 저장하던 데이터를 SQLite DB에 저장하여 서버를 재시작해도 데이터가 유지되게 만든다.

