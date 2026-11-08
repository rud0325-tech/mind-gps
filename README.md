# 마음 G.P.S. 3.0 (Mind G.P.S.)

**누구나 스스로 배우고 쓰는 사회정서학습(SEL) 웹앱.** 현직 특수교사가 바이브 코딩으로 만들고, 실제 수업에서 쓰며 고쳐 온 앱입니다.

*A social-emotional learning (SEL) web app for everyone, built and refined in real classrooms by a special education teacher using vibe coding. English summary below.*

> **이 저장소는 체험판 정리본입니다.** 기본 설정이 체험 모드라 학생 기록을 저장하지 않고 알림도 보내지 않습니다. 실제 학교 운영판의 연결 정보는 들어 있지 않습니다.
>
> **안내** 정서 지원 교육 도구이며 의료·치료 도구가 아닙니다. 학생이 위기 상황이라면 학교의 위기 대응 절차를 따르세요.

**[체험해 보기](https://rud0325-tech.github.io/mind-gps/)** · [만든 사람: 김윤경 (LinkedIn)](https://www.linkedin.com/in/yungyeongkim/)

<!-- 소개 영상이 준비되면 위 줄에 링크를 추가하세요. -->
<!-- 스크린샷: docs/images 폴더에 학생 정보가 없는 화면을 넣고 아래 줄의 주석을 푸세요. -->
<!-- ![마음 G.P.S. 3.0 화면](docs/images/screenshot-main.png) -->

---

## 왜 만들었나요

교실에서는 긍정적 행동지원으로 학생들이 조금씩 달라졌습니다. 그런데 주말과 방학이 지나면 배운 것이 잘 이어지지 않았고, 학생 곁에 늘 있는 건 교사가 아니라 휴대폰과 태블릿이었습니다.

그래서 기기를 빼앗는 대신, 기기 안에 더 좋은 선택지를 넣기로 했습니다. 해결책은 세 조건을 모두 채워야 했습니다.

1. 효과를 확인해 온 증거기반 교수와 긍정적 행동지원을 담는다.
2. 시간과 장소에 상관없이 혼자서도 반복할 수 있다.
3. 어떤 기기에서든 쉽게 열리고, 영상보다 끌리는 동기가 있다.

## 무엇을 하나요

**학생 흐름:** 캐릭터 고르기 → 지금 감정과 크기(1~5단계) 확인 → 정서 조절 활동 → 활동 뒤 감정 다시 확인 → 칭찬

| 전략 | 하는 일 | 영역 |
| --- | --- | --- |
| 나-전달법 (I-Message) | 상황·감정·바람을 말로 표현하기 | 소통 |
| 생각 바꾸기 (REBT) | 상황을 다르게 바라보기 | 인지 |
| 이완훈련 | 몸의 긴장 풀기 | 신체 |
| 마음의 소리 | 원하는 소리를 들으며 쉬기 | 감각 |

평소에는 말과 생각으로, 감정이 클 때는 몸과 감각으로 먼저 조절합니다.

**교사 화면:** 반과 학생 별칭 관리, 교실 공용 태블릿 지정, 활동 전후 감정과 교사 관찰 기록, 학생 성장 보고서, CSV 내보내기. 기록을 읽는 기준은 [교사 결과 기록 안내](docs/TEACHER_OUTCOMES.md)에 정리했습니다.

**3.0에서 달라진 점**

- '좋아요'·'편안해요' 감정 추가
- 활동 뒤 마음을 다시 확인해 활동 전후 변화를 기록
- 나-전달법 게임, 감정 선택 건너뛰기, 마음의 소리 전체화면
- 오늘의 긍정 메시지
- 영어 선택
- 기록 저장을 Firebase로 옮기고 교사 Google 로그인 적용

## 누구나 쓸 수 있게: 보편적 학습설계와 웹 접근성

- **세 가지 보기 방식:** 문장 / 그림과 단어 / 그림 (CAST UDL 3.0 기반), 큰 글씨, 한국어·영어
- **색에 의존하지 않는 표시:** 감정의 크기를 숫자와 크기로도 보여 줍니다.
- **키보드·스위치 조작:** 탭과 엔터로 화면을 이동합니다.
- **소리는 사용자가 직접:** 누를 때만 재생되고 멈출 수 있습니다.
- **음성 안내 버튼:** 화면마다 할 일을 소리로 알려 줍니다.

검토 기준은 [UDL·웹 접근성 체크리스트](docs/UDL_ACCESSIBILITY_CHECKLIST.md)와 [미디어 접근성 점검](docs/MEDIA_ACCESSIBILITY_AUDIT.md)에 있습니다.

## 운영판의 개인정보 보호·알림 설계

아래는 자체 Firebase 프로젝트와 Apps Script를 연결해 운영할 때 적용되는 설계입니다. 공개 체험판에서는 실제 학생 기록을 저장하거나 교사에게 알림 메일을 보내지 않습니다.

| 기능 | 공개 체험판 | 운영판 연결 시 |
|---|---|---|
| 학생 학습 활동 | 체험 가능 | 사용 가능 |
| 활동 기록 | 브라우저 메모리에만 유지되며 새로고침하면 초기화 | 자체 Firebase에 저장 |
| 교사 화면 | 로그인 없이 체험 | 승인된 교사의 Google 로그인 사용 |
| 교사 알림 메일 | 발송하지 않음 | 서버 설정 후 발송 |

- 이름이나 학번 대신 캐릭터와 교사만 아는 별칭(S01 등)을 씁니다. 실명은 앱에 넣지 않습니다.
- 학생은 계정 입력 없이 익명 로그인으로 씁니다. 기록은 운영자가 승인한 교사만 Google 로그인으로 보고, 교사는 담당 반 기록만 볼 수 있습니다.
- 부정적인 감정의 크기 5단계를 고르거나 '도움 요청'을 누르면 교사에게 알림 메일이 갑니다. 메일 서버(Apps Script)가 로그인 정보와 기록을 다시 확인한 뒤 보내며, 받는 사람은 학생 화면에서 바꿀 수 없습니다.
- 데이터베이스(Firestore)에는 보안 규칙을 적용했고, 규칙도 자동 테스트로 확인합니다(`tests/rules`).
- 비밀번호나 관리자 키는 코드에 넣지 않습니다.

**다른 학교에서 쓰려면** 학교운영위원회 심의, 보호자 동의, 연령별 허용 범위를 먼저 확인하세요.

## 어떻게 만들었나요

학생에게 필요한 기능과 학습 흐름을 정의하고, AI 도구를 활용해 앱으로 구현했습니다. 수업에서 직접 사용하며 어려운 지점을 관찰하고, 수정할 기능의 우선순위를 정해 개선했습니다. 기능을 바꾼 뒤에는 기존 학습 흐름이 유지되는지도 함께 확인했습니다.

| 단계 | 도구 | 한 일 |
| --- | --- | --- |
| 기획 | Gemini 노트북 | UDL 지침, 중재 전략, 교육과정 자료를 근거로 앱 설계 지침 작성 |
| 화면 설계 | Google Stitch | 수준별 화면 디자인 |
| 기능 구현 | Google AI Studio | 바이브 코딩으로 구현. 한 번에 3개씩 고치고 기존 기능이 그대로인지 확인 |
| 영어판·데이터 보안 | ChatGPT 에이전트 | 해외 기준 조사, 영어판 제작, 기록·보안 구조 정리 |
| 기록·알림 | Firebase, Apps Script, Gmail | 활동 기록 저장, 교사 알림 |
| 그림·음성 | Nano Banana, Typecast | 캐릭터와 그림, 안내 음성 |

**버전 흐름**

- 1.0 마음튼튼앱 (2026년 1월): Apps Script와 구글 시트로 만든 첫 시도
- 2.0 (2026년 2~5월): Google for Education AI+Edu Fellowship 기간에 개발
- 3.0 (2026년): "저도 써도 될까요?", "데이터는 어떻게 관리되나요?"라는 질문을 계기로 데이터와 보안을 다시 설계

## 수업 적용과 개선

실제 수업에서 사용하며 학생의 사용 과정과 어려움을 관찰하고, 그 결과를 바탕으로 기능과 학습 흐름을 개선하고 있습니다. 현재는 현장 적용과 개선을 이어가는 단계이며, 교육적 효과를 일반화할 수 있는 검증 결과를 제시하는 것은 아닙니다.

## 직접 실행하기 (개발자용)

Node.js 20 이상이 필요합니다.

```bash
npm ci          # 패키지 설치
npm run dev     # http://localhost:3000 에서 체험 모드로 실행
npm test        # 자동 테스트
npm run build   # 배포용 빌드 (dist 폴더)
```

- 기본은 **체험 모드**입니다. 기록은 브라우저 메모리에만 남고 새로고침하면 사라집니다. 교사 화면도 로그인 없이 체험용으로 열립니다.
- 실제로 운영하려면 자신의 Firebase 프로젝트와 Apps Script를 연결해야 합니다. [데이터 운영 설정](docs/DATA_SETUP.md)과 [배포 안내](docs/RELEASE_GUIDE.md)를 따르세요.
- 보안 규칙 테스트는 Firebase 에뮬레이터가 필요합니다: `npm run test:rules`

| 위치 | 내용 |
| --- | --- |
| `src/` | 학생·교사 화면 (React) |
| `src/learning/` | 활동 내용 (나-전달법, 생각 바꾸기, 긍정 메시지 등) |
| `src/lib/` | 기록 저장, 로그인, 알림, 보고서 계산 |
| `services/apps-script/` | 교사 알림 메일 서버 |
| `firestore.rules` | 데이터베이스 보안 규칙 |
| `tests/` | 자동 테스트 |
| `docs/` | 설계·운영·접근성 문서 |

## 사용 문의

우리 반에서 써 보고 싶거나 의견이 있으면 [LinkedIn](https://www.linkedin.com/in/yungyeongkim/)으로 연락해 주세요.

## 저작권

- 이 저장소는 열람용으로 공개합니다. 코드·문서·그림·음성·영상에 대한 모든 권리는 김윤경에게 있습니다(All rights reserved). 허락 없이 복제·수정·배포하거나 사용할 수 없습니다. 학교나 기관에서 쓰고 싶다면 연락해 주세요. 자세한 내용은 [LICENSE](LICENSE)를 보세요.
- 안내 음성은 [Typecast](https://typecast.ai/kr) 무료 플랜으로 만들었습니다. 함께 담은 외부 구성 요소는 각자의 라이선스를 따릅니다. 자세한 내용은 [NOTICE](NOTICE.md)를 보세요.

## 감사

Google for Education AI+Edu Fellowship, GEG 선생님들, 그리고 함께 써 보며 의견을 준 학생들에게 감사드립니다.

> AI는 과정을 안내하지만, 변화를 이끌어 내는 건 결국 사람입니다.

---

## English

**Mind G.P.S. 3.0** is a social-emotional learning (SEL) web app for everyone, built by Yungyeong Kim, a special education teacher in Korea, Mind G.P.S. 3.0 is a social-emotional learning (SEL) web app developed by Yungyeong Kim, a special education teacher in Korea, using AI-assisted coding and refined through classroom use.

> **This repository is the demo edition.** It runs in demo mode by default: no student records are stored and no alerts are sent. It contains no connection details for the live school deployment.
>
> **Note** This is an educational support tool, not a medical or therapeutic device. If a student is in crisis, follow your school's crisis procedures.

**Why.** Students made progress in class, but it faded over weekends and breaks, and what was always beside them was a phone or tablet. Instead of taking the device away, I put a better option inside it. The solution had to meet three conditions: evidence-based strategies, practice anytime and anywhere, and an experience more engaging than the videos students watched.

**What it does.** Students choose a character, check how they feel and how strongly (levels 1–5), do a regulation activity, check their feelings again, and get praise. Four strategies cover communication (I-messages), cognition (reframing, based on REBT), body (relaxation) and senses (calming sounds). Teachers manage classes and student nicknames, assign shared tablets, record observations, and view growth reports.

**Designed for everyone.** Three display modes (sentences, pictures with words, pictures only) based on CAST UDL 3.0, large text, Korean and English, color-independent cues, keyboard and switch access, user-started audio, and spoken guidance on every screen.

**Privacy and safety in live operation. The following design applies when the app is connected to a separately configured Firebase project and Apps Script backend. The public demo keeps activity records only in browser memory, clears them on reload, and does not send teacher notification emails. No names or student IDs, only characters and teacher-assigned nicknames. Students use anonymous sign-in; only approved teachers can view records, through Google sign-in, and only for their own classes. A level-5 negative emotion or a help request emails the teacher through an Apps Script server that re-checks the sign-in and the record before sending. Firestore security rules are covered by automated tests, and no secrets are kept in the code.


**I defined the learning flow and feature requirements, then used AI-assisted coding tools to implement them. Through classroom use, I identified difficulties, prioritized improvements, and checked that changes preserved the existing learning flow. 
How it was built.** Gemini Notebook for an evidence-grounded spec, Google Stitch for the UI, Google AI Studio for the build, a ChatGPT agent for the English version and the data and security structure, and Firebase, Apps Script and Gmail for records and alerts. Version 1.0 (January 2026) became 2.0 during the Google for Education AI+Edu Fellowship (February–May 2026), and 3.0 redesigned data and security after teachers asked how the data is managed.

**Classroom use. I use Mind G.P.S. in my teaching and refine its features and learning flow based on classroom observations. The project is still being developed through classroom use; these observations do not establish generalizable educational effectiveness.
**Try it.** [Live demo](https://rud0325-tech.github.io/mind-gps/) in demo mode.

**Run it.** Requires Node.js 20+. `npm ci`, then `npm run dev` (demo mode at http://localhost:3000). `npm test` runs the unit tests and `npm run build` makes a production build. To run it for real, connect your own Firebase project and Apps Script by following [docs/DATA_SETUP.md](docs/DATA_SETUP.md).

**Copyright.** This repository is public for viewing only. All rights reserved: the code, documents, images, audio and video may not be copied, modified, distributed or used without written permission. See [LICENSE](LICENSE). Voice files were made with the [Typecast](https://typecast.ai/kr) free plan, and bundled third-party components keep their own licenses (see [NOTICE](NOTICE.md)).
