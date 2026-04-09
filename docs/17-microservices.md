# 챕터 17 - Microservices

> **이전 챕터 요약**: 챕터 16에서 PostsModule을 CQRS 패턴으로 리팩토링하여 Command(쓰기)와 Query(읽기)를 분리했다. 이번 챕터에서는 **Microservices**를 학습한다. 알림 기능을 독립적인 마이크로서비스로 분리하여 블로그 프로젝트를 완성한다.


## 목차

1. [마이크로서비스란?](#마이크로서비스란)
2. [NestJS 마이크로서비스 개요](#nestjs-마이크로서비스-개요)
3. [Transport Layer](#transport-layer)
4. [@MessagePattern vs @EventPattern](#messagepattern-vs-eventpattern)
5. [ClientProxy (send, emit)](#clientproxy-send-emit)
6. [하이브리드 애플리케이션](#하이브리드-애플리케이션)
7. [기본 예제: TCP 마이크로서비스](#기본-예제-tcp-마이크로서비스)
8. [블로그 API 적용: 알림 마이크로서비스](#블로그-api-적용-알림-마이크로서비스)
9. [RpcException과 에러 처리](#rpcexception과-에러-처리)
10. [재시도 로직 (Retry)](#재시도-로직-retry)
11. [마이크로서비스 실행 방법](#마이크로서비스-실행-방법)
12. [전체 프로젝트 완성](#전체-프로젝트-완성)

---

## 1단계: 개념 학습

---

## 마이크로서비스란?

### 쉬운 비유: 식당으로 이해하기

마이크로서비스를 이해하는 가장 쉬운 방법은 **식당**에 비유하는 것이다.

**모놀리식 = 1인 식당**
주방장 한 명이 주문 받기, 요리, 서빙, 계산, 설거지를 모두 한다. 손님이 적을 때는 효율적이지만, 손님이 많아지면 한 명이 모든 것을 감당할 수 없다. 요리 중에 계산을 해야 하면 요리가 멈춘다.

**마이크로서비스 = 전문 식당**
주문 담당, 주방(한식/양식/디저트 파트), 서빙 담당, 계산 담당이 각자 맡은 역할만 수행한다. 주방에서 문제가 생겨도 계산은 정상적으로 돌아간다. 손님이 많아지면 주방 인원만 늘리면 된다.

### 모놀리식 아키텍처

**모놀리식(Monolithic) 아키텍처**는 하나의 애플리케이션에 모든 기능이 포함된 구조다.

```
┌─────────────────────────────────┐
│         모놀리식 애플리케이션        │
│  ┌─────┐ ┌─────┐ ┌───────────┐  │
│  │ User│ │ Post│ │  Comment  │  │
│  └─────┘ └─────┘ └───────────┘  │
│  ┌──────────────────────────────┐│
│  │      하나의 데이터베이스         ││
│  └──────────────────────────────┘│
└─────────────────────────────────┘
     ↑ 하나의 프로세스, 하나의 배포
```

| 장점 | 단점 |
|------|------|
| 개발 초기에 단순하고 빠르다 | 규모가 커지면 코드가 복잡해진다 |
| 배포가 간단하다 (하나만 배포) | 작은 변경에도 전체를 재배포해야 한다 |
| 로컬에서 테스트하기 쉽다 | 특정 기능만 스케일링할 수 없다 |

### 마이크로서비스 아키텍처

**마이크로서비스(Microservices) 아키텍처**는 애플리케이션을 독립적인 작은 서비스들로 분리하는 구조다. 각 서비스는 네트워크를 통해 서로 통신한다.

```
┌──────────┐    ┌──────────┐    ┌──────────────┐
│   Blog   │    │  Auth    │    │ Notification │
│  Service │◄──►│  Service │    │   Service    │
│  ┌────┐  │    │  ┌────┐  │    │   ┌────┐     │
│  │ DB │  │    │  │ DB │  │    │   │ DB │     │
│  └────┘  │    │  └────┘  │    │   └────┘     │
└──────────┘    └──────────┘    └──────────────┘
       ▲               ▲               ▲
       └───────────────┼───────────────┘
                       │
              ┌────────────────┐
              │  API Gateway   │
              └────────────────┘
                       ▲
                       │
                    Client
```

| 장점 | 단점 |
|------|------|
| 서비스별 독립 배포/스케일링 가능 | 분산 시스템 복잡성 증가 |
| 장애가 전체로 전파되지 않음 | 서비스 간 통신 비용 발생 |
| 팀 단위로 서비스 분리 개발 가능 | 데이터 일관성 유지가 어려움 |
| 서비스별 다른 기술 스택 사용 가능 | 운영/모니터링이 복잡함 |

> **팁:**: 처음부터 마이크로서비스로 시작할 필요는 없다. 대부분의 프로젝트는 **모놀리식으로 시작**하고, 서비스가 성장하면서 특정 기능을 마이크로서비스로 **점진적으로 분리**하는 것이 일반적이다. 우리 블로그 API도 이 방식을 따른다!

---

## NestJS 마이크로서비스 개요

NestJS는 `@nestjs/microservices` 패키지를 통해 마이크로서비스를 기본 지원한다. 가장 큰 장점은 **HTTP 기반 REST API와 동일한 데코레이터 기반 개발 경험**을 마이크로서비스에서도 그대로 사용할 수 있다는 것이다.

### 설치

```bash
npm install @nestjs/microservices
```

> **팁:**: TCP 기반 통신은 추가 패키지가 필요 없다. Redis, RabbitMQ 등 다른 Transport를 사용할 때만 추가 패키지를 설치하면 된다.

### 두 가지 통신 패턴

NestJS 마이크로서비스는 두 가지 핵심 통신 패턴을 제공한다.

```
┌─────────────────────────────────────────────────────────────┐
│                  Request-Response 패턴                       │
│                                                             │
│  Client ──send()──▶ @MessagePattern() ──응답 반환──▶ Client │
│          "요청하고 응답을 기다린다"                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  Event-based 패턴                            │
│                                                             │
│  Client ──emit()──▶ @EventPattern()                        │
│          "이벤트를 보내고 잊는다 (fire-and-forget)"            │
└─────────────────────────────────────────────────────────────┘
```

| 패턴 | 데코레이터 | 클라이언트 메서드 | 응답 | 사용 예 |
|------|-----------|----------------|------|---------|
| Request-Response | `@MessagePattern()` | `client.send()` | 있음 | 데이터 조회, 사용자 인증 |
| Event-based | `@EventPattern()` | `client.emit()` | 없음 | 알림 발송, 로그 기록 |

---

## Transport Layer

Transport Layer는 마이크로서비스 간 **메시지를 주고받는 통로**다. 택배를 보낼 때 우체국, 택배사, 퀵서비스 중 선택하는 것과 같다.

NestJS는 다양한 Transport를 지원하며, `Transport` enum으로 선택한다.

| Transport | enum 값 | 추가 패키지 | 특징 | 사용 사례 |
|-----------|---------|------------|------|----------|
| **TCP** | `Transport.TCP` | 없음 | 가장 단순, 별도 인프라 불필요 | 학습용, 간단한 서비스 분리 |
| **Redis** | `Transport.REDIS` | `ioredis` | Pub/Sub 기반, 빠름 | 이벤트 브로드캐스트, 캐시 연동 |
| **RabbitMQ** | `Transport.RMQ` | `amqplib`, `amqp-connection-manager` | 안정적 메시지 큐 | 주문 처리, 안정성이 중요한 작업 |
| **Kafka** | `Transport.KAFKA` | `kafkajs` | 대용량 스트리밍 | 로그 수집, 실시간 데이터 파이프라인 |
| **gRPC** | `Transport.GRPC` | `@grpc/grpc-js`, `@grpc/proto-loader` | 바이너리 프로토콜, 고성능 | 서비스 간 고속 통신, 다중 언어 환경 |
| **NATS** | `Transport.NATS` | `nats` | 경량, 클라우드 네이티브 | 클라우드 환경, 경량 메시징 |

> **팁:**: 이번 챕터에서는 **TCP**를 사용한다. 별도 인프라(Redis 서버, RabbitMQ 서버 등)를 설치할 필요가 없어서 학습에 가장 적합하다. 개념을 이해하면 Transport만 바꿔서 Redis나 RabbitMQ로 쉽게 전환할 수 있다.

---

## @MessagePattern vs @EventPattern

### @MessagePattern - "질문하고 답을 받는다"

`@MessagePattern()`은 **Request-Response** 패턴에 사용한다. 클라이언트가 메시지를 보내면, 핸들러가 처리 결과를 **응답으로 반환**한다.

```typescript
// math.controller.ts - 마이크로서비스 측 (메시지를 받는 쪽)
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

@Controller()
export class MathController {
  // 패턴: { cmd: 'sum' } 메시지가 오면 이 핸들러가 실행된다
  @MessagePattern({ cmd: 'sum' })
  accumulate(@Payload() data: number[]): number {
    return (data || []).reduce((a, b) => a + b, 0);
    // 반환값이 클라이언트에게 응답으로 전달된다
  }
}
```

패턴은 **문자열**이나 **객체** 형태로 자유롭게 정의할 수 있다.

```typescript
// 문자열 패턴
@MessagePattern('get_users')

// 객체 패턴 - 여러 속성으로 더 세밀하게 매칭
@MessagePattern({ cmd: 'get_user', role: 'admin' })
```

### @EventPattern - "알리고 잊는다"

`@EventPattern()`은 **Event-based** 패턴에 사용한다. 이벤트를 수신하여 처리하지만, **응답을 반환하지 않는다**. Fire-and-forget 방식이다.

```typescript
// notification.controller.ts - 마이크로서비스 측
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class NotificationController {
  // 'comment_created' 이벤트가 오면 실행된다
  @EventPattern('comment_created')
  handleCommentCreated(@Payload() data: { postId: number; author: string }) {
    console.log(`새 댓글 알림: ${data.author}님이 게시글 ${data.postId}에 댓글을 남겼습니다`);
    // 반환값이 있어도 클라이언트에 전달되지 않는다
  }
}
```

### 비교 정리

```
@MessagePattern (Request-Response)
  Client: "3 + 5는 뭐야?" ──send()──▶ Server: "8이야!" ──▶ Client가 8을 받음

@EventPattern (Event-based)
  Client: "댓글이 달렸어!" ──emit()──▶ Server: (알림 처리) ──▶ Client는 응답 안 기다림
```

---

## ClientProxy (send, emit)

마이크로서비스에 메시지를 보내려면 **ClientProxy**를 사용한다. `ClientsModule`로 등록하고 의존성 주입을 받는다.

### 클라이언트 등록

```typescript
// app.module.ts - 메시지를 보내는 쪽
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MATH_SERVICE',       // 주입 토큰 이름
        transport: Transport.TCP,    // Transport 종류
        options: {
          host: '127.0.0.1',        // 마이크로서비스 호스트
          port: 3001,               // 마이크로서비스 포트
        },
      },
    ]),
  ],
})
export class AppModule {}
```

### send() - 요청하고 응답 받기

`send()`는 `@MessagePattern()`에 매칭된다. **Observable**을 반환하므로, `firstValueFrom()`으로 Promise로 변환해서 사용하는 것이 편리하다.

```typescript
// app.controller.ts
import { Controller, Get, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller()
export class AppController {
  constructor(
    @Inject('MATH_SERVICE') private readonly mathClient: ClientProxy,
  ) {}

  @Get('sum')
  async getSum() {
    //          send(패턴, 데이터) → Observable 반환
    const result = await firstValueFrom(
      this.mathClient.send<number>({ cmd: 'sum' }, [1, 2, 3, 4, 5]),
    );
    return { result }; // { result: 15 }
  }
}
```

### emit() - 이벤트 발행 (응답 없음)

`emit()`은 `@EventPattern()`에 매칭된다. 이벤트를 보내고 **응답을 기다리지 않는다**.

```typescript
// comment.controller.ts
import { Controller, Post, Body, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Controller('comments')
export class CommentController {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  @Post()
  async createComment(@Body() body: { postId: number; content: string }) {
    // 댓글 생성 로직 ...

    // 이벤트 발행 - 응답을 기다리지 않는다 (fire-and-forget)
    this.notificationClient.emit('comment_created', {
      postId: body.postId,
      author: '홍길동',
    });

    return { message: '댓글이 작성되었습니다' };
  }
}
```

> **팁:**: `send()`는 반드시 구독(subscribe)되어야 메시지가 전송된다. `firstValueFrom()`이나 `.subscribe()`를 호출하지 않으면 메시지가 보내지지 않으니 주의하자. 반면 `emit()`은 호출 즉시 이벤트가 전송된다.

---

## 하이브리드 애플리케이션

하이브리드 애플리케이션은 **HTTP 서버와 마이크로서비스 서버를 하나의 NestJS 앱에서 동시에** 실행하는 방식이다. 기존 REST API를 유지하면서, 다른 마이크로서비스로부터 메시지도 받을 수 있다.

```
┌─────────────────────────────────────────────┐
│          하이브리드 NestJS 앱                  │
│                                             │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │ HTTP 서버    │    │ 마이크로서비스 서버    │ │
│  │ (포트 3000)  │    │ (TCP 포트 3001)      │ │
│  │             │    │                     │ │
│  │ @Get()      │    │ @MessagePattern()   │ │
│  │ @Post()     │    │ @EventPattern()     │ │
│  └─────────────┘    └─────────────────────┘ │
└─────────────────────────────────────────────┘
```

```typescript
// main.ts - 하이브리드 앱 설정
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1. HTTP 서버 생성 (기존과 동일)
  const app = await NestFactory.create(AppModule);

  // 2. 마이크로서비스 연결 추가
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 3001,
    },
  });

  // 3. 모든 마이크로서비스 시작
  await app.startAllMicroservices();

  // 4. HTTP 서버 시작
  await app.listen(3000);

  console.log('HTTP 서버: http://localhost:3000');
  console.log('TCP 마이크로서비스: 포트 3001');
}
bootstrap();
```

> **팁:**: 하이브리드 앱은 **기존 모놀리식 앱을 마이크로서비스로 점진적으로 전환**할 때 매우 유용하다. HTTP API는 그대로 유지하면서, 다른 서비스와 마이크로서비스 프로토콜로 통신할 수 있다. 우리 블로그 API도 이 방식을 사용할 것이다!

---

## 2단계: 기본 예제

---

## 기본 예제: TCP 마이크로서비스

본격적인 블로그 API 적용 전에, 간단한 TCP 마이크로서비스 예제로 감을 잡아보자.

### 예제 1: MessagePattern - 계산기 마이크로서비스

**마이크로서비스 서버 (포트 3001)**

```typescript
// calculator-service/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Module, Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

// 컨트롤러: 메시지 핸들러 정의
@Controller()
class CalcController {
  @MessagePattern({ cmd: 'add' })
  add(@Payload() data: { a: number; b: number }): number {
    console.log(`덧셈 요청: ${data.a} + ${data.b}`);
    return data.a + data.b;
  }

  @MessagePattern({ cmd: 'multiply' })
  multiply(@Payload() data: { a: number; b: number }): number {
    console.log(`곱셈 요청: ${data.a} * ${data.b}`);
    return data.a * data.b;
  }
}

// 모듈
@Module({ controllers: [CalcController] })
class AppModule {}

// 부트스트랩
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: { host: '127.0.0.1', port: 3001 },
    },
  );
  await app.listen();
  console.log('계산기 마이크로서비스 시작 (포트 3001)');
}
bootstrap();
```

**HTTP 클라이언트 (포트 3000)**

```typescript
// api-gateway/main.ts
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientsModule, Transport, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('calc')
class CalcController {
  constructor(
    @Inject('CALC_SERVICE') private readonly client: ClientProxy,
  ) {}

  // GET /calc/add?a=10&b=20 → { result: 30 }
  @Get('add')
  async add(@Query('a') a: string, @Query('b') b: string) {
    const result = await firstValueFrom(
      this.client.send<number>({ cmd: 'add' }, { a: +a, b: +b }),
    );
    return { result };
  }

  // GET /calc/multiply?a=5&b=6 → { result: 30 }
  @Get('multiply')
  async multiply(@Query('a') a: string, @Query('b') b: string) {
    const result = await firstValueFrom(
      this.client.send<number>({ cmd: 'multiply' }, { a: +a, b: +b }),
    );
    return { result };
  }
}

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CALC_SERVICE',
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: 3001 },
      },
    ]),
  ],
  controllers: [CalcController],
})
class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('API Gateway 시작: http://localhost:3000');
}
bootstrap();
```

**테스트:**

```bash
# 터미널 1: 마이크로서비스 실행
# 터미널 2: API Gateway 실행

# 덧셈
curl "http://localhost:3000/calc/add?a=10&b=20"
# → { "result": 30 }

# 곱셈
curl "http://localhost:3000/calc/multiply?a=5&b=6"
# → { "result": 30 }
```

### 예제 2: EventPattern - 로그 수집 마이크로서비스

```typescript
// log-service/log.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class LogController {
  // 이벤트를 수신만 한다. 응답을 반환하지 않는다.
  @EventPattern('user_login')
  handleUserLogin(@Payload() data: { userId: number; timestamp: string }) {
    console.log(`[로그] 사용자 로그인 - ID: ${data.userId}, 시간: ${data.timestamp}`);
    // DB에 로그 저장 등의 처리
  }

  @EventPattern('page_view')
  handlePageView(@Payload() data: { page: string; userId: number }) {
    console.log(`[로그] 페이지 조회 - ${data.page} (사용자: ${data.userId})`);
  }
}
```

```typescript
// api-gateway 측에서 이벤트 발행
@Controller('auth')
export class AuthController {
  constructor(
    @Inject('LOG_SERVICE') private readonly logClient: ClientProxy,
  ) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    // 로그인 로직 수행 ...
    const user = { id: 1, email: body.email };

    // 로그 이벤트 발행 (응답을 기다리지 않음)
    this.logClient.emit('user_login', {
      userId: user.id,
      timestamp: new Date().toISOString(),
    });

    return { message: '로그인 성공', user };
  }
}
```

> **핵심 차이 정리:**
> - `send()` + `@MessagePattern()` = "요청 → 응답" (데이터가 필요할 때)
> - `emit()` + `@EventPattern()` = "알림 → 끝" (처리만 하면 될 때)

---

## 3단계: 블로그 API 적용

---

## 블로그 API 적용: 알림 마이크로서비스

> **챕터 16과의 연결**: 챕터 16에서 CQRS 패턴으로 리팩토링한 `PostsModule`은 그대로 유지한다. `CreatePostCommand` → `CreatePostHandler` 흐름은 변경하지 않고, 댓글 작성 시점에만 알림 서비스를 분리하여 **기존 CQRS 아키텍처 위에 마이크로서비스를 점진적으로 추가**하는 방식을 사용한다. 예를 들어 `CreateCommentHandler` 내부에서 `notificationClient.emit()`을 호출하면, CQRS와 마이크로서비스를 자연스럽게 결합할 수 있다.

드디어 우리 블로그 API에 마이크로서비스를 적용할 차례다! **알림(Notification) 기능을 별도의 마이크로서비스로 분리**한다.

### 시나리오

사용자가 게시글에 댓글을 작성하면, 블로그 API가 알림 마이크로서비스에 이벤트를 보내고, 알림 서비스가 해당 이벤트를 받아 알림을 처리한다.

```
사용자가 댓글 작성
       │
       ▼
┌──────────────────┐         TCP (emit)        ┌───────────────────────┐
│   Blog API       │ ────────────────────────▶ │ Notification Service  │
│   (HTTP:3000)    │   'comment_created'       │ (TCP:3001)            │
│   (TCP:3002)     │                           │                       │
│                  │◀──── send/응답 ───────────│                       │
│  - 게시글 CRUD   │   { cmd: 'get_notifs' }   │  - 이벤트 수신        │
│  - 댓글 CRUD     │                           │  - 알림 기록          │
│  - 사용자 관리   │                           │  - 알림 목록 반환      │
└──────────────────┘                           └───────────────────────┘
   하이브리드 앱                                   마이크로서비스
  (HTTP + TCP)
```

### 프로젝트 구조

기존 블로그 API 프로젝트에 알림 관련 파일을 추가한다.

```
src/
├── app.module.ts                    ← 수정: ClientsModule 추가
├── main.ts                          ← 수정: 하이브리드 앱으로 변경
│
├── comments/
│   ├── comments.controller.ts
│   ├── comments.service.ts          ← 수정: 댓글 작성 시 이벤트 발행
│   └── comments.module.ts           ← 수정: ClientsModule import
│
├── notifications/                   ← 새로 추가!
│   ├── notifications.module.ts
│   ├── notifications.controller.ts  ← @EventPattern, @MessagePattern 핸들러
│   └── notifications.service.ts     ← 알림 비즈니스 로직
│
└── ... (기존 파일들)

notification-service/                ← 별도 마이크로서비스 앱 (선택적)
├── main.ts
└── ... (독립 실행 시 사용)
```

### Step 1: 알림 서비스 모듈 만들기

먼저 알림 기능을 담당하는 모듈을 만든다.

```typescript
// src/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';

// 알림 데이터 타입
export interface Notification {
  id: number;
  type: string;           // 'comment_created', 'post_liked' 등
  message: string;
  recipientId: number;    // 알림을 받을 사용자 ID
  postId?: number;
  commentId?: number;
  isRead: boolean;
  createdAt: Date;
}

@Injectable()
export class NotificationsService {
  // 인메모리 저장소 (실무에서는 DB 사용)
  private notifications: Notification[] = [];
  private nextId = 1;

  // 알림 생성
  create(data: {
    type: string;
    message: string;
    recipientId: number;
    postId?: number;
    commentId?: number;
  }): Notification {
    const notification: Notification = {
      id: this.nextId++,
      ...data,
      isRead: false,
      createdAt: new Date(),
    };
    this.notifications.push(notification);

    console.log(`[알림 서비스] 새 알림 생성: "${notification.message}"`);
    return notification;
  }

  // 특정 사용자의 알림 목록 조회
  findByRecipient(recipientId: number): Notification[] {
    return this.notifications
      .filter((n) => n.recipientId === recipientId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 읽지 않은 알림 개수
  countUnread(recipientId: number): number {
    return this.notifications.filter(
      (n) => n.recipientId === recipientId && !n.isRead,
    ).length;
  }

  // 알림 읽음 처리
  markAsRead(notificationId: number): Notification | null {
    const notification = this.notifications.find((n) => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
    }
    return notification;
  }
}
```

### Step 2: 알림 컨트롤러 (이벤트 수신 + 메시지 처리)

이 컨트롤러는 마이크로서비스 메시지와 이벤트를 처리한다.

```typescript
// src/notifications/notifications.controller.ts
import { Controller } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ──────────────────────────────────────────────
  // EventPattern: 이벤트를 수신하여 처리 (응답 없음)
  // ──────────────────────────────────────────────

  @EventPattern('comment_created')
  handleCommentCreated(
    @Payload()
    data: {
      postId: number;
      postTitle: string;
      commentId: number;
      authorName: string;
      postAuthorId: number;
    },
  ) {
    console.log('──────────────────────────────────────');
    console.log('[알림 서비스] 댓글 작성 이벤트 수신!');
    console.log(`  게시글: "${data.postTitle}" (ID: ${data.postId})`);
    console.log(`  댓글 작성자: ${data.authorName}`);
    console.log('──────────────────────────────────────');

    // 게시글 작성자에게 알림 생성
    this.notificationsService.create({
      type: 'comment_created',
      message: `${data.authorName}님이 "${data.postTitle}" 게시글에 댓글을 남겼습니다.`,
      recipientId: data.postAuthorId,
      postId: data.postId,
      commentId: data.commentId,
    });
  }

  @EventPattern('post_liked')
  handlePostLiked(
    @Payload()
    data: {
      postId: number;
      postTitle: string;
      likerName: string;
      postAuthorId: number;
    },
  ) {
    console.log(`[알림 서비스] 좋아요 이벤트: ${data.likerName}님이 "${data.postTitle}"에 좋아요`);

    this.notificationsService.create({
      type: 'post_liked',
      message: `${data.likerName}님이 "${data.postTitle}" 게시글에 좋아요를 눌렀습니다.`,
      recipientId: data.postAuthorId,
      postId: data.postId,
    });
  }

  // ──────────────────────────────────────────────
  // MessagePattern: 요청을 받고 응답을 반환
  // ──────────────────────────────────────────────

  @MessagePattern({ cmd: 'get_notifications' })
  getNotifications(@Payload() data: { recipientId: number }) {
    console.log(`[알림 서비스] 알림 목록 조회 요청 - 사용자 ID: ${data.recipientId}`);
    return this.notificationsService.findByRecipient(data.recipientId);
  }

  @MessagePattern({ cmd: 'get_unread_count' })
  getUnreadCount(@Payload() data: { recipientId: number }) {
    const count = this.notificationsService.countUnread(data.recipientId);
    console.log(`[알림 서비스] 읽지 않은 알림 수: ${count}`);
    return { count };
  }

  @MessagePattern({ cmd: 'mark_as_read' })
  markAsRead(@Payload() data: { notificationId: number }) {
    const notification = this.notificationsService.markAsRead(data.notificationId);
    return notification
      ? { success: true, notification }
      : { success: false, message: '알림을 찾을 수 없습니다' };
  }
}
```

### Step 3: 알림 모듈 등록

```typescript
// src/notifications/notifications.module.ts
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
```

### Step 4: Comments 모듈에서 이벤트 발행

댓글이 작성될 때 알림 서비스로 이벤트를 보내도록 수정한다.

```typescript
// src/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    // 알림 마이크로서비스 클라이언트 등록
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3001,
        },
      },
    ]),
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

```typescript
// src/comments/comments.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class CommentsService {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
    // ... 기존 의존성 (Repository 등)
  ) {}

  async createComment(
    postId: number,
    content: string,
    authorId: number,
    authorName: string,
  ) {
    // 1. 댓글 저장 (기존 로직)
    const comment = {
      id: Date.now(),
      postId,
      content,
      authorId,
      authorName,
      createdAt: new Date(),
    };

    // 2. 게시글 정보 조회 (기존 로직, 예시)
    const post = { id: postId, title: '예제 게시글', authorId: 99 };

    // 3. 알림 마이크로서비스에 이벤트 발행!
    //    게시글 작성자 본인이 댓글을 단 경우에는 알림을 보내지 않는다
    if (post.authorId !== authorId) {
      this.notificationClient.emit('comment_created', {
        postId: post.id,
        postTitle: post.title,
        commentId: comment.id,
        authorName: authorName,
        postAuthorId: post.authorId,  // 알림을 받을 사람
      });

      console.log(`[Blog API] 알림 이벤트 발행 완료 → comment_created`);
    }

    return comment;
  }
}
```

### Step 5: 알림 조회 HTTP 엔드포인트 추가

사용자가 자신의 알림을 HTTP로 조회할 수 있도록 엔드포인트를 추가한다.

```typescript
// src/notifications/notifications-http.controller.ts
import { Controller, Get, Patch, Param, Inject, ParseIntPipe } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('notifications')
export class NotificationsHttpController {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  // GET /notifications/user/1 → 사용자 1의 알림 목록
  @Get('user/:userId')
  async getNotifications(@Param('userId', ParseIntPipe) userId: number) {
    const notifications = await firstValueFrom(
      this.notificationClient.send({ cmd: 'get_notifications' }, { recipientId: userId }),
    );
    return { data: notifications };
  }

  // GET /notifications/user/1/unread-count → 읽지 않은 알림 수
  @Get('user/:userId/unread-count')
  async getUnreadCount(@Param('userId', ParseIntPipe) userId: number) {
    return firstValueFrom(
      this.notificationClient.send({ cmd: 'get_unread_count' }, { recipientId: userId }),
    );
  }

  // PATCH /notifications/5/read → 알림 읽음 처리
  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return firstValueFrom(
      this.notificationClient.send({ cmd: 'mark_as_read' }, { notificationId: id }),
    );
  }
}
```

### Step 6: AppModule 통합

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

// 기존 모듈들
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
// ... 기타 기존 모듈들

// 새로 추가
import { NotificationsModule } from './notifications/notifications.module';
import { NotificationsHttpController } from './notifications/notifications-http.controller';

@Module({
  imports: [
    // 기존 모듈들
    UsersModule,
    PostsModule,
    CommentsModule,
    // ... ConfigModule, TypeOrmModule 등 기존 설정

    // 알림 마이크로서비스 모듈 (이벤트 핸들러)
    NotificationsModule,

    // 알림 서비스 클라이언트 (HTTP 컨트롤러에서 send 요청 시 사용)
    ClientsModule.register([
      {
        name: 'NOTIFICATION_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 3001,
        },
      },
    ]),
  ],
  controllers: [NotificationsHttpController],
})
export class AppModule {}
```

### Step 7: main.ts - 하이브리드 앱 구성

기존 HTTP 서버에 TCP 마이크로서비스를 추가한다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // 1. HTTP 서버 생성 (기존과 동일)
  const app = await NestFactory.create(AppModule);

  // 2. 기존 글로벌 설정 유지
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // 3. TCP 마이크로서비스 연결 추가 (알림 서비스)
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 3001,
    },
  });

  // 4. 모든 마이크로서비스 시작
  await app.startAllMicroservices();

  // 5. HTTP 서버 시작
  await app.listen(3000);

  console.log('========================================');
  console.log('  블로그 API 서버 시작!');
  console.log('  HTTP: http://localhost:3000');
  console.log('  TCP 마이크로서비스: 포트 3001');
  console.log('========================================');
}
bootstrap();
```

> **팁:**: 위 하이브리드 앱 방식은 **같은 프로세스 안에서** HTTP와 TCP를 모두 처리한다. 실무에서 서비스를 완전히 분리하려면, 알림 마이크로서비스를 **별도의 NestJS 앱**으로 만들어 독립 배포하면 된다. 아래에서 그 방법도 설명한다.

### (선택) 알림 서비스를 독립 앱으로 분리

실무에서처럼 완전히 분리된 마이크로서비스를 만들고 싶다면 다음과 같이 구성한다.

```typescript
// notification-service/main.ts - 독립 마이크로서비스 앱
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
class NotificationAppModule {}

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    NotificationAppModule,
    {
      transport: Transport.TCP,
      options: {
        host: '127.0.0.1',
        port: 3001,
      },
    },
  );

  await app.listen();
  console.log('========================================');
  console.log('  알림 마이크로서비스 시작!');
  console.log('  TCP: 포트 3001');
  console.log('========================================');
}
bootstrap();
```

이 경우 블로그 API의 `main.ts`에서는 `connectMicroservice`를 제거하고, 두 앱을 **별도 터미널에서 각각 실행**한다.

```bash
# 터미널 1: 알림 마이크로서비스
cd notification-service && npm run start:dev

# 터미널 2: 블로그 API (HTTP만)
cd blog-api && npm run start:dev
```

### 전체 동작 흐름

```
사용자: POST /posts/1/comments { content: "좋은 글이네요!" }
       │
       ▼
┌─ Blog API (HTTP:3000) ──────────────────────────┐
│                                                  │
│  CommentsController.createComment()              │
│       │                                          │
│       ▼                                          │
│  CommentsService.createComment()                 │
│       │                                          │
│       ├─ 1. 댓글을 DB에 저장                       │
│       │                                          │
│       ├─ 2. notificationClient.emit(             │
│       │        'comment_created',                │
│       │        { postTitle, authorName, ... }     │
│       │     )                                    │
│       │                                          │
│       └─ 3. 클라이언트에 댓글 응답 반환              │
└──────────────┬───────────────────────────────────┘
               │ TCP (이벤트)
               ▼
┌─ Notification Service (TCP:3001) ────────────────┐
│                                                  │
│  NotificationsController                         │
│    @EventPattern('comment_created')              │
│       │                                          │
│       ▼                                          │
│  handleCommentCreated()                          │
│       │                                          │
│       ├─ 콘솔에 알림 출력                          │
│       └─ 알림 데이터 저장                          │
│                                                  │
│  ──────────────────────────────────────────────  │
│                                                  │
│  나중에 사용자가 GET /notifications/user/99 하면:   │
│                                                  │
│  NotificationsController                         │
│    @MessagePattern({ cmd: 'get_notifications' }) │
│       │                                          │
│       └─ 저장된 알림 목록을 응답으로 반환             │
└──────────────────────────────────────────────────┘
```

### 테스트하기

```bash
# 1. 서버 실행 후 댓글 작성
curl -X POST http://localhost:3000/posts/1/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "좋은 글이네요! 많이 배웠습니다.",
    "authorId": 2,
    "authorName": "김철수"
  }'

# 서버 콘솔 출력:
# [Blog API] 알림 이벤트 발행 완료 → comment_created
# ──────────────────────────────────────
# [알림 서비스] 댓글 작성 이벤트 수신!
#   게시글: "예제 게시글" (ID: 1)
#   댓글 작성자: 김철수
# ──────────────────────────────────────
# [알림 서비스] 새 알림 생성: "김철수님이 "예제 게시글" 게시글에 댓글을 남겼습니다."

# 2. 게시글 작성자(ID: 99)의 알림 목록 조회
curl http://localhost:3000/notifications/user/99
# → { "data": [{ "id": 1, "type": "comment_created", "message": "김철수님이 ...", ... }] }

# 3. 읽지 않은 알림 수 조회
curl http://localhost:3000/notifications/user/99/unread-count
# → { "count": 1 }

# 4. 알림 읽음 처리
curl -X PATCH http://localhost:3000/notifications/1/read
# → { "success": true, "notification": { ... , "isRead": true } }
```

---

## RpcException과 에러 처리

마이크로서비스에서 에러가 발생하면 HTTP 에러와 다른 방식으로 처리해야 한다. NestJS는 이를 위해 `RpcException`을 제공한다.

### RpcException 사용법

마이크로서비스 측(핸들러)에서 에러를 발생시킬 때는 `throw new Error()` 대신 **`RpcException`**을 사용한다.

```typescript
// src/notifications/notifications.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @MessagePattern({ cmd: 'mark_as_read' })
  markAsRead(@Payload() data: { notificationId: number }) {
    const notification = this.notificationsService.markAsRead(data.notificationId);

    if (!notification) {
      // RpcException으로 에러를 던져야 클라이언트가 올바르게 받을 수 있다
      throw new RpcException({
        statusCode: 404,
        message: `알림 ID ${data.notificationId}를 찾을 수 없습니다`,
      });
    }

    return { success: true, notification };
  }

  @MessagePattern({ cmd: 'get_notifications' })
  getNotifications(@Payload() data: { recipientId: number }) {
    if (!data.recipientId) {
      throw new RpcException({
        statusCode: 400,
        message: 'recipientId는 필수입니다',
      });
    }
    return this.notificationsService.findByRecipient(data.recipientId);
  }
}
```

> **팁:**: 일반 `Error`를 던지면 클라이언트에서 에러 객체를 제대로 파싱하지 못하는 경우가 있다. 마이크로서비스 핸들러에서는 항상 `RpcException`을 사용하자.

### ExceptionFilter로 마이크로서비스 에러를 HTTP 에러로 변환

API Gateway(HTTP 서버)에서 마이크로서비스 에러를 받으면, 기본적으로 `500 Internal Server Error`로 처리된다. `ExceptionFilter`를 사용해 **마이크로서비스 에러를 적절한 HTTP 상태코드로 변환**해야 한다.

```typescript
// src/common/filters/rpc-exception.filter.ts
import { Catch, ArgumentsHost, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Response } from 'express';
import { throwError } from 'rxjs';

@Catch(RpcException)
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: RpcException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // RpcException의 에러 객체를 꺼낸다
    const error = exception.getError() as {
      statusCode?: number;
      message?: string;
    };

    const statusCode = error?.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error?.message ?? '마이크로서비스 에러가 발생했습니다';

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

```typescript
// src/main.ts - 글로벌 필터 등록
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RpcExceptionFilter } from './common/filters/rpc-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 글로벌 RPC 예외 필터 등록
  app.useGlobalFilters(new RpcExceptionFilter());

  // ... 나머지 설정
  await app.listen(3000);
}
bootstrap();
```

컨트롤러 단위로 적용하고 싶다면 [`@UseFilters`](../references/decorators.md#usefiltersfilters) 데코레이터를 사용한다.

```typescript
// src/notifications/notifications-http.controller.ts
import { Controller, Get, Param, ParseIntPipe, UseFilters } from '@nestjs/common';
import { RpcExceptionFilter } from '../common/filters/rpc-exception.filter';

@Controller('notifications')
@UseFilters(new RpcExceptionFilter())  // 이 컨트롤러에만 적용
export class NotificationsHttpController {
  // ...
}
```

### API Gateway에서 마이크로서비스 에러 처리 패턴

`firstValueFrom()`으로 감싼 `send()` 호출에서 에러가 발생하면, `try-catch`로 잡아서 HTTP 에러로 재변환할 수도 있다.

```typescript
// src/notifications/notifications-http.controller.ts
import {
  Controller, Get, Patch, Param, Inject, ParseIntPipe,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Controller('notifications')
export class NotificationsHttpController {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  @Patch(':id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    try {
      return await firstValueFrom(
        this.notificationClient.send({ cmd: 'mark_as_read' }, { notificationId: id }),
      );
    } catch (error) {
      // RpcException에서 전달된 에러 객체를 HTTP 에러로 변환
      const statusCode = error?.statusCode ?? error?.status;
      if (statusCode === 404) {
        throw new NotFoundException(error.message);
      }
      if (statusCode === 400) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
```

```
에러 흐름:
마이크로서비스: throw new RpcException({ statusCode: 404, message: '...' })
       │
       ▼ TCP
API Gateway: catch(error) → throw new NotFoundException(...)
       │
       ▼ HTTP
클라이언트: { "statusCode": 404, "message": "..." }
```

---

## 재시도 로직 (Retry)

네트워크 불안정이나 마이크로서비스 일시 중단으로 요청이 실패할 수 있다. RxJS의 `retry()` 연산자를 활용하면 자동 재시도 로직을 쉽게 구현할 수 있다.

### retry() 기본 사용

```typescript
// src/notifications/notifications-http.controller.ts
import { Controller, Get, Param, ParseIntPipe, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, retry } from 'rxjs';

@Controller('notifications')
export class NotificationsHttpController {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  @Get('user/:userId')
  async getNotifications(@Param('userId', ParseIntPipe) userId: number) {
    const notifications = await firstValueFrom(
      this.notificationClient
        .send({ cmd: 'get_notifications' }, { recipientId: userId })
        .pipe(
          retry(3), // 실패 시 최대 3번 재시도
        ),
    );
    return { data: notifications };
  }
}
```

### 타임아웃 + 재시도 조합 패턴

실무에서는 `timeout()`과 `retry()`를 함께 사용하는 것이 일반적이다. 응답이 너무 오래 걸리면 타임아웃 처리하고, 그 후 재시도한다.

```typescript
// src/notifications/notifications-http.controller.ts
import {
  Controller, Get, Param, ParseIntPipe, Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  firstValueFrom,
  timeout,
  retry,
  catchError,
  throwError,
  TimeoutError,
} from 'rxjs';

@Controller('notifications')
export class NotificationsHttpController {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private readonly notificationClient: ClientProxy,
  ) {}

  @Get('user/:userId/unread-count')
  async getUnreadCount(@Param('userId', ParseIntPipe) userId: number) {
    return firstValueFrom(
      this.notificationClient
        .send({ cmd: 'get_unread_count' }, { recipientId: userId })
        .pipe(
          timeout(3000),  // 3초 안에 응답이 없으면 TimeoutError 발생
          retry({
            count: 2,       // 최대 2번 재시도
            delay: 1000,    // 재시도 전 1초 대기 (RxJS 7.4+)
          }),
          catchError((err) => {
            if (err instanceof TimeoutError) {
              return throwError(
                () => new InternalServerErrorException('알림 서비스 응답 시간 초과'),
              );
            }
            return throwError(() => err);
          }),
        ),
    );
  }

  // ─── 헬퍼: 공통 재시도 로직을 별도 메서드로 분리 ───
  private withRetry<T>(observable: import('rxjs').Observable<T>) {
    return observable.pipe(
      timeout(5000),
      retry({ count: 3, delay: 500 }),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(
            () => new InternalServerErrorException('서비스 응답 시간 초과'),
          );
        }
        return throwError(() => err);
      }),
    );
  }

  @Get('user/:userId')
  async getNotifications(@Param('userId', ParseIntPipe) userId: number) {
    const notifications = await firstValueFrom(
      this.withRetry(
        this.notificationClient.send(
          { cmd: 'get_notifications' },
          { recipientId: userId },
        ),
      ),
    );
    return { data: notifications };
  }
}
```

```
타임아웃 + 재시도 흐름:

1차 시도: send() → 3초 대기 → TimeoutError
2차 시도: (1초 후) send() → 3초 대기 → TimeoutError
3차 시도: (1초 후) send() → 성공 → 응답 반환
                             (or)
                          TimeoutError → InternalServerErrorException
```

> **팁:**: `retry()`는 `RpcException`이 발생해도 재시도한다. 비즈니스 로직 에러(404, 400 등)는 재시도가 의미 없으므로, `catchError`에서 `RpcException` 여부를 판별해 재시도 여부를 결정하는 것이 좋다.

---

## 마이크로서비스 실행 방법

### 하이브리드 앱 방식 (같은 프로세스)

하이브리드 앱은 하나의 터미널에서 실행한다.

```bash
# 터미널 1개만 필요
npm run start:dev
# → HTTP(3000) + TCP(3001) 동시 기동
```

### 독립 서비스 방식 (별도 프로세스)

알림 서비스를 별도 앱으로 분리했다면, **두 개의 터미널**에서 각각 실행한다.

```bash
# 터미널 1: 알림 마이크로서비스 먼저 실행
cd notification-service
npm run start:dev
# → TCP 마이크로서비스: 포트 3001

# 터미널 2: 블로그 API (HTTP) 실행
cd blog-api
npm run start:dev
# → HTTP 서버: http://localhost:3000
```

> **순서 중요**: 마이크로서비스(알림 서비스)를 먼저 실행해야 한다. API Gateway가 시작될 때 마이크로서비스에 연결을 시도하기 때문이다.

### package.json 스크립트 추가

모노레포 구조나 루트 `package.json`에 편의 스크립트를 추가하면 관리가 쉬워진다.

```json
// package.json (루트 또는 블로그 API 루트)
{
  "scripts": {
    "start:dev": "nest start --watch",
    "start:notification": "nest start notification-service --watch",
    "start:all": "concurrently \"npm run start:notification\" \"npm run start:dev\"",
    "build:notification": "nest build notification-service",
    "build:all": "npm run build && npm run build:notification"
  }
}
```

`concurrently` 패키지를 사용하면 **하나의 터미널**에서 두 서비스를 동시에 실행할 수 있다.

```bash
# concurrently 설치
npm install --save-dev concurrently

# 두 서비스를 동시에 실행
npm run start:all
```

```
터미널 출력 예시:
[notification] 알림 마이크로서비스 시작! TCP: 포트 3001
[blog-api]     블로그 API 서버 시작!
[blog-api]       HTTP: http://localhost:3000
[blog-api]       TCP 마이크로서비스: 포트 3002 (하이브리드)
```

### NestJS CLI 워크스페이스(Monorepo) 방식

`nest-cli.json`에 여러 앱을 등록하면 NestJS CLI 명령어로 각 앱을 편리하게 관리할 수 있다.

```json
// nest-cli.json
{
  "monorepo": true,
  "root": "apps/blog-api",
  "sourceRoot": "apps/blog-api/src",
  "projects": {
    "blog-api": {
      "type": "application",
      "root": "apps/blog-api",
      "entryFile": "main",
      "sourceRoot": "apps/blog-api/src"
    },
    "notification-service": {
      "type": "application",
      "root": "apps/notification-service",
      "entryFile": "main",
      "sourceRoot": "apps/notification-service/src"
    }
  }
}
```

```bash
# 각 앱을 NestJS CLI로 실행
nest start blog-api --watch
nest start notification-service --watch
```

---

## 전체 프로젝트 완성

### 우리가 만든 블로그 API의 최종 모습

17개 챕터를 거치며, 하나의 블로그 API를 **점진적으로** 완성했다.

```
┌─────────────────────────────────────────────────────────────────┐
│                      블로그 API 전체 구조                         │
│                                                                 │
│  ┌─ HTTP Server (포트 3000) ──────────────────────────────────┐ │
│  │                                                            │ │
│  │  Middleware → Guard → Interceptor → Pipe → Controller      │ │
│  │  (Ch.4)     (Ch.6)   (Ch.7)       (Ch.5)  (Ch.2)         │ │
│  │                                                            │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐   │ │
│  │  │  Auth    │ │  Users   │ │   Posts    │ │ Comments │   │ │
│  │  │  Module  │ │  Module  │ │   Module   │ │  Module  │   │ │
│  │  │ (Ch.12)  │ │ (Ch.1-3) │ │  (Ch.1-3)  │ │ (Ch.1-3) │   │ │
│  │  └──────────┘ └──────────┘ └────────────┘ └──────────┘   │ │
│  │                                                            │ │
│  │  ┌──────────────┐ ┌────────────┐ ┌──────────────────────┐ │ │
│  │  │   TypeORM    │ │   Config   │ │   Exception Filter   │ │ │
│  │  │   (Ch.10)    │ │   (Ch.11)  │ │      (Ch.8)          │ │ │
│  │  └──────────────┘ └────────────┘ └──────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌──────────────┐ ┌────────────┐ ┌──────────────────────┐ │ │
│  │  │   Swagger    │ │  WebSocket │ │   Custom Decorator   │ │ │
│  │  │   (Ch.14)    │ │   (Ch.15)  │ │      (Ch.9)          │ │ │
│  │  └──────────────┘ └────────────┘ └──────────────────────┘ │ │
│  │                                                            │ │
│  │  Testing (Ch.13) │ CQRS (Ch.16)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                    TCP (이벤트/메시지)                             │
│                          │                                      │
│  ┌─ Notification Microservice (포트 3001) ──────────────────┐   │
│  │                                                          │   │
│  │  @EventPattern('comment_created')  ← 댓글 알림           │   │
│  │  @EventPattern('post_liked')       ← 좋아요 알림          │   │
│  │  @MessagePattern('get_notifications') ← 알림 조회         │   │
│  │  @MessagePattern('get_unread_count')  ← 미읽 수           │   │
│  │                                          (Ch.17)         │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 챕터별 학습 내용 되돌아보기

| Phase | 챕터 | 배운 것 | 블로그 API에 적용한 것 |
|-------|------|--------|----------------------|
| **Phase 1** | Ch.1-3 | Module, Controller, Provider & DI | 도메인별 모듈 분리, CRUD 라우트, 서비스 분리 |
| **Phase 2** | Ch.4-6 | Middleware, Pipe, Guard | 요청 로깅, DTO 검증, 인증 가드 |
| **Phase 3** | Ch.7-9 | Interceptor, Exception Filter, Decorator | 응답 포맷 통일, 에러 처리, @CurrentUser |
| **Phase 4** | Ch.10 | TypeORM | 메모리 배열 → 실제 DB 교체 |
| **Phase 5** | Ch.11-13 | Config, Auth, Testing | 환경 변수, JWT 인증, 테스트 코드 |
| **Phase 6** | Ch.14-15 | Swagger, WebSocket | API 문서화, 실시간 댓글 알림 |
| **Phase 7** | Ch.16-17 | CQRS, Microservices | 아키텍처 패턴, 알림 서비스 분리 |

---

### 축하합니다! 블로그 API 프로젝트 완성!

17개 챕터를 모두 마쳤다. 단순한 "Hello World"에서 시작하여, 인증/인가, 데이터베이스, 실시간 통신, 아키텍처 패턴, 마이크로서비스까지 갖춘 블로그 API를 완성했다. 이 과정에서 NestJS의 거의 모든 핵심 기능을 학습했다.

---

### 다음 학습 방향 제안

NestJS 기본기를 마스터했으니, 다음 단계로 나아갈 수 있다.

**실무 심화 주제:**

| 주제 | 설명 | 추천 이유 |
|------|------|----------|
| **Docker & 배포** | Docker Compose로 멀티 서비스 구성 | 마이크로서비스를 실제로 분리 배포할 때 필수 |
| **Redis 기반 마이크로서비스** | TCP → Redis Pub/Sub 전환 | 더 안정적이고 실무에서 많이 사용 |
| **GraphQL** | `@nestjs/graphql` | REST 대안, 프론트엔드와 효율적 통신 |
| **캐싱** | `@nestjs/cache-manager` | API 성능 향상 |
| **Rate Limiting** | `@nestjs/throttler` | API 보안 강화 |
| **Health Check** | `@nestjs/terminus` | 마이크로서비스 모니터링 |
| **Task Scheduling** | `@nestjs/schedule` | Cron 작업, 배치 처리 |
| **Event Sourcing** | CQRS + Event Store | 대규모 시스템 아키텍처 |

**추천 학습 순서:**

```
Docker & 배포 → Redis 마이크로서비스 → 캐싱 → Health Check
                                         ↓
              Rate Limiting → GraphQL → Task Scheduling
```

> **팁:**: 가장 먼저 **Docker**를 학습하는 것을 추천한다. 이번 챕터에서 만든 마이크로서비스를 Docker Compose로 구성하면, 각 서비스를 독립적으로 빌드하고 배포하는 경험을 할 수 있다. 마이크로서비스와 Docker는 뗄 수 없는 관계이다!

---

> **정리:** 마이크로서비스는 애플리케이션을 독립적인 서비스들로 분리하는 아키텍처 패턴이다. NestJS는 `@nestjs/microservices` 패키지로 다양한 Transport Layer(TCP, Redis, Kafka 등)를 지원하며, `@MessagePattern`(요청-응답)과 `@EventPattern`(이벤트 기반) 두 가지 통신 패턴을 제공한다. 하이브리드 앱을 통해 기존 HTTP API에 마이크로서비스 기능을 점진적으로 추가할 수 있다. 블로그 API에서는 댓글 작성 시 알림 마이크로서비스로 이벤트를 발행하여, 서비스 분리의 첫걸음을 경험했다.
