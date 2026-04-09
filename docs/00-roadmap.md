# NestJS 학습 로드맵

> 각 챕터는 **개념 학습 → 기본 예제 → 블로그 API 적용** 3단계로 구성되어 있습니다.
> 모든 챕터를 순서대로 완료하면 **블로그 API 서버**가 완성됩니다.
>
> 챕터별 블로그 API 구현 명세는 [project-guide.md](./project-guide.md)를 참고하세요.

---

## Phase 1: 기초 — 프로젝트 뼈대 만들기

NestJS의 핵심 빌딩 블록을 이해하고, 블로그 API의 기본 CRUD를 완성합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 1 | Module | [01-module.md](./01-module.md) | 모듈 구조, imports/exports, 전역 모듈 | 프로젝트 뼈대 (모듈 분리) |
| 2 | Controller | [02-controller.md](./02-controller.md) | 라우팅, HTTP 메서드, 요청/응답 처리 | CRUD 라우트 정의 |
| 3 | Provider & DI | [03-provider-and-di.md](./03-provider-and-di.md) | 서비스, 의존성 주입, 커스텀 프로바이더 | 메모리 기반 CRUD 동작 |

> Phase 1을 마치면: curl로 게시글 CRUD가 동작하는 API 완성 (메모리 저장)

---

## Phase 2: 요청 파이프라인 — 안전한 API 만들기

요청이 컨트롤러에 도달하기까지의 파이프라인을 학습합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 4 | Middleware | [04-middleware.md](./04-middleware.md) | 미들웨어 작성, 적용, 실행 순서 | 요청 로깅 |
| 5 | Pipe | [05-pipe.md](./05-pipe.md) | 유효성 검사, DTO, ValidationPipe | 입력값 검증 |
| 6 | Guard | [06-guard.md](./06-guard.md) | 인증/인가, CanActivate, RBAC | 간이 인증 (헤더 기반) |

> Phase 2를 마치면: 잘못된 데이터는 거부, 인증 없이는 글 작성 불가

---

## Phase 3: 응답 & 에러 — 일관된 API 응답 만들기

응답 가공과 에러 처리를 학습합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 7 | Interceptor | [07-interceptor.md](./07-interceptor.md) | 응답 변환, 로깅, 타임아웃 | 응답 포맷 통일 |
| 8 | Exception Filter | [08-exception-filter.md](./08-exception-filter.md) | 예외 처리, 커스텀 예외, 전역 필터 | 에러 포맷 통일 |
| 9 | Custom Decorator | [09-custom-decorator.md](./09-custom-decorator.md) | 파라미터/합성 데코레이터 | @CurrentUser, @Public |

> Phase 3을 마치면: 성공/에러 모두 `{ success, data/error, timestamp }` 통일 포맷

---

## Phase 4: 데이터 — 실제 DB 연동

메모리 저장을 실제 데이터베이스로 교체합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 10 | TypeORM | [10-typeorm.md](./10-typeorm.md) | Entity, Repository, CRUD, 관계 설정 | SQLite DB 연동 |

> Phase 4를 마치면: 서버를 재시작해도 데이터가 유지됨

---

## Phase 5: 설정 & 인증 — 실전 수준으로 업그레이드

환경 변수 관리, JWT 인증, 테스트를 학습합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 11 | Configuration | [11-configuration.md](./11-configuration.md) | 환경 변수, ConfigModule, 네임스페이스 | .env 기반 설정 관리 |
| 12 | Authentication | [12-authentication.md](./12-authentication.md) | Passport.js, JWT, Refresh Token | JWT 인증 시스템 |
| 13 | Testing | [13-testing.md](./13-testing.md) | 단위/통합/E2E 테스트, Jest | 핵심 로직 테스트 코드 |

> Phase 5를 마치면: JWT 로그인, 환경 변수 관리, 테스트 코드 완비

---

## Phase 6: API 문서화 & 실시간 통신

API 문서 자동화와 실시간 기능을 학습합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 14 | Swagger | [14-swagger.md](./14-swagger.md) | OpenAPI, 데코레이터, DTO 스키마 | API 문서 자동 생성 |
| 15 | WebSocket | [15-websocket.md](./15-websocket.md) | Gateway, Socket.IO, Room | 실시간 댓글 알림 |

> Phase 6을 마치면: Swagger UI에서 API 테스트 가능, 실시간 댓글 알림

---

## Phase 7: 아키텍처 패턴 — 대규모 앱을 위한 설계

고급 아키텍처 패턴을 학습합니다.

| 순서 | 챕터 | 파일 | 핵심 개념 | 블로그 API 결과물 |
|------|------|------|-----------|-------------------|
| 16 | CQRS | [16-cqrs.md](./16-cqrs.md) | Command/Query 분리, EventBus, Saga | 게시글 CQRS 리팩토링 |
| 17 | Microservices | [17-microservices.md](./17-microservices.md) | TCP/Redis, MessagePattern, 하이브리드 앱 | 알림 마이크로서비스 분리 |

> Phase 7을 마치면: **블로그 API + 알림 마이크로서비스 = 현재 로드맵 완성!**

---

## Phase 8+: 확장 학습 (추가 예정)

Phase 7 이후에도 학습을 이어갈 수 있습니다. 아래 주제들이 추가될 수 있습니다.

| 주제 | 핵심 개념 |
|------|-----------|
| GraphQL | Schema, Resolver, DataLoader |
| Docker | 컨테이너화, docker-compose |
| Redis | 캐싱, 세션, Pub/Sub |
| Kafka | 메시지 큐, 이벤트 스트리밍 |
| gRPC | Protocol Buffers, 고성능 통신 |
| CI/CD | GitHub Actions, 자동 배포 |

> 새 챕터가 추가되면 이 로드맵도 함께 업데이트됩니다.

---

## 블로그 API 성장 과정

```
Phase 1  │ 모듈 분리 → 라우트 정의 → 메모리 CRUD 동작
         │
Phase 2  │ + 로깅 → + DTO 검증 → + 인증(간이)
         │
Phase 3  │ + 응답 포맷 통일 → + 에러 포맷 통일 → + 커스텀 데코레이터
         │
Phase 4  │ + SQLite 데이터베이스 연동
         │
Phase 5  │ + 환경 변수 관리 → + JWT 인증 → + 테스트 코드
         │
Phase 6  │ + Swagger API 문서 → + 실시간 댓글 알림
         │
Phase 7  │ + CQRS 패턴 → + 알림 마이크로서비스 ── 완성!
```

---

## NestJS 요청 라이프사이클

```
Client Request
    │
    ▼
 Middleware        ← Phase 2 (챕터 4)
    │
    ▼
  Guard            ← Phase 2 (챕터 6)
    │
    ▼
 Interceptor (pre) ← Phase 3 (챕터 7)
    │
    ▼
   Pipe            ← Phase 2 (챕터 5)
    │
    ▼
 Controller        ← Phase 1 (챕터 2)
    │
    ▼
  Service          ← Phase 1 (챕터 3)
    │
    ▼
 Interceptor (post)← Phase 3 (챕터 7)
    │
    ▼
 Exception Filter  ← Phase 3 (챕터 8)
    │
    ▼
Client Response
```

---

## 학습 팁

1. **순서대로 진행**: 각 챕터는 이전 내용을 이어받아 블로그 API를 확장합니다
2. **3단계 따라가기**: 개념 학습 → 기본 예제 → 블로그 API 적용 순서로 읽으세요
3. **직접 코딩**: 예제 코드를 직접 타이핑하고 실행해보세요 (복붙보다 효과적!)
4. **공식 문서 병행**: [NestJS 공식 문서](https://docs.nestjs.com)와 함께 보면 더 효과적입니다
5. **라이프사이클 이해**: 위 다이어그램을 항상 머릿속에 두세요
