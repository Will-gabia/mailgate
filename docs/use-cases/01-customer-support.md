# 고객 지원 메일 라우팅

## 개요
고객은 support@company.com으로 메일을 보냅니다. Mail Gateway는 수신된 메일을 제목과 본문에 포함된 키워드 및 헤더를 바탕으로 분류하고, 사전 정의된 룰에 따라 적절한 팀으로 라우팅합니다. 예를 들어 결제 관련 문의는 billing 팀으로, 기술 문의는 tech 팀으로, 환불 요청은 refund 팀으로 전달됩니다.

분류 규칙에 맞지 않는 메일은 자동으로 포워드되지 않고 로그에 기록되어 수동 검토 대상이 됩니다. 이 프로세스는 오탐을 줄이고, 우선순위를 기반으로 룰을 평가하며, 모든 조건은 대소문자 구분 없이 AND 매칭으로 처리됩니다.

## 아키텍처
```mermaid
graph LR
  Customer[고객]
  MailGateway[Mail Gateway]
  Billing[billing@company.com]
  Tech[tech@company.com]
  Refund[refund@company.com]
  General[general@company.com]
  Archive[Archive/Logs]

  Customer -->|SMTP| MailGateway
  MailGateway -->|rule: 결제| Billing
  MailGateway -->|rule: 기술| Tech
  MailGateway -->|rule: 환불| Refund
  MailGateway -->|default rule| General
  MailGateway -->|action: log/archive| Archive
```

## 메일 처리 흐름
```mermaid
graph TB
  A[SMTP 수신] --> B[수신자/발신자/IP 검사]
  B --> C[IP 허용 목록 검증]
  C --> D[레이트 제한 검사]
  D --> E[메시지 파싱 (헤더, 본문, 첨부)]
  E --> F[규칙 기반 분류]
  F --> G{룰 매칭 여부}
  G -->|매칭됨| H[우선순위 순으로 룰 평가]
  H --> I[조건(AND) 검사: subject, from, to, cc, body, header]
  I --> J{조건 충족}
  J -->|예| K[액션 실행: forward / archive / reject]
  J -->|아니오| L[다음 룰로 이동]
  G -->|매칭되지 않음| M[미매칭 처리: action=log, status=classified]
  K --> N[포워드: RELAY_SMTP로 전송]
  N --> O[포워드 결과 기록 -> forward-logs]
  M --> P[로그 저장 및 수동 검토 큐]
```

## 환경변수 설정
아래는 .env 예시입니다. 주석은 각 변수의 목적을 설명합니다.

```env
# 데이터베이스 연결 (SQLite)
DATABASE_URL="file:./data/mail-gateway.db"

# 내부 SMTP 수신 설정
SMTP_HOST=0.0.0.0
SMTP_PORT=2525

# 허용된 내부 메일 서버 IP (쉼표로 구분, CIDR 지원)
SMTP_ALLOWED_IPS=10.0.0.5,10.0.0.6

# 외부로 메일을 전달할 릴레이 SMTP (예: Gmail, AWS SES)
RELAY_SMTP_HOST=smtp.gmail.com
RELAY_SMTP_PORT=587
RELAY_SMTP_USER="relay-user@example.com"
RELAY_SMTP_PASS="supersecretpassword"

# 로깅 레벨 (debug, info, warn, error)
LOG_LEVEL=info

# 최대 메시지 허용 크기(MB)
MAX_MESSAGE_SIZE_MB=25

# 속도 제한
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=60000
```

## 룰 설정
아래 예시는 CLI를 통해 룰을 생성하는 구문입니다. 조건은 JSON 배열로 전달하며, 한 룰 내의 모든 조건은 AND로 평가됩니다. 대소문자 구분 없이 비교합니다.

주의: 현재 분류 엔진은 OR 조건을 지원하지 않습니다. '결제' 또는 '청구'처럼 여러 키워드 중 하나라도 매칭되기를 원한다면, 각 키워드마다 별도의 룰을 생성해야 합니다. 한 룰에 여러 조건을 넣으면 AND로 평가되어 모든 조건이 동시에 충족되어야 합니다.

- 결제 관련 문의를 billing으로 포워드
```bash
npm run cli -- create "rule-billing-payment" \
  --action forward \
  --forward-to billing@company.com \
  --priority 100 \
  --category billing \
  --conditions '[{"field":"subject","operator":"contains","value":"결제"}]'
```

- 청구 관련 문의를 billing으로 포워드 (OR 미지원이므로 별도 룰)
```bash
npm run cli -- create "rule-billing-invoice" \
  --action forward \
  --forward-to billing@company.com \
  --priority 100 \
  --category billing \
  --conditions '[{"field":"subject","operator":"contains","value":"청구"}]'
```

- 기술 문의를 tech로 포워드
```bash
npm run cli -- create "rule-tech" \
  --action forward \
  --forward-to tech@company.com \
  --priority 90 \
  --category tech \
  --conditions '[{"field":"subject","operator":"contains","value":"기술"}]'
```

- 오류 관련 문의를 tech로 포워드 (별도 룰)
```bash
npm run cli -- create "rule-tech-error" \
  --action forward \
  --forward-to tech@company.com \
  --priority 90 \
  --category tech \
  --conditions '[{"field":"subject","operator":"contains","value":"오류"}]'
```

- 환불 요청을 refund로 포워드
```bash
npm run cli -- create "rule-refund" \
  --action forward \
  --forward-to refund@company.com \
  --priority 95 \
  --category refund \
  --conditions '[{"field":"subject","operator":"contains","value":"환불"}]'
```

- 기본 라우팅 (catch-all, 낮은 우선순위)
```bash
npm run cli -- create "rule-default-general" \
  --action forward \
  --forward-to general@company.com \
  --priority 1 \
  --category general \
  --conditions '[{"field":"subject","operator":"regex","value":".*"}]'
```

설명: catch-all 룰은 `regex`와 `.*` 패턴을 사용하여 모든 메일에 매칭됩니다. 우선순위를 1로 낮게 설정하여 다른 룰이 먼저 평가됩니다.

## 대시보드 활용
대시보드는 http://localhost:3000 에서 접근합니다. 주요 페이지:
- /emails: 수신된 메일 목록을 상태(status), 분류(category), 우선순위로 필터링합니다.
- /emails/:id: 개별 메일의 원본, 파싱된 헤더, 룰 매칭 로그, 포워드 시도 결과를 확인합니다.
- /rules: 현재 활성화된 룰과 우선순위를 관리합니다.
- /forward-logs: 포워드 시도 기록과 성공/실패 통계를 보여줍니다.

또한 통계 페이지에서 일별 수신량, 분류별 분포, 포워드 실패율을 확인할 수 있어 운영 지표 모니터링에 유용합니다.

## 주의사항
- RELAY_SMTP_HOST가 미설정일 경우 forward 액션은 실패합니다.
- 룰의 priority 수치가 높을수록 먼저 평가됩니다.
- 모든 조건은 AND 매칭입니다. OR 조건은 지원되지 않으므로 키워드별로 룰을 분리하세요.
- 조건 비교는 대소문자 구분 없이 수행됩니다.
- 분류 규칙에 맞지 않는 메일은 status=classified, action=log으로 처리되어 수동 검토 큐에 쌓입니다.
- `--conditions`는 반드시 비어 있지 않은 JSON 배열이어야 합니다.

## 관련 문서
- [README](../../README.md)
- [OpenAPI 스펙](../../docs/openapi.yaml)
