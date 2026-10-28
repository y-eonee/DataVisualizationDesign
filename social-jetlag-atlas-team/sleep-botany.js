// Full, disjoint two-hour aggregates. No source records or respondents are sampled.
const SleepBotany = (() => {
    const tau=Math.PI*2, mod=(x,n)=>(x%n+n)%n;
    const unit=v=>{const r=Math.hypot(v.x,v.y,v.z)||1;return {x:v.x/r,y:v.y/r,z:v.z/r};};
    const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
    const shift=(a,b)=>mod(b-a+12,24)-12;
    const clock=h=>{const m=mod(Math.round(h*60),1440);return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
    function wake(i){
        // DATA onset is hours SINCE 18:00, not midnight. Verify exact principal run.
        const [onset,duration]=DATA[i],start=mod(Math.round((onset+18)*6),144),len=Math.round(duration*6);
        const hex=SleepDemographics.masks[SleepDemographics.rows[i][3]];
        const asleep=t=>{t=mod(t,144);return (parseInt(hex[t>>2],16)>>(3-(t&3)))&1;};
        if(asleep(start-1)||asleep(start+len))throw Error('Principal sleep boundary mismatch: '+i);
        for(let k=0;k<len;k++)if(!asleep(start+k))throw Error('Principal sleep run mismatch: '+i);
        return mod(start+len,144)/6;
    }
    function circularMean(values){const a=values[0];return mod(a+values.reduce((s,b)=>s+shift(a,b),0)/values.length,24);}
    const bin=h=>Math.floor(mod(h-18,24)/2+1e-6); // continuous midnight, day cut at 18:00

    function build(model,graph){
        const map=new Map();let pairedPeople=0,unpairedPeople=0;
        for(const person of model.persons){
            const paired=!!(person.weekday.length&&person.weekend.length);paired?pairedPeople++:unpairedPeople++;
            const sets=paired?[person.indices]:['weekday','weekend'].map(k=>person[k]).filter(a=>a.length);
            for(const indices of sets){
                const kind=paired?'paired':(person.weekday.length?'weekday':'weekend');
                const weekdayWake=paired?circularMean(person.weekday.map(wake)):null,weekendWake=paired?circularMean(person.weekend.map(wake)):null;
                const onset=indices.reduce((s,i)=>s+DATA[i][0],0)/indices.length,duration=indices.reduce((s,i)=>s+DATA[i][1],0)/indices.length;
                const x=paired?bin(weekdayWake):Math.floor(onset/2+1e-6),y=paired?bin(weekendWake):Math.floor(duration/2+1e-6);
                const code=String(person.occupation??''),key=[person.groupId,code,kind,x,y].join(':');
                if(!map.has(key))map.set(key,{botanical:true,key,groupId:person.groupId,code,kind,xBin:x,yBin:y,indices:[],personIds:new Set(),wakeValues:[],durationPairs:[],onsetSum:0,durationSum:0});
                const n=map.get(key);n.indices.push(...indices);n.personIds.add(person.id);n.onsetSum+=onset;n.durationSum+=duration;
                if(paired){
                    n.wakeValues.push([weekdayWake,weekendWake]);
                    n.durationPairs.push([person.weekday.reduce((s,i)=>s+DATA[i][1],0)/person.weekday.length,person.weekend.reduce((s,i)=>s+DATA[i][1],0)/person.weekend.length]);
                }
            }
        }
        const result=[...map.values()].sort((a,b)=>a.key.localeCompare(b.key)),maxCount=Math.max(1,...result.map(n=>n.personIds.size));
        // Broad nearest-anchor territories fill the sphere, retaining narrow seams.
        // Each original aggregate stays in its age territory; no records are sampled.
        const members=model.groups.map(g=>result.filter(n=>n.groupId===g.id)),pools=model.groups.map(()=>[]);
        const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
        const morton=(x,y)=>{let out=0;for(let b=0;b<8;b++)out|=((x>>b)&1)<<(b*2)|((y>>b)&1)<<(b*2+1);return out;};
        for(let j=0;j<16384;j++){
            const y=1-2*(j+.5)/16384,r=Math.sqrt(1-y*y),angle=j*2.399963229728653,v={x:r*Math.cos(angle),y,z:r*Math.sin(angle)};
            const g=graph.groups.reduce((best,g)=>dot(v,g.seed)>dot(v,best.seed)?g:best,graph.groups[0]);
            // Retain 86% of each territory's span, rather than tiny isolated caps.
            const p=unit({x:g.seed.x*.14+v.x*.86,y:g.seed.y*.14+v.y*.86,z:g.seed.z*.14+v.z*.86});
            const x=dot(p,g.east),z=dot(p,g.north);
            pools[g.id].push({v:p,order:morton(Math.floor((x+1)*127),Math.floor((z+1)*127))});
        }
        for(const g of graph.groups){
            const pool=pools[g.id].sort((a,b)=>a.order-b.order),list=members[g.id].sort((a,b)=>morton(a.xBin,a.yBin)-morton(b.xBin,b.yBin)||a.key.localeCompare(b.key));
            const capAngle=Math.max(...pool.map(p=>Math.acos(Math.max(-1,Math.min(1,dot(p.v,g.seed))))));
            for(let j=0;j<list.length;j++){list[j].normal=pool[Math.floor((j+.5)*pool.length/list.length)].v;list[j].ageAnchor=g.seed;list[j].ageCapAngle=capAngle;}
        }
        for(const n of result){
            n.n=n.indices.length;n.count=n.personIds.size;n.onset=n.onsetSum/n.count;n.duration=n.durationSum/n.count;n.style=SleepOccupations.style(n.code);
            n.weekdayWake=n.kind==='paired'?circularMean(n.wakeValues.map(v=>v[0])):null;n.weekendWake=n.kind==='paired'?circularMean(n.wakeValues.map(v=>v[1])):null;
            n.difference=n.kind==='paired'?n.wakeValues.reduce((s,v)=>s+shift(v[0],v[1]),0)/n.count:null;
            n.weekdayDuration=n.kind==='paired'?n.durationPairs.reduce((s,p)=>s+p[0],0)/n.count:null;
            n.weekendDuration=n.kind==='paired'?n.durationPairs.reduce((s,p)=>s+p[1],0)/n.count:null;
            n.durationDifference=n.kind==='paired'?n.weekendDuration-n.weekdayDuration:null;
            n.color=n.style.color;
            // Signed paired wake difference controls radial relief; missing pairs stay neutral.
            n.radialHeight=n.kind==='paired'?.36*Math.tanh(n.difference/3):0;
            const surfaceRadius=1+n.radialHeight;
            n.v=scale(n.normal,surfaceRadius);n.u=unit(cross(n.normal,Math.abs(n.normal.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0}));n.w=cross(n.normal,n.u);
            const density=Math.sqrt(n.count/maxCount);
            n.support=.008+.012*density;n.height=.025+.095*density;
            n.radius=.156*density; // Flat disk area is proportional to unique respondents.
            n.support=Math.min(n.support,n.radius*.5);
            n.layers=Array.from({length:7+Math.floor(6*density)},(_,j)=>j);
            n.layers=n.layers.map((_,j)=>{const t=j/(n.layers.length-1);return {offset:n.support+n.height*t,radius:n.radius*(.20+.80*Math.pow(Math.cos(t*Math.PI/2),.72))*(.95+.05*Math.sin(j*.8+n.groupId)),t};});
            const hist=new Map();for(const i of n.indices){const t=mod(Math.round((DATA[i][0]+18)*6),144);hist.set(t,(hist.get(t)||0)+1);}
            n.events=[...hist].map(([time,count])=>({time,weight:count/n.n}));
        }
        if(result.reduce((s,n)=>s+n.n,0)!==model.indices.length||result.reduce((s,n)=>s+n.count,0)!==model.persons.length)throw Error('Terrain partition mismatch');
        Object.assign(result,{pairedPeople,unpairedPeople,maxCount});
        result.tree=buildTree(result,graph);return result;
    }
    function bloom(n,time){
        let light=0;for(const e of n.events){const age=mod(time-e.time,144);if(age<8){const attack=Math.min(1,age/.5);light+=e.weight*attack*attack*(3-2*attack)*(1-age/8)**2;}}
        return {growth:.96+.08*light,light};
    }
    function hash(key){let h=2166136261;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);return (h>>>0)/4294967296;}
    const scale=(p,t)=>({x:p.x*t,y:p.y*t,z:p.z*t});
    const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    function curve(a,b,g,key,level){
        const h=hash(key),length=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z),bend=length*(level===0?.35:.20);
        const c=lerp(a,b,.32),d=lerp(a,b,.76),angle=h*tau;
        for(const axis of ['x','y','z']){c[axis]+=bend*(g.east[axis]*Math.cos(angle)+g.north[axis]*Math.sin(angle));d[axis]+=bend*.65*(g.east[axis]*Math.sin(angle+.7)+g.north[axis]*Math.cos(angle+.7));}
        return [a,c,d,b];
    }
    function cubic(c,t){const u=1-t;return {x:u*u*u*c[0].x+3*u*u*t*c[1].x+3*u*t*t*c[2].x+t*t*t*c[3].x,y:u*u*u*c[0].y+3*u*u*t*c[1].y+3*u*t*t*c[2].y+t*t*t*c[3].y,z:u*u*u*c[0].z+3*u*u*t*c[1].z+3*u*t*t*c[2].z+t*t*t*c[3].z};}
    function buildTree(nodes,graph){
        const origin={x:0,y:0,z:0},edges=[],primaries=[],secondaries=[],tertiaries=[];
        const add=(key,level,start,end,g,members,parent=null)=>{const edge={key,level,groupId:g.id,parent,members,curve:curve(start,end,g,key,level)};edges.push(edge);return edge;};
        const direction=list=>unit(list.reduce((p,n)=>({x:p.x+n.normal.x*n.count,y:p.y+n.normal.y*n.count,z:p.z+n.normal.z*n.count}),{x:0,y:0,z:0}));
        for(const g of graph.groups){
            const members=nodes.filter(n=>n.groupId===g.id),hub=scale(g.seed,.32);
            // Six visual origins exist even when a selected cohort has no records.
            const primary=add('age:'+g.id,0,origin,hub,g,members);primaries.push(primary);
            const occupations=new Map();for(const n of members){if(!occupations.has(n.code))occupations.set(n.code,[]);occupations.get(n.code).push(n);}
            for(const [code,occupationMembers] of occupations){
                const secondaryHub=scale(direction(occupationMembers),.56+.04*hash('occupation:'+g.id+':'+code));
                const secondary=add(primary.key+':occupation:'+code,1,hub,secondaryHub,g,occupationMembers,primary);secondaries.push(secondary);
                const times=new Map();for(const n of occupationMembers){const key=n.kind+':'+n.xBin;if(!times.has(key))times.set(key,[]);times.get(key).push(n);}
                for(const [key,timeMembers] of times){
                    const timeHub=scale(direction(timeMembers),.72+.04*hash(secondary.key+key));
                    const tertiary=add(secondary.key+':time:'+key,2,secondaryHub,timeHub,g,timeMembers,secondary);tertiaries.push(tertiary);
                    for(const n of timeMembers){
                        const base={x:n.v.x+n.normal.x*n.support,y:n.v.y+n.normal.y*n.support,z:n.v.z+n.normal.z*n.support};
                        const tip=add('formation:'+n.key,3,timeHub,base,g,[n],tertiary);
                        Object.defineProperties(n,{branch:{value:tip},branchChain:{value:[primary,secondary,tertiary,tip]}});
                        // Tilt the mound toward its terminal branch, preserving a broad silhouette.
                        const tangent=unit({x:base.x-tip.curve[2].x,y:base.y-tip.curve[2].y,z:base.z-tip.curve[2].z});
                        n.axis=unit(lerp(n.normal,tangent,.20));
                        n.u=unit(cross(n.axis,Math.abs(n.axis.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0}));n.w=cross(n.axis,n.u);
                    }
                }
            }
        }
        // No cycles: every formation has exactly one path to the visual origin.
        return {origin,edges,primaries,secondaries,tertiaries};
    }
    function sway(p,id,time,reduced){if(reduced)return p;const r=Math.hypot(p.x,p.y,p.z),a=time*tau/144;return {x:p.x+.006*p.z*r*Math.sin(a+id),y:p.y+.005*p.x*r*Math.cos(a*.5+id),z:p.z+.004*p.y*r*Math.sin(a*.7+id)};}
    function branchCurve(edge,states){
        const c=edge.curve;
        if(edge.level!==3)return c;
        const n=edge.members[0],growth=states.get(n).growth;
        // Use the exact same animated first-layer center as the formation renderer.
        return [c[0],c[1],c[2],{x:n.v.x+n.axis.x*n.support*growth,y:n.v.y+n.axis.y*n.support*growth,z:n.v.z+n.axis.z*n.support*growth}];
    }
    function drawBranches(ctx,nodes,options,states,visible,foreground=false){
        const {screen,time,opacity,matches,filtered,reduced,ageColors}=options,tree=nodes.tree,batches=new Map(),pulses=new Map();let calls=0;
        if(!tree)return {calls:0,pulses:0};
        const palette=ageColors||['#8AB8ED','#9C91EB','#D28FCB','#E59C9B','#D5B77D','#8DBFB4'];
        const batch=(key,color,alpha,width)=>{if(!batches.has(key))batches.set(key,{path:new Path2D(),color,alpha,width});return batches.get(key).path;};
        for(const edge of tree.edges){
            if(foreground&&edge.level>1)continue;
            if(edge.level===3&&!visible.has(edge.members[0]))continue;
            const selectedMembers=edge.members.filter(n=>!filtered||matches(n)),member=selectedMembers.length>0;
            const activation=selectedMembers.reduce((sum,n)=>sum+states.get(n).light*n.n,0)/Math.max(1,selectedMembers.reduce((sum,n)=>sum+n.n,0));
            const view=p=>screen(sway(p,edge.groupId,time,reduced)),c=branchCurve(edge,states),depth=Math.max(.2,Math.min(1,(view(c[3]).z+1)/2));
            const alpha=opacity*(member?(foreground?[.78,.42,.0,.0]:[.82,.54,.31,.23])[edge.level]*(.73+.27*depth)*(1+activation*.35):.028);
            // Three tapered sections per shared edge, batched by age / hierarchy / depth.
            for(let section=0;section<3;section++){
                const width=[2.0,1.05,.64,.42][edge.level]*(1-section*.17),key=[edge.groupId,edge.level,section,member,Math.floor(depth*3)].join(':');
                const path=batch(key,palette[edge.groupId],alpha,width);
                for(let k=0;k<=4;k++){const q=view(cubic(c,(section+k/4)/3));if(k===0)path.moveTo(q.x,q.y);else path.lineTo(q.x,q.y);}
            }
            if(edge.level<3&&member){const q=view(c[3]),path=batch('joint:'+edge.groupId,palette[edge.groupId],opacity*.55,1.4);path.moveTo(q.x-.65,q.y);path.lineTo(q.x+.65,q.y);}
        }
        // A pulse is a timed visual signal for an aggregate onset event, never a person trajectory.
        if(!foreground&&!reduced)for(const n of visible){if(filtered&&!matches(n))continue;
            for(const event of n.events){const age=mod(time-event.time,144);if(age>=4)continue;
                const progress=age/4,stage=Math.min(3,Math.floor(progress*4)),t=progress*4-stage,edge=n.branchChain[stage],key=edge.key+':'+Math.floor(t*24);
                const weight=event.weight*(.30+.70*Math.sin(Math.PI*progress));
                if(!pulses.has(key)||pulses.get(key).weight<weight)pulses.set(key,{edge,t,weight});
            }
        }
        for(const p of pulses.values()){
            const view=v=>screen(sway(v,p.edge.groupId,time,reduced)),curve=branchCurve(p.edge,states),q=view(cubic(curve,p.t)),tail=view(cubic(curve,Math.max(0,p.t-.055)));
            const path=batch('pulse:'+p.edge.groupId+':'+Math.floor(p.weight*3),'#DDD5F1',opacity*(.28+.45*p.weight),1.4);path.moveTo(tail.x,tail.y);path.lineTo(q.x,q.y);
        }
        for(const b of batches.values()){ctx.globalAlpha=b.alpha;ctx.strokeStyle=b.color;ctx.lineWidth=b.width;ctx.stroke(b.path);calls++;}
        return {calls,pulses:pulses.size};
    }
    function drawCore(ctx,screen,opacity,sphereRadius){
        const core=screen({x:0,y:0,z:0}),r=Math.max(5,Math.min(13,sphereRadius*.026));
        if(ctx.createRadialGradient){const glow=ctx.createRadialGradient(core.x,core.y,0,core.x,core.y,r);glow.addColorStop(0,'rgba(228,216,255,.45)');glow.addColorStop(.32,'rgba(192,174,229,.15)');glow.addColorStop(1,'rgba(177,156,216,0)');ctx.globalAlpha=opacity;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(core.x,core.y,r,0,tau);ctx.fill();}
        const path=new Path2D();ellipse(path,core,{x:1.8,y:0},{x:0,y:1.8});ctx.globalAlpha=opacity*.95;ctx.fillStyle='#EEE7FF';ctx.fill(path);
    }
    const mix=(hex,target,t)=>{const c=[1,3,5].map(i=>Math.round(parseInt(hex.slice(i,i+2),16)*(1-t)+parseInt(target.slice(i,i+2),16)*t));return '#'+c.map(v=>v.toString(16).padStart(2,'0')).join('');};
    function ellipse(path,c,a,b){
        const k=.5522847498;
        path.moveTo(c.x+a.x,c.y+a.y);
        path.bezierCurveTo(c.x+a.x+k*b.x,c.y+a.y+k*b.y,c.x+b.x+k*a.x,c.y+b.y+k*a.y,c.x+b.x,c.y+b.y);
        path.bezierCurveTo(c.x+b.x-k*a.x,c.y+b.y-k*a.y,c.x-a.x+k*b.x,c.y-a.y+k*b.y,c.x-a.x,c.y-a.y);
        path.bezierCurveTo(c.x-a.x-k*b.x,c.y-a.y-k*b.y,c.x-b.x-k*a.x,c.y-b.y-k*a.y,c.x-b.x,c.y-b.y);
        path.bezierCurveTo(c.x-b.x+k*a.x,c.y-b.y+k*a.y,c.x+a.x-k*b.x,c.y+a.y-k*b.y,c.x+a.x,c.y+a.y);path.closePath();
    }
    function draw(ctx,nodes,options){
        const {screen,time,opacity,sphereRadius,matches,filtered,mode,reduced}=options;
        const views=[],bands=Array.from({length:8},()=>new Map());let drawCalls=0;
        const states=new Map(nodes.map(n=>[n,reduced?{growth:1,light:0}:bloom(n,time)]));
        const visible=new Set(nodes.filter(n=>screen(n.normal).z>=.10));
        const branches=drawBranches(ctx,nodes,options,states,visible);drawCalls+=branches.calls;
        // Thin stems expose the signed displacement from the unit reference sphere.
        const stems=new Map();
        for(const n of visible){
            if(Math.abs(n.radialHeight)<.001)continue;
            const muted=filtered&&!matches(n),key=n.color+':'+muted;
            if(!stems.has(key))stems.set(key,{path:new Path2D(),color:n.color,muted});
            const view=p=>screen(sway(p,n.groupId,time,reduced));
            const a=view(n.normal),b=view({x:n.v.x+n.axis.x*n.support*states.get(n).growth,y:n.v.y+n.axis.y*n.support*states.get(n).growth,z:n.v.z+n.axis.z*n.support*states.get(n).growth});
            const path=stems.get(key).path;path.moveTo(a.x,a.y);path.lineTo(b.x,b.y);
        }
        for(const stem of stems.values()){ctx.globalAlpha=opacity*(stem.muted?.04:.42);ctx.strokeStyle=stem.color;ctx.lineWidth=.7;ctx.stroke(stem.path);drawCalls++;}
        const batch=(band,key,color,alpha,width)=>{const map=bands[band];if(!map.has(key))map.set(key,{path:new Path2D(),color,alpha,width});return map.get(key).path;};
        for(const n of nodes){
            const normalView=screen(n.normal);
            // Opaque sphere occludes the rear hemisphere: no rear pins around its rim.
            if(normalView.z<.10)continue;
            const growth=states.get(n).growth,muted=filtered&&!matches(n),view=p=>screen(sway(p,n.groupId,time,reduced));
            const band=Math.min(7,Math.max(0,Math.floor(normalView.z*8))),depth=.70+.30*normalView.z;
            const alpha=opacity*(muted?.075:(.50+.30*states.get(n).light)*depth)*(n.kind==='paired'||mode==='compare'||mode===n.kind?1:.64);
            const tone=muted?'#565360':n.color;
            // Single flat disks tangent to the sphere surface, without relief or strata.
            // Center equals the animated terminal endpoint used by branchCurve.
            const world={x:n.v.x+n.axis.x*n.support*growth,y:n.v.y+n.axis.y*n.support*growth,z:n.v.z+n.axis.z*n.support*growth};
            const center=view(world),tangent=unit(cross(n.normal,Math.abs(n.normal.y)<.9?{x:0,y:1,z:0}:{x:1,y:0,z:0})),bitangent=cross(n.normal,tangent);
            const projectAxis=axis=>{const p=view({x:world.x+axis.x*n.radius,y:world.y+axis.y*n.radius,z:world.z+axis.z*n.radius});return {x:p.x-center.x,y:p.y-center.y};};
            const ellipseU=projectAxis(tangent),ellipseV=projectAxis(bitangent);
            const radius=Math.hypot(ellipseU.x,ellipseU.y,ellipseV.x,ellipseV.y);
            const path=batch(band,tone+':'+(muted?'muted':mode!==n.kind&&n.kind!=='paired'&&mode!=='compare'?'dim':'active'),tone,opacity*(muted?.10:.86)*(n.kind==='paired'||mode==='compare'||mode===n.kind?1:.64),0);
            ellipse(path,center,ellipseU,ellipseV);
            views.push({node:n,x:center.x,y:center.y,z:normalView.z,radius,ellipseU,ellipseV,muted,alpha});
        }
        for(const map of bands)for(const b of map.values()){
            ctx.globalAlpha=b.alpha;ctx.fillStyle=b.color;ctx.fill(b.path);drawCalls++;
        }
        const foreground=drawBranches(ctx,nodes,options,states,visible,true);drawCalls+=foreground.calls;
        drawCore(ctx,screen,opacity,sphereRadius);
        views.drawCalls=drawCalls+2;views.branchDrawCalls=branches.calls+foreground.calls;views.activePulses=branches.pulses;views.culled=nodes.length-views.length;return views;
    }
    return {build,bloom,draw,wake,clock,shift,branchCurve,sway,cubic};
})();
