// Layered age-territory terrain wrapped onto the existing clustered sphere.
const SleepLandscape = (() => {
    const tau=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    function occupationProfiles(nodes){
        return Array.from({length:6},(_,groupId)=>{
            const people=new Set(),byCode=new Map();
            for(const n of nodes){if(n.groupId!==groupId)continue;if(!byCode.has(n.code))byCode.set(n.code,new Set());for(const id of n.personIds){people.add(id);byCode.get(n.code).add(id);}}
            const ranked=[...byCode].filter(([code])=>code!=='').sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0]));
            const leaderCode=ranked[0]?.[0]??null,leaderCount=ranked[0]?.[1].size??0;
            return {groupId,total:people.size,leaderCode,leaderCount,color:leaderCode===null?'#B3A0DA':SleepOccupations.style(leaderCode).color,counts:Object.fromEntries([...byCode].map(([code,ids])=>[code,ids.size]))};
        });
    }
    function appearance(n){
        const profile=n.land?.occupationProfile,missing=n.code==='',dominant=profile?.leaderCode===n.code;
        const color=SleepOccupations.style(n.code??'').color,relative=profile?.leaderCount?(profile.counts[n.code]??0)/profile.leaderCount:0;
        const base=missing?(profile?.color??'#B3A0DA'):color;
        const rgb=[1,3,5].map(i=>parseInt(base.slice(i,i+2),16)),gray=rgb.reduce((a,b)=>a+b,0)/3,saturation=dominant?1.13:missing?.65:.84;
        return {color:'#'+rgb.map(v=>Math.round(clamp(gray+(v-gray)*saturation,0,255)).toString(16).padStart(2,'0')).join(''),kind:missing?'unrecorded':dominant?'dominant':'minor',hollow:false,alpha:dominant?1:missing?.48:.43+.40*Math.sqrt(Math.min(1,relative)),share:profile?.total?(profile.counts[n.code]??0)/profile.total:0,label:missing?'Occupation not recorded':SleepOccupations.style(n.code).label+(dominant?' · largest recorded occupation':'')};
    }
    const terrainRadius=level=>1+.016+.018*Math.floor(clamp(level,0,2.599999)/.2+1e-8);
    function reliefShade(level){return Math.max(.60,1.08-.18*level);}
    function reliefColor(tint,level,role='top'){
        const t=clamp(level/2.5,0,1),white=.64*Math.pow(1-t,1.45),dark=1-.28*t,light=role==='wall'?.91:role==='bottom'?.70:1;
        return tint.map(v=>clamp((v*dark*(1-white)+250*white)*light,0,255));
    }
    function heightAt(n,phase){
        if(!n.land.sprout)return 0;
        if(n.durationDifference===null)return .65;
        const low=Math.min(n.weekdayDuration,n.weekendDuration);
        const weekday=.40+Math.min(4,n.weekdayDuration-low)*.38;
        const weekend=.40+Math.min(4,n.weekendDuration-low)*.38;
        return weekday+(weekend-weekday)*phase;
    }
    // Added: weekday->weekend stem height for large aggregates, same relative rule as sprouts.
    function stemHeight(sd,phase){const low=Math.min(sd.wd,sd.we);return(.40+Math.min(4,sd.wd-low)*.38)*(1-phase)+(.40+Math.min(4,sd.we-low)*.38)*phase;}
    function simplifyRing(ring,tolerance=.0008){
        const distance=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;};
        const open=points=>{const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];while(stack.length){const [a,b]=stack.pop();let far=-1,best=tolerance*tolerance;for(let i=a+1;i<b;i++){const d=distance(points[i],points[a],points[b]);if(d>best){best=d;far=i;}}if(far>=0){keep[far]=1;stack.push([a,far],[far,b]);}}return points.filter((_,i)=>keep[i]);};
        let split=1;for(let i=2;i<ring.length;i++)if((ring[i].x-ring[0].x)**2+(ring[i].y-ring[0].y)**2>(ring[split].x-ring[0].x)**2+(ring[split].y-ring[0].y)**2)split=i;
        const result=[...open(ring.slice(0,split+1)).slice(0,-1),...open([...ring.slice(split),ring[0]]).slice(0,-1)];return result.length>=3?result:ring;
    }
    function cakeMesh(layers,world,chart){
        const vertices=[],faces=[],lookup=new Map();
        const rings=layers.map(l=>l.loops.map(loop=>{
            let ring=loop.slice(0,-1).map(p=>chart(p,l.level));
            for(let pass=0;pass<2;pass++)ring=ring.filter((p,i)=>{const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];return Math.abs((p.x-a.x)*(b.y-p.y)-(p.y-a.y)*(b.x-p.x))>1e-12;});
            return simplifyRing(ring);
        }).filter(r=>r.length>=3));
        const vertex=(p,r)=>{const key=Math.round(p.x*1e8)+','+Math.round(p.y*1e8)+','+Math.round(r*1e8);if(lookup.has(key))return lookup.get(key);const id=vertices.length;vertices.push({x:p.x,y:p.y,f:p.f,radius:r,p:world(p.x,p.y,r)});lookup.set(key,id);return id;};
        const triangle=(a,b,c,level,role)=>{if(a!==b&&b!==c&&a!==c)faces.push({indices:[a,b,c],level,role});};
        const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
        const surface=(loops,r,level,role)=>{
            const rs=loops.map(ring=>({ring,area:Math.abs(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p.x*q.y-q.x*p.y;},0)),parent:-1,depth:0}));
            for(let i=0;i<rs.length;i++){let area=Infinity;for(let j=0;j<rs.length;j++)if(rs[j].area>rs[i].area&&rs[j].area<area&&inside(rs[i].ring[0],rs[j].ring)){rs[i].parent=j;area=rs[j].area;}}
            const depth=i=>rs[i].parent<0?0:1+depth(rs[i].parent);rs.forEach((r,i)=>r.depth=depth(i));
            for(let i=0;i<rs.length;i++){
                if(rs[i].depth%2)continue;const loops=[rs[i].ring,...rs.filter(q=>q.parent===i&&q.depth%2).map(q=>q.ring)],coords=[],holes=[],ids=[];
                loops.forEach((ring,j)=>{if(j)holes.push(ids.length);for(const p of ring){coords.push(p.x,p.y);ids.push(vertex(p,r));}});
                const triangles=earcut(coords,holes,2);for(let j=0;j<triangles.length;j+=3)triangle(ids[triangles[j]],ids[triangles[j+1]],ids[triangles[j+2]],level,role);
            }
        };
        surface(rings[0]||[],1,0,'bottom');
        for(let i=0;i<layers.length;i++){
            const hi=terrainRadius(layers[i].level),lo=i?terrainRadius(layers[i-1].level):1;
            surface([...rings[i],...(rings[i+1]||[])],hi,layers[i].level+.1,'top');
            for(const ring of rings[i])for(let j=0;j<ring.length;j++){
                const a=ring[j],b=ring[(j+1)%ring.length],al=vertex(a,lo),bl=vertex(b,lo),ah=vertex(a,hi),bh=vertex(b,hi);
                triangle(al,bl,bh,layers[i].level,'wall');triangle(al,bh,ah,layers[i].level,'wall');
            }
        }
        return {vertices,faces};
    }
    function buildRelief(nodes){
        const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
        const unit=p=>{const r=Math.hypot(p.x,p.y,p.z);return {x:p.x/r,y:p.y/r,z:p.z/r};};
        const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
        const bases=nodes.filter(n=>!n.land.sprout),parents=bases.map((_,i)=>i),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
        for(let i=0;i<bases.length;i++)for(let j=i+1;j<bases.length;j++){
            if(bases[i].groupId!==bases[j].groupId)continue;
            const a=bases[i],b=bases[j],distance=Math.acos(clamp(dot(a.normal,b.normal),-1,1));
            if(distance<(a.radius+b.radius)*1.32*.82*.97)parents[find(j)]=find(i);
        }
        const groups=new Map();bases.forEach((n,i)=>{const key=find(i);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);});
        const relief=[];
        for(const members of groups.values()){
            if(members.length<2)continue;
            const center=unit(members.reduce((s,n)=>({x:s.x+n.normal.x,y:s.y+n.normal.y,z:s.z+n.normal.z}),{x:0,y:0,z:0}));
            const u=unit(cross(center,Math.abs(center.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0})),v=cross(center,u);
            const disks=members.map(n=>{const d=Math.max(.1,dot(n.normal,center));return {n,x:dot(n.normal,u)/d,y:dot(n.normal,v)/d,r:n.radius*1.32*.82*1.18/d};});
            const minX=Math.min(...disks.map(d=>d.x-d.r))-.008,maxX=Math.max(...disks.map(d=>d.x+d.r))+.008,minY=Math.min(...disks.map(d=>d.y-d.r))-.008,maxY=Math.max(...disks.map(d=>d.y+d.r))+.008;
            const step=Math.max(.0035,Math.max(maxX-minX,maxY-minY)/100),w=Math.ceil((maxX-minX)/step)+1,h=Math.ceil((maxY-minY)/step)+1,field=new Float32Array(w*h);
            const sample=(x,y)=>disks.reduce((sum,d)=>sum+Math.max(0,1-((x-d.x)**2+(y-d.y)**2)/(d.r*d.r))**2,0);
            for(const d of disks){for(let iy=Math.max(0,Math.floor((d.y-d.r-minY)/step));iy<=Math.min(h-1,Math.ceil((d.y+d.r-minY)/step));iy++)for(let ix=Math.max(0,Math.floor((d.x-d.r-minX)/step));ix<=Math.min(w-1,Math.ceil((d.x+d.r-minX)/step));ix++){const q=1-((minX+ix*step-d.x)**2+(minY+iy*step-d.y)**2)/(d.r*d.r);if(q>0)field[iy*w+ix]+=q*q;}}
            const world=(x,y,r)=>{const p=unit({x:center.x+u.x*x+v.x*y,y:center.y+u.y*x+v.y*y,z:center.z+u.z*x+v.z*y});return {x:p.x*r,y:p.y*r,z:p.z*r};};
            const layers=[];
            for(const level of [.015,.20,.40,.60,.80,1,1.20,1.40,1.60,1.80,2,2.20,2.40]){
                const edges=[],points=new Map(),links=new Map(),key=p=>Math.round(p.x*1e7)+','+Math.round(p.y*1e7);
                const segment=(a,b)=>{const ka=key(a),kb=key(b);if(ka===kb)return;points.set(ka,a);points.set(kb,b);const id=edges.length;edges.push([ka,kb]);for(const k of [ka,kb]){if(!links.has(k))links.set(k,[]);links.get(k).push(id);}};
                const tri=ps=>{const cuts=[];for(let j=0;j<3;j++){const a=ps[j],b=ps[(j+1)%3];if((a.f>=level)===(b.f>=level))continue;const t=(level-a.f)/(b.f-a.f);cuts.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}if(cuts.length===2)segment(cuts[0],cuts[1]);};
                for(let iy=0;iy<h-1;iy++)for(let ix=0;ix<w-1;ix++){
                    const a={x:minX+ix*step,y:minY+iy*step,f:field[iy*w+ix]},b={x:a.x+step,y:a.y,f:field[iy*w+ix+1]},c={x:a.x+step,y:a.y+step,f:field[(iy+1)*w+ix+1]},d={x:a.x,y:a.y+step,f:field[(iy+1)*w+ix]};tri([a,b,c]);tri([a,c,d]);
                }
                const used=new Set(),loops=[];
                for(let id=0;id<edges.length;id++){
                    if(used.has(id))continue;const start=edges[id][0],loop=[],walk=[];let current=start,edge=id;
                    while(!used.has(edge)){used.add(edge);walk.push(points.get(current));const e=edges[edge];current=e[0]===current?e[1]:e[0];if(current===start)break;const next=links.get(current)?.find(i=>!used.has(i));if(next===undefined)break;edge=next;}
                    if(current!==start||walk.length<4)continue;
                    // Simplify near-collinear points to bound per-frame projection work.
                    for(let j=0;j<walk.length;j+=2)loop.push(world(walk[j].x,walk[j].y,terrainRadius(level)));loop.push(loop[0]);loops.push(loop);
                }
                if(loops.length)layers.push({level,loops});
            }
            const chart=(p,f)=>{const den=dot(p,center);return {x:dot(p,u)/den,y:dot(p,v)/den,f};};
            for(const d of disks){d.n.land.overlap=sample(d.x,d.y);d.n.land.terrainHeight=terrainRadius(d.n.land.overlap)-1;d.n.land.rootRadius=1+d.n.land.terrainHeight;d.n.land.fused=true;}
            relief.push({members,center,groupId:members[0].groupId,layers,mesh:cakeMesh(layers,world,chart)});
        }
        return relief;
    }
    function prepare(nodes){
        // Reuse the existing separated age caps; only elevation metadata is needed.
        const counts=nodes.map(n=>n.count).sort((a,b)=>a-b),threshold=counts[Math.floor((counts.length-1)*.65)]??0;
        for(const n of nodes){
            const sprout=n.count<=threshold&&n.count<nodes.maxCount;
            n.land={normal:n.normal,rootRadius:1,height:0,overlap:0,terrainHeight:0,fused:false,sprout,threshold};n.land.height=heightAt(n,.5);
        }
        nodes.occupationProfiles=occupationProfiles(nodes);
        for(const n of nodes)n.land.occupationProfile=nodes.occupationProfiles[n.groupId];
        nodes.relief=buildRelief(nodes);
        // Added: one stem per hill, on its highest member. Weekday/weekend durations are count-weighted means over every member
        // (paired members contribute both sides; weekday-only / weekend-only members contribute their own side).
        for(const hill of nodes.relief){
            let wd=0,wn=0,we=0,en=0;
            for(const m of hill.members){
                if(m.kind==='paired'&&m.weekdayDuration!=null){wd+=m.count*m.weekdayDuration;wn+=m.count;we+=m.count*m.weekendDuration;en+=m.count;}
                else if(m.kind==='weekday'){wd+=m.count*m.duration;wn+=m.count;}
                else if(m.kind==='weekend'){we+=m.count*m.duration;en+=m.count;}
            }
            if(!wn||!en)continue;
            hill.members.reduce((x,y)=>y.land.overlap>x.land.overlap?y:x).land.stemDur={wd:wd/wn,we:we/en};
        }
        for(const n of nodes)if(!n.land.sprout&&!n.land.fused&&n.kind==='paired'&&n.weekdayDuration!=null)n.land.stemDur={wd:n.weekdayDuration,we:n.weekendDuration};
        // Anchor each sprout on the nearest larger same-age disk as a visual support.
        // This display relation does not join or duplicate respondents.
        for(const n of nodes){
            if(!n.land.sprout)continue;
            const bases=nodes.filter(b=>b.groupId===n.groupId&&!b.land.sprout);
            const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
            const parent=bases.reduce((best,b)=>!best||dot(n.normal,b.normal)>dot(n.normal,best.normal)?b:best,null);
            if(!parent)continue;
            const p=parent.normal,d=dot(n.normal,p),raw={x:n.normal.x-p.x*d,y:n.normal.y-p.y*d,z:n.normal.z-p.z*d},len=Math.hypot(raw.x,raw.y,raw.z);
            const offset=Math.min(parent.radius*1.32*.82*.70,len/Math.max(.1,d));
            const candidate={x:p.x+(len?raw.x/len*offset:0),y:p.y+(len?raw.y/len*offset:0),z:p.z+(len?raw.z/len*offset:0)},norm=Math.hypot(candidate.x,candidate.y,candidate.z);
            n.land.normal={x:candidate.x/norm,y:candidate.y/norm,z:candidate.z/norm};
            n.land.rootRadius=(1+parent.land.terrainHeight)/dot(n.land.normal,p);n.land.parentKey=parent.key;
        }
    }
    function draw(ctx,nodes,{closeup=true,viewport,yaw,pitch,zoom,opacity,matches,filtered,groups,hover,mode='compare',time=0,seconds=0,reduced=false,ageColors=Array(6).fill('#A29AAD'),emphasis=()=>null}){
        const phase=mode==='weekday'?0:mode==='weekend'?1:reduced?.5:.5-.5*Math.cos(tau*seconds/15);
        const heights=new Map(nodes.map(n=>[n,heightAt(n,phase)]));
        // The globe center sits below the viewport: only a curved upper surface is seen.
        const blend=Number(closeup),wide=Math.min(viewport.width,viewport.height)*.295;
        const scale=(wide+(Math.max(viewport.width*.58,viewport.height*1.10)-wide)*blend)*zoom;
        const cx=viewport.left+viewport.width/2,cy=viewport.top+viewport.height*(.5+.72*Number(closeup));
        const c=Math.cos(yaw),s=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
        const rotate=p=>{const x=p.x*c+p.z*s,z=p.z*c-p.x*s;return {x,y:p.y*cp-z*sp,z:p.y*sp+z*cp};};
        const project=(p,out={})=>{const x=p.x*c+p.z*s,z0=p.z*c-p.x*s,y=p.y*cp-z0*sp,z=p.y*sp+z0*cp,f=1/(1-.08*z);out.x=cx+x*scale*f;out.y=cy+y*scale*f;out.z=z;return out;};
        const times=(p,r)=>({x:p.x*r,y:p.y*r,z:p.z*r});
        const line=(a,b)=>{ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();};
        const trace=points=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));};
        ctx.save();ctx.beginPath();ctx.rect(viewport.left,viewport.top,viewport.width,viewport.height);ctx.clip();
        ctx.strokeStyle='#EAE7EF';ctx.lineWidth=.65;ctx.globalAlpha=opacity*.42;
        // Latitude/longitude are spatial guides only, with the rear hemisphere hidden.
        const grid=points=>{let last=null;for(const w of points){const p=project(w);if(p.z>=0){if(last)line(last,p);last=p;}else last=null;}};
        for(let latitude=-60;latitude<=60;latitude+=7.5){const major=Math.abs(latitude%30)<.01;ctx.lineWidth=major?1.15:.65;ctx.globalAlpha=opacity*(major?.72:.40);const a=latitude*Math.PI/180;grid(Array.from({length:97},(_,j)=>{const t=j*tau/96;return {x:Math.cos(a)*Math.cos(t),y:Math.sin(a),z:Math.cos(a)*Math.sin(t)};}));}
        for(let longitude=0;longitude<360;longitude+=10){const major=longitude%30===0;ctx.lineWidth=major?1.15:.65;ctx.globalAlpha=opacity*(major?.72:.40);const a=longitude*Math.PI/180;grid(Array.from({length:49},(_,j)=>{const t=-Math.PI/2+j*Math.PI/48;return {x:Math.cos(t)*Math.cos(a),y:Math.sin(t),z:Math.cos(t)*Math.sin(a)};}));}
        {ctx.strokeStyle='#F5F1FA';ctx.lineWidth=1.1;ctx.globalAlpha=opacity*.68;trace(Array.from({length:97},(_,j)=>({x:cx+scale*Math.cos(j*tau/96),y:cy+scale*Math.sin(j*tau/96)})));ctx.stroke();}
        const labels=[],ordered=nodes.map(n=>({n,base:project(times(n.land.normal,n.land.rootRadius))})).filter(p=>p.base.z>.06).sort((a,b)=>a.base.z-b.base.z),views=[];
        let calls=0;
        // Restore the original connected hierarchy, with tips at the actual disk centers.
        const visible=new Set(ordered.map(p=>p.n));
        const neuronCurve=edge=>{
            if(edge.level!==3)return edge.curve;
            const n=edge.members[0],end=times(n.land.normal,n.land.rootRadius+heights.get(n)*.16);
            return [edge.curve[0],edge.curve[1],times(n.land.normal,.91),end];
        };
        const branchBatches=new Map();
        for(const edge of nodes.tree.edges){
            if(edge.level===3&&!visible.has(edge.members[0]))continue;
            const active=edge.members.some(n=>!filtered||matches(n)),curve=neuronCurve(edge),front=project(curve[3]).z>=0,key=edge.groupId+':'+edge.level+':'+active+':'+front;
            if(!branchBatches.has(key))branchBatches.set(key,{paths:[],color:nodes.occupationProfiles[edge.groupId].color,width:[2.1,1.05,.6,.4][edge.level],alpha:opacity*(active?[.88,.49,.25,.18][edge.level]:.025)*(front?1:.25)});
            edge.projectedLine??=Array.from({length:9},()=>({x:0,y:0,z:0}));
            edge.lineCoefficients??=Array.from({length:9},(_,j)=>{const t=j/8,u=1-t;return {x:u*u*u*curve[0].x+3*u*u*t*curve[1].x+3*u*t*t*curve[2].x,y:u*u*u*curve[0].y+3*u*u*t*curve[1].y+3*u*t*t*curve[2].y,z:u*u*u*curve[0].z+3*u*u*t*curve[1].z+3*u*t*t*curve[2].z,end:t*t*t};});
            const q={x:0,y:0,z:0};for(let j=0;j<9;j++){const a=edge.lineCoefficients[j];q.x=a.x+a.end*curve[3].x;q.y=a.y+a.end*curve[3].y;q.z=a.z+a.end*curve[3].z;project(q,edge.projectedLine[j]);}branchBatches.get(key).paths.push(edge.projectedLine);
        }
        for(const batch of branchBatches.values()){ctx.globalAlpha=batch.alpha;ctx.strokeStyle=batch.color;ctx.lineWidth=batch.width;ctx.beginPath();for(const path of batch.paths)for(let j=0;j<path.length;j++){const p=path[j];if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);}ctx.stroke();calls++;}
        const core=project({x:0,y:0,z:0});
        for(const [r,alpha] of [[10,.06],[6,.15],[3,.95]]){ctx.globalAlpha=opacity*alpha;ctx.fillStyle='#ECE3FF';trace(Array.from({length:25},(_,j)=>({x:core.x+r*Math.cos(j*tau/24),y:core.y+r*Math.sin(j*tau/24)})));ctx.fill();calls++;}

        const gpu=typeof SleepTerrainGPU!=='undefined'?SleepTerrainGPU.draw(ctx,nodes,{viewport,yaw,pitch,scale,cx,cy,opacity,filtered,matches}):null;
        let terrainCacheHit=gpu?.hit||false;
        if(gpu)calls+=gpu.drawCalls;
        else {
         const paintRelief=target=>{
        for(const hill of [...nodes.relief].sort((a,b)=>rotate(a.center).z-rotate(b.center).z)){
            if(rotate(hill.center).z<.02)continue;
            const active=hill.members.some(n=>!filtered||matches(n));
            const tint=[1,3,5].map(i=>parseInt(nodes.occupationProfiles[hill.groupId].color.slice(i,i+2),16));
            hill.projected??=hill.mesh.vertices.map(()=>({x:0,y:0,z:0}));
            const projected=hill.projected;for(let i=0;i<projected.length;i++)project(hill.mesh.vertices[i].p,projected[i]);
            const batches=new Map();
            for(const f of hill.mesh.faces){
                if(f.role==='bottom')continue;
                const [a,b,d]=f.indices,depth=Math.round((projected[a].z+projected[b].z+projected[d].z)/3*160),shade=f.shade??(f.shade=Math.round(reliefShade(f.level)*(f.role==='wall'?.78:1)*40)),key=depth*64+shade;
                if(!batches.has(key))batches.set(key,{depth,shade,indices:[]});batches.get(key).indices.push(a,b,d);
            }
            target.globalAlpha=opacity*(active?1:.08);
            for(const batch of [...batches.values()].sort((a,b)=>a.depth-b.depth||b.shade-a.shade)){
                const color='rgb('+reliefColor(tint,Math.max(0,(1.08-batch.shade/40)/.18)).map(Math.round).join(',')+')';
                target.beginPath();for(let i=0;i<batch.indices.length;i+=3){const a=projected[batch.indices[i]],b=projected[batch.indices[i+1]],d=projected[batch.indices[i+2]];target.moveTo(a.x,a.y);target.lineTo(b.x,b.y);target.lineTo(d.x,d.y);target.lineTo(a.x,a.y);}
                target.fillStyle=target.strokeStyle=color;target.lineWidth=.65;target.fill();target.stroke();calls+=2;
            }
            // These are only ink contours on the solid skin, never separate filled disks.
            target.strokeStyle='#423444';target.globalAlpha=opacity*(active?.70:.04);target.lineWidth=.60;
            for(const layer of hill.layers){target.beginPath();for(const loop of layer.loops){loop.forEach((w,i)=>{const p=project(w);if(i===0)target.moveTo(p.x,p.y);else target.lineTo(p.x,p.y);});}target.stroke();calls++;}
        }
         };
         const canCache=typeof document.createElement==='function'&&typeof ctx.drawImage==='function';
         if(canCache){
          const mask=filtered?[...new Set(nodes.filter(matches).map(n=>n.groupId+':'+n.code))].sort().join(','):'all',dpr=Math.min(window.devicePixelRatio||1,2),key=[viewport.width,viewport.height,yaw,pitch,scale,cx-viewport.left,cy-viewport.top,opacity,dpr,mask].join('|');
          nodes.terrainCanvas??=document.createElement('canvas');const surface=nodes.terrainCanvas;
          if(nodes.terrainCanvasKey!==key){surface.width=Math.max(1,Math.round(viewport.width*dpr));surface.height=Math.max(1,Math.round(viewport.height*dpr));const c=surface.getContext('2d');c.setTransform(dpr,0,0,dpr,-viewport.left*dpr,-viewport.top*dpr);c.clearRect(viewport.left,viewport.top,viewport.width,viewport.height);paintRelief(c);nodes.terrainCanvasKey=key;}else terrainCacheHit=true;
          ctx.globalAlpha=1;ctx.drawImage(surface,viewport.left,viewport.top,viewport.width,viewport.height);calls++;
         }else paintRelief(ctx);
        }
        const lateStems=[];
        for(const {n,base} of ordered){
            const muted=filtered&&!matches(n),style=n.land.visualStyle||appearance(n),accent=filtered&&matches(n)?emphasis(n):null,alpha=opacity*(muted?.045:filtered?1:style.alpha)*(mode==='compare'||n.kind==='paired'||mode===n.kind?1:.35),r=n.radius*1.32,h=heights.get(n);
            const normal=n.land.normal,ref=Math.abs(normal.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0};
            const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
            const raw=cross(normal,ref),norm=Math.hypot(raw.x,raw.y,raw.z),u=times(raw,1/norm),v=cross(normal,u);
            const centerAt=y=>times(normal,n.land.rootRadius+y*.16);
            let lastDisk=null;
            const disk=(y,rr,fill)=>{
                if(lastDisk?.y===y&&lastDisk?.r===rr){if(fill)ctx.fill();else ctx.stroke();return;}
                const w=centerAt(y),p=project(w),a=project({x:w.x+u.x*rr,y:w.y+u.y*rr,z:w.z+u.z*rr}),b=project({x:w.x+v.x*rr,y:w.y+v.y*rr,z:w.z+v.z*rr});
                const ux=a.x-p.x,uy=a.y-p.y,vx=b.x-p.x,vy=b.y-p.y,xx=ux*ux+vx*vx,yy=uy*uy+vy*vy,xy=ux*uy+vx*vy,d=Math.sqrt((xx-yy)**2+4*xy*xy),major=Math.sqrt(Math.max(0,(xx+yy+d)/2)),minor=Math.sqrt(Math.max(0,(xx+yy-d)/2));
                ctx.beginPath();ctx.ellipse(p.x,p.y,major,minor,.5*Math.atan2(2*xy,xx-yy),0,tau);
                if(fill){
                    if(major>3&&ctx.createRadialGradient&&/^#[0-9a-f]{6}$/i.test(ctx.fillStyle)){
                        const base=ctx.fillStyle,rgb=[1,3,5].map(i=>parseInt(base.slice(i,i+2),16)),g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,major);
                        g.addColorStop(0,base);g.addColorStop(.42,base);g.addColorStop(1,'rgb('+rgb.map(v=>Math.round(v*.48+250*.52)).join(',')+')');ctx.fillStyle=g;ctx.fill();ctx.fillStyle=base;
                    }else ctx.fill();
                }else ctx.stroke();lastDisk={y,r:rr};
            };
            if(n.land.sprout){ctx.globalAlpha=alpha*.70;ctx.strokeStyle=accent||style.color;ctx.lineWidth=accent?1.1:.65;
            line(base,project(centerAt(h)));calls++;}
            // Large aggregates attach directly to the sphere; small ones form leaf buds.
            const levels=n.land.sprout?[Math.max(0,h-.045),h]:n.land.fused?[]:[0];
            for(const y of levels){
                const rr=r*.82*(y<h?1.04:1);
                const shade=n.land.overlap>1?reliefShade(Math.min(2.52,n.land.overlap)):.98;const color='#'+[1,3,5].map(i=>Math.round(parseInt(style.color.slice(i,i+2),16)*shade).toString(16).padStart(2,'0')).join('');
                ctx.globalAlpha=alpha*(!n.land.sprout&&n.land.terrainHeight>0?.48:1);ctx.fillStyle=muted?'#55515B':color;if(!style.hollow){disk(y,rr,true);calls++;}
                ctx.globalAlpha=alpha*(accent?1:!n.land.sprout&&n.land.terrainHeight>0?.35:.75);ctx.strokeStyle=accent||(style.hollow?style.color:'#35313C');ctx.lineWidth=accent?1.7:style.hollow?1:.55;disk(y,rr,false);calls++;
            }
            if(n.land.stemDur){
                // Large aggregates sit under terrain with near-zero alpha, so the stem uses its own alpha and is drawn last.
                const hs=.5+stemHeight(n.land.stemDur,phase)*1.5,mr=r*.82*.95,sa=opacity*(muted?.045:.55+.4*blend);
                lateStems.push(()=>{
                    ctx.globalAlpha=sa;ctx.strokeStyle='#F2F6FF';ctx.lineWidth=.8+.9*blend;line(base,project(centerAt(hs)));calls++;
                    ctx.globalAlpha=sa;ctx.fillStyle=muted?'#55515B':style.color;if(!style.hollow){disk(hs,mr,true);calls++;}
                    ctx.globalAlpha=sa;ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1.4;disk(hs,mr,false);calls++;
                });
            }
            const world=centerAt(h),top=project(world),rr=r*.82;
            const axis=t=>{const p=project({x:world.x+t.x*rr,y:world.y+t.y*rr,z:world.z+t.z*rr});return {x:p.x-top.x,y:p.y-top.y};};
            const ellipseU=axis(u),ellipseV=axis(v),radius=Math.hypot(ellipseU.x,ellipseU.y,ellipseV.x,ellipseV.y);
            views.push({node:n,x:top.x,y:top.y,z:base.z,radius,ellipseU,ellipseV,muted,alpha,height:h,colorKind:style.kind,hollow:style.hollow,accent});
        }
        for(const f of lateStems)f();
        const dataLabels=[];
        if(closeup){
            const candidates=[];
            for(const hill of nodes.relief){
                const members=hill.members.filter(n=>!filtered||matches(n));if(!members.length)continue;
                const cacheKey=members.map(n=>n.key).join('|');hill.labelCache??=new Map();let info=hill.labelCache.get(cacheKey);
                if(!info){const byCode=new Map(),all=new Set();for(const n of members){if(!byCode.has(n.code))byCode.set(n.code,new Set());for(const id of n.personIds){all.add(id);byCode.get(n.code).add(id);}}
                const ranked=[...byCode].filter(([code])=>code!=='').sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0]));
                const code=ranked[0]?.[0]??'',count=ranked[0]?.[1].size??all.size;
                info={code,count,total:all.size};if(hill.labelCache.size>=8)hill.labelCache.clear();hill.labelCache.set(cacheKey,info);}
                const {code,count,total}=info;
                const anchorNode=members.filter(n=>n.code===code).sort((a,b)=>b.count-a.count||a.key.localeCompare(b.key))[0]||members[0];
                const world=times(anchorNode.land.normal,anchorNode.land.rootRadius+.025),p=project(world);if(p.z<.08)continue;
                const text=groups[hill.groupId].name+' · '+(code?SleepOccupations.style(code).label:'직업 미기록')+' '+count.toLocaleString()+'명 / 총 '+total.toLocaleString()+'명';
                candidates.push({p,text,total,code,count,groupId:hill.groupId,hillKey:hill.members[0].key});
            }
            ctx.font='11px Arial';ctx.textAlign='left';
            const occupied=[],limit=viewport.width<650?10:26;
            for(const c of candidates.sort((a,b)=>b.total-a.total)){
                const width=ctx.measureText?ctx.measureText(c.text).width:c.text.length*7;
                const x=c.p.x+5,y=c.p.y-16,box={left:x-3,right:x+width+3,top:y-14,bottom:y+3};
                if(dataLabels.length>=limit||box.left<viewport.left+10||box.right>viewport.right-10||box.top<viewport.top+18||box.bottom>viewport.bottom-14)continue;
                if(occupied.some(b=>box.left<b.right+8&&box.right>b.left-8&&box.top<b.bottom+8&&box.bottom>b.top-8))continue;
                occupied.push(box);ctx.globalAlpha=opacity*.85;ctx.strokeStyle='#F4F0F8';ctx.lineWidth=.55;line(c.p,{x:c.p.x,y:y-5});
                ctx.save();ctx.translate(x,y-7);ctx.globalAlpha=opacity;ctx.fillStyle='#FFF9FF';ctx.font='11px Arial';ctx.textAlign='left';ctx.fillText(c.text,0,0);ctx.restore();
                dataLabels.push({text:c.text,x,y,count:c.count,total:c.total,groupId:c.groupId,code:c.code,hillKey:c.hillKey});
            }
        }
        if(!closeup)for(let id=0;id<6;id++){
            const n=nodes.find(n=>n.groupId===id);if(!n||rotate(n.ageAnchor).z<.06)continue;
            const p=project(times(n.ageAnchor,1.55)),g=groups[id];
            labels.push({id,x:p.x,y:p.y,text:viewport.width<650?g.name:g.name+' / '+g.stats.people.toLocaleString()});
        }
        for(const p of labels){ctx.globalAlpha=opacity;ctx.font='12px Arial';ctx.textAlign='center';ctx.fillStyle='#050408';ctx.fillRect(p.x-58,p.y-12,116,17);ctx.fillStyle='#DED7E8';ctx.fillText(p.text,p.x,p.y);}
        if(!closeup){ctx.globalAlpha=opacity*.85;ctx.fillStyle='#C7BFD2';ctx.font='11px Arial';ctx.textAlign='left';
        ctx.fillText('SLEEP GLOBE / SIX AGE TERRITORIES',viewport.left+18,viewport.top+26);
        ctx.fillStyle='#8E8799';ctx.fillText(viewport.width<650?'Cluster hue: leading occupation · faint: smaller groups':'Cluster hue: largest recorded occupation · fainter: lower respondent share · area: people',viewport.left+18,viewport.bottom-18);
        }
        ctx.restore();views.labels=labels;views.dataLabels=dataLabels;views.drawCalls=calls;views.terrainCacheHit=terrainCacheHit;views.terrainRenderer=gpu?'webgl':'canvas';views.culled=nodes.length-views.length;views.neuronBranches=nodes.tree.edges.length;views.reliefHills=nodes.relief.length;views.sprouts=nodes.filter(n=>n.land.sprout).length;views.phase=phase;views.phaseLabel=mode==='compare'?(reduced?'Paired duration / midpoint':'Weekday ↔ Weekend / '+Math.round(phase*100)+'% weekend'):(mode==='weekday'?'Weekday duration':'Weekend duration');return views;
    }
    return {prepare,draw,heightAt,buildRelief,appearance,occupationProfiles,reliefShade,reliefColor,terrainRadius,cakeMesh};
})();
