# 챕터 16 - CQRS

> **이전 챕터 요약**: 챕터 15에서 WebSocket Gateway를 추가하여 댓글 작성 시 실시간 알림이 전송되도록 만들었다. 이번 챕터에서는 **CQRS** 패턴으로 PostsModule을 리팩토링한다. Command와 Query를 분리하여 더 명확한 구조를 만든다.


## 목차

1. [CQRS란?](#cqrs란)
2. [왜 읽기와 쓰기를 분리할까?](#왜-읽기와-쓰기를-분리할까)
3. [Command, Query, Event의 역할](#command-query-event의-역할)
4. [@nestjs/cqrs 패키지 설치 및 핵심 구성요소](#nestjscqrs-패키지-설치-및-핵심-구성요소)
5. [기본 예제: Command + Handler](#기본-예제-command--handler)
6. [기본 예제: Query + Handler](#기본-예제-query--handler)
7. [기본 예제: Event + Handler](#기본-예제-event--handler)
8. [Saga (이벤트 기반 워크플로우)](#saga-이벤트-기반-워크플로우)
9. [실전: 블로그 PostsModule을 CQRS로 리팩토링](#실전-블로그-postsmodule을-cqrs로-리팩토링)

---

## CQRS란?

**CQRS(Command Query Responsibility Segregation)**는 데이터의 **쓰기(Command)**와 **읽기(Query)**를 분리하는 아키텍처 패턴이다.

### 쉬운 비유: 식당의 주문 시스템

일반적인 CRUD는 "한 명의 직원이 주문도 받고, 음식도 서빙하고, 계산도 하는" 구조다. 작은 식당이라면 문제가 없지만, 손님이 많아지면 병목이 생긴다.

CQRS는 이를 분업하는 것과 같다:

- **주문 접수 직원(Command)**: 주문을 받고 주방에 전달한다 (쓰기 담당)
- **서빙 직원(Query)**: 완성된 음식을 손님에게 가져다준다 (읽기 담당)
- **벨 소리(Event)**: "3번 테이블 음식 나왔습니다!" 라고 알려준다 (이벤트 알림)

```
┌──────────────────────────────────────────────────┐
│                    Client                        │
│                                                  │
│        Command(쓰기)       Query(읽기)            │
│             │                  │                  │
│             ▼                  ▼                  │
│      ┌────────────┐    ┌────────────┐            │
│      │ CommandBus  │    │  QueryBus  │            │
│      └─────┬──────┘    └─────┬──────┘            │
│            ▼                  ▼                   │
│    CommandHandler       QueryHandler              │
│            │                  │                   │
│            ▼                  ▼                   │
│      Write Model         Read Model               │
│            │                                      │
│            ▼                                      │
│        EventBus ──▶ EventHandler (후속 작업)       │
└──────────────────────────────────────────────────┘
```

---

## 왜 읽기와 쓰기를 분리할까?

### 문제 상황

전통적인 서비스 클래스를 떠올려 보자:

```typescript
// posts.service.ts - 전통적인 방식
@Injectable()
export class PostsService {
  create(dto) { /* 유효성 검사 + DB 저장 + 이벤트 발행 + 알림... */ }
  findAll() { /* 페이지네이션 + 필터링 + 정렬... */ }
  findOne(id) { /* 캐시 확인 + DB 조회 + 관계 로딩... */ }
  update(id, dto) { /* 권한 확인 + 유효성 검사 + DB 수정 + 로그... */ }
  remove(id) { /* 권한 확인 + 연관 데이터 처리 + DB 삭제 + 로그... */ }
}
```

애플리케이션이 성장하면 이 하나의 서비스 클래스가 점점 비대해진다. 읽기와 쓰기의 요구사항이 서로 다른데 한 곳에 섞여 있으니 관리가 어려워진다.

### CQRS가 해결하는 것

| 장점 | 설명 |
|------|------|
| 관심사 분리 | 읽기와 쓰기의 책임이 명확히 분리되어 유지보수가 쉬워진다 |
| 독립적 확장 | 읽기가 많은 서비스라면 읽기 모델만 스케일링할 수 있다 |
| 테스트 용이성 | 각 핸들러가 독립적이므로 단위 테스트가 간단하다 |
| 이벤트 활용 | Command 후 Event를 발행하여 느슨하게 결합된 후속 작업을 처리한다 |

### 주의할 점

| 단점 | 설명 |
|------|------|
| 복잡도 증가 | 단순한 CRUD에서는 오버 엔지니어링이 될 수 있다 |
| 파일 수 증가 | Command, Query, Handler 등 클래스 파일이 많아진다 |
| 학습 곡선 | 새로운 개념(Command, Query, Event, Saga)을 익혀야 한다 |

> **팁:**: CQRS는 비즈니스 로직이 복잡한 도메인에서 빛을 발한다. 단순한 CRUD API라면 기존 서비스 패턴으로도 충분하다. 이 챕터에서는 학습 목적으로 블로그 게시글 도메인에 적용해 본다.

---

## Command, Query, Event의 역할

CQRS에서 사용하는 세 가지 핵심 개념을 정리한다.

### Command (명령)

- **역할**: 시스템의 상태를 **변경**하는 의도를 표현한다 (생성, 수정, 삭제)
- **이름 규칙**: 동사 + 명사 (예: `CreatePost`, `UpdatePost`, `DeletePost`)
- **특징**: 원칙적으로 값을 반환하지 않지만, NestJS에서는 생성된 ID 등을 반환하기도 한다
- **1:1 관계**: 하나의 Command에는 반드시 하나의 Handler만 매핑된다

### Query (질의)

- **역할**: 시스템의 상태를 **조회**한다 (읽기 전용)
- **이름 규칙**: Get + 명사 (예: `GetPost`, `GetPostList`)
- **특징**: 부수효과(side effect) 없이 데이터만 반환한다
- **1:1 관계**: 하나의 Query에는 반드시 하나의 Handler만 매핑된다

### Event (이벤트)

- **역할**: 시스템에서 **이미 발생한 사건**을 알린다
- **이름 규칙**: 명사 + 과거분사 (예: `PostCreated`, `PostUpdated`)
- **특징**: Command 처리 후 발행되어 후속 작업을 트리거한다
- **1:N 관계**: 하나의 Event에 여러 개의 Handler가 매핑될 수 있다

```
사용자 요청
    │
    ├─ "게시글 만들어줘" ──▶ Command (CreatePostCommand)
    │                            │
    │                            ▼
    │                      CommandHandler
    │                            │
    │                            ▼
    │                    Event (PostCreatedEvent)
    │                         │        │
    │                         ▼        ▼
    │                   로그 기록   알림 발송
    │
    └─ "게시글 보여줘" ──▶ Query (GetPostQuery)
                               │
                               ▼
                         QueryHandler
                               │
                               ▼
                          데이터 반환
```

---

## @nestjs/cqrs 패키지 설치 및 핵심 구성요소

### 설치

```bash
npm install @nestjs/cqrs
```

### 핵심 구성요소 한눈에 보기

| 구성요소 | 역할 | 데코레이터/클래스 |
|----------|------|-------------------|
| `CqrsModule` | CQRS 기능을 활성화하는 모듈 | 모듈의 `imports`에 추가 |
| `CommandBus` | Command를 해당 Handler에 전달하는 버스 | 컨트롤러에서 주입받아 사용 |
| `QueryBus` | Query를 해당 Handler에 전달하는 버스 | 컨트롤러에서 주입받아 사용 |
| `EventBus` | Event를 발행하고 Handler에 전달하는 버스 | Handler에서 주입받아 사용 |
| `@CommandHandler()` | Command를 처리하는 핸들러 표시 | `ICommandHandler` 인터페이스 구현 |
| `@QueryHandler()` | Query를 처리하는 핸들러 표시 | `IQueryHandler` 인터페이스 구현 |
| `@EventsHandler()` | Event를 처리하는 핸들러 표시 | `IEventHandler` 인터페이스 구현 |
| `@Saga()` | 이벤트 스트림을 구독하여 새 Command를 실행 | RxJS Observable 반환 |

### 모듈 설정 기본 구조

```typescript
// example.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [CqrsModule],  // CqrsModule을 import하면 CommandBus, QueryBus, EventBus 사용 가능
  providers: [
    // CommandHandler, QueryHandler, EventHandler를 여기에 등록
  ],
})
export class ExampleModule {}
```

> **팁:**: `CqrsModule`을 import하면 `CommandBus`, `QueryBus`, `EventBus`가 자동으로 DI 컨테이너에 등록된다. 별도의 설정 없이 바로 주입받아 사용할 수 있다.

---

## 기본 예제: Command + Handler

가장 간단한 Command와 Handler를 만들어 보자.

### 1. Command 클래스 정의

Command는 **수행할 작업에 필요한 데이터**를 담는 단순한 클래스다.

```typescript
// commands/impl/say-hello.command.ts
export class SayHelloCommand {
  constructor(public readonly name: string) {}
}
```

### 2. CommandHandler 구현

`@CommandHandler()` 데코레이터로 어떤 Command를 처리할지 지정하고, `ICommandHandler` 인터페이스를 구현한다. 반드시 `execute()` 메서드를 정의해야 한다.

```typescript
// commands/handlers/say-hello.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SayHelloCommand } from '../impl/say-hello.command';

@CommandHandler(SayHelloCommand)
export class SayHelloHandler implements ICommandHandler<SayHelloCommand> {
  async execute(command: SayHelloCommand): Promise<string> {
    console.log(`안녕하세요, ${command.name}님!`);
    return `Hello, ${command.name}`;
  }
}
```

### 3. CommandBus로 실행

컨트롤러에서 `CommandBus`를 주입받아 `execute()`로 Command를 전달한다.

```typescript
// example.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { SayHelloCommand } from './commands/impl/say-hello.command';

@Controller('example')
export class ExampleController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('hello')
  async sayHello(@Body('name') name: string) {
    // CommandBus가 SayHelloCommand에 매핑된 SayHelloHandler를 찾아 execute()를 호출한다
    const result = await this.commandBus.execute(new SayHelloCommand(name));
    return { message: result };
  }
}
```

> **참고:**: `commandBus.execute()`는 Command 클래스 타입을 보고 자동으로 매핑된 Handler를 찾아 실행한다. 하나의 Command에는 반드시 하나의 Handler만 존재해야 한다.

---

## 기본 예제: Query + Handler

Query는 데이터를 **읽기만** 하고 상태를 변경하지 않는다.

### 1. Query 클래스 정의

```typescript
// queries/impl/get-greeting.query.ts
export class GetGreetingQuery {
  constructor(public readonly language: string) {}
}
```

### 2. QueryHandler 구현

`@QueryHandler()` 데코레이터를 사용하고, `IQueryHandler` 인터페이스를 구현한다. Command와 동일하게 `execute()` 메서드를 정의하되, **데이터를 반환**하는 것이 핵심이다.

```typescript
// queries/handlers/get-greeting.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetGreetingQuery } from '../impl/get-greeting.query';

@QueryHandler(GetGreetingQuery)
export class GetGreetingHandler implements IQueryHandler<GetGreetingQuery> {
  private readonly greetings: Record<string, string> = {
    ko: '안녕하세요!',
    en: 'Hello!',
    ja: 'こんにちは!',
  };

  async execute(query: GetGreetingQuery): Promise<string> {
    return this.greetings[query.language] || this.greetings['en'];
  }
}
```

### 3. QueryBus로 실행

```typescript
// example.controller.ts
import { Controller, Get, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetGreetingQuery } from './queries/impl/get-greeting.query';

@Controller('example')
export class ExampleController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('greeting/:lang')
  async getGreeting(@Param('lang') lang: string) {
    const greeting = await this.queryBus.execute(new GetGreetingQuery(lang));
    return { greeting };
  }
}
```

> **Command vs Query 차이 정리**: Command는 "무언가를 변경하라"는 명령이고, Query는 "데이터를 달라"는 요청이다. 두 가지를 섞지 않는 것이 CQRS의 핵심 원칙이다.

---

## 기본 예제: Event + Handler

Event는 "이미 발생한 사건"을 나타내며, **한 이벤트에 여러 핸들러**가 반응할 수 있다.

### 1. Event 클래스 정의

Event 이름은 **과거형**으로 짓는 것이 관례다 (무언가가 "이미 일어났다"는 뜻).

```typescript
// events/impl/user-greeted.event.ts
export class UserGreetedEvent {
  constructor(
    public readonly name: string,
    public readonly timestamp: Date,
  ) {}
}
```

### 2. EventHandler 구현

`@EventsHandler()` 데코레이터를 사용하고, `IEventHandler` 인터페이스를 구현한다. **주의**: Command/Query와 달리 메서드 이름이 `handle()`이다 (`execute()`가 아님).

```typescript
// events/handlers/log-greeting.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserGreetedEvent } from '../impl/user-greeted.event';

@EventsHandler(UserGreetedEvent)
export class LogGreetingHandler implements IEventHandler<UserGreetedEvent> {
  handle(event: UserGreetedEvent) {
    console.log(`[로그] ${event.name}님이 인사했습니다. 시각: ${event.timestamp}`);
  }
}
```

같은 이벤트에 대한 두 번째 핸들러도 등록할 수 있다:

```typescript
// events/handlers/count-greeting.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserGreetedEvent } from '../impl/user-greeted.event';

@EventsHandler(UserGreetedEvent)
export class CountGreetingHandler implements IEventHandler<UserGreetedEvent> {
  private count = 0;

  handle(event: UserGreetedEvent) {
    this.count++;
    console.log(`[통계] 총 인사 횟수: ${this.count}`);
  }
}
```

### 3. EventBus로 이벤트 발행

보통 CommandHandler 내부에서 작업 완료 후 이벤트를 발행한다.

```typescript
// commands/handlers/say-hello.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { SayHelloCommand } from '../impl/say-hello.command';
import { UserGreetedEvent } from '../../events/impl/user-greeted.event';

@CommandHandler(SayHelloCommand)
export class SayHelloHandler implements ICommandHandler<SayHelloCommand> {
  constructor(private readonly eventBus: EventBus) {}

  async execute(command: SayHelloCommand): Promise<string> {
    const result = `Hello, ${command.name}`;

    // 작업 완료 후 이벤트 발행 → LogGreetingHandler와 CountGreetingHandler 둘 다 실행됨
    this.eventBus.publish(new UserGreetedEvent(command.name, new Date()));

    return result;
  }
}
```

> **팁:**: `EventBus.publish()`는 단일 이벤트를, `EventBus.publishAll()`은 이벤트 배열을 한 번에 발행한다.

---

## Saga (이벤트 기반 워크플로우)

Saga는 **이벤트를 구독하여 새로운 Command를 자동 실행**하는 워크플로우다. "A가 일어나면 B를 실행하라"는 규칙을 선언적으로 정의할 수 있다.

### Saga 기본 구조

Saga는 RxJS의 `Observable` 스트림을 사용한다.

```typescript
// sagas/example.saga.ts
import { Injectable } from '@nestjs/common';
import { Saga, ICommand, ofType } from '@nestjs/cqrs';
import { Observable, map } from 'rxjs';
import { UserGreetedEvent } from '../events/impl/user-greeted.event';
import { SendWelcomeEmailCommand } from '../commands/impl/send-welcome-email.command';

@Injectable()
export class ExampleSaga {
  @Saga()
  userGreeted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(UserGreetedEvent),                    // UserGreetedEvent만 필터링
      map((event) => {
        console.log(`[Saga] 인사 이벤트 감지 → 환영 이메일 Command 실행`);
        return new SendWelcomeEmailCommand(event.name);  // 새로운 Command 반환
      }),
    );
  };
}
```

Saga의 핵심 포인트:

- `@Saga()` 데코레이터로 표시한다
- RxJS `Observable`을 반환하며, 각 값은 **새로운 Command**여야 한다
- `ofType()` 연산자로 특정 이벤트만 필터링한다
- 반환된 Command는 자동으로 `CommandBus`를 통해 실행된다
- RxJS 연산자(`delay`, `filter`, `mergeMap` 등)로 복잡한 흐름을 구성할 수 있다

> **팁:**: Saga를 사용하면 "게시글이 생성되면 → 자동으로 검색 인덱스를 업데이트한다" 같은 워크플로우를 이벤트 핸들러가 아닌 별도의 흐름으로 분리할 수 있다. 이벤트 핸들러와의 차이점은 Saga는 반드시 새로운 Command를 반환한다는 것이다.

### Saga vs EventHandler: 언제 어느 것을 써야 할까?

둘 다 이벤트에 반응한다는 점은 같지만, **결과물의 성격**이 다르다.

| 기준 | EventHandler (`@EventsHandler`) | Saga (`@Saga`) |
|------|----------------------------------|----------------|
| 반환값 | 없음 (void) | 새로운 **Command** |
| 주된 용도 | 이벤트 발생을 기록·통지하는 **부수 작업** | 이벤트를 트리거로 **다음 비즈니스 흐름**을 이어가는 것 |
| 전형적인 예 | 로그 기록, 알림 이메일 발송, 통계 갱신 | "게시글 생성 → 검색 인덱스 업데이트 Command 실행" |
| RxJS 필요 여부 | 불필요 | 필수 (`Observable` 반환) |
| 복잡한 흐름 제어 | 어렵다 | `delay`, `filter`, `switchMap` 등 RxJS 연산자 활용 가능 |

**판단 기준 요약**:

- 이벤트에 반응해서 **또 다른 상태 변경(Command)** 이 필요하다면 → **Saga**
- 이벤트에 반응해서 **로그·알림·외부 연동** 처럼 단순히 처리하고 끝난다면 → **EventHandler**

예를 들어 "게시글이 생성되면 작성자에게 이메일을 보낸다"는 요구사항이라면 EventHandler가 적합하다. 반면 "게시글이 생성되면 검색 인덱스 업데이트 Command를 자동으로 실행한다"처럼 후속 Command가 필요하다면 Saga를 선택한다.

---

## 실전: 블로그 PostsModule을 CQRS로 리팩토링

이전 챕터에서 만들어 온 블로그 게시글 도메인을 CQRS 패턴으로 리팩토링한다. 기존의 `PostsService` 한 곳에 모여 있던 로직을 Command, Query, Event로 분리하는 것이 목표다.

> **챕터 10 연결**: 이 섹션은 챕터 10에서 도입한 TypeORM + SQLite 환경을 그대로 이어받는다. 챕터 10에서 정의한 `Post` 엔티티([`@Entity()`](../references/decorators.md#entitytablename) 데코레이터가 붙은 TypeORM 엔티티)와 `TypeOrmModule.forFeature([Post])`로 등록된 Repository를 Handler에서 직접 주입받아 사용한다. 별도의 인메모리 저장소를 만들지 않아도 된다.

### 디렉토리 구조

```
src/posts/
├── commands/
│   ├── impl/
│   │   ├── create-post.command.ts
│   │   ├── update-post.command.ts
│   │   └── delete-post.command.ts
│   └── handlers/
│       ├── create-post.handler.ts
│       ├── update-post.handler.ts
│       └── delete-post.handler.ts
├── queries/
│   ├── impl/
│   │   ├── get-post.query.ts
│   │   └── get-post-list.query.ts
│   └── handlers/
│       ├── get-post.handler.ts
│       └── get-post-list.handler.ts
├── events/
│   ├── impl/
│   │   ├── post-created.event.ts
│   │   ├── post-updated.event.ts
│   │   └── post-deleted.event.ts
│   └── handlers/
│       └── post-events.handler.ts
├── sagas/
│   └── post.saga.ts
├── dto/
│   ├── create-post.dto.ts
│   └── update-post.dto.ts
├── entities/
│   └── post.entity.ts
├── posts.controller.ts
├── posts.module.ts
└── posts.repository.ts
```

> **팁:**: `commands/impl/`과 `commands/handlers/`를 분리하는 것이 NestJS CQRS의 일반적인 관례다. `impl`에는 데이터 클래스(Command, Query, Event)를, `handlers`에는 처리 로직을 배치한다.

### 1. Entity와 Repository

챕터 10에서 만든 TypeORM 엔티티를 그대로 사용한다. 별도의 인메모리 `PostsRepository` 클래스는 더 이상 필요하지 않다. 각 Handler가 TypeORM의 `Repository<Post>`를 직접 주입받아 사용한다.

```typescript
// src/posts/entities/post.entity.ts  (챕터 10에서 작성한 코드 그대로)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column()
  author: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

> **팁:**: [`@CreateDateColumn()`](../references/decorators.md#createdatecolumn-updatedatecolumn-deletedatecolumn)과 [`@UpdateDateColumn()`](../references/decorators.md#createdatecolumn-updatedatecolumn-deletedatecolumn)은 TypeORM이 자동으로 값을 채워준다. 별도로 `new Date()`를 넣을 필요가 없다.

### 2. DTO 정의

```typescript
// src/posts/dto/create-post.dto.ts
export class CreatePostDto {
  title: string;
  content: string;
  author: string;
}
```

```typescript
// src/posts/dto/update-post.dto.ts
export class UpdatePostDto {
  title?: string;
  content?: string;
}
```

### 3. Command 정의

Command는 "무엇을 할 것인가"를 나타내는 데이터 클래스다. DTO와 비슷하게 생겼지만, **의도(intent)**를 명확히 표현한다는 점이 다르다.

```typescript
// src/posts/commands/impl/create-post.command.ts
export class CreatePostCommand {
  constructor(
    public readonly title: string,
    public readonly content: string,
    public readonly author: string,
  ) {}
}
```

```typescript
// src/posts/commands/impl/update-post.command.ts
export class UpdatePostCommand {
  constructor(
    public readonly id: number,
    public readonly title?: string,
    public readonly content?: string,
  ) {}
}
```

```typescript
// src/posts/commands/impl/delete-post.command.ts
export class DeletePostCommand {
  constructor(public readonly id: number) {}
}
```

### 4. Command Handler 구현

각 Command를 실제로 처리하는 로직이다. 기존 `PostsService`의 `create()`, `update()`, `remove()` 메서드가 각각의 Handler로 분리된다.

```typescript
// src/posts/commands/handlers/create-post.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreatePostCommand } from '../impl/create-post.command';
import { PostCreatedEvent } from '../../events/impl/post-created.event';
import { Post } from '../../entities/post.entity';

@CommandHandler(CreatePostCommand)
export class CreatePostHandler implements ICommandHandler<CreatePostCommand> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreatePostCommand): Promise<Post> {
    const { title, content, author } = command;

    // 1. 엔티티 인스턴스 생성 후 DB에 저장
    const post = this.postRepository.create({ title, content, author });
    const savedPost = await this.postRepository.save(post);

    // 2. 게시글 생성 이벤트 발행
    this.eventBus.publish(
      new PostCreatedEvent(savedPost.id, savedPost.title, savedPost.author),
    );

    return savedPost;
  }
}
```

```typescript
// src/posts/commands/handlers/update-post.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { UpdatePostCommand } from '../impl/update-post.command';
import { PostUpdatedEvent } from '../../events/impl/post-updated.event';
import { Post } from '../../entities/post.entity';

@CommandHandler(UpdatePostCommand)
export class UpdatePostHandler implements ICommandHandler<UpdatePostCommand> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: UpdatePostCommand): Promise<Post> {
    const { id, title, content } = command;

    // 1. 존재 여부 확인
    const post = await this.postRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`게시글을 찾을 수 없습니다: ${id}`);
    }

    // 2. 변경 필드만 업데이트 후 저장
    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    const updatedPost = await this.postRepository.save(post);

    // 3. 게시글 수정 이벤트 발행
    this.eventBus.publish(new PostUpdatedEvent(updatedPost.id, updatedPost.title));

    return updatedPost;
  }
}
```

```typescript
// src/posts/commands/handlers/delete-post.handler.ts
import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { DeletePostCommand } from '../impl/delete-post.command';
import { PostDeletedEvent } from '../../events/impl/post-deleted.event';
import { Post } from '../../entities/post.entity';

@CommandHandler(DeletePostCommand)
export class DeletePostHandler implements ICommandHandler<DeletePostCommand> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: DeletePostCommand): Promise<void> {
    const { id } = command;

    // 1. 존재 여부 확인
    const post = await this.postRepository.findOneBy({ id });
    if (!post) {
      throw new NotFoundException(`게시글을 찾을 수 없습니다: ${id}`);
    }

    // 2. DB에서 삭제
    await this.postRepository.remove(post);

    // 3. 게시글 삭제 이벤트 발행
    this.eventBus.publish(new PostDeletedEvent(id, post.title));
  }
}
```

### 5. Query 정의

```typescript
// src/posts/queries/impl/get-post.query.ts
export class GetPostQuery {
  constructor(public readonly id: number) {}
}
```

```typescript
// src/posts/queries/impl/get-post-list.query.ts
export class GetPostListQuery {
  constructor() {}
}
```

### 6. Query Handler 구현

기존 `PostsService`의 `findOne()`, `findAll()` 메서드가 각각의 Handler로 분리된다.

```typescript
// src/posts/queries/handlers/get-post.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { GetPostQuery } from '../impl/get-post.query';
import { Post } from '../../entities/post.entity';

@QueryHandler(GetPostQuery)
export class GetPostHandler implements IQueryHandler<GetPostQuery> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async execute(query: GetPostQuery): Promise<Post> {
    const post = await this.postRepository.findOneBy({ id: query.id });

    if (!post) {
      throw new NotFoundException(`게시글을 찾을 수 없습니다: ${query.id}`);
    }

    return post;
  }
}
```

```typescript
// src/posts/queries/handlers/get-post-list.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GetPostListQuery } from '../impl/get-post-list.query';
import { Post } from '../../entities/post.entity';

@QueryHandler(GetPostListQuery)
export class GetPostListHandler implements IQueryHandler<GetPostListQuery> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async execute(query: GetPostListQuery): Promise<Post[]> {
    // 최신 게시글이 먼저 오도록 정렬
    return this.postRepository.find({
      order: { createdAt: 'DESC' },
    });
  }
}
```

### 7. Event 정의

```typescript
// src/posts/events/impl/post-created.event.ts
export class PostCreatedEvent {
  constructor(
    public readonly postId: number,
    public readonly title: string,
    public readonly author: string,
  ) {}
}
```

```typescript
// src/posts/events/impl/post-updated.event.ts
export class PostUpdatedEvent {
  constructor(
    public readonly postId: number,
    public readonly title: string,
  ) {}
}
```

```typescript
// src/posts/events/impl/post-deleted.event.ts
export class PostDeletedEvent {
  constructor(
    public readonly postId: number,
    public readonly title: string,
  ) {}
}
```

### 8. Event Handler 구현 (로그 기록)

하나의 핸들러 클래스에서 여러 이벤트를 처리할 수도 있고, 이벤트별로 별도의 핸들러를 만들 수도 있다. 여기서는 각 이벤트에 대해 로그를 기록하는 핸들러를 만든다.

```typescript
// src/posts/events/handlers/post-events.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PostCreatedEvent } from '../impl/post-created.event';
import { PostUpdatedEvent } from '../impl/post-updated.event';
import { PostDeletedEvent } from '../impl/post-deleted.event';
import { Logger } from '@nestjs/common';

// 게시글 생성 이벤트 핸들러
@EventsHandler(PostCreatedEvent)
export class PostCreatedHandler implements IEventHandler<PostCreatedEvent> {
  private readonly logger = new Logger('PostEvent');

  handle(event: PostCreatedEvent) {
    this.logger.log(
      `게시글 생성됨 - ID: ${event.postId}, 제목: "${event.title}", 작성자: ${event.author}`,
    );

    // 실제 환경에서는 여기서 다양한 후속 작업을 수행할 수 있다:
    // - 검색 인덱스 업데이트
    // - 구독자에게 알림 발송
    // - 통계 데이터 갱신
  }
}

// 게시글 수정 이벤트 핸들러
@EventsHandler(PostUpdatedEvent)
export class PostUpdatedHandler implements IEventHandler<PostUpdatedEvent> {
  private readonly logger = new Logger('PostEvent');

  handle(event: PostUpdatedEvent) {
    this.logger.log(
      `게시글 수정됨 - ID: ${event.postId}, 제목: "${event.title}"`,
    );
  }
}

// 게시글 삭제 이벤트 핸들러
@EventsHandler(PostDeletedEvent)
export class PostDeletedHandler implements IEventHandler<PostDeletedEvent> {
  private readonly logger = new Logger('PostEvent');

  handle(event: PostDeletedEvent) {
    this.logger.log(
      `게시글 삭제됨 - ID: ${event.postId}, 제목: "${event.title}"`,
    );
  }
}
```

> **팁:**: `@EventsHandler()` 데코레이터에 여러 이벤트 클래스를 전달할 수도 있다. 예를 들어 `@EventsHandler(PostCreatedEvent, PostUpdatedEvent)`처럼 쓰면 두 이벤트 모두를 하나의 핸들러에서 처리한다. 하지만 이벤트별 처리 로직이 다르다면 위처럼 별도 핸들러로 분리하는 것이 명확하다.

### 9. Saga 정의 (이벤트 기반 워크플로우)

게시글이 생성되면 자동으로 검색 인덱스를 업데이트하는 워크플로우를 Saga로 구현한다.

```typescript
// src/posts/commands/impl/index-post.command.ts
export class IndexPostCommand {
  constructor(
    public readonly postId: number,
    public readonly title: string,
  ) {}
}
```

```typescript
// src/posts/commands/handlers/index-post.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IndexPostCommand } from '../impl/index-post.command';
import { Logger } from '@nestjs/common';

@CommandHandler(IndexPostCommand)
export class IndexPostHandler implements ICommandHandler<IndexPostCommand> {
  private readonly logger = new Logger('PostIndex');

  async execute(command: IndexPostCommand): Promise<void> {
    this.logger.log(
      `검색 인덱스 업데이트 - ID: ${command.postId}, 제목: "${command.title}"`,
    );
    // 실제로는 Elasticsearch 등에 인덱싱하는 로직이 들어간다
  }
}
```

```typescript
// src/posts/sagas/post.saga.ts
import { Injectable, Logger } from '@nestjs/common';
import { Saga, ICommand, ofType } from '@nestjs/cqrs';
import { Observable, map } from 'rxjs';
import { PostCreatedEvent } from '../events/impl/post-created.event';
import { IndexPostCommand } from '../commands/impl/index-post.command';

@Injectable()
export class PostSaga {
  private readonly logger = new Logger('PostSaga');

  /**
   * 게시글이 생성되면 → 자동으로 검색 인덱스를 업데이트한다.
   *
   * 흐름: PostCreatedEvent → IndexPostCommand → IndexPostHandler
   */
  @Saga()
  postCreated = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(PostCreatedEvent),
      map((event) => {
        this.logger.log(
          `[Saga] 게시글 생성 감지 → 검색 인덱스 업데이트 Command 실행`,
        );
        return new IndexPostCommand(event.postId, event.title);
      }),
    );
  };
}
```

### 10. Controller (CommandBus/QueryBus 사용)

기존에 `PostsService`를 주입받던 컨트롤러가 이제 `CommandBus`와 `QueryBus`를 주입받는다.

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
  ParseIntPipe,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreatePostCommand } from './commands/impl/create-post.command';
import { UpdatePostCommand } from './commands/impl/update-post.command';
import { DeletePostCommand } from './commands/impl/delete-post.command';
import { GetPostQuery } from './queries/impl/get-post.query';
import { GetPostListQuery } from './queries/impl/get-post-list.query';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // 게시글 생성 → Command
  @Post()
  async create(@Body() dto: CreatePostDto) {
    const post = await this.commandBus.execute(
      new CreatePostCommand(dto.title, dto.content, dto.author),
    );
    return { data: post, message: '게시글이 생성되었습니다.' };
  }

  // 게시글 목록 조회 → Query
  @Get()
  async findAll() {
    const posts = await this.queryBus.execute(new GetPostListQuery());
    return { data: posts };
  }

  // 게시글 단일 조회 → Query
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const post = await this.queryBus.execute(new GetPostQuery(id));
    return { data: post };
  }

  // 게시글 수정 → Command
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePostDto,
  ) {
    const post = await this.commandBus.execute(
      new UpdatePostCommand(id, dto.title, dto.content),
    );
    return { data: post, message: '게시글이 수정되었습니다.' };
  }

  // 게시글 삭제 → Command
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.commandBus.execute(new DeletePostCommand(id));
    return { message: '게시글이 삭제되었습니다.' };
  }
}
```

### 11. Module (전체 조립)

모든 Handler, Saga를 providers에 등록한다. 배열로 그룹화하면 관리가 편하다.

```typescript
// src/posts/posts.module.ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { PostsController } from './posts.controller';

// Command Handlers
import { CreatePostHandler } from './commands/handlers/create-post.handler';
import { UpdatePostHandler } from './commands/handlers/update-post.handler';
import { DeletePostHandler } from './commands/handlers/delete-post.handler';
import { IndexPostHandler } from './commands/handlers/index-post.handler';

// Query Handlers
import { GetPostHandler } from './queries/handlers/get-post.handler';
import { GetPostListHandler } from './queries/handlers/get-post-list.handler';

// Event Handlers
import {
  PostCreatedHandler,
  PostUpdatedHandler,
  PostDeletedHandler,
} from './events/handlers/post-events.handler';

// Sagas
import { PostSaga } from './sagas/post.saga';

const CommandHandlers = [
  CreatePostHandler,
  UpdatePostHandler,
  DeletePostHandler,
  IndexPostHandler,
];
const QueryHandlers = [GetPostHandler, GetPostListHandler];
const EventHandlers = [PostCreatedHandler, PostUpdatedHandler, PostDeletedHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([Post]),  // Repository<Post>를 DI 컨테이너에 등록
  ],
  controllers: [PostsController],
  providers: [
    ...CommandHandlers,
    ...QueryHandlers,
    ...EventHandlers,
    PostSaga,
  ],
})
export class PostsModule {}
```

> **팁:**: `TypeOrmModule.forFeature([Post])`를 imports에 추가하면 [`@InjectRepository(Post)`](../references/decorators.md#injecttoken)로 `Repository<Post>`를 주입받을 수 있게 된다. 별도의 커스텀 `PostsRepository` 클래스를 providers에 등록할 필요가 없다.

### 전체 실행 흐름

게시글 생성 시 전체 흐름을 따라가 보자:

```
1. POST /posts 요청 (title, content, author)
   │
   ▼
2. PostsController.create()
   │  - CommandBus.execute(new CreatePostCommand(...))
   │
   ▼
3. CreatePostHandler.execute()
   │  - postRepository.save()            ← TypeORM DB 저장
   │  - EventBus.publish(PostCreatedEvent) ← 이벤트 발행
   │
   ▼ (동시에 두 갈래로 진행)
   │
   ├──▶ 4a. PostCreatedHandler.handle()  ← 이벤트 핸들러: 로그 기록
   │
   └──▶ 4b. PostSaga.postCreated()       ← Saga: IndexPostCommand 반환
              │
              ▼
        5. IndexPostHandler.execute()    ← 검색 인덱스 업데이트
```

### 기존 방식과 CQRS 방식 비교

| 구분 | 기존 (Service 패턴) | CQRS 패턴 |
|------|---------------------|-----------|
| 컨트롤러 의존성 | `PostsService` 1개 | `CommandBus` + `QueryBus` |
| 쓰기 로직 | `service.create()` | `CreatePostCommand` → `CreatePostHandler` |
| 읽기 로직 | `service.findAll()` | `GetPostListQuery` → `GetPostListHandler` |
| 후속 작업 | Service 내에서 직접 호출 | Event 발행 → EventHandler 또는 Saga |
| 파일 수 | 적음 (Service 1개) | 많음 (Command, Handler, Event 등) |
| 결합도 | 높음 | 낮음 (이벤트 기반 느슨한 결합) |
| 적합한 경우 | 간단한 CRUD | 복잡한 비즈니스 로직, 이벤트 기반 처리 |

---

## Event Sourcing과 CQRS의 차이

CQRS를 공부하다 보면 **Event Sourcing**이라는 용어가 자주 함께 등장한다. 둘은 궁합이 잘 맞아 함께 쓰이는 경우가 많지만, **별개의 독립적인 개념**이다.

**CQRS**는 읽기(Query)와 쓰기(Command)의 책임을 분리하는 아키텍처 패턴이다. DB에 현재 상태를 저장하는 방식은 그대로 유지한다. 즉, `post` 테이블에는 게시글의 최신 상태만 남는다.

**Event Sourcing**은 상태 자체를 저장하지 않고, 상태 변화를 일으킨 **이벤트의 이력(event log)을 전부 저장**하는 패턴이다. 현재 상태가 필요하면 처음부터 모든 이벤트를 순서대로 재생(replay)해 재구성한다. "게시글이 생성됨 → 제목이 수정됨 → 삭제됨" 같은 전체 이력이 DB에 그대로 남는다.

| 구분 | CQRS | Event Sourcing |
|------|------|----------------|
| 핵심 목표 | 읽기/쓰기 책임 분리 | 상태 변화 이력 전체 보존 |
| DB에 저장되는 것 | 현재 상태 | 이벤트 이력 (event log) |
| 함께 사용해야 하나? | 아니다, 독립적으로 사용 가능 | CQRS와 함께 쓰면 시너지가 좋다 |
| 복잡도 | 중간 | 높음 |

이 챕터에서 구현한 코드는 **순수 CQRS**다. TypeORM Repository에 현재 상태를 저장하며, Event Sourcing을 도입하지 않는다. Event Sourcing은 금융·감사 로그처럼 변경 이력 자체가 중요한 도메인에서 주로 고려한다.

---

## 정리

이 챕터에서 배운 내용을 정리한다:

| 개념 | 설명 |
|------|------|
| **CQRS** | 읽기(Query)와 쓰기(Command)를 분리하는 아키텍처 패턴 |
| **Command** | 시스템 상태를 변경하는 의도를 나타내는 객체 |
| **Query** | 시스템 상태를 조회하는 의도를 나타내는 객체 |
| **Event** | 시스템에서 이미 발생한 사건을 나타내는 객체 |
| **CommandBus** | Command를 해당 Handler에 전달하는 메시지 버스 |
| **QueryBus** | Query를 해당 Handler에 전달하는 메시지 버스 |
| **EventBus** | Event를 발행하고 Handler에 전달하는 메시지 버스 |
| **Saga** | 이벤트를 구독하여 새로운 Command를 자동 실행하는 워크플로우 |

이 챕터를 마치면 블로그 게시글 도메인이 CQRS 패턴으로 구조화된다. 기존에 `PostsService` 하나에 모여 있던 비즈니스 로직이 Command, Query, Event로 명확하게 분리되었고, 이벤트를 통해 후속 작업(로그 기록, 검색 인덱스 업데이트 등)이 느슨하게 결합되었다.
---

## 다음 챕터 예고

챕터 17에서는 **Microservices**를 학습한다. 댓글 작성 시 알림을 보내는 기능을 별도의 알림 마이크로서비스로 분리한다. TCP 기반 통신과 하이브리드 앱 구성을 익히며, 전체 블로그 프로젝트를 완성한다.

