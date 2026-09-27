# 동물 이미지 스타일 시안

[비교 페이지](../public/style-studies/index.html)에서 A~E 스타일의 레서팬더와 크라운피시를 나란히 볼 수 있다. 사용자가 D의 부직포·종이 느낌을 선택했으며, 이를 기준으로 [최종 동물 이미지 10종](FINAL_ART.md)을 제작해 게임에 적용했다.

제작 방식은 내장 `image_gen`이다. 각 동물을 별도 프롬프트로 생성했으며 10개 PNG 모두 실제 투명 알파가 있다. 원본은 `public/style-studies/land-a.png`부터 `sea-e.png`까지 저장했다.

## 공통 프롬프트 조건

- 용도: 어린이용 웹게임의 작은 캐릭터 스프라이트, 48px에서도 종과 형태가 구별되어야 함.
- 육상: 레서팬더 한 마리, 머리가 이미지 위쪽을 향하는 위에서 본 전신, 네 발과 줄무늬 꼬리. 위에서 본 시점은 유지하면서 눈이 읽히도록 머리를 약간 든다.
- 물속: 크라운피시 한 마리, 오른쪽을 향하는 옆모습 전신, 지느러미·꼬리·주황 몸통·흰 줄무늬 세 개·눈이 보임.
- 중앙 배치, 충분한 투명 여백, 진짜 투명 배경. 배경·바닥·물·그림자·글자·테두리 프레임·추가 동물·워터마크 제외.

## 스타일별 프롬프트 차이

| 코드 | 제작 프롬프트의 스타일 지시 |
| --- | --- |
| A | Polished bold flat 2D arcade sticker; rounded shapes, strong silhouette, warm cream outline, restrained cel shading. |
| B | Gentle hand-painted children's storybook gouache; soft pastels, subtle brush texture, rounded anatomy, light cream edge, no hard black outlines. |
| C | Premium soft 3D clay toy render; rounded proportions, slightly glossy tactile surface, bright gentle studio illumination. |
| D | Layered cut paper and soft felt appliqué; hand-cut rounded edges, subtle paper fiber, preschool craft aesthetic. |
| E | Ultra-simple chibi 2D game icon; bold smooth dark brown outline, flat color blocks, expressive minimal detail. |

각 수중 프롬프트에는 같은 코드의 육상 스프라이트와 한 게임의 시각적 가족으로 맞추라는 조건을 추가했다. 각 육상 프롬프트에는 직접 내려다본 시점, 머리 위쪽 방향, 네 발과 꼬리, 작은 크기 가독성을 반복해 지정했다.
