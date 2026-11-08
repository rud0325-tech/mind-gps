import type {TimetableWord} from './timetable';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {publicUrl} from './publicUrl';
export interface ReadTimetable {text:string;pages:TimetableWord[][]}
export async function readTimetableFile(file:File,progress:(message:string)=>void,signal:AbortSignal):Promise<ReadTimetable>{
 if(file.size>15*1024*1024)throw new Error('15MB 이하 파일을 골라 주세요.');
 const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
 if(!pdf&&!/image\/(png|jpeg|webp)/.test(file.type))throw new Error('JPG, PNG, WebP 사진 또는 PDF 파일을 골라 주세요.');
 let worker:import('tesseract.js').Worker|undefined;
 const abort=()=>{void worker?.terminate();};signal.addEventListener('abort',abort);
 const check=()=>{if(signal.aborted)throw new Error('파일 읽기를 취소했어요.');};
 const scan=async(image:HTMLCanvasElement|File)=>{
  check();if(!worker){progress('한국어 읽기 도구를 준비하고 있어요');const {createWorker}=await import('tesseract.js');worker=await createWorker('kor',1,{workerPath:new URL(publicUrl('ocr/worker.min.js'),location.origin).href,corePath:new URL(publicUrl('ocr/core'),location.origin).href,langPath:new URL(publicUrl('ocr/lang'),location.origin).href,logger:m=>{if(m.status==='recognizing text')progress(`글자 읽는 중 ${Math.round(m.progress*100)}%`);}});check();await worker.setParameters({tessedit_pageseg_mode:'11' as import('tesseract.js').PSM});}
  const result=await worker.recognize(image,{}, {blocks:true,text:true});check();
  const words=(result.data.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines.flatMap(l=>l.words.map(w=>({text:w.text,x:w.bbox.x0,y:w.bbox.y0,width:w.bbox.x1-w.bbox.x0,height:w.bbox.y1-w.bbox.y0})))));
  return {text:result.data.text,words};
 };
 try{
  if(!pdf){const bitmap=await createImageBitmap(file);check();const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const result=await scan(canvas);return {text:result.text,pages:[result.words]};}
  progress('PDF를 읽고 있어요');const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
  const task=pdfjs.getDocument({data:await file.arrayBuffer(),cMapUrl:publicUrl('ocr/cmaps/'),cMapPacked:true,standardFontDataUrl:publicUrl('ocr/standard_fonts/')});
  const stopPdf=()=>{void task.destroy();};signal.addEventListener('abort',stopPdf);
  try{const document=await task.promise;if(document.numPages>5)throw new Error('5쪽 이하 PDF를 사용해 주세요. 필요한 시간표 쪽만 저장하면 빠르게 읽을 수 있어요.');
   const texts:string[]=[];const pages:TimetableWord[][]=[];
   for(let n=1;n<=document.numPages;n++){check();progress(`PDF ${n}/${document.numPages}쪽을 읽고 있어요`);const page=await document.getPage(n);const content=await page.getTextContent();const viewport=page.getViewport({scale:1});
    const words=content.items.flatMap(item=>'str'in item&&item.str.trim()?[{text:item.str,x:item.transform[4],y:viewport.height-item.transform[5],width:item.width,height:item.height||12}]:[]);
    if(words.map(w=>w.text).join('').length>15){texts.push(words.map(w=>w.text).join('\n'));pages.push(words);}
    else{const view=page.getViewport({scale:Math.min(2,2400/Math.max(viewport.width,viewport.height))});const canvas=window.document.createElement('canvas');canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);await page.render({canvas,viewport:view}).promise;const r=await scan(canvas);texts.push(r.text);pages.push(r.words);}
    page.cleanup();
   }
   return {text:texts.join('\n\n'),pages};
  }finally{signal.removeEventListener('abort',stopPdf);await task.destroy();}
 }finally{signal.removeEventListener('abort',abort);await worker?.terminate();}
}
