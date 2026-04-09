# 챕터 13 - Testing (테스트)

> **이전 챕터 요약**: 챕터 12에서 Passport.js + JWT로 실전 인증 시스템을 완성했다. 로그인, 토큰 발급/갱신/무효화, 작성자 권한 검증까지 구현했다. 이번 챕터에서는 지금까지 만든 코드에 **테스트**를 작성하여 안정성을 높인다.


## 목차

### 1단계: 개념 학습
1. [왜 테스트를 작성하는가?](#1-왜-테스트를-작성하는가)
2. [단위 테스트 vs 통합 테스트 vs E2E 테스트](#2-단위-테스트-vs-통합-테스트-vs-e2e-테스트)
3. [Jest 기초](#3-jest-기초)
4. [NestJS의 Test.createTestingModule](#4-nestjs의-testcreatetestingmodule)
5. [모킹이란?](#5-모킹이란)

### 2단계: 기본 예제
6. [기본 예제: Service 단위 테스트](#6-기본-예제-service-단위-테스트)
7. [비동기 테스트 심화](#7-비동기-테스트-심화)
8. [기본 예제: Controller 단위 테스트](#8-기본-예제-controller-단위-테스트)
9. [기본 예제: E2E 테스트 (supertest)](#9-기본-예제-e2e-테스트-supertest)
10. [통합 테스트 (Integration Test)](#10-통합-테스트-integration-test)

### 3단계: 블로그 API 적용
11. [블로그 API: PostsService 단위 테스트](#11-블로그-api-postsservice-단위-테스트)
12. [블로그 API: AuthService 단위 테스트](#12-블로그-api-authservice-단위-테스트)
13. [블로그 API: PostsController 단위 테스트](#13-블로그-api-postscontroller-단위-테스트)
14. [블로그 API: E2E 테스트 전체 플로우](#14-블로그-api-e2e-테스트-전체-플로우)
15. [Guard, Interceptor, Pipe 테스트](#15-guard-interceptor-pipe-테스트)
16. [테스트 커버리지 설정](#16-테스트-커버리지-설정)
17. [테스트 실행 명령어 정리](#17-테스트-실행-명령어-정리)
18. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
19. [정리](#정리)
20. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---

## 1. 왜 테스트를 작성하는가?

처음 테스트를 접하면 "기능 코드 작성도 바쁜데 왜 테스트까지 써야 하지?"라고 생각할 수 있다. 하지만 프로젝트가 조금만 커지면, 테스트 없이는 다음과 같은 문제에 직면한다.

### 테스트가 없을 때 생기는 일

1. **A를 고쳤더니 B가 깨진다** - 한 곳을 수정했는데 전혀 관련 없어 보이는 기능이 망가진다. 직접 화면을 하나하나 클릭해서 확인하기 전까지 알 수 없다.
2. **리팩토링이 무섭다** - 코드 구조를 개선하고 싶지만 "혹시 뭔가 깨지면 어쩌지?" 하는 두려움에 그냥 둔다.
3. **새 팀원이 코드를 이해하기 어렵다** - 이 함수가 어떤 입력을 받아서 어떤 결과를 내야 하는지, 테스트 코드가 가장 좋은 명세서다.
4. **배포할 때마다 불안하다** - "이번에 배포하면 에러 안 나겠지?"를 기도로 대신한다.

### 테스트가 있을 때

- `npm run test` 한 번이면 핵심 로직이 정상인지 몇 초 만에 확인된다.
- 자신감 있게 코드를 수정하고 리팩토링할 수 있다.
- 테스트 코드 자체가 "이 함수는 이렇게 동작해야 한다"는 살아있는 문서가 된다.

> **팁:** 모든 코드에 100% 테스트를 작성할 필요는 없다. 핵심 비즈니스 로직(서비스 레이어), 에러가 자주 발생하는 부분, 복잡한 조건 분기를 우선적으로 테스트하는 것이 현실적이다.

---

## 2. 단위 테스트 vs 통합 테스트 vs E2E 테스트

테스트는 검증 범위에 따라 세 가지로 나뉜다.

| 구분 | 범위 | 속도 | 의존성 | 파일명 규칙 |
|------|------|------|--------|-------------|
| 단위 테스트 (Unit) | 개별 클래스/함수 | 빠름 | 모킹 | `*.spec.ts` |
| 통합 테스트 (Integration) | 복수 컴포넌트 결합 | 보통 | 부분 모킹 or 실제 DB | `*.spec.ts` |
| E2E 테스트 (End-to-End) | 전체 HTTP 요청 흐름 | 느림 | 실제 앱 인스턴스 | `*.e2e-spec.ts` |

### 단위 테스트 (Unit Test)

하나의 클래스(Service, Controller 등)를 **독립적으로** 테스트한다. 외부 의존성(DB, 다른 Service)은 모두 가짜(Mock)로 대체한다.

```
PostsService 단위 테스트:
  - PostsRepository → 가짜 객체로 대체
  - 테스트 대상: PostsService의 비즈니스 로직만
```

### 통합 테스트 (Integration Test)

여러 컴포넌트가 **함께 동작**하는 것을 테스트한다. 예를 들어, Service와 실제 DB(인메모리 SQLite)를 연결하여 데이터가 정상적으로 저장/조회되는지 검증한다.

```
PostsService 통합 테스트:
  - PostsRepository → 실제 인메모리 DB 사용
  - 테스트 대상: Service + Repository가 함께 동작하는지
```

### E2E 테스트 (End-to-End Test)

클라이언트 입장에서 실제 HTTP 요청을 보내어 **전체 요청-응답 흐름**을 테스트한다. 미들웨어, Pipe, Guard, Interceptor 등이 모두 동작하는 상태에서 검증한다.

```
POST /auth/login 요청 → Guard 통과 → Controller → Service → DB → 응답
이 전체 흐름이 정상 동작하는지 검증
```

> **팁:** 테스트 피라미드라는 개념이 있다. 단위 테스트를 가장 많이, 통합 테스트를 적당히, E2E 테스트를 가장 적게 작성하는 것이 일반적인 전략이다. 단위 테스트는 빠르고 안정적이며, E2E 테스트는 느리고 깨지기 쉽기 때문이다.

---

## 3. Jest 기초

NestJS는 프로젝트 생성 시 **Jest**가 기본 테스트 프레임워크로 포함되어 있다. 테스트를 작성하기 전에 Jest의 핵심 문법을 알아두자.

### describe, it, expect

```typescript
// 간단한 Jest 예시 (순수 함수 테스트)

// 테스트 대상 함수
function add(a: number, b: number): number {
  return a + b;
}

// describe: 테스트 그룹을 묶는다
describe('add 함수', () => {

  // it (또는 test): 개별 테스트 케이스를 정의한다
  it('1 + 2는 3을 반환한다', () => {
    // expect: 실제 결과를 검증한다
    expect(add(1, 2)).toBe(3);
  });

  it('음수끼리의 합을 올바르게 계산한다', () => {
    expect(add(-1, -2)).toBe(-3);
  });

  it('0을 더하면 원래 값을 반환한다', () => {
    expect(add(5, 0)).toBe(5);
  });
});
```

### beforeEach, afterEach

매 테스트 실행 전후에 반복되는 작업(초기화, 정리 등)을 처리한다.

```typescript
describe('Counter', () => {
  let count: number;

  // 각 테스트 실행 전에 호출된다
  beforeEach(() => {
    count = 0; // 매 테스트마다 0으로 초기화
  });

  it('1을 더하면 1이 된다', () => {
    count += 1;
    expect(count).toBe(1);
  });

  it('이전 테스트의 영향을 받지 않는다 (여전히 0에서 시작)', () => {
    expect(count).toBe(0); // beforeEach 덕분에 0으로 초기화된 상태
  });
});
```

### 자주 쓰는 Matcher (검증 함수)

| Matcher | 설명 | 예시 |
|---------|------|------|
| `toBe(value)` | 원시 값 일치 (===) | `expect(1 + 1).toBe(2)` |
| `toEqual(value)` | 객체/배열 깊은 비교 | `expect({a: 1}).toEqual({a: 1})` |
| `toBeDefined()` | undefined가 아닌지 | `expect(service).toBeDefined()` |
| `toBeNull()` | null인지 | `expect(result).toBeNull()` |
| `toBeTruthy()` | truthy 값인지 | `expect('hello').toBeTruthy()` |
| `toContain(item)` | 배열에 포함되는지 | `expect([1,2,3]).toContain(2)` |
| `toThrow()` | 예외를 던지는지 | `expect(() => fn()).toThrow()` |
| `toHaveBeenCalled()` | 함수가 호출되었는지 | `expect(mockFn).toHaveBeenCalled()` |
| `toHaveBeenCalledWith(args)` | 특정 인자로 호출되었는지 | `expect(mockFn).toHaveBeenCalledWith(1)` |

### Jest 설정 파일

NestJS CLI 프로젝트의 `package.json`에 이미 Jest 설정이 포함되어 있다.

```json
// package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

E2E 테스트는 별도 설정 파일을 사용한다.

```json
// test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

---

## 4. NestJS의 Test.createTestingModule

NestJS 테스트의 핵심은 `@nestjs/testing` 패키지의 `Test.createTestingModule()`이다. 이 메서드는 실제 NestJS 모듈과 동일한 구조를 가진 **테스트 전용 모듈**을 만들어준다.

### 왜 테스트 전용 모듈이 필요한가?

NestJS에서 Service나 Controller는 DI(의존성 주입) 시스템을 통해 동작한다. 테스트에서도 이 DI 시스템을 그대로 활용하되, 외부 의존성(DB, 외부 API 등)만 가짜로 교체하기 위해 테스트 모듈을 사용한다.

### 기본 사용법

```typescript
// posts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(async () => {
    // 1. 테스트 모듈을 생성한다 (@Module과 동일한 메타데이터)
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        // 의존성을 여기서 등록 (실제 또는 Mock)
      ],
    }).compile(); // 2. 모듈을 컴파일한다

    // 3. 모듈에서 테스트 대상 인스턴스를 꺼낸다
    service = module.get<PostsService>(PostsService);
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });
});
```

### 주요 메서드

| 메서드 | 설명 |
|--------|------|
| `Test.createTestingModule(metadata)` | 테스트용 모듈 생성. [`@Module()`](references/decorators.md#moduleoptions) 데코레이터와 동일한 메타데이터를 받는다 |
| `.compile()` | 모듈을 컴파일하고 `TestingModule` 인스턴스를 반환한다 |
| `module.get<T>(token)` | 모듈에 등록된 프로바이더를 토큰으로 조회한다 |
| `module.createNestApplication()` | E2E 테스트를 위한 NestJS 앱 인스턴스를 생성한다 |

### overrideProvider로 프로바이더 교체

기존 모듈을 통째로 가져온 뒤, 특정 프로바이더만 Mock으로 교체할 수 있다.

```typescript
// posts.service.spec.ts
const module: TestingModule = await Test.createTestingModule({
  imports: [PostsModule], // 실제 모듈을 import
})
  .overrideProvider(PostsRepository) // 이 프로바이더만 교체
  .useValue(mockPostsRepository)     // 가짜 객체로 대체
  .compile();
```

---

## 5. 모킹이란?

**모킹(Mocking)** 은 테스트에서 외부 의존성을 가짜 객체로 대체하는 기법이다. 초보자가 가장 헷갈리는 개념이지만, 이유를 이해하면 간단하다.

### 왜 가짜 객체를 쓰는가?

`PostsService`의 단위 테스트를 작성한다고 하자. PostsService는 `Repository`(DB 접근)에 의존한다.

```
PostsService → Repository → 실제 데이터베이스
```

만약 테스트에서 실제 DB를 사용하면:

- 테스트할 때마다 DB에 연결해야 해서 **느리다**
- DB 상태에 따라 테스트 결과가 달라져서 **불안정하다**
- DB 설정이 없는 CI 환경에서 **실행이 안 된다**
- PostsService 로직에 문제가 있는 건지, DB에 문제가 있는 건지 **원인 파악이 어렵다**

그래서 Repository를 "가짜"로 만든다:

```
PostsService → Mock Repository (가짜) → DB 연결 없음
```

### Jest의 jest.fn()

`jest.fn()`은 "호출 기록을 추적하는 가짜 함수"를 만든다.

```typescript
// 가짜 함수 생성
const mockSave = jest.fn();

// 반환값을 지정할 수 있다
mockSave.mockResolvedValue({ id: 1, title: '테스트 게시글' });

// 함수를 호출한다
const result = await mockSave({ title: '테스트 게시글' });

// 검증: 함수가 호출되었는가?
expect(mockSave).toHaveBeenCalled();

// 검증: 어떤 인자로 호출되었는가?
expect(mockSave).toHaveBeenCalledWith({ title: '테스트 게시글' });

// 검증: 반환값이 올바른가?
expect(result).toEqual({ id: 1, title: '테스트 게시글' });
```

### Mock 객체 만들기

Repository처럼 여러 메서드를 가진 객체를 통째로 가짜로 만든다.

```typescript
// Mock Repository 생성
const mockPostsRepository = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

// 사용 예: findOne이 호출되면 이 값을 반환하도록 지정
mockPostsRepository.findOne.mockResolvedValue({
  id: 1,
  title: '첫 번째 게시글',
  content: '내용입니다',
});
```

> **팁:** `jest.fn()`의 핵심은 두 가지다. (1) 반환값을 내가 원하는 대로 지정할 수 있다. (2) 호출 여부와 인자를 나중에 검증할 수 있다. 이 두 가지만 기억하면 모킹이 쉬워진다.

---

# 2단계: 기본 예제

---

## 6. 기본 예제: Service 단위 테스트

본격적인 블로그 API 테스트에 앞서, 간단한 Service 단위 테스트의 전체 흐름을 살펴보자.

### 테스트 대상 Service

```typescript
// src/items/items.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './entities/item.entity';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemsRepository: Repository<Item>,
  ) {}

  async findAll(): Promise<Item[]> {
    return this.itemsRepository.find();
  }

  async findOne(id: number): Promise<Item> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException(`Item #${id}을 찾을 수 없습니다.`);
    }
    return item;
  }

  async create(name: string): Promise<Item> {
    const item = this.itemsRepository.create({ name });
    return this.itemsRepository.save(item);
  }
}
```

### 단위 테스트

```typescript
// src/items/items.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ItemsService } from './items.service';
import { Item } from './entities/item.entity';

// Mock Repository 타입 정의 (재사용 가능)
type MockRepository<T = any> = Partial<Record<keyof import('typeorm').Repository<T>, jest.Mock>>;

const createMockRepository = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('ItemsService', () => {
  let service: ItemsService;
  let repository: MockRepository<Item>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          // getRepositoryToken(Item) → TypeORM이 Item Repository를 주입할 때 쓰는 토큰
          provide: getRepositoryToken(Item),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    repository = module.get<MockRepository<Item>>(getRepositoryToken(Item));
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('모든 아이템을 반환한다', async () => {
      const items = [{ id: 1, name: '아이템1' }, { id: 2, name: '아이템2' }];
      repository.find.mockResolvedValue(items);

      const result = await service.findAll();

      expect(result).toEqual(items);
      expect(repository.find).toHaveBeenCalledTimes(1);
    });
  });

  describe('findOne', () => {
    it('ID에 해당하는 아이템을 반환한다', async () => {
      const item = { id: 1, name: '아이템1' };
      repository.findOne.mockResolvedValue(item);

      const result = await service.findOne(1);

      expect(result).toEqual(item);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('존재하지 않으면 NotFoundException을 던진다', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('새 아이템을 생성하고 반환한다', async () => {
      const newItem = { id: 1, name: '새 아이템' };
      repository.create.mockReturnValue(newItem);
      repository.save.mockResolvedValue(newItem);

      const result = await service.create('새 아이템');

      expect(repository.create).toHaveBeenCalledWith({ name: '새 아이템' });
      expect(repository.save).toHaveBeenCalledWith(newItem);
      expect(result).toEqual(newItem);
    });
  });
});
```

> **팁:** `getRepositoryToken(Entity)`는 `@nestjs/typeorm`에서 제공하는 유틸 함수다. [`@InjectRepository(Entity)`](references/decorators.md#injectrepositoryentity)로 주입되는 Repository의 DI 토큰을 가져와, 테스트에서 해당 토큰에 Mock 객체를 연결할 수 있게 해준다.

---

## 7. 비동기 테스트 심화

async/await를 활용한 비동기 로직 테스트, 예외 검증, 타이머 모킹 등 실무에서 자주 마주치는 패턴을 다룬다.

### async/await를 사용하는 Service 테스트

비동기 함수를 테스트할 때는 `async/await`를 반드시 사용해야 한다. `await`를 빠뜨리면 Promise가 실행되기 전에 테스트가 끝나버려 항상 통과하는 것처럼 보이는 오탐(False Positive)이 발생한다.

```typescript
// src/notifications/notifications.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';

// 테스트 대상 Service 예시
// async sendWelcomeEmail(userId: number): Promise<{ sent: boolean; to: string }>
// async getUserNotifications(userId: number): Promise<Notification[]>

describe('NotificationsService (async/await)', () => {
  let service: NotificationsService;

  const mockMailer = {
    sendMail: jest.fn(),
  };

  const mockNotificationRepository = {
    find: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: 'MAILER', useValue: mockMailer },
        { provide: 'NOTIFICATION_REPOSITORY', useValue: mockNotificationRepository },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendWelcomeEmail', () => {
    it('메일 발송 성공 시 sent: true를 반환한다', async () => {
      // Mock 반환값 설정
      mockMailer.sendMail.mockResolvedValue({ messageId: 'abc123' });

      // async/await로 결과를 기다린다
      const result = await service.sendWelcomeEmail(1);

      expect(result.sent).toBe(true);
      expect(mockMailer.sendMail).toHaveBeenCalledTimes(1);
    });

    it('여러 비동기 작업이 순서대로 실행됨을 검증한다', async () => {
      const callOrder: string[] = [];

      mockMailer.sendMail.mockImplementation(async () => {
        callOrder.push('sendMail');
        return { messageId: 'abc' };
      });
      mockNotificationRepository.save.mockImplementation(async () => {
        callOrder.push('save');
        return {};
      });

      await service.sendWelcomeEmail(1);

      // 메일 발송 후 DB 저장 순서 검증
      expect(callOrder).toEqual(['sendMail', 'save']);
    });
  });

  describe('getUserNotifications', () => {
    it('사용자의 알림 목록을 비동기로 조회한다', async () => {
      const mockNotifications = [
        { id: 1, message: '새 댓글이 달렸습니다', read: false },
        { id: 2, message: '게시글이 좋아요를 받았습니다', read: true },
      ];
      mockNotificationRepository.find.mockResolvedValue(mockNotifications);

      const result = await service.getUserNotifications(1);

      expect(result).toHaveLength(2);
      expect(result[0].read).toBe(false);
      // Repository가 올바른 조건으로 호출되었는지 검증
      expect(mockNotificationRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1 } }),
      );
    });
  });
});
```

### Promise.reject를 테스트하는 예제 (예외 발생 검증)

비동기 함수에서 예외가 발생하는 경우를 검증할 때는 `rejects` 체이닝을 사용한다. 동기 예외는 `toThrow()`로 검증하지만, 비동기 예외는 반드시 `rejects.toThrow()`를 사용해야 한다.

```typescript
// src/payments/payments.service.spec.ts
import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

describe('PaymentsService (예외 검증)', () => {
  let service: PaymentsService;

  const mockPaymentGateway = {
    charge: jest.fn(),
  };
  const mockOrderRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
  };

  // ... beforeEach 설정 생략 ...

  describe('processPayment', () => {
    it('주문이 존재하지 않으면 NotFoundException을 던진다', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      // rejects.toThrow()로 비동기 예외를 검증
      await expect(service.processPayment(999, 10000)).rejects.toThrow(NotFoundException);
      // 예외 메시지까지 정확히 검증
      await expect(service.processPayment(999, 10000)).rejects.toThrow('주문 #999을 찾을 수 없습니다.');
    });

    it('결제 금액이 0 이하면 BadRequestException을 던진다', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ id: 1, amount: 5000 });

      await expect(service.processPayment(1, -100)).rejects.toThrow(BadRequestException);
      await expect(service.processPayment(1, -100)).rejects.toThrow('결제 금액은 0보다 커야 합니다.');
    });

    it('결제 게이트웨이 오류 시 ServiceUnavailableException을 던진다', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ id: 1, amount: 10000 });

      // Promise.reject로 외부 서비스 오류를 시뮬레이션
      mockPaymentGateway.charge.mockRejectedValue(new Error('Gateway timeout'));

      await expect(service.processPayment(1, 10000)).rejects.toThrow(ServiceUnavailableException);
    });

    it('예외의 타입과 메시지를 동시에 검증한다', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      // 예외 객체의 세부 속성까지 검증
      await expect(service.processPayment(999, 10000)).rejects.toMatchObject({
        status: 404,
        message: '주문 #999을 찾을 수 없습니다.',
      });
    });

    it('예외가 발생해도 Repository가 올바르게 호출되었는지 검증한다', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      try {
        await service.processPayment(999, 10000);
      } catch {
        // 예외 발생 후에도 findOne이 호출되었는지 확인
        expect(mockOrderRepository.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
        // save는 호출되지 않아야 한다
        expect(mockOrderRepository.save).not.toHaveBeenCalled();
      }
    });
  });
});
```

### jest.useFakeTimers() 타이머 모킹

`setTimeout`, `setInterval`, `Date` 등 시간에 의존하는 로직을 테스트할 때 사용한다. 실제 시간을 기다리지 않고 타이머를 인위적으로 앞당길 수 있다.

```typescript
// src/cache/cache.service.spec.ts
describe('CacheService (타이머 모킹)', () => {
  beforeEach(() => {
    // 가짜 타이머를 활성화한다 (setTimeout, setInterval, Date 등이 모두 제어된다)
    jest.useFakeTimers();
  });

  afterEach(() => {
    // 반드시 원래 타이머로 복구한다
    jest.useRealTimers();
  });

  describe('set (TTL이 있는 캐시 저장)', () => {
    it('TTL이 만료되기 전에는 값을 반환한다', () => {
      service.set('key1', 'value1', 5000); // 5초 TTL

      // 3초를 앞으로 돌린다 (실제로 기다리지 않음)
      jest.advanceTimersByTime(3000);

      expect(service.get('key1')).toBe('value1');
    });

    it('TTL이 만료되면 null을 반환한다', () => {
      service.set('key1', 'value1', 5000); // 5초 TTL

      // 5초 이상 앞으로 돌린다
      jest.advanceTimersByTime(6000);

      expect(service.get('key1')).toBeNull();
    });
  });

  describe('Date 모킹', () => {
    it('특정 날짜를 기준으로 만료 여부를 계산한다', () => {
      // 현재 시각을 2024-01-01 00:00:00으로 고정
      jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

      service.set('key1', 'data', 60 * 60 * 1000); // 1시간 TTL

      // 30분 경과 시뮬레이션
      jest.advanceTimersByTime(30 * 60 * 1000);
      expect(service.get('key1')).toBe('data'); // 아직 유효

      // 추가 40분 경과 (총 70분)
      jest.advanceTimersByTime(40 * 60 * 1000);
      expect(service.get('key1')).toBeNull(); // 만료됨
    });
  });

  describe('setInterval 테스트', () => {
    it('주기적으로 캐시를 정리하는 cleanup이 호출된다', () => {
      const cleanupSpy = jest.spyOn(service, 'cleanup');

      service.startAutoCleanup(10000); // 10초마다 정리

      // 25초 경과 → cleanup이 2번 호출되어야 한다
      jest.advanceTimersByTime(25000);

      expect(cleanupSpy).toHaveBeenCalledTimes(2);
    });
  });
});
```

> **팁:** `jest.useFakeTimers()`는 `beforeEach`에서 활성화하고 `afterEach`에서 반드시 `jest.useRealTimers()`로 복구해야 한다. 복구하지 않으면 다른 테스트에 영향을 준다. `jest.advanceTimersByTime(ms)`로 시간을 앞당기고, `jest.runAllTimers()`로 모든 대기 중인 타이머를 즉시 실행할 수 있다.

---

## 8. 기본 예제: Controller 단위 테스트

Controller 테스트에서는 **Service를 모킹**하여, Controller가 Service의 메서드를 올바르게 호출하고 결과를 그대로 반환하는지 검증한다.

### 테스트 대상 Controller

```typescript
// src/items/items.controller.ts
import { Controller, Get, Post, Param, Body, ParseIntPipe } from '@nestjs/common';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.itemsService.findOne(id);
  }

  @Post()
  create(@Body('name') name: string) {
    return this.itemsService.create(name);
  }
}
```

### Controller 단위 테스트

```typescript
// src/items/items.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

describe('ItemsController', () => {
  let controller: ItemsController;

  // Service의 모든 메서드를 jest.fn()으로 만든다
  const mockItemsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [
        {
          provide: ItemsService,       // 실제 Service 대신
          useValue: mockItemsService,  // Mock 객체를 주입
        },
      ],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
  });

  afterEach(() => {
    jest.clearAllMocks(); // 매 테스트 후 Mock 호출 기록 초기화
  });

  describe('findAll', () => {
    it('Service의 findAll 결과를 그대로 반환한다', async () => {
      const items = [{ id: 1, name: '아이템1' }];
      mockItemsService.findAll.mockResolvedValue(items);

      const result = await controller.findAll();

      expect(result).toEqual(items);
      expect(mockItemsService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('Service의 findOne에 id를 전달하고 결과를 반환한다', async () => {
      const item = { id: 1, name: '아이템1' };
      mockItemsService.findOne.mockResolvedValue(item);

      const result = await controller.findOne(1);

      expect(result).toEqual(item);
      expect(mockItemsService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('Service의 create에 name을 전달하고 결과를 반환한다', async () => {
      const newItem = { id: 1, name: '새 아이템' };
      mockItemsService.create.mockResolvedValue(newItem);

      const result = await controller.create('새 아이템');

      expect(result).toEqual(newItem);
      expect(mockItemsService.create).toHaveBeenCalledWith('새 아이템');
    });
  });
});
```

---

## 9. 기본 예제: E2E 테스트 (supertest)

E2E 테스트는 실제 HTTP 요청을 보내서 API 전체 흐름을 검증한다. `supertest` 라이브러리를 사용한다.

### 기본 E2E 테스트

```typescript
// test/items.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ItemsModule } from '../src/items/items.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../src/items/entities/item.entity';

describe('ItemsController (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // 테스트용 인메모리 SQLite 사용
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Item],
          synchronize: true,
        }),
        ItemsModule,
      ],
    }).compile();

    // 실제 NestJS 앱 인스턴스를 생성한다
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /items → 아이템을 생성한다', () => {
    return request(app.getHttpServer())
      .post('/items')
      .send({ name: '테스트 아이템' })
      .expect(201) // HTTP 상태 코드 검증
      .expect((res) => {
        expect(res.body.name).toBe('테스트 아이템');
        expect(res.body.id).toBeDefined();
      });
  });

  it('GET /items → 아이템 목록을 조회한다', () => {
    return request(app.getHttpServer())
      .get('/items')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
      });
  });

  it('GET /items/:id → 특정 아이템을 조회한다', () => {
    return request(app.getHttpServer())
      .get('/items/1')
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(1);
      });
  });

  it('GET /items/999 → 존재하지 않는 아이템 조회 시 404를 반환한다', () => {
    return request(app.getHttpServer())
      .get('/items/999')
      .expect(404);
  });
});
```

> **팁:** E2E 테스트에서 `app.getHttpServer()`는 내부 HTTP 서버 인스턴스를 반환한다. supertest는 이 서버에 직접 요청을 보내기 때문에 실제 포트를 열지 않아도 된다.

---

## 10. 통합 테스트 (Integration Test)

통합 테스트는 단위 테스트처럼 모킹을 사용하지 않고, 실제 DB(인메모리 SQLite)와 함께 여러 컴포넌트가 올바르게 협력하는지를 검증한다. 단위 테스트보다 현실적이고, E2E 테스트보다 빠르다.

### 단위 테스트 vs 통합 테스트 비교

```
단위 테스트:  Service → Mock Repository → (DB 없음)
통합 테스트:  Service → 실제 Repository → SQLite 인메모리 DB
E2E 테스트:   HTTP 요청 → Controller → Service → Repository → SQLite 인메모리 DB
```

### 실제 DB(SQLite in-memory)를 사용하는 통합 테스트

```typescript
// src/posts/posts.service.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';

describe('PostsService (통합 테스트)', () => {
  let module: TestingModule;
  let service: PostsService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        // 실제 인메모리 SQLite DB 사용 - 모킹 없이 실제 Repository 동작 검증
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',        // 메모리 내 DB (파일 생성 없음)
          entities: [Post, User],
          synchronize: true,           // 엔티티 구조를 자동으로 DB에 동기화
          dropSchema: true,            // 테스트 시작 시 스키마 초기화
          logging: false,              // 쿼리 로그 비활성화 (테스트 출력 간결화)
        }),
        TypeOrmModule.forFeature([Post, User]),
      ],
      providers: [PostsService],
    }).compile();

    service = module.get<PostsService>(PostsService);
  });

  afterAll(async () => {
    await module.close(); // 앱 종료 시 DB 연결도 정리된다
  });

  // 각 테스트 후 데이터 초기화 (테스트 간 데이터 오염 방지)
  afterEach(async () => {
    const postRepository = module.get('PostRepository');
    await postRepository.clear();
  });

  describe('create', () => {
    it('게시글을 실제 DB에 저장하고 ID가 부여된다', async () => {
      const result = await service.create(
        { title: '통합 테스트 게시글', content: '실제 DB에 저장됩니다.' },
        1,
      );

      // 실제 DB에서 ID가 자동 생성되었는지 검증
      expect(result.id).toBeDefined();
      expect(result.id).toBeGreaterThan(0);
      expect(result.title).toBe('통합 테스트 게시글');
    });
  });

  describe('findAll', () => {
    it('저장된 모든 게시글을 조회한다', async () => {
      // 실제 DB에 게시글 저장
      await service.create({ title: '첫 번째 글', content: '내용1' }, 1);
      await service.create({ title: '두 번째 글', content: '내용2' }, 1);

      const result = await service.findAll();

      // 실제 DB에서 2개가 조회되어야 한다
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('두 번째 글'); // createdAt DESC 정렬 검증
      expect(result[1].title).toBe('첫 번째 글');
    });
  });

  describe('findOne', () => {
    it('존재하는 게시글을 ID로 조회한다', async () => {
      const created = await service.create({ title: '조회 테스트', content: '내용' }, 1);

      const result = await service.findOne(created.id);

      expect(result.id).toBe(created.id);
      expect(result.title).toBe('조회 테스트');
    });

    it('존재하지 않는 ID 조회 시 NotFoundException을 던진다', async () => {
      // 실제 DB에는 해당 ID가 없으므로 예외가 발생한다
      await expect(service.findOne(99999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('실제 DB의 게시글을 수정하고 변경사항이 영속된다', async () => {
      const created = await service.create({ title: '수정 전', content: '원래 내용' }, 1);

      await service.update(created.id, { title: '수정 후' });

      // 수정 후 다시 조회하여 실제로 DB에 반영되었는지 검증
      const updated = await service.findOne(created.id);
      expect(updated.title).toBe('수정 후');
      expect(updated.content).toBe('원래 내용'); // 변경하지 않은 필드는 유지
    });
  });

  describe('remove', () => {
    it('게시글을 실제 DB에서 삭제한다', async () => {
      const created = await service.create({ title: '삭제 대상', content: '내용' }, 1);

      await service.remove(created.id);

      // 삭제 후 조회하면 예외가 발생해야 한다
      await expect(service.findOne(created.id)).rejects.toThrow(NotFoundException);
    });
  });
});
```

### 통합 테스트에서 `TypeOrmModule.forRoot` 주요 옵션

```json
{
  "type": "sqlite",
  "database": ":memory:",
  "entities": ["경로 또는 엔티티 클래스 배열"],
  "synchronize": true,
  "dropSchema": true,
  "logging": false
}
```

| 옵션 | 설명 |
|------|------|
| `database: ':memory:'` | 파일을 생성하지 않고 메모리 내에서만 동작하는 SQLite DB |
| `synchronize: true` | 앱 시작 시 엔티티 기반으로 테이블을 자동 생성/수정 |
| `dropSchema: true` | 테스트 시작 시 기존 스키마를 모두 삭제하고 다시 생성 |
| `logging: false` | SQL 쿼리 로그를 비활성화하여 테스트 출력을 간결하게 유지 |

> **팁:** 통합 테스트는 단위 테스트보다 느리므로, 순수 비즈니스 로직은 단위 테스트로, DB와의 상호작용(쿼리 조건, 관계, 정렬 등)은 통합 테스트로 검증하는 것이 좋다. `afterEach`에서 `repository.clear()`를 호출하여 테스트 간 데이터가 섞이지 않도록 항상 초기화한다.

---

# 3단계: 블로그 API 적용

---

## 11. 블로그 API: PostsService 단위 테스트

이제 챕터 10(TypeORM)과 챕터 12(Authentication)에서 구축한 블로그 API의 핵심 로직을 테스트한다.

### 테스트 대상: PostsService

챕터 10에서 구현한 PostsService의 CRUD 로직을 검증한다. Repository를 모킹하여 DB 연결 없이 순수 비즈니스 로직만 테스트한다.

```typescript
// src/posts/posts.service.ts (테스트 대상 - 챕터 10에서 구현)
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(createPostDto: CreatePostDto, userId: number): Promise<Post> {
    const post = this.postsRepository.create({
      ...createPostDto,
      author: { id: userId },
    });
    return this.postsRepository.save(post);
  }

  async findAll(): Promise<Post[]> {
    return this.postsRepository.find({
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!post) {
      throw new NotFoundException(`게시글 #${id}을 찾을 수 없습니다.`);
    }
    return post;
  }

  async update(id: number, updatePostDto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(id);
    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
  }

  async remove(id: number): Promise<void> {
    const post = await this.findOne(id);
    await this.postsRepository.remove(post);
  }
}
```

### PostsService 단위 테스트

```typescript
// src/posts/posts.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { PostsService } from './posts.service';
import { Post } from './entities/post.entity';

// Mock Repository 헬퍼 타입
type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createMockRepository = <T = any>(): MockRepository<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
});

describe('PostsService', () => {
  let service: PostsService;
  let postsRepository: MockRepository<Post>;

  // 테스트에서 사용할 샘플 데이터
  const mockPost = {
    id: 1,
    title: 'NestJS 입문',
    content: 'NestJS는 Node.js 프레임워크입니다.',
    author: { id: 1, email: 'test@test.com' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        {
          provide: getRepositoryToken(Post),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    postsRepository = module.get<MockRepository<Post>>(getRepositoryToken(Post));
  });

  it('서비스가 정의되어 있어야 한다', () => {
    expect(service).toBeDefined();
  });

  // ─── CREATE ─────────────────────────────────────────────────
  describe('create', () => {
    it('새 게시글을 생성하고 반환한다', async () => {
      const createPostDto = { title: 'NestJS 입문', content: 'NestJS는 Node.js 프레임워크입니다.' };
      const userId = 1;

      postsRepository.create.mockReturnValue(mockPost);
      postsRepository.save.mockResolvedValue(mockPost);

      const result = await service.create(createPostDto, userId);

      // create가 DTO + author 정보로 호출되었는지 검증
      expect(postsRepository.create).toHaveBeenCalledWith({
        ...createPostDto,
        author: { id: userId },
      });
      // save가 호출되었는지 검증
      expect(postsRepository.save).toHaveBeenCalledWith(mockPost);
      // 반환값 검증
      expect(result).toEqual(mockPost);
    });
  });

  // ─── READ (목록) ────────────────────────────────────────────
  describe('findAll', () => {
    it('모든 게시글을 최신순으로 반환한다', async () => {
      const posts = [mockPost, { ...mockPost, id: 2, title: '두 번째 글' }];
      postsRepository.find.mockResolvedValue(posts);

      const result = await service.findAll();

      expect(result).toEqual(posts);
      expect(postsRepository.find).toHaveBeenCalledWith({
        relations: ['author'],
        order: { createdAt: 'DESC' },
      });
    });

    it('게시글이 없으면 빈 배열을 반환한다', async () => {
      postsRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  // ─── READ (단건) ────────────────────────────────────────────
  describe('findOne', () => {
    it('ID에 해당하는 게시글을 반환한다', async () => {
      postsRepository.findOne.mockResolvedValue(mockPost);

      const result = await service.findOne(1);

      expect(result).toEqual(mockPost);
      expect(postsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['author'],
      });
    });

    it('존재하지 않는 게시글 조회 시 NotFoundException을 던진다', async () => {
      postsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999)).rejects.toThrow('게시글 #999을 찾을 수 없습니다.');
    });
  });

  // ─── UPDATE ─────────────────────────────────────────────────
  describe('update', () => {
    it('게시글을 수정하고 반환한다', async () => {
      const updatePostDto = { title: '수정된 제목' };
      const updatedPost = { ...mockPost, title: '수정된 제목' };

      postsRepository.findOne.mockResolvedValue({ ...mockPost }); // findOne (findOne 내부 호출)
      postsRepository.save.mockResolvedValue(updatedPost);

      const result = await service.update(1, updatePostDto);

      expect(postsRepository.save).toHaveBeenCalled();
      expect(result.title).toBe('수정된 제목');
    });

    it('존재하지 않는 게시글 수정 시 NotFoundException을 던진다', async () => {
      postsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(999, { title: '수정' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── DELETE ─────────────────────────────────────────────────
  describe('remove', () => {
    it('게시글을 삭제한다', async () => {
      postsRepository.findOne.mockResolvedValue(mockPost);
      postsRepository.remove.mockResolvedValue(mockPost);

      await service.remove(1);

      expect(postsRepository.remove).toHaveBeenCalledWith(mockPost);
    });

    it('존재하지 않는 게시글 삭제 시 NotFoundException을 던진다', async () => {
      postsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
```

> **팁:** 테스트 이름은 "~한다"라는 행동 중심으로 작성한다. 테스트가 실패했을 때 어떤 기능이 깨졌는지 바로 알 수 있기 때문이다. 예: "존재하지 않는 게시글 조회 시 NotFoundException을 던진다."

---

## 12. 블로그 API: AuthService 단위 테스트

챕터 12에서 구현한 AuthService의 로그인, 토큰 발급 로직을 검증한다. AuthService는 UsersService, JwtService, ConfigService에 의존하므로 이 세 가지를 모두 모킹한다.

### 테스트 대상: AuthService (챕터 12에서 구현)

```
AuthService 의존성:
├── UsersService    → findByEmail, findById, updateRefreshToken
├── JwtService      → sign
└── ConfigService   → get (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET)
```

### AuthService 단위 테스트

```typescript
// src/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

// bcrypt 모듈을 모킹한다 (실제 해싱은 느리므로)
jest.mock('bcrypt');

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;
  let configService: Record<string, jest.Mock>;

  // 테스트용 샘플 데이터
  const mockUser = {
    id: 1,
    email: 'test@test.com',
    password: '$2b$10$hashedPassword', // 해싱된 비밀번호
    hashedRefreshToken: '$2b$10$hashedRefreshToken',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            updateRefreshToken: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_ACCESS_SECRET: 'test-access-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── validateUser ───────────────────────────────────────────
  describe('validateUser', () => {
    it('이메일과 비밀번호가 올바르면 사용자 정보를 반환한다 (비밀번호 제외)', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // 비밀번호 일치

      const result = await authService.validateUser('test@test.com', 'password123');

      expect(usersService.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', mockUser.password);
      // 비밀번호가 제외되었는지 검증
      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('email', 'test@test.com');
    });

    it('존재하지 않는 이메일이면 null을 반환한다', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await authService.validateUser('wrong@test.com', 'password123');

      expect(result).toBeNull();
    });

    it('비밀번호가 틀리면 null을 반환한다', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // 비밀번호 불일치

      const result = await authService.validateUser('test@test.com', 'wrongPassword');

      expect(result).toBeNull();
    });
  });

  // ─── login ──────────────────────────────────────────────────
  describe('login', () => {
    it('Access Token과 Refresh Token을 발급한다', async () => {
      jwtService.sign
        .mockReturnValueOnce('mock-access-token')   // 첫 번째 호출: Access Token
        .mockReturnValueOnce('mock-refresh-token');  // 두 번째 호출: Refresh Token
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh-token');
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await authService.login({ id: 1, email: 'test@test.com' });

      // 토큰이 올바르게 반환되는지 검증
      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });

      // JwtService.sign이 올바른 payload와 옵션으로 호출되었는지 검증
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'test@test.com' },
        expect.objectContaining({ secret: 'test-access-secret', expiresIn: '15m' }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, email: 'test@test.com' },
        expect.objectContaining({ secret: 'test-refresh-secret', expiresIn: '7d' }),
      );

      // Refresh Token이 해싱되어 DB에 저장되는지 검증
      expect(bcrypt.hash).toHaveBeenCalledWith('mock-refresh-token', 10);
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(1, 'hashed-refresh-token');
    });
  });

  // ─── refreshTokens ─────────────────────────────────────────
  describe('refreshTokens', () => {
    it('유효한 Refresh Token이면 새 토큰 쌍을 발급한다', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // Refresh Token 일치
      jwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-refresh');
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refreshTokens(1, 'test@test.com', 'valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('사용자가 존재하지 않으면 UnauthorizedException을 던진다', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(
        authService.refreshTokens(999, 'test@test.com', 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Refresh Token이 일치하지 않으면 UnauthorizedException을 던진다', async () => {
      usersService.findById.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // 불일치

      await expect(
        authService.refreshTokens(1, 'test@test.com', 'invalid-refresh-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── logout ─────────────────────────────────────────────────
  describe('logout', () => {
    it('Refresh Token을 null로 업데이트하여 무효화한다', async () => {
      usersService.updateRefreshToken.mockResolvedValue(undefined);

      await authService.logout(1);

      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(1, null);
    });
  });
});
```

> **팁:** `jest.mock('bcrypt')`를 사용하면 bcrypt 모듈 전체를 모킹한다. 실제 bcrypt 해싱은 의도적으로 느리게 설계되었기 때문에, 테스트에서는 모킹하여 속도를 높이는 것이 좋다. `(bcrypt.compare as jest.Mock).mockResolvedValue(true)`처럼 반환값을 직접 지정할 수 있다.

---

## 13. 블로그 API: PostsController 단위 테스트

PostsController는 인증된 사용자만 게시글을 작성/수정/삭제할 수 있다. 하지만 단위 테스트에서는 Guard를 거치지 않으므로, Controller가 Service를 올바르게 호출하는지에 집중한다.

### 테스트 대상: PostsController

```typescript
// src/posts/posts.controller.ts (테스트 대상)
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, ParseIntPipe, UseGuards, Request,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createPostDto: CreatePostDto, @Request() req) {
    return this.postsService.create(createPostDto, req.user.id);
  }

  @Get()
  findAll() {
    return this.postsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() updatePostDto: UpdatePostDto) {
    return this.postsService.update(id, updatePostDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
```

### PostsController 단위 테스트

```typescript
// src/posts/posts.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  let controller: PostsController;

  const mockPostsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  // 인증된 사용자의 request 객체를 시뮬레이션
  const mockRequest = {
    user: { id: 1, email: 'test@test.com' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        {
          provide: PostsService,
          useValue: mockPostsService,
        },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('컨트롤러가 정의되어 있어야 한다', () => {
    expect(controller).toBeDefined();
  });

  // ─── CREATE ─────────────────────────────────────────────────
  describe('create', () => {
    it('게시글을 생성하고 반환한다', async () => {
      const createPostDto = { title: '새 게시글', content: '내용입니다' };
      const createdPost = { id: 1, ...createPostDto, author: { id: 1 } };
      mockPostsService.create.mockResolvedValue(createdPost);

      const result = await controller.create(createPostDto, mockRequest);

      // Service의 create가 DTO와 사용자 ID로 호출되었는지 검증
      expect(mockPostsService.create).toHaveBeenCalledWith(createPostDto, 1);
      expect(result).toEqual(createdPost);
    });
  });

  // ─── READ (목록) ────────────────────────────────────────────
  describe('findAll', () => {
    it('모든 게시글 목록을 반환한다', async () => {
      const posts = [
        { id: 1, title: '첫 번째', content: '내용1' },
        { id: 2, title: '두 번째', content: '내용2' },
      ];
      mockPostsService.findAll.mockResolvedValue(posts);

      const result = await controller.findAll();

      expect(result).toEqual(posts);
      expect(mockPostsService.findAll).toHaveBeenCalled();
    });
  });

  // ─── READ (단건) ────────────────────────────────────────────
  describe('findOne', () => {
    it('ID에 해당하는 게시글을 반환한다', async () => {
      const post = { id: 1, title: '게시글', content: '내용' };
      mockPostsService.findOne.mockResolvedValue(post);

      const result = await controller.findOne(1);

      expect(result).toEqual(post);
      expect(mockPostsService.findOne).toHaveBeenCalledWith(1);
    });
  });

  // ─── UPDATE ─────────────────────────────────────────────────
  describe('update', () => {
    it('게시글을 수정하고 반환한다', async () => {
      const updatePostDto = { title: '수정된 제목' };
      const updatedPost = { id: 1, title: '수정된 제목', content: '내용' };
      mockPostsService.update.mockResolvedValue(updatedPost);

      const result = await controller.update(1, updatePostDto);

      expect(mockPostsService.update).toHaveBeenCalledWith(1, updatePostDto);
      expect(result).toEqual(updatedPost);
    });
  });

  // ─── DELETE ─────────────────────────────────────────────────
  describe('remove', () => {
    it('게시글을 삭제한다', async () => {
      mockPostsService.remove.mockResolvedValue(undefined);

      await controller.remove(1);

      expect(mockPostsService.remove).toHaveBeenCalledWith(1);
    });
  });
});
```

> **팁:** 단위 테스트에서는 [`@UseGuards(JwtAuthGuard)`](references/decorators.md#useguardsguards)가 실행되지 않는다. Guard 동작은 E2E 테스트에서 검증한다. 단위 테스트에서는 순수 로직 호출만 집중하면 된다. `mockRequest` 객체를 직접 만들어서 `req.user`를 시뮬레이션한 부분에 주목하자.

---

## 14. 블로그 API: E2E 테스트 전체 플로우

가장 중요한 E2E 테스트다. **회원가입 -> 로그인 -> 게시글 작성 -> 조회 -> 수정 -> 삭제**의 전체 흐름을 하나의 테스트 파일에서 검증한다.

### 전체 플로우 E2E 테스트

```typescript
// test/blog.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from '../src/users/users.module';
import { PostsModule } from '../src/posts/posts.module';
import { AuthModule } from '../src/auth/auth.module';
import { User } from '../src/users/entities/user.entity';
import { Post } from '../src/posts/entities/post.entity';

describe('블로그 API 전체 플로우 (E2E)', () => {
  let app: INestApplication;

  // 테스트 진행 중 저장할 데이터
  let accessToken: string;
  let createdPostId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // 환경 변수 설정 (JWT Secret 등)
        ConfigModule.forRoot({
          isGlobal: true,
          // 테스트용 환경 변수를 직접 지정
          load: [
            () => ({
              JWT_ACCESS_SECRET: 'test-access-secret',
              JWT_REFRESH_SECRET: 'test-refresh-secret',
            }),
          ],
        }),
        // 테스트용 인메모리 SQLite
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, Post],
          synchronize: true,
        }),
        UsersModule,
        PostsModule,
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    // 실제 앱과 동일한 Pipe 설정 적용
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── 1단계: 회원가입 ───────────────────────────────────────
  describe('1. 회원가입', () => {
    it('POST /users → 새 사용자를 등록한다', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'blogger@test.com',
          password: 'Password123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.email).toBe('blogger@test.com');
          expect(res.body.id).toBeDefined();
          // 비밀번호가 응답에 포함되지 않아야 한다
          expect(res.body.password).toBeUndefined();
        });
    });

    it('POST /users → 이미 존재하는 이메일로 가입 시 409를 반환한다', () => {
      return request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'blogger@test.com',
          password: 'Password123!',
        })
        .expect(409);
    });
  });

  // ─── 2단계: 로그인 ─────────────────────────────────────────
  describe('2. 로그인', () => {
    it('POST /auth/login → 올바른 자격 증명으로 토큰을 발급받는다', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'blogger@test.com',
          password: 'Password123!',
        })
        .expect(200);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();

      // 이후 테스트에서 사용할 토큰 저장
      accessToken = response.body.accessToken;
    });

    it('POST /auth/login → 잘못된 비밀번호로 로그인 시 401을 반환한다', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'blogger@test.com',
          password: 'WrongPassword!',
        })
        .expect(401);
    });
  });

  // ─── 3단계: 게시글 작성 ────────────────────────────────────
  describe('3. 게시글 작성', () => {
    it('POST /posts → 인증된 사용자가 게시글을 작성한다', async () => {
      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`) // JWT 토큰 전달
        .send({
          title: 'NestJS 테스트 가이드',
          content: 'NestJS에서 테스트를 작성하는 방법을 알아봅니다.',
        })
        .expect(201);

      expect(response.body.title).toBe('NestJS 테스트 가이드');
      expect(response.body.id).toBeDefined();

      // 이후 테스트에서 사용할 게시글 ID 저장
      createdPostId = response.body.id;
    });

    it('POST /posts → 토큰 없이 요청하면 401을 반환한다', () => {
      return request(app.getHttpServer())
        .post('/posts')
        .send({
          title: '인증 없는 요청',
          content: '이 요청은 실패해야 합니다.',
        })
        .expect(401);
    });
  });

  // ─── 4단계: 게시글 조회 ────────────────────────────────────
  describe('4. 게시글 조회', () => {
    it('GET /posts → 게시글 목록을 조회한다', async () => {
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0].title).toBe('NestJS 테스트 가이드');
    });

    it('GET /posts/:id → 특정 게시글을 조회한다', async () => {
      const response = await request(app.getHttpServer())
        .get(`/posts/${createdPostId}`)
        .expect(200);

      expect(response.body.id).toBe(createdPostId);
      expect(response.body.title).toBe('NestJS 테스트 가이드');
      expect(response.body.content).toBe('NestJS에서 테스트를 작성하는 방법을 알아봅니다.');
    });

    it('GET /posts/9999 → 존재하지 않는 게시글 조회 시 404를 반환한다', () => {
      return request(app.getHttpServer())
        .get('/posts/9999')
        .expect(404);
    });
  });

  // ─── 5단계: 게시글 수정 ────────────────────────────────────
  describe('5. 게시글 수정', () => {
    it('PATCH /posts/:id → 인증된 사용자가 게시글을 수정한다', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: '수정된 NestJS 테스트 가이드',
        })
        .expect(200);

      expect(response.body.title).toBe('수정된 NestJS 테스트 가이드');
      // 수정하지 않은 필드는 유지된다
      expect(response.body.content).toBe('NestJS에서 테스트를 작성하는 방법을 알아봅니다.');
    });

    it('PATCH /posts/:id → 토큰 없이 수정하면 401을 반환한다', () => {
      return request(app.getHttpServer())
        .patch(`/posts/${createdPostId}`)
        .send({ title: '무단 수정' })
        .expect(401);
    });
  });

  // ─── 6단계: 게시글 삭제 ────────────────────────────────────
  describe('6. 게시글 삭제', () => {
    it('DELETE /posts/:id → 인증된 사용자가 게시글을 삭제한다', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${createdPostId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('GET /posts/:id → 삭제된 게시글 조회 시 404를 반환한다', () => {
      return request(app.getHttpServer())
        .get(`/posts/${createdPostId}`)
        .expect(404);
    });

    it('DELETE /posts/:id → 토큰 없이 삭제하면 401을 반환한다', () => {
      return request(app.getHttpServer())
        .delete(`/posts/${createdPostId}`)
        .expect(401);
    });
  });
});
```

### E2E 테스트의 핵심 포인트

1. **순서가 중요하다**: 회원가입 -> 로그인 -> 작성 -> 조회 -> 수정 -> 삭제의 순서대로 진행되며, 이전 단계의 결과(`accessToken`, `createdPostId`)를 다음 단계에서 사용한다.

2. **실제 앱과 동일한 설정**: `ValidationPipe` 등 실제 앱에서 사용하는 전역 설정을 동일하게 적용해야 한다. 그래야 Pipe, Guard 등이 정상 동작하는지 검증할 수 있다.

3. **인메모리 DB 사용**: 테스트마다 깨끗한 상태에서 시작하기 위해 인메모리 SQLite를 사용한다. `beforeAll`에서 앱을 초기화하면 빈 DB에서 시작한다.

4. **인증 테스트 포함**: 토큰이 없는 요청이 `401`을 반환하는지도 함께 검증하여, Guard가 정상 동작하는지 확인한다.

> **팁:** E2E 테스트에서 `beforeAll`/`afterAll`을 사용하는 이유는 앱 초기화 비용이 크기 때문이다. 매 테스트마다 앱을 새로 만들면 너무 느려진다. 반면 단위 테스트에서는 `beforeEach`를 사용하여 매 테스트마다 깨끗한 Mock 상태를 보장한다.

---

## 15. Guard, Interceptor, Pipe 테스트

Guard, Interceptor, Pipe는 NestJS의 핵심 미들웨어 계층이다. 각각 독립적으로 단위 테스트를 작성할 수 있다.

### Guard 테스트 (canActivate 검증)

Guard는 `canActivate(context: ExecutionContext): boolean | Promise<boolean>` 메서드를 구현한다. 단위 테스트에서는 `ExecutionContext`를 모킹하여 Guard의 허용/차단 로직을 검증한다.

```typescript
// src/auth/guards/roles.guard.spec.ts
import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';

// 테스트 대상 Guard 예시
// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}
//   canActivate(context: ExecutionContext): boolean {
//     const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
//     if (!requiredRoles) return true;
//     const { user } = context.switchToHttp().getRequest();
//     return requiredRoles.includes(user.role);
//   }
// }

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  // ExecutionContext 모킹 헬퍼 함수
  const createMockExecutionContext = (user: object): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext);

  describe('canActivate', () => {
    it('@Roles() 데코레이터가 없으면 모든 요청을 허용한다', () => {
      // Reflector가 roles 메타데이터를 찾지 못하면 undefined를 반환
      jest.spyOn(reflector, 'get').mockReturnValue(undefined);

      const context = createMockExecutionContext({ role: 'user' });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('사용자 역할이 요구 역할에 포함되면 허용한다', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']); // @Roles('admin') 시뮬레이션

      const context = createMockExecutionContext({ id: 1, role: 'admin' });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('사용자 역할이 요구 역할에 포함되지 않으면 차단한다', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin']);

      const context = createMockExecutionContext({ id: 2, role: 'user' });
      const result = guard.canActivate(context);

      expect(result).toBe(false);
    });

    it('여러 허용 역할 중 하나라도 일치하면 허용한다', () => {
      jest.spyOn(reflector, 'get').mockReturnValue(['admin', 'moderator']);

      const context = createMockExecutionContext({ id: 3, role: 'moderator' });
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
```

```typescript
// src/auth/guards/jwt-auth.guard.spec.ts
import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard();
  });

  const createMockContext = (authHeader?: string): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
      }),
    }),
    getHandler: () => jest.fn(),
    getClass: () => jest.fn(),
  } as unknown as ExecutionContext);

  it('JWT 토큰이 유효하면 canActivate가 true를 반환한다', async () => {
    // AuthGuard('jwt')의 canActivate를 모킹
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(true);

    const context = createMockContext('Bearer valid.jwt.token');
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('JWT 토큰이 없으면 UnauthorizedException을 던진다', async () => {
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockResolvedValue(false);

    const context = createMockContext();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
```

### ValidationPipe 동작 테스트

`ValidationPipe`는 요청 본문을 DTO 클래스로 변환하고, `class-validator` 규칙에 따라 검증한다. 단위 테스트에서 Pipe 자체의 동작을 직접 검증할 수 있다.

```typescript
// src/posts/dto/create-post.dto.spec.ts
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePostDto } from './create-post.dto';

// CreatePostDto 예시:
// export class CreatePostDto {
//   @IsString()
//   @IsNotEmpty()
//   @MaxLength(100)
//   title: string;
//
//   @IsString()
//   @IsNotEmpty()
//   content: string;
// }

describe('CreatePostDto (ValidationPipe 동작)', () => {
  // class-validator를 직접 사용하는 방식
  const validateDto = async (data: object) => {
    const dto = plainToInstance(CreatePostDto, data);
    const errors = await validate(dto);
    return errors;
  };

  it('올바른 데이터는 유효성 검사를 통과한다', async () => {
    const errors = await validateDto({
      title: 'NestJS 테스트',
      content: '테스트 내용입니다.',
    });
    expect(errors).toHaveLength(0);
  });

  it('title이 없으면 유효성 검사에 실패한다', async () => {
    const errors = await validateDto({
      content: '내용만 있습니다.',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('title');
  });

  it('title이 빈 문자열이면 유효성 검사에 실패한다', async () => {
    const errors = await validateDto({
      title: '',
      content: '내용입니다.',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('title이 100자를 초과하면 유효성 검사에 실패한다', async () => {
    const errors = await validateDto({
      title: 'a'.repeat(101),
      content: '내용입니다.',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('content가 없으면 유효성 검사에 실패한다', async () => {
    const errors = await validateDto({
      title: '제목입니다.',
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('content');
  });
});

// ValidationPipe를 직접 인스턴스화하여 테스트하는 방식
describe('ValidationPipe 직접 테스트', () => {
  let pipe: ValidationPipe;

  beforeEach(() => {
    pipe = new ValidationPipe({
      whitelist: true,            // DTO에 없는 프로퍼티 제거
      forbidNonWhitelisted: true, // DTO에 없는 프로퍼티 수신 시 400 에러
      transform: true,            // 자동 타입 변환
    });
  });

  it('유효한 DTO는 변환 후 반환된다', async () => {
    const result = await pipe.transform(
      { title: '제목', content: '내용' },
      { type: 'body', metatype: CreatePostDto },
    );
    expect(result).toBeInstanceOf(CreatePostDto);
    expect(result.title).toBe('제목');
  });

  it('유효하지 않은 데이터는 BadRequestException을 던진다', async () => {
    await expect(
      pipe.transform(
        { title: '', content: '내용' }, // 빈 title
        { type: 'body', metatype: CreatePostDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('whitelist 옵션으로 DTO에 없는 프로퍼티가 제거된다', async () => {
    const result = await pipe.transform(
      { title: '제목', content: '내용', unknownField: '제거될 값' },
      { type: 'body', metatype: CreatePostDto },
    );
    expect(result).not.toHaveProperty('unknownField');
  });

  it('forbidNonWhitelisted 옵션으로 허용되지 않은 프로퍼티 수신 시 400을 던진다', async () => {
    const strictPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    await expect(
      strictPipe.transform(
        { title: '제목', content: '내용', hackerField: '악의적 데이터' },
        { type: 'body', metatype: CreatePostDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
```

> **팁:** Guard 테스트에서 `ExecutionContext`는 복잡한 인터페이스이므로, `as unknown as ExecutionContext`로 타입 캐스팅하여 테스트에 필요한 부분만 구현하는 것이 일반적이다. `jest.spyOn(reflector, 'get')`을 사용하면 실제 `Reflector` 인스턴스의 특정 메서드만 선택적으로 모킹할 수 있다.

---

## 16. 테스트 커버리지 설정

테스트 커버리지는 전체 소스 코드 중 테스트가 실행한 비율을 나타낸다. NestJS 프로젝트에서 커버리지 목표를 설정하고 강제하는 방법을 알아보자.

### 커버리지 지표의 종류

| 지표 | 설명 | 예시 |
|------|------|------|
| **Statements** | 실행된 구문(statement) 비율 | `if`, `return`, 변수 선언 등 |
| **Branches** | 실행된 분기(branch) 비율 | `if/else`, 삼항 연산자, `switch` 등 |
| **Functions** | 호출된 함수 비율 | 함수, 메서드, 화살표 함수 등 |
| **Lines** | 실행된 줄(line) 비율 | 실행 가능한 코드 줄 수 기준 |

### package.json의 coverageThreshold 설정 예제

`coverageThreshold`를 설정하면 커버리지가 목표치에 미달할 경우 `npm run test:cov` 명령어가 실패한다. CI/CD 파이프라인에서 품질 게이트로 활용할 수 있다.

```json
// package.json
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.module.ts",
      "!**/*.dto.ts",
      "!**/*.entity.ts",
      "!**/main.ts",
      "!**/*.interface.ts"
    ],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node",

    // 커버리지 80% 목표 설정
    "coverageThreshold": {
      "global": {
        "statements": 80,
        "branches": 80,
        "functions": 80,
        "lines": 80
      }
    }
  }
}
```

### 디렉터리별 개별 커버리지 목표 설정

핵심 비즈니스 로직 디렉터리에는 더 높은 목표를 설정할 수 있다.

```json
// package.json - 세분화된 커버리지 목표 설정
{
  "jest": {
    "coverageThreshold": {
      "global": {
        "statements": 80,
        "branches": 75,
        "functions": 80,
        "lines": 80
      },
      "./src/posts/": {
        "statements": 90,
        "branches": 85,
        "functions": 90,
        "lines": 90
      },
      "./src/auth/": {
        "statements": 95,
        "branches": 90,
        "functions": 95,
        "lines": 95
      }
    }
  }
}
```

### 커버리지 제외 설정

모든 파일을 커버리지 측정에 포함할 필요는 없다. `collectCoverageFrom`에서 측정 대상과 제외 대상을 지정한다.

```json
{
  "jest": {
    "collectCoverageFrom": [
      "**/*.(t|j)s",
      "!**/*.module.ts",       // 모듈 파일 제외 (로직이 없음)
      "!**/*.dto.ts",          // DTO 파일 제외 (데코레이터만 있음)
      "!**/*.entity.ts",       // 엔티티 파일 제외 (컬럼 정의만 있음)
      "!**/*.interface.ts",    // 인터페이스 파일 제외 (타입 정의만)
      "!**/main.ts",           // 앱 진입점 제외
      "!**/__mocks__/**"       // 수동 Mock 파일 제외
    ]
  }
}
```

### 커버리지 리포트 실행 및 결과 확인

```bash
# 커버리지 리포트 생성 (coverage/ 폴더에 HTML 리포트 생성)
npm run test:cov
```

커버리지 목표 미달 시 출력 예시:

```
Jest: "global" coverage threshold for statements (80%) not met: 72%
Jest: "global" coverage threshold for branches (80%) not met: 65%
```

커버리지 목표 달성 시 출력 예시:

```
--------------------|---------|----------|---------|---------|
File                 | % Stmts | % Branch | % Funcs | % Lines |
--------------------|---------|----------|---------|---------|
All files            |   85.71 |    81.25 |   88.89 |   85.71 |
 posts/              |         |          |         |         |
  posts.service.ts   |   92.31 |    87.50 |  100.00 |   92.31 |
  posts.controller.ts|  100.00 |   100.00 |  100.00 |  100.00 |
 auth/               |         |          |         |         |
  auth.service.ts    |   96.15 |    91.67 |  100.00 |   96.15 |
--------------------|---------|----------|---------|---------|
```

> **팁:** 커버리지 80%를 처음부터 강제하기보다는, 팀 상황에 맞게 점진적으로 목표를 높이는 것이 좋다. 처음에는 `statements: 60`으로 시작하고, 테스트가 쌓이면서 70, 80으로 올린다. 커버리지 100%가 목표가 아니라, 핵심 로직이 테스트되고 있는지가 중요하다.

---

## 17. 테스트 실행 명령어 정리

### 기본 명령어

```bash
# 단위 테스트 실행 (src/ 하위 *.spec.ts)
npm run test

# 감시 모드 (파일 변경 시 자동 재실행, 개발 중 가장 편리)
npm run test:watch

# 특정 파일만 테스트
npx jest posts.service.spec.ts

# 특정 describe/it 이름으로 필터링
npx jest --testNamePattern="create"

# 테스트 커버리지 리포트 생성
npm run test:cov

# E2E 테스트 실행 (test/ 하위 *.e2e-spec.ts)
npm run test:e2e
```

### package.json scripts 확인

```json
// package.json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:debug": "node --inspect-brk -r tsconfig-paths/register -r ts-node/register node_modules/.bin/jest --runInBand",
    "test:e2e": "jest --config ./test/jest-e2e.json"
  }
}
```

### 실행 결과 예시

```
$ npm run test

 PASS  src/posts/posts.service.spec.ts
  PostsService
    ✓ 서비스가 정의되어 있어야 한다 (3 ms)
    create
      ✓ 새 게시글을 생성하고 반환한다 (2 ms)
    findAll
      ✓ 모든 게시글을 최신순으로 반환한다 (1 ms)
      ✓ 게시글이 없으면 빈 배열을 반환한다 (1 ms)
    findOne
      ✓ ID에 해당하는 게시글을 반환한다 (1 ms)
      ✓ 존재하지 않는 게시글 조회 시 NotFoundException을 던진다 (2 ms)
    update
      ✓ 게시글을 수정하고 반환한다 (1 ms)
      ✓ 존재하지 않는 게시글 수정 시 NotFoundException을 던진다 (1 ms)
    remove
      ✓ 게시글을 삭제한다 (1 ms)
      ✓ 존재하지 않는 게시글 삭제 시 NotFoundException을 던진다 (1 ms)

 PASS  src/auth/auth.service.spec.ts
  AuthService
    validateUser
      ✓ 이메일과 비밀번호가 올바르면 사용자 정보를 반환한다 (2 ms)
      ✓ 존재하지 않는 이메일이면 null을 반환한다 (1 ms)
      ✓ 비밀번호가 틀리면 null을 반환한다 (1 ms)
    login
      ✓ Access Token과 Refresh Token을 발급한다 (2 ms)
    logout
      ✓ Refresh Token을 null로 업데이트하여 무효화한다 (1 ms)

Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
Time:        2.341 s
```

> **팁:** `npm run test:watch` 모드에서는 변경된 파일과 관련된 테스트만 자동으로 다시 실행한다. 개발하면서 실시간으로 테스트 결과를 확인할 수 있어 매우 편리하다. `p` 키를 눌러 파일 이름으로 필터링하거나, `t` 키를 눌러 테스트 이름으로 필터링할 수 있다.

---

## 프로젝트 구조

테스트 파일은 테스트 대상 파일과 같은 폴더에 `.spec.ts` 확장자로 배치한다.

```
src/
├── app.module.ts
├── main.ts
├── common/ (챕터 9까지 누적된 파일들)
├── config/
│   ├── database.config.ts
│   ├── jwt.config.ts
│   └── env.validation.ts
├── auth/
│   ├── auth.service.ts
│   ├── auth.service.spec.ts       ← [이번 챕터 추가]
│   └── ...
├── users/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── users.service.ts
│   ├── users.service.spec.ts      ← [이번 챕터 추가]
│   └── ...
├── posts/
│   ├── entities/
│   │   └── post.entity.ts
│   ├── posts.service.ts
│   ├── posts.service.spec.ts      ← [이번 챕터 추가]
│   └── ...
└── comments/
    └── ...

test/
├── app.e2e-spec.ts                ← [이번 챕터 추가]
└── jest-e2e.json
```

---

## 정리

이 챕터에서 학습한 내용을 정리한다.

### 핵심 개념

| 개념 | 설명 |
|------|------|
| 단위 테스트 | 개별 클래스를 독립적으로 테스트. 외부 의존성은 모킹 |
| 통합 테스트 | 실제 인메모리 DB와 함께 여러 컴포넌트가 협력하는지 검증 |
| E2E 테스트 | 실제 HTTP 요청으로 전체 흐름 검증 |
| `Test.createTestingModule()` | NestJS DI 시스템을 활용한 테스트 모듈 생성 |
| 모킹 (Mocking) | 외부 의존성을 가짜 객체로 대체하여 독립적 테스트 보장 |
| `jest.fn()` | 호출 추적 가능한 가짜 함수 생성 |
| `jest.useFakeTimers()` | setTimeout, setInterval, Date를 가짜로 대체하여 시간 제어 |
| `getRepositoryToken()` | TypeORM Repository의 DI 토큰을 가져와 모킹에 사용 |
| `supertest` | HTTP 요청 시뮬레이션 라이브러리 |
| Guard 테스트 | `ExecutionContext` 모킹으로 canActivate 로직 검증 |
| ValidationPipe 테스트 | `class-validator`의 validate() 또는 Pipe 직접 인스턴스화로 검증 |
| `coverageThreshold` | 커버리지 최솟값 설정. 미달 시 CI 실패 처리 가능 |

### 이 챕터에서 작성한 테스트 파일

```
src/
├── posts/
│   ├── posts.service.spec.ts              ← PostsService CRUD 단위 테스트
│   ├── posts.service.integration.spec.ts  ← PostsService 통합 테스트 (SQLite in-memory)
│   ├── posts.controller.spec.ts           ← PostsController 단위 테스트
│   └── dto/
│       └── create-post.dto.spec.ts        ← ValidationPipe/DTO 유효성 검사 테스트
├── auth/
│   ├── auth.service.spec.ts               ← AuthService 로그인/토큰 단위 테스트
│   └── guards/
│       ├── roles.guard.spec.ts            ← RolesGuard canActivate 단위 테스트
│       └── jwt-auth.guard.spec.ts         ← JwtAuthGuard 단위 테스트
├── notifications/
│   └── notifications.service.spec.ts     ← async/await 비동기 테스트 예제
├── payments/
│   └── payments.service.spec.ts          ← Promise.reject 예외 검증 예제
└── cache/
    └── cache.service.spec.ts             ← jest.useFakeTimers() 타이머 모킹 예제
test/
└── blog.e2e-spec.ts                       ← 회원가입→로그인→CRUD 전체 플로우 E2E 테스트
```

### 이 챕터를 마치면

- PostsService의 CRUD 로직이 단위 테스트와 통합 테스트(실제 SQLite DB) 두 가지로 검증된다.
- AuthService의 로그인, 토큰 발급, 갱신, 로그아웃 로직이 테스트 코드로 검증된다.
- PostsController의 라우트 핸들러가 Service를 올바르게 호출하는지 검증된다.
- async/await, Promise.reject, 타이머 모킹 등 비동기 테스트 심화 패턴을 적용할 수 있다.
- Guard의 canActivate 로직과 ValidationPipe의 DTO 검증 동작을 독립적으로 테스트할 수 있다.
- `coverageThreshold`로 커버리지 80% 목표를 강제하여 품질 게이트를 설정할 수 있다.
- 회원가입부터 게시글 삭제까지의 전체 API 플로우가 E2E 테스트로 검증된다.
- `npm run test`와 `npm run test:e2e` 명령어로 언제든 핵심 로직의 정상 동작을 확인할 수 있다.

## 다음 챕터 예고

**챕터 14 - Swagger**에서는 작성한 API를 문서화한다. `@nestjs/swagger`를 사용하여 자동으로 API 명세서를 생성하고, 브라우저에서 바로 API를 테스트할 수 있는 인터페이스를 만든다.
