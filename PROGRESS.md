# 진행사항

## v0.1.0 — 프로젝트 초기 세팅 (2026-02-23)

### 완료 항목

#### 프로젝트 기반

- [x] TypeScript 프로젝트 초기화 (`strict` 모드, `ES2022` 타겟)
- [x] 패키지 의존성 설치 및 설정
- [x] 환경변수 관리 (`.env`, `.env.example`, Zod 검증)
- [x] 구조화 로깅 설정 (Pino)
- [x] `.gitignore` 구성

#### 데이터베이스

- [x] Prisma 스키마 설계 (4개 모델: `Email`, `Attachment`, `ClassificationRule`, `ForwardLog`)
- [x] SQLite 기반 초기 마이그레이션 생성 및 적용
- [x] 레포지토리 레이어 구현 (테이블별 CRUD 추상화)
- [x] DB 전환 설계 — `schema.prisma`의 `provider` + `.env`의 `DATABASE_URL`만 변경하면 PostgreSQL/MySQL 전환 가능

#### SMTP 수신

- [x] SMTP 서버 구현 (`smtp-server`)
- [x] IP 허용 목록 기반 접근 제어 (CIDR 서브넷 지원)
- [x] 수신 메일 → 파싱 → 분류 → 액션 파이프라인 구현

#### 메일 파싱

- [x] RFC 822 메일 파싱 (`mailparser`)
- [x] 헤더, 본문(text/html), 첨부파일 추출
- [x] 첨부파일 SHA-256 체크섬 생성
- [x] 원본 메시지(rawMessage) 보존

#### 분류 엔진

- [x] DB 기반 룰 매칭 엔진 구현
- [x] 우선순위(`priority`) 기반 순차 평가
- [x] 6개 대상 필드: `subject`, `from`, `to`, `cc`, `body`, `header`(임의 헤더)
- [x] 6개 연산자: `contains`, `notContains`, `equals`, `startsWith`, `endsWith`, `regex`
- [x] 다중 조건 AND 매칭

#### 메일 전달

- [x] nodemailer 기반 SMTP 릴레이 전달
- [x] 전달 로그 DB 기록 (성공/실패, SMTP 응답, 에러 메시지)
- [x] 릴레이 SMTP 미설정 시 경고 로그 + 전달 비활성화

#### 애플리케이션

- [x] 엔트리포인트 및 부트스트랩 시퀀스 (DB 연결 → 릴레이 검증 → SMTP 서버 시작)
- [x] Graceful shutdown (SIGINT, SIGTERM)
- [x] 전역 예외 처리 (`uncaughtException`, `unhandledRejection`)
- [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)

#### E2E 테스트 (v0.2.0 — 2026-02-23)

- [x] vitest 테스트 프레임워크 설정 (격리된 SQLite DB, 순차 실행)
- [x] 테스트 인프라 구축 (SMTP 클라이언트 헬퍼, 캡처 SMTP 서버, DB 초기화)
- [x] 수신 파이프라인 테스트 (plaintext, HTML, rawMessage 저장 확인)
- [x] 분류 엔진 테스트 (subject contains, from endsWith, regex, 우선순위, 미매칭)
- [x] 전달 테스트 (성공 시 ForwardLog + 캡처 서버 확인, 실패 시 에러 로그)
- [x] IP 필터링 테스트 (허용되지 않은 IP 거부, isIpAllowed 단위 테스트)
- [x] 첨부파일 테스트 (SHA-256 체크섬, 메타데이터, 다중 첨부)
- [x] 액션 테스트 (archive, reject, log 상태 확인, 다중 수신자)
- [x] 소스 변경: `isIpAllowed` export, `resetTransporter` 추가 (테스트 지원)


## v0.3.0 — 설정 분리 + 높은 우선순위 기능 (2026-02-23)

### 완료 항목

#### 설정 분리

 [x] `ATTACHMENT_STORAGE_DIR` 환경변수 추가 (기본값: `./data/attachments`)
 [x] `config.storage.attachmentDir` 설정 섹션 추가
 [x] `.env.example` 업데이트
 [x] `vitest.config.ts` 테스트용 저장 경로 설정 (`./data/test-attachments`)

#### 첨부파일 디스크 저장

 [x] `src/storage/index.ts` 신규 — `storeAttachment()` 함수 구현
 [x] emailId별 서브디렉토리 생성 (`{attachmentDir}/{emailId}/`)
 [x] 파일명 sanitize (특수문자 → `_`, 최대 200자)
 [x] `src/smtp/server.ts` 수정 — 파싱 후 디스크에 첨부파일 저장, `storagePath` DB 기록
 [x] E2E 테스트 확장 — storagePath 존재 확인, 파일 내용 일치 검증, emailId 디렉토리 구조 검증
 [x] 테스트 setup에 첨부파일 디렉토리 정리 추가 (`beforeEach`, `afterAll`)

#### 룰 관리 CLI

 [x] `src/cli.ts` 구현 — `list`, `show`, `create`, `update`, `delete` 5개 서브커맨드
 [x] 조건 JSON 유효성 검증 (필드, 연산자, 값 타입 검사)
 [x] `ruleRepository.findAll()` 메서드 추가 (enabled 필터 없이 전체 조회)
 [x] `package.json`에 `cli` 스크립트 등록 (`npm run cli`)

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)
 [x] 전체 E2E 테스트 통과 (6개 파일, 18개 테스트 케이스)

---

## v0.4.0 — STARTTLS 지원 (2026-02-23)

### 완료 항목

#### 설정

 [x] TLS 환경변수 4개 추가 (`SMTP_TLS_ENABLED`, `SMTP_TLS_KEY`, `SMTP_TLS_CERT`, `SMTP_TLS_CA`)
 [x] `readTlsFile()` 헬퍼 — 파일 존재 검증 후 읽기, 없으면 `process.exit(1)`
 [x] `config.smtp.tls` 섹션 추가 (`enabled`, `key`, `cert`, `ca`)
 [x] `.env.example` 업데이트

#### SMTP 서버

 [x] `disabledCommands` 조건부 설정 — TLS 활성화 시 STARTTLS 명령 허용
 [x] TLS key/cert를 SMTPServerOptions에 스프레드
 [x] 로그 메시지에 `starttls` 필드 추가

#### 인증서 생성

 [x] `scripts/generate-cert.sh` — openssl 기반 자체서명 인증서 생성 스크립트
 [x] `tests/helpers/tls.ts` — 테스트용 인증서 프로그래밍 생성 (캐싱)
 [x] `package.json`에 `generate-cert` 스크립트 추가

#### E2E 테스트

 [x] `tests/e2e/starttls.test.ts` — 3개 테스트 케이스
  - STARTTLS 업그레이드를 통한 메일 수신 확인
  - TLS 비활성화 시 EHLO 응답에 STARTTLS 미포함 확인
  - TLS 활성화 시 EHLO 응답에 STARTTLS 포함 확인

#### 문서

 [x] README.md 업데이트 (환경변수 테이블, 프로젝트 구조, STARTTLS 설정 가이드)
 [x] PROGRESS.md 업데이트

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)
 [x] 전체 E2E 테스트 통과 (7개 파일, 21개 테스트 케이스)

---


## v0.5.0 — 속도 제한 (2026-02-23)

### 완료 항목

#### 속도 제한 엔진

 [x] 인메모리 슬라이딩 윈도우 rate limiter 구현 (`src/rate-limiter/index.ts`)
 [x] IP별 연결 횟수 추적 (타임스탬프 배열 기반)
 [x] IPv6-mapped IPv4 주소 자동 정규화 (`::ffff:192.168.1.1` → `192.168.1.1`)
 [x] 환경변수 2개 추가 (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`)
 [x] `config.rateLimit` 섹션 추가 (Zod 검증)
 [x] `.env.example` 업데이트

#### SMTP 서버 통합

 [x] `onConnect` 훅에서 rate limiter 호출
 [x] 제한 초과 시 SMTP 에러 응답 (재시도 가능 시간 포함)
 [x] `resetRateLimiter()` export (테스트 지원)

#### E2E 테스트

 [x] `tests/e2e/rate-limit.test.ts` — 7개 테스트 케이스
  - 제한 이하 연결 허용
  - 제한 초과 시 거부
  - 윈도우 만료 후 재허용
  - 서로 다른 IP 독립 추적
  - IPv6-mapped IPv4 정규화 확인
  - 윈도우 경계 슬라이딩 동작
  - 기본값 적용 확인

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)
 [x] 전체 E2E 테스트 통과 (8개 파일, 28개 테스트 케이스)

---

## v0.6.0 — 멀티 테넌트 (2026-02-23)

### 완료 항목

#### DB 스키마

 [x] `Tenant` 모델 추가 (id, name, domains, settings, enabled, createdAt, updatedAt)
 [x] `Email`, `ClassificationRule`에 optional `tenantId` FK 추가
 [x] Prisma 마이그레이션 적용 (`db push`)

#### 레포지토리

 [x] `tenantRepository` 구현 (create, findAll, findById, findByName, findByDomain, update, delete)
 [x] `ruleRepository.findAllEnabled(tenantId?)` — 테넌트 룰 + 글로벌 룰 조합 조회

#### 분류 엔진

 [x] `classifyEmail(parsed, tenantId?)` 시그니처 변경
 [x] 테넌트 ID 전달 시 해당 테넌트 룰 + 글로벌 룰 함께 평가

#### SMTP 서버

 [x] rcptTo 도메인 기반 테넌트 조회 (`tenantRepository.findByDomain`)
 [x] 매칭된 tenantId를 분류/저장 파이프라인에 전달

#### CLI

 [x] `tenant` 서브커맨드 5개 (list, show, create, update, delete)
 [x] `--tenant` 옵션으로 룰 생성 시 테넌트 연결
 [x] 도메인 유효성 검증 (`validateDomains`)

#### E2E 테스트

 [x] `tests/e2e/multi-tenant.test.ts` — 4개 테스트 케이스
  - 테넌트 도메인 매칭 시 전용 룰 적용
  - 미등록 도메인은 글로벌 룰만 적용
  - 테넌트 비활성화 시 글로벌 폴백
  - 테넌트 전용 + 글로벌 룰 우선순위 혼합 평가

#### 문서

 [x] README.md 업데이트 (멀티 테넌트 섹션, 테넌트 CLI, DB 스키마, 메일 처리 흐름)
 [x] PROGRESS.md 업데이트

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)
 [x] 전체 E2E 테스트 통과 (9개 파일, 32개 테스트 케이스)

---


## v0.7.0 — Docker 컨테이너화 (2026-02-23)

### 완료 항목

#### Dockerfile

 [x] 멀티 스테이지 빌드 (builder + production)
 [x] 베이스 이미지: `node:22-alpine` (최신 LTS, 경량)
 [x] builder: `npm ci` → `prisma generate` → `tsc`
 [x] production: `npm ci --omit=dev` → `prisma generate` → `dist/` 복사
 [x] non-root user (`appuser:appgroup`) 실행
 [x] `HEALTHCHECK` 설정
 [x] CMD: `prisma migrate deploy` → `node dist/index.js` (컨테이너 시작 시 마이그레이션 자동 적용)
 [x] EXPOSE 2525 (SMTP 포트)

#### .dockerignore

 [x] 불필요 파일 제외 (node_modules, dist, data, tests, *.md, .env 등)

#### docker-compose.yml

 [x] SQLite 기본 구성 (`mail-data` named volume, `./certs` 바인드 마운트)
 [x] PostgreSQL 옵션 주석 포함 (주석 해제만으로 전환 가능)
 [x] 모든 환경변수 매핑 (`${VAR:-default}` 형태)
 [x] restart 정책 (`unless-stopped`)

#### 문서

 [x] README.md Docker 섹션 추가 (빠른 시작, 환경변수 설정, 볼륨, PostgreSQL 전환, 직접 빌드)
 [x] README.md 프로젝트 구조에 Dockerfile, docker-compose.yml, .dockerignore 추가
 [x] PROGRESS.md 업데이트

---


## v0.8.0 — 메일 크기 제한 + 문서화 (2026-02-24)

### 완료 항목

#### 메일 크기 제한 (테넌트별)

 [x] `MAX_MESSAGE_SIZE_MB` 글로벌 환경변수 추가 (기본값: 25MB)
 [x] `TenantSettings.maxMessageSizeBytes` 테넌트별 크기 제한 설정
 [x] `tenantRepository.getMaxMessageSize(tenantId)` 메서드 구현
 [x] SMTP `onData` 단계에서 스트림 크기 실시간 검사, 초과 시 552 응답 반환
 [x] 우선순위: 테넌트 설정 → 환경변수 → 코드 기본값 (25MB)
 [x] E2E 테스트 추가 (크기 초과 거부, 크기 이내 허용, 테넌트별 크기 제한)

#### 문서화

 [x] README.md — Email 상태 값 상세 설명 추가 (5개 상태, 전환 조건, 설정 주체)
 [x] README.md — RuleAction 상세 설명 추가 (4개 액션, 실행 동작, ForwardLog 관계)
 [x] README.md — ConditionOperator 상세 설명 추가 (6개 연산자, 대소문자 규칙, regex 처리)
 [x] README.md — ConditionField 상세 설명 추가 (6개 필드, 추출 위치, body fallback 동작)
 [x] README.md — ForwardLog status 상세 설명 추가 (3개 상태, 기록 필드)
 [x] README.md — TenantSettings JSON 구조 및 MAX_MESSAGE_SIZE_MB 우선순위 설명 추가
 [x] OpenAPI 3.0.3 스펙 생성 (`docs/openapi.yaml`, 921줄, 15개 엔드포인트)
 [x] README.md — API 엔드포인트 테이블 하단에 OpenAPI 스펙 참조 링크 추가
 [x] Use Case 문서 7건 작성 (`docs/use-cases/`)
   - `01-customer-support.md` — 고객 지원 메일 자동 분류/전달
   - `02-multi-tenant-saas.md` — SaaS 멀티 테넌트 메일 분리
   - `03-audit-compliance.md` — 감사/컴플라이언스 메일 보관
   - `04-alert-aggregation.md` — 알림 메일 집계 및 라우팅
   - `05-dev-mail-trap.md` — 개발 환경 메일 트랩
   - `06-production-mx.md` — 프로덕션 MX 게이트웨이 구성
   - `07-enterprise-routing.md` — 엔터프라이즈 메일 라우팅 (부서별 분류)
   - 각 문서에 Mermaid 아키텍처 다이어그램, CLI/환경변수 설정 예시, 주의사항 포함
 [x] PROGRESS.md 업데이트

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)

---

## v0.9.0 — API 보안 강화 + PostgreSQL 인덱스 (2026-02-24)

### 완료 항목

#### PostgreSQL 복합 인덱스

 [x] `Email(status, createdAt)` — 상태 필터 + 페이지네이션 최적화
 [x] `Email(tenantId, status, createdAt)` — 테넌트별 이메일 조회 최적화
 [x] `ClassificationRule(enabled, tenantId, priority)` — 룰 매칭 핫 패스 최적화
 [x] Prisma 마이그레이션 생성 (`20260224034422_add_composite_indexes`)

#### API 인증 및 보안 미들웨어

 [x] `src/api/middleware/security.ts` — API Key 인증 미들웨어 (`x-api-key` 헤더 / `api_key` 쿼리)
 [x] `/api/health` 엔드포인트 인증 예외 처리
 [x] `API_KEY` 환경변수 추가 (미설정 시 인증 비활성화)
 [x] IP별 슬라이딩 윈도우 API 속도 제한 (`API_RATE_LIMIT_MAX`, `API_RATE_LIMIT_WINDOW_MS`)
 [x] `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` 응답 헤더

#### CORS 설정

 [x] `CORS_ORIGINS` 환경변수 배열 설정 (`*` 또는 쉼표 구분 오리진)
 [x] `src/api/main.ts` — Hono CORS 미들웨어 동적 오리진 설정

#### 응답 보안

 [x] 이메일 상세 조회 시 `rawMessage` 필드 응답 제외 (민감 데이터 노출 방지)
 [x] 전역 에러 핸들러에서 스택 트레이스/내부 정보 비노출 (기존 정상 동작 확인)

#### 입력 검증 강화

 [x] `emails.ts` — `status` 화이트리스트 검증, 페이지네이션 `page` 상한 (MAX_PAGE=1000), `rawMessage` 응답 제외
 [x] `forward-logs.ts` — `status` 화이트리스트 검증 (`pending | success | failed`), 페이지네이션 `page` 상한
 [x] `rules.ts` — `action` enum 검증, `conditions` JSON 스키마 Zod 검증, `forwardTo` 이메일 형식 검증, `priority` 범위 제한
 [x] `tenants.ts` — `settings` JSON Zod 스키마 검증 (`TenantSettings` 구조 강제)

#### 문서

 [x] `.env.example` — API 보안 환경변수 4개 추가
 [x] README.md — 환경변수 테이블 업데이트, API 보안 섹션 추가, 프로젝트 구조에 middleware 추가
 [x] PROGRESS.md 업데이트

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)

---

## v1.0.0 — 5개 신규 기능 구현 (2026-02-24)

### 완료 항목

#### 메일 재처리 API (Feature 1)

 [x] `POST /api/emails/:id/retry` 엔드포인트 추가 (`src/api/routes/emails.ts`)
 [x] `failed` 상태 메일만 재시도 가능, 그 외 상태는 400 에러 반환
 [x] rawMessage 재파싱 → 재분류 → 재전달 파이프라인 실행

#### 분류 룰 OR 조건 지원 (Feature 2)

 [x] `ClassificationRule.matchMode` 필드 추가 (`all` | `any`, 기본값: `all`)
 [x] 분류 엔진에서 `matchMode`에 따라 `every()` 또는 `some()` 동적 선택 (`src/classifier/index.ts`)
 [x] 룰 생성/수정 API에 `matchMode` 검증 추가 (`src/api/routes/rules.ts`)

#### 전달 실패 재시도 워커 (Feature 3)

 [x] `src/retry/index.ts` — 백그라운드 인터벌 워커 구현
 [x] Exponential backoff: `baseDelay × 2^(attempts-1)` 계산
 [x] `ForwardLog.nextRetryAt` 필드 기반 재시도 스케줄링
 [x] 환경변수 4개 추가 (`RETRY_ENABLED`, `RETRY_MAX_ATTEMPTS`, `RETRY_BASE_DELAY_MS`, `RETRY_POLL_INTERVAL_MS`)
 [x] `src/index.ts` — 서버 시작/종료 시 워커 시작/정지 통합
 [x] `src/forwarder/index.ts` — 전달 실패 시 `nextRetryAt` 설정

#### 키워드 추출 / 자동 태깅 (Feature 4)

 [x] `src/keyword/index.ts` — TF 기반 키워드 추출 엔진 구현
 [x] 영문/한글 지원, HTML 태그 제거, 불용어(stopwords) 필터링
 [x] 상위 10개 키워드 추출 → JSON 문자열로 DB 저장
 [x] `src/smtp/server.ts` — 메일 수신 시 자동 키워드 추출 통합

#### DKIM / SPF 검증 (Feature 5)

 [x] `src/auth/index.ts` — `mailauth` 패키지 기반 이메일 인증 검증
 [x] 선택적 의존성: `mailauth` 미설치 시 graceful fallback (`none` 결과 반환)
 [x] DKIM/SPF 결과를 `Email.dkimResult`, `Email.spfResult` 필드에 저장
 [x] `src/smtp/server.ts` — 메일 수신 시 자동 인증 검증 통합

#### DB 스키마 변경

 [x] `Email` — `dkimResult`, `spfResult`, `keywords` 컬럼 추가
 [x] `ClassificationRule` — `matchMode` 컬럼 추가 (기본값: `all`)
 [x] `ForwardLog` — `nextRetryAt` 컬럼 추가
 [x] Prisma 마이그레이션 적용 (`20260224042045_add_matchmode_retry_keywords_auth`)

#### 문서

 [x] PROGRESS.md 업데이트
 [x] README.md 업데이트 — 5개 신규 기능, 새로운 DB 컬럼, 환경변수, API 엔드포인트 문서화

#### 검증

 [x] TypeScript 빌드 검증 통과 (`tsc --noEmit` 에러 0)

---


## v1.1.0 — BullMQ 비동기 아키텍처 + E2E 테스트 강화 (2026-02-24)

### 완료 항목

#### E2E 테스트 전수 점검 및 보강

 [x] 기존 10개 테스트 파일, 36개 테스트 케이스 전수 감사 — 13개 이상 누락 시나리오 식별
 [x] `classify.test.ts` — 11개 테스트 추가 (notContains, equals, startsWith, endsWith 연산자, cc/body/header 필드, regex 에러 처리, 다중 조건 AND, 멀티 룰 우선순위, matchMode any OR 매칭)
 [x] `receive.test.ts` — 4개 테스트 추가 (빈 subject, 다중 수신자, 대용량 본문, Content-Type 없는 메일)
 [x] `ip-filter.test.ts` — 3개 테스트 추가 (CIDR /16 서브넷, 여러 IP 대역 동시 허용, IPv6-mapped IPv4 정규화)
 [x] `forward.test.ts` — 3개 테스트 추가 (forwardTo 미설정 시 실패, 릴레이 미설정 시 경고+실패, 다중 수신자 전달)
 [x] 기존 3개 실패 테스트 수정 (BullMQ 워커 타이밍 이슈 해결)
 [x] 최종 결과: **10개 파일, 57개 테스트 케이스, 전체 통과**

#### BullMQ + Redis 비동기 아키텍처

 [x] SMTP 수신과 메일 처리(파싱→분류→전달) 비동기 분리 — 수신 처리량이 처리 로직에 제한되지 않도록 개선
 [x] `src/queue/connection.ts` — IORedis 연결 팩토리 (싱글턴, `REDIS_URL` 환경변수 기반)
 [x] `src/queue/email-queue.ts` — BullMQ Queue 프로듀서 (`addEmailJob(emailId)`, emailId를 jobId로 사용하여 멱등성 보장)
 [x] `src/queue/email-processor.ts` — BullMQ Worker 컨슈머 (DB 체크포인트 기반 재시도: 이미 파싱된 이메일은 파싱 단계 건너뜀)
 [x] `src/queue/index.ts` — 배럴 export
 [x] `src/worker.ts` — 독립 워커 프로세스 엔트리포인트 (pm2 프로세스 관리 지원)

#### SMTP 서버 리팩토링

 [x] `src/smtp/server.ts` — 수신 핸들러를 enqueue-only로 변경 (최소 데이터 DB 저장 → BullMQ 큐 등록 → 250 OK)
 [x] 큐 등록 실패 시 `451 Temporary failure` SMTP 응답 반환
 [x] rawMessage + envelope 정보만 초기 저장, 파싱/분류/전달은 워커가 수행

#### 인프라 변경

 [x] `src/config/shared.ts` — `REDIS_URL` 환경변수 추가 (Zod 검증, 기본값: `redis://127.0.0.1:6379`)
 [x] `src/db/repository.ts` — `updateParsedFields()` 메서드 추가 (워커가 파싱 결과를 DB에 업데이트)
 [x] `src/index.ts` — 기존 retry 워커를 BullMQ 내장 워커로 교체, graceful shutdown 시 worker.close() 호출
 [x] `docker-compose.yml` — redis 서비스 추가, mail-worker 서비스 추가, depends_on 설정, redis-data 볼륨 추가
 [x] `package.json` — `dev:worker`, `start:worker` 스크립트 추가
 [x] `.env.example` — `REDIS_URL` 추가, 기존 `RETRY_*` 환경변수 제거
 [x] `vitest.config.ts` — 테스트 환경에 `REDIS_URL` 추가
 [x] `tests/setup.ts` — BullMQ 워커 라이프사이클 관리 + 큐 drain 로직 추가

#### 문서 업데이트

 [x] README.md — 전면 업데이트 (11개 섹션): 기술 스택 테이블, 프로젝트 구조, 사전 요구사항, 환경변수 테이블, 실행 가이드, 스크립트 목록, Docker 구성, 메일 처리 흐름, Email 상태 값, 전달 재시도 메커니즘, DB 스키마
 [x] PROGRESS.md — 미구현/향후 작업 섹션 업데이트, 기술적 결정 사항 3건 추가

#### 검증

 [x] 전체 E2E 테스트 통과 (10개 파일, 57개 테스트 케이스)

---

### 미구현 / 향후 작업
 [x] 룰 관리 CLI — `npm run cli` (list, show, create, update, delete)
 [x] 첨부파일 디스크 저장 — emailId별 서브디렉토리에 파일 저장, storagePath DB 기록
- [x] E2E 테스트 코드 작성 (vitest 기반, 57개 테스트 케이스, 10개 테스트 스위트)
 [x] STARTTLS 지원
#### 중간 우선순위
- [x] 분류 룰 OR 조건 지원 (현재 AND만) — v1.0.0에서 구현
- [x] 전달 실패 시 재시도 메커니즘 (exponential backoff) — v1.0.0에서 구현, v1.1.0에서 BullMQ로 전환
- [x] 메일 본문 기반 키워드 추출 / 자동 태깅 — v1.0.0에서 구현
- [x] 대시보드 또는 관리 UI
- [x] SMTP 수신과 처리 비동기 분리 (BullMQ + Redis) — v1.1.0에서 구현
#### 낮은 우선순위
 [x] 속도 제한 (rate limiting)
- [x] 메일 크기 제한 세분화 — 테넌트별 `maxMessageSizeBytes` 설정 지원
 [x] 멀티 테넌트 지원
 [x] Docker 컨테이너화 및 docker-compose 구성
---

### 기술적 결정 사항
| 결정 | 이유 |
|---|---|
| Prisma 6 (7 대신) | Prisma 7은 설정 방식이 대폭 변경(`prisma.config.ts` 필수 등)되어 안정성을 위해 6 LTS 선택 |
| SQLite 시작 | 개발/테스트 환경에서 별도 DB 서버 불필요. Prisma의 provider 전환으로 프로덕션 RDB 전환 용이 |
| 룰 조건을 JSON 문자열 저장 | SQLite 호환성 + 유연한 조건 구조. RDB 전환 시 `jsonb` 타입으로 교체 가능 |
| Zod로 환경변수 검증 | 앱 시작 시점에 잘못된 설정을 즉시 감지하여 런타임 에러 방지 |
| Pino 로거 | 구조화 JSON 로깅으로 프로덕션 로그 분석 도구(ELK 등)와 바로 연동 가능 |
| rawMessage 전체 저장 | 감사(audit) 목적. 원본 보존으로 파싱 로직 변경 시에도 재처리 가능 |
| BullMQ + 로커 Redis | SMTP 수신 처리량이 처리 로직에 의해 제한되는 문제 해결. pm2 프로세스 관리로 워커 무중단 운영 보장 |
| emailId를 jobId로 사용 | BullMQ 레벨에서 동일 이메일 중복 작업 방지 (멱등성 보장) |
| DB 체크포인트 기반 재시도 | BullMQ가 전체 작업을 재시도하되, 워커가 이미 완료된 단계를 건너뛰어 불필요한 중복 작업 방지 |
