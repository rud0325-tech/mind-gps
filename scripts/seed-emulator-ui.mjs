// Local emulator only. No production endpoint or real student information.
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
const app = initializeApp({apiKey:'demo-api-key', projectId:'demo-mindgps'});
const auth = getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
const signed = await signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({sub:'teacher@example.com',email:'teacher@example.com',email_verified:true})));
const uid=signed.user.uid;
const enc=v=>v===null?{nullValue:null}:typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:fields(v)}};
const fields=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,enc(v)]));
async function put(path,data){const r=await fetch(`http://127.0.0.1:8080/v1/projects/demo-mindgps/databases/(default)/documents/${path}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:fields(data)})});if(!r.ok)throw Error('Emulator seed failed');}
await put(`teachers/${uid}`,{approved:true,admin:true});
await put('classes/ui-class',{name:'검증용 반',teacherIds:[uid],active:true,createdBy:uid});
for(const [code,alias,symbol] of [['S01','테스트 하나','⭐'],['S02','테스트 둘','🌻']]) await put(`classes/ui-class/students/${code}`,{alias,symbol,active:true});
console.log('로컬 교사와 가상 학생 2명 준비 완료');
process.exit(0);
