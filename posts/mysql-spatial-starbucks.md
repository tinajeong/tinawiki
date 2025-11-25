# 스타벅스 매장과 내 위치와의 거리를 구하기까지

**요약:** 외부 지도 API 없이 MySQL 공간함수를 활용해 위경도 기반의 스타벅스 매장 탐색을 구현하는 과정입니다. 공공데이터에서 매장 좌표를 준비하고, SRID 4326과 공간 인덱스를 활용해 거리 계산을 최적화했습니다.

---

## 1. 상황과 목표

- **Situation:** 사이렌오더 클론을 만들면서 내 위치를 기준으로 가장 가까운 매장을 찾아야 했습니다. 외부 API 호출을 줄여야 서비스 비용과 장애 가능성을 통제할 수 있었습니다.
- **Task:** 위경도를 DB에 저장하고, DB에서 바로 거리를 계산해 가까운 매장을 반환하는 쿼리를 작성합니다. 계산 정확도와 성능을 모두 확보해야 합니다.

---

## 2. 공공데이터에서 좌표 준비하기

`소상공인시장진흥공단_상가업소정보`의 CSV를 지역별로 다운로드한 뒤, Python/pandas로 서울 스타벅스만 필터링해 SQL insert 문을 생성했습니다.

```sql
INSERT INTO stores (stores_id, created_at, updated_at, lot_number_address, store_name, position, road_name_address)
VALUES (
  20585779,
  '2023-01-27T20:53:47.440803',
  '2023-01-27T20:53:47.440803',
  '서울특별시 종로구 동숭동 30',
  '스타벅스동숭로아트점',
  ST_PointFromText('POINT(37.58296442 127.003887)', 4326),
  '서울특별시 종로구 동숭길 110 (동숭동)'
);
```

여기서 `ST_PointFromText('POINT(37.58296442 127.003887)', 4326)`는 문자열로 표현된 좌표를 POINT 타입으로 변환하며, 두 번째 인자로 SRID 4326(WGS84)을 지정합니다.

---

## 3. 위경도와 SRID 4326 정리

- **위도(latitude):** 적도를 기준으로 -90~90 범위.
- **경도(longitude):** 그리니치 자오선을 기준으로 -180~180 범위.
- **SRID 4326:** GPS와 대부분의 지도 서비스가 사용하는 WGS84 지리 좌표계입니다. MySQL 8에서 공간 함수를 사용할 때 SRID를 지정하면 좌표계 불일치를 방지할 수 있습니다.

MySQL의 정의 예시:

```sql
SELECT *
FROM information_schema.st_spatial_reference_systems
WHERE srs_id = 4326;
```

---

## 4. MySQL 공간 타입과 인덱스

- **주요 타입:** `POINT`, `LINESTRING`, `POLYGON`, `MULTI*` 계열, `GEOMETRYCOLLECTION` 등.
- **공간 인덱스:** `SPATIAL INDEX`는 R-tree 기반으로 MBR 포함 관계를 활용해 2차원 범위 쿼리를 빠르게 처리합니다.

```sql
ALTER TABLE stores ADD SPATIAL INDEX (position);
```

---

## 5. 거리 계산 함수 비교

- `ST_Distance(point1, point2)`: 평면 유클리드 거리 계산.
- `ST_Distance_Sphere(point1, point2)`: 지구 곡률을 고려한 대권거리 계산(미터 단위), SRID 4326에서 사용.

예시: 경복궁과 대륭서초타워 사이 거리 계산

```sql
SELECT ST_DISTANCE(
  ST_POINTFROMTEXT('POINT(37.579617 126.977041)', 4326),
  ST_POINTFROMTEXT('POINT(37.492102 127.029795)', 4326)
); -- 약 10.77km

SELECT ST_DISTANCE_SPHERE(
  ST_POINTFROMTEXT('POINT(37.579617 126.977041)', 4326),
  ST_POINTFROMTEXT('POINT(37.492102 127.029795)', 4326)
); -- 약 10.78km
```

---

## 6. 내 위치 기준 가까운 매장 조회 쿼리

위치 입력을 POINT 텍스트로 받아 SRID 4326을 지정하고, 대권거리로 가까운 매장을 필터링합니다. 거리 단위는 미터입니다(1km = 1000m).

```sql
SELECT *
FROM stores
WHERE ST_DISTANCE_SPHERE(
  ST_POINTFROMTEXT(:#{#location.toPointText()}, 4326),
  stores.position
) < :distance;
```

- 서비스 레이어가 계산을 수행하지 않아도 DB가 공간 인덱스로 필터링을 수행합니다.
- 동일한 좌표계를 강제해 계산 오차를 줄입니다.

---

## 7. 정리

MySQL의 공간 데이터 타입과 SRID 4326, 그리고 `ST_Distance_Sphere`만으로도 간단한 위치 기반 매장 검색을 구현할 수 있습니다. 외부 API 없이도 거리 계산과 필터링을 DB에서 처리하면 비용과 복잡성을 줄이면서도 지리 정보를 정밀하게 다룰 수 있습니다.

---

## 참고
- https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=eqfq1&logNo=221457492352
- https://blog.naver.com/tulipjihee/222651161773
- https://support.google.com/maps/answer/18539?hl=ko&co=GENIE.Platform%3DDesktop
- https://hoing.io/archives/5457
- https://developer.android.com/reference/android/location/Location#distanceBetween
- https://en.wikipedia.org/wiki/World_Geodetic_System
- https://youngwoon.tistory.com/3
- https://airtravelinfo.kr/wiki/index.php?title=%EB%8C%80%EA%B6%8C%EA%B1%B0%EB%A6%AC
- https://www.youtube.com/watch?v=9i7ccDN8VVs&t=582
