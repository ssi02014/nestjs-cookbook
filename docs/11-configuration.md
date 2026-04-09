# 챕터 11 - Configuration

> **이전 챕터 요약**: 챕터 10에서 TypeORM으로 SQLite DB를 연동하고, User/Post/Comment Entity를 정의하여 메모리 배열 대신 실제 DB에 데이터를 저장하게 했다. 이번 챕터에서는 DB 연결 정보 등 **하드코딩된 설정값을 환경 변수로 분리**한다.


## 목차

- [1단계: 개념 학습](#1단계-개념-학습)
  - [왜 환경 변수가 필요한가?](#왜-환경-변수가-필요한가)
  - [@nestjs/config 패키지](#nestjsconfig-패키지)
  - [.env 파일](#env-파일)
  - [ConfigModule.forRoot() 옵션](#configmoduleforroot-옵션)
  - [ConfigService 사용법](#configservice-사용법)
  - [registerAs로 네임스페이스 설정](#registeras로-네임스페이스-설정)
  - [환경 변수 유효성 검사](#환경-변수-유효성-검사)
- [2단계: 기본 예제](#2단계-기본-예제)
  - [.env + ConfigModule 기본 사용](#env--configmodule-기본-사용)
  - [ConfigService.get() 예제](#configserviceget-예제)
  - [registerAs 네임스페이스 예제](#registeras-네임스페이스-예제)
- [3단계: 블로그 API 적용](#3단계-블로그-api-적용)
  - [@nestjs/config 설치](#nestjsconfig-설치)
  - [.env 파일 생성](#env-파일-생성)
  - [.env.example 작성과 .gitignore 설정](#envexample-작성과-gitignore-설정)
  - [네임스페이스 설정 파일 분리](#네임스페이스-설정-파일-분리)
  - [TypeORM 설정을 ConfigService로 교체](#typeorm-설정을-configservice로-교체)
  - [Joi로 환경 변수 유효성 검사](#joi로-환경-변수-유효성-검사)
  - [main.ts에서 ConfigService 활용](#maints에서-configservice-활용)
  - [최종 AppModule 통합](#최종-appmodule-통합)
  - [완성된 디렉토리 구조](#완성된-디렉토리-구조)
  - [환경별 설정 파일 분리 전략](#환경별-설정-파일-분리-전략)
  - [민감 정보 관리 팁](#민감-정보-관리-팁)

---

# 1단계: 개념 학습

이 단계에서는 NestJS에서 환경 변수를 관리하는 이유와 핵심 개념을 이해한다.

---

## 왜 환경 변수가 필요한가?

챕터 10에서 TypeORM을 설정할 때, 다음과 같이 데이터베이스 접속 정보를 코드에 직접 작성했다.

```typescript
// src/app.module.ts - 챕터 10에서의 하드코딩 예시
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: './blog.sqlite',  // 데이터베이스 경로가 코드에 박혀 있다
  synchronize: true,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
}),
```

이렇게 설정값을 코드에 직접 작성하는 것을 **하드코딩(hardcoding)**이라고 한다. 하드코딩에는 여러 문제가 있다.

### 하드코딩의 위험성

| 문제 | 설명 |
|------|------|
| **보안 위험** | JWT 비밀 키, DB 비밀번호 같은 민감한 정보가 소스 코드에 노출된다. Git에 커밋하면 누구나 볼 수 있다 |
| **환경 분리 불가** | 개발 환경에서는 SQLite, 운영 환경에서는 PostgreSQL을 쓰고 싶어도 코드를 매번 수정해야 한다 |
| **유지보수 어려움** | 설정값이 여러 파일에 흩어져 있으면 변경할 때 일일이 찾아 수정해야 한다 |
| **배포 위험** | 개발용 설정이 운영에 그대로 올라가는 사고가 발생할 수 있다 |

### 해결책: 환경 변수

환경 변수(Environment Variable)는 운영체제 수준에서 관리하는 키-값 쌍이다. 설정값을 코드 **밖**에 두면 위의 문제가 모두 해결된다.

```bash
# 코드를 수정하지 않고도, 환경에 따라 다른 값을 넣을 수 있다
DATABASE_PATH=./blog.sqlite          # 개발
DATABASE_PATH=/var/data/blog.db      # 운영
```

Node.js에서는 `process.env` 객체로 환경 변수에 접근할 수 있다.

```typescript
const dbPath = process.env.DATABASE_PATH; // './blog.sqlite'
```

하지만 `process.env`를 직접 사용하면 타입 안전성이 없고, 유효성 검사도 어렵다. NestJS는 `@nestjs/config` 패키지로 이 문제를 깔끔하게 해결한다.

> **팁:**: 업계에서 널리 알려진 [12-Factor App](https://12factor.net/config) 방법론에서도 "설정은 환경 변수에 저장하라"고 권장한다. 이는 대부분의 현대 웹 프레임워크가 따르는 모범 사례다.

---

## @nestjs/config 패키지

`@nestjs/config`는 NestJS 공식 설정 관리 패키지다. 내부적으로 [dotenv](https://github.com/motdotla/dotenv) 라이브러리를 사용하여 `.env` 파일을 읽고, `ConfigService`를 통해 환경 변수에 안전하게 접근할 수 있게 해준다.

### 주요 기능

- `.env` 파일에서 환경 변수를 자동으로 로드
- `ConfigService`를 통한 타입 안전한 접근
- `registerAs()`로 관련 설정을 네임스페이스로 그룹화
- Joi 또는 class-validator로 환경 변수 유효성 검사
- 환경별 `.env` 파일 분리 지원

---

## .env 파일

`.env` 파일은 프로젝트 루트에 위치하며, `KEY=VALUE` 형식으로 환경 변수를 정의한다.

```bash
# .env
PORT=3000
DATABASE_PATH=./blog.sqlite
JWT_SECRET=my-super-secret-key
```

### 핵심 규칙

1. `.env` 파일은 **절대 Git에 커밋하지 않는다** (`.gitignore`에 추가)
2. 팀원들이 어떤 환경 변수가 필요한지 알 수 있도록 `.env.example` 파일을 만든다
3. `.env.example`에는 실제 비밀 값 대신 예시 값이나 빈 값을 넣는다

```bash
# .env.example - Git에 커밋해도 안전하다
PORT=3000
DATABASE_PATH=./blog.sqlite
JWT_SECRET=your-secret-key-here
JWT_ACCESS_EXPIRATION=1h
```

> **팁:**: 새로운 팀원이 프로젝트에 합류하면 `.env.example`을 복사하여 `.env`를 만들고, 자신의 환경에 맞게 값을 채우면 된다. `cp .env.example .env`

---

## ConfigModule.forRoot() 옵션

`ConfigModule.forRoot()`는 `.env` 파일을 읽어 애플리케이션 전체에서 환경 변수를 사용할 수 있게 해준다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,        // 모든 모듈에서 ConfigService를 바로 주입받을 수 있다
      envFilePath: '.env',   // 읽을 .env 파일 경로 (기본값이 '.env'이므로 생략 가능)
      cache: true,           // 환경 변수 접근을 캐시하여 성능을 높인다
    }),
  ],
})
export class AppModule {}
```

### 주요 옵션 정리

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `isGlobal` | `boolean` | `false` | `true`면 다른 모듈에서 `ConfigModule`을 import하지 않아도 `ConfigService`를 주입받을 수 있다 |
| `envFilePath` | `string \| string[]` | `'.env'` | `.env` 파일 경로. 배열로 여러 파일을 지정하면 앞의 파일이 우선순위가 높다 |
| `ignoreEnvFile` | `boolean` | `false` | `true`면 `.env` 파일을 읽지 않는다. 운영 환경에서 시스템 환경 변수만 사용할 때 유용하다 |
| `expandVariables` | `boolean` | `false` | `.env`에서 `${VAR}` 형식으로 다른 변수를 참조할 수 있다 |
| `cache` | `boolean` | `false` | `ConfigService.get()` 결과를 메모리에 캐시한다 |
| `load` | `Function[]` | `[]` | `registerAs()`로 만든 커스텀 설정 팩토리 함수 배열 |
| `validationSchema` | `object` | - | Joi 스키마로 환경 변수를 시작 시점에 검증한다 |

> **팁:**: `isGlobal: true`는 거의 항상 사용한다. 이 옵션이 없으면 `ConfigService`가 필요한 모든 모듈에서 `ConfigModule`을 일일이 import해야 한다.

---

## ConfigService 사용법

`ConfigService`는 환경 변수를 읽어오는 서비스다. DI를 통해 생성자에서 주입받아 사용한다.

### 핵심 메서드

| 메서드 | 값이 없을 때 | 용도 |
|--------|-------------|------|
| `get<T>(key)` | `undefined` 반환 | 선택적인 설정, 기본값과 함께 사용 |
| `get<T>(key, defaultValue)` | `defaultValue` 반환 | 기본값을 명시적으로 지정할 때 |
| `getOrThrow<T>(key)` | 예외 발생 | 반드시 존재해야 하는 설정 (DB 정보, JWT 비밀 키 등) |

```typescript
// 예시: 서비스에서 환경 변수 읽기
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SomeService {
  constructor(private readonly configService: ConfigService) {}

  example() {
    // 기본 사용: 값이 없으면 undefined
    const port = this.configService.get<number>('PORT');

    // 기본값 지정: 값이 없으면 3000
    const portWithDefault = this.configService.get<number>('PORT', 3000);

    // 필수 값: 없으면 애플리케이션이 에러를 던진다
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
  }
}
```

---

## registerAs로 네임스페이스 설정

환경 변수가 많아지면 관련된 설정끼리 **네임스페이스(namespace)**로 묶는 것이 좋다. `registerAs()` 함수가 바로 이 역할을 한다.

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

// 'database'라는 네임스페이스로 DB 관련 설정을 묶는다
export default registerAs('database', () => ({
  path: process.env.DATABASE_PATH || './blog.sqlite',
}));
```

이렇게 등록하면 `ConfigService`에서 점(`.`) 표기법으로 접근할 수 있다.

```typescript
// 네임스페이스로 접근
const path = this.configService.get<string>('database.path');

// 네임스페이스 전체를 객체로 가져올 수도 있다
const dbConfig = this.configService.get('database');
// { path: './blog.sqlite' }
```

### 타입 안전한 접근: [@Inject](../references/decorators.md#injecttoken) + ConfigType

`registerAs()`로 정의한 설정은 [`@Inject`](../references/decorators.md#injecttoken)와 `ConfigType`을 조합하면 타입이 자동으로 추론된다. 이것이 가장 권장되는 방법이다.

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import databaseConfig from '../config/database.config';

@Injectable()
export class SomeService {
  constructor(
    @Inject(databaseConfig.KEY)
    private readonly dbConfig: ConfigType<typeof databaseConfig>,
  ) {}

  example() {
    // dbConfig.path의 타입이 string으로 자동 추론된다
    console.log(this.dbConfig.path);
  }
}
```

---

## 환경 변수 유효성 검사

애플리케이션이 시작될 때 필수 환경 변수가 빠져 있으면, 런타임에 예상치 못한 에러가 발생한다. **시작 시점에 바로 실패**하는 것이 훨씬 안전하다.

`@nestjs/config`는 [Joi](https://github.com/hapijs/joi) 라이브러리를 사용한 유효성 검사를 지원한다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema: Joi.object({
        PORT: Joi.number().default(3000),
        DATABASE_PATH: Joi.string().required(),
        JWT_SECRET: Joi.string().required().min(10),
      }),
    }),
  ],
})
export class AppModule {}
```

만약 `DATABASE_PATH`가 `.env`에 없으면 애플리케이션이 시작되지 않고 아래 같은 에러가 출력된다.

```
Error: Config validation error: "DATABASE_PATH" is required
```

> **팁:**: `required()`는 "반드시 있어야 한다", `default(값)`은 "없으면 이 값을 쓴다"라는 뜻이다. 민감한 정보(비밀 키 등)에는 `required()`를, 포트 번호처럼 합리적인 기본값이 있는 항목에는 `default()`를 사용하자.

---

# 2단계: 기본 예제

개념을 코드로 직접 확인해 본다. 아직 블로그 API에 적용하지 않고, 작은 예제로 동작 원리를 익힌다.

---

## .env + ConfigModule 기본 사용

```bash
# .env (프로젝트 루트에 생성)
APP_NAME=MyBlog
PORT=3000
DEBUG=true
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // 어디서든 ConfigService를 주입받을 수 있다
    }),
  ],
})
export class AppModule {}
```

이것만으로 `.env` 파일의 내용이 `process.env`에 로드되고, `ConfigService`를 통해 읽을 수 있게 된다.

---

## ConfigService.get() 예제

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('config-test')
  getConfig() {
    return {
      // get<T>(key): 환경 변수를 읽는다
      appName: this.configService.get<string>('APP_NAME'),

      // get<T>(key, defaultValue): 없으면 기본값을 사용한다
      port: this.configService.get<number>('PORT', 3000),

      // getOrThrow<T>(key): 없으면 예외를 던진다
      debug: this.configService.getOrThrow<string>('DEBUG'),
    };
  }
}
```

`GET /config-test` 요청 결과:

```json
{
  "appName": "MyBlog",
  "port": 3000,
  "debug": "true"
}
```

> **주의:**: `.env`에서 읽은 값은 항상 **문자열**이다. `PORT=3000`을 읽으면 숫자 `3000`이 아니라 문자열 `"3000"`이다. `get<number>('PORT')`의 제네릭은 TypeScript 타입 힌트일 뿐, 실제 변환은 하지 않는다. 숫자가 필요하면 `parseInt()`를 사용하거나, `registerAs()` 안에서 변환해야 한다.

---

## registerAs 네임스페이스 예제

환경 변수를 용도별로 그룹화하는 예제다.

```bash
# .env
DATABASE_PATH=./blog.sqlite
JWT_SECRET=super-secret-key-12345
JWT_ACCESS_EXPIRATION=1h
```

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  path: process.env.DATABASE_PATH || './blog.sqlite',
}));
```

```typescript
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET,
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '1h',
}));
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig], // 네임스페이스 설정 파일들을 등록한다
    }),
  ],
})
export class AppModule {}
```

```typescript
// src/app.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get('namespace-test')
  getNamespacedConfig() {
    return {
      // 점(.) 표기법으로 네임스페이스에 접근한다
      dbPath: this.configService.get<string>('database.path'),
      jwtSecret: this.configService.get<string>('jwt.secret'),
      jwtExpiration: this.configService.get<string>('jwt.accessExpiration'),
    };
  }
}
```

`GET /namespace-test` 요청 결과:

```json
{
  "dbPath": "./blog.sqlite",
  "jwtSecret": "super-secret-key-12345",
  "jwtExpiration": "1h"
}
```

---

# 3단계: 블로그 API 적용

챕터 10에서 만든 블로그 API에 `@nestjs/config`를 적용한다. 하드코딩된 설정값을 환경 변수로 교체하고, 유효성 검사까지 추가한다.

---

## @nestjs/config 설치

```bash
# @nestjs/config 설치 (내부적으로 dotenv를 사용한다)
npm install @nestjs/config

# 환경 변수 유효성 검사를 위한 Joi 설치
npm install joi
```

---

## .env 파일 생성

프로젝트 루트에 `.env` 파일을 만든다.

```bash
# .env
# 서버 설정
PORT=3000

# 데이터베이스 설정
DATABASE_PATH=./blog.sqlite

# JWT 설정
JWT_SECRET=blog-api-super-secret-key-2024
JWT_ACCESS_EXPIRATION=1h
```

> **팁:**: `JWT_SECRET`은 충분히 길고 예측 불가능한 문자열을 사용해야 한다. 위 값은 예시일 뿐이고, 실제 프로젝트에서는 `openssl rand -hex 32` 같은 명령어로 랜덤 문자열을 생성하는 것이 좋다.

---

## .env.example 작성과 .gitignore 설정

팀원이 어떤 환경 변수가 필요한지 알 수 있도록 `.env.example`을 만든다.

```bash
# .env.example - 이 파일은 Git에 커밋한다
# 사용법: 이 파일을 복사하여 .env를 만들고 값을 채운다
#   cp .env.example .env

# 서버 설정
PORT=3000

# 데이터베이스 설정
DATABASE_PATH=./blog.sqlite

# JWT 설정 (반드시 10자 이상의 안전한 값을 사용할 것)
JWT_SECRET=
JWT_ACCESS_EXPIRATION=1h
```

`.gitignore`에 `.env`를 추가하여 민감한 정보가 Git에 올라가지 않도록 한다.

```bash
# .gitignore (아래 내용을 추가한다)
.env
.env.development
.env.production
.env.test
```

---

## 네임스페이스 설정 파일 분리

환경 변수를 용도별로 그룹화하는 설정 파일을 만든다. `src/config/` 디렉토리를 생성한다.

### database.config.ts

```typescript
// src/config/database.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  // 데이터베이스 파일 경로
  // .env에 DATABASE_PATH가 없으면 기본값 './blog.sqlite'를 사용한다
  path: process.env.DATABASE_PATH || './blog.sqlite',

  // synchronize는 Entity 변경 시 테이블을 자동 동기화한다
  // 개발 환경에서만 true, 운영에서는 반드시 false
  synchronize: process.env.NODE_ENV !== 'production',
}));
```

### jwt.config.ts

```typescript
// src/config/jwt.config.ts
import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  // JWT 서명에 사용할 비밀 키 (필수)
  secret: process.env.JWT_SECRET,

  // Access Token 만료 시간 (기본 1시간)
  accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '1h',
}));
```

> **팁:**: `registerAs('database', ...)`에서 첫 번째 인자 `'database'`가 네임스페이스 이름이 된다. 나중에 `configService.get('database.path')`처럼 접근한다. 네임스페이스 이름은 파일 이름과 맞추는 것이 관례다.

---

## TypeORM 설정을 ConfigService로 교체

챕터 10에서 하드코딩했던 TypeORM 설정을 `ConfigService`로 교체한다. 핵심은 `TypeOrmModule.forRoot()` 대신 `TypeOrmModule.forRootAsync()`를 사용하는 것이다.

### 변경 전 (챕터 10 - 하드코딩)

```typescript
// src/app.module.ts - 변경 전
TypeOrmModule.forRoot({
  type: 'sqlite',
  database: './blog.sqlite',     // 하드코딩!
  synchronize: true,             // 하드코딩!
  autoLoadEntities: true,
}),
```

### 변경 후 (ConfigService 사용)

```typescript
// src/app.module.ts - 변경 후
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';

// ...
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [databaseConfig.KEY],
  useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
    type: 'sqlite',
    database: dbConfig.path,           // .env에서 읽어온 값
    synchronize: dbConfig.synchronize, // 환경에 따라 자동 결정
    autoLoadEntities: true,
  }),
}),
```

### forRoot vs forRootAsync

| 메서드 | 설명 |
|--------|------|
| `forRoot(옵션)` | 옵션을 즉시 전달한다. 정적인 값만 사용 가능하다 |
| `forRootAsync(옵션)` | 다른 서비스(ConfigService 등)를 주입받아 비동기로 옵션을 만든다. **환경 변수를 사용할 때는 반드시 이것을 사용한다** |

`forRootAsync`의 구조를 분해해 보자.

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],         // 1. 이 모듈의 프로바이더를 사용하겠다
  inject: [databaseConfig.KEY],    // 2. 이 토큰을 팩토리에 주입해 달라
  useFactory: (dbConfig) => ({     // 3. 주입받은 값으로 설정 객체를 만든다
    type: 'sqlite',
    database: dbConfig.path,
    // ...
  }),
}),
```

---

## Joi로 환경 변수 유효성 검사

애플리케이션이 시작될 때 필수 환경 변수가 빠져 있으면 즉시 에러를 내도록 한다.

```typescript
// src/config/env.validation.ts
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // PORT: 숫자, 없으면 기본값 3000
  PORT: Joi.number().default(3000),

  // DATABASE_PATH: 문자열, 필수
  DATABASE_PATH: Joi.string().required(),

  // JWT_SECRET: 문자열, 필수, 최소 10자
  JWT_SECRET: Joi.string().required().min(10),

  // JWT_ACCESS_EXPIRATION: 문자열, 없으면 기본값 '1h'
  JWT_ACCESS_EXPIRATION: Joi.string().default('1h'),
}).options({
  // .env에는 시스템이 자동으로 추가하는 변수도 많다
  // 우리가 정의하지 않은 변수는 그냥 무시한다
  allowUnknown: true,
});
```

### Joi 메서드 정리

| 메서드 | 의미 |
|--------|------|
| `Joi.string()` | 문자열 타입이어야 한다 |
| `Joi.number()` | 숫자 타입이어야 한다 |
| `.required()` | 반드시 존재해야 한다 (없으면 시작 실패) |
| `.default(값)` | 없으면 이 값을 기본값으로 사용한다 |
| `.min(n)` | 문자열은 최소 n자, 숫자는 최소값 n |
| `.valid('a', 'b')` | 지정한 값 중 하나여야 한다 |

> **팁:**: `abortEarly` 옵션을 `false`로 설정하면 모든 유효성 검사 에러를 한 번에 볼 수 있다. 기본값은 `true`(첫 번째 에러에서 중단)이다. `ConfigModule.forRoot()`의 `validationOptions`에서 설정한다.

---

## main.ts에서 ConfigService 활용

`main.ts`에서도 환경 변수로 포트 번호를 설정할 수 있다. `main.ts`는 DI 컨테이너 바깥이므로 `app.get()`으로 서비스를 직접 가져와야 한다.

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // main.ts에서는 app.get()으로 ConfigService를 꺼내 쓴다
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  await app.listen(port);
  console.log(`Blog API is running on http://localhost:${port}`);
}
bootstrap();
```

---

## 최종 AppModule 통합

모든 설정을 합친 최종 `AppModule`이다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import { envValidationSchema } from './config/env.validation';
// 챕터 10에서 만든 모듈들
import { PostsModule } from './posts/posts.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // 1. ConfigModule: 환경 변수를 로드하고 유효성을 검사한다
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // 모든 에러를 한 번에 표시
      },
      cache: true,
    }),

    // 2. TypeORM: ConfigService에서 설정값을 가져와 연결한다
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [databaseConfig.KEY],
      useFactory: (dbConfig: ConfigType<typeof databaseConfig>) => ({
        type: 'sqlite',
        database: dbConfig.path,
        synchronize: dbConfig.synchronize,
        autoLoadEntities: true,
      }),
    }),

    // 3. 기능 모듈들 (챕터 10에서 만든 것)
    PostsModule,
    UsersModule,
  ],
})
export class AppModule {}
```

### 달라진 점 정리

| 항목 | 변경 전 (챕터 10) | 변경 후 (챕터 11) |
|------|-------------------|-------------------|
| DB 경로 | `'./blog.sqlite'` 하드코딩 | `.env`의 `DATABASE_PATH`에서 읽음 |
| synchronize | `true` 하드코딩 | `NODE_ENV`에 따라 자동 결정 |
| JWT 비밀 키 | (아직 없음) | `.env`의 `JWT_SECRET`에서 읽음 |
| 포트 번호 | `3000` 하드코딩 | `.env`의 `PORT`에서 읽음 |
| 유효성 검사 | 없음 | Joi로 시작 시 검증 |

---

## 완성된 디렉토리 구조

이 챕터를 마치면 프로젝트에 다음 파일들이 추가된다.

```
프로젝트 루트/
├── .env                              # 실제 환경 변수 (Git에 커밋하지 않음)
├── .env.example                      # 환경 변수 템플릿 (Git에 커밋함)
├── .gitignore                        # .env 추가됨
├── src/
│   ├── config/
│   │   ├── database.config.ts        # DB 네임스페이스 설정
│   │   ├── jwt.config.ts             # JWT 네임스페이스 설정
│   │   └── env.validation.ts         # Joi 유효성 검사 스키마
│   ├── posts/                        # 챕터 10에서 만든 모듈
│   ├── users/                        # 챕터 10에서 만든 모듈
│   ├── app.module.ts                 # ConfigModule + TypeORM 통합
│   └── main.ts                       # ConfigService로 포트 설정
└── ...
```

---

## 환경별 설정 파일 분리 전략

실제 프로젝트에서는 개발(development), 운영(production), 테스트(test) 환경마다 설정값이 다르다. `.env` 파일을 환경별로 분리하면 이를 깔끔하게 관리할 수 있다.

### 환경별 .env 파일 역할

| 파일 | 역할 |
|------|------|
| `.env` | 로컬 개발 기본값. `NODE_ENV`가 명시되지 않을 때 fallback으로 사용된다 |
| `.env.development` | 개발 서버 전용 설정 (로컬 DB 경로, 디버그 모드 등) |
| `.env.production` | 운영 서버 전용 설정 (실제 DB 접속 정보, 강화된 보안 값 등) |
| `.env.test` | 테스트 실행 전용 설정 (인메모리 DB, 짧은 토큰 만료 시간 등) |

### NODE_ENV에 따라 파일을 자동으로 선택하기

`ConfigModule.forRoot()`의 `envFilePath`에 템플릿 문자열을 사용하면 `NODE_ENV` 값에 맞는 파일을 자동으로 읽는다.

```typescript
// src/app.module.ts
ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: `.env.${process.env.NODE_ENV}`, // ex) .env.development, .env.production
  load: [databaseConfig, jwtConfig],
  validationSchema: envValidationSchema,
}),
```

> **팁:**: `envFilePath`에 배열을 전달하면 앞에 오는 파일이 우선순위가 높다. 환경별 파일을 앞에, 공통 `.env`를 뒤에 두면 환경별 값이 공통 값을 덮어쓴다.
>
> ```typescript
> envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
> ```

### cross-env로 NODE_ENV 통일하기

Windows와 macOS/Linux는 환경 변수를 설정하는 문법이 다르다. `cross-env` 패키지를 사용하면 OS에 관계없이 동일한 스크립트를 쓸 수 있다.

```bash
npm install --save-dev cross-env
```

```json
// package.json
{
  "scripts": {
    "start:dev": "cross-env NODE_ENV=development nest start --watch",
    "start:prod": "cross-env NODE_ENV=production node dist/main",
    "test": "cross-env NODE_ENV=test jest"
  }
}
```

이제 `npm run start:dev`를 실행하면 `NODE_ENV=development`가 설정되고, `ConfigModule`이 `.env.development` 파일을 자동으로 읽는다.

### .gitignore 설정

모든 `.env` 파일에는 민감한 정보가 포함될 수 있으므로 Git에서 반드시 제외한다. `.env.example`만 커밋하여 팀원에게 필요한 변수 목록을 전달한다.

```bash
# .gitignore
.env
.env.development
.env.production
.env.test
# .env.example 은 제외하지 않는다 — 팀원을 위해 커밋한다
```

```bash
# .env.example - 이 파일은 Git에 커밋한다
# 사용법: cp .env.example .env.development 후 값을 채운다

PORT=3000
DATABASE_PATH=./blog.sqlite
JWT_SECRET=           # 10자 이상의 안전한 값을 입력할 것
JWT_ACCESS_EXPIRATION=1h
```

---

## 민감 정보 관리 팁

설정 관리에서 가장 중요한 원칙은 **민감한 정보를 코드에 하드코딩하지 않는 것**이다.

### 절대 코드에 하드코딩하지 말아야 할 값들

```typescript
// 잘못된 예 — 절대 이렇게 하지 말 것
@Module({
  imports: [
    JwtModule.register({
      secret: 'my-hardcoded-secret', // 위험! Git에 노출된다
    }),
    TypeOrmModule.forRoot({
      password: 'db-password-1234',  // 위험! 공격자가 바로 확인 가능
    }),
  ],
})
```

| 민감 정보 예시 | 올바른 관리 방법 |
|----------------|-----------------|
| DB 비밀번호 | `.env`에 저장, `ConfigService`로 읽기 |
| JWT 시크릿 키 | `.env`에 저장, 충분한 길이(32자 이상) 권장 |
| API 키 / 토큰 | `.env`에 저장, `.gitignore`로 제외 |
| OAuth 클라이언트 시크릿 | `.env`에 저장 또는 시크릿 매니저 사용 |

### 프로덕션 환경 권고 사항

개발 환경에서는 `.env` 파일로 충분하지만, 실제 운영 서버에서는 더 강화된 방법을 사용하는 것이 좋다.

1. **시스템 환경 변수 직접 주입**: CI/CD 파이프라인(GitHub Actions, GitLab CI 등)이나 Docker Compose의 `environment` 블록에서 직접 값을 주입한다. 이 경우 `.env` 파일 없이도 동작하도록 `ignoreEnvFile: true` 옵션을 함께 사용한다.

   ```typescript
   ConfigModule.forRoot({
     ignoreEnvFile: process.env.NODE_ENV === 'production', // 운영에서는 .env 파일을 읽지 않는다
   }),
   ```

2. **시크릿 매니저 사용**: AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault 같은 전용 서비스를 활용하면 비밀 값의 접근 권한을 세밀하게 제어하고, 값 변경 이력을 추적하며, 자동 교체(rotation)까지 지원한다.

> **핵심 원칙**: 비밀 키나 비밀번호가 Git 히스토리에 한 번이라도 올라갔다면, 그 값은 이미 노출된 것으로 간주하고 즉시 교체해야 한다. `git revert`나 `git reset`으로 커밋을 되돌려도 원격 저장소 히스토리에서 완전히 삭제하기는 매우 어렵다.

---

## 정리

| 개념 | 핵심 포인트 |
|------|------------|
| 환경 변수의 필요성 | 하드코딩은 보안, 유연성, 유지보수 측면에서 위험하다 |
| `@nestjs/config` | `.env` 파일을 읽어 `ConfigService`로 안전하게 접근하게 해주는 공식 패키지 |
| `ConfigModule.forRoot()` | `isGlobal: true`로 전역 설정, `load`로 네임스페이스 등록, `validationSchema`로 검증 |
| `ConfigService` | `get()`, `getOrThrow()`로 환경 변수를 읽는다. `main.ts`에서는 `app.get(ConfigService)`로 사용 |
| `registerAs()` | 관련 설정을 네임스페이스로 묶는다. [`@Inject(config.KEY)`](../references/decorators.md#injecttoken) + `ConfigType`으로 타입 안전하게 접근 |
| `.env` + `.env.example` | `.env`는 Git에서 제외, `.env.example`은 커밋하여 팀원에게 필요한 변수 목록을 알린다 |
| Joi 유효성 검사 | 필수 환경 변수가 빠졌을 때 시작 시점에 즉시 실패하도록 한다 |
| `forRootAsync()` | TypeORM 등 외부 모듈 설정에 ConfigService를 주입하기 위해 사용한다 |

> **다음 챕터 예고**: 챕터 12에서는 이 챕터에서 설정한 `JWT_SECRET`과 `JWT_ACCESS_EXPIRATION`을 활용하여 JWT 기반 인증(Authentication)을 구현한다.
---

## 다음 챕터 예고

챕터 12에서는 **Authentication(인증)**을 학습한다. 챕터 6의 SimpleAuthGuard를 JWT 기반 인증으로 교체한다. 회원가입/로그인/토큰 갱신/로그아웃 엔드포인트를 만들고, Refresh Token을 DB에 안전하게 저장하는 방법도 배운다.

