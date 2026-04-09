# 챕터 12 - Authentication (인증)

> **이전 챕터 요약**: 챕터 11에서 `.env` 파일과 ConfigModule로 DB 연결 정보와 JWT 시크릿을 환경 변수로 분리했다. 이번 챕터에서는 **Authentication(인증)**을 구현한다. Passport.js + JWT로 로그인 시스템을 만들고 SimpleAuthGuard를 JwtAuthGuard로 교체한다.


## 목차

### 1단계: 개념 학습
1. [인증 vs 인가 - 쉬운 비유로 이해하기](#1-인증-vs-인가---쉬운-비유로-이해하기)
2. [JWT란 무엇인가](#2-jwt란-무엇인가)
3. [Passport.js와 NestJS 통합](#3-passportjs와-nestjs-통합)
4. [Strategy 패턴 (Local, JWT)](#4-strategy-패턴-local-jwt)
5. [bcrypt 비밀번호 해싱](#5-bcrypt-비밀번호-해싱)

### 2단계: 기본 예제
6. [Local Strategy 예제](#6-local-strategy-예제)
7. [JWT 토큰 발급과 검증 예제](#7-jwt-토큰-발급과-검증-예제)
8. [AuthGuard 사용 예제](#8-authguard-사용-예제)

### 3단계: 블로그 API 적용
9. [AuthModule 생성](#9-authmodule-생성)
10. [회원가입에 bcrypt 적용](#10-회원가입에-bcrypt-적용)
11. [LocalStrategy - 이메일과 비밀번호 검증](#11-localstrategy---이메일과-비밀번호-검증)
12. [JwtStrategy - 토큰 검증](#12-jwtstrategy---토큰-검증)
13. [인증 API 엔드포인트 구현](#13-인증-api-엔드포인트-구현)
14. [SimpleAuthGuard를 JwtAuthGuard로 교체](#14-simpleauthguard를-jwtauthguard로-교체)
15. [게시글/댓글에 토큰 기반 사용자 연결](#15-게시글댓글에-토큰-기반-사용자-연결)
16. [수정/삭제 시 작성자 본인 확인](#16-수정삭제-시-작성자-본인-확인)
17. [curl로 전체 플로우 테스트](#17-curl로-전체-플로우-테스트)
18. [Refresh Token DB 저장 및 블랙리스트 구현 심화](#18-refresh-token-db-저장-및-블랙리스트-구현-심화)
19. [보안 강화 - HTTPS와 httpOnly 쿠키](#19-보안-강화---https와-httponly-쿠키)

---

# 1단계: 개념 학습

## 1. 인증 vs 인가 - 쉬운 비유로 이해하기

인증(Authentication)과 인가(Authorization)는 보안의 핵심 개념이다. 이 둘은 자주 혼동되지만, 전혀 다른 역할을 한다.

### 놀이공원 비유

**인증(Authentication)** 은 놀이공원 입구에서 **입장권을 확인**하는 것과 같다.
- "이 사람이 정당한 입장객인가?"를 확인한다.
- 입장권이 없으면 들어갈 수 없다. (401 Unauthorized)

**인가(Authorization)** 는 놀이공원 안에서 **특정 놀이기구를 탈 수 있는지 확인**하는 것이다.
- "이 사람이 VIP 놀이기구를 탈 자격이 있는가?"를 확인한다.
- 입장은 했지만 권한이 없으면 이용할 수 없다. (403 Forbidden)

### 정리 비교표

| 구분 | 인증 (Authentication) | 인가 (Authorization) |
| --- | --- | --- |
| 질문 | "너는 **누구**인가?" | "너는 이걸 **할 수 있는가**?" |
| 목적 | 사용자 신원 확인 | 권한/접근 제어 |
| 예시 | 이메일 + 비밀번호 로그인, JWT 토큰 검증 | 관리자만 접근 가능한 API, 역할 기반 접근 제어 |
| 시점 | 사용자 식별 단계 | 식별 **이후** 권한 확인 단계 |
| 실패 시 | 401 Unauthorized | 403 Forbidden |

### 웹 API에서의 인증/인가 흐름

```
1. 사용자가 이메일/비밀번호로 로그인 요청       ← 인증 시도
2. 서버가 자격 증명을 확인하고 JWT 토큰 발급     ← 인증 완료
3. 사용자가 토큰을 포함하여 API 요청             ← 매 요청마다 인증
4. 서버가 토큰을 검증하여 사용자 식별            ← 인증
5. 해당 사용자가 요청한 리소스에 접근 권한 확인   ← 인가
```

> **참고**: 이 챕터에서는 **인증(Authentication)** 에 집중한다. 인가(Authorization)는 챕터 6(Guard)에서 다룬 역할 기반 접근 제어(RBAC)를 참고하자.

---

## 2. JWT란 무엇인가

### JWT(JSON Web Token) 한 줄 정리

JWT는 **사용자 정보를 담은 암호화된 신분증**이다. 서버가 발급해주면, 클라이언트는 매 요청마다 이 신분증을 보여주면서 "나 이 사람이야"라고 증명한다.

### 왜 JWT를 사용하는가?

전통적인 세션 방식에서는 서버가 로그인 상태를 메모리에 저장했다. 하지만 이 방식은 서버를 여러 대로 늘리면(스케일 아웃) 세션 공유 문제가 생긴다. JWT는 **토큰 자체에 정보를 포함**하므로 서버에 상태를 저장할 필요가 없다(Stateless).

```
세션 방식:                          JWT 방식:
┌────────┐  요청 + 세션ID           ┌────────┐  요청 + JWT 토큰
│클라이언트│ ──────────────→         │클라이언트│ ──────────────→
└────────┘                          └────────┘
                ↓                                     ↓
┌────────┐  세션 저장소 조회         ┌────────┐  토큰 자체를 검증
│  서버   │ ──→ [세션 DB/메모리]     │  서버   │  (저장소 불필요!)
└────────┘                          └────────┘
```

### JWT 구조

JWT는 점(`.`)으로 구분된 **세 부분**으로 구성된다.

```
xxxxx.yyyyy.zzzzz
 ↑       ↑      ↑
Header Payload Signature
```

#### 1. Header (헤더)

토큰의 타입과 서명 알고리즘을 지정한다.

```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

#### 2. Payload (페이로드)

전달할 데이터(클레임, Claims)를 담는다.

```json
{
  "sub": "1",
  "email": "user@example.com",
  "iat": 1700000000,
  "exp": 1700003600
}
```

| 클레임 | 설명 |
| --- | --- |
| `sub` | Subject - 토큰의 주체 (보통 사용자 ID) |
| `iat` | Issued At - 토큰 발급 시간 |
| `exp` | Expiration - 토큰 만료 시간 |

> **주의:**: Payload는 Base64로 인코딩된 것일 뿐 암호화된 것이 아니다. 누구나 디코딩해서 내용을 볼 수 있으므로 **비밀번호 같은 민감한 정보는 절대 넣지 않는다**.

#### 3. Signature (서명)

헤더와 페이로드를 비밀 키로 서명하여 **토큰이 위조되지 않았음을 보장**한다.

```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### Access Token vs Refresh Token

JWT를 사용할 때는 보통 두 종류의 토큰을 함께 사용한다.

| 구분 | Access Token | Refresh Token |
| --- | --- | --- |
| 용도 | API 접근 인증 | Access Token 재발급 |
| 수명 | 짧음 (15분 ~ 1시간) | 길음 (7일 ~ 30일) |
| 저장 위치 | 메모리 또는 헤더 | HttpOnly Cookie 또는 DB |
| 노출 위험 | 짧은 수명으로 피해 최소화 | 안전한 저장소에 보관 필수 |

> **왜 두 개를 사용하나?** Access Token의 수명이 길면 탈취 시 오래 악용된다. 짧게 하면 안전하지만 사용자가 자주 로그인해야 한다. Refresh Token은 이 딜레마를 해결한다. Access Token은 짧게, Refresh Token은 길게 설정하여 **보안과 편의성을 모두** 확보한다.

### 토큰 갱신 흐름

```
1. 클라이언트가 Access Token으로 API 요청
2. Access Token이 만료된 경우 → 서버가 401 응답
3. 클라이언트가 Refresh Token으로 토큰 갱신 요청 (POST /auth/refresh)
4. 서버가 Refresh Token 검증 후 새 Access Token (+ 새 Refresh Token) 발급
5. 클라이언트가 새 Access Token으로 API 재요청
```

---

## 3. Passport.js와 NestJS 통합

### Passport.js란?

[Passport.js](http://www.passportjs.org/)는 Node.js에서 가장 널리 사용되는 인증 라이브러리다. **Strategy 패턴**을 기반으로 다양한 인증 방식(로컬 로그인, OAuth, JWT 등)을 플러그인 형태로 지원한다.

### 주요 특징

- **Strategy 기반 아키텍처**: 인증 방식마다 독립적인 Strategy를 구현한다.
- **500개 이상의 Strategy**: Google, Facebook, GitHub OAuth부터 SAML, LDAP까지 지원.
- **NestJS 공식 지원**: `@nestjs/passport` 패키지로 NestJS Guard 시스템과 자연스럽게 통합.

### 패키지 설치

```bash
# 필요한 패키지 한 번에 설치
npm install @nestjs/passport passport @nestjs/jwt passport-jwt passport-local bcrypt
npm install -D @types/passport-jwt @types/passport-local @types/bcrypt
```

| 패키지 | 역할 |
| --- | --- |
| `@nestjs/passport` | Passport.js를 NestJS에 통합하는 래퍼 |
| `passport` | Passport.js 코어 라이브러리 |
| `@nestjs/jwt` | JWT 토큰 발급/검증 유틸리티 |
| `passport-jwt` | JWT 기반 인증 Strategy |
| `passport-local` | 이메일+비밀번호 기반 인증 Strategy |
| `bcrypt` | 비밀번호 해싱 라이브러리 |

### `@nestjs/passport`가 제공하는 핵심 요소

| 요소 | 설명 |
| --- | --- |
| `PassportStrategy` | Passport Strategy를 NestJS Injectable 클래스로 래핑하는 믹스인 |
| `AuthGuard` | Passport Strategy를 NestJS Guard로 변환하는 팩토리 함수 |
| `PassportModule` | Passport 설정을 모듈 수준에서 관리 |

### 동작 흐름 한눈에 보기

```
요청 → AuthGuard('strategy-name') → PassportStrategy → validate() 메서드
  → 성공: request.user에 사용자 정보 할당 → 핸들러 실행
  → 실패: UnauthorizedException 발생
```

---

## 4. Strategy 패턴 (Local, JWT)

Passport.js의 핵심은 **Strategy 패턴**이다. 인증 방식이 달라도 동일한 인터페이스(`validate()`)로 처리할 수 있다.

### Local Strategy

**용도**: 로그인 시 이메일과 비밀번호를 검증하는 데 사용한다.

```
클라이언트 → POST /auth/login { email, password }
                        ↓
              LocalAuthGuard 실행
                        ↓
              LocalStrategy.validate(email, password) 호출
                        ↓
              이메일로 사용자 조회 → 비밀번호 비교
                        ↓
              성공하면 request.user에 사용자 정보 할당
```

### JWT Strategy

**용도**: 로그인 이후 매 요청에서 Access Token을 검증하는 데 사용한다.

```
클라이언트 → GET /posts (Authorization: Bearer <token>)
                        ↓
              JwtAuthGuard 실행
                        ↓
              토큰 추출 → 서명 검증 → 만료 시간 확인
                        ↓
              JwtStrategy.validate(payload) 호출
                        ↓
              성공하면 request.user에 사용자 정보 할당
```

### 두 Strategy의 비교

| 구분 | Local Strategy | JWT Strategy |
| --- | --- | --- |
| 사용 시점 | 로그인할 때 **1번** | 로그인 후 **매 요청마다** |
| 입력 | 이메일 + 비밀번호 (body) | JWT 토큰 (header) |
| 검증 대상 | DB의 사용자 정보 | 토큰의 서명과 만료 시간 |
| 결과 | 토큰 발급 | 요청 승인/거부 |

---

## 5. bcrypt 비밀번호 해싱

비밀번호는 **절대 평문(plain text)으로 저장하면 안 된다**. 데이터베이스가 유출되면 모든 사용자의 비밀번호가 노출되기 때문이다.

### bcrypt란?

bcrypt는 **단방향 해시 함수**다. 해시된 값에서 원본 비밀번호를 역추출할 수 없다.

### bcrypt의 핵심 특징

- **솔트(Salt) 자동 생성**: 같은 비밀번호라도 매번 다른 해시 값이 생성된다.
- **비용 인자(Cost Factor)**: `saltRounds` 값을 높이면 해싱 시간이 기하급수적으로 증가하여 무차별 대입 공격을 어렵게 만든다.
- **의도적으로 느림**: 빠른 해시(MD5, SHA)와 달리, 대량 비교 공격에 강하다.

### 사용법 미리보기

```typescript
import * as bcrypt from 'bcrypt';

// 1. 비밀번호 해싱 (회원가입 시)
const saltRounds = 10;
const plainPassword = 'myPassword123';
const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
// 결과: $2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy

// 2. 비밀번호 검증 (로그인 시)
const isMatch = await bcrypt.compare('myPassword123', hashedPassword);
// 결과: true

const isWrong = await bcrypt.compare('wrongPassword', hashedPassword);
// 결과: false
```

> **팁:**: `saltRounds` 값은 보통 10~12를 사용한다. 값이 1 증가할 때마다 해싱 시간이 약 2배 늘어난다. 10이면 약 0.1초, 12이면 약 0.3초 정도 소요된다.

---

# 2단계: 기본 예제

## 6. Local Strategy 예제

이제 개념을 코드로 옮겨보자. 먼저 이메일+비밀번호로 로그인하는 Local Strategy를 구현한다.

### Local Strategy 기본 구조

```typescript
// src/auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // 기본값은 'username', 우리는 'email'을 사용
    });
  }

  /**
   * passport-local이 자동으로 호출하는 메서드.
   * 요청 body에서 email과 password를 추출해서 전달해준다.
   * 반환된 값은 request.user에 할당된다.
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return user; // → request.user에 할당됨
  }
}
```

### 핵심 포인트

- `PassportStrategy(Strategy)`에서 `Strategy`는 `passport-local`에서 가져온다.
- `usernameField: 'email'`을 설정하지 않으면 기본적으로 `username` 필드를 찾는다.
- `validate()` 메서드의 반환 값이 자동으로 `request.user`에 할당된다.
- `validate()`에서 예외를 던지면 인증이 실패한다.

### AuthService에서 사용자 검증

```typescript
// src/auth/auth.service.ts (validateUser 부분)
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  // ...

  async validateUser(email: string, password: string) {
    // 1. 이메일로 사용자 조회
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    // 2. 비밀번호 비교 (bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    // 3. 비밀번호를 제외한 사용자 정보 반환
    const { password: _, ...result } = user;
    return result;
  }
}
```

---

## 7. JWT 토큰 발급과 검증 예제

### Access Token 발급

```typescript
// src/auth/auth.service.ts (토큰 발급 부분)
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Access Token 발급
   */
  generateAccessToken(userId: number, email: string): string {
    const payload = { sub: userId, email };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m', // 15분
    });
  }

  /**
   * Refresh Token 발급
   */
  generateRefreshToken(userId: number, email: string): string {
    const payload = { sub: userId, email };

    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d', // 7일
    });
  }
}
```

> **팁:**: Access Token과 Refresh Token은 **반드시 서로 다른 secret 키**를 사용해야 한다. 같은 키를 쓰면 Access Token용 Guard가 Refresh Token도 통과시켜버릴 수 있다.

### JWT Strategy로 토큰 검증

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // Authorization: Bearer <token> 헤더에서 토큰을 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 만료된 토큰은 자동 거부
      ignoreExpiration: false,
      // 서명 검증에 사용할 비밀 키
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * 토큰이 유효한 경우에만 호출된다.
   * payload는 JWT를 디코딩한 결과물이다.
   */
  async validate(payload: { sub: number; email: string }) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    // 이 객체가 request.user에 할당된다
    return { id: user.id, email: user.email };
  }
}
```

### Refresh Token용 JWT Strategy

Refresh Token은 서명 검증만으로는 부족하다. 로그아웃된 토큰이 재사용될 수 있기 때문이다. 따라서 `validate()` 내에서 **DB에 저장된 해시값과 직접 비교**하는 단계가 반드시 필요하다.

```typescript
// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService, // DB 조회용
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true, // validate()에 Request 객체도 전달
    });
  }

  /**
   * passReqToCallback: true 설정 덕분에 첫 번째 인자가 Request 객체다.
   * 서명 검증 통과 후, DB의 해시값과 비교하여 블랙리스트 처리를 수행한다.
   */
  async validate(req: Request, payload: { sub: number; email: string }) {
    const authHeader = req.get('authorization');
    const refreshToken = authHeader?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token이 존재하지 않습니다.');
    }

    const user = await this.usersService.findById(payload.sub);

    // hashedRefreshToken이 null → 로그아웃된 상태 (블랙리스트 효과)
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('이미 로그아웃된 사용자입니다.');
    }

    const isValid = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isValid) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      refreshToken, // 원본 토큰도 함께 전달
    };
  }
}
```

---

## 8. AuthGuard 사용 예제

### Guard 정의

`@nestjs/passport`의 `AuthGuard`는 Strategy 이름을 받아 해당 Strategy를 실행하는 Guard를 생성한다.

```typescript
// src/auth/guards/local-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
```

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

```typescript
// src/auth/guards/jwt-refresh-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard('jwt-refresh') {}
```

> **이 한 줄이 전부?** 그렇다. `AuthGuard('jwt')`라고 적으면, 이전에 `PassportStrategy(Strategy, 'jwt')`로 등록한 JwtStrategy가 자동으로 연결된다. Passport.js와 NestJS의 통합 덕분이다.

### Guard 동작 흐름 시각화

```
@UseGuards(JwtAuthGuard)
         │
         ▼
AuthGuard('jwt') 실행
         │
         ▼
JwtStrategy의 super() 설정에 따라 토큰 추출
         │
         ▼
토큰 유효성 검증 (서명, 만료 시간 등)
         │
         ├── 유효하지 않음 → UnauthorizedException (401)
         │
         └── 유효함 → JwtStrategy.validate() 호출
                          │
                          ▼
                   반환 값이 request.user에 할당
                          │
                          ▼
                   핸들러 실행
```

### Guard 커스터마이징 - 에러 메시지 변경

기본 AuthGuard를 확장하면 에러 처리를 원하는 대로 바꿀 수 있다.

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    // 여기에 추가 로직 삽입 가능 (예: 퍼블릭 라우트 체크)
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('인증이 필요합니다. 유효한 토큰을 제공해주세요.');
    }
    return user;
  }
}
```

### @Public() 데코레이터 - 특정 라우트 인증 건너뛰기

전역으로 JwtAuthGuard를 적용한 후, 회원가입이나 로그인처럼 인증이 필요 없는 라우트를 지정할 때 사용한다.

```typescript
// src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// src/auth/guards/jwt-auth.guard.ts (@Public 지원 버전)
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // @Public() 데코레이터가 있으면 인증을 건너뛴다
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

```typescript
// 사용 예시
@Public()       // ← 이 데코레이터가 붙으면 토큰 없이 접근 가능
@Post('signup')
signup(@Body() dto: SignupDto) {
  // ...
}
```

---

# 3단계: 블로그 API 적용

> 이전 챕터들에서 만들어온 블로그 API에 실제 JWT 인증을 적용한다. 챕터 6에서 사용한 `SimpleAuthGuard`(헤더의 `x-user-id`를 확인하는 간이 가드)를 **진짜 JWT 인증**으로 교체하는 것이 목표다.

## 9. AuthModule 생성

### 환경 변수 준비

챕터 11에서 설정한 `.env` 파일에 JWT 관련 키를 추가한다.

```bash
# .env
# (기존 설정들...)
JWT_ACCESS_SECRET=your-access-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
```

> **주의:**: 위 값은 개발용 예시다. 프로덕션에서는 반드시 충분히 길고 무작위한 문자열을 사용해야 한다.

### AuthModule 구성

```typescript
// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';

@Module({
  imports: [
    ConfigModule,           // 환경 변수 사용
    UsersModule,            // UsersService를 주입받기 위해 import
    PassportModule,         // Passport.js 통합
    JwtModule.register({}), // 토큰 발급 시 옵션을 직접 전달하므로 빈 설정
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,       // 이메일+비밀번호 검증
    JwtStrategy,         // Access Token 검증
    JwtRefreshStrategy,  // Refresh Token 검증
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

### AppModule에 AuthModule 등록 + 전역 Guard

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      // ... 기존 TypeORM 설정 (챕터 10 참고)
    }),
    AuthModule,
    UsersModule,
    PostsModule,
    CommentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // 모든 라우트에 기본적으로 JWT 인증 적용
    },
  ],
})
export class AppModule {}
```

> **팁:**: `APP_GUARD`로 전역 등록하면 모든 라우트에 JwtAuthGuard가 자동 적용된다. 인증이 필요 없는 라우트에는 `@Public()` 데코레이터를 붙이면 된다. 이 방식이 "기본적으로 보호하고, 예외적으로 공개"하는 안전한 패턴이다.

### 파일 구조

```
src/
├── auth/
│   ├── decorators/
│   │   └── public.decorator.ts      ← @Public() 데코레이터
│   ├── dto/
│   │   ├── login.dto.ts             ← 로그인 요청 DTO
│   │   └── signup.dto.ts            ← 회원가입 요청 DTO
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        ← JWT 인증 Guard
│   │   ├── jwt-refresh-auth.guard.ts ← Refresh Token Guard
│   │   └── local-auth.guard.ts      ← 로컬 로그인 Guard
│   ├── strategies/
│   │   ├── jwt.strategy.ts          ← Access Token 검증
│   │   ├── jwt-refresh.strategy.ts  ← Refresh Token 검증
│   │   └── local.strategy.ts        ← 이메일/비밀번호 검증
│   ├── auth.controller.ts           ← 인증 API 컨트롤러
│   ├── auth.module.ts               ← 인증 모듈
│   └── auth.service.ts              ← 인증 비즈니스 로직
├── users/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── users.module.ts
│   └── users.service.ts
├── posts/
│   └── ...
├── comments/
│   └── ...
└── app.module.ts
```

---

## 10. 회원가입에 bcrypt 적용

### User Entity 수정

Refresh Token 해시를 저장할 컬럼을 추가한다.

```typescript
// src/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string; // bcrypt로 해싱된 비밀번호가 저장됨

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true, type: 'text' })
  hashedRefreshToken: string | null; // Refresh Token의 해시값 저장 (로그아웃 시 null)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];
}
```

### UsersService 수정 - bcrypt 해싱 추가

```typescript
// src/users/users.service.ts
import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * 회원가입 - 비밀번호를 bcrypt로 해싱하여 저장
   */
  async create(email: string, password: string, name?: string): Promise<User> {
    // 이메일 중복 확인
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('이미 존재하는 이메일입니다.');
    }

    // 비밀번호 해싱 (saltRounds: 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.usersRepository.create({
      email,
      password: hashedPassword, // 해싱된 비밀번호 저장
      name,
    });

    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  /**
   * Refresh Token 해시를 DB에 저장/삭제
   * 로그아웃 시 null을 전달하여 토큰 무효화
   */
  async updateRefreshToken(
    userId: number,
    hashedRefreshToken: string | null,
  ): Promise<void> {
    await this.usersRepository.update(userId, { hashedRefreshToken });
  }
}
```

### UsersModule에서 export

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService], // AuthModule에서 사용할 수 있도록 export
})
export class UsersModule {}
```

---

## 11. LocalStrategy - 이메일과 비밀번호 검증

로그인 요청이 오면 LocalStrategy가 이메일과 비밀번호를 검증한다.

```typescript
// src/auth/strategies/local.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email', // body에서 'email' 필드를 username으로 사용
    });
  }

  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    return user; // → request.user에 할당
  }
}
```

---

## 12. JwtStrategy - 토큰 검증

### Access Token 검증

```typescript
// src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: { sub: number; email: string }) {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    // 이 객체가 request.user가 된다
    // 게시글/댓글 작성 시 이 id를 사용한다
    return { id: user.id, email: user.email };
  }
}
```

### Refresh Token 검증

JwtRefreshStrategy는 서명 검증 이후에 **DB에 저장된 해시와 원본 토큰을 직접 비교**하여 이중으로 유효성을 확인한다. 로그아웃 후 탈취된 Refresh Token이 재사용되는 것을 막는 핵심 방어선이다.

```typescript
// src/auth/strategies/jwt-refresh.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService, // DB 조회를 위해 주입
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  /**
   * passReqToCallback: true 덕분에 첫 번째 인자가 Request 객체다.
   * 서명 검증이 통과된 후 호출되며, 여기서 DB 해시 비교까지 수행한다.
   */
  async validate(req: Request, payload: { sub: number; email: string }) {
    const authHeader = req.get('authorization');
    const refreshToken = authHeader?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token이 존재하지 않습니다.');
    }

    // DB에서 사용자 조회
    const user = await this.usersService.findById(payload.sub);

    // hashedRefreshToken이 null이면 로그아웃된 상태 (블랙리스트 효과)
    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('이미 로그아웃된 사용자입니다.');
    }

    // DB의 해시값과 요청으로 들어온 Refresh Token 비교
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      refreshToken, // AuthService.refreshTokens()에서 추가 검증용으로 활용 가능
    };
  }
}
```

> **왜 Strategy에서 DB 조회를 하는가?** JWT 서명 자체는 유효하더라도, 로그아웃 이후에는 해당 토큰을 더 이상 허용하면 안 된다. Passport가 서명 검증 후 `validate()`를 호출하는 시점에 DB 해시 비교를 끼워 넣으면, Guard 레벨에서 깔끔하게 블랙리스트 처리를 할 수 있다.

---

## 13. 인증 API 엔드포인트 구현

### DTO 정의

```typescript
// src/auth/dto/signup.dto.ts
import { IsEmail, IsString, MinLength, IsOptional, MaxLength } from 'class-validator';

export class SignupDto {
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  @IsString()
  @MinLength(8, { message: '비밀번호는 최소 8자 이상이어야 합니다.' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  name?: string;
}
```

```typescript
// src/auth/dto/login.dto.ts
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
```

### AuthService 전체 구현

```typescript
// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ─────────────────────────────────────────────
  // 회원가입
  // ─────────────────────────────────────────────

  async signup(email: string, password: string, name?: string) {
    const user = await this.usersService.create(email, password, name);
    // 비밀번호를 응답에서 제외
    const { password: _, hashedRefreshToken: __, ...result } = user;
    return result;
  }

  // ─────────────────────────────────────────────
  // 사용자 검증 (Local Strategy에서 호출)
  // ─────────────────────────────────────────────

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...result } = user;
    return result;
  }

  // ─────────────────────────────────────────────
  // 토큰 발급
  // ─────────────────────────────────────────────

  generateAccessToken(userId: number, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: '15m',
    });
  }

  generateRefreshToken(userId: number, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: '7d',
    });
  }

  // ─────────────────────────────────────────────
  // 로그인 - Access Token + Refresh Token 발급
  // ─────────────────────────────────────────────

  async login(user: { id: number; email: string }) {
    const accessToken = this.generateAccessToken(user.id, user.email);
    const refreshToken = this.generateRefreshToken(user.id, user.email);

    // Refresh Token을 해싱하여 DB에 저장
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken,
      refreshToken,
    };
  }

  // ─────────────────────────────────────────────
  // 토큰 갱신 (Refresh Token Rotation)
  // ─────────────────────────────────────────────

  async refreshTokens(userId: number, email: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    // DB에 저장된 해시와 현재 Refresh Token 비교
    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    // 새 토큰 쌍 발급 (Refresh Token Rotation)
    const newAccessToken = this.generateAccessToken(user.id, user.email);
    const newRefreshToken = this.generateRefreshToken(user.id, user.email);

    const hashedRefreshToken = await bcrypt.hash(newRefreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ─────────────────────────────────────────────
  // 로그아웃 - Refresh Token 무효화
  // ─────────────────────────────────────────────

  async logout(userId: number): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }
}
```

### AuthController 구현

```typescript
// src/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshAuthGuard } from './guards/jwt-refresh-auth.guard';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 회원가입
   * POST /auth/signup
   * Body: { "email": "...", "password": "...", "name": "..." }
   */
  @Public() // 회원가입은 인증 불필요
  @Post('signup')
  async signup(@Body() signupDto: SignupDto) {
    const user = await this.authService.signup(
      signupDto.email,
      signupDto.password,
      signupDto.name,
    );

    return {
      message: '회원가입이 완료되었습니다.',
      user,
    };
  }

  /**
   * 로그인
   * POST /auth/login
   * Body: { "email": "...", "password": "..." }
   *
   * LocalAuthGuard가 이메일/비밀번호를 검증한 후
   * request.user에 사용자 정보를 할당한다.
   */
  @Public() // 로그인도 인증 불필요
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Request() req: any) {
    // LocalStrategy.validate()의 반환값이 req.user에 들어있다
    return this.authService.login(req.user);
  }

  /**
   * 토큰 갱신
   * POST /auth/refresh
   * Header: Authorization: Bearer <refresh_token>
   */
  @Public() // Refresh Token으로 인증하므로 Access Token 검증 건너뛰기
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req: any) {
    const { id, email, refreshToken } = req.user;
    return this.authService.refreshTokens(id, email, refreshToken);
  }

  /**
   * 로그아웃
   * POST /auth/logout
   * Header: Authorization: Bearer <access_token>
   */
  @UseGuards(JwtAuthGuard) // Access Token 필요
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.id);
    return { message: '로그아웃되었습니다.' };
  }
}
```

> **흐름 요약**: 
> - `POST /auth/signup` → 비밀번호 해싱 후 DB 저장
> - `POST /auth/login` → LocalStrategy로 검증 → 토큰 쌍 발급
> - `POST /auth/refresh` → JwtRefreshStrategy로 검증 → 새 토큰 쌍 발급
> - `POST /auth/logout` → DB에서 Refresh Token 삭제

---

## 14. SimpleAuthGuard를 JwtAuthGuard로 교체

챕터 6에서 만들었던 `SimpleAuthGuard`는 헤더의 `x-user-id`를 확인하는 간이 인증이었다. 이제 이것을 실제 JWT 인증으로 교체한다.

### Before: 챕터 6의 SimpleAuthGuard

```typescript
// 이전 코드 (삭제 대상)
@Injectable()
export class SimpleAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new UnauthorizedException('x-user-id 헤더가 필요합니다.');
    }

    request.user = { id: Number(userId) };
    return true;
  }
}
```

### After: JwtAuthGuard (전역 적용)

```typescript
// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('인증이 필요합니다. 유효한 JWT 토큰을 제공해주세요.');
    }
    return user;
  }
}
```

### 교체 작업 체크리스트

1. `APP_GUARD`로 `JwtAuthGuard`를 전역 등록 (섹션 9에서 완료)
2. 각 컨트롤러에서 [`@UseGuards(SimpleAuthGuard)`](references/decorators.md#useguardsguards) 제거 (전역이므로 불필요)
3. 인증이 필요 없는 라우트에 `@Public()` 추가
4. `SimpleAuthGuard` 파일 삭제

### 컨트롤러 수정 예시

```typescript
// src/posts/posts.controller.ts (수정 전)
@UseGuards(SimpleAuthGuard)  // ← 삭제
@Post()
create(@Body() dto: CreatePostDto, @Request() req: any) {
  return this.postsService.create(dto, req.user.id);
}

// src/posts/posts.controller.ts (수정 후)
// 전역 JwtAuthGuard가 자동 적용되므로 @UseGuards 불필요
@Post()
create(@Body() dto: CreatePostDto, @Request() req: any) {
  return this.postsService.create(dto, req.user.id);
  // req.user.id는 JwtStrategy.validate()에서 반환한 값
}
```

```typescript
// src/posts/posts.controller.ts - 공개 라우트에 @Public() 추가
@Public() // 게시글 목록은 누구나 조회 가능
@Get()
findAll(@Query() query: PaginationQueryDto) {
  return this.postsService.findAll(query);
}

@Public() // 게시글 상세도 누구나 조회 가능
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.postsService.findOne(id);
}
```

---

## 15. 게시글/댓글에 토큰 기반 사용자 연결

이전에는 `x-user-id` 헤더에서 userId를 가져왔지만, 이제는 JWT 토큰의 payload에서 추출한 `request.user.id`를 사용한다.

### @CurrentUser() 커스텀 데코레이터 (챕터 9에서 만든 것 활용)

```typescript
// src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // @CurrentUser('id')처럼 특정 필드만 가져올 수도 있다
    return data ? user?.[data] : user;
  },
);
```

### PostsController에서 사용

```typescript
// src/posts/posts.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // ─── 공개 API (인증 불필요) ────────────────────────

  @Public()
  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    return this.postsService.findAll(query);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  // ─── 인증 필요 API ────────────────────────────────

  @Post()
  create(
    @Body() createPostDto: CreatePostDto,
    @CurrentUser('id') userId: number, // JWT 토큰에서 추출한 userId
  ) {
    return this.postsService.create(createPostDto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.postsService.update(id, updatePostDto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.postsService.remove(id, userId);
  }
}
```

### CommentsController에서도 동일 적용

```typescript
// src/comments/comments.controller.ts
import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('posts/:postId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Public()
  @Get()
  findAll(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findAllByPost(postId);
  }

  @Post()
  create(
    @Param('postId', ParseIntPipe) postId: number,
    @Body() createCommentDto: CreateCommentDto,
    @CurrentUser('id') userId: number, // JWT 토큰에서 추출
  ) {
    return this.commentsService.create(postId, createCommentDto, userId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.commentsService.remove(id, userId);
  }
}
```

---

## 16. 수정/삭제 시 작성자 본인 확인

게시글이나 댓글을 수정/삭제할 때, JWT 토큰의 userId와 작성자가 일치하는지 확인해야 한다.

### PostsService에서 소유권 검증

```typescript
// src/posts/posts.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
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

  /**
   * 게시글 작성 - JWT 토큰의 userId를 author로 연결
   */
  async create(createPostDto: CreatePostDto, userId: number): Promise<Post> {
    const post = this.postsRepository.create({
      ...createPostDto,
      author: { id: userId }, // 토큰에서 추출한 userId로 작성자 설정
    });

    return this.postsRepository.save(post);
  }

  /**
   * 게시글 수정 - 본인 확인 후 수정
   */
  async update(
    id: number,
    updatePostDto: UpdatePostDto,
    userId: number,
  ): Promise<Post> {
    const post = await this.findOneWithAuthor(id);

    // 작성자 본인 확인
    if (post.author.id !== userId) {
      throw new ForbiddenException('본인이 작성한 게시글만 수정할 수 있습니다.');
    }

    Object.assign(post, updatePostDto);
    return this.postsRepository.save(post);
  }

  /**
   * 게시글 삭제 - 본인 확인 후 삭제
   */
  async remove(id: number, userId: number): Promise<void> {
    const post = await this.findOneWithAuthor(id);

    // 작성자 본인 확인
    if (post.author.id !== userId) {
      throw new ForbiddenException('본인이 작성한 게시글만 삭제할 수 있습니다.');
    }

    await this.postsRepository.remove(post);
  }

  /**
   * 작성자 정보를 포함하여 게시글 조회 (내부 헬퍼)
   */
  private async findOneWithAuthor(id: number): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author'], // 작성자 정보도 함께 로드
    });

    if (!post) {
      throw new NotFoundException(`게시글(ID: ${id})을 찾을 수 없습니다.`);
    }

    return post;
  }

  // ... findAll, findOne 등 나머지 메서드
}
```

### CommentsService에서도 동일 패턴 적용

```typescript
// src/comments/comments.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
  ) {}

  async create(
    postId: number,
    createCommentDto: CreateCommentDto,
    userId: number,
  ): Promise<Comment> {
    const comment = this.commentsRepository.create({
      ...createCommentDto,
      post: { id: postId },
      author: { id: userId }, // 토큰에서 추출한 userId
    });

    return this.commentsRepository.save(comment);
  }

  async remove(id: number, userId: number): Promise<void> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author'],
    });

    if (!comment) {
      throw new NotFoundException(`댓글(ID: ${id})을 찾을 수 없습니다.`);
    }

    // 작성자 본인 확인
    if (comment.author.id !== userId) {
      throw new ForbiddenException('본인이 작성한 댓글만 삭제할 수 있습니다.');
    }

    await this.commentsRepository.remove(comment);
  }

  // ... findAllByPost 등 나머지 메서드
}
```

> **팁:**: 소유권 검증 로직이 여러 서비스에 반복된다면, 공통 헬퍼 함수나 가드로 추출하는 것도 좋은 방법이다. 하지만 서비스마다 검증 조건이 미묘하게 다를 수 있으므로, 처음에는 각 서비스에 직접 작성하는 것을 권장한다.

---

## 17. curl로 전체 플로우 테스트

이제 모든 구현이 완료되었다. 가입부터 로그인, 토큰으로 글 작성, 수정/삭제까지 전체 플로우를 테스트해보자.

### 1단계: 회원가입

```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "minjae@example.com", "password": "password123", "name": "민재"}'

# 응답:
# {
#   "message": "회원가입이 완료되었습니다.",
#   "user": {
#     "id": 1,
#     "email": "minjae@example.com",
#     "name": "민재",
#     "createdAt": "2026-04-09T..."
#   }
# }
```

### 2단계: 로그인 (토큰 발급)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "minjae@example.com", "password": "password123"}'

# 응답:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
# }
```

> **팁:**: 이후 테스트를 편하게 하려면 토큰을 변수에 저장하자.
> ```bash
> ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIs..."
> REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIs..."
> ```

### 3단계: 토큰으로 게시글 작성

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title": "첫 번째 게시글", "content": "JWT 인증이 적용된 게시글입니다."}'

# 응답:
# {
#   "id": 1,
#   "title": "첫 번째 게시글",
#   "content": "JWT 인증이 적용된 게시글입니다.",
#   "author": { "id": 1 },
#   "createdAt": "2026-04-09T..."
# }
```

### 4단계: 토큰 없이 게시글 목록 조회 (공개 API)

```bash
# @Public() 데코레이터가 있으므로 토큰 없이도 가능
curl http://localhost:3000/posts

# 응답:
# [
#   {
#     "id": 1,
#     "title": "첫 번째 게시글",
#     "content": "JWT 인증이 적용된 게시글입니다.",
#     "author": { "id": 1, "name": "민재" }
#   }
# ]
```

### 5단계: 게시글 수정 (본인만 가능)

```bash
curl -X PATCH http://localhost:3000/posts/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"title": "수정된 게시글"}'

# 응답:
# {
#   "id": 1,
#   "title": "수정된 게시글",
#   "content": "JWT 인증이 적용된 게시글입니다."
# }
```

### 6단계: 다른 사용자로 삭제 시도 (거부됨)

```bash
# 다른 사용자로 가입 + 로그인
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "other@example.com", "password": "password123"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "other@example.com", "password": "password123"}'
# → OTHER_TOKEN 획득

# 다른 사용자의 토큰으로 삭제 시도
curl -X DELETE http://localhost:3000/posts/1 \
  -H "Authorization: Bearer $OTHER_TOKEN"

# 응답: 403 Forbidden
# {
#   "statusCode": 403,
#   "message": "본인이 작성한 게시글만 삭제할 수 있습니다."
# }
```

### 7단계: 댓글 작성

```bash
curl -X POST http://localhost:3000/posts/1/comments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"content": "좋은 글이네요!"}'

# 응답:
# {
#   "id": 1,
#   "content": "좋은 글이네요!",
#   "author": { "id": 1 },
#   "post": { "id": 1 }
# }
```

### 8단계: 토큰 갱신

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"

# 응답:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIs...(새 토큰)",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIs...(새 토큰)"
# }
```

### 9단계: 로그아웃

```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 응답:
# { "message": "로그아웃되었습니다." }

# 이후 Refresh Token으로 갱신 시도하면 실패
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN"

# 응답: 401 Unauthorized
# { "message": "유효하지 않은 Refresh Token입니다." }
```

### 10단계: 토큰 없이 보호된 API 접근 시도

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트", "content": "토큰 없이 작성 시도"}'

# 응답: 401 Unauthorized
# { "message": "인증이 필요합니다. 유효한 JWT 토큰을 제공해주세요." }
```

---

## Refresh Token Rotation 보안 패턴

이 블로그 API에 적용된 Refresh Token Rotation 패턴을 정리한다.

```
클라이언트                              서버
    │                                    │
    ├── POST /auth/refresh ──────────────►│
    │   (Refresh Token A)                 │
    │                                    │── Refresh Token A 검증
    │                                    │── 새 Access Token + Refresh Token B 발급
    │                                    │── Refresh Token B 해시를 DB에 저장
    │◄── 새 Access Token + ──────────────┤   (Refresh Token A는 더 이상 유효하지 않음)
    │    Refresh Token B                  │
    │                                    │
```

### 보안 고려사항 체크리스트

1. **Refresh Token을 해싱하여 DB에 저장**: DB가 유출되더라도 원본 토큰을 알 수 없다.
2. **Refresh Token Rotation**: 매 갱신 시 새 토큰을 발급하여 이전 토큰을 무효화한다.
3. **로그아웃 시 Refresh Token 삭제**: DB에서 null로 설정하여 완전 무효화한다.
4. **Access Token과 Refresh Token에 다른 secret 사용**: 토큰 용도가 섞이는 것을 방지한다.
5. **Access Token은 짧은 수명(15분)**: 탈취 시 피해를 최소화한다.

---

## 정리

### 이 챕터에서 한 것

| 순서 | 작업 | 설명 |
| --- | --- | --- |
| 1 | AuthModule 생성 | Passport.js + JWT + bcrypt 통합 |
| 2 | User Entity 수정 | `hashedRefreshToken: string \| null` 컬럼 추가 |
| 3 | 비밀번호 해싱 | bcrypt로 회원가입 시 비밀번호 해싱 |
| 4 | LocalStrategy | 이메일+비밀번호 검증 후 request.user 할당 |
| 5 | JwtStrategy | Access Token 검증 후 request.user 할당 |
| 6 | JwtRefreshStrategy | Refresh Token 서명 검증 + DB 해시 비교 + 블랙리스트 처리 |
| 7 | 인증 API | signup, login, refresh, logout 엔드포인트 |
| 8 | SimpleAuthGuard 교체 | 전역 JwtAuthGuard + @Public() 패턴 |
| 9 | 토큰 기반 사용자 연결 | @CurrentUser() 데코레이터로 userId 추출 |
| 10 | 소유권 검증 | 수정/삭제 시 작성자 본인 확인 (ForbiddenException) |
| 11 | Refresh Token DB 블랙리스트 | 로그아웃 시 null 설정, 갱신 시 해시 비교 이중 검증 |
| 12 | HTTPS + httpOnly 쿠키 | 프로덕션 보안 적용, XSS 방어를 위한 쿠키 기반 저장 |

### 핵심 용어 정리

| 항목 | 설명 |
| --- | --- |
| `LocalStrategy` | 이메일 + 비밀번호를 검증하여 사용자 객체 반환 |
| `JwtStrategy` | Access Token을 검증하여 사용자 정보 추출 |
| `JwtRefreshStrategy` | Refresh Token 서명 검증 + DB 해시 비교 + 블랙리스트 처리 |
| `AuthGuard('local')` | LocalStrategy를 실행하는 Guard |
| `AuthGuard('jwt')` | JwtStrategy를 실행하는 Guard |
| `@Public()` | 전역 Guard 적용 시 특정 라우트를 인증에서 제외 |
| `@CurrentUser()` | JWT 토큰에서 추출한 사용자 정보를 파라미터로 주입 |
| `bcrypt.hash()` | 비밀번호와 Refresh Token을 안전하게 해싱 |
| `bcrypt.compare()` | 해시된 값과 원본을 비교하여 일치 여부 확인 |
| Refresh Token Rotation | 매 갱신 시 새 Refresh Token을 발급하여 이전 토큰 무효화 |
| `hashedRefreshToken: string \| null` | null이면 로그아웃 상태 (블랙리스트 효과) |
| httpOnly 쿠키 | JavaScript 접근 불가 쿠키로 XSS 공격으로부터 토큰 보호 |
| `sameSite: 'strict'` | 쿠키의 CSRF 방어 옵션 |
| `secure: true` | HTTPS에서만 쿠키 전송 (프로덕션 필수 설정) |

### 이 챕터를 마치면

**실제 JWT 인증 시스템이 완성**된다. 회원가입, 로그인, 토큰 갱신, 로그아웃까지 실무에서 사용하는 인증 플로우가 모두 갖춰진다. 다음 챕터(13 - Testing)에서는 이 인증 로직을 포함한 테스트 작성을 학습한다.

---

## 18. Refresh Token DB 저장 및 블랙리스트 구현 심화

이 섹션에서는 이 챕터에서 구현한 Refresh Token 관리 방식의 설계 의도와 전체 흐름을 한 곳에서 정리한다.

### 전체 구조 한눈에 보기

```
[로그인]
  1. 이메일 + 비밀번호 검증 (LocalStrategy)
  2. Access Token + Refresh Token 발급
  3. bcrypt.hash(refreshToken) → DB 저장
     (user.hashedRefreshToken = 해시값)

[토큰 갱신]
  1. JwtRefreshStrategy: JWT 서명 검증 (secret, 만료 시간)
  2. JwtRefreshStrategy: DB 조회 → hashedRefreshToken null 여부 확인
  3. JwtRefreshStrategy: bcrypt.compare(요청 토큰, DB 해시) 비교
  4. 검증 통과 시 새 토큰 쌍 발급 (Refresh Token Rotation)
  5. 새 해시를 DB에 저장

[로그아웃]
  1. DB의 hashedRefreshToken을 null로 업데이트
  2. 이후 해당 Refresh Token으로 갱신 요청 시 → null 감지 → 401 거부
```

### User Entity의 `hashedRefreshToken` 설계

```typescript
// src/users/entities/user.entity.ts (핵심 컬럼)
@Column({ nullable: true, type: 'text' })
hashedRefreshToken: string | null;
```

| 상태 | `hashedRefreshToken` 값 | 의미 |
| --- | --- | --- |
| 로그인됨 | bcrypt 해시 문자열 | 정상 발급된 Refresh Token이 있음 |
| 로그아웃됨 | `null` | Refresh Token이 무효화됨 (블랙리스트 효과) |
| 가입 직후 | `null` (초기값) | 아직 로그인하지 않은 상태 |

> **왜 별도 블랙리스트 테이블을 만들지 않는가?** Refresh Token은 사용자당 하나만 유효하도록 설계(Refresh Token Rotation)하면, 가장 최근 해시를 User 테이블에 직접 보관하는 것으로 충분하다. 별도 테이블은 여러 기기 동시 로그인처럼 복수 토큰을 관리해야 할 때 필요하다.

### UsersService의 `updateRefreshToken` 역할

```typescript
// src/users/users.service.ts
async updateRefreshToken(
  userId: number,
  hashedRefreshToken: string | null, // null 전달 시 블랙리스트 처리
): Promise<void> {
  await this.usersRepository.update(userId, { hashedRefreshToken });
}
```

이 메서드는 세 가지 시점에 호출된다.

| 호출 시점 | 전달값 | 효과 |
| --- | --- | --- |
| 로그인(`login`) | `bcrypt.hash(refreshToken, 10)` | 새 해시를 DB에 저장 |
| 토큰 갱신(`refreshTokens`) | `bcrypt.hash(newRefreshToken, 10)` | 이전 해시를 교체 (Rotation) |
| 로그아웃(`logout`) | `null` | DB를 null로 초기화 (블랙리스트) |

### JwtRefreshStrategy의 이중 검증 흐름

```
요청: POST /auth/refresh
  Authorization: Bearer <refresh_token>
          │
          ▼
  passport-jwt: JWT 서명 검증 (secret, 만료 시간)
          │
          ├── 실패 → 401 (서명 불일치 또는 만료)
          │
          ▼ 성공
  JwtRefreshStrategy.validate() 호출
          │
          ▼
  DB 조회: usersService.findById(payload.sub)
          │
          ├── user 없음 → 401
          ├── hashedRefreshToken이 null → 401 (로그아웃 상태)
          │
          ▼
  bcrypt.compare(요청 토큰, user.hashedRefreshToken)
          │
          ├── 불일치 → 401 (탈취된 이전 토큰 등)
          │
          ▼ 일치
  { id, email, refreshToken } → request.user 할당
          │
          ▼
  AuthController.refresh() 실행 → 새 토큰 쌍 반환
```

> **팁:**: `AuthService.refreshTokens()`에서 한 번 더 `bcrypt.compare`를 수행하는 코드를 볼 수 있다. Strategy에서 이미 검증했으므로 이 중복 비교는 제거해도 된다. Strategy가 통과했다는 것 자체가 검증 완료를 의미한다.

---

## 19. 보안 강화 - HTTPS와 httpOnly 쿠키

### HTTPS 환경에서만 완전히 안전하다

JWT 토큰을 `Authorization: Bearer` 헤더로 전송할 때, **HTTPS가 없으면 네트워크 구간에서 토큰이 평문으로 노출**된다. 개발 환경(localhost)에서는 HTTP도 괜찮지만, 프로덕션에서는 반드시 HTTPS를 적용해야 한다.

```
HTTP  (비안전): 클라이언트 → [Authorization: Bearer eyJhbGci...] → 서버
                                ↑ 중간자가 스니핑 가능

HTTPS (안전):   클라이언트 → [암호화된 패킷] → 서버
                                ↑ 중간자가 내용을 볼 수 없음
```

> **프로덕션 체크리스트**
> - TLS 인증서(Let's Encrypt 등) 적용
> - HTTP → HTTPS 리다이렉트 설정
> - HSTS(HTTP Strict Transport Security) 헤더 추가
> - JWT secret 키는 충분히 길고 무작위한 값으로 교체 (최소 32자 이상)

### httpOnly 쿠키로 Refresh Token 저장하기

현재 구현에서는 클라이언트가 Refresh Token을 직접 `Authorization` 헤더에 담아서 보낸다. 이 방식은 클라이언트 측 JavaScript에서 토큰에 접근할 수 있어 XSS(Cross-Site Scripting) 공격에 취약할 수 있다.

**httpOnly 쿠키**에 Refresh Token을 저장하면, JavaScript에서 토큰에 접근할 수 없어 XSS 공격 벡터를 차단할 수 있다.

#### 쿠키로 Refresh Token 발급 (AuthController 수정)

```typescript
// src/auth/auth.controller.ts
import { Response } from 'express';

@Public()
@UseGuards(LocalAuthGuard)
@Post('login')
@HttpCode(HttpStatus.OK)
async login(@Request() req: any, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken } = await this.authService.login(req.user);

  // Refresh Token을 httpOnly 쿠키로 설정
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,   // JavaScript에서 접근 불가 (XSS 방어)
    secure: true,     // HTTPS에서만 전송 (프로덕션 필수)
    sameSite: 'strict', // CSRF 방어
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7일 (밀리초)
    path: '/auth/refresh', // 이 경로에서만 쿠키 전송
  });

  // Access Token만 응답 body에 포함
  return { accessToken };
}
```

#### 쿠키에서 Refresh Token 읽기 (JwtRefreshStrategy 수정)

```typescript
// src/auth/strategies/jwt-refresh.strategy.ts (쿠키 방식)
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      // 쿠키에서 Refresh Token을 추출하는 커스텀 추출기
      jwtFromRequest: (req: Request) => {
        return req?.cookies?.refreshToken ?? null;
      },
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: number; email: string }) {
    const refreshToken = req?.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh Token 쿠키가 존재하지 않습니다.');
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.hashedRefreshToken) {
      throw new UnauthorizedException('이미 로그아웃된 사용자입니다.');
    }

    const isValid = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!isValid) {
      throw new UnauthorizedException('유효하지 않은 Refresh Token입니다.');
    }

    return { id: payload.sub, email: payload.email, refreshToken };
  }
}
```

쿠키를 읽으려면 `cookie-parser` 미들웨어를 설치하고 등록해야 한다.

```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser()); // 쿠키 파싱 미들웨어 등록
  await app.listen(3000);
}
bootstrap();
```

#### 로그아웃 시 쿠키 삭제

```typescript
// src/auth/auth.controller.ts
@UseGuards(JwtAuthGuard)
@Post('logout')
@HttpCode(HttpStatus.OK)
async logout(
  @Request() req: any,
  @Res({ passthrough: true }) res: Response,
) {
  await this.authService.logout(req.user.id);

  // httpOnly 쿠키를 빈 값으로 덮어쓰고 즉시 만료
  res.clearCookie('refreshToken', { path: '/auth/refresh' });

  return { message: '로그아웃되었습니다.' };
}
```

### Bearer 헤더 방식 vs httpOnly 쿠키 방식 비교

| 구분 | Bearer 헤더 방식 | httpOnly 쿠키 방식 |
| --- | --- | --- |
| XSS 공격 | 취약 (JS에서 토큰 접근 가능) | 방어됨 (JS 접근 불가) |
| CSRF 공격 | 방어됨 (헤더는 자동 전송 안 됨) | 취약 (쿠키는 자동 전송됨, `sameSite` 설정으로 완화) |
| 모바일 앱 | 적합 (쿠키 관리 불편) | 불편 (쿠키 핸들링 추가 필요) |
| 구현 복잡도 | 낮음 | 중간 (`cookie-parser`, `sameSite` 등 설정 필요) |
| 권장 환경 | 모바일 앱, 서버 간 통신 | 웹 브라우저 클라이언트 |

> **결론**: 웹 프론트엔드(React, Vue 등)와 함께 사용할 경우 **httpOnly 쿠키 방식이 더 안전**하다. 모바일 앱이나 서버 간 통신에서는 Bearer 헤더 방식이 더 적합하다. 이 챕터의 블로그 API는 두 방식 모두 적용 가능하도록 설계되어 있다.
---

## 다음 챕터 예고

챕터 13에서는 **Testing(테스트)**을 학습한다. 지금까지 만든 PostsService, AuthService의 핵심 로직에 단위 테스트를 작성하고, 회원가입~게시글 작성~삭제까지 E2E 테스트로 전체 플로우를 검증한다.

