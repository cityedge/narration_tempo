// Copyright (c) 2026 cityedge. MIT; see ../../LICENSE.
// Unchanged DSP excerpt of the author-provided Narration Tempo MVP v1.2.
// Frozen reference used only for WSOLA compatibility tests.
class Cancelled extends Error{constructor(){super('cancelled')}}
const sleep=()=>new Promise(resolve=>setTimeout(resolve,0));
function wavHeader(frameCount,sampleRate,channels,bits){const bytes=frameCount*channels*bits/8,aligned=bytes+(bytes&1);if(bytes+36+(bytes&1)>0xffffffff)throw Error(tr('fileTooBig'));const a=new ArrayBuffer(44),v=new DataView(a);function s(o,t){for(let i=0;i<t.length;i++)v.setUint8(o+i,t.charCodeAt(i));}s(0,'RIFF');v.setUint32(4,36+aligned,true);s(8,'WAVE');s(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,channels,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*channels*bits/8,true);v.setUint16(32,channels*bits/8,true);v.setUint16(34,bits,true);s(36,'data');v.setUint32(40,bytes,true);return new Uint8Array(a);}
class PCMWriter{
 constructor(channels,bits,onChunk){this.ch=channels;this.bits=bits;this.chunkSize=16384;this.mem=Array.from({length:channels},()=>new Float32Array(this.chunkSize));this.filled=0;this.onChunk=onChunk;this.seed=9135787;}
 async appendDirect(sources,start,count){let off=start,n=count;while(n>0){const to=Math.min(n,this.chunkSize-this.filled);for(let ch=0;ch<this.ch;ch++)this.mem[ch].set(sources[ch].subarray(off,off+to),this.filled);this.filled+=to;off+=to;n-=to;if(this.filled===this.chunkSize)await this.flush();}}
 async appendFade(tails,sources,start,count,totalOverlap){let off=0;while(off<count){const take=Math.min(count-off,this.chunkSize-this.filled);for(let i=0;i<take;i++){const a=(off+i+0.5)/totalOverlap;for(let ch=0;ch<this.ch;ch++)this.mem[ch][this.filled+i]=tails[ch][off+i]*(1-a)+sources[ch][start+off+i]*a;}this.filled+=take;off+=take;if(this.filled===this.chunkSize)await this.flush();}}
 async flush(){if(!this.filled)return;const unit=this.bits/8,out=new Uint8Array(this.filled*this.ch*unit);let at=0;for(let i=0;i<this.filled;i++)for(let ch=0;ch<this.ch;ch++){let v=this.mem[ch][i];if(!Number.isFinite(v))v=0;v=Math.max(-1,Math.min(1,v));if(this.bits===24){let q=Math.round(v<0?v*8388608:v*8388607);out[at++]=q&255;out[at++]=(q>>8)&255;out[at++]=(q>>16)&255;}else{ // TPDF dither at ~1 LSB, avoids correlated quantization distortion.
  this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;const r1=this.seed/4294967296;this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;const r2=this.seed/4294967296;let q=Math.max(-32768,Math.min(32767,Math.round(v*32767+(r1-r2)*0.5)));out[at++]=q&255;out[at++]=(q>>8)&255;}}
 this.filled=0;await this.onChunk(out);}
}
// WSOLA-family: fixed synthesis hop, nearby similarity search for each source window,
// one shared alignment for both channels, and short linear overlap-add crossfades.
// A fixed absolute source target k * hop * speed prevents tempo drift.
async function transform({buffer,startFrame,sourceFrames,ratio,bits,write,progress,signal,wsolaConfig}){
 const sr=buffer.sampleRate,ch=buffer.numberOfChannels,src=Array.from({length:ch},(_,i)=>buffer.getChannelData(i));
 const target=Math.round(sourceFrames/ratio),writer=new PCMWriter(ch,bits,write);if(target<=0)throw Error(tr('emptyFile'));
 const off=startFrame;
 if(Math.abs(ratio-1)<1e-8){let done=0;while(done<target){if(signal.cancelled)throw new Cancelled();const n=Math.min(16384,target-done);await writer.appendDirect(src.map(x=>x),off+done,n);done+=n;if(done%524288<16384){progress(done/target);await sleep();}}await writer.flush();progress(1);return target;}
 // User-adjustable WSOLA tuning; defaults retain the original v1.1 40/15/8 ms behavior.
 const {sequenceMs,seekMs,overlapMs,searchStride,analysisStep}=wsolaConfig;
 const sequence=Math.max(128,Math.round(sr*sequenceMs/1000)),overlap=Math.max(32,Math.round(sr*overlapMs/1000)),hop=sequence-overlap,seek=Math.max(24,Math.round(sr*seekMs/1000));
 const prev=Array.from({length:ch},()=>new Float32Array(overlap)),frame0=Math.min(target,hop);await writer.appendDirect(src,off,frame0);let done=frame0;
 for(let c=0;c<ch;c++){const from=off+hop,to=Math.min(off+sourceFrames,from+overlap);if(to>from)prev[c].set(src[c].subarray(from,to));}
 const maxBase=Math.max(0,sourceFrames-sequence),stride=searchStride,decimate=analysisStep;
 let k=0;
 while(done<target){if(signal.cancelled)throw new Cancelled();k++;
   const nominal=Math.max(0,Math.min(maxBase,Math.round(k*hop*ratio)));
   let best=nominal;
   if(sourceFrames>sequence+seek*2){
     // Use the more energetic channel as a similarity reference (stereo remains locked).
     let refCh=0,energy=0;
     for(let c=0;c<ch;c++){let e=0;const a=prev[c];for(let j=0;j<overlap;j+=decimate)e+=a[j]*a[j];if(e>energy){energy=e;refCh=c;}}
     if(energy>1e-6){
       const ref=prev[refCh],arr=src[refCh];const min=Math.max(0,nominal-seek),max=Math.min(maxBase,nominal+seek);
       let score=-Infinity;
       const evaluate=(base,step)=>{let dot=0,den=0;for(let j=0;j<overlap;j+=step){let a=ref[j],b=arr[off+base+j];dot+=a*b;den+=b*b;}if(den<1e-10)return -2;const penal=.025*Math.pow((base-nominal)/seek,2);return dot/Math.sqrt(den*(energy*(decimate/step)))-penal;};
       // First a coarse window search, then sample-accurate refinement.
       for(let pos=min;pos<=max;pos+=stride){const q=evaluate(pos,decimate);if(q>score){score=q;best=pos;}}
       {const q=evaluate(max,decimate);if(q>score){score=q;best=max;}}
       let fineScore=-Infinity,fineBest=best;
       for(let pos=Math.max(min,best-stride);pos<=Math.min(max,best+stride);pos++){const q=evaluate(pos,decimate);if(q>fineScore){fineScore=q;fineBest=pos;}}
       if(fineScore>.05)best=fineBest;else best=nominal;
     }
   }
   const available=target-done;const fadeN=Math.min(overlap,available);await writer.appendFade(prev,src,off+best,fadeN,overlap);done+=fadeN;
   const straightN=Math.min(hop-overlap,target-done);if(straightN>0){await writer.appendDirect(src,off+best+overlap,straightN);done+=straightN;}
   for(let c=0;c<ch;c++){const a=src[c],from=off+best+hop,limit=Math.min(from+overlap,off+sourceFrames);prev[c].fill(0);if(from<limit)prev[c].set(a.subarray(from,limit));}
   if((k&63)===0){progress(done/target);await sleep();}
 }
 await writer.flush();progress(1);return target;
}
