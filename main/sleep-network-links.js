// Code-only tuning. These display parameters never alter original diary values.
const SleepConstellationConfig = Object.freeze({
    surface: {onsetRankMix: .62, durationRankMix: .70, territoryFill: .975,
        packingJitter: .009, dayLane: .006, boundarySamples: 128, boundaryNoise: .035},
    sculpture: {radius: .82, centerRadius: .85, strands: 56, strandSamples: 72, nodeGlyphs: 3, flex: .016},
    network: {maxDegree: 12, maxLocalEdges: 15000, neighborChord: .14,
        onsetHours: 1.25, durationHours: 2, ageYears: 25, comparisonSamples: 64},
    particles: {starsPerBin: 5, maxStars: 12, mobileStars: 3, starCellFill: .85, majorPerGroup: 3,
        brightness: 1.0, coreBase: .78, coreCountScale: .28},
    motion: {daySeconds: 60, comparisonSeconds: 15, rotationSeconds: 115,
        streamsPerPath: 4, flowSeconds: 4.2, trailSamples: 3,
        waveIntensity: .16, radialBreath: .006, flicker: .055, manualPauseMs: 2400},
    palette: {weekday: '#83CEDC', weekend: '#E9A8C9', connection: '#BCAFD5',
        warm: '#E6D0AF', background: getComputedStyle(document.documentElement).getPropertyValue('--background').trim() || '#050408'}
});

// Read-only statistics feed a surface atlas. Empirical ranks supply display
// packing, not quantitative screen distances. Original values stay on every bin.
const SleepNetworkLinks = (() => {
    const C = SleepConstellationConfig, tau = Math.PI * 2;
    const mean = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
    const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
    const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
    const unit = p => {const n=Math.hypot(p.x,p.y,p.z)||1;return {x:p.x/n,y:p.y/n,z:p.z/n};};
    const cross = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
    const shortest = (a,b) => ((b-a+12)%24+24)%24-12;
    function hash(key) {let h=2166136261;for(let i=0;i<key.length;i++)h=Math.imul(h^key.charCodeAt(i),16777619);return (h>>>0)/4294967296;}
    function ranks(indices,field) {
        const bins=new Map();for(const i of indices)bins.set(DATA[i][field],(bins.get(DATA[i][field])||0)+1);
        const entries=[...bins].sort((a,b)=>a[0]-b[0]);let sum=0;
        return {entries:entries.map(([value,n])=>{const rank=(sum+n/2)/indices.length;sum+=n;return {value,rank};}),min:entries[0]?.[0]??0,max:entries[entries.length-1]?.[0]??1};
    }
    function rankAt(table,value) {
        const a=table.entries;if(!a.length)return .5;if(value<=a[0].value)return a[0].rank;if(value>=a[a.length-1].value)return a[a.length-1].rank;
        let lo=0,hi=a.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m].value<=value)lo=m;else hi=m;}
        const t=(value-a[lo].value)/(a[hi].value-a[lo].value||1);return a[lo].rank*(1-t)+a[hi].rank*t;
    }
    function footprint(table,value,global,mix) {
        const entries=table.entries;if(entries.length<2)return .025;
        let i=0;while(i<entries.length-1&&entries[i].value<value-1e-6)i++;
        const coordinate=j=>mix*entries[j].rank+(1-mix)*(entries[j].value-global.min)/(global.max-global.min||1);
        const own=coordinate(i),left=i?coordinate(i-1):own-.03,right=i<entries.length-1?coordinate(i+1):own+.03;
        return Math.max(.014,Math.min(.12,(right-left)/2))*C.particles.starCellFill;
    }
    const geometryNames = ['Radial branching', 'Open asymmetric spiral',
        'Intersecting orbital ribbons', 'Polygonal curved web', 'Interlocking knots', 'Layered torus'];

    // Six deliberately DIFFERENT generative constructions. These shapes encode
    // age identity; their branches/ribbons/rings are NOT inferred social links.
    // u is the measured onset progression, v the measured duration progression.
    function localGeometry(u,v,id) {
        const t=tau*u,k=tau*v;
        let x,y,z;
        switch(id) {
        case 0: { // Three hubs with open, branching radial arms, not closed loops.
            const hub=Math.min(2,Math.floor(v*3)),f=v*3-hub;
            const hubs=[[-.19,-.06],[.20,-.03],[-.01,.22]];
            const angle=tau*f+hub*.73+.24*Math.sin(Math.PI*u);
            const length=(.76+.24*Math.sin(f*Math.PI))*(.08+Math.pow(u,.85));
            x=hubs[hub][0]+length*Math.cos(angle);
            y=hubs[hub][1]+.88*length*Math.sin(angle);
            z=.18*Math.sin(angle)+.25*Math.sin(Math.PI*u+hub*.8);
            break;
        }
        case 1: { // An OPEN, expanding spiral with a large asymmetric aperture.
            const angle=-.78*Math.PI+tau*1.43*u+.13*Math.sin(k),r=.13+.98*Math.pow(u,1.18);
            x=1.07*r*Math.cos(angle)+.17*u+.055*Math.cos(k+2*angle);
            y=.72*r*Math.sin(angle)-.11*u+.055*Math.sin(k);
            z=.28*Math.sin(angle*.73)+.18*(v-.5)+.10*Math.cos(2*angle+k);
            break;
        }
        case 2: { // Two intersecting elongated ribbon orbits, with real 3D width.
            const family=v<.5?-1:1,channel=(v*2)%1-.5;
            x=1.34*Math.cos(t)+.11*Math.sin(2*t)+family*.08;
            const yy=.37*Math.sin(t)+.045*Math.sin(3*t)+channel*.11;
            const zz=.13*Math.sin(2*t)+channel*.19;
            const angle=family*.78+channel*.35;
            y=yy*Math.cos(angle)-zz*Math.sin(angle);
            z=yy*Math.sin(angle)+zz*Math.cos(angle);
            break;
        }
        case 3: { // An irregular seven-sided web; rings, spokes and cross-weaves.
            const vertices=7,position=u*vertices,edge=Math.floor(position)%vertices,f=position-Math.floor(position);
            const vertex=j=>{
                const angle=tau*(j%vertices)/vertices+.10*Math.sin(j*2.1);
                const r=.90+.15*Math.sin(j*1.7+.5);
                return {x:r*Math.cos(angle),y:.87*r*Math.sin(angle)};
            };
            const a=vertex(edge),b=vertex((edge+1)%vertices),r=.10+.95*Math.sqrt(v);
            const bow=.055*Math.sin(Math.PI*f);
            x=r*(a.x*(1-f)+b.x*f)-bow*Math.sin(t);
            y=r*(a.y*(1-f)+b.y*f)+bow*Math.cos(t);
            z=.19*Math.sin(2*t)*r+.13*Math.cos(3*t+k)+.10*Math.sin(k);
            break;
        }
        case 4: { // Interlocking trefoil and figure-eight knot families.
            if(v<.64){
                const phase=(v/.64-.5)*.65,angle=t+phase;
                const r=.64+.25*Math.cos(3*angle);
                x=r*Math.cos(2*angle)+.08*Math.sin(k);
                y=.84*r*Math.sin(2*angle);
                z=.36*Math.sin(3*angle)+.07*Math.cos(k);
            } else {
                const phase=(v-.64)/.36*tau,angle=t+.12*Math.sin(phase);
                x=.32*(2+Math.cos(2*angle))*Math.cos(3*angle);
                y=.28*(2+Math.cos(2*angle))*Math.sin(3*angle);
                z=.30*Math.sin(4*angle)+.10*Math.sin(phase);
            }
            break;
        }
        default: { // A broad torus with an OPEN central hole and layered rings.
            const major=.80,minor=.19;
            x=(major+minor*Math.cos(k))*Math.cos(t);
            const yy=.87*(major+minor*Math.cos(k))*Math.sin(t);
            const zz=.25*Math.sin(k)+.055*Math.sin(3*t);
            y=yy*Math.cos(.30)-zz*Math.sin(.30);
            z=yy*Math.sin(.30)+zz*Math.cos(.30);
        }
        }
        return {x,y,z};
    }
    function placeLocal(p,g,kind='weekday') {
        // Wrap the expansive tangent-plane form along the parent globe, rather
        // than placing a small ellipsoid inside it. Depth stays shallow and all
        // nodes/strands are bounded by the original globe radius.
        const x=p.x*g.size,y=p.y*g.size,theta=Math.hypot(x,y),s=theta?Math.sin(theta)/theta:1,c=Math.cos(theta);
        const radius=clamp(g.radius+.105*p.z+(kind==='weekday'?-.005:.005),.65,.975);
        return {x:(g.seed.x*c+(g.east.x*x+g.north.x*y)*s)*radius,
            y:(g.seed.y*c+(g.east.y*x+g.north.y*y)*s)*radius,
            z:(g.seed.z*c+(g.east.z*x+g.north.z*y)*s)*radius};
    }
    function sculpturePoint(u,v,g,kind='weekday') {
        return placeLocal(localGeometry(u,v,g.id),g,kind);
    }
    function surfacePoint(onset,duration,g,kind,jitterU=0,jitterV=0) {
        const rawU=(onset-g.globalOnset.min)/(g.globalOnset.max-g.globalOnset.min||1);
        const rawV=(duration-g.globalDuration.min)/(g.globalDuration.max-g.globalDuration.min||1);
        const dataU=C.surface.onsetRankMix*rankAt(g.onsetRanks,onset)+(1-C.surface.onsetRankMix)*rawU;
        const dataV=C.surface.durationRankMix*rankAt(g.durationRanks,duration)+(1-C.surface.durationRankMix)*rawV;
        const p=sculpturePoint(clamp(dataU+jitterU,.003,.997),clamp(dataV+jitterV,.003,.997),g,kind);
        return {...p,dataU,dataV};
    }
    function owner(p,groups) {
        let best=Infinity,id=-1;
        for(const g of groups){if(!g.active)continue;const d=Math.hypot(p.x-g.center.x,p.y-g.center.y,p.z-g.center.z)/(g.size||1);if(d<best){best=d;id=g.id;}}
        return id;
    }
    function curve(a,b,lift=.025,segments=16) {
        const ra=Math.hypot(a.x,a.y,a.z),rb=Math.hypot(b.x,b.y,b.z),u=unit(a),v=unit(b);
        const angle=Math.acos(clamp(dot(u,v),-1,1)),sin=Math.sin(angle);
        return Array.from({length:segments+1},(_,j)=>{
            const t=j/segments,wa=angle<1e-5?1-t:Math.sin((1-t)*angle)/sin,wb=angle<1e-5?t:Math.sin(t*angle)/sin;
            const radius=Math.min(.98,ra*(1-t)+rb*t+lift*Math.sin(Math.PI*t));
            return {x:(u.x*wa+v.x*wb)*radius,y:(u.y*wa+v.y*wb)*radius,z:(u.z*wa+v.z*wb)*radius};
        });
    }
    function build(indices,model) {
        const nodes=[],byKey=new Map(),recordNodes=new Map(),personById=new Map(model.persons.map(p=>[p.id,p]));
        for(const i of indices) {
            const [onset,duration,day]=DATA[i],demographic=SleepDemographics.rows[i];
            const groupId=model.groups.find(g=>demographic[1]>=g.min&&demographic[1]<=g.max).id,kind=day===1?'weekday':'weekend';
            const key=[groupId,kind,Math.round(onset*6),Math.round(duration*6)].join(':');
            let n=byKey.get(key);
            if(!n){n={key,groupId,kind,indices:[],personIds:new Set(),onsetSum:0,durationSum:0};byKey.set(key,n);nodes.push(n);}
            n.indices.push(i);n.personIds.add(demographic[0]);n.onsetSum+=onset;n.durationSum+=duration;recordNodes.set(i,n);
        }

        const globalOnset=ranks(indices,0),globalDuration=ranks(indices,1);
        // Six non-coplanar anchors spread across the existing globe. Transform
        // the art direction back into world space; camera/rotation are unchanged.
        const anchors=[{x:-.16,y:.30,z:.82},{x:.52,y:.02,z:.60},{x:.24,y:-.36,z:.64},
            {x:-.50,y:-.20,z:.38},{x:-.12,y:-.54,z:-.58},{x:-.32,y:.38,z:-.56}];
        const seeds=anchors.map(p=>{
            const cp=Math.cos(-.16),sp=Math.sin(-.16),cy=Math.cos(.48),sy=Math.sin(.48);
            const y=p.y*cp+p.z*sp,z=p.z*cp-p.y*sp;
            return unit({x:p.x*cy-z*sy,y,z:p.x*sy+z*cy});
        });
        const order=[0,1,2,3,4,5];
        const maxPeople=Math.max(1,...model.groups.map(g=>g.stats.people));
        const groups=model.groups.map((g,id)=>{
            const own=indices.filter(i=>recordNodes.get(i).groupId===id),seed=seeds[order[id]];
            const east=unit(cross(Math.abs(seed.y)>.94?{x:0,y:0,z:1}:{x:0,y:1,z:0},seed)),north=unit(cross(seed,east));
            const centerRadius=C.sculpture.centerRadius+[-.005,.025,-.025,.015,-.01,.01][id];
            const center={x:seed.x*centerRadius,y:seed.y*centerRadius,z:seed.z*centerRadius};
            return {id,active:!!own.length,seed,east,north,center,radius:centerRadius,geometry:geometryNames[id],size:C.sculpture.radius*Math.cbrt(g.stats.people/maxPeople),people:g.stats.people,bias:clamp(.07*Math.log(Math.max(.01,g.stats.people/Math.max(1,model.stats.people))*6),-.12,.12),
                onsetRanks:ranks(own,0),durationRanks:ranks(own,1),globalOnset,globalDuration,border:[]};
        });
        for(const [id,n]of nodes.entries()) {
            n.networkId=id;n.n=n.indices.length;n.count=n.personIds.size;n.onset=n.onsetSum/n.n;n.duration=n.durationSum/n.n;
            n.persons=[...n.personIds].map(id=>personById.get(id));n.meanAge=mean(n.persons.map(p=>p.age));n.occupations=new Map();
            const known=n.persons.filter(p=>p.occupation);for(const p of known)n.occupations.set(p.occupation,(n.occupations.get(p.occupation)||0)+1/known.length);
            const seed=[n.groupId,Math.round(n.onset*6),Math.round(n.duration*6)].join(':');
            n.jitterU=(hash(seed+':u')-.5)*C.surface.packingJitter;n.jitterV=(hash(seed+':v')-.5)*C.surface.packingJitter;
            n.v=surfacePoint(n.onset,n.duration,groups[n.groupId],n.kind,n.jitterU,n.jitterV);
            n.dataU=n.v.dataU;n.dataV=n.v.dataV;
            const count=Math.min(C.particles.maxStars,C.particles.starsPerBin+Math.floor(Math.sqrt(n.n)*.75));
            // Star glyphs sample the DISPLAY footprint of the measured time bin,
            // not newly estimated sleep times or additional respondents.
            const g=groups[n.groupId],spanU=footprint(g.onsetRanks,n.onset,globalOnset,C.surface.onsetRankMix),spanV=footprint(g.durationRanks,n.duration,globalDuration,C.surface.durationRankMix);
            n.stars=Array.from({length:count},(_,j)=>surfacePoint(n.onset,n.duration,groups[n.groupId],n.kind,
                n.jitterU+(hash(seed+':su'+j)-.5)*spanU,n.jitterV+(hash(seed+':sv'+j)-.5)*spanV));
            const start=Math.round(((18+n.onset)%24)*6)%144,duration=Math.round(n.duration*6);
            n.activity=Float32Array.from({length:144},(_,t)=>(t-start+144)%144<duration?1:0);n.onsetTick=start;n.wakeTick=(start+duration)%144;n.target=n.v;
        }
        for(const g of groups){
            const own=nodes.filter(n=>n.groupId===g.id),ranked=own.slice().sort((a,b)=>b.n-a.n||a.key.localeCompare(b.key));
            ranked.slice(0,C.particles.majorPerGroup).forEach(n=>n.major=true);

        }
        const activity=model.groups.map(g=>Object.fromEntries(['weekday','weekend'].map(kind=>{
            const people=g.persons.filter(p=>p[kind].length),curve=new Float32Array(144);
            for(const p of people)for(const i of p[kind]){const n=recordNodes.get(i),weight=1/(people.length*p[kind].length);for(let t=0;t<144;t++)curve[t]+=n.activity[t]*weight;}
            return [kind,curve];
        })));

        const distributions=[];
        for(const g of groups){
            const sets=Object.fromEntries(['weekday','weekend'].map(kind=>[kind,indices.filter(i=>recordNodes.get(i).groupId===g.id&&recordNodes.get(i).kind===kind).sort((a,b)=>DATA[a][0]-DATA[b][0]||DATA[a][1]-DATA[b][1]||a-b)]));
            if(!sets.weekday.length||!sets.weekend.length)continue;
            for(const kind of ['weekday','weekend']){const other=kind==='weekday'?'weekend':'weekday';let sum=0;
                for(const n of nodes.filter(n=>n.groupId===g.id&&n.kind===kind).sort((a,b)=>a.onset-b.onset||a.duration-b.duration)){
                    const q=(sum+n.n/2)/sets[kind].length;sum+=n.n;const index=sets[other][Math.min(sets[other].length-1,Math.floor(q*sets[other].length))];
                    n.counterpart=DATA[index][0];n.counterpartDuration=DATA[index][1];n.target=surfacePoint(n.counterpart,n.counterpartDuration,g,n.kind,n.jitterU,n.jitterV);
                }
            }
            const count=Math.min(C.network.comparisonSamples,Math.max(16,Math.round(Math.sqrt(sets.weekday.length+sets.weekend.length))));
            const unique=new Map();
            for(let j=0;j<count;j++){
                const q=(j+.5)/count,a=sets.weekday[Math.floor(q*sets.weekday.length)],b=sets.weekend[Math.floor(q*sets.weekend.length)];
                const weekdayNode=recordNodes.get(a),weekendNode=recordNodes.get(b),key=weekdayNode.key+'>'+weekendNode.key;
                if(unique.has(key)){unique.get(key).mass+=1/count;continue;}
                const shift=shortest(DATA[a][0],DATA[b][0]),durationShift=DATA[b][1]-DATA[a][1];
                const magnitude=Math.min(1,Math.abs(shift)/2+Math.abs(durationShift)/3);
                const d={groupId:g.id,quantile:q,weekday:DATA[a][0],weekend:DATA[b][0],shift,durationShift,magnitude,mass:1/count,weekdayNode,weekendNode,
                    path:curve(weekdayNode.v,weekendNode.v,.012+.035*magnitude)};
                unique.set(key,d);distributions.push(d);
            }
        }
        const N=C.network,pitch=N.neighborChord,grid=new Map(),key=(g,k,x,y,z)=>[g,k,x,y,z].join(':');
        for(const n of nodes){n.grid=[Math.floor(n.v.x/pitch),Math.floor(n.v.y/pitch),Math.floor(n.v.z/pitch)];const id=key(n.groupId,n.kind,...n.grid);if(!grid.has(id))grid.set(id,[]);grid.get(id).push(n);}
        const candidates=[];
        for(const a of nodes)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
            for(const b of grid.get(key(a.groupId,a.kind,a.grid[0]+dx,a.grid[1]+dy,a.grid[2]+dz))||[]){
                if(b.networkId<=a.networkId)continue;const distance=Math.hypot(a.v.x-b.v.x,a.v.y-b.v.y,a.v.z-b.v.z);if(distance>N.neighborChord)continue;
                const onset=Math.abs(shortest(a.onset,b.onset)),duration=Math.abs(a.duration-b.duration),age=Math.abs(a.meanAge-b.meanAge);
                if(onset>N.onsetHours||duration>N.durationHours||age>N.ageYears)continue;
                let occupation=0;if(a.occupations.size&&b.occupations.size){let overlap=0;for(const [k,v]of a.occupations)overlap+=Math.min(v,b.occupations.get(k)||0);occupation=1-overlap;}
                const score=(onset/N.onsetHours)**2+(duration/N.durationHours)**2+.15*(age/N.ageYears)**2+.25*occupation;
                if(score>1.7)continue;candidates.push({a:a.networkId,b:b.networkId,score,cost:score+.55*(distance/N.neighborChord)**2});
            }
        }
        candidates.sort((a,b)=>a.cost-b.cost||a.a-b.a||a.b-b.b);
        const degree=new Uint8Array(nodes.length),accepted=[];
        for(const e of candidates){if(accepted.length>=N.maxLocalEdges)break;if(degree[e.a]>=N.maxDegree||degree[e.b]>=N.maxDegree)continue;degree[e.a]++;degree[e.b]++;accepted.push(e);}
        const edges={from:Uint16Array.from(accepted,e=>e.a),to:Uint16Array.from(accepted,e=>e.b),similarity:Float32Array.from(accepted,e=>1/(1+e.score)),degree};
        // The minimal backbone compares age-level sample profiles. These are NOT
        // correlations, social ties, nor matches between respondents of different ages.
        const profiles=model.groups.filter(g=>g.stats.people).map(g=>({id:g.id,
            onset:mean(g.persons.map(p=>mean(p.indices.map(i=>DATA[i][0])))),
            duration:mean(g.persons.map(p=>mean(p.indices.map(i=>DATA[i][1]))))}));
        const pairs=[];for(let i=0;i<profiles.length;i++)for(let j=i+1;j<profiles.length;j++){
            const a=profiles[i],b=profiles[j];pairs.push({a:a.id,b:b.id,onsetDifference:shortest(a.onset,b.onset),durationDifference:b.duration-a.duration,
                score:Math.hypot(shortest(a.onset,b.onset)/2,(a.duration-b.duration)/3)});
        }
        pairs.sort((a,b)=>a.score-b.score||a.a-b.a||a.b-b.b);
        const parent=groups.map(g=>g.id),root=a=>parent[a]===a?a:(parent[a]=root(parent[a])),backbone=[];
        for(const e of pairs){const a=root(e.a),b=root(e.b);if(a===b)continue;parent[a]=b;backbone.push({...e,path:curve(groups[e.a].center,groups[e.b].center,.035,24)});}
        const strands=[];
        for(const g of groups){
            if(!g.active)continue;
            const density=[1.10,.86,1.0,1.30,1.15,1.0][g.id];
            const count=Math.round(C.sculpture.strands*density*(.80+.20*g.size/C.sculpture.radius));
            const add=(path,channel,topology)=>strands.push({groupId:g.id,path,channel,
                decorative:true,topology,foreground:channel%8===0});
            for(let j=0;j<count;j++){
                const q=(j+.5)/count,entries=g.durationRanks.entries;
                const entry=entries.find(e=>e.rank>=q)||entries[entries.length-1];
                const raw=entry?(entry.value-globalDuration.min)/(globalDuration.max-globalDuration.min||1):q;
                const v=clamp(.70*q+.30*raw,.005,.995),path=[];
                for(let i=0;i<=C.sculpture.strandSamples;i++){
                    const u=i/C.sculpture.strandSamples;
                    let p;
                    if(g.id===0 && j%3===2){
                        // True secondary twigs grow out of their parent arm.
                        const start=.36+.20*Math.sin(j*1.7),a=localGeometry(start,v,0),b=localGeometry(.98,v,0);
                        const angle=(j%2?1:-1)*(.40+.12*Math.sin(j));
                        const dx=b.x-a.x,dy=b.y-a.y;
                        p=placeLocal({x:a.x+u*(dx*Math.cos(angle)-dy*Math.sin(angle))*.72,
                            y:a.y+u*(dx*Math.sin(angle)+dy*Math.cos(angle))*.72,
                            z:a.z+u*(b.z-a.z)+.09*Math.sin(Math.PI*u)},g);
                    } else if(g.id===3 && j%3===1){
                        p=sculpturePoint(q,u,g); // radial spokes of the polygonal web
                    } else if(g.id===3 && j%3===2){
                        // Cross-weaves connect the web's rings, not respondents.
                        const angle=(q+u*.27)%1,duration=.12+.76*Math.sin(Math.PI*u)**2;
                        p=sculpturePoint(angle,duration,g);
                    } else if(g.id===5 && j%5===4){
                        p=sculpturePoint(q,u,g); // toroidal meridians through major rings
                    } else {
                        p=sculpturePoint(u,v,g,j%2?'weekday':'weekend');
                    }
                    path.push(p);
                }
                const topology=g.id===0?(j%3===2?'twig':'radial arm'):
                    g.id===1?'open spiral':g.id===2?'ribbon orbit':g.id===3?
                    ['polygon ring','radial spoke','cross-weave'][j%3]:g.id===4?'knot loop':j%5===4?'torus meridian':'torus ring';
                add(path,j,topology);
                if(g.id===0 && j%3===2){
                    // Render the actual parent arm too, including the exact fork
                    // vertex. The branch graph is a visual encoding, not kinship.
                    const fork=.36+.20*Math.sin(j*1.7);
                    const parameters=[...Array.from({length:C.sculpture.strandSamples+1},(_,i)=>i/C.sculpture.strandSamples),fork].sort((a,b)=>a-b);
                    add(parameters.map(u=>sculpturePoint(u,v,g)),j+count,'radial parent');
                }
            }
        }
        const guideNormals=[unit({x:.4,y:.8,z:.35}),unit({x:.8,y:-.3,z:.55}),unit({x:-.4,y:.3,z:.85})];
        const guides=guideNormals.map(normal=>{const a=unit(cross(normal,{x:0,y:1,z:0})),b=cross(normal,a);return Array.from({length:97},(_,j)=>{
            const t=j/96*tau;return {x:(a.x*Math.cos(t)+b.x*Math.sin(t))*1.015,y:(a.y*Math.cos(t)+b.y*Math.sin(t))*1.015,z:(a.z*Math.cos(t)+b.z*Math.sin(t))*1.015};});});
        return {nodes,recordNodes,groups,activity,distributions,edges,backbone,guides,strands,personById,
            semantics:'Six distinct age-specific branching/spiral/ribbon/web/knot/torus geometries are decorative visual encodings, not inferred relationships. Real onset/duration ranks position measured bins. Short links encode aggregate similarity; percentile/profile paths compare distributions, never individuals. Loop strands are not statistical links.'};
    }
    return {build,surfacePoint,sculpturePoint,localGeometry,shortest,owner,curve};
})();
