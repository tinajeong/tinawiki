# 스타벅스 매장과 내 위치와의 거리를 구하기까지

> **요약:** 외부 지도 API 없이 MySQL 공간함수를 활용해 위경도 기반의 스타벅스 매장 탐색을 구현하는 과정입니다. 공공데이터에서 매장 좌표를 준비하고, SRID 4326과 공간 인덱스를 활용해 거리 계산을 최적화했습니다.

![내위치와스타벅스사이의거리](/assets/images/distance_sphere.jpg)

---

스타벅스 사이렌오더 클론코딩을 진행했습니다. 사이렌오더를 통해 음료를 주문하려면 내 위치를 기준으로 주변의 매장을 조회합니다.

카카오지도 등을 이용한 api로 거리를 산출하는 방법도 있었지만 외부 api 없이, 위경도 기준의 거리를 산출하는 스타벅스처럼, mysql의 공간함수를 이용해 위경도 기준의 매장과 내 위치 간 거리를 구해보았습니다.

또한 서비스 로직으로 위경도 계산을 넣지 않은 이유는 db단 처리보다 비효율적이기 때문입니다. db에서는 공간인덱스*spatial index*를 사용할 수 있습니다.

---

## 공공데이터에서 스타벅스 매장 정보를 받아오기

먼저 공공데이터 포털의 `소상공인시장진흥공단_상가업소정보`를 다운로드 받았습니다. 2022년 10월 30일에 업데이트된 데이터입니다. 지역별로 업소 정보가 구분된 csv 파일을 받을 수 있습니다. python과 pandas 라이브러리를 통해 서울의 스타벅스 매장만 추출하고, sql문을 생성했습니다.

```sql
insert into
stores (stores_id,
created_at,
updated_at,
lot_number_address,
store_name,
position,
road_name_address)
values
(20585779,
'2023-01-27T20:53:47.440803',
'2023-01-27T20:53:47.440803',
'서울특별시 종로구 동숭동 30',
'스타벅스동숭로아트점',
ST_PointFromText('POINT(37.58296442 127.003887)', 4326),
'서울특별시 종로구 동숭길 110 (동숭동)');

```

그런데 `ST_PointFromText('POINT(37.58296442 127.003887)', 4326)` 이 부분의 의미는 무엇일까요?

### `ST_PointFromText('POINT(37.58296442 127.003887)', 4326)`

먼저, `ST_PointFromText`은 은 Mysql에서 제공하는 함수 중 하나로, 텍스트 형식으로 표현된 좌표를 POINT 타입의 객체로 변환해주는 함수입니다. Mysql에서 위경도를 저장할 때는 `POINT` 타입을 사용하기 때문입니다.

그래서 `ST_PointFromText('POINT(37.58296442 127.003887)'`는 위도가 `37.58296442`이고 경도가 `127.003887`인 위치를 저장하게됩니다.

함수의 두번째 인자인 4326은 좌표계의 종류를 지정한 것입니다. mysql 8버전부터 지원합니다. default 값은 평면좌표계인 0이고, 4326을 넣으면 위경도를 표시하는데 사용되는 `WGS84 좌표계`를 사용한다는 의미입니다.

이제 관련 개념을 보다 자세히 알아보겠습니다.

---

## 위경도

![위경도](https://media.proprofs.com/images/QM/user_images/2503852/New%20Project%20-%202020-06-19T162820_671.jpg)

### 위도 _latitude_

위도는 적도*Equator*를 기준으로 -90부터 90까지의 값으로 표현합니다. 북극은 최대값인 90도를, 남극은 최소값인 -90을 가집니다.

### 경도 _longitude_

경도는 그리니치 천문대*Prime Meridian*를 기준으로 -180부터 180까지의 값으로 표현됩니다. 서쪽의 끝은 -180를, 동쪽의 끝은 180이라는 값을 가집니다.

> 주의 : 좌표계에 따라 동일한 위치라도 다른 범위와 다른 값을 가질 수 있습니다.

---

## SRID

### Spatial Reference IDentifier (SRID)

공간 데이터를 어떤 좌표계로 표현할지를 나타내는 **번호**입니다. SRID는 공간 데이터의 위치와 방향을 결정하는 데 사용됩니다. 서로 다른 SRID를 가진 데이터는 같은 좌표를 나타내더라도 서로 다른 위치로 인식될 수 있습니다

대표적인 srid에는 0, 3857, 4326이 있습니다.

- srid 0 : 평면 좌표계

- srid 3857 : 웹 기반 지도 좌표계

- srid 4326 : WGS84 지리 좌표계

### SRID 4326

일반적으로 GPS 좌표는 WGS84 좌표계를 사용합니다. World Geodetic System의 약자로 1984년에 만들어진 버전이 여러 분야에서 표준으로 사용됩니다. 구글 맵과 안드로이드 GPS도 해당 좌표계를 사용하고 있습니다.

안드로이드의 `distanceBetween`함수에 대한 설명입니다.

> Computes the approximate distance in meters between two locations,

> and optionally the initial and final bearings of the shortest path between them.

> Distance and bearing are defined using the **WGS84** ellipsoid.

mysql에서도 srid 4326인 WGS84 좌표계에 대한 지원을 하는 것을 확인할 수 있습니다.

```bash

mysql> select * from information_schema.st_spatial_reference_systems

where srs_id=4326\G

*************************** 1. row ***************************

                SRS_NAME: WGS 84

                  SRS_ID: 4326

            ORGANIZATION: EPSG

ORGANIZATION_COORDSYS_ID: 4326

              DEFINITION: GEOGCS["WGS 84",DATUM["World Geodetic System 1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.017453292519943278,AUTHORITY["EPSG","9122"]],AXIS["Lat",NORTH],AXIS["Lon",EAST],AUTHORITY["EPSG","4326"]]

             DESCRIPTION: NULL

1 row in set (0.01 sec)

```

---

## mysql 공간 관련 함수

공간 데이터 타입*spatial data type*에 대해 공간함수*spatial function*를 사용할 수 있습니다.

### mysql spatial data type

앞서 언급한 `POINT` 타입 외에도 다양한 공간 데이터 타입이 존재합니다. 간략히 표로 정리해보았습니다.

| Spatial Data Type | 설명 |
| --- | --- |
| GEOMETRY | 어떤 타입의 공간 데이터도 표현할 수 있는 일반적인 공간 데이터 타입 |
| POINT | 점을 표현하는 데이터 타입 |
| LINESTRING | 선을 표현하는 데이터 타입 |
| POLYGON | 다각형을 표현하는 데이터 타입 |
| MULTIPOINT | 여러 개의 점을 표현하는 데이터 타입 |
| MULTILINESTRING | 여러 개의 선을 표현하는 데이터 타입 |
| MULTIPOLYGON | 여러 개의 다각형을 표현하는 데이터 타입 |
| GEOMETRYCOLLECTION | 여러 개의 GEOMETRY 객체를 모아서 표현하는 데이터 타입 |

### mysql spatial index

spatial index는 1차원 데이터를 다루는 일반적인 B-tree 같은 인덱스와는 다르게 R-tree라는 특수한 인덱스를 사용합니다. R-tree 인덱스는 2차원의 공간 데이터의 범위 쿼리를 빠르게 처리할 수 있습니다. R-tree는 MBR*Minimum Bounding Rectangle*의 포함 관계를 이용해 만들어집니다.

#### R-tree의 구성

상위 레벨의 MBR이 하위 레벨의 MBR을 포함하는 형태로 트리를 구성합니다.

![R-tree](https://cglab.ca/~cdillaba/comp5409_project/images/rtree.png)

mysql에서는 SPATIAL 키워드를 붙여 공간 데이터 타입에 대해 공간인덱스를 생성할 수 있습니다.

```sql
ALTER TABLE stores ADD SPATIAL INDEX(position);
```

### mysql에서 두 지점 사이의 거리를 계산하는 함수

#### ST_Distance(point1, point2)

`ST_Distance` 함수는 두 지점 간의 유클리드 거리(Euclidean distance)를 계산합니다. 이 함수는 위도와 경도 정보를 입력받아, 두 지점 사이의 거리를 직선 거리로 계산합니다. 즉, 지구가 구 형태라는 가정 없이 두 점 사이의 직선 거리를 계산합니다.

아래는 대륭서초타워와 경복궁 사이의 거리를 계산한 결과입니다.

```sql

select ST_DISTANCE(

    ST_POINTFROMTEXT('POINT(37.579617 126.977041)', 4326),

    ST_POINTFROMTEXT('POINT(37.492102 127.029795)', 4326)); # 10774.269144933427 -> 약 10.77km

```

#### ST_Distance_Sphere(point1, point2)

`ST_Distance_Sphere` 함수는 **두 지점 간의 최단 구면 거리**를 계산합니다.

위도와 경도 정보를 입력받아 대권거리(Great-circle distance)을 이용하여 거리를 계산합니다. 대권거리는 지구의 곡면을 고려한 거리 계산 방법으로, 대부분의 지도 관련 서비스에서 사용합니다. 몇 개 예시를 계산해본 결과 카카오맵 등의 지도 서비스의 경우 길찾기를 하지 않을 경우 미리보기 거리를 대권거리로 보여주는 듯합니다.

아래는 대륭서초타워와 경복궁 사이의 거리를 계산한 결과입니다.

```sql

select ST_DISTANCE_SPHERE(
    ST_POINTFROMTEXT('POINT(37.579617 126.977041)', 4326),
    ST_POINTFROMTEXT('POINT(37.492102 127.029795)', 4326)); # 10785.824425547744 -> 약 10.78km

```

---

## 내 위치와 스타벅스 매장사이 거리는?

드디어! 내 위치 기준으로 가까운 스타벅스 매장들을 불러올 수 있습니다.

앞서 언급했듯이 구면체 상의 두 점 간의 거리를 계산하기 위해서는 `st_distance_sphere()` 함수를 사용하면 됩니다.

> 해당 함수는 srid 4326인 경우만 지원하기 때문에 데이터 저장시에 srid 4326를 명시해주었습니다. 그래서 두번째 인자에서 4326을 명시할 필요가 없습니다.

> distance 인자에는 미터 단위로 거리를 입력해야 합니다. 1km = 1000m

```sql

SELECT * FROM stores

WHERE ST_DISTANCE_SPHERE(
    ST_POINTFROMTEXT(:#{#location.toPointText()}, 4326),
    stores.position) < :distance
```

## References

- https://m.blog.naver.com/PostView.naver?isHttpsRedirect=true&blogId=eqfq1&logNo=221457492352
- https://blog.naver.com/tulipjihee/222651161773
- https://support.google.com/maps/answer/18539?hl=ko&co=GENIE.Platform%3DDesktop
- https://hoing.io/archives/5457
- https://developer.android.com/reference/android/location/Location#distanceBetween
- https://en.wikipedia.org/wiki/World_Geodetic_System
- https://youngwoon.tistory.com/3
- https://airtravelinfo.kr/wiki/index.php?title=%EB%8C%80%EA%B6%8C%EA%B1%B0%EB%A6%AC
- https://www.youtube.com/watch?v=9i7ccDN8VVs&t=582
