export async function decodeAudio(blob){
  const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw Error('Przeglądarka nie obsługuje analizy dźwięku.');
  const context=new Context();try{const audio=await context.decodeAudioData(await blob.arrayBuffer());const samples=new Float32Array(audio.length);for(let c=0;c<audio.numberOfChannels;c++){const channel=audio.getChannelData(c);for(let i=0;i<audio.length;i++)samples[i]+=channel[i]/audio.numberOfChannels;}return {samples,rate:audio.sampleRate,duration:audio.duration};}catch(e){throw Error('Nie udało się odczytać audio. Użyj nagrania MP3, WAV, M4A lub WebM obsługiwanego przez przeglądarkę.');}finally{await context.close();}
}
export function encodeWav(samples,rate){
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);const text=(offset,value)=>{for(let i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));};
  text(0,'RIFF');view.setUint32(4,36+samples.length*2,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);}return new Blob([buffer],{type:'audio/wav'});
}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
