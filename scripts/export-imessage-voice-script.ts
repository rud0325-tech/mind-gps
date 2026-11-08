import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I_MESSAGE_VOICE_LINES } from '../src/learning/iMessageVoiceLines';

const outputDirectory = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../../../outputs/', import.meta.url));
const baseName = 'MindGPS_Typecast_나전달법_완성문장_대본_20261007_v6';
const combinedName = 'MindGPS_나전달법_통합음성대본_20261007_v6.txt';
const combinedScript = I_MESSAGE_VOICE_LINES.map(line => line.text).join('\n\n') + '\n';
const csvCell = (value: string) => `"${value.replace(/"/gu, '""')}"`;
const csv = '\uFEFF' + [
  ['번호', '파일명', '읽을 문장'],
  ...I_MESSAGE_VOICE_LINES.map((line, index) => [String(index + 1), line.fileName, line.text]),
].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
const markdown = `# MindGPS 나전달법 — 완성 문장 타입캐스트 대본

네 상황 × 네 마음 × 상황별 두세 부탁으로 구성한 **${I_MESSAGE_VOICE_LINES.length}개 완성 문장**입니다. 학생이 선택한 상황·마음·부탁을 한 문장 흐름으로 읽도록, 실제 화면의 완성 문장을 그대로 사용합니다. 답답해요는 제외했습니다.

대본과 파일명 목록을 준비한 것이며, 새 음성 파일이 이미 만들어진 것은 아닙니다.

이 v6 버전의 상황 순서는 “친구가 나를 놀리는 말을 해요.”, “지금 하는 활동이 어려워요.”, “주변 사람이 큰 목소리로 말해요.”, “하고 싶은 활동을 지금 할 수 없어요.”입니다. 마지막 상황은 이전 기다리기 상황을 교체한 것으로, 이유 묻기·가능한 때 묻기·다른 활동 고르기의 세 부탁을 제공합니다. 가능한 때를 묻는 문장은 나중에 반드시 할 수 있다는 약속이 아닙니다.

친구에게 전하는 문장은 “네가 … 하면 나는 … 해. … 해 줘.”처럼 전체를 반말로 읽습니다. 다른 상황은 존댓말을 유지합니다. 새 상황의 12문장은 파일명에 \`activity-unavailable\`를 사용하며, 이전 \`waiting\` 녹음과 연결하지 않습니다. 기존 세 상황의 문장과 녹음 파일명은 유지합니다. 이전 대본 대신 이 v6 대본을 사용해 주세요.

현재 앱의 완성 문장 듣기는 사용자가 허용한 기기 기본 음성을 사용합니다. 아래 파일명으로 타입캐스트 MP3를 추가하고 앱을 다시 빌드하면 해당 문장은 그 녹음으로 읽습니다.

## 한 파일로 제작하는 방법

1. 기존 MindGPS 음성을 만들었던 타입캐스트 프로젝트의 목소리와 말투·감정·속도 설정을 사용합니다. 기존 MP3만으로 그 설정을 확정할 수는 없습니다.
2. 함께 제공된 \`${combinedName}\` 전체를 붙여 넣습니다. 번호·파일명·설명 없이 읽을 문장만 들어 있습니다. 빈 줄로 구분한 한 문단이 학생의 완성 문장 하나입니다.
3. **각 문단 사이**에 약 2초의 무음을 넣습니다. 문단 안의 상황·마음 문장과 부탁 문장 사이는 자연스럽게 이어 읽습니다. 빈 줄만으로 실제 무음이 생기는지는 먼저 들어 보며 확인해 주세요.
4. 순서를 그대로 유지하고 배경음악·효과음 없이 하나의 MP3로 저장해도 됩니다. 파일을 전달하면 각 완성 문장의 경계를 확인해 아래 파일명대로 나눌 수 있습니다.
5. 개별 파일은 앱 소스의 \`src/assets/tts/imessage/\` 폴더에 넣습니다. 앱을 다시 빌드하고, 선택한 상황·마음·부탁과 실제 음성이 맞는지 확인합니다.

기존 \`guide_i_message.mp3\`는 나전달법 전체 활동 안내입니다. 학생이 고른 완성 문장을 읽는 음성이 아니므로 문장별 녹음을 대신하지 않습니다. 새 문장 녹음이 없을 때 안내 음성을 해당 문장의 낭독인 것처럼 사용하지 않습니다.

이 대본에는 앱의 고정 학습 문장만 들어 있으며 학생의 이름·활동 기록은 포함하지 않습니다. 문장을 수정하거나 선택지를 추가하면 대본을 다시 만들고 해당 녹음도 함께 갱신해야 합니다. 서로 다른 내용을 비슷한 음성으로 연결하지 않습니다.

## 문장별 파일명

| 번호 | 파일명 | 읽을 완성 문장 |
|---:|---|---|
${I_MESSAGE_VOICE_LINES.map((line, index) => `| ${index + 1} | ${line.fileName} | ${line.text.replace(/\|/gu, '\\|')} |`).join('\n')}
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, combinedName), combinedScript, 'utf8');
await writeFile(resolve(outputDirectory, `${baseName}.md`), markdown, 'utf8');
await writeFile(resolve(outputDirectory, `${baseName}.csv`), csv, 'utf8');
process.stdout.write(`${I_MESSAGE_VOICE_LINES.length}개 완성 문장 대본을 저장했습니다.\n${resolve(outputDirectory, combinedName)}\n${resolve(outputDirectory, `${baseName}.md`)}\n${resolve(outputDirectory, `${baseName}.csv`)}\n`);
