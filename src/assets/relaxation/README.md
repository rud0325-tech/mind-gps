# 편안한 이완훈련 배경과 타입캐스트 음성 영상

- `relaxation-poses-calm.png`: 기존 `relaxation-poses.png`의 학생·옷·시범 자세를 유지하면서 빈백, 식물, 둥근 쿠션이 있는 배경으로 편집한 그림입니다. 당시 기본 제공 이미지 생성 도구를 사용했으며 원본은 보관합니다. 이번 음원 교체에서는 이미지를 새로 생성하거나 편집하지 않았습니다.
- `relaxation-poses-calm.webp`: 앱 화면이 불러오는 같은 그림의 WebP 사본입니다(품질 90, 약 190KB). 영상 제작 스크립트는 PNG 원본을 그대로 씁니다. 그림을 바꾸면 두 파일을 함께 바꿉니다.
- `relaxation-typecast-guide.mp4`: **앱에서 사용하는 현재 영상**입니다. 사용자가 제공한 새 Typecast 녹음 중 대본 18–30번의 13문장을 연결했습니다. 원속도 구간 합계는 41.52초이고, `atempo=0.875`로 음높이를 유지하며 속도를 낮춘 목표 길이는 **47.451429초**입니다. H.264/AAC MP4이며 기존 영상에서 추출한 네 화면을 그대로 사용합니다.
- 현재 영상은 **시범 그림을 한 장씩** 편한 자세 → 힘 빼기 → 들이쉬기 → 내쉬기 순서로 보여 줍니다. 각 화면의 번호와 파란색 현재 단계 강조를 유지했습니다. 연속 동작 영상은 아니며, 그림이 유지되는 시간은 해당 안내를 읽는 시간입니다. 그 시간만큼 숨을 들이쉬거나 내쉬어야 한다는 뜻은 아닙니다.
- 그림 전환은 원본 WAV의 확인된 문장 구간을 합산하고 0.875로 나눈 시점을 기준으로 합니다. 기존의 동일한 간격 전환을 사용하지 않습니다. 실제 영상은 60fps 프레임 경계로 반올림되어 기준 시점과 최대 약 7.2ms 차이가 있습니다.

| 화면 | 대본 문장 번호 | 실제 영상 시작 시점 |
| --- | --- | --- |
| 편한 자세 | 18–21 | 0초 |
| 힘 빼기 | 22–24 | 16.516667초 |
| 들이쉬기 | 25–27 | 26.350001초 |
| 내쉬기 | 28–30 | 37.466668초 |

- `public/relaxation-captions.ko.vtt`: 위 13문장의 **실제 녹음 대본 자막**입니다. 원문을 바꾸지 않았으며, 각 WAV 구간의 누적 길이와 재생 속도로 계산한 시간을 1ms 단위로 기록합니다. `captions` 트랙으로 연결하고 **기본은 꺼짐**입니다. 독립된 ‘자막 켜기/자막 끄기’ 버튼으로 재생 상태와 별개로 조절하며, 영상 기본 자막 메뉴의 선택도 버튼 상태에 반영합니다.
- `public/relaxation-guide.ko.vtt`: 이전 네 그림의 시각적 설명을 보존한 파일입니다. 녹음 대본 자막이 아니며 현재 영상에는 연결하지 않습니다.
- 영상은 사용자가 재생하며 재생·일시정지·탐색·음량 조절을 지원합니다. 영상 시청만으로 활동을 자동 완료하지 않습니다. 영상이 열려 있으면 별도 활동 안내 음성과 속도 버튼을 숨기고, 영상 재생 전에 별도 안내를 일시정지하여 소리가 겹치지 않도록 합니다.
- 그림 화면의 ‘활동 안내 듣기’는 `getRecordedGuide('guide_relax', ...)`로 확인된 새 `src/assets/tts/recorded/guide_relax.mp3`를 우선 사용합니다. 새 녹음이 없을 때는 이전 `src/assets/tts/guide_relax.mp3`로 대체하며 영어 안내는 기존 기기 음성 경로를 유지합니다.
- `relaxation-typecast-guide.json`: 이번 제작의 원본 구간·샘플 위치·자막·그림 전환·파일 해시·기술 검증 결과입니다. FFmpeg로 완성 파일의 영상과 음원을 전체 디코딩했으며, 디코딩된 음원 길이는 47.445333초입니다. 네 화면의 원본 대비 PSNR은 모두 42dB 이상이고, 마지막 구간의 낮은 음량도 확인했습니다. 원문·순서 및 ASR 대조와 기술 검증을 수행한 것으로, 모든 음성을 사람이 전부 청취해 확인했다는 뜻은 아닙니다. 기기별 실제 재생과 자막 조작은 별도 화면 검증 대상입니다.
- `relaxation-picture-guide.webm`: 이전 28초 무음 영상입니다. 보존용이며 앱에서 재생하지 않습니다.

## 현재 영상 다시 만들기

작업공간 `new-chat` 기준 재생성 스크립트는 `outputs/MindGPS_Typecast_음원반영_20261009/build-relaxation-recorded-video.py`입니다. 같은 폴더의 `tools-env/bin/python`, `source/part-1.wav`, `segments-candidate.json`을 사용합니다. FFmpeg는 이 도구 환경의 `imageio_ffmpeg`에 포함된 실행 파일을 사용하므로 시스템 FFmpeg 설치가 필요하지 않습니다.

작업공간 `new-chat`에서 다음 순서로 실행합니다.

```sh
outputs/MindGPS_Typecast_음원반영_20261009/tools-env/bin/python outputs/MindGPS_Typecast_음원반영_20261009/build-relaxation-recorded-video.py
outputs/MindGPS_Typecast_음원반영_20261009/tools-env/bin/python outputs/MindGPS_Typecast_음원반영_20261009/build-relaxation-recorded-video.py --install
```

첫 실행은 `relaxation-staging/`에만 제작합니다. 이 폴더에는 이전 MP4와 메타데이터, 추출한 네 화면, 원속도 합본 WAV, 0.875배 WAV, 새 MP4/VTT/JSON, 디코딩 음원, 검증 화면과 로그가 남습니다. 전체 디코딩·문장 일치·음원 길이·그림 보존·전환 시간을 검사한 뒤, `--install`이 검증 결과와 파일 해시를 다시 확인하고 앱의 MP4/JSON/VTT를 교체합니다. 기존 앱과 음원 백업은 같은 출력 폴더의 `before-source-and-audio.zip`에 있습니다.

## 이전 제작기

`scripts/build-relaxation-video.py`는 **과거 버전 제작기**입니다. 브라우저 Canvas·AudioContext·MediaRecorder와 이전 전체 안내 음원을 사용해 약 42초 영상을 만들던 경로로, 이번 실제 문장 구간·새 녹음·자막 시간표를 반영하지 않습니다. 보존용으로 두며 현재 영상을 다시 만들 때는 위 출력 폴더의 새 스크립트를 사용합니다.

## 이미지 생성에 사용한 최종 프롬프트

Use case: precise-object-edit. Edit target: supplied 2x2 illustrated relaxation pose sheet for MindGPS educational app. Preserve the same friendly Korean school-age boy's identity, clothing, style and the four instructional poses in reading order: 1 feet on floor hands on knees eyes open, 2 shoulders lowered hands loosely open, 3 one hand on chest one on belly relaxed inhale with subtle blue arrow, 4 hand on belly relaxed exhale with subtle blue arrow. All full body visible including feet. Main request: replace rigid classroom desks and boxy bookshelves in all panels with a warm calm relaxation corner: a soft sage/cream beanbag in the background, rounded cushions, soft rounded rug, indoor leafy green plants and diffused daylight with gentle cream curtains. The boy remains sitting upright on a simple stable rounded upholstered chair with both feet resting on floor; the beanbag is background only, never obscures hands/feet. Keep person large and visually clear, same camera and scene across all panels; uncluttered low detail background, no extra people, no text or labels or numbers, no watermark. Output a perfectly square sheet, EXACT equal 2 by 2 square panels separated at 50% width and 50% height by a thin light gutter, no outer margins; backgrounds can differ only as necessary for the preserved poses. Natural calm proportions and anatomy, fingers clear, no exaggerated deep breaths or strained neck. Soft high quality illustrated rendering matching input.

출력은 원본과 같은 비율의 구분선을 유지하여, 앱에서는 실제 칸 경계에 맞춰 표시합니다.
