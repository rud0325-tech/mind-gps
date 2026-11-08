# NOTICE

이 저장소의 코드·문서·그림·음성·영상에 대한 모든 권리는 저작권자에게 있습니다([LICENSE](LICENSE) 참고). 아래는 미디어의 출처와, 함께 담은 외부 구성 요소의 라이선스입니다.

## 미디어 출처

### 안내 음성과 이완훈련 영상의 음성

- 위치: `src/assets/tts/`, `src/assets/relaxation/relaxation-typecast-guide-audio.mp3`, `src/assets/relaxation/relaxation-typecast-guide.mp4`
- 제작: Typecast (https://typecast.ai/kr), 무료 플랜
- Typecast 무료 플랜으로 만든 음성은 비상업적 용도로만 쓸 수 있으며 출처를 밝혀야 합니다. 상업적으로 쓰려면 유료 플랜에서 다시 받아야 합니다.

### 그림과 소리

- 캐릭터, 칭찬 그림, 배경, 응원 카드, 이완훈련 시범 그림(`src/assets/characters/`, `src/assets/encouragement/`, `src/assets/relaxation/`, `src/assets/*_background.webp`)은 AI 이미지 생성 도구(Google Gemini의 Nano Banana 등)로 만들었습니다.
- 마음의 소리 배경음(`src/assets/audio/`)은 AI 도구로 만들었습니다.

## 함께 담은 외부 구성 요소

시간표 사진·PDF를 읽는 기능을 위해 아래 파일을 함께 담았습니다. 각 파일은 원래의 라이선스를 따릅니다.

| 위치 | 출처 | 라이선스 |
| --- | --- | --- |
| `public/ocr/core/` | tesseract.js-core | Apache-2.0 (`public/ocr/core/LICENSE`) |
| `public/ocr/worker.min.js` | tesseract.js | Apache-2.0, 포함된 구성 요소는 `worker.min.js.LICENSE.txt` 참고 |
| `public/ocr/lang/kor.traineddata.gz` | Tesseract 한국어 학습 데이터 (tessdata) | Apache-2.0 |
| `public/ocr/cmaps/` | PDF.js 문자표 (Adobe) | `public/ocr/cmaps/LICENSE` |
| `public/ocr/standard_fonts/` | PDF.js 기본 글꼴 (Foxit, Liberation) | `LICENSE_FOXIT`, `LICENSE_LIBERATION` |

---

## English

- All rights reserved for the code, documents, images, audio and video in this repository. See [LICENSE](LICENSE).
- Voice files (`src/assets/tts/`, and the relaxation guide audio and video in `src/assets/relaxation/`) were made with the Typecast (https://typecast.ai/kr) free plan, which allows non-commercial use only and requires attribution. Commercial use requires downloading them again on a paid plan.
- Characters, praise images, backgrounds, encouragement cards and relaxation illustrations were made with AI image tools (including Google Gemini's Nano Banana). Calming background sounds in `src/assets/audio/` were made with AI tools.
- Third-party OCR components in `public/ocr/` keep their own licenses, listed in the table above.
