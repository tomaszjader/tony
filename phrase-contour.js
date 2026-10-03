import {detectPitch} from './pitch.js?v=3-yin';
export function contour(samples,rate){
  const factor=Math.max(1,Math.floor(rate/16000));
  if(factor>1){const reduced=new Float32Array(Math.floor(samples.length/factor));for(let i=0;i<reduced.length;i++)for(let j=0;j<factor;j++)reduced[i]+=samples[i*factor+j]/factor;samples=reduced;rate/=factor;}
  const size=Math.round(rate*.05),hop=Math.round(rate*.04),frames=[];
  for(let i=0;i+size<=samples.length;i+=hop){const p=detectPitch(samples.subarray(i,i+size),rate);frames.push({t:i/rate,p:p?12*Math.log2(p.hz):null});}
  const voiced=frames.filter(f=>f.p!==null);if(voiced.length<5)return [];
  const start=voiced[0].t,end=voiced.at(-1).t;if(end===start)return [];
  const values=voiced.map(f=>f.p).sort((a,b)=>a-b),median=values[Math.floor(values.length/2)];
  return frames.filter(f=>f.t>=start&&f.t<=end).map(f=>({x:(f.t-start)/(end-start),y:f.p===null?null:Math.max(.02,Math.min(.98,.5+(f.p-median)/16))}));
}
