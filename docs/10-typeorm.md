# 챕터 10 - TypeORM 연동

> **이전 챕터 요약**: 챕터 1~9에서 모듈, 컨트롤러, 서비스, 미들웨어, 파이프, 가드, 인터셉터, 예외 필터, 커스텀 데코레이터를 학습했다. 지금까지 블로그 API의 데이터는 **메모리 배열**에 저장했기 때문에 서버를 재시작하면 모두 사라졌다. 이번 챕터에서 **실제 데이터베이스**에 데이터를 저장하도록 전환한다.

## 목차

### 1단계: 개념 학습
1. [ORM이란? TypeORM이란?](#1-orm이란-typeorm이란)
2. [NestJS에서 TypeORM 설정](#2-nestjs에서-typeorm-설정)
3. [Entity 정의](#3-entity-정의)
4. [Repository 패턴](#4-repository-패턴)
5. [관계 설정](#5-관계-설정)
6. [마이그레이션 기초](#6-마이그레이션-기초)
7. [트랜잭션](#7-트랜잭션)

### 2단계: 기본 예제
8. [SQLite 설정 (가장 간단한 DB)](#8-sqlite-설정-가장-간단한-db)
9. [Cat Entity + CRUD Repository 예제](#9-cat-entity--crud-repository-예제)
10. [OneToMany 관계 예제](#10-onetomany-관계-예제)

### 3단계: 블로그 API 적용
11. [블로그 DB 설계와 Entity 작성](#11-블로그-db-설계와-entity-작성)
12. [메모리 배열에서 Repository로 리팩토링](#12-메모리-배열에서-repository로-리팩토링)
13. [페이지네이션 구현](#13-페이지네이션-구현)
14. [PostgreSQL/MySQL 전환 방법](#14-postgresqlmysql-전환-방법)
15. [N+1 문제와 해결법](#15-n1-문제와-해결법)
16. [프로젝트 구조](#프로젝트-구조)

### 4단계: 정리
17. [정리](#정리)
18. [다음 챕터 예고](#다음-챕터-예고)

---

# 1단계: 개념 학습

---


## 1. ORM이란? TypeORM이란?

### ORM(Object-Relational Mapping)이란?

ORM은 **프로그래밍 언어의 객체**와 **관계형 데이터베이스의 테이블**을 자동으로 연결해주는 기술이다. 쉽게 말해, SQL을 직접 작성하지 않고도 TypeScript 코드만으로 데이터베이스를 조작할 수 있게 해준다.

```
[ ORM 없이 ]                       [ ORM 사용 ]
                                    
const result = db.query(            const users = await
  'SELECT * FROM users              userRepository.find();
   WHERE age > 20                   // TypeScript 객체 배열이 바로 반환됨
   ORDER BY name ASC'
);
// 결과를 직접 파싱해야 함
```

**SQL을 직접 안 써도 되는 이유**: ORM이 TypeScript 코드를 분석해서 적절한 SQL로 변환하고 실행해준다. `userRepository.find({ where: { age: MoreThan(20) } })`라고 쓰면, 내부적으로 `SELECT * FROM users WHERE age > 20` SQL이 자동 생성된다.

### TypeORM이란?

**TypeORM**은 TypeScript/JavaScript를 위한 ORM 라이브러리다. NestJS와 가장 잘 어울리는 ORM이며, 공식적으로 `@nestjs/typeorm` 패키지를 제공한다.

| 특징 | 설명 |
|------|------|
| **데코레이터 기반** | [`@Entity()`](references/decorators.md#entitytablename), [`@Column()`](references/decorators.md#columnoptions) 등 NestJS와 동일한 데코레이터 패턴 |
| **다양한 DB 지원** | MySQL, PostgreSQL, SQLite, MariaDB, Oracle 등 |
| **Repository 패턴** | 데이터 접근 로직을 깔끔하게 분리 |
| **관계 매핑** | 1:1, 1:N, N:M 관계를 데코레이터로 표현 |
| **마이그레이션** | 스키마 변경 이력을 코드로 관리 |

### TypeORM의 두 가지 패턴

TypeORM은 **Active Record**와 **Data Mapper** 두 가지 패턴을 지원한다. NestJS에서는 DI(의존성 주입)와 잘 어울리는 **Data Mapper 패턴(Repository 패턴)** 을 사용한다.

```typescript
// Active Record 패턴 (NestJS에서는 잘 안 씀)
const user = new User();
user.name = "홍길동";
await user.save(); // Entity 자체에 save() 메서드가 있음

// Data Mapper 패턴 (NestJS에서 권장) ✅
const user = userRepository.create({ name: "홍길동" });
await userRepository.save(user); // Repository를 통해 저장
```

> **팁:** 왜 Data Mapper를 쓸까?
> Data Mapper 패턴은 Entity(데이터 구조)와 Repository(데이터 접근 로직)를 분리한다. 이렇게 하면 테스트할 때 Repository를 모킹하기 쉽고, NestJS의 DI 컨테이너와 자연스럽게 통합된다.

---

## 2. NestJS에서 TypeORM 설정

### 패키지 설치

사용하는 데이터베이스에 따라 드라이버가 다르다.

```bash
# PostgreSQL 사용 시
npm install @nestjs/typeorm typeorm pg

# MySQL 사용 시
npm install @nestjs/typeorm typeorm mysql2

# SQLite 사용 시 (이번 챕터에서 사용)
npm install @nestjs/typeorm typeorm better-sqlite3
```

> **팁:** 왜 SQLite?
> SQLite는 별도의 DB 서버를 설치할 필요가 없다. 파일 하나로 동작하므로 학습과 개발 초기 단계에 가장 적합하다. 나중에 PostgreSQL이나 MySQL로 전환하는 것도 Entity 코드 변경 없이 설정만 바꾸면 된다.

### AppModule에서 TypeORM 설정

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',          // DB 종류
      database: 'database.sqlite',     // DB 파일 경로
      entities: [__dirname + '/**/*.entity{.ts,.js}'], // Entity 파일 위치
      synchronize: true,               // Entity 변경 시 테이블 자동 업데이트
    }),
  ],
})
export class AppModule {}
```

> **주의:** synchronize: true는 개발 전용!
> `synchronize: true`는 Entity 클래스가 바뀌면 테이블 구조를 자동으로 변경한다. 편리하지만 프로덕션에서는 데이터 손실 위험이 있으므로 반드시 `false`로 설정하고 마이그레이션을 사용해야 한다.

### 환경 변수를 활용한 설정 (실무 권장)

챕터 11(Configuration)에서 자세히 다루지만, 미리 보여주면 이런 형태다.

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'better-sqlite3',
        database: configService.get<string>('DB_DATABASE', 'database.sqlite'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
  ],
})
export class AppModule {}
```

---

## 3. Entity 정의

**Entity**는 데이터베이스 테이블에 매핑되는 TypeScript 클래스다. 데코레이터로 테이블명, 컬럼 타입, 제약조건 등을 선언한다.

### 기본 Entity 예시

```typescript
// src/cats/entities/cat.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('cats')  // 'cats' 테이블에 매핑 (생략하면 클래스명 소문자가 사용됨)
export class Cat {
  @PrimaryGeneratedColumn()  // 자동 증가 Primary Key (1, 2, 3, ...)
  id: number;

  @Column({ type: 'varchar', length: 50 })  // VARCHAR(50)
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar', length: 50, nullable: true })  // NULL 허용
  breed: string;

  @CreateDateColumn()  // INSERT 시 현재 시간 자동 기록
  createdAt: Date;
}
```

위 Entity는 다음 테이블과 같다.

```
┌──────────────────────────────────────────────┐
│                  cats 테이블                   │
├────────────┬────────────┬────────────────────┤
│  컬럼명     │  타입       │  제약조건            │
├────────────┼────────────┼────────────────────┤
│  id        │  INTEGER   │  PK, 자동증가        │
│  name      │  VARCHAR   │  NOT NULL           │
│  age       │  INTEGER   │  NOT NULL           │
│  breed     │  VARCHAR   │  NULL 허용           │
│  createdAt │  DATETIME  │  자동 생성            │
└────────────┴────────────┴────────────────────┘
```

### 주요 데코레이터 정리

| 데코레이터 | 설명 | 예시 |
|---|---|---|
| [`@Entity()`](references/decorators.md#entitytablename) | 클래스를 테이블로 매핑 | [`@Entity('users')`](references/decorators.md#entitytablename) |
| [`@PrimaryGeneratedColumn()`](references/decorators.md#컬럼-데코레이터) | 자동 증가 PK | `id: number` |
| [`@PrimaryGeneratedColumn('uuid')`](references/decorators.md#컬럼-데코레이터) | UUID PK | `id: string` |
| [`@Column()`](references/decorators.md#columnoptions) | 일반 컬럼 | [`@Column({ type: 'varchar' })`](references/decorators.md#columnoptions) |
| [`@CreateDateColumn()`](references/decorators.md#createdatecolumn-updatedatecolumn-deletedatecolumn) | 생성 시간 자동 기록 | `createdAt: Date` |
| [`@UpdateDateColumn()`](references/decorators.md#createdatecolumn-updatedatecolumn-deletedatecolumn) | 수정 시간 자동 기록 | `updatedAt: Date` |
| [`@DeleteDateColumn()`](references/decorators.md#createdatecolumn-updatedatecolumn-deletedatecolumn) | 소프트 삭제 시간 | `deletedAt: Date` |

### [@Column](references/decorators.md#columnoptions) 주요 옵션

```typescript
@Column({
  type: 'varchar',      // 컬럼 타입
  length: 100,          // 길이
  nullable: false,      // NULL 허용 여부 (기본값: false)
  unique: true,         // 유니크 제약조건
  default: 'user',      // 기본값
  select: false,        // find()로 조회할 때 자동 포함 여부 (비밀번호에 유용)
  name: 'column_name',  // 실제 DB 컬럼명이 다를 경우
})
```

### Enum 타입 컬럼

```typescript
// src/users/entities/user.entity.ts
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class User {
  // ... 다른 컬럼들

  @Column({
    type: 'varchar',        // SQLite에서는 'varchar'로 저장
    default: UserRole.USER,
  })
  role: UserRole;
}
```

> **팁:** SQLite와 enum
> SQLite는 `enum` 타입을 지원하지 않는다. 대신 `type: 'varchar'`로 지정하면 문자열로 저장된다. PostgreSQL이나 MySQL에서는 `type: 'enum', enum: UserRole`을 사용할 수 있다.

---

## 4. Repository 패턴

### Repository란?

Repository는 **데이터베이스 접근 로직을 캡슐화하는 계층**이다. 서비스(Service)는 비즈니스 로직에만 집중하고, 실제 DB 조작은 Repository에 위임한다.

```
[ 요청 흐름 ]

Controller  →  Service  →  Repository  →  Database
  (HTTP)       (로직)      (DB 접근)       (SQLite)
```

TypeORM은 각 Entity마다 **기본 Repository를 자동으로 생성**해준다. `find`, `findOne`, `save`, `remove` 등의 메서드가 이미 내장되어 있으므로 직접 SQL을 작성할 필요가 없다.

### 모듈에 Entity 등록 - forFeature()

```typescript
// src/cats/cats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cat } from './entities/cat.entity';
import { CatsService } from './cats.service';
import { CatsController } from './cats.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cat]),  // 이 모듈에서 사용할 Entity 등록
  ],
  controllers: [CatsController],
  providers: [CatsService],
  exports: [CatsService],
})
export class CatsModule {}
```

> **팁:** forRoot vs forFeature
> - `TypeOrmModule.forRoot()`: AppModule에서 **한 번만** 호출. DB 연결 설정.
> - `TypeOrmModule.forFeature([Entity])`: 각 Feature 모듈에서 호출. 해당 모듈에서 사용할 Entity의 Repository를 등록.

### 서비스에서 Repository 주입 - [@InjectRepository()](references/decorators.md#injectrepositoryentity)

```typescript
// src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cat } from './entities/cat.entity';

@Injectable()
export class CatsService {
  constructor(
    @InjectRepository(Cat)                     // Cat Entity의 Repository를 주입
    private readonly catsRepository: Repository<Cat>,  // 타입은 Repository<Entity>
  ) {}

  async findAll(): Promise<Cat[]> {
    return this.catsRepository.find();  // SELECT * FROM cats
  }

  async findOne(id: number): Promise<Cat> {
    const cat = await this.catsRepository.findOne({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Cat #${id}을 찾을 수 없습니다`);
    }
    return cat;
  }
}
```

### 주요 Repository 메서드

| 메서드 | 설명 | SQL 대응 |
|---|---|---|
| `create(dto)` | Entity 인스턴스 생성 (DB 저장 X) | - |
| `save(entity)` | DB에 저장 (INSERT 또는 UPDATE) | INSERT / UPDATE |
| `find(options?)` | 조건에 맞는 전체 조회 | SELECT |
| `findOne(options)` | 1건 조회 | SELECT ... LIMIT 1 |
| `findAndCount(options)` | 조회 + 총 개수 (페이지네이션용) | SELECT + COUNT |
| `update(id, dto)` | 업데이트 (Entity 훅 미실행) | UPDATE |
| `remove(entity)` | 삭제 | DELETE |
| `softDelete(id)` | 소프트 삭제 (deletedAt 기록) | UPDATE |
| `count(options?)` | 레코드 수 반환 | COUNT |

> **팁:** create() vs save()
> `create()`는 Entity 객체를 **메모리에만** 만든다. 실제 DB에 저장하려면 반드시 `save()`를 호출해야 한다. 2단계로 나누는 이유는 저장 전에 추가 로직(비밀번호 해싱 등)을 넣을 수 있기 때문이다.

---

## 5. 관계 설정

관계형 데이터베이스의 핵심인 **테이블 간 관계**를 TypeORM 데코레이터로 표현한다.

### OneToOne (1:1 관계)

한 명의 User가 하나의 Profile을 가지는 관계.

```typescript
// src/profiles/entities/profile.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', nullable: true })
  bio: string;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn()  // FK(외래키)를 소유하는 쪽에 붙인다
  user: User;
}
```

```typescript
// src/users/entities/user.entity.ts
@Entity('users')
export class User {
  // ... 기존 컬럼들

  @OneToOne(() => Profile, (profile) => profile.user)
  profile: Profile;
}
```

### OneToMany / ManyToOne (1:N 관계) - 가장 많이 사용

하나의 User가 여러 Post를 작성하는 관계. **"1쪽에 OneToMany, N쪽에 ManyToOne"** 을 붙인다.

```
┌─────────┐         ┌─────────┐
│  User   │ 1 ──── N│  Post   │
│─────────│         │─────────│
│  id     │         │  id     │
│  name   │         │  title  │
│         │         │  authorId│ ← FK (자동 생성됨)
└─────────┘         └─────────┘
```

```typescript
// src/posts/entities/post.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  // N쪽에 ManyToOne (Post가 N, User가 1)
  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  author: User;
}
```

```typescript
// src/users/entities/user.entity.ts
import { OneToMany } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

@Entity('users')
export class User {
  // ... 기존 컬럼들

  // 1쪽에 OneToMany
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];
}
```

> **팁:** @JoinColumn은 ManyToOne에 안 붙여도 된다
> [`@ManyToOne()`](references/decorators.md#관계-데코레이터)은 자동으로 FK 컬럼(예: `authorId`)을 생성한다. [`@JoinColumn()`](references/decorators.md#joincolumn-jointable)은 OneToOne 관계에서만 필수이고, ManyToOne에서는 생략해도 된다.

### ManyToMany (N:M 관계)

Post에 여러 Tag가 붙고, Tag는 여러 Post에 사용되는 관계.

```typescript
// src/tags/entities/tag.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import { Post } from '../../posts/entities/post.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  name: string;

  @ManyToMany(() => Post, (post) => post.tags)
  posts: Post[];
}
```

```typescript
// src/posts/entities/post.entity.ts (관계 추가)
import { ManyToMany, JoinTable } from 'typeorm';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('posts')
export class Post {
  // ... 기존 컬럼들

  @ManyToMany(() => Tag, (tag) => tag.posts)
  @JoinTable()  // 중간 테이블(posts_tags)을 소유하는 쪽에 붙인다
  tags: Tag[];
}
```

### 관계 데이터 조회하기

관계 데이터는 기본적으로 **자동 로드되지 않는다**. 명시적으로 요청해야 한다.

```typescript
// 방법 1: find()에서 relations 옵션 사용
const users = await this.usersRepository.find({
  relations: ['posts'],           // User의 posts도 함께 조회
});

// 방법 2: 중첩 관계 조회
const users = await this.usersRepository.find({
  relations: ['posts', 'posts.comments'],  // Post의 comments까지 조회
});

// 방법 3: QueryBuilder 사용 (복잡한 조건)
const users = await this.usersRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .where('user.id = :id', { id: 1 })
  .getMany();
```

### 관계 데코레이터 주요 옵션

```typescript
@ManyToOne(() => User, (user) => user.posts, {
  onDelete: 'CASCADE',    // 부모 삭제 시 자식도 삭제
  nullable: false,         // FK NOT NULL
  eager: false,            // true면 find()할 때 항상 함께 로드
  cascade: true,           // save() 시 관계 Entity도 함께 저장
})
```

---

## 6. 마이그레이션 기초

마이그레이션(Migration)은 **데이터베이스 스키마 변경을 코드로 관리**하는 방법이다. Git이 코드의 변경 이력을 관리하듯, 마이그레이션은 DB 구조의 변경 이력을 관리한다.

### 왜 마이그레이션이 필요한가?

```
[ synchronize: true의 문제 ]

1. Entity에서 컬럼명 변경: name → fullName
2. TypeORM이 하는 일: name 컬럼 삭제 → fullName 컬럼 생성
3. 결과: name 컬럼에 있던 데이터가 전부 사라짐! 💥

[ 마이그레이션 사용 시 ]

1. 마이그레이션 파일 작성: ALTER TABLE users RENAME COLUMN name TO fullName
2. 결과: 컬럼명만 바뀌고 데이터는 보존됨 ✅
```

### TypeORM CLI 설정

```typescript
// typeorm.config.ts (프로젝트 루트)
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'better-sqlite3',
  database: 'database.sqlite',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
```

```json
// package.json (scripts 추가)
{
  "scripts": {
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js -d typeorm.config.ts",
    "migration:generate": "npm run typeorm -- migration:generate src/migrations/$npm_config_name",
    "migration:create": "npm run typeorm -- migration:create src/migrations/$npm_config_name",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

### 마이그레이션 사용 흐름

```bash
# 1. Entity 변경 사항을 기반으로 마이그레이션 자동 생성
npm run migration:generate --name=CreateUsersTable

# 2. 마이그레이션 실행 (테이블 생성/변경)
npm run migration:run

# 3. 문제가 있으면 마지막 마이그레이션 되돌리기
npm run migration:revert
```

### 마이그레이션 파일 예시

```typescript
// src/migrations/1700000000000-CreateUsersTable.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateUsersTable1700000000000 implements MigrationInterface {
  // up(): 마이그레이션 실행 시 수행할 작업
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'email', type: 'varchar', isUnique: true },
          { name: 'name', type: 'varchar' },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );
  }

  // down(): 마이그레이션 되돌리기 시 수행할 작업
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

> **팁:** 학습 단계에서는 synchronize로 충분하다
> 마이그레이션은 프로덕션에 배포할 때 중요하다. 학습 중에는 `synchronize: true`를 사용하고, 프로젝트가 어느 정도 완성되면 마이그레이션으로 전환하는 것을 추천한다.

---

## 7. 트랜잭션

트랜잭션(Transaction)은 **여러 DB 작업을 하나의 단위로 묶어**, 모두 성공하거나 모두 실패하도록 보장하는 메커니즘이다.

### 트랜잭션이 필요한 상황

```
[ 계좌 이체 예시 ]

1. A 계좌에서 10,000원 차감  ← 성공
2. B 계좌에 10,000원 입금    ← 실패! (네트워크 오류)

트랜잭션이 없으면: A에서 돈은 빠졌는데 B에는 안 들어감 💥
트랜잭션이 있으면: 2번이 실패하면 1번도 되돌림 (롤백) ✅
```

### 방법 1: QueryRunner 사용 (세밀한 제어)

```typescript
// src/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from './entities/user.entity';
import { Post } from '../posts/entities/post.entity';

@Injectable()
export class UsersService {
  constructor(private readonly dataSource: DataSource) {}

  async createUserWithFirstPost(userData: Partial<User>): Promise<User> {
    // 1. QueryRunner 생성 및 연결
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 2. 트랜잭션 안에서 여러 작업 수행
      const user = queryRunner.manager.create(User, userData);
      const savedUser = await queryRunner.manager.save(user);

      const post = queryRunner.manager.create(Post, {
        title: '첫 번째 글',
        content: '환영합니다!',
        author: savedUser,
      });
      await queryRunner.manager.save(post);

      // 3. 모두 성공하면 커밋
      await queryRunner.commitTransaction();
      return savedUser;
    } catch (error) {
      // 4. 하나라도 실패하면 롤백
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // 5. 반드시 QueryRunner 해제
      await queryRunner.release();
    }
  }
}
```

### 방법 2: transaction() 메서드 (간결한 방식)

```typescript
// src/users/users.service.ts
async createUserWithFirstPost(userData: Partial<User>): Promise<User> {
  return this.dataSource.transaction(async (manager) => {
    // manager를 통해 작업하면 자동으로 트랜잭션 안에서 실행됨
    const user = manager.create(User, userData);
    const savedUser = await manager.save(user);

    const post = manager.create(Post, {
      title: '첫 번째 글',
      content: '환영합니다!',
      author: savedUser,
    });
    await manager.save(post);

    return savedUser;
    // 함수가 정상 종료되면 자동 커밋, 에러가 발생하면 자동 롤백
  });
}
```

> **팁:** 어떤 방법을 쓸까?
> 대부분의 경우 방법 2(`transaction()` 메서드)가 간결하고 안전하다. 방법 1(QueryRunner)은 트랜잭션 격리 수준을 지정하거나, 트랜잭션 중간에 조건 분기가 복잡할 때 사용한다.

---

# 2단계: 기본 예제

---

## 8. SQLite 설정 (가장 간단한 DB)

실제로 코드를 작성하며 TypeORM을 체험해보자. 가장 간단한 SQLite로 시작한다.

### 패키지 설치

```bash
npm install @nestjs/typeorm typeorm better-sqlite3
```

### AppModule 설정

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatsModule } from './cats/cats.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'database.sqlite',     // 프로젝트 루트에 파일 생성됨
      autoLoadEntities: true,           // forFeature()로 등록한 Entity 자동 로드
      synchronize: true,                // 개발용: Entity 변경 시 테이블 자동 동기화
    }),
    CatsModule,
  ],
})
export class AppModule {}
```

> **팁:** autoLoadEntities
> `entities: [__dirname + '/**/*.entity{.ts,.js}']` 대신 `autoLoadEntities: true`를 사용하면, `TypeOrmModule.forFeature()`로 등록한 Entity를 자동으로 인식한다. NestJS 공식 문서에서도 이 방식을 권장한다.

서버를 시작하면 프로젝트 루트에 `database.sqlite` 파일이 생긴다. 이 파일 하나가 데이터베이스다.

---

## 9. Cat Entity + CRUD Repository 예제

가장 기본적인 Entity 하나로 CRUD를 만들어보자.

### 디렉토리 구조

```
src/
├── app.module.ts
└── cats/
    ├── cats.module.ts
    ├── cats.controller.ts
    ├── cats.service.ts
    ├── dto/
    │   ├── create-cat.dto.ts
    │   └── update-cat.dto.ts
    └── entities/
        └── cat.entity.ts
```

### Entity 정의

```typescript
// src/cats/entities/cat.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('cats')
export class Cat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  breed: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

### DTO 정의

```typescript
// src/cats/dto/create-cat.dto.ts
import { IsString, IsInt, IsOptional, Min, Max } from 'class-validator';

export class CreateCatDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  @Max(30)
  age: number;

  @IsString()
  @IsOptional()
  breed?: string;
}
```

```typescript
// src/cats/dto/update-cat.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCatDto } from './create-cat.dto';

export class UpdateCatDto extends PartialType(CreateCatDto) {}
```

### Service - Repository를 이용한 CRUD

```typescript
// src/cats/cats.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cat } from './entities/cat.entity';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';

@Injectable()
export class CatsService {
  constructor(
    @InjectRepository(Cat)
    private readonly catsRepository: Repository<Cat>,
  ) {}

  // CREATE - 새 고양이 등록
  async create(createCatDto: CreateCatDto): Promise<Cat> {
    const cat = this.catsRepository.create(createCatDto); // 메모리에 Entity 생성
    return this.catsRepository.save(cat);                  // DB에 INSERT
  }

  // READ - 전체 조회
  async findAll(): Promise<Cat[]> {
    return this.catsRepository.find({
      order: { createdAt: 'DESC' },  // 최신순 정렬
    });
  }

  // READ - 단건 조회
  async findOne(id: number): Promise<Cat> {
    const cat = await this.catsRepository.findOne({ where: { id } });
    if (!cat) {
      throw new NotFoundException(`Cat #${id}을 찾을 수 없습니다`);
    }
    return cat;
  }

  // UPDATE
  async update(id: number, updateCatDto: UpdateCatDto): Promise<Cat> {
    const cat = await this.findOne(id);             // 존재 여부 확인
    const updated = Object.assign(cat, updateCatDto); // DTO 값 병합
    return this.catsRepository.save(updated);        // DB에 UPDATE
  }

  // DELETE
  async remove(id: number): Promise<void> {
    const cat = await this.findOne(id);  // 존재 여부 확인
    await this.catsRepository.remove(cat);
  }
}
```

### Controller

```typescript
// src/cats/cats.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CatsService } from './cats.service';
import { CreateCatDto } from './dto/create-cat.dto';
import { UpdateCatDto } from './dto/update-cat.dto';

@Controller('cats')
export class CatsController {
  constructor(private readonly catsService: CatsService) {}

  @Post()
  create(@Body() createCatDto: CreateCatDto) {
    return this.catsService.create(createCatDto);
  }

  @Get()
  findAll() {
    return this.catsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCatDto: UpdateCatDto,
  ) {
    return this.catsService.update(id, updateCatDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catsService.remove(id);
  }
}
```

### Module

```typescript
// src/cats/cats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cat } from './entities/cat.entity';
import { CatsService } from './cats.service';
import { CatsController } from './cats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cat])],  // Cat Repository 등록
  controllers: [CatsController],
  providers: [CatsService],
})
export class CatsModule {}
```

### 테스트해보기

```bash
# 서버 실행
npm run start:dev

# 고양이 생성
curl -X POST http://localhost:3000/cats \
  -H "Content-Type: application/json" \
  -d '{"name": "나비", "age": 3, "breed": "코리안숏헤어"}'

# 전체 조회
curl http://localhost:3000/cats

# 서버를 재시작해도 데이터가 유지된다! 🎉
```

> **팁:** 이전과의 차이
> 챕터 3에서 만든 Service는 `private cats: Cat[] = []` 배열에 데이터를 저장했다. 서버가 꺼지면 데이터가 사라졌다. 이제 Repository를 통해 SQLite 파일에 저장하므로 서버를 재시작해도 데이터가 유지된다.

---

## 10. OneToMany 관계 예제

관계가 있는 Entity를 만들어보자. "주인(Owner)이 여러 고양이(Cat)를 키우는" 1:N 관계를 구현한다.

### Owner Entity 추가

```typescript
// src/owners/entities/owner.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Cat } from '../../cats/entities/cat.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  phone: string;

  // 1:N 관계 - Owner 한 명이 여러 Cat을 소유
  @OneToMany(() => Cat, (cat) => cat.owner)
  cats: Cat[];

  @CreateDateColumn()
  createdAt: Date;
}
```

### Cat Entity에 관계 추가

```typescript
// src/cats/entities/cat.entity.ts (수정)
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Owner } from '../../owners/entities/owner.entity';

@Entity('cats')
export class Cat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'int' })
  age: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  breed: string;

  // N:1 관계 - Cat은 하나의 Owner에 속함
  @ManyToOne(() => Owner, (owner) => owner.cats, {
    nullable: true,        // 주인이 없는 고양이도 허용
    onDelete: 'SET NULL',  // 주인 삭제 시 NULL로 설정
  })
  owner: Owner;

  @CreateDateColumn()
  createdAt: Date;
}
```

### 관계 데이터 저장과 조회

```typescript
// src/owners/owners.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Owner } from './entities/owner.entity';

@Injectable()
export class OwnersService {
  constructor(
    @InjectRepository(Owner)
    private readonly ownersRepository: Repository<Owner>,
  ) {}

  // Owner 조회 시 소유한 cats도 함께 로드
  async findOneWithCats(id: number): Promise<Owner> {
    const owner = await this.ownersRepository.findOne({
      where: { id },
      relations: ['cats'],  // cats 관계 데이터도 함께 조회
    });

    if (!owner) {
      throw new NotFoundException(`Owner #${id}을 찾을 수 없습니다`);
    }

    return owner;
    // 결과 예시:
    // {
    //   id: 1,
    //   name: "김철수",
    //   phone: "010-1234-5678",
    //   cats: [
    //     { id: 1, name: "나비", age: 3, breed: "코리안숏헤어" },
    //     { id: 2, name: "치즈", age: 1, breed: "먼치킨" },
    //   ]
    // }
  }
}
```

```typescript
// src/cats/cats.service.ts (관계 저장 예시)
async createWithOwner(createCatDto: CreateCatDto, ownerId: number): Promise<Cat> {
  const owner = await this.ownersRepository.findOne({ where: { id: ownerId } });
  if (!owner) {
    throw new NotFoundException(`Owner #${ownerId}을 찾을 수 없습니다`);
  }

  const cat = this.catsRepository.create({
    ...createCatDto,
    owner,  // 관계 설정: 이 고양이의 주인
  });

  return this.catsRepository.save(cat);
}
```

---

# 3단계: 블로그 API 적용

이제 2단계에서 배운 내용을 토대로, 기존 블로그 API를 **실제 데이터베이스 기반**으로 전환한다.

---

## 11. 블로그 DB 설계와 Entity 작성

### 패키지 설치

```bash
npm install @nestjs/typeorm typeorm better-sqlite3
```

### Entity 관계도

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    User      │       │    Post      │       │   Comment    │
│──────────────│       │──────────────│       │──────────────│
│ id           │       │ id           │       │ id           │
│ email        │ 1───N │ title        │ 1───N │ content      │
│ password     │       │ content      │       │ createdAt    │
│ name         │       │ createdAt    │       │              │
│ role         │       │ updatedAt    │       │              │
│ createdAt    │       │              │       │              │
│              │ 1───N │              │       │              │
│              │───────│──────────────│───────│──────────────│
│              │       │ author (FK)  │       │ author (FK)  │
│              │       │              │       │ post (FK)    │
└──────────────┘       └──────────────┘       └──────────────┘

관계 요약:
- User 1 : N Post     (한 유저가 여러 글 작성)
- User 1 : N Comment  (한 유저가 여러 댓글 작성)
- Post 1 : N Comment  (한 글에 여러 댓글 달림)
```

### User Entity

```typescript
// src/users/entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Post } from '../../posts/entities/post.entity';
import { Comment } from '../../comments/entities/comment.entity';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, select: false })
  // select: false → find()로 조회할 때 비밀번호 자동 제외
  password: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  @CreateDateColumn()
  createdAt: Date;

  // 관계: User 1 : N Post
  @OneToMany(() => Post, (post) => post.author)
  posts: Post[];

  // 관계: User 1 : N Comment
  @OneToMany(() => Comment, (comment) => comment.author)
  comments: Comment[];
}
```

### Post Entity

```typescript
// src/posts/entities/post.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from '../../comments/entities/comment.entity';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // 관계: Post N : 1 User (글의 작성자)
  @ManyToOne(() => User, (user) => user.posts, {
    nullable: false,
    onDelete: 'CASCADE',  // 유저 삭제 시 해당 유저의 글도 삭제
  })
  author: User;

  // 관계: Post 1 : N Comment
  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];
}
```

### Comment Entity

```typescript
// src/comments/entities/comment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Post } from '../../posts/entities/post.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text' })
  content: string;

  @CreateDateColumn()
  createdAt: Date;

  // 관계: Comment N : 1 User (댓글 작성자)
  @ManyToOne(() => User, (user) => user.comments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  author: User;

  // 관계: Comment N : 1 Post (댓글이 달린 글)
  @ManyToOne(() => Post, (post) => post.comments, {
    nullable: false,
    onDelete: 'CASCADE',  // 글 삭제 시 해당 글의 댓글도 삭제
  })
  post: Post;
}
```

### AppModule에 TypeORM 설정

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'database.sqlite',
      autoLoadEntities: true,    // forFeature()로 등록한 Entity 자동 로드
      synchronize: true,         // 개발용 - Entity 변경 시 테이블 자동 동기화
    }),
    UsersModule,
    PostsModule,
    CommentsModule,
  ],
})
export class AppModule {}
```

### DTO 정의

```typescript
// src/users/dto/create-user.dto.ts
import { IsString, IsEmail, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
```

```typescript
// src/users/dto/update-user.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';

// password를 제외한 필드만 업데이트 가능
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {}
```

```typescript
// src/posts/dto/create-post.dto.ts
import { IsString, IsNumber, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  content: string;

  @IsNumber()
  authorId: number;  // 작성자 ID
}
```

```typescript
// src/posts/dto/update-post.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreatePostDto } from './create-post.dto';

// authorId를 제외한 필드만 업데이트 가능 (작성자는 변경 불가)
export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['authorId'] as const),
) {}
```

```typescript
// src/comments/dto/create-comment.dto.ts
import { IsString, IsNumber } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  content: string;

  @IsNumber()
  authorId: number;  // 댓글 작성자 ID

  @IsNumber()
  postId: number;    // 댓글이 달릴 글 ID
}
```

```typescript
// src/comments/dto/update-comment.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateCommentDto } from './create-comment.dto';

export class UpdateCommentDto extends PartialType(
  OmitType(CreateCommentDto, ['authorId', 'postId'] as const),
) {}
```

---

## 12. 메모리 배열에서 Repository로 리팩토링

기존에 `private users: User[] = []` 같은 메모리 배열로 데이터를 관리하던 Service를 Repository 기반으로 전환한다.

### 리팩토링 전후 비교

```typescript
// ❌ Before: 메모리 배열 기반 (서버 재시작 시 데이터 소멸)
@Injectable()
export class PostsService {
  private posts: Post[] = [];
  private idCounter = 1;

  create(dto: CreatePostDto) {
    const post = { id: this.idCounter++, ...dto };
    this.posts.push(post);
    return post;
  }

  findAll() {
    return this.posts;
  }
}

// ✅ After: Repository 기반 (DB에 영구 저장)
@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(dto: CreatePostDto) {
    const post = this.postsRepository.create(dto);
    return this.postsRepository.save(post);
  }

  async findAll() {
    return this.postsRepository.find();
  }
}
```

> **팁:** 리팩토링 핵심 변화 3가지
> 1. `private 배열` 삭제 → [`@InjectRepository()`](references/decorators.md#injectrepositoryentity)로 Repository 주입
> 2. `idCounter` 삭제 → [`@PrimaryGeneratedColumn()`](references/decorators.md#컬럼-데코레이터)이 ID 자동 생성
> 3. 모든 메서드가 `async`가 됨 → DB 작업은 비동기(I/O)이므로

### UsersService (전체)

```typescript
// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // 이메일 중복 체크
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) {
      throw new ConflictException('이미 사용 중인 이메일입니다');
    }

    const user = this.usersRepository.create(createUserDto);
    return this.usersRepository.save(user);
  }

  async findAll(page = 1, limit = 10): Promise<{ data: User[]; total: number }> {
    const [data, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,   // 건너뛸 개수
      take: limit,                 // 가져올 개수
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: ['posts'],  // 작성한 글 목록도 함께 조회
    });
    if (!user) {
      throw new NotFoundException(`User #${id}을 찾을 수 없습니다`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    const updated = Object.assign(user, updateUserDto);
    return this.usersRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const result = await this.usersRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`User #${id}을 찾을 수 없습니다`);
    }
  }
}
```

### UsersController

```typescript
// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.usersService.findAll(page, limit);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
```

### UsersModule

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],  // 다른 모듈에서 UsersService 사용 가능
})
export class UsersModule {}
```

### PostsService (전체)

```typescript
// src/posts/posts.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './entities/post.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async create(createPostDto: CreatePostDto): Promise<Post> {
    const { authorId, ...postData } = createPostDto;

    // 작성자 존재 여부 확인
    const author = await this.usersRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException(`User #${authorId}을 찾을 수 없습니다`);
    }

    const post = this.postsRepository.create({
      ...postData,
      author,  // 관계 설정
    });

    return this.postsRepository.save(post);
  }

  async findAll(page = 1, limit = 10): Promise<{ data: Post[]; total: number }> {
    const [data, total] = await this.postsRepository.findAndCount({
      relations: ['author'],            // 작성자 정보 함께 조회
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    return { data, total };
  }

  async findOne(id: number): Promise<Post> {
    const post = await this.postsRepository.findOne({
      where: { id },
      relations: ['author', 'comments', 'comments.author'],
      // 글 + 작성자 + 댓글 + 댓글 작성자까지 한 번에 조회
    });
    if (!post) {
      throw new NotFoundException(`Post #${id}을 찾을 수 없습니다`);
    }
    return post;
  }

  async update(id: number, updatePostDto: UpdatePostDto): Promise<Post> {
    const post = await this.findOne(id);
    const updated = Object.assign(post, updatePostDto);
    return this.postsRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const result = await this.postsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Post #${id}을 찾을 수 없습니다`);
    }
  }

  // 특정 유저의 글 목록 조회
  async findByAuthor(authorId: number): Promise<Post[]> {
    return this.postsRepository.find({
      where: { author: { id: authorId } },
      order: { createdAt: 'DESC' },
    });
  }

  // 키워드 검색 (QueryBuilder 활용)
  async search(keyword: string): Promise<Post[]> {
    return this.postsRepository
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.title LIKE :keyword', { keyword: `%${keyword}%` })
      .orWhere('post.content LIKE :keyword', { keyword: `%${keyword}%` })
      .orderBy('post.createdAt', 'DESC')
      .getMany();
  }
}
```

> **팁:** LIKE vs ILIKE
> SQLite는 `ILIKE`(대소문자 무시 검색)를 지원하지 않는다. `LIKE`를 사용하면 된다. 참고로 SQLite의 `LIKE`는 영문 ASCII 기본값이 대소문자를 무시한다. PostgreSQL에서는 `ILIKE`를 사용할 수 있다.

### PostsController

```typescript
// src/posts/posts.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }

  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.postsService.findAll(page, limit);
  }

  @Get('search')
  search(@Query('keyword') keyword: string) {
    return this.postsService.search(keyword);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Get('author/:authorId')
  findByAuthor(@Param('authorId', ParseIntPipe) authorId: number) {
    return this.postsService.findByAuthor(authorId);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    return this.postsService.update(id, updatePostDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.remove(id);
  }
}
```

### PostsModule

```typescript
// src/posts/posts.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from './entities/post.entity';
import { User } from '../users/entities/user.entity';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, User]),
    // Post와 User 두 개의 Repository가 필요 (글 생성 시 작성자 확인)
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
```

### CommentsService (전체)

```typescript
// src/comments/comments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  async create(createCommentDto: CreateCommentDto): Promise<Comment> {
    const { authorId, postId, ...commentData } = createCommentDto;

    // 작성자 존재 확인
    const author = await this.usersRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException(`User #${authorId}을 찾을 수 없습니다`);
    }

    // 글 존재 확인
    const post = await this.postsRepository.findOne({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException(`Post #${postId}을 찾을 수 없습니다`);
    }

    const comment = this.commentsRepository.create({
      ...commentData,
      author,
      post,
    });

    return this.commentsRepository.save(comment);
  }

  // 특정 글의 댓글 목록 조회
  async findByPost(postId: number): Promise<Comment[]> {
    return this.commentsRepository.find({
      where: { post: { id: postId } },
      relations: ['author'],  // 댓글 작성자 정보 포함
      order: { createdAt: 'ASC' },  // 오래된 순 (댓글은 시간순이 자연스러움)
    });
  }

  async findOne(id: number): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: ['author', 'post'],
    });
    if (!comment) {
      throw new NotFoundException(`Comment #${id}을 찾을 수 없습니다`);
    }
    return comment;
  }

  async update(id: number, updateCommentDto: UpdateCommentDto): Promise<Comment> {
    const comment = await this.findOne(id);
    const updated = Object.assign(comment, updateCommentDto);
    return this.commentsRepository.save(updated);
  }

  async remove(id: number): Promise<void> {
    const result = await this.commentsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Comment #${id}을 찾을 수 없습니다`);
    }
  }
}
```

### CommentsController

```typescript
// src/comments/comments.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Body() createCommentDto: CreateCommentDto) {
    return this.commentsService.create(createCommentDto);
  }

  // 특정 글의 댓글 목록
  @Get('post/:postId')
  findByPost(@Param('postId', ParseIntPipe) postId: number) {
    return this.commentsService.findByPost(postId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, updateCommentDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commentsService.remove(id);
  }
}
```

### CommentsModule

```typescript
// src/comments/comments.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { User } from '../users/entities/user.entity';
import { Post } from '../posts/entities/post.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, User, Post]),
    // 댓글 생성 시 User와 Post 존재 여부를 확인하므로 3개 Entity 모두 등록
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
```

---

## 13. 페이지네이션 구현

데이터가 많아지면 한 번에 전부 가져오는 것은 비효율적이다. **페이지네이션(Pagination)** 으로 필요한 만큼만 조회한다.

### TypeORM의 skip과 take

| 옵션 | 설명 | SQL 대응 |
|---|---|---|
| `skip` | 건너뛸 레코드 수 | `OFFSET` |
| `take` | 가져올 레코드 수 | `LIMIT` |

```
예: page=2, limit=10
skip = (2 - 1) * 10 = 10   → 처음 10개를 건너뜀
take = 10                    → 11번째~20번째 레코드를 가져옴
```

### 페이지네이션 응답 형태

```typescript
// src/posts/posts.service.ts
async findAll(page = 1, limit = 10) {
  const [data, total] = await this.postsRepository.findAndCount({
    relations: ['author'],
    skip: (page - 1) * limit,          // 건너뛸 개수: (페이지-1) × 페이지크기
    take: limit,                        // 가져올 개수
    order: { createdAt: 'DESC' },       // 최신순 정렬 (오래된 순은 'ASC')
  });

  return {
    data,                              // 현재 페이지 데이터
    total,                             // 전체 레코드 수
    page,                              // 현재 페이지
    limit,                             // 페이지당 개수
    totalPages: Math.ceil(total / limit), // 전체 페이지 수
  };
}
```

### 사용 예시

```bash
# 1페이지 (기본값: 10개)
GET /posts

# 2페이지, 5개씩
GET /posts?page=2&limit=5

# 응답 예시
{
  "data": [
    { "id": 6, "title": "여섯 번째 글", "author": { "id": 1, "name": "홍길동" } },
    { "id": 7, "title": "일곱 번째 글", "author": { "id": 2, "name": "김영희" } },
    ...
  ],
  "total": 23,
  "page": 2,
  "limit": 5,
  "totalPages": 5
}
```

### 컨트롤러에서 페이지네이션 파라미터 받기

```typescript
// src/posts/posts.controller.ts
@Get()
findAll(
  @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
) {
  return this.postsService.findAll(page, limit);
}
```

> **팁:** DefaultValuePipe
> `new DefaultValuePipe(1)`은 query 파라미터가 없을 때 기본값을 제공한다. `/posts`로 요청하면 `page=1, limit=10`이 자동 적용된다. 챕터 5(Pipe)에서 배운 내용의 실전 활용이다.

### 전체 흐름 테스트

```bash
# 1. 유저 생성
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email": "hong@test.com", "password": "12345678", "name": "홍길동"}'
# 응답: { "id": 1, "email": "hong@test.com", "name": "홍길동", ... }

# 2. 글 작성
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title": "첫 번째 글", "content": "안녕하세요!", "authorId": 1}'
# 응답: { "id": 1, "title": "첫 번째 글", ... }

# 3. 댓글 작성
curl -X POST http://localhost:3000/comments \
  -H "Content-Type: application/json" \
  -d '{"content": "좋은 글이네요!", "authorId": 1, "postId": 1}'

# 4. 글 상세 조회 (작성자 + 댓글 + 댓글 작성자 모두 포함)
curl http://localhost:3000/posts/1
# 응답:
# {
#   "id": 1,
#   "title": "첫 번째 글",
#   "content": "안녕하세요!",
#   "author": { "id": 1, "name": "홍길동", "email": "hong@test.com" },
#   "comments": [
#     {
#       "id": 1,
#       "content": "좋은 글이네요!",
#       "author": { "id": 1, "name": "홍길동" }
#     }
#   ]
# }

# 5. 서버를 재시작해도 모든 데이터가 유지된다!
```

---

## 14. PostgreSQL/MySQL 전환 방법

학습과 개발 초기에는 SQLite로 빠르게 시작하고, 운영 환경(프로덕션)에서는 PostgreSQL이나 MySQL을 사용하는 전략이 일반적이다. TypeORM의 큰 장점 중 하나는 **Entity 코드를 변경하지 않고 설정만 바꿔서 DB를 전환**할 수 있다는 것이다.

### 패키지 차이

| 구분 | SQLite | PostgreSQL | MySQL |
|------|--------|------------|-------|
| **드라이버 패키지** | `better-sqlite3` | `pg` | `mysql2` |
| **TypeORM type 값** | `'better-sqlite3'` | `'postgres'` | `'mysql'` |
| **별도 DB 서버** | 불필요 (파일 기반) | 필요 | 필요 |
| **운영 환경 적합성** | 낮음 | 매우 높음 | 높음 |

```bash
# SQLite → PostgreSQL로 전환 시 패키지 교체
npm uninstall better-sqlite3
npm install pg
```

### SQLite 설정 vs PostgreSQL 설정 비교

```typescript
// ❌ SQLite 설정 (개발용)
TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: 'database.sqlite',   // 파일 경로
  autoLoadEntities: true,
  synchronize: true,
})

// ✅ PostgreSQL 설정 (운영용)
TypeOrmModule.forRoot({
  type: 'postgres',
  host: 'localhost',             // DB 서버 호스트
  port: 5432,                    // PostgreSQL 기본 포트
  username: 'postgres',          // DB 사용자명
  password: 'password',          // DB 비밀번호
  database: 'blog_db',           // DB 이름
  autoLoadEntities: true,
  synchronize: false,            // 운영에서는 반드시 false + 마이그레이션 사용
})
```

### 환경 변수로 개발/운영 분리 (권장 패턴)

```typescript
// src/app.module.ts
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const isProduction = config.get('NODE_ENV') === 'production';

    if (isProduction) {
      // 운영: PostgreSQL
      return {
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
      };
    } else {
      // 개발: SQLite
      return {
        type: 'better-sqlite3',
        database: 'database.sqlite',
        autoLoadEntities: true,
        synchronize: true,
      };
    }
  },
}),
```

### 주요 차이점

TypeORM이 대부분의 차이를 추상화해주지만, 몇 가지는 직접 대응해야 한다.

| 항목 | SQLite | PostgreSQL / MySQL |
|------|--------|--------------------|
| **대소문자 무시 검색** | `LIKE` (ASCII는 기본 무시) | PostgreSQL: `ILIKE` / MySQL: `LIKE` |
| **Enum 컬럼 타입** | `'varchar'`로 대체 | `'enum'` 직접 사용 가능 |
| **JSON 컬럼** | `'simple-json'` (문자열 직렬화) | `'jsonb'` (PostgreSQL), `'json'` (MySQL) |
| **Boolean 저장 방식** | `0` / `1` (정수) | `true` / `false` |
| **동시 접속 수** | 사실상 1개 (파일 잠금) | 다수 동시 접속 지원 |

#### LIKE vs ILIKE 코드 예시

```typescript
// SQLite / MySQL: LIKE (대소문자 무시 여부는 DB·설정에 따라 다름)
.where('post.title LIKE :keyword', { keyword: `%${keyword}%` })

// PostgreSQL: ILIKE (대소문자를 항상 무시)
.where('post.title ILIKE :keyword', { keyword: `%${keyword}%` })
```

> **팁:** 환경별 검색 쿼리 분기
> 운영(PostgreSQL)과 개발(SQLite) 모두를 지원해야 한다면, `process.env.NODE_ENV`에 따라 `LIKE`/`ILIKE`를 분기하거나, 처음부터 PostgreSQL에서도 `LIKE`만 사용하고 대소문자 처리는 애플리케이션 레이어에서 담당하는 방식을 택할 수 있다.

### "개발은 SQLite, 운영은 PostgreSQL" 전략

```
[ 권장 워크플로우 ]

개발 단계
  └─ SQLite 사용
       ├─ 별도 DB 서버 설치 불필요
       ├─ synchronize: true → Entity 변경이 즉시 반영
       └─ 빠른 피드백 사이클

스테이징 / 운영 단계
  └─ PostgreSQL 사용
       ├─ 실제 서비스와 동일한 환경
       ├─ synchronize: false + 마이그레이션
       └─ 동시 접속, 트랜잭션 격리 등 안정성 확보
```

> **주의:** SQLite와 PostgreSQL 동작 차이 주의
> 개발(SQLite)에서 잘 돌아가도 운영(PostgreSQL)에서 문제가 생길 수 있다. 특히 Enum 타입 컬럼, JSON 컬럼, 대소문자 검색을 사용한다면 스테이징 환경에서 PostgreSQL로 반드시 검증하자.

---

## 15. N+1 문제와 해결법

### N+1 문제란?

N+1 문제는 ORM에서 가장 흔하게 만나는 성능 문제다. **1번의 쿼리로 목록을 가져온 뒤, 각 항목의 관계 데이터를 가져오기 위해 N번의 추가 쿼리가 발생**하는 상황이다.

```
[ 예시: 게시글 10개와 각 댓글을 조회하는 경우 ]

N+1 문제가 있을 때:
  쿼리 1: SELECT * FROM posts LIMIT 10          → 게시글 10개 조회
  쿼리 2: SELECT * FROM comments WHERE postId=1 → 1번 게시글의 댓글
  쿼리 3: SELECT * FROM comments WHERE postId=2 → 2번 게시글의 댓글
  쿼리 4: SELECT * FROM comments WHERE postId=3 → 3번 게시글의 댓글
  ...
  쿼리 11: SELECT * FROM comments WHERE postId=10
  → 총 11번 쿼리 실행! (게시글이 100개면 101번)

N+1 문제를 해결했을 때:
  쿼리 1: SELECT * FROM posts LIMIT 10
  쿼리 2: SELECT * FROM comments WHERE postId IN (1,2,3,...,10)
  → 총 2번 쿼리로 끝!
```

N+1 문제는 데이터가 적을 때는 잘 드러나지 않다가, **데이터가 늘어날수록 응답 시간이 급격히 증가**하는 형태로 나타난다.

### 해결법 1: relations 옵션 사용

`find()` / `findOne()` / `findAndCount()`에 `relations` 옵션을 지정하면 TypeORM이 JOIN 쿼리를 생성해 한 번에 데이터를 가져온다.

```typescript
// N+1 문제가 있는 코드
async findAll(): Promise<Post[]> {
  const posts = await this.postsRepository.find();
  // posts 배열을 순회하며 post.comments에 접근하면 N번 추가 쿼리 발생!
  return posts;
}

// relations 옵션으로 해결
async findAll(): Promise<Post[]> {
  return this.postsRepository.find({
    relations: ['author', 'comments'],  // JOIN으로 한 번에 조회
    order: { createdAt: 'DESC' },
  });
}

// 중첩 관계도 한 번에 (댓글의 작성자까지)
async findOne(id: number): Promise<Post> {
  return this.postsRepository.findOne({
    where: { id },
    relations: ['author', 'comments', 'comments.author'],
  });
}
```

### 해결법 2: QueryBuilder + leftJoinAndSelect

복잡한 조건이 있거나 성능을 더 세밀하게 제어하고 싶을 때는 QueryBuilder를 사용한다.

```typescript
// QueryBuilder로 N+1 해결
async findAllWithComments(): Promise<Post[]> {
  return this.postsRepository
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.author', 'author')        // author JOIN
    .leftJoinAndSelect('post.comments', 'comment')     // comments JOIN
    .leftJoinAndSelect('comment.author', 'commentAuthor') // 댓글 작성자 JOIN
    .orderBy('post.createdAt', 'DESC')
    .addOrderBy('comment.createdAt', 'ASC')            // 댓글은 오래된 순
    .getMany();
}

// 조건 + 페이지네이션 + 관계를 모두 한 번에
async findAndCountWithRelations(page = 1, limit = 10) {
  const [data, total] = await this.postsRepository
    .createQueryBuilder('post')
    .leftJoinAndSelect('post.author', 'author')
    .leftJoinAndSelect('post.comments', 'comment')
    .orderBy('post.createdAt', 'DESC')
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

> **팁:** relations vs leftJoinAndSelect 선택 기준
> 조건이 단순하고 관계 이름만 지정하면 될 때는 `relations` 옵션이 간결하다. WHERE 조건을 JOIN 대상에 걸거나, 정렬·집계가 복잡할 때는 `QueryBuilder`를 사용한다.

### Eager Loading vs Lazy Loading

TypeORM은 관계 데이터를 로드하는 두 가지 방식을 제공한다.

| 구분 | Eager Loading | Lazy Loading |
|------|---------------|--------------|
| **로드 시점** | 항상 자동으로 함께 조회 | 실제로 접근할 때 쿼리 실행 |
| **설정 방법** | `@OneToMany(..., { eager: true })` | 관계 타입을 `Promise<T[]>`로 선언 |
| **추가 설정** | 없음 | `TypeOrmModule.forRoot`에 별도 설정 필요 |
| **쿼리 수** | 적음 (JOIN 사용) | 많아질 수 있음 (N+1 위험) |
| **NestJS 권장** | 상황에 따라 사용 | 비권장 (복잡성 증가) |

```typescript
// Eager Loading - find()만 해도 항상 author가 함께 조회됨
@Entity('posts')
export class Post {
  // ...

  @ManyToOne(() => User, (user) => user.posts, { eager: true })
  author: User;  // find() 시 항상 자동 로드
}

// 사용 예
const posts = await this.postsRepository.find(); // author가 자동 포함됨

// Lazy Loading - 접근 시점에 쿼리 실행 (Promise로 감쌈)
@Entity('posts')
export class Post {
  // ...

  @ManyToOne(() => User, (user) => user.posts)
  author: Promise<User>;  // await post.author 시점에 쿼리 실행
}

// 사용 예
const post = await this.postsRepository.findOne({ where: { id: 1 } });
const author = await post.author; // 이 시점에 SELECT 쿼리 실행
```

> **실무 권장: Eager Loading은 신중하게 사용하자**
> `eager: true`를 남발하면, 간단한 목록 조회에도 불필요한 JOIN이 발생해 오히려 성능이 나빠질 수 있다. 대부분의 경우 **필요할 때만 `relations` 옵션이나 `leftJoinAndSelect`로 명시적으로 로드**하는 방식이 더 예측 가능하고 관리하기 쉽다.

---

## 프로젝트 구조

```
src/
├── app.module.ts                  ← TypeOrmModule 설정 추가
├── common/
├── users/
│   ├── entities/
│   │   └── user.entity.ts         ← [이번 챕터 추가]
│   └── users.service.ts           ← Repository로 리팩토링
├── posts/
│   ├── entities/
│   │   └── post.entity.ts         ← [이번 챕터 추가]
│   └── posts.service.ts           ← Repository로 리팩토링
└── comments/
    ├── entities/
    │   └── comment.entity.ts      ← [이번 챕터 추가]
    └── comments.service.ts        ← Repository로 리팩토링
```

---

## 정리

### 이 챕터에서 배운 것

| 주제 | 핵심 포인트 |
|---|---|
| ORM / TypeORM | SQL 대신 TypeScript 코드로 DB 조작. NestJS 공식 지원 |
| Entity | [`@Entity`](references/decorators.md#entitytablename), [`@Column`](references/decorators.md#columnoptions), [`@PrimaryGeneratedColumn`](references/decorators.md#컬럼-데코레이터)으로 테이블 매핑 |
| Repository | [`@InjectRepository()`](references/decorators.md#injectrepositoryentity)로 주입. `find`, `save`, `remove` 등 기본 메서드 내장 |
| 관계 | [`@OneToMany`](references/decorators.md#관계-데코레이터) / [`@ManyToOne`](references/decorators.md#관계-데코레이터) (1:N), [`@OneToOne`](references/decorators.md#관계-데코레이터) (1:1), [`@ManyToMany`](references/decorators.md#관계-데코레이터) (N:M) |
| 마이그레이션 | 프로덕션에서는 `synchronize: false` + 마이그레이션으로 스키마 관리 |
| 트랜잭션 | `DataSource.transaction()` 또는 `QueryRunner`로 원자적 작업 보장 |
| 페이지네이션 | `findAndCount()` + `skip` / `take` + `order`로 구현 |
| DB 전환 | Entity 코드 변경 없이 설정(`type`, 패키지)만 교체하면 됨 |
| N+1 문제 | `relations` 옵션 또는 `leftJoinAndSelect`로 해결 |

### 블로그 API 현재 상태

```
✅ 챕터 1~9: 모듈, 컨트롤러, 서비스, 미들웨어, 파이프, 가드, 인터셉터, 예외 필터, 커스텀 데코레이터
✅ 챕터 10: TypeORM + SQLite 연동 → 데이터가 실제 DB에 저장됨!
           + PostgreSQL 전환 전략 / N+1 문제 해결 패턴

앞으로:
📋 챕터 11: Configuration (환경 변수 관리)
📋 챕터 12: Authentication (로그인/인증)
```

### 핵심 패턴 한눈에 보기

```
1. Entity 정의         →  @Entity(), @Column(), @PrimaryGeneratedColumn()
2. 모듈에 등록         →  TypeOrmModule.forFeature([Entity])
3. 서비스에서 주입      →  @InjectRepository(Entity) private repo: Repository<Entity>
4. CRUD 구현           →  repo.create(), repo.save(), repo.find(), repo.delete()
5. 관계 조회           →  find({ relations: ['관계명'] })
6. 페이지네이션        →  findAndCount({ skip, take, order: { createdAt: 'DESC' } })
7. N+1 해결            →  relations 옵션 또는 leftJoinAndSelect
8. DB 전환             →  type + 패키지만 교체 (SQLite → PostgreSQL)
```

---

## 다음 챕터 예고

챕터 11에서는 **Configuration**을 학습한다. TypeORM 연결 정보와 같이 코드에 하드코딩된 값들을 `.env` 파일과 `ConfigModule`로 분리한다. 개발/운영 환경별 설정 관리 전략도 배운다.

