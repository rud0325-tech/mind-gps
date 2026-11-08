"""Run locally, open http://127.0.0.1:9129 and press '음성 포함 영상 만들기'.

Uses the existing Typecast MP3 at 0.875x with preservesPitch enabled. The four
poses appear one at a time with a clear numbered sequence. Timing follows four
equal practice intervals; these are visual cues, not verified transcript timings. Uses browser media APIs; no microphone or external services.
"""
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import json
import base64
import sys

ROOT = Path(__file__).resolve().parent.parent
PAGE = r'''<!doctype html><html lang="ko"><meta charset="utf-8">
<title>MindGPS 이완훈련 음성 영상 제작</title>
<style>body{font:18px system-ui;background:#f3f6ef;padding:24px}canvas,video{max-height:62vh;max-width:90vw}button{padding:16px;font-size:20px}pre{white-space:pre-wrap}</style>
<h1>이완훈련 · 타입캐스트 음성 포함</h1>
<p>한 번에 한 동작씩 보며 기존 음성을 0.875배 속도로 들어요. 추가 음성 생성·마이크 사용이 없습니다.</p>
<button id="start">음성 포함 영상 만들기</button><p id="status">준비 중</p>
<canvas id="picture" width="900" height="1000"></canvas><video id="preview" controls hidden></video><pre id="report"></pre>
<script>
const canvas=document.querySelector('#picture'),context=canvas.getContext('2d');
const button=document.querySelector('#start'),status=document.querySelector('#status'),report=document.querySelector('#report');
const picture=new Image();picture.src='/poses.png';
const audio=new Audio('/guide.mp3');audio.preload='auto';audio.playbackRate=.875;audio.preservesPitch=true;
const formats=['video/mp4;codecs=avc1.42001f,mp4a.40.2','video/mp4','video/webm;codecs=vp8,opus','video/webm'];
const mimeType=formats.find(type=>MediaRecorder.isTypeSupported(type));
const names=['편한 자세','힘 빼기','들이쉬기','내쉬기'];
// The image has a slightly shorter top row; preserve each full-body pose.
const crops=[[.003,.003,.496,.469],[.501,.003,.496,.469],[.003,.474,.496,.523],[.501,.474,.496,.523]];
function drawFrame() {
 const fraction=audio.duration ? audio.currentTime/audio.duration : 0;
 const step=Math.min(3,Math.floor(fraction*4));
 context.fillStyle='#f6f8f4';context.fillRect(0,0,900,1000);
 context.textAlign='center';context.textBaseline='middle';
 for(let i=0;i<4;i++){
  const x=318+i*88;
  context.beginPath();context.arc(x,51,27,0,Math.PI*2);
  context.fillStyle=i===step?'#3159d5':'#e5eaf3';context.fill();
  context.fillStyle=i===step?'#fff':'#586779';context.font='bold 26px system-ui';context.fillText(String(i+1),x,52);
 }
 const [x,y,w,h]=crops[step];
 const sw=w*picture.naturalWidth,sh=h*picture.naturalHeight;
 const scale=Math.min(820/sw,775/sh),dw=sw*scale,dh=sh*scale;
 const dx=(900-dw)/2,dy=110+(775-dh)/2;
 context.drawImage(picture,x*picture.naturalWidth,y*picture.naturalHeight,sw,sh,dx,dy,dw,dh);
 context.strokeStyle='#3159d5';context.lineWidth=7;context.lineJoin='round';
 context.strokeRect(dx-4,dy-4,dw+8,dh+8);
 context.fillStyle='#253957';context.font='bold 36px system-ui';context.fillText(names[step],450,928);
 context.fillStyle='#52675d';context.font='24px system-ui';context.fillText('내 속도로 편안하게 따라 해요',450,974);
}
picture.onload=()=>{drawFrame();status.textContent='준비됨 · '+mimeType;};
button.onclick=async()=>{
 button.disabled=true;
 let stream,ctx,recorder,timer;
 try {
  await picture.decode();
  if(audio.readyState<1)await new Promise((resolve,reject)=>{audio.onloadedmetadata=resolve;audio.onerror=reject;});
  if(!mimeType)throw Error('지원되는 영상 녹화 형식이 없습니다.');
  ctx=new AudioContext();await ctx.resume();
  const source=ctx.createMediaElementSource(audio),destination=ctx.createMediaStreamDestination();
  source.connect(destination); // Record internally; do not play through speakers.
  stream=new MediaStream([...canvas.captureStream(15).getVideoTracks(),...destination.stream.getAudioTracks()]);
  recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:1200000,audioBitsPerSecond:96000});
  const chunks=[];
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  const recording=new Promise((resolve,reject)=>{recorder.onstop=()=>resolve(new Blob(chunks,{type:mimeType}));recorder.onerror=reject;});
  const sourceSeconds=audio.duration;
  audio.currentTime=0;audio.playbackRate=.875;audio.preservesPitch=true;
  // Flush the MediaElement/AudioContext output after the element reaches its end.
  audio.onended=()=>{setTimeout(()=>{clearInterval(timer);recorder.stop();},250);};
  recorder.start();await audio.play();
  timer=setInterval(()=>{drawFrame();status.textContent='녹화 중 · '+audio.currentTime.toFixed(1)+' / '+sourceSeconds.toFixed(1)+'초 (원본 위치)';},1000/15);
  const blob=await recording;
  stream.getTracks().forEach(track=>track.stop());
  const samples=await ctx.decodeAudioData(await blob.arrayBuffer());
  let squares=0,count=0;
  for(let channel=0;channel<samples.numberOfChannels;channel++)for(const sample of samples.getChannelData(channel)){squares+=sample*sample;count++;}
  const rms=Math.sqrt(squares/count);
  const result={mimeType,bytes:blob.size,sourceSeconds,rate:audio.playbackRate,preservesPitch:audio.preservesPitch,expectedSeconds:sourceSeconds/.875,decodedAudioSeconds:samples.duration,channels:samples.numberOfChannels,rms,visualSequence:names.map((label,index)=>({step:index+1,label,startSeconds:sourceSeconds/.875*index/4})),timingBasis:'Four equal visual practice intervals, not verified narration timestamps'};
  if(rms<.0001)throw Error('내보낸 영상의 음성 파형이 무음입니다.');
  if(Math.abs(samples.duration-result.expectedSeconds)>.5)throw Error('전체 음성 길이를 확인해 주세요: '+JSON.stringify(result));
  const saved=await fetch('/save',{method:'POST',headers:{'Content-Type':mimeType,'X-Media-Report':JSON.stringify(result)},body:blob});
  if(!saved.ok)throw Error('영상 저장 실패');
  result.saved=await saved.text();report.textContent=JSON.stringify(result,null,2);
  const preview=document.querySelector('#preview');preview.src=URL.createObjectURL(blob);preview.hidden=false;canvas.hidden=true;
  status.textContent='영상 저장 완료 · 음성 파형과 전체 길이 확인됨';
  await ctx.close();
 }catch(error){clearInterval(timer);audio.pause();stream?.getTracks().forEach(track=>track.stop());if(ctx&&ctx.state!=='closed')await ctx.close();status.textContent='제작 오류: '+error.message;button.disabled=false;}
};
</script></html>'''


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        sources = {
            '/poses.png': (ROOT / 'src/assets/relaxation/relaxation-poses-calm.png', 'image/png'),
            '/guide.mp3': (ROOT / 'src/assets/tts/guide_relax.mp3', 'audio/mpeg'),
        }
        if self.path in sources:
            path, content_type = sources[self.path]
            data = path.read_bytes()
        elif self.path == '/':
            data, content_type = PAGE.encode(), 'text/html; charset=utf-8'
        else:
            self.send_error(404)
            return
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != '/save':
            self.send_error(404)
            return
        size = int(self.headers.get('Content-Length', '0'))
        if not 0 < size < 30_000_000:
            self.send_error(413)
            return
        extension = 'mp4' if 'mp4' in self.headers.get('Content-Type', '') else 'webm'
        path = ROOT / f'src/assets/relaxation/relaxation-typecast-guide.{extension}'
        path.write_bytes(self.rfile.read(size))
        details = json.loads(self.headers.get('X-Media-Report', '{}'))
        (ROOT / 'src/assets/relaxation/relaxation-typecast-guide.json').write_text(json.dumps(details, ensure_ascii=False, indent=2) + '\n')
        self.send_response(200)
        self.end_headers()
        self.wfile.write(path.name.encode())
        print(path, details, flush=True)

    def log_message(self, *_):
        pass


if __name__ == '__main__':
    if '--preview' in sys.argv:
        page = PAGE
        for url, path, mime in [
            ('/poses.png', ROOT / 'src/assets/relaxation/relaxation-poses-calm.png', 'image/png'),
            ('/guide.mp3', ROOT / 'src/assets/tts/guide_relax.mp3', 'audio/mpeg'),
        ]:
            page = page.replace("'" + url + "'", "'data:" + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode() + "'")
        begin = page.index("  const saved=await fetch('/save'")
        end = page.index('  const preview=', begin)
        page = page[:begin] + '''  report.textContent=JSON.stringify(result,null,2);
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='relaxation-typecast-guide.'+(mimeType.includes('mp4')?'mp4':'webm');link.textContent='완성 영상 파일 저장';document.body.append(link);
''' + page[end:]
        page = page.replace('영상 저장 완료 · 음성 파형과 전체 길이 확인됨', '영상 준비 완료 · 음성 파형과 전체 길이 확인됨 · 아래 저장 링크 누르기')
        target = ROOT / 'dist/_relaxation-video-builder.html'
        target.write_text(page)
        print('Open the existing preview server at /_relaxation-video-builder.html, then download the result. Remove the temporary HTML after use.')
        sys.exit(0)
    print('Open http://127.0.0.1:9129 to create the video. Stop this server after saving.', flush=True)
    HTTPServer(('127.0.0.1', 9129), Handler).serve_forever()
