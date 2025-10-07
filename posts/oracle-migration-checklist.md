## 오라클 전환 시 개발자가 놓치기 쉬운 체크리스트

MSSQL이나 PostgreSQL처럼 ANSI SQL 호환성이 좋은 데이터베이스에서 오라클로 넘어가면 "쿼리만 조금 손보면 되겠지"라는 생각이 금세 무너집니다. 스키마 정의부터 락 전략, 성능 튜닝까지 손봐야 할 부분이 쌓여갑니다. 아래 내용은 Spring Batch 기반 애플리케이션을 오라클 19c 환경으로 마이그레이션하면서 부딪힌 이슈와 학습한 팁을 정리한 것입니다.

---

## 1. 시퀀스 / IDENTITY 마이그레이션 전략

- PostgreSQL의 `SERIAL`, `BIGSERIAL`은 오라클에서 동작하지 않습니다. `SEQUENCE` 객체를 만들고 `NEXTVAL`을 사용하는 것이 정석입니다.
- Hibernate를 사용한다면 `@GeneratedValue(strategy = GenerationType.SEQUENCE)`와 `@SequenceGenerator`를 명시하고, `allocationSize`를 실제 시퀀스 `INCREMENT BY` 값과 맞추어 **헛도는 ID 요청**을 방지합니다.
- 배치 환경에서는 시퀀스를 대량으로 호출할 때 LIO(논리 I/O)가 급증하므로, 필요한 경우 `CACHE` 값을 키워 round-trip을 줄입니다.

```sql
CREATE SEQUENCE TB_SAMPLE_SEQ
    START WITH 1
    INCREMENT BY 1
    CACHE 100;
```

> 캐시 사이즈를 늘리면 인스턴스 장애 시 캐시된 번호가 사라질 수 있습니다. 번호가 건너뛰어도 되는지 미리 비즈니스와 조율하세요.

---

## 2. SQL 문법 차이: LIMIT, UPDATE JOIN, 함수 호환성

### OFFSET / LIMIT → OFFSET … FETCH

- 오라클은 `LIMIT`를 지원하지 않으므로 `OFFSET … ROWS FETCH NEXT … ROWS ONLY`로 바꿉니다.
- 12c 이전 버전에서는 `ROWNUM`을 이용한 이중 서브쿼리 패턴이 필요하므로, 최소 버전 정책을 정리해둡니다.

### UPDATE JOIN → MERGE 또는 서브쿼리

- PostgreSQL의 `UPDATE … FROM`은 오라클에서 `ORA-00933` 오류를 일으킵니다.
- 해결책은 `MERGE` 구문으로 치환하거나, 스칼라 서브쿼리로 각 행의 값을 조회하는 방식입니다.
- `MERGE` 사용 시 `ON` 절이 기본키로 유일 매칭되는지 검증하지 않으면 `ORA-30926` 오류(불안정한 결과 집합)가 발생합니다. 배치 전 테스트 데이터로 **중복 키 상황**을 미리 검증하세요.

### 함수 / 연산자 호환성

- `string_agg` → `LISTAGG(컬럼, ',') WITHIN GROUP (ORDER BY …)`
- `ilike` → `WHERE UPPER(col) LIKE UPPER(:keyword)`
- 정규표현식은 `REGEXP_LIKE`, `REGEXP_SUBSTR`로 대체 가능하지만 성능이 민감할 수 있으므로 인덱스 컬럼에는 사용을 피합니다.

---

## 3. 데이터 타입 매핑

| PostgreSQL | Oracle 대체안 | 비고 |
|------------|---------------|------|
| BOOLEAN | `CHAR(1)` 또는 `NUMBER(1)` | Enum/Converter로 `Y/N` ↔ `true/false` 매핑 |
| SERIAL/BIGSERIAL | `NUMBER`, `SEQUENCE` | PK는 `NUMBER(19)` 권장 |
| TEXT | `CLOB` | 4000자 이상이면 반드시 CLOB |
| JSONB | `CLOB` + `JSON_OBJECT_T` | 21c 이상이면 `JSON` 타입 활용 |

- 오라클의 `DATE`는 **시분초**를 포함합니다. PostgreSQL의 `DATE`와 동일하다고 가정하면 데이터 비교 로직이 어긋납니다.
- 타임존이 필요한 경우 `TIMESTAMP WITH TIME ZONE`을 사용하고, JDBC 드라이버의 `oracle.jdbc.timezoneAsRegion=false` 설정 여부를 확인합니다.

---

## 4. 동시성 제어와 트랜잭션 차이

- PostgreSQL과 달리 오라클은 `SELECT FOR UPDATE`가 인덱스 조건을 충족하는 **모든 행을 잠글 수** 있습니다. 조건절이 잘못되면 테이블 전체가 락 걸립니다.
- 오라클의 기본 격리 수준은 `READ COMMITTED`입니다. UNDO 영역 덕분에 항상 일관된 읽기(Consistent Read)를 보장합니다.
- `SERIALIZABLE` 격리 수준은 갭 락(Gap Lock)을 사용하지 않고, 대신 `ORA-08177` 오류로 충돌을 알립니다. 따라서 재시도 로직을 반드시 준비해야 합니다.
- Spring Batch의 JobRepository는 기본적으로 `SERIALIZABLE` 격리 수준으로 설정됩니다.
- 오라클에서는 대량 실행 시 경합이 잦으므로 `READ_COMMITTED`로 낮추는 실험을 권장합니다. 충돌 감지는 애플리케이션 레이어에서 재시도 정책으로 보완하세요.

---

## 5. 성능 최적화 포인트

### 페이징 전략

- OFFSET 기반 페이징은 오라클에서도 뒤 페이지로 갈수록 느려집니다. `keyset pagination`(예: `WHERE id > :lastId`)으로 전환하고, 정렬 컬럼에 인덱스를 구성합니다.
- 배치 작업에서는 `ROWNUM` 기반 임시 테이블을 만들어 배치 범위를 나누는 것도 방법입니다.

### 통계와 힌트

- 오라클은 실행 계획을 위해 `DBMS_STATS`의 테이블/인덱스 통계를 적극적으로 활용합니다. 배포 파이프라인에 `DBMS_STATS.GATHER_TABLE_STATS` 작업을 포함시켜 최신 통계를 유지하세요.
- 옵티마이저가 잘못된 계획을 선택하면 `/*+ INDEX(table index_name) */`, `/*+ PARALLEL(table 4) */` 같은 힌트를 통해 실행 계획을 강제할 수 있습니다. 힌트를 남발하기보다 **SQL Plan Baseline** 기능으로 특정 계획을 고정하는 방법도 함께 고려합니다.

### TEMP / UNDO / REDO 용량 확인

- PostgreSQL보다 오라클은 TEMP, UNDO, REDO 테이블스페이스 용량에 민감합니다. 대량 배치 시 TEMP 부족으로 `ORA-01652` 오류가 발생할 수 있으니, 운영 전 체크리스트에 용량 모니터링을 포함합니다.

---

## 6. JPA & Spring Batch 연동 팁

- Hibernate Dialect는 최소 `Oracle12cDialect` 이상을 사용하고, `hibernate.jdbc.time_zone`을 명시하여 세션 타임존을 일관되게 유지합니다.
- 대량 `MERGE`는 JDBC batch 업데이트보다 `SqlParameterSource`를 이용한 `NamedParameterJdbcTemplate`이 효율적이었습니다. 오라클은 1000개 이상의 값이 들어가는 `IN` 절에 제약이 있으므로, 파라미터 분할 유틸리티를 미리 구현해두면 편합니다.
- `BULK INSERT`를 위해 Spring Batch의 `JdbcBatchItemWriter`를 사용할 때는 `oracle.jdbc.defaultNChar=false` 설정과 `setJdbcBatchSize` 값을 맞춰줘야 LOB 처리 성능이 안정됩니다.

---

## 7. 운영 환경 고려사항

- **권한/테이블스페이스**: 오라클은 사용자(User)와 스키마가 1:1 대응합니다. 개발·운영 분리 시 테이블스페이스 할당량, 롤(Role), 프로파일(Profile) 정책을 DBA와 함께 정의해야 합니다.
- **백업/로그**: Redo 로그 스위칭 간격이 너무 짧으면 성능이 떨어지므로, 배치 시간대에 맞춰 로그 파일 크기를 조정합니다. 아카이브 로그가 찰 경우 데이터베이스가 멈출 수 있으므로 모니터링 알람을 설정합니다.
- **모니터링**: `AWR`, `ASH` 리포트를 활용해 CPU, I/O, 락 대기 지표를 주기적으로 확인하세요. PostgreSQL의 `pg_stat_activity`와는 접근 방식이 다릅니다.

---

## 8. 체크리스트 요약

1. 시퀀스 전략과 캐시 정책을 먼저 정한다.
2. 쿼리 호환성(OFFSET, MERGE, 함수)을 점검한다.
3. 데이터 타입 매핑과 타임존 정책을 문서화한다.
4. 락/트랜잭션 동작을 사전 검증하고 재시도 정책을 구현한다.
5. 통계 수집, 힌트, TEMP/UNDO 용량 등 성능 요소를 튜닝한다.
6. JPA/Spring Batch 설정과 JDBC 제약을 재검토한다.
7. 운영 정책(권한, 백업, 모니터링)을 다시 설계한다.

새로운 DB로의 전환은 단순 쿼리 변환을 넘어 **생태계 전체를 새로 이해하는 작업**입니다. 위의 체크리스트가 오라클 전환을 준비하는 개발자들에게 시행착오를 줄이는 데 도움이 되길 바랍니다.
