import { readFileSync } from 'node:fs';

// Local demos may build, but must never replace the actual school app by accident.
let state;
try { state = JSON.parse(readFileSync(new URL('../dist/deployment-state.json', import.meta.url), 'utf8')); }
catch { throw new Error('배포 중단: 현재 코드로 먼저 빌드해 주세요.'); }
// The build must target the same Firebase project that Hosting deploys to (.firebaserc).
const target = JSON.parse(readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8')).projects?.default;
const placeholder = !target || target === 'your-firebase-project-id';
if (state.dataMode !== 'live' || state.emulator || !state.mailConfigured || placeholder || state.projectId !== target) {
  throw new Error('배포 중단: 실제 모드, .firebaserc와 같은 Firebase 저장소, 긴급 메일 주소를 모두 설정하고 에뮬레이터를 끈 뒤 다시 빌드해야 합니다.');
}
console.log('운영 빌드 설정 확인 완료. Google 권한·보안 규칙·발송 시험은 별도로 확인해야 합니다.');
