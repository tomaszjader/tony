let worker,working=false;
export function localWhisper(samples,onProgress=()=>{}){if(working)return Promise.reject(Error('Lokalny model już analizuje nagranie.'));working=true;return new Promise((resolve,reject)=>{
  try{worker??=new Worker(new URL('./local-whisper.worker.js',import.meta.url),{type:'module'});}catch{working=false;reject(Error('Ta przeglądarka nie obsługuje lokalnego modelu. Wybierz OpenAI.'));return;}
  const finish=()=>{working=false;clearTimeout(timer);worker.onmessage=null;worker.onerror=null;};
  const timer=setTimeout(()=>{worker.terminate();finish();worker=null;reject(Error('Lokalna analiza trwała za długo. Spróbuj krótszego nagrania lub OpenAI.'));},240000);
  worker.onmessage=event=>{if(event.data.type==='progress'){onProgress(event.data.text);return;}const result=event.data;finish();if(result.type==='error')reject(Error(result.text));else resolve(result.text);};
  worker.onerror=()=>{worker.terminate();finish();worker=null;reject(Error('Przeglądarka nie uruchomiła lokalnego modelu. Wybierz OpenAI lub tryb bez transkrypcji.'));};
  worker.postMessage(samples?{type:'transcribe',samples}:{type:'prepare'});
});}
export function resample16k(samples,rate){if(rate===16000)return samples;const result=new Float32Array(Math.floor(samples.length*16000/rate));for(let i=0;i<result.length;i++){const position=i*rate/16000,start=Math.floor(position),fraction=position-start;result[i]=samples[start]*(1-fraction)+(samples[Math.min(start+1,samples.length-1)]||0)*fraction;}return result;}
