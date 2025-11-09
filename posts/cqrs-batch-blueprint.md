# 이벤트 브로커 없이 CQRS 배치 시스템 블루프린트

**요약:** 이벤트 브로커 없이도 CQRS를 구축하고 배치 파이프라인에 접목해 정합성과 운영 효율을 동시에 확보하는 3단계 로드맵입니다. 각 의사결정에는 “왜 필요한가?”와 “어떤 결과가 나오는가?”를 한쌍으로 명시해 쉽게 따라갈 수 있게 했습니다.

---

## 1. Situation & Goal

- **Situation:** 정산·청구 등 대량 트랜잭션을 다루는 배치 시스템은 읽기 트래픽과 쓰기 트랜잭션이 서로 간섭하며 SLA를 위협합니다. 동시에 메시지 브로커나 이벤트 스트리밍 인프라를 도입하면 신규 인프라 운영, 보안 심사, 장애 대응 체계를 새로 갖춰야 하기 때문에 비용 대비 효과가 불확실합니다.
- **Task:** 이벤트 브로커 없이 CQRS(Command Query Responsibility Segregation)를 적용해 읽기/쓰기 워크로드를 분리하고, 배치 잡이 안전하게 증분 동기화하도록 설계해야 합니다. 즉, 기존 DB와 배치 스케줄러라는 가용 자산만으로 서비스 SLA를 지켜야 합니다.
- **Action:** 단일 DB와 배치 스케줄러만으로도 가능한 설계 패턴을 선정하고, 데이터 정합성 보강을 위한 배치 전략을 포함한 구현 플랜을 수립합니다. 설계의 모든 단계는 “쓰기 모델에 기록 → Outbox 저장 → 배치가 Projection 갱신”이라는 인과를 따라갑니다.
- **Result:** 읽기 성능은 캐시와 리포팅 DB로 안정화하고, 쓰기 모델은 트랜잭션 안전성을 유지합니다. 배치 잡은 증분 재처리를 통해 사고 대응 시간을 단축할 수 있으며, 운영팀은 새로운 인프라를 배워야 하는 부담 없이 기존 역량으로 시스템을 확장할 수 있습니다.

---

## 2. 기술 스택 선택

| 계층 | 선택 | 적용 이유 |
| --- | --- | --- |
| API | Spring Boot + REST | 기존 JVM 생태계와 배치(Spring Batch)를 함께 사용할 수 있어 학습 비용이 최소화되고, Actuator 지표로 배치·API 상태를 한 화면에서 추적 가능합니다. |
| 데이터베이스 | PostgreSQL (단일 인스턴스, 로컬 리플리카) | 논리적 복제로 Projection을 만들 수 있고, JSONB·파티셔닝 기능이 Outbox/Projection 테이블을 관리하기에 적합합니다. 새로운 DB 계열을 도입하지 않아도 되므로 운영 부담이 늘어나지 않습니다. |
| 배치 | Spring Batch + Quartz (또는 Spring Scheduler) | StepScope, RetryTemplate 등 기본 제공 기능이 Outbox 재처리에 바로 연결되며, Quartz는 잡 지연 시 즉시 보정 실행(Misfire Policy)으로 처리 적체를 줄입니다. |
| 캐시 | Redis (Optional) | Projection 테이블 응답 지연이 200ms 이상으로 튈 때 단기적으로 완충 장치가 됩니다. 캐시 장애 시에도 Query API가 DB로 fallback하도록 설계해 안정성을 지킵니다. |
| Observability | Prometheus + Grafana, CloudWatch 대체 가능 | 배치 지표, Outbox 적체량, 리플리카 지연을 하나의 모니터링 스택에서 수집해 인과 분석 시간을 단축합니다. |
| 배포 | GitHub Actions + Argo Rollouts (또는 단순 Blue/Green) | 배치와 API를 독립적으로 배포하면서도 동일한 CI 파이프라인을 공유해 릴리스 절차가 일관됩니다. 롤백 시 Outbox 스키마가 그대로 남아 데이터 일관성을 유지합니다. |

> 이벤트 브로커를 두지 않는 대신 PostgreSQL 논리 복제와 배치 기반 증분 동기화를 병행해 지연을 보완합니다.

---

## 3. 아키텍처 개요

```
사용자/외부시스템 → Command API (쓰기) → Primary DB
                             │
                             ├─ 트랜잭션 로그 테이블 (Outbox)
                             │
                             └─ Query Sync Batch → Read Replica / 리포팅 스키마 → Query API (읽기)
```

1. Command API는 Primary DB에만 연결합니다.
2. Outbox 테이블은 이벤트 브로커를 대체해 변경 이력을 저장합니다.
3. 배치 잡이 Outbox를 polling하여 읽기 모델에 반영합니다.
   - Outbox에만 의존하면 배치가 중단돼도 Primary 데이터는 안전하게 유지됩니다.
   - 배치는 Outbox의 처리 상태만 갱신하므로 쓰기 트랜잭션에 영향을 주지 않습니다.
4. Query API는 리플리카 또는 별도 리포팅 스키마를 조회합니다.
   - 읽기 요청이 Primary에 도달하지 않아 트랜잭션 락 경합이 사라집니다.
   - 리플리카 지연이 발생하면 API 레이어에서 타임아웃 후 Primary fallback을 허용해 UX를 보호합니다.

---

## 4. Command 모델 설계

### 4.1 도메인 테이블

- 도메인 모델은 정규화된 스키마를 유지합니다.
- 배치 트랜잭션을 고려하여 `created_at`, `updated_at`, `status` 컬럼에 인덱스를 추가합니다.

### 4.2 Outbox 패턴

| 컬럼 | 설명 |
| --- | --- |
| `id` | PK, UUID |
| `aggregate_type` | 예: `SettlementOrder` |
| `aggregate_id` | 도메인 ID |
| `payload` | JSON, 변화 상세 |
| `operation` | `CREATE`, `UPDATE`, `DELETE` |
| `version` | 낙관적 락을 위한 버전 |
| `processed_at` | 배치가 읽은 시점 |
| `created_at` | 생성 시각 |

- Command 트랜잭션 내부에서 Outbox 레코드를 함께 커밋합니다.
- 왜? Outbox에 쓰기가 성공해야만 Projection 업데이트가 진행되므로, 동일 트랜잭션에 묶어두면 “Command 성공 = Outbox 기록 존재”라는 불변식을 유지할 수 있습니다.
- `operation`과 `payload`는 읽기 모델에서 upsert/soft delete 로직을 결정하는 근거입니다.

### 4.3 동시성

- API는 낙관적 락(Version Column) 또는 `SELECT ... FOR UPDATE`로 충돌을 방지합니다.
- 왜? Outbox에 동일 aggregate가 동시에 기록될 경우 버전 충돌을 감지해 중복 처리와 데이터 누락을 막기 위해서입니다.
- 배치가 Outbox를 읽을 때 `FOR UPDATE SKIP LOCKED`로 다중 워커를 허용할 수 있습니다.
  - 이 옵션을 사용하면 배치 워커가 하나의 레코드를 처리하는 동안 다른 워커는 잠금이 걸린 행을 건너뛰어 큐 적체를 줄입니다.

---

## 5. Query 모델 설계

### 5.1 저장소 전략

1. **동일 DB 다른 스키마**: Primary의 논리 복제 슬롯을 활용해 별도 스키마에 Projection 테이블 구성.
2. **Read Replica**: PostgreSQL physical replica를 생성하고, 배치가 replica에 upsert.
3. **Materialized View**: 읽기 패턴이 단순하다면 배치가 MV를 refresh.

> 작은 팀이라면 1번 전략이 단순하며, 복잡한 조인은 Projection 테이블에서 denormalize하여 API 응답을 빠르게 반환합니다.

### 5.2 Projection 테이블 예시

| 필드 | 설명 |
| --- | --- |
| `payout_id` | Command 모델의 PK |
| `merchant_name` | 조인된 정보 |
| `total_amount` | 계산된 필드 |
| `status` | 표시 상태 |
| `settled_at` | 정산일 |
| `synced_at` | 마지막 동기화 시간 |

- 인덱스: `status`, `settled_at`, 복합 인덱스 `merchant_name, settled_at`.
- Query API는 Projection 테이블만 조회하여 조인을 줄입니다.

### 5.3 데이터 정합성 전략

- Outbox → Projection 업데이트는 배치에서 idempotent upsert로 구현합니다.
- 왜? 배치가 재실행되더라도 결과가 덮어쓰여야 정합성을 유지할 수 있고, 중복 삽입으로 인한 PK 충돌을 방지합니다.
- 누락 검증을 위해 `projection.synced_at < NOW() - INTERVAL '5 minutes'` 레코드 수를 모니터링합니다.
  - 지표가 급증하면 Outbox 처리 지연 또는 배치 장애라는 원인이 드러나며, 운영팀은 즉시 재처리 워크플로를 가동할 수 있습니다.

---

## 6. 배치 통합 전략

### 6.1 잡 토폴로지

1. **Outbox Sweep Step**: `processed_at IS NULL` 또는 `processed_at < ?` 조건으로 레코드를 청크 단위로 읽습니다.
2. **Projection Upsert Step**: 청크를 받아 Projection에 upsert합니다.
3. **Audit Step**: 처리 건수, 실패 건수, 재시도 큐에 push.

### 6.2 증분 재처리 설계

- Outbox 레코드는 `processed_at` 업데이트 대신 별도 상태 컬럼(`process_state`)과 재시도 카운터를 둡니다.
- 배치 실패 시 동일 레코드를 다시 잡을 수 있도록 `MAX_RETRY`를 설정하고 초과 시 Dead-letter 테이블에 저장합니다.
- 대량 오류 시 특정 시간 구간을 스캔해 재실행할 수 있도록 Step 파라미터로 `from_created_at`, `to_created_at`을 받습니다.
  - 장애 보고서에는 보통 “언제부터 문제가 시작됐는가?”가 기록되므로, 해당 구간만 재처리하면 전체 Outbox를 재생성하지 않아도 됩니다.

### 6.3 스케줄링

| 잡 | 주기 | 목적 |
| --- | --- | --- |
| `cqrs-sync-job` | 1분 | Outbox → Projection 반영 |
| `cqrs-reconcile-job` | 1시간 | Projection과 Command 모델 정합성 비교 |
| `cqrs-cleanup-job` | 매일 02:00 | Outbox 보관 기간 관리, Dead-letter 아카이브 |

- Quartz를 사용하는 경우 Misfire 정책을 `NOW_WITH_EXISTING_COUNT`로 설정해 backlog를 빠르게 처리합니다.
- 고가용성이 필요하다면 Quartz Cluster 모드 대신 Spring Batch + Kubernetes CronJob을 사용하는 것도 선택지입니다.

### 6.4 모니터링 지표

- `outbox_lag_seconds`: Outbox 생성 시각과 처리 시각 차이.
- `projection_staleness`: Projection `synced_at` 기준.
- `batch_success_rate`: Step별 성공률과 재시도 횟수.
- `read_model_latency`: Query API의 95th percentile 응답 시간.
- 네 가지 지표를 동시에 보면 “Command → Outbox → Projection → Query API” 흐름에서 병목이 어디인지 즉시 파악할 수 있습니다. 예를 들어 `outbox_lag_seconds`는 낮은데 `read_model_latency`만 높다면 캐시 또는 리플리카 튜닝이 필요하다는 결론에 도달할 수 있습니다.

---

## 7. 구현 단계별 로드맵

### Phase 0. 준비

- 스키마 마이그레이션 도구(Flyway)로 Outbox 및 Projection 테이블 생성.
- 기본 Command API (CRUD)와 단일 DB 기반 배치 잡 구축.

### Phase 1. CQRS 분리

1. Command API가 Outbox 레코드를 함께 커밋하도록 트랜잭션 수정.
2. Query API를 Projection 테이블을 조회하도록 분리.
   - Query 전용 DB 사용자에게 최소 권한을 부여해 쓰기 모델에 영향을 주지 않도록 합니다.
3. Projection 테이블 생성 및 초기 로딩 배치 실행 (`INSERT INTO projection SELECT ...`).
   - 초기 로딩 배치에서 집계 기준을 명확히 문서화하면 이후 배치 증분 로직 검증 시 참조 기준이 됩니다.

### Phase 2. 배치 증분 동기화

1. Outbox Sweep Step 구현: `JpaPagingItemReader` + `FOR UPDATE SKIP LOCKED`.
2. Processor에서 Outbox Payload를 DTO로 변환, Writer에서 upsert.
3. 처리 후 `process_state='DONE'`, `processed_at` 업데이트.
   - 처리 결과를 남겨야 장애 시 “어디까지 처리됐는가?”를 추적할 수 있고, Dead-letter로 이동할 대상도 판단할 수 있습니다.

### Phase 3. 운영 안정화

1. Dead-letter Step 추가, 실패 레코드 별도 테이블 적재.
2. Reconcile Job 작성: Command/Projection row count, hash 비교.
   - 두 수치가 어긋나면 Outbox 배치가 특정 시점에 중단됐다는 근거가 되므로, 재처리 대상 범위를 확정할 수 있습니다.
3. Prometheus Exporter에 배치 지표 등록, Grafana 대시보드 구성.
4. GitHub Actions에서 배치 스케줄 정의 파일 및 애플리케이션을 함께 배포.

---

## 8. 리스크와 대응

| 리스크 | 설명 | 대응 |
| --- | --- | --- |
| Outbox 누락 | API 장애로 Outbox 미기록 | 트랜잭션 내 Outbox 작성, DB 트리거로 보강 |
| 배치 지연 | Outbox 처리 지연으로 읽기 모델 stale | 모니터링 알람, 동적 스케일 아웃, 임시로 Query API가 Primary fallback |
| 리플리카 지연 | 물리 리플리카 사용 시 replication lag | Query API에 타임아웃과 fallback 레이어 추가 |
| 데이터 볼륨 급증 | Outbox 테이블 비대 | 파티셔닝, TTL cleanup 배치 |

---

## 9. 체크리스트

- [ ] Command 트랜잭션 + Outbox 커밋 단위 테스트 완료
- [ ] Projection upsert가 멱등성(idempotent) 보장
- [ ] 배치 재시도/보상 시나리오 문서화
- [ ] 모니터링 대시보드, 알람 규칙 설정
- [ ] 운영팀 핸드북: 장애 유형별 대응 절차 작성

---

## 10. 다음 단계

1. **PoC**: 샘플 도메인(예: 정산 요청)으로 End-to-End 흐름을 2주 이내 구축.
2. **성능 검증**: Outbox 처리량(분당 1만건), Projection 조회 지연(200ms 이하) 목표로 부하 테스트.
3. **운영 이관**: 배치 잡 스케줄과 장애 대응 Runbook을 운영팀에 공유.

이 블루프린트는 메시지 브로커 도입 없이도 CQRS 패턴을 안전하게 운영할 수 있는 최소 단위를 제시합니다. 조직의 성숙도에 따라 Outbox Polling을 Debezium 기반 CDC로 확장하거나, 배치 스케줄러를 Airflow로 교체하는 것도 무리 없이 진행할 수 있습니다.
