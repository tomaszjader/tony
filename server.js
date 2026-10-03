import http from 'node:http';
import { readFile, writeFile, mkdir, unlink, rename } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { pinyin } from 'pinyin-pro';
const root=process.cwd(), cache=resolve(root,'.cache');
await mkdir(cache,{recursive:true});
function json(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(value));}
async function body(req,limit){let size=0;const parts=[];for await(const part of req){size+=part.length;if(size>limit)throw new Error('Za duży plik lub tekst.');parts.push(part);}return Buffer.concat(parts);}
function python(args,input=''){return new Promise((resolve,reject)=>{const child=spawn('python',['scripts/speech.py',...args],{cwd:root,windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';const timer=setTimeout(()=>{child.kill();reject(new Error('Analiza trwała zbyt długo. Spróbuj krótszej frazy.'));},180000);child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0){console.error(err);reject(new Error('Silnik mowy jest niedostępny. Sprawdź instalację faster-whisper i edge-tts oraz połączenie podczas generowania wzorca.'));return;}try{resolve(JSON.parse(out.trim()));}catch{reject(new Error('Nieprawidłowa odpowiedź silnika mowy.'));}});child.stdin.end(input);});}
let transcribing=false;const pendingTTS=new Map();
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='POST'&&url.pathname.startsWith('/api/')){
      const origin=req.headers.origin;
      if(origin&&!['http://localhost:3000','http://127.0.0.1:3000'].includes(origin)){json(res,403,{error:'Niedozwolone źródło żądania.'});return;}
      if(url.pathname==='/api/pinyin'||url.pathname==='/api/reference'){
        const {text}=JSON.parse((await body(req,4096)).toString('utf8'));
        if(typeof text!=='string'||text.length>120||!/[\p{Script=Han}]/u.test(text)){json(res,400,{error:'Wpisz frazę chińskimi znakami (maksymalnie 120 znaków).'});return;}
        if(url.pathname==='/api/pinyin'){json(res,200,{pinyin:pinyin(text),syllables:pinyin(text,{type:'array',nonZh:'removed'})});return;}
        const hash=createHash('sha256').update(text).digest('hex'),path=resolve(cache,`${hash}.mp3`);
        let data;try{data=await readFile(path);}catch{if(!pendingTTS.has(hash)){const temp=path+'.tmp';const task=python(['tts',temp],text).then(()=>rename(temp,path)).finally(()=>pendingTTS.delete(hash));pendingTTS.set(hash,task);}await pendingTTS.get(hash);data=await readFile(path);}
        res.writeHead(200,{'Content-Type':'audio/mpeg','Cache-Control':'no-store'}).end(data);return;
      }
      if(url.pathname==='/api/transcribe'){
        if(transcribing){json(res,409,{error:'Trwa już analiza nagrania. Poczekaj chwilę.'});return;}
        transcribing=true;const path=resolve(cache,`${randomUUID()}.audio`);
        try{const data=await body(req,8*1024*1024);if(data.length<100)throw new Error('Nagranie jest puste.');await writeFile(path,data);const result=await python(['transcribe',path]);result.pinyin=result.text?pinyin(result.text):'';result.syllables=result.text?pinyin(result.text,{type:'array',nonZh:'removed'}):[];json(res,200,result);}finally{transcribing=false;await unlink(path).catch(()=>{});}return;
      }
      json(res,404,{error:'Nie znaleziono usługi.'});return;
    }
    if(req.method!=='GET'){res.writeHead(405).end();return;}
    const pathname=url.pathname==='/'?'/index.html':url.pathname;
    if(!['/index.html','/style.css','/app.js','/pitch.js','/phrases.js','/phrase-compare.js','/phrase-contour.js'].includes(pathname)&&!/^\/audio\/[a-z0-9]+\.mp3$/.test(pathname)){res.writeHead(404).end();return;}
    const data=await readFile(resolve(root,'.'+pathname));
    res.writeHead(200,{'Cache-Control':'no-store','Content-Type':{'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.mp3':'audio/mpeg'}[extname(pathname)]}).end(data);
  }catch(e){if(!res.headersSent)json(res,400,{error:e.message});else res.end();}
}).listen(3000,'127.0.0.1',()=>console.log('Tony: http://localhost:3000'));
