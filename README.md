# Mail Gateway

지정된 IP로부터 SMTP를 통해 수신된 메일을 헤더/본문 기반으로 분류하여 담당자에게 전달하거나 내부 로그로 남기는 시스템.

## 빠른 시작 (Quick Start)

```bash
# 로컬 실행 (Node.js + Redis 필요)
npm install
cp .env.example .env
npm run db:migrate
npm run dev              # SMTP 서버 (localhost:2525)
npm run dev:api          # API + 대시보드 (localhost:3000)

# Docker 실행 (Redis 포함 4개 컨테이너)
docker compose up -d    # SMTP :2525 / API+대시보드 :3000
```

## 기술 스택

| 구분 | 기술 | 비고 |
|---|---|---|
| 런타임 | Node.js + TypeScript | strict 모드 |
| SMTP 수신 | smtp-server | Nodemailer 프로젝트 |
| 메일 파싱 | mailparser | RFC 822 호환 |
| 메일 발신 | nodemailer | 전달/포워딩 |
| 비동기 작업 큐 | BullMQ | Redis 기반 작업 큐 |
| 메시지 브로커 | Redis 7 | BullMQ 백엔드, 로컬 또는 Docker |
| API 서버 | Hono | 경량 Web Framework |
| 대시보드 | React 19 + Vite 7 | Tailwind CSS v4 |
| ORM | Prisma 6 | SQLite → PostgreSQL/MySQL 전환 가능 |
| 설정 검증 | Zod | 런타임 환경변수 검증 |
| 로깅 | Pino | 구조화 JSON 로깅 |

## 프로젝트 구조

```
mail-gateway/
├── prisma/
│   ├── schema.prisma              # DB 스키마 정의
│   └── migrations/                # 마이그레이션 히스토리
├── scripts/
│   └── generate-cert.sh           # 자체서명 TLS 인증서 생성
├── src/
│   ├── config/
│   │   ├── shared.ts              # 공통 환경변수 (DB, 로그, Redis 등)
│   │   ├── smtp.ts                # SMTP 전용 환경변수
│   │   ├── api.ts                 # API 전용 환경변수
│   │   ├── index.ts               # SMTP 설정 하위 호환 re-export
│   │   └── logger.ts              # Pino 로거 설정
│   ├── api/
│   │   ├── main.ts                # API 서버 엔트리포인트 (Hono)
│   │   ├── middleware/
│   │   │   └── security.ts        # API Key 인증 + 속도 제한 미들웨어
│   │   └── routes/
│   │       ├── emails.ts          # 이메일 조회 API
│   │       ├── tenants.ts         # 테넌트 CRUD API
│   │       ├── rules.ts           # 룰 CRUD API
│   │       ├── forward-logs.ts    # 전달 로그 조회 API
│   │       └── stats.ts           # 대시보드 통계 API
│   ├── db/
│   │   ├── client.ts              # Prisma 클라이언트 싱글턴
│   │   ├── repository.ts          # 테이블별 CRUD 레포지토리
│   │   └── index.ts               # 배럴 export
│   ├── smtp/
│   │   ├── server.ts              # SMTP 수신 서버 (수신 → DB 저장 → 큐 등록만 수행)
│   │   └── index.ts
│   ├── queue/                         # BullMQ 비동기 처리 계층
│   │   ├── connection.ts          # IORedis 연결 팩토리 (싱글턴)
│   │   ├── email-queue.ts         # BullMQ Queue 프로듀서 (addEmailJob)
│   │   ├── email-processor.ts     # BullMQ Worker 컨슈머 (파싱→분류→전달)
│   │   └── index.ts               # 배럴 export
│   ├── parser/
│   │   └── index.ts               # 메일 파싱 (헤더, 본문, 첨부)
│   ├── keyword/
│   │   └── index.ts               # 키워드 추출 엔진
│   ├── auth/
│   │   └── index.ts               # DKIM/SPF 검증
│   ├── classifier/
│   │   └── index.ts               # 룰 기반 분류 엔진 (멀티 테넌트 지원)
│   ├── retry/
│   │   └── index.ts               # API 수동 재시도 지원 (레거시)
│   ├── storage/
│   │   └── index.ts               # 첨부파일 디스크 저장
│   ├── forwarder/
│   │   └── index.ts               # 메일 전달 + 전달 로그
│   ├── rate-limiter/
│   │   └── index.ts               # IP별 속도 제한
│   ├── types/
│   │   └── index.ts               # 공통 타입 정의
│   ├── cli.ts                     # 룰 + 테넌트 관리 CLI
│   ├── worker.ts                  # 독립 워커 프로세스 엔트리포인트 (pm2용)
│   └── index.ts                   # SMTP 엔트리포인트 (내장 워커 포함)
├── dashboard/                         # React 대시보드 (Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/Layout.tsx  # 사이드바 레이아웃
│   │   ├── pages/                 # 페이지 컴포넌트들
│   │   ├── lib/api.ts             # 타입드 API 클라이언트
│   │   ├── types.ts               # 대시보드 타입 정의
│   │   └── App.tsx                # React Router 설정
│   ├── vite.config.ts
│   └── package.json
├── .env.example                   # 환경변수 템플릿
├── Dockerfile                     # SMTP 서버 Docker 빌드
├── Dockerfile.api                 # API + 대시보드 Docker 빌드
├── docker-compose.yml             # Docker Compose 구성 (Redis 포함)
├── .dockerignore                  # Docker 빌드 제외 목록
├── tsconfig.json
└── package.json
```

## 시작하기

### 사전 요구사항
- npm
- Redis 7+ (BullMQ 메시지 브로커용, 로컬 설치 또는 Docker)

### 설치

```bash
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
# .env 파일을 편집하여 값 설정
```

주요 환경변수:

| 변수 | 설명 | 기본값 |
|---|---|---|
| `DATABASE_URL` | DB 연결 문자열 | `file:./data/mail-gateway.db` |
| `REDIS_URL` | Redis 연결 URL (BullMQ 큐 백엔드) | `redis://127.0.0.1:6379` |
| `SMTP_HOST` | SMTP 수신 바인드 주소 | `0.0.0.0` |
| `SMTP_PORT` | SMTP 수신 포트 | `2525` |
| `SMTP_ALLOWED_IPS` | 허용 IP 목록 (쉼표 구분, CIDR 지원) | `127.0.0.1` |
| `RELAY_SMTP_HOST` | 발신 SMTP 서버 호스트 | - |
| `RELAY_SMTP_PORT` | 발신 SMTP 포트 | `587` |
| `RELAY_SMTP_USER` | 발신 SMTP 인증 사용자 | - |
| `RELAY_SMTP_PASS` | 발신 SMTP 인증 비밀번호 | - |
| `LOG_LEVEL` | 로그 레벨 | `info` |
| `ATTACHMENT_STORAGE_DIR` | 첨부파일 저장 디렉토리 | `./data/attachments` |
| `SMTP_TLS_ENABLED` | STARTTLS 활성화 여부 | `false` |
| `SMTP_TLS_KEY` | TLS 개인키 파일 경로 | - |
| `SMTP_TLS_CERT` | TLS 인증서 파일 경로 | - |
| `SMTP_TLS_CA` | TLS CA 인증서 파일 경로 (선택) | - |
| `RATE_LIMIT_MAX` | 윈도우당 IP별 최대 연결 수 | `100` |
| `RATE_LIMIT_WINDOW_MS` | 속도 제한 윈도우 (밀리초) | `60000` |
| `API_HOST` | API 서버 바인드 주소 | `0.0.0.0` |
| `API_PORT` | API 서버 포트 | `3000` |
| `MAX_MESSAGE_SIZE_MB` | 수신 메일 최대 크기 (MB) | `25` |
| `API_KEY` | API 인증 키 (미설정 시 인증 비활성화) | - |
| `CORS_ORIGINS` | CORS 허용 오리진 (쉼표 구분, `*`은 전체 허용) | `*` |
| `API_RATE_LIMIT_MAX` | API 윈도우당 IP별 최대 요청 수 | `200` |
| `API_RATE_LIMIT_WINDOW_MS` | API 속도 제한 윈도우 (밀리초) | `60000` |

### DB 마이그레이션

```bash
npm run db:migrate
```

### SMTP 서버 + 워커 실행
```bash
# 개발 모드 — 단일 프로세스 (SMTP 서버 + 내장 워커)
npm run dev
# 개발 모드 — 프로세스 분리 (SMTP 수신과 처리를 독립 실행)
npm run dev            # SMTP 서버 (수신 + 큐 등록)
npm run dev:worker     # 워커 (큐 처리: 파싱→분류→전달)

# 프로덕션
npm run build
npm start              # SMTP 서버 + 내장 워커

# 프로덕션 — pm2 프로세스 분리 (권장)
pm2 start dist/index.js --name mail-gateway
pm2 start dist/worker.js --name mail-worker
```

> **프로세스 분리 권장**: 프로덕션 환경에서는 SMTP 수신과 워커를 별도 프로세스로 분리하면, 처리 로직이 수신 처리량에 영향을 주지 않아 최대 수신 성능을 확보할 수 있습니다. pm2 등의 프로세스 관리자로 워커의 무중단 운영을 보장하세요.

### API 서버 + 대시보드 실행

```bash
# 개발 모드 (API hot reload + Vite dev server)
npm run dev:api              # API 서버 (hot reload)
npm run dev --prefix dashboard   # 대시보드 (Vite dev, http://localhost:5173)

# 프로덕션 (API 서버가 대시보드 정적 파일 서빙)
npm run build                # TypeScript 컴파일
npm run build:dashboard      # React 대시보드 빌드
npm run start:api            # http://localhost:3000 에서 API + 대시보드 서빙
```

### 기타 스크립트

```bash
npm run db:studio        # Prisma Studio (DB GUI)
npm run db:generate      # Prisma Client 재생성
npm run db:migrate:prod  # 프로덕션 마이그레이션 적용
npm run cli              # 룰 관리 CLI
npm run generate-cert    # 자체서명 TLS 인증서 생성
npm run dev:worker       # 워커 개발 모드 (hot reload)
npm run start:worker     # 워커 프로덕션 실행
```


## Docker

Docker로 컨테이너화된 환경에서 실행할 수 있습니다. 4개의 컨테이너(Redis, SMTP 서버, BullMQ 워커, API+대시보드)로 구성됩니다.

### 컨테이너 구성

| 컨테이너 | 이미지 | 역할 | 포트 |
|---|---|---|---|
| `redis` | `redis:7-alpine` | BullMQ 메시지 브로커 | 6379 |
| `mail-gateway` | 빌드 (`Dockerfile`) | SMTP 수신 → DB 저장 → 큐 등록 | 2525 |
| `mail-worker` | 빌드 (`Dockerfile`) | BullMQ 워커 (파싱→분류→전달) | - |
| `mail-gateway-api` | 빌드 (`Dockerfile.api`) | REST API + React 대시보드 | 3000 |

### 빠른 시작

```bash
# 이미지 빌드 및 실행 (4개 컨테이너)
docker compose up -d

# 로그 확인
docker compose logs -f redis              # Redis
docker compose logs -f mail-gateway       # SMTP 서버
docker compose logs -f mail-worker        # BullMQ 워커
docker compose logs -f mail-gateway-api  # API + 대시보드
# 중지
docker compose down
```

### 환경변수 설정

`.env` 파일을 생성하면 `docker-compose.yml`이 자동으로 읽습니다:

```bash
cp .env.example .env
# .env 파일에서 필요한 값 수정
```

또는 `docker compose`에서 직접 환경변수를 오버라이드:

```bash
SMTP_ALLOWED_IPS=10.0.0.0/8 RATE_LIMIT_MAX=200 docker compose up -d
```

### 볼륨
| 볼륨 | 컨테이너 경로 | 용도 |
|---|---|---|
| `mail-data` | `/app/data` | SQLite DB + 첨부파일 저장 (SMTP, 워커, API 공유) |
| `redis-data` | `/data` | Redis 영속화 데이터 |
| `./certs` (바인드) | `/app/certs` | TLS 인증서 (읽기 전용, SMTP만) |
### PostgreSQL로 전환

`docker-compose.yml`에서 PostgreSQL 관련 주석을 해제하고 `DATABASE_URL`을 변경하세요:
```yaml
# docker-compose.yml에서:
# 1. mail-gateway, mail-worker의 DATABASE_URL을 PostgreSQL URL로 변경
# 2. depends_on 섹션 주석 해제
# 3. postgres 서비스 섹션 주석 해제
# 4. pg-data 볼륨 주석 해제
```

또한 `prisma/schema.prisma`의 provider를 `"postgresql"`로 변경한 뒤 이미지를 다시 빌드하세요:

```bash
docker compose build --no-cache
docker compose up -d
```

### 직접 빌드

```bash
# 이미지 빌드
docker build -t mail-gateway .
docker build -f Dockerfile.api -t mail-gateway-api .
# Redis 실행
docker run -d \
  --name mail-gateway-redis \
  -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine
# SMTP 서버 실행
docker run -d \
  --name mail-gateway \
  -p 2525:2525 \
  -v mail-data:/app/data \
  -e DATABASE_URL=file:/app/data/mail-gateway.db \
  -e REDIS_URL=redis://mail-gateway-redis:6379 \
  -e SMTP_HOST=0.0.0.0 \
  -e SMTP_PORT=2525 \
  -e SMTP_ALLOWED_IPS=127.0.0.1 \
  -e LOG_LEVEL=info \
  --link mail-gateway-redis \
  mail-gateway
# BullMQ 워커 실행 (동일 이미지, 다른 CMD)
docker run -d \
  --name mail-worker \
  -v mail-data:/app/data \
  -e DATABASE_URL=file:/app/data/mail-gateway.db \
  -e REDIS_URL=redis://mail-gateway-redis:6379 \
  -e LOG_LEVEL=info \
  --link mail-gateway-redis \
  mail-gateway \
  sh -c 'npx prisma migrate deploy && node dist/worker.js'

# API + 대시보드 실행
docker run -d \
  --name mail-gateway-api \
  -p 3000:3000 \
  -v mail-data:/app/data \
  -e DATABASE_URL=file:/app/data/mail-gateway.db \
  -e API_HOST=0.0.0.0 \
  -e API_PORT=3000 \
  -e LOG_LEVEL=info \
  mail-gateway-api
```

## API 서버 + 대시보드

SMTP 서버와 별도로 실행되는 REST API 서버와 React 대시보드입니다. 동일한 SQLite DB를 공유하여 메일, 테넌트, 룰, 전달 로그를 웹에서 관리할 수 있습니다.

### 아키텍쳐

- **API 서버**: Hono (Node.js) — `/api/*` 엔드포인트 제공
- **대시보드**: React 19 + Vite + Tailwind CSS v4 — SPA
- **프로덕션 서빙**: API 서버가 대시보드 정적 파일을 직접 서빙 (nginx 불필요)
- **개발 모드**: Vite dev server(포트 5173)가 API 서버(포트 3000)로 프록시

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/api/health` | 헬스체크 |
| `GET` | `/api/emails` | 이메일 목록 (페이지네이션, status/tenantId 필터) |
| `GET` | `/api/emails/:id` | 이메일 상세 (첨부파일, 전달 로그 포함) |
| `POST` | `/api/emails/:id/retry` | 실패 메일 재시도 (failed 상태만) |
| `GET` | `/api/tenants` | 테넌트 목록 |
| `GET` | `/api/tenants/:id` | 테넌트 상세 |
| `POST` | `/api/tenants` | 테넌트 생성 |
| `PUT` | `/api/tenants/:id` | 테넌트 수정 |
| `DELETE` | `/api/tenants/:id` | 테넌트 삭제 |
| `GET` | `/api/rules` | 룰 목록 (tenantId 필터) |
| `GET` | `/api/rules/:id` | 룰 상세 |
| `POST` | `/api/rules` | 룰 생성 |
| `PUT` | `/api/rules/:id` | 룰 수정 |
| `DELETE` | `/api/rules/:id` | 룰 삭제 |
| `GET` | `/api/forward-logs` | 전달 로그 목록 (페이지네이션, emailId/status 필터) |
| `GET` | `/api/stats` | 대시보드 통계 (totalEmails, emailsByStatus, emailsToday 등) |


> 📖 전체 API 스펙은 [`docs/openapi.yaml`](docs/openapi.yaml) (OpenAPI 3.0.3) 문서를 참조하세요. 요청/응답 스키마, 파라미터 상세, 에러 응답 형식이 포함되어 있습니다.

### 응답 형식

```json
// 성공 (단일 객체)
{ "data": { ... } }

// 성공 (목록 + 페이지네이션)
{ "data": [...], "total": 100, "page": 1, "limit": 20 }

// 에러
{ "error": "에러 메시지" }
```

### 대시보드 페이지

| 경로 | 페이지 | 설명 |
|---|---|---|
| `/` | Dashboard | 통계 카드, 상태 분포, 최근 이메일 |
| `/emails` | Emails | 이메일 목록 + 상태 필터 |
| `/emails/:id` | Email Detail | 이메일 상세 + 첨부파일 + 전달 로그 |
| `/tenants` | Tenants | 테넌트 CRUD 관리 |
| `/rules` | Rules | 룰 CRUD 관리 + 테넌트 필터 |
| `/forward-logs` | Forward Logs | 전달 로그 조회 |

## STARTTLS 설정

SMTP 수신 서버에서 STARTTLS를 지원하여 클라이언트와의 통신을 암호화할 수 있습니다.

### 1. 인증서 생성

개발/테스트 환경에서는 자체서명 인증서를 사용할 수 있습니다:

```bash
npm run generate-cert
```

이 스크립트는 `certs/` 디렉토리에 `key.pem`과 `cert.pem`을 생성합니다.

프로덕션 환경에서는 Let's Encrypt 등의 공인 인증서를 사용하세요.

### 2. 환경변수 설정

```env
SMTP_TLS_ENABLED=true
SMTP_TLS_KEY=./certs/key.pem
SMTP_TLS_CERT=./certs/cert.pem
# SMTP_TLS_CA=./certs/ca.pem    # 선택: CA 인증서 체인
```

### 3. 동작 방식

- `SMTP_TLS_ENABLED=true` 설정 시 EHLO 응답에 STARTTLS가 광고됩니다.
- 클라이언트는 STARTTLS 명령으로 TLS 업그레이드를 요청할 수 있습니다.
- TLS 활성화 시 `key`와 `cert`는 필수이며, 파일이 존재하지 않으면 서버가 시작되지 않습니다.
- `SMTP_TLS_ENABLED=false`(기본값)이면 평문 SMTP만 지원합니다.

## 속도 제한 (Rate Limiting)

IP별 슬라이딩 윈도우 방식의 속도 제한이 적용됩니다.

- `RATE_LIMIT_MAX`: 윈도우 기간 내 IP당 최대 연결 횟수 (기본값: 100)
- `RATE_LIMIT_WINDOW_MS`: 윈도우 기간 (기본값: 60000ms = 1분)
- IPv6-mapped IPv4 주소는 자동 정규화됩니다 (`::ffff:192.168.1.1` → `192.168.1.1`)
- 제한 초과 시 SMTP 연결이 거부되며, 에러 메시지와 함께 재시도 가능 시간이 전달됩니다

## API 보안

API 서버에 대한 보안 기능입니다.

### API Key 인증

- `API_KEY` 환경변수를 설정하면 모든 API 요청에 인증이 필요합니다
- 인증 방식: `x-api-key` 헤더 또는 `?api_key=` 쿼리 파라미터
- `/api/health` 엔드포인트는 인증 없이 접근 가능합니다
- `API_KEY`가 설정되지 않으면 인증이 비활성화됩니다 (개발 환경용)

### CORS 설정

- `CORS_ORIGINS` 환경변수로 허용할 오리진을 설정합니다
- `*`: 모든 오리진 허용 (기본값)
- 쉼표 구분으로 여러 오리진 지정: `http://localhost:5173,https://admin.example.com`

### API 속도 제한

- IP별 슬라이딩 윈도우 방식으로 API 요청을 제한합니다
- `API_RATE_LIMIT_MAX`: 윈도우당 IP별 최대 요청 수 (기본값: 200)
- `API_RATE_LIMIT_WINDOW_MS`: 윈도우 기간 (기본값: 60000ms = 1분)
- 제한 초과 시 `429 Too Many Requests` 응답과 `Retry-After` 헤더를 반환합니다
- 응답 헤더에 `X-RateLimit-Limit`, `X-RateLimit-Remaining` 포함

### 입력 검증

- 룰 생성/수정 시 `action` 값은 `forward | log | archive | reject` 중 하나여야 합니다
- `conditions`는 유효한 JSON 배열이어야 하며, 각 조건의 `field`, `operator`, `value`를 Zod로 검증합니다
- `action`이 `forward`일 때 `forwardTo`는 유효한 이메일 형식이어야 합니다
- 테넌트 `settings`는 유효한 JSON 구조 (`{ maxMessageSizeBytes?: number }`)여야 합니다
- 이메일/전달 로그의 `status` 필터는 허용된 값만 사용할 수 있습니다
- 페이지네이션 `page`는 최대 1000으로 제한됩니다

## 멀티 테넌트

수신 메일의 rcptTo 도메인을 기반으로 테넌트를 식별하여, 테넌트별로 분류 룰을 격리할 수 있습니다.

### 동작 방식

1. 메일 수신 시 rcptTo의 도메인(`@` 뒤)을 추출
2. 등록된 테넌트의 domains 목록과 매칭
3. 테넌트가 매칭되면: 테넌트 전용 룰 + 글로벌 룰을 함께 평가
4. 테넌트가 없으면: 글로벌 룰만 평가

### 테넌트 CLI 관리

```bash
# 테넌트 목록
npm run cli -- tenant list

# 테넌트 상세 조회
npm run cli -- tenant show <name>

# 테넌트 생성
npm run cli -- tenant create acme-corp --domains acme.com,acme.io

# 테넌트 수정
npm run cli -- tenant update acme-corp --domains acme.com,acme.io,acme.dev --enabled true

# 테넌트 삭제
npm run cli -- tenant delete acme-corp

# 테넌트 전용 룰 생성 (--tenant 옵션)
npm run cli -- create acme-urgent \
  --action forward \
  --forward-to ops@acme.com \
  --priority 100 \
  --category urgent \
  --tenant acme-corp \
  --conditions '[{"field":"subject","operator":"contains","value":"긴급"}]'
```

## 룰 관리 CLI

분류 룰을 CLI로 관리할 수 있습니다.

```bash
# 전체 룰 목록
npm run cli -- list

# 특정 룰 상세 조회
npm run cli -- show <name>

# 룰 생성
npm run cli -- create urgent-forward \
  --action forward \
  --forward-to ops@example.com \
  --priority 100 \
  --category urgent \
  --conditions '[{"field":"subject","operator":"contains","value":"긴급"}]'

# 룰 수정
npm run cli -- update urgent-forward --priority 200 --enabled false

# 룰 삭제
npm run cli -- delete urgent-forward
```

## 메일 처리 흐름
SMTP 수신과 메일 처리가 BullMQ 큐를 통해 비동기로 분리되어 있습니다. SMTP 서버는 수신과 DB 저장만 수행하고, 실제 처리(파싱, 분류, 전달)는 별도 워커 프로세스에서 실행됩니다.

```
━━━ SMTP 서버 프로세스 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
수신 (SMTP)
  │
  ├─ IP 허용 확인
  ├─ 속도 제한 확인
  ├─ 테넌트 매칭 (rcptTo 도메인 기반)
  │
  ▼
DB 저장 (최소 데이터)
  │
  ├─ envelope (mailFrom, rcptTo, remoteIp)
  ├─ rawMessage (RFC822 원문)
  ├─ status = 'received'
  │
  ▼
BullMQ 큐 등록
  │
  ├─ emailId를 jobId로 사용 (멱등성 보장)
  ├─ 성공 → 250 OK 응답
  └─ 실패 → 451 Temporary failure 응답

━━━ Redis (BullMQ 메시지 브로커) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

━━━ BullMQ 워커 프로세스 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

워커가 큐에서 작업 수신
  │
  ├─ 멱등성 확인 (이미 처리된 이메일 건너뛰기)
  │
  ▼
파싱 (mailparser)
  │
  ├─ 헤더, 본문, 첨부파일 추출
  ├─ DKIM/SPF 검증
  ├─ 키워드 추출 (textBody 우선, htmlBody 폴백)
  ├─ DB 업데이트 (파싱 결과 저장)
  ├─ 첨부파일 디스크 저장
  │
  ▼
분류 (classifier)
  │
  ├─ 테넌트 전용 룰 + 글로벌 룰 조합
  ├─ 우선순위 순으로 룰 매칭
  ├─ 조건: subject, from, to, cc, body, header
  ├─ 연산자: contains, equals, startsWith, endsWith, regex, notContains
  │
  ▼
액션 실행
  ├─ forward  → 지정 주소로 메일 전달, 전달 로그 기록
  ├─ log      → 내부 로그만 남김
  ├─ archive  → 보관 처리
  └─ reject   → 거부 처리
```

> **룰 액션 상세:**
>
> | 액션 | 설명 | 이메일 상태 변경 |
> |---|---|---|
> | `forward` | `forwardTo`에 지정된 주소로 메일을 SMTP 릴레이를 통해 전달합니다. 전달 결과는 `ForwardLog`에 기록됩니다. | `received` → `forwarded` (성공 시) 또는 `failed` (실패 시) |
> | `log` | 별도 액션 없이 분류 결과만 기록합니다. 메일은 DB에 보존됩니다. | `received` → `classified` |
> | `archive` | 메일을 보관 처리합니다. 향후 조회는 가능하지만 전달하지 않습니다. | `received` → `archived` |
> | `reject` | 메일을 거부 처리합니다. SMTP 세션에서 거부 응답을 반환합니다. | `received` → `classified` |

## 상세: Email 상태 값 (status)

아래는 DB에 저장되는 Email.status 값들의 의미와 전환 시점입니다. 애플리케이션 내부 로직과 전달/분류 흐름에서 다음 규칙을 따릅니다.

| 상태 | 의미 | 전환 조건 / 설정 주체 |
|---|---|---|
| `received` | SMTP로 메일을 수신하여 최소 데이터(envelope + rawMessage)만 DB에 저장된 초기 상태. 워커가 아직 파싱/분류/전달을 수행하지 않은 상태입니다. | SMTP 서버가 메일을 수신하고 envelope 정보와 rawMessage를 DB에 저장한 직후, BullMQ 큐에 등록할 때 기본으로 설정합니다. |
| `classified` | 분류 룰에 매칭되어 카테고리가 지정된 상태. 보통 액션이 `log` 또는 `reject`인 경우에 설정됩니다. | 분류 엔진이 룰을 매칭하고, 룰의 action이 `log` 또는 `reject`일 때 분류 코드가 상태를 `classified`로 업데이트합니다. |
| `forwarded` | 분류 룰에 따라 지정된 주소로 SMTP 릴레이를 통해 전달이 완료된 상태. | 분류 엔진이 `forward` 액션을 선택하고, forwarder가 SMTP 릴레이에서 성공 응답을 받았을 때 ForwardLog와 Email.status를 `forwarded`로 업데이트합니다. |
| `failed` | 메일 전달 또는 포워딩 시도 중 오류가 발생한 상태. forwardTo가 없거나 SMTP 전달 실패 시 발생합니다. | `forward` 액션 실행 중 forwardTo가 비어있거나, SMTP 릴레이에서 오류가 발생하면 forwarder가 상태를 `failed`로 설정하고 ForwardLog.error를 기록합니다. |
| `archived` | 분류 룰에 의해 보관 처리된 상태. 조회는 가능하지만 전달은 하지 않습니다. | 분류 엔진이 `archive` 액션을 선택하면 Email.status를 `archived`로 업데이트합니다. |

## 상세: RuleAction 값들 (action)

각 액션이 실제로 수행하는 동작과 그에 따른 이메일 상태 변경을 명확히 정리합니다.

| 액션 | 실행 동작 | 이메일 상태 변경 및 로그 |
|---|---|---|
| `forward` | `forwardTo`에 지정된 주소로 메일을 SMTP 릴레이를 통해 전달합니다. 전달 시 원본 메시지와 필요한 헤더를 포함해 전송합니다. | 전달 시도는 ForwardLog 레코드를 생성하며, 성공 시 ForwardLog.status=`success`와 smtpResponse를 저장하고 Email.status=`forwarded`로 업데이트합니다. 실패 시 ForwardLog.status=`failed`, error 필드에 에러 메시지를 저장하고 Email.status=`failed`로 업데이트합니다. |
| `log` | 별도의 외부 전달 없이 분류 결과만 시스템 로그와 DB에 기록합니다. | Email.status를 `classified`로 설정합니다. ForwardLog는 생성되지 않습니다. |
| `archive` | 메일을 내부 저장소에 보관 처리하여 검색/조회는 가능하도록 합니다. 전달은 수행하지 않습니다. | Email.status를 `archived`로 설정합니다. 보관 관련 메타데이터는 Tenant.settings 또는 별도 보관 테이블에 저장될 수 있습니다. |
| `reject` | 메일을 거부 처리합니다. SMTP 세션 단계에서 거부 응답(5xx)을 반환하도록 트리거합니다. | 현재 구현에서는 거부를 별도 상태로 두지 않고 `archived`로 설정하며, 거부 로그를 남깁니다. (추후 별도 `rejected` 상태 도입 가능) |

## 상세: ConditionOperator 값들

조건 연산자는 필드 값과 비교하는 방식입니다. 기본적으로 대소문자를 구분하지 않으며, `regex`는 case-insensitive 플래그를 적용합니다. 유효하지 않은 정규식은 경고 로그 후 해당 조건은 false로 처리됩니다.

| 연산자 | 동작 방식 | 추가 메모 |
|---|---|---|
| `contains` | 대소문자 무시, 대상 필드에 지정 문자열이 포함되어 있으면 매칭 | 내부적으로 both values를 소문자화해 비교합니다. |
| `notContains` | 대소문자 무시, 대상 필드에 지정 문자열이 포함되어 있지 않으면 매칭 | `contains`의 역 논리입니다. |
| `equals` | 대소문자 무시, 대상 필드가 지정 문자열과 정확히 일치하면 매칭 | 공백 및 전체 문자열 일치 기준입니다. 트리밍은 적용될 수 있습니다. |
| `startsWith` | 대소문자 무시, 대상 필드가 지정 문자열로 시작하면 매칭 | 접두사 검사입니다. |
| `endsWith` | 대소문자 무시, 대상 필드가 지정 문자열로 끝나면 매칭 | 접미사 검사입니다. |
| `regex` | 정규표현식 매칭. 대소문자 무시 플래그(i)를 적용하여 비교. | 전달된 패턴에 대해 new RegExp(pattern, 'i')로 생성합니다. 패턴이 유효하지 않으면 경고 로그를 남기고 해당 조건은 false로 평가됩니다. 캡처 그룹은 사용 가능하지만 성능 영향에 유의하세요. |

## 상세: ConditionField 값들 (field)

각 필드가 메일의 어디에서 추출되는지 설명합니다.

| 필드 | 추출 위치 및 형식 |
|---|---|
| `subject` | 이메일의 Subject 헤더에서 추출된 문자열. 파싱 시 인코딩을 디코딩한 후 사용됩니다. |
| `from` | From 헤더의 값, 표시 이름과 이메일 주소를 포함한 형식으로 저장됩니다. 예: "Alice <alice@example.com>". 비교 시 전체 헤더 문자열을 사용합니다. |
| `to` | To 헤더에서 추출된 수신자 목록 문자열. 다중 수신자는 comma-separated 형식으로 처리됩니다. |
| `cc` | CC 헤더에서 추출된 참조자 목록 문자열. 다중 참조자는 comma-separated 형식입니다. |
| `body` | 본문 내용. 우선 textBody를 사용하며, textBody가 없으면 htmlBody를 플백으로 사용합니다. HTML을 사용할 때는 태그를 제거한 텍스트로 비교합니다. |
| `header` | 임의 헤더를 조회합니다. 조건에 `headerName` 필드를 함께 제공해야 하며, 내부적으로 헤더 이름을 소문자로 변환하여 조회합니다. 예: `headerName: "x-priority"`. |

## 상세: ForwardLog status 값

ForwardLog는 메일 포워딩 시 전달 시도와 결과를 남깁니다.

| 상태 | 의미 | 기록 필드 |
|---|---|---|
| `pending` | 전달이 아직 시도되지 않았거나 시도 대기 중인 초기 상태 | DB 생성 시 기본값으로 설정됩니다. |
| `success` | SMTP 릴레이를 통해 대상에 정상 전달되어 서버의 응답 원문이 저장된 상태 | smtpResponse 필드에 SMTP 응답 원문을 저장합니다. |
| `failed` | 전달 시도 중 오류가 발생한 상태 | error 필드에 에러 메시지를, attempts에 시도 횟수를 기록합니다. |

## TenantSettings JSON 구조

테넌트별 설정은 Tenant.settings 필드에 JSON 문자열로 저장됩니다. 현재 사용되는 설정 예시는 다음과 같습니다.

```json
{
  "maxMessageSizeBytes": 10485760
}
```

설명:

- maxMessageSizeBytes: 이 테넌트에서 허용하는 최대 메시지 크기(바이트). 위 예시는 10MB입니다. 테넌트 설정이 비어 있으면 글로벌 환경변수 MAX_MESSAGE_SIZE_MB를 바탕으로 허용 크기를 계산합니다.

## 환경변수: MAX_MESSAGE_SIZE_MB

이미 환경변수 표에 `MAX_MESSAGE_SIZE_MB`가 포함되어 있습니다. 동작과 우선순위는 다음과 같습니다.

- `MAX_MESSAGE_SIZE_MB`(환경변수): 글로벌 기본 수신 메시지 크기 제한(MB 단위). 예: `25`는 25MB를 의미합니다.
- 테넌트별로 `Tenant.settings.maxMessageSizeBytes`가 설정되어 있으면 해당 값이 글로벌 값을 덮어씁니다. 테넌트 설정 값은 바이트 단위입니다.

우선순위: Tenant.settings.maxMessageSizeBytes (있으면 사용) → 환경변수 MAX_MESSAGE_SIZE_MB → 코드 내 기본값(25MB).


## 분류 룰

DB의 `ClassificationRule` 테이블에 저장되며 JSON 형식의 조건 배열로 구성됩니다.

### 조건 구조

```json
{
  "field": "subject",
  "operator": "contains",
  "value": "긴급"
}
```

### 지원 필드

| 필드 | 설명 | 예시 값 |
|---|---|---|
| `subject` | 메일 제목 | `긴급`, `[알림]` |
| `from` | 발신자 (From 헤더) | `admin@example.com` |
| `to` | 수신자 (To 헤더) | `support@example.com` |
| `cc` | 참조 (CC 헤더) | `manager@example.com` |
| `body` | 본문 내용 (text 우선, html 폴백) | `결제 완료`, `승인 요청` |
| `header` | 임의 헤더 (`headerName` 필드로 헤더 이름 지정) | `X-Priority: 1` |

### 지원 연산자

| 연산자 | 설명 | 동작 상세 |
|---|---|---|
| `contains` | 포함 여부 | 대소문자 무시. 필드 값에 지정 문자열이 포함되면 매칭 |
| `notContains` | 미포함 여부 | 대소문자 무시. 필드 값에 지정 문자열이 포함되지 않으면 매칭 |
| `equals` | 정확히 일치 | 대소문자 무시. 필드 값이 지정 문자열과 완전히 동일하면 매칭 |
| `startsWith` | 접두사 일치 | 대소문자 무시. 필드 값이 지정 문자열로 시작하면 매칭 |
| `endsWith` | 접미사 일치 | 대소문자 무시. 필드 값이 지정 문자열로 끝나면 매칭 |
| `regex` | 정규표현식 매칭 | 대소문자 무시 플래그(i) 적용. 유효하지 않은 정규식은 무시됨 |

### 룰 예시

"제목에 '긴급'이 포함된 메일을 ops팀에 전달":

```json
{
  "name": "urgent-to-ops",
  "priority": 100,
  "conditions": [
    { "field": "subject", "operator": "contains", "value": "긴급" }
  ],
  "action": "forward",
  "forwardTo": "ops@example.com",
  "category": "urgent"
}
```

"특정 도메인에서 온 메일을 보관 처리":

```json
{
  "name": "archive-newsletters",
  "priority": 10,
  "conditions": [
    { "field": "from", "operator": "endsWith", "value": "@newsletter.example.com" }
  ],
  "action": "archive",
  "category": "newsletter"
}
```

### 분류 룰 OR 조건 (matchMode)

`ClassificationRule`에 `matchMode` 필드를 추가하여 조건 매칭 방식을 제어할 수 있습니다.

- 기본값: `all` — 모든 조건이 충족되어야 룰이 매칭됩니다 (AND)
- `any`: 하나의 조건만 충족되어도 룰이 매칭됩니다 (OR)
- API에서 룰 생성/수정 시 `matchMode` 필드로 설정할 수 있습니다

예시:

```json
{
  "name": "notify-if-from-or-subject",
  "priority": 50,
  "matchMode": "any",
  "conditions": [
    { "field": "from", "operator": "contains", "value": "alerts@example.com" },
    { "field": "subject", "operator": "contains", "value": "중요" }
  ],
  "action": "forward",
  "forwardTo": "ops@example.com"
}
```

## DB 전환 가이드

현재 SQLite로 구성되어 있으며, PostgreSQL 또는 MySQL로 전환할 수 있습니다.

### 1. `prisma/schema.prisma` 수정

```prisma
datasource db {
  provider = "postgresql"   // "mysql"도 가능
  url      = env("DATABASE_URL")
}
```

### 2. `.env` 수정

```env
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/mail_gateway"

# MySQL
DATABASE_URL="mysql://user:password@localhost:3306/mail_gateway"
```

### 3. 마이그레이션 재생성

```bash
# 기존 migrations 디렉토리 삭제 후
rm -rf prisma/migrations

# 새 DB에 맞는 마이그레이션 생성
npm run db:migrate
```

## 전달 재시도 메커니즘
전달 실패가 발생한 경우 BullMQ의 내장 재시도 메커니즘을 통해 자동 재시도합니다.

- **재시도 방식**: BullMQ 내장 exponential backoff
  - 지연 계산: `delay = 60,000ms × 2^(attempt-1)` (1분, 2분, 4분, 8분, 16분)
  - 최대 5회 재시도 후 최종 실패 처리
- **멱등성 보장**: emailId를 BullMQ jobId로 사용하여 동일 이메일의 중복 작업을 방지합니다
- **DB 체크포인트**: 워커가 작업 재시도 시 이미 완료된 단계(파싱, 첨부파일 저장 등)는 건너뛰어 불필요한 중복 작업을 방지합니다
- **수동 재시도**: `POST /api/emails/:id/retry` 엔드포인트로 특정 이메일을 즉시 재시도할 수 있습니다 (새 BullMQ 작업으로 등록)

## 키워드 추출 / 자동 태깅

수신된 메일의 본문에서 자동으로 키워드를 추출하여 Email 레코드에 저장합니다.

- 소스: `textBody` 우선, `textBody`가 없으면 `htmlBody`를 플백으로 사용합니다. HTML은 태그 제거 후 처리합니다
- 알고리즘: TF(Term Frequency) 기반으로 상위 10개 키워드를 선정합니다
- 언어: 영문과 한글을 모두 지원하며, 불용어(stopwords)를 필터링합니다
- 결과 저장: `Email.keywords` 필드에 JSON 배열 문자열로 저장됩니다

## DKIM / SPF 검증

선택적 기능으로, `mailauth` 패키지 설치 시 DKIM/SPF 검증이 활성화됩니다. 설치가 없으면 graceful fallback으로 검증을 비활성화하고 `none` 결과를 반환합니다.

- 활성화 방법: `npm install mailauth` 후 서버 재시작
- DKIM 결과: `pass`, `fail`, `none`, `error`
- SPF 결과: `pass`, `fail`, `none`, `softfail`, `error`
- 결과 저장: `Email.dkimResult`, `Email.spfResult` 필드에 저장됩니다


## DB 스키마

### Email

수신된 모든 메일의 원본 및 파싱 결과 저장.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `mailFrom` | String | SMTP MAIL FROM |
| `rcptTo` | String | SMTP RCPT TO |
| `remoteIp` | String | 발신 IP |
| `messageId` | String? | Message-ID 헤더 (unique) |
| `subject` | String? | 제목 |
| `fromHeader` | String? | From 헤더 |
| `toHeader` | String? | To 헤더 |
| `ccHeader` | String? | CC 헤더 |
| `textBody` | String? | 텍스트 본문 |
| `htmlBody` | String? | HTML 본문 |
| `rawMessage` | String | RFC822 원문 |
| `status` | String | `received` / `classified` / `forwarded` / `failed` / `archived` |
| `category` | String? | 분류 카테고리 |
| `matchedRule` | String? | 매칭된 룰 이름 |
| `dkimResult` | String? | DKIM 검증 결과 (`pass` / `fail` / `none` / `error`) |
| `spfResult` | String? | SPF 검증 결과 (`pass` / `fail` / `none` / `softfail` / `error`) |
| `keywords` | String? | 자동 추출된 키워드 (JSON 배열 문자열) |
| `tenantId` | String? | 소속 테넌트 ID |

> **Email 상태 (`status`) 값:**
>
> | 상태 | 설명 |
> |---|---|
> | `received` | SMTP로 수신 완료. 최소 데이터(envelope + rawMessage)만 DB 저장됨. 워커의 파싱/분류 전 |
> | `classified` | 워커가 파싱 후 분류 룰에 매칭하여 카테고리 지정됨 (액션이 `log`인 경우) |
> | `forwarded` | 워커가 분류 룰에 따라 지정 주소로 전달 완료 |
> | `failed` | 워커의 메일 전달 시도 중 오류 발생 |
> | `archived` | 워커가 분류 룰에 의해 보관 처리됨 |

### Attachment

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `emailId` | String | 소속 이메일 ID (FK → Email) |
| `filename` | String? | 첨부파일 원본 파일명 |
| `contentType` | String | MIME 타입 (예: `application/pdf`, `image/png`) |
| `size` | Int | 파일 크기 (바이트) |
| `checksum` | String? | SHA-256 해시 (무결성 검증용) |
| `storagePath` | String? | 디스크 저장 경로 |

### ClassificationRule

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | 룰 이름 (unique) |
| `description` | String? | 룰 설명 |
| `priority` | Int | 우선순위 (높을수록 먼저 평가, 기본값: 0) |
| `enabled` | Boolean | 활성화 여부 (기본값: true) |
| `conditions` | String | JSON 배열 — 매칭 조건 목록 |
| `action` | String | 매칭 시 실행할 액션: `forward` \| `log` \| `archive` \| `reject` |
| `forwardTo` | String? | 전달 대상 이메일 주소 (`action`이 `forward`일 때 필수) |
| `category` | String? | 분류 카테고리 태그 |
| `matchMode` | String | 조건 매칭 모드: `all` (AND, 기본값) \| `any` (OR) |
| `tenantId` | String? | 소속 테넌트 ID (FK → Tenant, null이면 글로벌 룰) |

### ForwardLog

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `emailId` | String | 대상 이메일 ID (FK → Email) |
| `forwardTo` | String | 전달 대상 이메일 주소 |
| `status` | String | 전달 상태: `pending` (대기) \| `success` (성공) \| `failed` (실패) |
| `error` | String? | 실패 시 에러 메시지 |
| `smtpResponse` | String? | SMTP 서버 응답 원문 |
| `attempts` | Int | 전달 시도 횟수 (기본값: 1) |
| `nextRetryAt` | DateTime? | 다음 재시도 예정 시각 |

### Tenant

멀티 테넌트 격리 단위.

| 컨럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `name` | String | 테넌트 이름 (unique) |
| `domains` | String | JSON 배열 (도메인 목록) |
| `settings` | String? | JSON 설정 |
| `enabled` | Boolean | 활성화 여부 |

## Use Cases

실제 운영 시나리오별 구성 가이드입니다.

| # | 시나리오 | 설명 |
|---|---|---|
| 01 | [고객 지원 메일 라우팅](docs/use-cases/01-customer-support.md) | 수신 메일을 제목/발신자 기반으로 담당 부서에 자동 전달 |
| 02 | [멀티 테넌트 SaaS 메일 격리](docs/use-cases/02-multi-tenant-saas.md) | 도메인별 테넌트 분리, 테넌트 전용 룰로 메일 격리 |
| 03 | [내부 메일 감사 및 컴플라이언스](docs/use-cases/03-audit-compliance.md) | 모든 메일을 아카이브하고 키워드 기반 컴플라이언스 감사 |
| 04 | [모니터링 알림 집약](docs/use-cases/04-alert-aggregation.md) | Grafana, Prometheus 등 알림 메일을 분류·집약하여 온콜 팀에 전달 |
| 05 | [개발/스테이징 메일 캡처](docs/use-cases/05-dev-mail-trap.md) | 릴레이 없이 메일 트랩으로 사용, 대시보드에서 발송 메일 검사 |
| 06 | [MX 레코드 기반 프로덕션 메일 수신](docs/use-cases/06-production-mx.md) | DNS MX → 리버스 프록시 → Mail Gateway, STARTTLS 프로덕션 구성 |
| 07 | [엔터프라이즈 복합 라우팅](docs/use-cases/07-enterprise-routing.md) | 본사·자회사 멀티 테넌트, 복합 룰 체인, 대규모 트래픽 대응 |
