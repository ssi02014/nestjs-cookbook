# 챕터 3 - Provider와 의존성 주입(DI)

> **이전 챕터 요약**: 챕터 1에서 모듈로 앱을 구조화하고, 챕터 2에서 컨트롤러로 HTTP 요청을 받는 법을 배웠다. 하지만 컨트롤러 안에 비즈니스 로직을 직접 넣으면 코드가 비대해지고 테스트도 어렵다. 이번 챕터에서 **비즈니스 로직을 Service(Provider)로 분리**하고, NestJS의 **의존성 주입(DI)** 시스템을 배운다.

>
> **이 챕터를 마치면**: 블로그 API의 User, Post, Comment에 대한 메모리 기반 CRUD가 모두 동작한다. curl로 회원가입, 게시글 작성, 댓글 달기를 직접 테스트할 수 있다.

## 목차

### 1단계: 개념 학습
1. [Provider란 무엇인가](#1-provider란-무엇인가)
2. [의존성 주입(DI)이란?](#2-의존성-주입di이란)
3. [@Injectable() 데코레이터](#3-injectable-데코레이터)
4. [생성자 주입 방식](#4-생성자-주입-방식)
5. [속성 기반 주입](#5-속성-기반-주입-property-based-injection)
6. [커스텀 프로바이더](#6-커스텀-프로바이더)
7. [프로바이더 스코프](#7-프로바이더-스코프)
8. [@Optional()과 forwardRef()](#8-optional과-forwardref)

### 2단계: 기본 예제
9. [기본 예제 (CatsService)](#9-기본-예제-catsservice)

### 3단계: 블로그 API 적용
10. [UsersService / Controller / Module](#10-usersservice--controller--module)
11. [PostsService / Controller / Module](#11-postsservice--controller--module)
12. [CommentsService / Controller / Module](#12-commentsservice--controller--module)
13. [AppModule 조립](#13-appmodule-조립)
14. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
15. [정리](#정리)
16. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

## 1. Provider란 무엇인가

NestJS에서 **Provider**는 NestJS의 IoC(Inversion of Control) 컨테이너가 관리하는 클래스를 말한다. 쉽게 말해, NestJS가 대신 만들어주고 필요한 곳에 넣어주는 객체다.

대부분의 NestJS 클래스가 Provider가 될 수 있다.

| 종류 | 역할 | 예시 |
|------|------|------|
| **Service** | 비즈니스 로직 담당 | `UsersService`, `PostsService` |
| **Repository** | 데이터 접근 추상화 | `UserRepository` |
| **Factory** | 객체 생성 로직 | `DatabaseConnectionFactory` |
| **Helper** | 공통 유틸리티 | `HashHelper`, `DateHelper` |

> **참고:** Controller는 "요청을 받고 응답을 보내는 것"에만 집중하고, 실제 로직은 Provider(주로 Service)에 맡긴다. 이것이 **관심사의 분리(Separation of Concerns)** 원칙이다.

---

## 2. 의존성 주입(DI)이란?

### 직접 new를 쓰면 생기는 문제

"의존성 주입"이라는 말이 어렵게 느껴질 수 있다. 먼저 DI가 **없을 때** 어떤 문제가 있는지 보자.

```typescript
// di-없는-예시.ts - 이렇게 하면 안 된다!
class CatsController {
  private catsService: CatsService;

  constructor() {
    // 직접 인스턴스를 생성 - 강한 결합(tight coupling)
    this.catsService = new CatsService();
  }
}
```

이 방식의 문제점:

1. **강한 결합**: `CatsController`가 `CatsService`의 구체적인 생성 방법을 알아야 한다
2. **테스트 어려움**: 테스트할 때 가짜(Mock) 서비스로 바꿔치기하기 힘들다
3. **중복 인스턴스**: 여러 곳에서 `new CatsService()`를 하면 각각 다른 인스턴스가 생긴다

### DI를 사용하면

```typescript
// di-사용-예시.ts - 이렇게 해야 한다!
class CatsController {
  // NestJS가 알아서 CatsService 인스턴스를 만들어 넣어준다
  constructor(private readonly catsService: CatsService) {}
}
```

**DI(Dependency Injection)** 란, 객체가 필요한 의존성을 **직접 만들지 않고 외부에서 받는** 패턴이다. NestJS에서는 프레임워크가 이 일을 자동으로 해준다.

### IoC(Inversion of Control) 컨테이너

NestJS 내부에는 **IoC 컨테이너**라는 것이 있다. 이것이 DI를 실행하는 주체다.

```
[IoC 컨테이너가 하는 일]

1. 모듈의 providers 배열을 보고 Provider 목록을 파악한다
2. 각 Provider가 생성자에서 무엇을 필요로 하는지 분석한다
3. 필요한 의존성을 먼저 만들고, 그 다음 해당 Provider를 만든다
4. 기본적으로 싱글톤이므로, 한 번 만든 인스턴스를 여러 곳에서 재사용한다
```

> **비유**: 식당에 비유하면, IoC 컨테이너는 "주방장"이다. 셰프(Controller)가 "토마토 소스 줘"라고 하면, 주방장(IoC 컨테이너)이 이미 만들어둔 토마토 소스(Service 인스턴스)를 건네준다. 셰프가 직접 토마토를 씻고 끓일 필요가 없다.

### DI의 장점 정리

| 장점 | 설명 |
|------|------|
| **느슨한 결합** | 구현체가 아닌 추상에 의존하므로 교체가 쉽다 |
| **테스트 용이** | Mock 객체를 쉽게 주입할 수 있다 |
| **인스턴스 관리** | 싱글톤으로 메모리를 효율적으로 사용한다 |
| **유지보수성** | 의존성 변경 시 한 곳만 수정하면 된다 |

---

## 3. [@Injectable()](references/decorators.md#injectableoptions) 데코레이터

클래스를 Provider로 만들려면 [`@Injectable()`](references/decorators.md#injectableoptions) 데코레이터를 붙인다. 이 데코레이터가 있어야 NestJS IoC 컨테이너가 해당 클래스를 인식하고 관리할 수 있다.

```typescript
// cats.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()  // "이 클래스는 NestJS가 관리하는 Provider입니다"
export class CatsService {
  private readonly cats: string[] = [];

  findAll(): string[] {
    return this.cats;
  }

  create(cat: string): void {
    this.cats.push(cat);
  }
}
```

[`@Injectable()`](references/decorators.md#injectableoptions)을 붙인 뒤에는 반드시 **모듈의 `providers` 배열에 등록**해야 한다.

```typescript
// cats.module.ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],  // 여기에 등록해야 DI가 동작한다
})
export class CatsModule {}
```

> **팁:** `providers: [CatsService]`는 사실 아래의 축약형이다.
> ```typescript
> providers: [
>   {
>     provide: CatsService,   // 토큰 (이 이름으로 찾는다)
>     useClass: CatsService,  // 실제 사용할 클래스
>   }
> ]
> ```
> 토큰과 클래스가 같을 때 축약할 수 있다. 이 개념은 커스텀 프로바이더에서 중요해진다.

---

## 4. 생성자 주입 방식

NestJS에서 가장 권장되는 의존성 주입 방법은 **생성자 주입(Constructor Injection)** 이다. 생성자 매개변수의 타입을 보고 NestJS가 알맞은 Provider 인스턴스를 자동으로 넣어준다.

```typescript
// cats.controller.ts
import { Controller, Get, Post, Body } from '@nestjs/common';
import { CatsService } from './cats.service';

@Controller('cats')
export class CatsController {
  // TypeScript의 "private readonly" 단축 구문으로 선언 + 할당을 동시에 한다
  constructor(private readonly catsService: CatsService) {}

  @Get()
  findAll(): string[] {
    return this.catsService.findAll();
  }

  @Post()
  create(@Body('name') name: string): void {
    this.catsService.create(name);
  }
}
```

### @Inject()를 사용한 토큰 기반 주입

클래스가 아닌 문자열이나 심볼을 토큰으로 사용해 주입할 수도 있다. 주로 커스텀 프로바이더와 함께 쓴다.

```typescript
// app.controller.ts
import { Controller, Inject } from '@nestjs/common';

@Controller()
export class AppController {
  constructor(
    @Inject('API_KEY') private readonly apiKey: string,
  ) {}
}
```

---

## 5. 속성 기반 주입 (Property-based Injection)

생성자 주입 외에, 클래스 **프로퍼티(필드)** 에 직접 [`@Inject()`](references/decorators.md#injecttoken)를 붙이는 **속성 기반 주입**도 가능하다.

```typescript
// src/cats/cats.service.ts
import { Injectable, Inject, Optional } from '@nestjs/common';

@Injectable()
export class CatsService {
  @Inject('API_KEY')
  private readonly apiKey: string;

  findAll() {
    console.log('API Key:', this.apiKey);
  }
}
```

> **주의:** 속성 기반 주입은 최상위 클래스가 다른 클래스를 `extends`할 때 생성자 체이닝이 복잡해지는 경우에만 고려하자. NestJS 공식 문서는 **생성자 주입을 권장**한다. 생성자 주입은 의존성이 명확히 드러나고, 테스트 시 Mock 주입이 더 쉽기 때문이다.

---

## 6. 커스텀 프로바이더

단순히 클래스를 등록하는 것 외에, NestJS는 4가지 방식으로 Provider를 정의할 수 있다.

### useValue - 정적 값 주입

이미 만들어진 값(상수, 설정, Mock 객체 등)을 Provider로 등록한다.

```typescript
// app.module.ts
@Module({
  providers: [
    // 문자열 값을 Provider로 등록
    {
      provide: 'API_KEY',
      useValue: 'my-secret-api-key-1234',
    },
    // 객체를 Provider로 등록
    {
      provide: 'CONFIG',
      useValue: {
        database: { host: 'localhost', port: 5432 },
      },
    },
  ],
})
export class AppModule {}
```

> **팁:** `useValue`는 **테스트에서 Mock 객체를 주입**할 때 특히 유용하다. 실제 서비스 대신 가짜 객체를 넣어 테스트를 격리할 수 있다.
> ```typescript
> // 테스트에서 Mock으로 대체하는 예
> {
>   provide: CatsService,
>   useValue: {
>     findAll: () => ['test-cat'],
>     create: jest.fn(),
>   },
> }
> ```

### useClass - 조건부 클래스 주입

조건에 따라 **다른 클래스**를 주입한다. 환경별로 다른 구현체를 쓸 때 유용하다.

```typescript
// config.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get(key: string): string {
    return process.env[key] ?? '';
  }
}

@Injectable()
export class DevConfigService {
  get(key: string): string {
    const devConfig: Record<string, string> = {
      DATABASE_HOST: 'localhost',
      DATABASE_PORT: '5432',
    };
    return devConfig[key] ?? '';
  }
}
```

```typescript
// app.module.ts
@Module({
  providers: [
    {
      provide: ConfigService,  // 토큰: ConfigService
      useClass:
        process.env.NODE_ENV === 'development'
          ? DevConfigService   // 개발환경이면 DevConfigService 사용
          : ConfigService,     // 그 외에는 ConfigService 사용
    },
  ],
})
export class AppModule {}
```

### useFactory - 동적 생성

팩토리 함수로 Provider를 생성한다. **다른 Provider를 주입받아** 활용할 수 있고, **비동기(async)도 지원**한다.

```typescript
// database.module.ts
@Module({
  providers: [
    ConfigService,
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: (configService: ConfigService) => {
        const host = configService.get('DATABASE_HOST');
        const port = configService.get('DATABASE_PORT');
        return createConnection({ host, port });
      },
      inject: [ConfigService],  // 팩토리 함수에 주입할 Provider 목록
    },
  ],
})
export class DatabaseModule {}
```

```typescript
// 비동기 팩토리도 가능하다
{
  provide: 'ASYNC_CONNECTION',
  useFactory: async (configService: ConfigService) => {
    const connection = await createConnection({
      host: configService.get('DATABASE_HOST'),
    });
    await connection.initialize();
    return connection;
  },
  inject: [ConfigService],
}
```

> **팁:** `useFactory`의 `inject` 배열 순서와 팩토리 함수의 매개변수 순서가 **일치해야** 한다.

### useExisting - 별칭(Alias) 만들기

이미 존재하는 Provider에 다른 이름(토큰)을 부여한다. **새 인스턴스를 만들지 않고** 기존 것을 참조한다.

```typescript
// logger.module.ts
@Module({
  providers: [
    LoggerService,
    {
      provide: 'AliasedLogger',
      useExisting: LoggerService,  // 새 인스턴스 X, 기존 LoggerService 참조
    },
  ],
  exports: [LoggerService, 'AliasedLogger'],
})
export class LoggerModule {}
```

> **useExisting vs useClass**: `useClass`는 **새 인스턴스를 생성**하고, `useExisting`은 **기존 인스턴스를 재사용**한다. 이 차이를 꼭 기억하자.

### 커스텀 프로바이더 요약

| 방식 | 언제 쓰나 | 새 인스턴스 생성? |
|------|-----------|-----------------|
| `useValue` | 상수, 설정값, Mock 객체 | 해당 없음 (값 자체를 사용) |
| `useClass` | 환경별 다른 클래스 주입 | O (매번 새로 생성) |
| `useFactory` | 동적 생성, 비동기 초기화 | O (팩토리가 생성) |
| `useExisting` | 기존 Provider의 별칭 | X (기존 것 재사용) |

---

## 7. 프로바이더 스코프

NestJS Provider는 기본적으로 **싱글톤**이다. 앱이 시작될 때 인스턴스가 하나 만들어지고, 앱이 종료될 때까지 재사용된다. 하지만 필요에 따라 스코프를 변경할 수 있다.

| 스코프 | 설명 | 인스턴스 수 |
|--------|------|------------|
| `DEFAULT` | 싱글톤. 앱 전체에서 하나 | 1개 |
| `REQUEST` | HTTP 요청마다 새로 생성 | 요청 수만큼 |
| `TRANSIENT` | 주입받는 곳마다 새로 생성 | 주입 횟수만큼 |

### DEFAULT (기본값 - 싱글톤)

```typescript
// 아래 두 가지는 동일하다. 명시하지 않으면 DEFAULT다.
@Injectable()
export class CatsService {}

@Injectable({ scope: Scope.DEFAULT })
export class CatsService {}
```

### REQUEST 스코프

각 HTTP 요청마다 새 인스턴스가 만들어진다. 요청별로 다른 상태를 가져야 할 때 사용한다.

```typescript
// request-scope.service.ts
import { Injectable, Scope, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class RequestScopedService {
  constructor(@Inject(REQUEST) private readonly request: Request) {}

  getRequestId() {
    return this.request.headers['x-request-id'];
  }
}
```

> **주의:** REQUEST 스코프 Provider를 주입받는 Provider도 **자동으로 REQUEST 스코프가 된다**. 이는 성능에 영향을 주므로 꼭 필요할 때만 사용하자. 대부분의 경우 DEFAULT(싱글톤)로 충분하다.

### TRANSIENT 스코프

주입받는 곳마다 별도의 인스턴스가 생성된다.

```typescript
// transient.service.ts
import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class TransientService {
  private id = Math.random();
  getId() { return this.id; }
}

// ServiceA와 ServiceB가 각각 TransientService를 주입받으면
// 서로 다른 인스턴스를 가진다 (id 값이 다르다)
```

> **팁:** 초보 단계에서는 **DEFAULT(싱글톤) 스코프만 사용**하면 된다. REQUEST와 TRANSIENT는 특수한 상황에서만 필요하다.

---

## 8. @Optional()과 forwardRef()

### [@Optional()](references/decorators.md#optional) - 선택적 의존성

Provider가 등록되어 있지 않아도 에러가 나지 않게 하려면 [`@Optional()`](references/decorators.md#optional) 데코레이터를 사용한다. 등록되지 않은 경우 `undefined`가 주입된다.

```typescript
// notification.service.ts
import { Injectable, Optional, Inject } from '@nestjs/common';

@Injectable()
export class NotificationService {
  constructor(
    @Optional()
    @Inject('MAILER')
    private readonly mailer?: { send: (msg: string) => void },
  ) {}

  notify(message: string): void {
    if (this.mailer) {
      this.mailer.send(message);
    } else {
      console.log(`[콘솔 알림] ${message}`);
    }
  }
}
```

> **팁:** [`@Optional()`](references/decorators.md#optional)은 플러그인 시스템이나 환경에 따라 있을 수도 없을 수도 있는 서비스에 유용하다.

### forwardRef() - 순환 의존성 해결

두 클래스가 서로를 의존하는 **순환 의존성(Circular Dependency)** 이 발생할 수 있다. 이때 `forwardRef()`로 해결한다.

```
CatsService -> DogsService -> CatsService (순환!)
```

```typescript
// cats.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { DogsService } from './dogs.service';

@Injectable()
export class CatsService {
  constructor(
    @Inject(forwardRef(() => DogsService))
    private readonly dogsService: DogsService,
  ) {}
}
```

```typescript
// dogs.service.ts
import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { CatsService } from './cats.service';

@Injectable()
export class DogsService {
  constructor(
    @Inject(forwardRef(() => CatsService))
    private readonly catsService: CatsService,
  ) {}
}
```

모듈 수준에서도 순환 의존성이 발생할 수 있으며, 동일하게 `forwardRef()`를 사용한다.

```typescript
// cats.module.ts
@Module({
  imports: [forwardRef(() => DogsModule)],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
```

> **권장사항**: 순환 의존성은 대부분 **설계에 문제가 있다는 신호**다. `forwardRef()`는 임시방편이며, 가능하면 공통 모듈을 추출하거나 구조를 개선하여 순환을 제거하는 것이 좋다.

---

# 2단계: 기본 예제 (CatsService)

## 9. 기본 예제 (CatsService)

개념을 실제 코드로 확인해보자. 메모리 배열로 CRUD를 수행하는 `CatsService`를 만들고, `CatsController`에 주입한다.

### 인터페이스와 DTO 정의

```typescript
// cats/interfaces/cat.interface.ts
export interface Cat {
  id: number;
  name: string;
  age: number;
  breed: string;
}
```

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
  readonly name?: string;
  readonly age?: number;
  readonly breed?: string;
}
```

### CatsService 구현

```typescript
// cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Cat } from './interfaces/cat.interface';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';

@Injectable()
export class CatsService {
  private cats: Cat[] = [];
  private nextId = 1;

  create(dto: CreateCatDto): Cat {
    const cat: Cat = {
      id: this.nextId++,
      ...dto,
    };
    this.cats.push(cat);
    return cat;
  }

  findAll(): Cat[] {
    return this.cats;
  }

  findOne(id: number): Cat {
    const cat = this.cats.find((c) => c.id === id);
    if (!cat) {
      throw new NotFoundException(`Cat #${id}을(를) 찾을 수 없습니다`);
    }
    return cat;
  }

  update(id: number, dto: UpdateCatDto): Cat {
    const cat = this.findOne(id);  // 없으면 NotFoundException 발생
    const updated = { ...cat, ...dto };
    this.cats = this.cats.map((c) => (c.id === id ? updated : c));
    return updated;
  }

  remove(id: number): void {
    this.findOne(id);  // 존재 확인
    this.cats = this.cats.filter((c) => c.id !== id);
  }
}
```

### CatsController에서 Service 주입

```typescript
// cats/cats.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';
import { Cat } from './interfaces/cat.interface';

@Controller('cats')
export class CatsController {
  // 생성자 주입: NestJS가 CatsService 인스턴스를 자동으로 넣어준다
  constructor(private readonly catsService: CatsService) {}

  @Post()
  create(@Body() dto: CreateCatDto): Cat {
    return this.catsService.create(dto);
  }

  @Get()
  findAll(): Cat[] {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Cat {
    return this.catsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatDto,
  ): Cat {
    return this.catsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.catsService.remove(id);
  }
}
```

### 모듈 등록

```typescript
// cats/cats.module.ts
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [CatsService],  // Provider 등록 = DI 시스템에 등록
})
export class CatsModule {}
```

### 커스텀 프로바이더 예제

위 CatsModule에 커스텀 프로바이더를 추가해보자.

```typescript
// cats/cats.module.ts - 커스텀 프로바이더 버전
import { Module } from '@nestjs/common';
import { CatsController } from './cats.controller';
import { CatsService } from './cats.service';

@Module({
  controllers: [CatsController],
  providers: [
    CatsService,

    // useValue: 초기 데이터를 주입
    {
      provide: 'INITIAL_CATS',
      useValue: ['Kitty', 'Nabi', 'Momo'],
    },

    // useFactory: 환경별 로거 생성
    {
      provide: 'LOGGER',
      useFactory: () => {
        const isDev = process.env.NODE_ENV !== 'production';
        return {
          log: (msg: string) =>
            console.log(`[${isDev ? 'DEV' : 'PROD'}] ${msg}`),
        };
      },
    },
  ],
})
export class CatsModule {}
```

```typescript
// cats/cats.service.ts - 커스텀 프로바이더를 주입받는 버전
import { Injectable, Inject, Optional } from '@nestjs/common';

@Injectable()
export class CatsService {
  constructor(
    @Optional()
    @Inject('LOGGER')
    private readonly logger?: { log: (msg: string) => void },
  ) {}

  create(dto: CreateCatDto): Cat {
    const cat = { id: this.nextId++, ...dto };
    this.cats.push(cat);
    this.logger?.log(`Cat 생성: ${cat.name} (ID: ${cat.id})`);
    return cat;
  }

  // ... 나머지 메서드
}
```

---

# 3단계: 블로그 API 적용

이제 진짜 블로그 API를 만들자! User, Post, Comment 세 도메인의 인터페이스를 정의하고, 각각 Service와 Controller를 만든다.

---

## 10. UsersService / Controller / Module

### 인터페이스 & DTO 정의 (Users)

```typescript
// users/interfaces/user.interface.ts
export interface User {
  id: number;
  email: string;
  name: string;
  createdAt: string;
}
```

```typescript
// users/dto/create-user.dto.ts
export class CreateUserDto {
  readonly email: string;
  readonly name: string;
}
```

```typescript
// users/dto/update-user.dto.ts
export class UpdateUserDto {
  readonly email?: string;
  readonly name?: string;
}
```

### UsersService

```typescript
// users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CommonService } from '../common/common.service';
import { User } from './interfaces/user.interface';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private users: User[] = [];
  private nextId = 1;

  constructor(private readonly commonService: CommonService) {}

  /** 회원가입 */
  create(dto: CreateUserDto): User {
    // 이메일 중복 검사
    const existing = this.users.find((u) => u.email === dto.email);
    if (existing) {
      throw new ConflictException(`이미 사용 중인 이메일입니다: ${dto.email}`);
    }

    const user: User = {
      id: this.nextId++,
      email: dto.email,
      name: dto.name,
      createdAt: this.commonService.formatDate(new Date()),
    };
    this.users.push(user);
    return user;
  }

  /** 전체 사용자 조회 */
  findAll(): User[] {
    return this.users;
  }

  /** ID로 사용자 조회 */
  findOne(id: number): User {
    const user = this.users.find((u) => u.id === id);
    if (!user) {
      throw new NotFoundException(`사용자를 찾을 수 없습니다 (ID: ${id})`);
    }
    return user;
  }

  /** 사용자 정보 수정 */
  update(id: number, dto: UpdateUserDto): User {
    const user = this.findOne(id);

    // 이메일 변경 시 중복 검사
    if (dto.email) {
      const existing = this.users.find(
        (u) => u.email === dto.email && u.id !== id,
      );
      if (existing) {
        throw new ConflictException(`이미 사용 중인 이메일입니다: ${dto.email}`);
      }
    }

    const updated = { ...user, ...dto };
    this.users = this.users.map((u) => (u.id === id ? updated : u));
    return updated;
  }

  /** 사용자 삭제 */
  remove(id: number): void {
    this.findOne(id);  // 존재하지 않으면 NotFoundException
    this.users = this.users.filter((u) => u.id !== id);
  }
}
```

### UsersController

```typescript
// users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './interfaces/user.interface';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** POST /users - 회원가입 */
  @Post()
  create(@Body() dto: CreateUserDto): User {
    return this.usersService.create(dto);
  }

  /** GET /users - 전체 사용자 조회 */
  @Get()
  findAll(): User[] {
    return this.usersService.findAll();
  }

  /** GET /users/:id - 사용자 상세 조회 */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): User {
    return this.usersService.findOne(id);
  }

  /** PUT /users/:id - 사용자 정보 수정 */
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ): User {
    return this.usersService.update(id, dto);
  }

  /** DELETE /users/:id - 사용자 삭제 */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.usersService.remove(id);
  }
}
```

### UsersModule

```typescript
// users/users.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [CommonModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // PostsModule, CommentsModule에서 사용자 존재 확인에 필요
})
export class UsersModule {}
```

---

## 11. PostsService / Controller / Module

### 인터페이스 & DTO 정의 (Posts)

```typescript
// posts/interfaces/post.interface.ts
export interface Post {
  id: number;
  title: string;
  content: string;
  authorId: number;       // User.id 참조
  createdAt: string;
  updatedAt: string;
}
```

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

### PostsService

```typescript
// posts/posts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonService } from '../common/common.service';
import { UsersService } from '../users/users.service';
import { Post } from './interfaces/post.interface';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  private posts: Post[] = [];
  private nextId = 1;

  // UsersService와 CommonService를 모두 주입받는다
  constructor(
    private readonly usersService: UsersService,
    private readonly commonService: CommonService,
  ) {}

  /** 게시글 작성 */
  create(dto: CreatePostDto): Post {
    // 작성자가 존재하는지 확인 (없으면 NotFoundException 발생)
    this.usersService.findOne(dto.authorId);

    const now = this.commonService.formatDate(new Date());
    const post: Post = {
      id: this.nextId++,
      title: dto.title,
      content: dto.content,
      authorId: dto.authorId,
      createdAt: now,
      updatedAt: now,
    };
    this.posts.push(post);
    return post;
  }

  /** 게시글 목록 조회 */
  findAll(): Post[] {
    return this.posts;
  }

  /** 게시글 상세 조회 */
  findOne(id: number): Post {
    const post = this.posts.find((p) => p.id === id);
    if (!post) {
      throw new NotFoundException(`게시글을 찾을 수 없습니다 (ID: ${id})`);
    }
    return post;
  }

  /** 게시글 수정 */
  update(id: number, dto: UpdatePostDto): Post {
    const post = this.findOne(id);
    const updated: Post = {
      ...post,
      ...dto,
      updatedAt: this.commonService.formatDate(new Date()),
    };
    this.posts = this.posts.map((p) => (p.id === id ? updated : p));
    return updated;
  }

  /** 게시글 삭제 */
  remove(id: number): void {
    this.findOne(id);
    this.posts = this.posts.filter((p) => p.id !== id);
  }
}
```

> **포인트**: `PostsService`의 생성자에서 `UsersService`와 `CommonService`를 주입받는다. 이것이 **Service 간 의존성 주입**이다. `UsersService`는 게시글 작성 시 작성자 존재 여부를 확인하기 위해, `CommonService`는 날짜 포맷을 위해 사용한다.

### PostsController

```typescript
// posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post as BlogPost } from './interfaces/post.interface';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /** POST /posts - 게시글 작성 */
  @Post()
  create(@Body() dto: CreatePostDto): BlogPost {
    return this.postsService.create(dto);
  }

  /** GET /posts - 게시글 목록 */
  @Get()
  findAll(): BlogPost[] {
    return this.postsService.findAll();
  }

  /** GET /posts/:id - 게시글 상세 */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): BlogPost {
    return this.postsService.findOne(id);
  }

  /** PATCH /posts/:id - 게시글 수정 */
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ): BlogPost {
    return this.postsService.update(id, dto);
  }

  /** DELETE /posts/:id - 게시글 삭제 */
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.postsService.remove(id);
  }
}
```

> **팁:** `Post`라는 이름이 NestJS의 [`@Post()`](references/decorators.md#http-메서드-데코레이터) 데코레이터와 겹치므로, 인터페이스를 `import { Post as BlogPost }`로 별칭을 주었다. 실제 프로젝트에서는 인터페이스명을 `BlogPost`나 `PostEntity`로 짓는 것도 좋은 방법이다.

### PostsModule

```typescript
// posts/posts.module.ts
import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { CommonModule } from '../common/common.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [CommonModule, UsersModule],  // CommonService(날짜 포맷) + UsersService(작성자 검증)
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],  // CommentsModule에서 게시글 존재 확인에 필요
})
export class PostsModule {}
```

> **주의:** `PostsService`가 `UsersService`와 `CommonService`를 주입받으려면:
> 1. `UsersModule`에서 `UsersService`를 `exports`에 등록해야 하고
> 2. `CommonModule`에서 `CommonService`를 `exports`에 등록해야 하며
> 3. `PostsModule`에서 두 모듈 모두 `imports`에 넣어야 한다
>
> 이것이 챕터 1에서 배운 **모듈 간 의존성** 개념이다.

---

## 12. CommentsService / Controller / Module

### 인터페이스 & DTO 정의 (Comments)

```typescript
// comments/interfaces/comment.interface.ts
export interface Comment {
  id: number;
  content: string;
  authorId: number;       // User.id 참조
  postId: number;         // Post.id 참조
  createdAt: string;
}
```

```typescript
// comments/dto/create-comment.dto.ts
export class CreateCommentDto {
  readonly content: string;
  readonly authorId: number;
}
```

### CommentsService

```typescript
// comments/comments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CommonService } from '../common/common.service';
import { UsersService } from '../users/users.service';
import { PostsService } from '../posts/posts.service';
import { Comment } from './interfaces/comment.interface';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  private comments: Comment[] = [];
  private nextId = 1;

  // CommonService, UsersService, PostsService를 모두 주입받는다
  constructor(
    private readonly commonService: CommonService,
    private readonly usersService: UsersService,
    private readonly postsService: PostsService,
  ) {}

  /** 댓글 작성 */
  create(postId: number, dto: CreateCommentDto): Comment {
    // 게시글이 존재하는지 확인
    this.postsService.findOne(postId);
    // 작성자가 존재하는지 확인
    this.usersService.findOne(dto.authorId);

    const comment: Comment = {
      id: this.nextId++,
      content: dto.content,
      authorId: dto.authorId,
      postId,
      createdAt: this.commonService.formatDate(new Date()),
    };
    this.comments.push(comment);
    return comment;
  }

  /** 특정 게시글의 댓글 목록 조회 */
  findByPostId(postId: number): Comment[] {
    // 게시글이 존재하는지 확인
    this.postsService.findOne(postId);
    return this.comments.filter((c) => c.postId === postId);
  }

  /** 댓글 삭제 */
  remove(id: number): void {
    const comment = this.comments.find((c) => c.id === id);
    if (!comment) {
      throw new NotFoundException(`댓글을 찾을 수 없습니다 (ID: ${id})`);
    }
    this.comments = this.comments.filter((c) => c.id !== id);
  }
}
```

### CommentsController

```typescript
// comments/comments.controller.ts
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
import { Comment } from './interfaces/comment.interface';

@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  /** POST /posts/:postId/comments - 댓글 작성 */
  @Post('posts/:postId/comments')
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() dto: CreateCommentDto,
  ): Comment {
    return this.commentsService.create(postId, dto);
  }

  /** GET /posts/:postId/comments - 댓글 목록 */
  @Get('posts/:postId/comments')
  findByPostId(
    @Param('postId', ParseIntPipe) postId: number,
  ): Comment[] {
    return this.commentsService.findByPostId(postId);
  }

  /** DELETE /comments/:id - 댓글 삭제 */
  @Delete('comments/:id')
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.commentsService.remove(id);
  }
}
```

> **팁:** `CommentsController`는 [`@Controller()`](references/decorators.md#controllerprefix) 데코레이터에 접두사를 비워두었다. 댓글 API는 `/posts/:postId/comments` (댓글 작성/조회)와 `/comments/:id` (댓글 삭제) 두 가지 경로를 사용하기 때문이다.

### CommentsModule

```typescript
// comments/comments.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { UsersModule } from '../users/users.module';
import { PostsModule } from '../posts/posts.module';

@Module({
  imports: [CommonModule, UsersModule, PostsModule],  // 세 모듈 모두 import
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

---

## 13. AppModule 조립

모든 Feature 모듈을 루트 모듈에 연결한다.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [CommonModule, UsersModule, PostsModule, CommentsModule],
})
export class AppModule {}
```

### 의존성 관계도

```
┌───────────────────────────────────────────────────────────┐
│                        AppModule                          │
│                                                           │
│  imports: [CommonModule, UsersModule,                     │
│            PostsModule, CommentsModule]                   │
└──┬───────────────┬──────────────┬──────────────┬──────────┘
   │               │              │              │
   ▼               ▼              ▼              ▼
┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌──────────────┐
│ CommonModule │ │UsersModule │ │ PostsModule │ │CommentsModule│
│              │ │            │ │             │ │              │
│ exports:     │ │ exports:   │ │ imports:    │ │ imports:     │
│ [Common      │◀│ [Users     │◀│ [Common     │ │ [UsersModule,│
│  Service]    │ │  Service]  │ │  Module,    │ │  PostsModule]│
│              │ │            │ │  UsersModule│ │              │
│ (formatDate) │ │ Controller │ │  ]          │ │ Controller   │
│              │ │  ↓ 주입     │ │             │ │  ↓ 주입       │
└──────────────┘ │ Service    │ │ exports:    │ │ Service      │
                 └────────────┘ │ [Posts      │◀│  (Users +    │
                                │  Service]   │ │   Posts 주입) │
                                │             │ └──────────────┘
                                │ Controller  │
                                │  ↓ 주입      │
                                │ Service     │
                                │  (Users +   │
                                │   Common주입 │
                                └─────────────┘
```

**의존성 흐름 요약**:
- `CommonModule` -> 독립적, `CommonService`를 export (슬러그 생성, 날짜 포맷)
- `UsersModule` -> `CommonModule` import, `UsersService`를 export
- `PostsModule` -> `CommonModule` + `UsersModule` import (날짜 포맷 + 작성자 검증)
- `CommentsModule` -> `CommonModule` + `UsersModule` + `PostsModule` import

### curl로 테스트하기

앱을 실행한 뒤(`npm run start:dev`), 아래 순서대로 테스트한다.

### 1. 회원가입

```bash
# 사용자 생성
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "hong@example.com", "name": "홍길동"}'

# 응답 예시:
# {"id":1,"email":"hong@example.com","name":"홍길동","createdAt":"2026-04-09T..."}
```

```bash
# 두 번째 사용자
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "kim@example.com", "name": "김철수"}'
```

### 2. 사용자 조회

```bash
# 전체 조회
curl http://localhost:3000/users

# 단건 조회
curl http://localhost:3000/users/1
```

### 3. 게시글 작성

```bash
# 게시글 작성 (authorId: 1번 사용자)
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "첫 번째 게시글", "content": "NestJS Provider를 배웠습니다!", "authorId": 1}'

# 응답 예시:
# {"id":1,"title":"첫 번째 게시글","content":"NestJS Provider를 배웠습니다!","authorId":1,"createdAt":"...","updatedAt":"..."}
```

```bash
# 존재하지 않는 사용자로 게시글 작성 시도 -> 404 에러
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트", "content": "내용", "authorId": 999}'

# {"statusCode":404,"message":"사용자를 찾을 수 없습니다 (ID: 999)"}
```

### 4. 게시글 조회/수정/삭제

```bash
# 목록 조회
curl http://localhost:3000/posts

# 상세 조회
curl http://localhost:3000/posts/1

# 수정 (PATCH)
curl -X PATCH http://localhost:3000/posts/1 \
  -H "Content-Type: application/json" \
  -d '{"title": "수정된 제목"}'

# 삭제
curl -X DELETE http://localhost:3000/posts/1
```

### 5. 댓글 작성/조회/삭제

```bash
# 게시글에 댓글 작성
curl -X POST http://localhost:3000/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "좋은 글이네요!", "authorId": 2}'

# 게시글의 댓글 목록 조회
curl http://localhost:3000/posts/1/comments

# 댓글 삭제
curl -X DELETE http://localhost:3000/comments/1
```

> **팁:** 위 curl 명령어를 순서대로 실행하면 블로그 API의 전체 흐름을 체험할 수 있다. 먼저 사용자를 만들고, 그 사용자로 게시글을 쓰고, 다른 사용자가 댓글을 다는 시나리오다.

---

## 프로젝트 구조

```
src/
├── app.module.ts
├── main.ts
├── common/
│   ├── common.module.ts            ← 공통 모듈 (챕터 1에서 정의)
│   └── common.service.ts           ← 공통 유틸리티 서비스
├── users/
│   ├── interfaces/
│   │   └── user.interface.ts       ← User 타입 정의
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   └── update-user.dto.ts
│   ├── users.service.ts            ← 사용자 CRUD 로직
│   ├── users.controller.ts         ← 사용자 API 엔드포인트
│   └── users.module.ts
├── posts/
│   ├── interfaces/
│   │   └── post.interface.ts       ← Post 타입 정의
│   ├── dto/
│   │   ├── create-post.dto.ts
│   │   └── update-post.dto.ts
│   ├── posts.service.ts            ← 게시글 CRUD 로직
│   ├── posts.controller.ts         ← 게시글 API 엔드포인트
│   └── posts.module.ts
└── comments/
    ├── interfaces/
    │   └── comment.interface.ts    ← Comment 타입 정의
    ├── dto/
    │   └── create-comment.dto.ts
    ├── comments.service.ts         ← 댓글 CRUD 로직
    ├── comments.controller.ts      ← 댓글 API 엔드포인트
    └── comments.module.ts
```

---

## 정리

| 개념 | 핵심 |
|------|------|
| **Provider** | [`@Injectable()`](references/decorators.md#injectableoptions)로 선언, 모듈의 `providers`에 등록하면 NestJS가 관리 |
| **DI** | 생성자에 타입만 적으면 NestJS가 인스턴스를 자동 주입 |
| **IoC 컨테이너** | Provider 등록, 의존성 해석, 인스턴스 생성/캐싱을 담당 |
| **useValue** | 정적 값, 설정, Mock 객체 주입 |
| **useClass** | 조건별 클래스 교체 (전략 패턴) |
| **useFactory** | 동적 생성, 비동기, 다른 Provider 주입 가능 |
| **useExisting** | 기존 Provider의 별칭 (인스턴스 재사용) |
| **스코프** | DEFAULT(싱글톤), REQUEST(요청별), TRANSIENT(주입별) |
| **@Optional()** | 없어도 에러 안 나게 (undefined 주입) |
| **forwardRef()** | 순환 의존성 해결 (설계 개선 권장) |
| **속성 기반 주입** | 프로퍼티에 `@Inject()`를 붙여 직접 주입. 생성자 체이닝이 복잡할 때만 사용 |

## 이 챕터에서 만든 것

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/users` | POST | 회원가입 |
| `/users` | GET | 전체 사용자 조회 |
| `/users/:id` | GET | 사용자 상세 조회 |
| `/users/:id` | PUT | 사용자 정보 수정 |
| `/users/:id` | DELETE | 사용자 삭제 |
| `/posts` | POST | 게시글 작성 |
| `/posts` | GET | 게시글 목록 |
| `/posts/:id` | GET | 게시글 상세 |
| `/posts/:id` | PATCH | 게시글 수정 |
| `/posts/:id` | DELETE | 게시글 삭제 |
| `/posts/:postId/comments` | POST | 댓글 작성 |
| `/posts/:postId/comments` | GET | 댓글 목록 |
| `/comments/:id` | DELETE | 댓글 삭제 |

## 다음 챕터 예고

> **챕터 4 - Middleware**: 모든 요청에 로깅을 추가하여 어떤 요청이 들어오는지 기록한다. Express의 미들웨어와 비슷하지만 NestJS만의 방식이 있다.
