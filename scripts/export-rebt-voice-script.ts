import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REBT_VOICE_LINES } from '../src/learning/rebtVoiceLines';

const outputDirectory = process.argv[2]
  ? resolve(process.argv[2])
  : fileURLToPath(new URL('../../../outputs/', import.meta.url));
const baseName = 'MindGPS_Typecast_REBT_대본_20261007';
const combinedScript = REBT_VOICE_LINES.map(line => line.text).join('\n\n') + '\n';
const csvCell = (value: string) => `"${value.replace(/"/gu, '""')}"`;
const csv = '\uFEFF' + [
  ['번호', '파일명', '읽을 문장'],
  ...REBT_VOICE_LINES.map((line, index) => [String(index + 1), line.fileName, line.text]),
].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
const markdown = `# MindGPS 생각 바꾸기 — 타입캐스트 음성 제작 대본

현재 앱에 들어 있는 문장에 맞춘 대본입니다. **새 음성 파일을 제작한 결과물이 아닙니다.** 총 ${REBT_VOICE_LINES.length}개 문장이며, 내용이 똑같은 문장은 파일 하나를 함께 사용합니다.

## 같은 목소리로 준비하는 방법

1. 기존 MindGPS 안내 음성을 만들었던 타입캐스트 프로젝트에서 사용한 캐릭터(목소리)를 확인합니다. 원래의 캐릭터와 말투·감정·말하기 속도 설정을 사용해 주세요. 기존 MP3 파일만으로 그 설정을 확정할 수는 없습니다.
2. 함께 제공된 \`MindGPS_생각바꾸기_통합음성대본.txt\`의 전체 내용을 한 번에 붙여 넣습니다. 이 파일에는 번호·파일명·설명 없이 읽을 문장만 순서대로 들어 있습니다.
3. 문장과 문장 사이에 약 2초의 무음을 넣고, 배경음악·효과음 없이 하나의 MP3로 내보내도 됩니다. 빈 줄만으로 실제 무음이 생기는지는 먼저 들어 보고 확인해 주세요. 문장 순서는 그대로 유지합니다.
4. 완성한 MP3를 전달하면 문장 경계를 확인하여 아래 파일명대로 분리하고 앱 소스의 \`src/assets/tts/rebt/\` 폴더에 연결할 수 있습니다. 이미 개별 MP3가 있다면 아래 파일명으로 바로 사용할 수도 있습니다.
5. 음성을 연결한 후 앱을 다시 빌드하고, 실제 읽는 내용과 화면 문장이 일치하는지 확인합니다.

기존 \`guide_rebt.mp3\`는 활동 전체 안내입니다. 이 대본의 개별 문장 녹음을 대신하지 않습니다. 기존 칭찬 음성은 별도로 그대로 사용할 수 있습니다.

## 직접 등록하는 상황·생각

학생·교사가 새로 입력한 문장은 이 고정 대본에 포함되지 않습니다. 새 문장까지 같은 타입캐스트 목소리로 들으려면 해당 문장의 별도 MP3를 준비해야 합니다. 입력만으로 같은 목소리가 자동 생성되지는 않습니다. 아래 표의 직접 등록 공통 문장은 고정된 안내 문장만 포함합니다.

현재 대본은 학생이 직접 입력한 내용이나 활동 기록을 읽어 오지 않습니다.

## 문장별 파일명

| 번호 | 파일명 | 읽을 문장 |
|---:|---|---|
${REBT_VOICE_LINES.map((line, index) => `| ${index + 1} | ${line.fileName} | ${line.text.replace(/\|/gu, '\\|')} |`).join('\n')}

화면이나 학습 수준이 달라도 읽을 문장이 정확히 같으면 표에 있는 파일 하나를 함께 사용합니다. 총 25개 상황의 파일명은 내용 개정에 따라 \`v24-\`, \`v25-\`, \`v26-\`로 시작합니다. 이번에 바꾼 활동 어려움·친구 다툼·활동 제한은 \`v26-\`을 사용합니다. 예전 대본과 문장이 달라진 경우 이전 녹음을 새 문장에 연결하지 않습니다.
`;

await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, `${baseName}.md`), markdown, 'utf8');
await writeFile(resolve(outputDirectory, `${baseName}.csv`), csv, 'utf8');
await writeFile(resolve(outputDirectory, 'MindGPS_생각바꾸기_통합음성대본.txt'), combinedScript, 'utf8');
process.stdout.write(`${REBT_VOICE_LINES.length}개 문장 대본을 저장했습니다.\n${resolve(outputDirectory, `${baseName}.md`)}\n${resolve(outputDirectory, `${baseName}.csv`)}\n`);
