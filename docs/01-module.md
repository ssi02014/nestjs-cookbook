# 챕터 1 - Module

## 목차

### 1단계: 개념 학습
1. [Module이란 무엇인가](#1-module이란-무엇인가)
2. [@Module() 데코레이터의 4가지 속성](#2-module-데코레이터의-4가지-속성)
3. [모듈 트리 구조](#3-모듈-트리-구조)
4. [전역 모듈 (@Global)](#4-전역-모듈-global)
5. [동적 모듈 (Dynamic Module)](#5-동적-모듈-dynamic-module)
6. [모듈 재내보내기 (Re-exporting)](#6-모듈-재내보내기-re-exporting)
7. [순환 의존성과 forwardRef](#7-순환-의존성과-forwardref)
8. [모듈 간 관계 시각화](#8-모듈-간-관계-시각화)

### 2단계: 기본 예제
7. [CatsModule 예제](#7-catsmodule-예제)
8. [모듈 분리와 imports/exports](#8-모듈-분리와-importsexports)
9. [공유 모듈 예제](#9-공유-모듈-예제)

### 3단계: 블로그 API 적용
10. [블로그 프로젝트 모듈 구조 설계](#10-블로그-프로젝트-모듈-구조-설계)
11. [모듈 생성하기](#11-모듈-생성하기)
12. [완성된 모듈 구조 확인](#12-완성된-모듈-구조-확인)
13. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
14. [정리](#정리)
15. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---


## 1. Module이란 무엇인가

### 왜 모듈이 필요한가?

작은 프로그램이라면 하나의 파일에 모든 코드를 넣어도 괜찮다. 하지만 프로젝트가 커지면 어떻게 될까? 사용자 관리, 게시글 관리, 댓글 관리, 인증 처리... 이 모든 코드가 한 곳에 뒤섞여 있다면 유지보수가 불가능해진다.

**Module(모듈)** 은 이 문제를 해결하기 위해 존재한다. NestJS에서 모듈은 **관련된 기능을 하나의 그룹으로 묶어주는 조직 단위**다. 쉽게 말해, "이 컨트롤러와 이 서비스는 같은 팀이야"라고 NestJS에게 알려주는 역할을 한다.

### 모듈의 핵심 역할

```
모듈 = 관련된 기능(컨트롤러 + 서비스)을 하나로 묶는 상자
```

모듈을 사용하면 다음과 같은 이점이 있다:

- **관심사 분리**: 사용자 관련 코드는 UsersModule에, 게시글 관련 코드는 PostsModule에 넣는다. 각 모듈이 자기 역할에만 집중할 수 있다.
- **캡슐화**: 모듈 내부의 서비스는 명시적으로 외부에 공개(`export`)하지 않으면 다른 모듈에서 접근할 수 없다. 마치 집 안의 물건은 문을 열어주지 않으면 밖에서 가져갈 수 없는 것과 같다.
- **재사용성**: 잘 만든 모듈은 다른 프로젝트에 통째로 가져다 쓸 수 있다.

### 클래스 하나로 정의된다

NestJS에서 모듈은 [`@Module()`](references/decorators.md#moduleoptions) 데코레이터가 붙은 클래스다. 모든 NestJS 앱에는 반드시 **하나 이상의 모듈**이 존재하며, 가장 최상위에 위치하는 모듈을 **루트 모듈(Root Module)** 이라고 부른다. 보통 `AppModule`이 이 역할을 한다.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';

@Module({})
export class AppModule {}
```

> **팁:** [`@Module()`](references/decorators.md#moduleoptions)은 데코레이터(Decorator)라고 불린다. 데코레이터는 클래스나 메서드 위에 `@`를 붙여서 추가 정보를 제공하는 문법이다. "이 클래스는 모듈이야"라고 NestJS에게 알려주는 표시라고 생각하면 된다.

---

## 2. [@Module()](references/decorators.md#moduleoptions) 데코레이터의 4가지 속성

[`@Module()`](references/decorators.md#moduleoptions) 데코레이터는 하나의 객체를 인자로 받으며, 이 객체에는 4가지 속성을 지정할 수 있다. 각 속성이 어떤 역할을 하는지 하나씩 알아보자.

```typescript
@Module({
  imports: [],      // 이 모듈이 필요로 하는 다른 모듈들
  controllers: [],  // 이 모듈이 가지고 있는 컨트롤러들
  providers: [],    // 이 모듈이 가지고 있는 서비스(provider)들
  exports: [],      // 이 모듈이 외부에 공개하는 서비스들
})
```

### 속성별 상세 설명

| 속성 | 한줄 설명 | 비유 |
|------|-----------|------|
| `imports` | 이 모듈에서 사용할 **외부 모듈** 목록 | "우리 팀에서 쓸 다른 팀의 도구를 가져온다" |
| `controllers` | 이 모듈에서 정의하는 **컨트롤러** 목록 | "우리 팀의 접수 담당자들" |
| `providers` | 이 모듈에서 사용하는 **서비스(provider)** 목록 | "우리 팀의 실무 담당자들" |
| `exports` | 이 모듈에서 **외부에 공개**할 provider 목록 | "다른 팀에게 빌려줄 수 있는 우리 팀원들" |

좀 더 자세히 풀어보면:

- **`imports`**: 다른 모듈이 `exports`한 provider를 이 모듈에서 사용하고 싶을 때, 해당 모듈을 여기에 등록한다. 예를 들어 `CommonModule`이 `CommonService`를 export하고 있다면, `imports: [CommonModule]`로 가져와야 `CommonService`를 주입받을 수 있다.

- **`controllers`**: HTTP 요청을 받아 처리하는 컨트롤러 클래스들을 등록한다. 여기에 등록해야 NestJS가 해당 컨트롤러의 라우트를 인식한다.

- **`providers`**: 비즈니스 로직을 담당하는 서비스, 리포지토리 등을 등록한다. NestJS의 DI(Dependency Injection, 의존성 주입) 시스템이 이 목록을 보고 자동으로 인스턴스를 생성하고 필요한 곳에 넣어준다.

- **`exports`**: 이 모듈의 provider 중 다른 모듈에서도 사용할 수 있게 공개할 것들을 등록한다. **exports에 등록하지 않은 provider는 이 모듈 내부에서만 사용 가능**하다.

> **팁:** `providers`에 등록했다고 자동으로 외부에 공개되는 것이 아니다. 외부에서 쓸 수 있게 하려면 반드시 `exports`에도 추가해야 한다. 이것이 바로 NestJS의 **캡슐화** 원칙이다.

---

## 3. 모듈 트리 구조

NestJS 애플리케이션은 **모듈 트리(Module Tree)** 형태로 구성된다. 루트 모듈(`AppModule`)을 꼭대기에 두고, 기능별 모듈들이 가지처럼 연결되는 구조다.

```
AppModule (루트 모듈 - 앱의 시작점)
  ├── UsersModule (사용자 기능)
  ├── PostsModule (게시글 기능)
  │     └── CommentsModule (댓글 기능)
  └── CommonModule (공통 유틸리티)
```

NestJS는 이 트리 구조를 분석해서:
1. 각 모듈에 어떤 컨트롤러와 provider가 있는지 파악하고
2. 모듈 간 의존 관계(`imports`/`exports`)를 확인하고
3. 필요한 의존성을 자동으로 주입해준다

이 과정을 **모듈 초기화(Module Initialization)** 라고 하며, `main.ts`에서 `NestFactory.create(AppModule)`을 호출하는 순간 시작된다.

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule); // 여기서 모듈 트리를 분석한다
  await app.listen(3000);
}
bootstrap();
```

> **팁:** 모든 Feature 모듈(기능별 모듈)은 직접적이든 간접적이든 결국 루트 모듈과 연결되어야 한다. 연결되지 않은 모듈은 NestJS가 인식하지 못한다.

---

## 4. 전역 모듈 ([@Global](references/decorators.md#global))

일반적인 모듈은 사용하려는 모듈마다 `imports`에 등록해야 한다. 하지만 **데이터베이스 연결**, **로깅**, **설정 관리**처럼 앱 전체에서 공통으로 쓰이는 모듈이 있다면, 매번 `imports`에 추가하는 것은 번거롭다.

이때 [`@Global()`](references/decorators.md#global) 데코레이터를 사용하면 **전역 모듈**로 만들 수 있다. 전역 모듈은 루트 모듈에서 한 번만 import하면, 이후 다른 모듈에서는 import 없이 해당 provider를 사용할 수 있다.

```typescript
import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Global() // 전역 모듈 선언
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService], // 전역 모듈이라도 exports는 반드시 필요!
})
export class DatabaseModule {}
```

> **팁:** [`@Global()`](references/decorators.md#global)을 붙여도 `exports`는 반드시 작성해야 한다. [`@Global()`](references/decorators.md#global)은 "import 없이 접근 가능하게 해줘"라는 의미이지, "모든 것을 공개해줘"라는 의미가 아니다. 또한, 전역 모듈을 남용하면 모듈 간 의존 관계가 불명확해지므로 꼭 필요한 경우에만 사용하자.

---

## 5. 동적 모듈 (Dynamic Module)

지금까지 본 모듈은 **정적 모듈**이다. 코드를 작성하는 시점에 모든 설정이 고정되어 있다. 하지만 실제 프로젝트에서는 **환경에 따라 다른 설정**이 필요할 때가 있다. 예를 들어:

- 개발 환경과 운영 환경에서 다른 데이터베이스에 연결해야 할 때
- 외부 API 키를 모듈에 전달해야 할 때

이런 경우 **동적 모듈(Dynamic Module)** 을 사용한다. 동적 모듈은 `forRoot()`, `forFeature()`, `register()` 같은 정적 메서드를 통해 설정값을 받아 모듈을 구성한다.

```typescript
// 동적 모듈 사용 예시 (자세한 구현은 이후 챕터에서 다룬다)
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),        // 설정을 전달하면서 모듈 등록
    TypeOrmModule.forRoot({ type: 'postgres', ... }), // DB 설정을 전달하면서 등록
  ],
})
export class AppModule {}
```

**관례적인 메서드 이름:**

| 메서드 | 용도 |
|--------|------|
| `forRoot()` | 루트 모듈에서 한 번 설정 (앱 전체 설정) |
| `forFeature()` | Feature 모듈에서 부분적으로 설정 |
| `register()` | 사용할 때마다 새로운 설정으로 등록 |

> **팁:** 동적 모듈은 NestJS의 강력한 기능이지만, 이 챕터에서는 "이런 것이 있다"는 것만 알고 넘어가자. 실전에서 ConfigModule, TypeOrmModule 등을 사용할 때 자연스럽게 익히게 된다.

---

## 6. 모듈 재내보내기 (Re-exporting)

모듈 A가 모듈 B를 import한 뒤, 자신의 `exports`에 **모듈 B 자체**를 추가하면 모듈 A를 import하는 쪽에서 모듈 B의 provider도 함께 사용할 수 있다. 이를 **모듈 재내보내기(Re-exporting)** 라고 한다.

### 왜 필요한가?

여러 Feature 모듈에서 공통으로 필요한 모듈이 여럿 있을 때, 매번 각각 import하면 코드가 반복된다.

```typescript
// src/users/users.module.ts — 반복이 많은 경우 (Re-exporting 미사용)
@Module({
  imports: [CommonModule, LoggerModule, UtilsModule],
})
export class UsersModule {}
```

```typescript
// src/posts/posts.module.ts — 똑같이 반복
@Module({
  imports: [CommonModule, LoggerModule, UtilsModule],
})
export class PostsModule {}
```

이런 경우 이 모듈들을 하나로 묶어 재내보내는 **CoreModule** 패턴을 사용하면 깔끔해진다.

```typescript
// src/core/core.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [CommonModule, LoggerModule],
  exports: [CommonModule, LoggerModule], // import한 모듈을 그대로 재내보내기
})
export class CoreModule {}
```

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module'; // CoreModule 하나만 import

@Module({
  imports: [CoreModule], // CommonModule과 LoggerModule의 provider 모두 사용 가능
})
export class UsersModule {}
```

> **팁:** `exports`에 자신의 provider(클래스)뿐만 아니라 **import한 모듈** 자체를 넣을 수 있다. 이렇게 하면 그 모듈이 export하는 모든 provider가 함께 재내보내진다.

> **주의:** Re-exporting을 남용하면 의존 관계가 불명확해진다. 정말로 여러 곳에서 공통으로 묶어야 할 때만 사용하자.

---

## 7. 순환 의존성과 forwardRef

### 순환 의존성이란?

두 모듈이 서로를 import하는 상황을 **순환 의존성(Circular Dependency)** 이라고 한다.

```
UsersModule ──imports──▶ PostsModule
PostsModule ──imports──▶ UsersModule  ← 서로가 서로를 참조
```

이런 구조가 생기면 NestJS는 어느 쪽을 먼저 초기화해야 할지 알 수 없어 오류가 발생한다.

### 설계로 먼저 해결하기

순환 의존성은 대부분 **설계 문제**다. 두 모듈이 서로를 참조해야 한다면, 공통 로직을 별도의 `SharedModule`로 분리하는 것이 가장 좋은 해결책이다.

```
UsersModule ──imports──▶ SharedModule
PostsModule ──imports──▶ SharedModule
```

### forwardRef로 해결하기

설계 변경이 어려운 경우, `forwardRef()`를 사용해 순환 참조를 해결할 수 있다. `forwardRef()`는 "이 값은 나중에 결정돼"라고 NestJS에 알려주는 함수다.

```typescript
// src/users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [
    forwardRef(() => PostsModule), // 순환 참조를 forwardRef로 감싸기
  ],
  exports: [UsersService],
})
export class UsersModule {}
```

```typescript
// src/posts/posts.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    forwardRef(() => UsersModule), // 양쪽 모두 forwardRef 필요
  ],
  exports: [PostsService],
})
export class PostsModule {}
```

> **주의:** `forwardRef()`는 임시방편이다. 이 패턴이 필요하다면 모듈 설계를 다시 검토하자. 공통 의존성을 별도 모듈로 추출하는 것이 장기적으로 더 안전하다.

> **참고:** 모듈뿐만 아니라 provider 간 순환 의존성(서비스 A가 서비스 B를 주입받고, 서비스 B도 서비스 A를 주입받는 경우)에도 `forwardRef()`가 사용된다. 이 경우 생성자 파라미터에 `@Inject(forwardRef(() => ServiceB))`처럼 적용한다.

---

## 8. 모듈 간 관계 시각화

NestJS 앱에서 모듈들이 어떻게 연결되는지 전체적인 그림을 보자.

```
┌─────────────────────────────────────────────────────────────┐
│                        AppModule                            │
│                       (루트 모듈)                            │
│                                                             │
│   imports: [DatabaseModule, UsersModule, PostsModule]       │
└──────┬─────────────────────┬────────────────────┬───────────┘
       │                     │                    │
       ▼                     ▼                    ▼
┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ @Global()    │   │  UsersModule    │   │  PostsModule    │
│ Database     │   │                 │   │                 │
│ Module       │   │ imports:        │   │ imports:        │
│              │   │  [CommonModule] │   │  [CommonModule] │
│ exports:     │   │                 │   │                 │
│ [Database    │   │ controllers:    │   │ controllers:    │
│  Service]    │   │  [UsersCtrl]    │   │  [PostsCtrl]    │
│              │   │                 │   │                 │
│ (전역이므로  │   │ providers:      │   │ providers:      │
│  모든 곳에서 │   │  [UsersService] │   │  [PostsService] │
│  사용 가능)  │   │                 │   │                 │
└──────────────┘   └────────┬────────┘   └────────┬────────┘
                            │                     │
                            └──────────┬──────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │     CommonModule      │
                           │    (공유 모듈)         │
                           │                       │
                           │ providers:            │
                           │  [CommonService]      │
                           │                       │
                           │ exports:              │
                           │  [CommonService]      │
                           │  ↑ 이것이 있어야      │
                           │    외부에서 사용 가능  │
                           └───────────────────────┘
```

**의존성 흐름 요약:**

```
AppModule (루트)
  ├── DatabaseModule (@Global - 어디서든 DatabaseService 사용 가능)
  ├── UsersModule
  │     └── imports: CommonModule → CommonService 사용 가능
  └── PostsModule
        └── imports: CommonModule → CommonService 사용 가능
```

**핵심 규칙 정리:**
- `DatabaseModule`은 [`@Global()`](references/decorators.md#global)이므로 어떤 모듈에서든 별도 import 없이 `DatabaseService`를 주입받을 수 있다.
- `CommonModule`은 일반 공유 모듈이므로, 사용하려는 모듈에서 반드시 `imports`에 명시해야 한다.
- 각 Feature 모듈은 자신만의 컨트롤러와 provider를 **캡슐화**한다. 외부에 공개하지 않은 것은 내부에서만 사용된다.

---

# 2단계: 기본 예제

---

## 7. CatsModule 예제

NestJS 공식 문서에서 자주 등장하는 고양이(Cats) 예제로 모듈의 기본을 익혀보자.

### 7-1. 서비스 만들기

먼저 고양이 데이터를 관리하는 서비스를 만든다.

```typescript
// cats/cats.service.ts
import { Injectable } from '@nestjs/common';

// Cat 인터페이스 정의
export interface Cat {
  name: string;
  age: number;
  breed: string; // 품종
}

@Injectable() // 이 데코레이터가 있어야 DI(의존성 주입) 대상이 된다
export class CatsService {
  private readonly cats: Cat[] = [];

  create(cat: Cat) {
    this.cats.push(cat);
  }

  findAll(): Cat[] {
    return this.cats;
  }
}
```

> 이 코드는 `CatsService`라는 서비스 클래스를 정의한다. [`@Injectable()`](references/decorators.md#injectableoptions)은 "이 클래스는 NestJS의 DI 시스템이 관리할 수 있어"라는 표시다. 내부에 고양이 목록을 배열로 보관하고, 추가(`create`)와 조회(`findAll`) 기능을 제공한다.

### 7-2. 컨트롤러 만들기

HTTP 요청을 받아서 서비스에 위임하는 컨트롤러를 만든다.

```typescript
// cats/cats.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { CatsService, Cat } from './cats.service';

@Controller('cats') // '/cats' 경로 담당
export class CatsController {
  constructor(private readonly catsService: CatsService) {}
  // ↑ 생성자에서 CatsService를 주입받는다 (NestJS가 자동으로 넣어준다)

  @Post() // POST /cats
  create(@Body() cat: Cat) {
    this.catsService.create(cat);
  }

  @Get() // GET /cats
  findAll(): Cat[] {
    return this.catsService.findAll();
  }
}
```

> 이 코드는 `CatsController`를 정의한다. [`@Controller('cats')`](references/decorators.md#controllerprefix)는 이 컨트롤러가 `/cats` 경로를 담당한다는 의미다. 생성자에서 `CatsService`를 받아오고, POST 요청이 오면 고양이를 추가하고, GET 요청이 오면 전체 목록을 반환한다.

### 7-3. 모듈로 묶기

서비스와 컨트롤러를 하나의 모듈로 묶는다.

```typescript
// cats/cats.module.ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController], // 이 모듈의 컨트롤러
  providers: [CatsService],      // 이 모듈의 서비스
})
export class CatsModule {}
```

> 이 코드는 `CatsModule`을 정의한다. `CatsController`와 `CatsService`를 하나의 모듈로 묶어서 "고양이 관련 기능은 여기에 다 있어"라고 NestJS에게 알려준다.

### 7-4. 루트 모듈에 연결하기

마지막으로 `CatsModule`을 루트 모듈에 등록한다.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CatsModule } from './cats/cats.module';

@Module({
  imports: [CatsModule], // CatsModule을 앱에 연결
})
export class AppModule {}
```

> 이 코드로 `CatsModule`이 앱의 모듈 트리에 연결된다. 이제 NestJS는 `CatsController`의 라우트를 인식하고, `CatsService`를 자동으로 주입해준다.

**최종 디렉토리 구조:**

```
src/
├── app.module.ts
├── main.ts
└── cats/
    ├── cats.module.ts
    ├── cats.controller.ts
    └── cats.service.ts
```

---

## 8. 모듈 분리와 imports/exports

이번에는 두 개의 모듈이 서로 연결되는 예제를 보자. 핵심은 **exports로 공개하고, imports로 가져오는** 패턴이다.

### 시나리오: UsersModule의 서비스를 OrdersModule에서 사용하고 싶다

```typescript
// users/users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  findOne(id: number) {
    // 사용자 조회 로직
    return { id, name: `User ${id}` };
  }
}
```

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  exports: [UsersService], // ★ 핵심: UsersService를 외부에 공개한다
})
export class UsersModule {}
```

> `exports: [UsersService]`가 없으면 다른 모듈에서 `UsersService`를 절대 사용할 수 없다. 이것이 NestJS의 캡슐화 원칙이다.

```typescript
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrdersService {
  constructor(private readonly usersService: UsersService) {}
  // ↑ UsersModule이 export한 UsersService를 주입받는다

  createOrder(userId: number) {
    const user = this.usersService.findOne(userId);
    return { orderId: 1, user };
  }
}
```

```typescript
// orders/orders.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OrdersService } from './orders.service';

@Module({
  imports: [UsersModule], // ★ 핵심: UsersModule을 import해야 UsersService 사용 가능
  providers: [OrdersService],
})
export class OrdersModule {}
```

> `OrdersModule`이 `UsersModule`을 import했기 때문에, `UsersModule`이 export한 `UsersService`를 `OrdersService`에서 주입받아 사용할 수 있다.

**흐름 정리:**

```
UsersModule                    OrdersModule
┌────────────────────┐         ┌────────────────────┐
│ providers:         │         │ imports:            │
│   [UsersService]   │────────▶│   [UsersModule]     │
│                    │ export  │                     │
│ exports:           │         │ providers:          │
│   [UsersService]   │         │   [OrdersService]   │
└────────────────────┘         └────────────────────┘

UsersService를 export → OrdersModule이 import → OrdersService에서 주입 가능
```

---

## 9. 공유 모듈 예제

여러 모듈에서 공통으로 사용하는 유틸리티 기능이 있다면 **공유 모듈(Shared Module)** 로 만든다. NestJS에서 모듈은 기본적으로 **싱글턴(Singleton)** 이다. 즉, 한 번 생성된 provider 인스턴스는 여러 모듈에서 동일한 인스턴스를 공유한다.

```typescript
// common/common.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // '2026-04-09' 형태
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

```typescript
// common/common.module.ts
import { Module } from '@nestjs/common';
import { CommonService } from './common.service';

@Module({
  providers: [CommonService],
  exports: [CommonService], // 외부에 공개 -> 다른 모듈에서 사용 가능
})
export class CommonModule {}
```

> 이 코드는 날짜 포맷팅, 슬러그 생성 같은 범용 유틸리티를 제공하는 `CommonModule`이다. `exports`에 `CommonService`를 등록했으므로 이 모듈을 import하는 어떤 모듈에서든 사용할 수 있다.

이제 `UsersModule`과 `PostsModule` 양쪽에서 `CommonModule`을 사용해보자.

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [CommonModule], // CommonModule의 CommonService 사용 가능
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

```typescript
// posts/posts.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [CommonModule], // 여기서도 같은 CommonService 인스턴스를 공유한다
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
```

```typescript
// posts/posts.service.ts
import { Injectable } from '@nestjs/common';
import { CommonService } from '../common/common.service';

@Injectable()
export class PostsService {
  constructor(private readonly commonService: CommonService) {}

  createPost(title: string) {
    return {
      title,
      slug: this.commonService.generateSlug(title),       // 공통 기능 사용
      createdAt: this.commonService.formatDate(new Date()), // 공통 기능 사용
    };
  }
}
```

> `UsersModule`과 `PostsModule`이 각각 `CommonModule`을 import했다. 두 모듈에서 주입받는 `CommonService`는 **동일한 인스턴스**다. NestJS의 provider는 기본적으로 싱글턴으로 동작하기 때문이다.

> **팁:** "모듈 재내보내기(Module Re-exporting)"도 가능하다. 모듈 A가 모듈 B를 import한 뒤, 자신의 `exports`에 모듈 B를 추가하면, 모듈 A를 import하는 측에서 모듈 B의 provider도 함께 사용할 수 있다.
> ```typescript
> @Module({
>   imports: [CommonModule],
>   exports: [CommonModule], // CommonModule을 재내보내기
> })
> export class CoreModule {}
> ```

---

# 3단계: 블로그 API 적용

---

## 10. 블로그 프로젝트 모듈 구조 설계

이제 본격적으로 블로그 API의 뼈대를 설계해보자. 블로그에 필요한 기능을 모듈 단위로 나누면 다음과 같다.

### 모듈별 역할

| 모듈 | 역할 | 핵심 기능 |
|------|------|-----------|
| `AppModule` | 루트 모듈. 모든 Feature 모듈을 연결하는 시작점 | 앱 전체 구성 |
| `UsersModule` | 사용자(회원) 관리 | 회원가입, 로그인, 프로필 조회 |
| `PostsModule` | 게시글 관리 | 글 작성, 수정, 삭제, 목록 조회 |
| `CommentsModule` | 댓글 관리 | 댓글 작성, 수정, 삭제 |
| `CommonModule` | 공통 유틸리티 | 날짜 포맷, 슬러그 생성 등 공용 기능 |

### 모듈 간 관계 설계

```
AppModule (루트)
  ├── UsersModule ─────────── imports: [CommonModule]
  ├── PostsModule ─────────── imports: [CommonModule, UsersModule]
  ├── CommentsModule ──────── imports: [CommonModule, UsersModule, PostsModule]
  └── CommonModule ────────── exports: [CommonService] (공유 모듈)
```

**왜 이렇게 나누었을까?**

- `PostsModule`이 `UsersModule`을 import하는 이유: 게시글에는 "누가 작성했는지" 작성자 정보가 필요하므로 `UsersService`를 사용해야 한다.
- `CommentsModule`이 `UsersModule`과 `PostsModule`을 import하는 이유: 댓글에는 "누가 어떤 글에 달았는지" 정보가 필요하다.
- `CommonModule`은 모든 Feature 모듈에서 사용하는 유틸리티를 제공한다.

---

## 11. 모듈 생성하기

### NestJS CLI로 모듈 생성

NestJS CLI를 사용하면 모듈 파일을 자동으로 생성하고, `AppModule`의 `imports`에도 자동 등록해준다.

```bash
# 프로젝트 루트에서 실행
nest g module users
nest g module posts
nest g module comments
nest g module common
```

> **팁:** `nest g module`은 `nest generate module`의 줄임말이다. 이 명령어는 모듈 파일을 생성할 뿐만 아니라, `AppModule`의 `imports`에 자동으로 추가해준다. 직접 파일을 만들어도 되지만 CLI를 사용하면 실수를 줄일 수 있다.

CLI 실행 후 생성되는 파일 구조:

```
src/
├── app.module.ts           # 루트 모듈 (자동으로 imports 업데이트됨)
├── main.ts
├── users/
│   └── users.module.ts
├── posts/
│   └── posts.module.ts
├── comments/
│   └── comments.module.ts
└── common/
    └── common.module.ts
```

### 각 모듈 코드

**AppModule - 루트 모듈**

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    CommonModule,    // 공통 유틸리티
    UsersModule,     // 사용자 관리
    PostsModule,     // 게시글 관리
    CommentsModule,  // 댓글 관리
  ],
})
export class AppModule {}
```

> `AppModule`은 블로그의 "목차" 같은 역할이다. 모든 Feature 모듈을 imports에 등록하여 앱 전체를 조립한다.

**CommonModule - 공유 모듈**

```typescript
// src/common/common.module.ts
import { Module } from '@nestjs/common';
import { CommonService } from './common.service';

@Module({
  providers: [CommonService],
  exports: [CommonService], // 다른 모듈에서 사용할 수 있도록 공개
})
export class CommonModule {}
```

```typescript
// src/common/common.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

> `CommonModule`은 여러 모듈에서 공통으로 사용할 유틸리티를 제공한다. `exports`에 `CommonService`를 등록했으므로, 이 모듈을 import하는 곳이면 어디서든 사용 가능하다.

**UsersModule - 사용자 관리**

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommonModule],       // 공통 유틸리티 사용
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],       // PostsModule, CommentsModule에서 사용할 수 있도록 공개
})
export class UsersModule {}
```

> `UsersModule`은 `UsersService`를 export한다. 게시글이나 댓글에서 작성자 정보를 조회할 때 `UsersService`가 필요하기 때문이다.

**PostsModule - 게시글 관리**

```typescript
// src/posts/posts.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

@Module({
  imports: [
    CommonModule, // 공통 유틸리티 사용
    UsersModule,  // 작성자 정보 조회를 위해 UsersService 사용
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService], // CommentsModule에서 게시글 존재 여부 확인에 사용
})
export class PostsModule {}
```

> `PostsModule`은 `CommonModule`과 `UsersModule`을 import한다. 게시글 생성 시 슬러그를 만들기 위해 `CommonService`가, 작성자 정보를 가져오기 위해 `UsersService`가 필요하다.

**CommentsModule - 댓글 관리**

```typescript
// src/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    CommonModule, // 공통 유틸리티 사용
    UsersModule,  // 댓글 작성자 정보 조회
    PostsModule,  // 댓글이 달린 게시글 정보 조회
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

> `CommentsModule`은 가장 많은 모듈을 import한다. 댓글은 "누가(User) 어떤 글(Post)에 작성했는지"를 알아야 하므로, 사용자 모듈과 게시글 모듈 모두 필요하다.

### 스텁 파일 생성 (컴파일 오류 방지)

위의 모듈 파일들은 컨트롤러와 서비스를 이미 `import`하여 등록하고 있다. 파일이 없으면 서버가 시작되지 않으므로, 챕터 2~3에서 본격적으로 작성하기 전에 **빈 스텁 파일**을 먼저 만들어 두어야 한다.

```typescript
// src/users/users.controller.ts
import { Controller } from '@nestjs/common';

@Controller('users')
export class UsersController {}
```

```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {}
```

```typescript
// src/posts/posts.controller.ts
import { Controller } from '@nestjs/common';

@Controller('posts')
export class PostsController {}
```

```typescript
// src/posts/posts.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class PostsService {}
```

```typescript
// src/comments/comments.controller.ts
import { Controller } from '@nestjs/common';

@Controller('comments')
export class CommentsController {}
```

```typescript
// src/comments/comments.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CommentsService {}
```

> **팁:** NestJS CLI를 사용하면 스텁 파일을 자동으로 생성할 수 있다.
> ```bash
> nest g controller users --no-spec
> nest g service users --no-spec
> nest g controller posts --no-spec
> nest g service posts --no-spec
> nest g controller comments --no-spec
> nest g service comments --no-spec
> ```
> `--no-spec` 옵션을 붙이면 테스트 파일(`.spec.ts`)은 생성하지 않는다. CLI로 생성하면 모듈 파일에도 자동으로 등록되지만, 이미 위에서 직접 등록했으므로 중복 등록 여부를 확인한다.

---

## 12. 완성된 모듈 구조 확인

### 최종 디렉토리 구조

```
src/
├── main.ts
├── app.module.ts              # 루트 모듈
│
├── common/                    # 공통 유틸리티 모듈
│   ├── common.module.ts
│   └── common.service.ts
│
├── users/                     # 사용자 관리 모듈
│   ├── users.module.ts
│   ├── users.controller.ts    # 스텁 (챕터 2에서 라우트 추가)
│   └── users.service.ts       # 스텁 (챕터 3에서 로직 구현)
│
├── posts/                     # 게시글 관리 모듈
│   ├── posts.module.ts
│   ├── posts.controller.ts    # 스텁 (챕터 2에서 라우트 추가)
│   └── posts.service.ts       # 스텁 (챕터 3에서 로직 구현)
│
└── comments/                  # 댓글 관리 모듈
    ├── comments.module.ts
    ├── comments.controller.ts # 스텁 (챕터 2에서 라우트 추가)
    └── comments.service.ts    # 스텁 (챕터 3에서 로직 구현)
```

### 모듈 의존성 전체 다이어그램

```
┌──────────────────────────────────────────────────────────────────┐
│                           AppModule                              │
│                                                                  │
│   imports: [CommonModule, UsersModule, PostsModule,              │
│             CommentsModule]                                      │
└──────┬──────────────┬──────────────┬───────────────┬─────────────┘
       │              │              │               │
       ▼              ▼              ▼               ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐
│ Common     │ │ Users      │ │ Posts      │ │ Comments     │
│ Module     │ │ Module     │ │ Module     │ │ Module       │
│            │ │            │ │            │ │              │
│ exports:   │ │ imports:   │ │ imports:   │ │ imports:     │
│ [Common    │◀│ [Common]   │◀│ [Common,   │ │ [Common,     │
│  Service]  │ │            │ │  Users]    │ │  Users,      │
│            │ │ exports:   │ │            │ │  Posts]      │
│            │ │ [Users     │◀│ exports:   │ │              │
│            │ │  Service]  │ │ [Posts     │◀│              │
│            │ │            │ │  Service]  │ │              │
└────────────┘ └────────────┘ └────────────┘ └──────────────┘

화살표(◀) 방향 = export한 provider를 사용하는 방향
```

### 이 챕터의 성과

이 챕터를 완료하면 블로그 API의 **"뼈대(Skeleton)"** 가 완성된다. 아직 각 모듈의 컨트롤러와 서비스에 실제 로직은 없지만, **모듈 간의 관계와 구조가 확립**되었다.

다음 챕터에서부터 이 뼈대 위에 살을 붙여나간다:

| 다음 단계 | 내용 |
|-----------|------|
| Chapter 2 - Controller | 각 모듈의 컨트롤러에 HTTP 라우트 추가 |
| Chapter 3 - Provider & DI | 각 모듈의 서비스에 비즈니스 로직 구현 |

---

## 프로젝트 구조

```
src/
├── main.ts
├── app.module.ts              ← CommonModule, UsersModule, PostsModule, CommentsModule 등록
├── common/
│   ├── common.module.ts       ← [이번 챕터 추가]
│   └── common.service.ts      ← [이번 챕터 추가]
├── users/
│   ├── users.module.ts        ← [이번 챕터 추가]
│   ├── users.controller.ts    ← 스텁
│   └── users.service.ts       ← 스텁
├── posts/
│   ├── posts.module.ts        ← [이번 챕터 추가]
│   ├── posts.controller.ts    ← 스텁
│   └── posts.service.ts       ← 스텁
└── comments/
    ├── comments.module.ts     ← [이번 챕터 추가]
    ├── comments.controller.ts ← 스텁
    └── comments.service.ts    ← 스텁
```

---

## 정리

| 개념 | 핵심 |
|------|------|
| Module | 관련 기능(컨트롤러 + 서비스)을 하나로 묶는 NestJS의 기본 구성 단위 |
| [@Module()](references/decorators.md#moduleoptions) 4가지 속성 | `imports`(가져오기), `controllers`(컨트롤러), `providers`(서비스), `exports`(공개) |
| 모듈 트리 | AppModule(루트)을 꼭대기로 Feature 모듈들이 연결되는 트리 구조 |
| 공유 모듈 | `exports`로 provider를 공개하여 여러 모듈에서 재사용 |
| 전역 모듈 | [`@Global()`](references/decorators.md#global)로 선언하면 import 없이 어디서든 사용 가능 (남용 주의) |
| 동적 모듈 | `forRoot()` 등으로 설정값을 전달하며 모듈 등록 (이후 챕터에서 상세 학습) |
| 캡슐화 원칙 | provider는 exports에 명시하지 않으면 모듈 외부에서 접근 불가 |
| 모듈 재내보내기 | import한 모듈을 `exports`에 추가하면, 해당 모듈의 provider가 함께 재내보내짐 |
| 순환 의존성 | 두 모듈이 서로를 참조하는 구조. 설계 개선이 우선이며, 불가피할 때 `forwardRef()` 사용 |
---

## 다음 챕터 예고

챕터 2에서는 **Controller**를 학습한다. 각 모듈에 HTTP 라우트를 추가하고, 요청/응답 처리 방법을 익힌다. 블로그 API의 Users, Posts, Comments 컨트롤러를 만들어 CRUD 엔드포인트를 정의한다.

