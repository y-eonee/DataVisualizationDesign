// GPU rasterization of the same closed terrain triangles; no data sampling.
const SleepTerrainGPU=(()=>{
 let renderer=null,disabled=false,lastError=null;
 const vertex=`attribute vec3 p;attribute vec3 c;uniform mat3 rotation;uniform vec2 size,center;uniform float scale,bias;varying vec3 color;void main(){vec3 q=rotation*p;float f=1.0/(1.0-.08*q.z);vec2 pixel=center+q.xy*scale*f;gl_Position=vec4(pixel.x/size.x*2.0-1.0,1.0-pixel.y/size.y*2.0,-q.z/4.0+bias,1.0);color=c;}`;
 const fragment=`precision mediump float;varying vec3 color;uniform float alpha;void main(){gl_FragColor=vec4(color,alpha);}`;
 function make(nodes){
  const canvas=document.createElement('canvas'),gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true,preserveDrawingBuffer:true});if(!gl)throw Error('WebGL context unavailable');
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
  const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
  const data=[],ranges=[];
  for(const hill of nodes.relief){const start=data.length/6,tint=[1,3,5].map(i=>parseInt(nodes.occupationProfiles[hill.groupId].color.slice(i,i+2),16));
   for(const face of hill.mesh.faces){for(const i of face.indices){const v=hill.mesh.vertices[i],p=v.p,level=Math.max(0,(v.radius-1.016)/.018*.2);data.push(p.x,p.y,p.z,...SleepLandscape.reliefColor(tint,level,face.role).map(c=>c/255));}}
   const triangles=data.length/6-start,lineStart=data.length/6;
   for(const layer of hill.layers)for(const loop of layer.loops)for(let j=0;j<loop.length-1;j++)for(const p of [loop[j],loop[j+1]])data.push(p.x,p.y,p.z,.259,.204,.267);
   ranges.push({hill,start,triangles,lineStart,lines:data.length/6-lineStart});
  }
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
  const p=gl.getAttribLocation(program,'p'),c=gl.getAttribLocation(program,'c');gl.enableVertexAttribArray(p);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(p,3,gl.FLOAT,false,24,0);gl.vertexAttribPointer(c,3,gl.FLOAT,false,24,12);
  const uniforms=Object.fromEntries(['rotation','size','center','scale','bias','alpha'].map(n=>[n,gl.getUniformLocation(program,n)]));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();disabled=true;lastError='WebGL context lost';});
  return {canvas,gl,program,buffer,uniforms,nodes,ranges,key:null,builds:0,hits:0};
 }
 function draw(ctx,nodes,{viewport,yaw,pitch,scale,cx,cy,opacity,filtered,matches}){
  if(disabled||typeof window.WebGLRenderingContext==='undefined'||typeof ctx.drawImage!=='function')return null;
  try{
   if(!renderer||renderer.nodes!==nodes){if(renderer){renderer.gl.deleteBuffer(renderer.buffer);renderer.gl.deleteProgram(renderer.program);}renderer=make(nodes);}
   const r=renderer,gl=r.gl,u=r.uniforms,dpr=Math.min(window.devicePixelRatio||1,2),active=r.ranges.map(({hill})=>!filtered||hill.members.some(matches)),key=[viewport.width,viewport.height,yaw,pitch,scale,cx-viewport.left,cy-viewport.top,opacity,dpr,active.join('')].join('|');
   const hit=r.key===key,cameraVisible=({hill})=>{const p=hill.center;return (p.y*Math.sin(pitch)+(p.z*Math.cos(yaw)-p.x*Math.sin(yaw))*Math.cos(pitch))>=.02;};
   if(!hit){
    const w=Math.max(1,Math.round(viewport.width*dpr)),h=Math.max(1,Math.round(viewport.height*dpr));if(r.canvas.width!==w||r.canvas.height!==h){r.canvas.width=w;r.canvas.height=h;}gl.viewport(0,0,w,h);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(r.program);
    const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);gl.uniformMatrix3fv(u.rotation,false,new Float32Array([c,s*sp,-s*cp,0,cp,sp,s,-c*sp,c*cp]));gl.uniform2f(u.size,viewport.width,viewport.height);gl.uniform2f(u.center,cx-viewport.left,cy-viewport.top);gl.uniform1f(u.scale,scale);gl.uniform1f(u.bias,0);
    for(let i=0;i<r.ranges.length;i++){const a=r.ranges[i];if(!cameraVisible(a))continue;gl.depthMask(active[i]);gl.uniform1f(u.alpha,opacity*(active[i]?1:.08));gl.drawArrays(gl.TRIANGLES,a.start,a.triangles);}
    gl.depthMask(false);gl.uniform1f(u.bias,-.00006);for(let i=0;i<r.ranges.length;i++){const a=r.ranges[i];if(!cameraVisible(a))continue;gl.uniform1f(u.alpha,opacity*(active[i]?.70:.04));gl.drawArrays(gl.LINES,a.lineStart,a.lines);}gl.depthMask(true);
    r.key=key;r.builds++;
   }else r.hits++;
   ctx.globalAlpha=1;
   const source=ctx.canvas,parent=source?.parentElement;
   if(parent&&source.id==='map'){
    // Keep WebGL in its own compositor layer: avoid a WebGL-to-2D readback per frame.
    r.background??=document.createElement('canvas');
    if(r.canvas.parentElement!==parent){
     for(const [surface,z] of [[r.background,0],[r.canvas,1]]){Object.assign(surface.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:String(z),pointerEvents:'none'});surface.setAttribute('aria-hidden','true');parent.appendChild(surface);}
     source.style.zIndex='2';
    }
    if(r.background.width!==source.width||r.background.height!==source.height){r.background.width=source.width;r.background.height=source.height;}
    const ground=r.background.getContext('2d');ground.setTransform(1,0,0,1,0,0);ground.clearRect(0,0,r.background.width,r.background.height);ground.drawImage(source,0,0);
    ctx.clearRect(viewport.left,viewport.top,viewport.width,viewport.height);
   }else ctx.drawImage(r.canvas,viewport.left,viewport.top,viewport.width,viewport.height);
   return {hit,drawCalls:hit?1:r.ranges.length*2+1};
  }catch(e){lastError=String(e);disabled=true;console.warn('Terrain GPU fallback:',lastError);return null;}
 }
 return {draw,get status(){return {enabled:!!renderer&&!disabled,error:lastError,builds:renderer?.builds||0,hits:renderer?.hits||0};}};
})();
