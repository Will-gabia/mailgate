# 엔터프라이즈 복합 라우팅

## 개요

대형 엔터프라이즈는 여러 자회사(테넌트)와 각 자회사 내부의 부서로 구성됩니다. 본 시스템의 Mail Gateway는 두 단계 라우팅을 처리합니다. 먼저 수신된 메일의 수신 도메인을 통해 자회사를 식별합니다(테넌트 매칭). 그 다음, 식별된 자회사 고유의 룰을 적용해 올바른 부서나 목적지로 라우팅합니다. 스팸 차단, 악성코드 검사, 감사 로깅 같은 글로벌 룰은 모든 자회사에 공통으로 적용됩니다. 각 자회사는 별도의 최대 메시지 크기 같은 설정을 가질 수 있어 용량 제한을 테넌트별로 다르게 운영할 수 있습니다.

## 아키텍처

```mermaid
graph TB
  subgraph external
    A[acme.com] -->|SMTP| MG[Mail Gateway]
    B[subsidiary-a.co.kr] -->|SMTP| MG
  end

  MG --> TM[Tenant Matching]
  TM -->|headquarters| ACME_RULES[ACME Rules]
  TM -->|subsidiary-a| SUB_A_RULES[Subsidiary A Rules]
  TM -->|subsidiary-b| SUB_B_RULES[Subsidiary B Rules]

  ACME_RULES --> HR[HR Mailbox]
  ACME_RULES --> LEGAL[Legal Mailbox]
  ACME_RULES --> PROCUREMENT[Procurement Mailbox]

  SUB_A_RULES --> MANAGEMENT_A[Management Mailbox]
  SUB_A_RULES --> GENERAL_A[General Mailbox]

  SUB_B_RULES --> TECH_B[Tech Mailbox]

  MG --> GLOBAL[Global Rules (spam, malware)]
  GLOBAL -->|block/reject| Blackhole[(Reject)]

  MG -.-> Dashboard[Dashboard for unified monitoring]
```

## 복합 라우팅 흐름

```mermaid
graph TB
  A[SMTP receive] --> B[rcptTo domain extract]
  B --> C[Tenant lookup]
  C --> D{Tenant found?}
  D -->|yes| E[load tenant rules]
  D -->|yes| F[load global rules]
  E --> G[merge rules, sort by priority desc]
  F --> G
  G --> H[evaluate rules sequentially]
  H --> I{match?}
  I -->|yes| J[execute action (forward/reject/log)]
  I -->|no| K[default action (catch-all or reject)]
  D -->|no| L[load global rules only]
  L --> M[sort by priority desc]
  M --> H
```

## 환경변수 설정

예시 .env 파일 (엔터프라이즈 배포용)

```
# 데이터베이스 (SQLite)
DATABASE_URL=file:./data/mail-gateway.db

# SMTP 수신 설정
SMTP_HOST=0.0.0.0
SMTP_PORT=2525

# 여러 내부 메일 서버 IP/CIDR 허용
SMTP_ALLOWED_IPS=10.0.0.0/8,192.168.1.0/24,203.0.113.5

# 내부 릴레이 호스트 (기업 Postfix/Exchange)
RELAY_SMTP_HOST=mail.corp.internal
RELAY_SMTP_PORT=587
RELAY_SMTP_USER=relay-user
RELAY_SMTP_PASS=relay-pass

# 속도 제한 (엔터프라이즈 고트래픽)
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW_MS=60000

# 최대 메시지 크기 (대형 첨부파일 고려)
MAX_MESSAGE_SIZE_MB=50

# 로깅
LOG_LEVEL=info
```

설명:
- SMTP_ALLOWED_IPS에는 여러 내부 메일 서버 IP나 CIDR을 쉼표로 구분해 입력합니다.
- RELAY_SMTP_HOST는 내부 릴레이용 호스트 이름 또는 IP입니다.
- RATE_LIMIT_MAX는 엔터프라이즈의 높은 트래픽을 감당하도록 500으로 설정합니다.
- MAX_MESSAGE_SIZE_MB는 대형 첨부파일을 고려해 50MB로 확장했습니다.

## 테넌트 설정

테넌트 생성 예시 (CLI)

```bash
# 본사
npm run cli -- tenant create headquarters --domains '["acme.com","acme.co.kr"]'

# 자회사 A
npm run cli -- tenant create subsidiary-a --domains '["subsidiary-a.co.kr"]'

# 자회사 B
npm run cli -- tenant create subsidiary-b --domains '["subsidiary-b.com","subsidiary-b.io"]'
```

테넌트별 메시지 크기 제한 설정 — CLI 사용

```bash
# 자회사 B는 10MB로 제한
npm run cli -- tenant update subsidiary-b --max-message-size 10
```

또는 API를 사용한 설정:

```bash
curl -X PUT http://localhost:3000/api/tenants/<id> \
  -H 'Content-Type: application/json' \
  -d '{"settings": "{\"maxMessageSizeBytes\": 10485760}"}'
```

설명: TenantSettings 객체의 maxMessageSizeBytes 필드로 테넌트별 최대 메시지 크기를 설정할 수 있습니다. `--max-message-size`는 MB 단위이며, 내부적으로 바이트로 변환됩니다.

## 룰 설정

다음은 글로벌 룰과 각 테넌트별 룰을 CLI로 생성하는 예시입니다. 모든 조건은 기본적으로 AND이며, OR 조건은 지원하지 않습니다. 글로벌 룰은 `--tenant` 없이 생성됩니다.

글로벌 룰 (모든 테넌트 적용)

```bash
# 1. 스팸 차단: subject regex '^\[SPAM\]' -> reject, priority 10000, category: spam
npm run cli -- create "spam-block" \
  --action reject \
  --priority 10000 \
  --category spam \
  --conditions '[{"field":"subject","operator":"regex","value":"^\\[SPAM\\]"}]'

# 2. 바이러스 경고: subject contains 'virus detected' -> reject, priority 9000, category: malware
npm run cli -- create "virus-detected" \
  --action reject \
  --priority 9000 \
  --category malware \
  --conditions '[{"field":"subject","operator":"contains","value":"virus detected"}]'

# 3. 감사 로그: catch-all -> log, priority 1, category: audit
npm run cli -- create "audit-log" \
  --action log \
  --priority 1 \
  --category audit \
  --conditions '[{"field":"subject","operator":"regex","value":".*"}]'
```

본사 (headquarters) 룰

```bash
# 4. 인사팀: subject contains '인사' -> forward to hr@acme.com
npm run cli -- create "hq-hr-1" \
  --tenant headquarters \
  --action forward \
  --forward-to hr@acme.com \
  --priority 500 \
  --category hr \
  --conditions '[{"field":"subject","operator":"contains","value":"인사"}]'

# 4b. 인사팀(채용): subject contains '채용' -> forward to hr@acme.com (OR 미지원이므로 별도 룰)
npm run cli -- create "hq-hr-2" \
  --tenant headquarters \
  --action forward \
  --forward-to hr@acme.com \
  --priority 500 \
  --category hr \
  --conditions '[{"field":"subject","operator":"contains","value":"채용"}]'

# 5. 법무팀: subject contains '계약' -> forward to legal@acme.com
npm run cli -- create "hq-legal" \
  --tenant headquarters \
  --action forward \
  --forward-to legal@acme.com \
  --priority 500 \
  --category legal \
  --conditions '[{"field":"subject","operator":"contains","value":"계약"}]'

# 6. 구매팀: from endsWith '@vendor.com' -> forward to procurement@acme.com
npm run cli -- create "hq-procurement" \
  --tenant headquarters \
  --action forward \
  --forward-to procurement@acme.com \
  --priority 400 \
  --category procurement \
  --conditions '[{"field":"from","operator":"endsWith","value":"@vendor.com"}]'
```

자회사 A 룰

```bash
# 7. 긴급 알림: subject contains '긴급' -> forward to management@subsidiary-a.co.kr
npm run cli -- create "suba-urgent" \
  --tenant subsidiary-a \
  --action forward \
  --forward-to management@subsidiary-a.co.kr \
  --priority 500 \
  --category urgent \
  --conditions '[{"field":"subject","operator":"contains","value":"긴급"}]'

# 8. 일반 접수: catch-all -> forward to info@subsidiary-a.co.kr
npm run cli -- create "suba-general" \
  --tenant subsidiary-a \
  --action forward \
  --forward-to info@subsidiary-a.co.kr \
  --priority 10 \
  --category general \
  --conditions '[{"field":"subject","operator":"regex","value":".*"}]'
```

자회사 B 룰

```bash
# 9. 기술 지원: subject contains '기술' -> forward to tech@subsidiary-b.com
npm run cli -- create "subb-tech" \
  --tenant subsidiary-b \
  --action forward \
  --forward-to tech@subsidiary-b.com \
  --priority 500 \
  --category tech-support \
  --conditions '[{"field":"subject","operator":"contains","value":"기술"}]'
```

설명: 모든 룰은 우선순위 값이 클수록 먼저 평가됩니다. 글로벌 룰과 테넌트 룰은 하나의 우선순위 공간에서 정렬되어 평가됩니다.

## 우선순위 설계 가이드

| 범위 | 우선순위 대역 | 용도 |
|---|---|---|
| 9000-10000 | 글로벌 차단 (reject) | 스팸, 악성코드 |
| 1000-8999 | 긴급/중요 라우팅 | CRITICAL 알림 |
| 100-999 | 부서별 분류 | 일반 업무 라우팅 |
| 1-99 | catch-all | 미매칭 기본 처리 |

설명: 테넌트 룰과 글로벌 룰은 함께 정렬되어 평가됩니다. 따라서 충돌을 피하려면 우선순위 대역을 사전에 설계하세요. 예를 들어, 글로벌 차단 룰은 항상 최상위(9000 이상)에 두고, 테넌트별 분류 룰은 100-999 대역을 사용하세요.

## 대시보드 활용

엔터프라이즈 대시보드는 다음 경로와 필터를 제공합니다.

- /tenants: 자회사별 관리, 도메인 및 설정 편집
- /emails: tenantId 필터로 자회사별 메일 조회
- /rules: tenantId 필터로 자회사별 룰 관리
- /stats: 전체 통계 (현재는 테넌트별 분리 집계 API는 제공되지 않음, 대시보드에서 필터로 확인 가능)

설명: tenantId 파라미터로 특정 자회사의 메일과 룰을 필터링해서 운영할 수 있습니다. 단, 집계 API는 전체 기준으로 동작하므로 대규모 집계가 필요하면 별도 ETL이나 로그 집계 파이프라인을 권장합니다.

## 주의사항

- 테넌트 룰과 글로벌 룰의 우선순위 충돌에 주의하세요. 사전에 우선순위 대역을 설계해 충돌을 줄이세요.
- OR 조건은 지원하지 않습니다. 예: '인사' 또는 '채용'을 하나의 룰로 처리할 수 없으므로 별도 룰을 만드세요.
- 테넌트 결정은 rcptTo의 첫 번째 수신자의 도메인으로 수행됩니다. CC나 BCC 수신자의 도메인은 테넌트 결정에 영향 주지 않습니다.
- 테넌트별 통계 분리는 대시보드 필터로 가능하지만, 집계 API는 전체 기준으로 동작합니다. 별도 테넌트별 집계가 필요하면 외부 집계 시스템을 구축하세요.
- SQLite는 소규모 환경에 적합합니다. 대규모 엔터프라이즈 환경에서는 PostgreSQL 같은 RDBMS를 권장합니다.
- 첨부파일이 많은 대용량 메일이 많다면 디스크 용량과 임시 저장소 전략을 반드시 계획하세요.
- `--domains`는 JSON 배열 형식으로 전달해야 합니다 (예: `'["acme.com","acme.co.kr"]'`).

## 관련 문서

- [README](../../README.md)
- [OpenAPI 스펙](../../docs/openapi.yaml)
