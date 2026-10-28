// Stable spherical territories with independent data-time and comparison-animation clocks.
const SleepNetwork = (() => {
    const $ = id => document.getElementById(id);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const C = SleepConstellationConfig;
    const colors = C.palette;
    const tau = Math.PI * 2, daySeconds = C.motion.daySeconds, rotationSeconds = C.motion.rotationSeconds;
    let model = null, graph = null, nodes = [], viewport = null, projected = [], labels = [];
    let yaw = .62, pitch = -.22, zoom = 1, selected = null, hover = null, hoverPoint = null, hoverNode = null, pointer = null;
    let animationSeconds = 0, metrics = {}, phaseCache = null, flexCache = null;
    let botanicals = [];
    let surfaceView=false,surfaceBlend=0,cameraFlight=null,meanDrawMs=0;
    let occupationData = null, occupationFocus = null, displayDistributions = [];
    const selection={selectedAgeGroup:null,selectedOccupation:null,selectedOccupations:[]};
    let selectionStats=null;
    const matchesAge=id=>selection.selectedAgeGroup===null||selection.selectedAgeGroup===id;
    const matchesOccupation=code=>!selection.selectedOccupations.length||selection.selectedOccupations.includes(code);
    const matchesMarker=n=>matchesAge(n.groupId)&&matchesOccupation(n.code);
    const comparisonColors=['#F3EDF9','#B9A7E1','#E2C090'];
    const occupationEmphasis=n=>{const i=selection.selectedOccupations.indexOf(n.code);return i<0?null:comparisonColors[i];};
    let targetZoom = 1;
    const minZoom = .65, maxZoom = 4.8;
    const symbolScale = 1.4, mutedOpacity = .035, mutedColor = '#858585';
    const ageLineColors=Object.freeze(Array(6).fill('#A29AAD'));
    const vividColors=new Map();
    function occupationColor(style) {
        if(vividColors.has(style.code))return vividColors.get(style.code);
        // Preserve category and hue identity; modest saturation, no additive glow.
        const rgb=[1,3,5].map(i=>parseInt(style.color.slice(i,i+2),16)/255),hi=Math.max(...rgb),lo=Math.min(...rgb),l=(hi+lo)/2;
        let h=0,sat=0;
        if(hi!==lo){const d=hi-lo;sat=d/(1-Math.abs(2*l-1));h=hi===rgb[0]?((rgb[1]-rgb[2])/d+6)%6:hi===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4;h*=60;}
        const color='hsl('+h.toFixed(3)+' '+(Math.min(.88,sat*(style.outline?1:1.18))*100).toFixed(3)+'% '+(l*100).toFixed(3)+'%)';
        vividColors.set(style.code,color);return color;
    }
    function networkStrength(group) {return !occupationFocus||matchesAge(group)?1:.10;}
    let atmosphereTexture=null;
    function atmosphericRim() {
        if(atmosphereTexture)return atmosphereTexture;
        const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;
        const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(256,256,0,256,256,256);
        // A view-dependent limb approximation: transparent center, faint inner rim.
        for(const [radius,alpha] of [[0,.028],[.70,.012],[.82,.003],[.90,.012],[.96,.035],[.988,.075],[1,0]])gradient.addColorStop(radius,'rgba(130,143,195,'+alpha+')');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,512,512);atmosphereTexture=canvas;return canvas;
    }
    // Display density uses only the fixed visual sample in object space. It is
    // independent of camera/animation and does not contribute to any statistic.
    let densityCache = null, densityBuilds = 0, densityTexture = null;
    function densityGlowTexture() {
        if (densityTexture) return densityTexture;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96;
        const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(48,48,0,48,48,48);
        for (const [stop, alpha] of [[0,.85],[.22,.52],[.50,.16],[.78,.025],[1,0]])
            gradient.addColorStop(stop,'rgba(239,245,255,'+alpha+')');
        ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);
        return densityTexture=canvas;
    }
    function localDensity() {
        const key=occupationFocus?occupationFocus.ageId+':'+occupationFocus.code:'all';
        if(densityCache?.key===key)return densityCache;
        const sources=occupationData.sampledSymbols.filter(n=>!occupationFocus ||
            matchesMarker(n));
        const cell=.055, support=.085, support2=support*support, reach=Math.ceil(support/cell);
        const buckets=new Map(), sites=[];
        const bucketKey=(age,x,y,z)=>age+':'+x+':'+y+':'+z;
        for(const node of sources){
            const v=node.v,x=Math.floor(v.x/cell),y=Math.floor(v.y/cell),z=Math.floor(v.z/cell);
            const site={node,x,y,z},key=bucketKey(node.groupId,x,y,z);
            if(!buckets.has(key))buckets.set(key,[]);
            buckets.get(key).push(site);sites.push(site);
        }
        const anchors=new Map();
        for(const site of sites){
            const {node,x,y,z}=site;let mass=0,neighbors=0;
            for(let dx=-reach;dx<=reach;dx++)for(let dy=-reach;dy<=reach;dy++)for(let dz=-reach;dz<=reach;dz++){
                const nearby=buckets.get(bucketKey(node.groupId,x+dx,y+dy,z+dz));
                if(!nearby)continue;
                for(const other of nearby){
                    if(other===site)continue;
                    const a=node.v,b=other.node.v,d2=(a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2;
                    if(d2<support2){neighbors++;mass+=(1-d2/support2)**2;}
                }
            }
            // A few isolated symbols cannot create a halo. The absolute scale
            // is shared by normal and filtered views; sparse selections stay dark.
            if(neighbors<4||mass<=1.25)continue;
            const strength=Math.min(1,Math.log1p(mass-1.25)/Math.log(20));
            const key=bucketKey(node.groupId,x,y,z),previous=anchors.get(key);
            // One light splat per occupied voxel, anchored to a REAL sampled node.
            if(!previous||mass>previous.mass)anchors.set(key,{node,mass,strength});
        }
        densityBuilds++;
        return densityCache={key,sources:sources.length,anchors:[...anchors.values()]};
    }
    function drawDensityGlow(context,opacity) {
        const density=localDensity(),texture=densityGlowTexture(),world={},view={};
        let drawn=0;
        for(const anchor of density.anchors){
            flexPoint(anchor.node.v,anchor.node.groupId,world);screen(world,view);
            const depth=Math.max(0,Math.min(1,(view.z+1)/2));
            const radius=sphereRadius*(.040+.025*anchor.strength)/(1-.10*view.z);
            if(view.x+radius<viewport.left||view.x-radius>viewport.right||view.y+radius<viewport.top||view.y-radius>viewport.bottom)continue;
            context.globalAlpha=opacity*.085*anchor.strength*(.35+.65*depth);
            // Source-over, no additive bloom or per-frame blur; markers paint later.
            context.drawImage(texture,view.x-radius,view.y-radius,radius*2,radius*2);drawn++;
        }
        return {sources:density.sources,hotspots:density.anchors.length,drawn,builds:densityBuilds,key:density.key};
    }
    const dragSpeed = .0075, inertiaDamping = 1.6, maxAngularSpeed = 3.5;
    let velocityYaw = 0, velocityPitch = 0, autoRate = 0;
    let mode = 'compare', time = 0, playing = false, frame = 0, previous = null, rotationResumeAt = 0, shownInfo = '';
    let centerX = 0, centerY = 0, sphereRadius = 1;
    let cy = 1, sy = 0, cp = 1, sp = 0, cameraYaw = NaN, cameraPitch = NaN;
    const clock = value => value === null ? '\u2014' : SleepRegions.clock(value);
    const delta = value => value === null ? '\u2014' : (value >= 0 ? '+' : '\u2212') + Math.abs(value).toFixed(1) + ' min';
    const point = SleepNetworkLinks.surfacePoint;
    const tooltip = $('sleep-clock-tooltip');
    function rotate(v) {
        if (cameraYaw !== yaw || cameraPitch !== pitch) {
            cameraYaw = yaw; cameraPitch = pitch; cy = Math.cos(yaw); sy = Math.sin(yaw); cp = Math.cos(pitch); sp = Math.sin(pitch);
        }
        const x = v.x * cy + v.z * sy, z = v.z * cy - v.x * sy;
        return {x, y: v.y * cp - z * sp, z: v.y * sp + z * cp};
    }
    function screen(v, out = {}) {
        const x = v.x * cy + v.z * sy, rawZ = v.z * cy - v.x * sy;
        const y = v.y * cp - rawZ * sp, z = v.y * sp + rawZ * cp, perspective = 1 / (1 - .10 * z);
        out.x = centerX + x * sphereRadius * perspective;
        out.y = centerY + y * sphereRadius * perspective; out.z = z;
        return out;
    }
    function sample(curve, t = time) {
        const phase = (t % 144 + 144) % 144, a = Math.floor(phase), f = phase - a;
        return curve[a] * (1 - f) + curve[(a + 1) % 144] * f;
    }
    function prepare(indices) {
        stop(); selection.selectedAgeGroup=null;selection.selectedOccupation=null;selection.selectedOccupations=[];selectionStats=null;densityCache=null; model = SleepNetworkData.build(indices); graph = SleepNetworkLinks.build(indices, model); nodes = graph.nodes;
        occupationData = SleepOccupations.build(graph,model);SleepOccupations.sample(occupationData,window.sleepRegionSelection.id);displayDistributions=graph.distributions;occupationFocus=null;
        window.sleepOccupationSelection=null;
        botanicals = SleepBotany.build(model, graph);
        SleepLandscape.prepare(botanicals);
        const legend=$('cluster-occupation-legend');legend.replaceChildren();
        for(const p of botanicals.occupationProfiles){
            if(!p.total)continue;const row=document.createElement('div'),swatch=document.createElement('i'),text=document.createElement('span');
            swatch.className='cluster-hue';swatch.style.background=p.color;
            text.textContent=model.groups[p.groupId].name+' · '+(p.leaderCode===null?'직업 코드 없음':SleepOccupations.style(p.leaderCode).label+' '+(100*p.leaderCount/p.total).toFixed(1)+'%');row.append(swatch,text);legend.append(row);
        }
        buildOccupationKey();
        // Cache immutable aggregate geometry; animation only updates reusable views.
        for (const n of nodes) {
            n.drawRadius = n.major ? Math.min(5, 2.6 + Math.log2(1+n.n)*.28) : Math.min(2.6, C.particles.coreBase + Math.sqrt(n.n)*C.particles.coreCountScale);
            n.wavePhase = n.dataU*tau*2 + n.dataV*3 + n.groupId*.7;
            n.worldRadius = Math.sqrt(n.v.x*n.v.x+n.v.y*n.v.y+n.v.z*n.v.z);
            n.targetRadius = Math.sqrt(n.target.x*n.target.x+n.target.y*n.target.y+n.target.z*n.target.z);
            n.view = {node:n,kind:n.kind,world:{x:0,y:0,z:0}};
            for (const v of n.stars) {
                v.dx=v.x-n.v.x;v.dy=v.y-n.v.y;v.dz=v.z-n.v.z;
                v.radius=Math.sqrt(v.x*v.x+v.y*v.y+v.z*v.z);
            }
        }
        yaw = .48; pitch = -.16; zoom = 1; targetZoom = 1; time = 0; animationSeconds = 0; hover = null; selected = null; hoverPoint = null; hoverNode = null; shownInfo = '';
        window.sleepAgeSelection = null; velocityYaw=0;velocityPitch=0;autoRate=0;rotationResumeAt = 0; tooltip.dataset.bin = '';
        if ((mode === 'weekday' && !model.stats.weekdayPeople) || (mode === 'weekend' && !model.stats.weekendPeople)) mode = 'compare';
        $('age-list').replaceChildren();
        for (const g of model.groups) {
            const b = document.createElement('button'); b.type = 'button'; b.dataset.age = g.id; b.disabled = !g.stats.people;
            b.textContent = g.name + ' / ' + g.stats.people.toLocaleString(); b.style.setProperty('--age-color', ageLineColors[g.id]);
            b.setAttribute('aria-pressed', 'false'); b.onclick = () => select(g.id); $('age-list').append(b);
        }
        updateSamplingSummary(botanicals.length);
        $('comparison-note').textContent = 'Each age cluster uses its largest recorded occupation as the terrain and branch hue. Shares count unique respondents within this region and age, including unrecorded occupation in the denominator. Unrecorded occupation is excluded from leader ranking and shown as a faint cluster tint. Other occupation disks retain subdued versions of their own hues; smaller shares are fainter. Up to three selected occupations receive outline accents and full emphasis. Disk area = respondents; relief = display overlap; paired-duration stem animation is unchanged.';
        $('comparison-note').hidden = false; $('compare-key').hidden = false;
        document.querySelectorAll('[data-sleep-mode]').forEach(b => {
            const k = b.dataset.sleepMode;
            b.disabled = k === 'weekday' ? !model.stats.weekdayPeople : k === 'weekend' ? !model.stats.weekendPeople : false;
            b.setAttribute('aria-pressed', String(k === mode));
        });
        applySelection(false); updateTime(); return model;
    }
    function setView(surface,groupId=null){
        const startYaw=yaw,startPitch=pitch;
        surfaceView=!!surface;targetZoom=1;velocityYaw=velocityPitch=0;
        let endYaw=yaw,endPitch=pitch;
        if(surfaceView&&groupId!==null){
            const p=botanicals.find(n=>n.groupId===groupId)?.ageAnchor;
            if(p){endYaw=-Math.atan2(p.x,p.z);endPitch=Math.max(-1.25,Math.min(1.25,Math.atan2(p.y,Math.hypot(p.x,p.z))+.66));}
        }
        cameraFlight={start:performance.now(),from:surfaceBlend,to:surfaceView?1:0,yaw:startYaw,pitch:startPitch,dyaw:Math.atan2(Math.sin(endYaw-startYaw),Math.cos(endYaw-startYaw)),endPitch};
        if(reduced.matches){surfaceBlend=cameraFlight.to;yaw=endYaw;pitch=endPitch;cameraFlight=null;}
        const screen=$('detail-screen'),panel=$('detail-panel');
        screen.classList.toggle('is-overview',!surfaceView);screen.classList.toggle('is-surface',surfaceView);
        panel.hidden=surfaceView;panel.inert=surfaceView;
        $('focus-surface').textContent=surfaceView?'전체 구 보기':'표면 확대';
        if(typeof AtlasTransition!=='undefined')AtlasTransition.syncSurface?.();render();
    }
    function transitionTarget(indices) {
        const result = {x: 0, y: 0, z: 0}; let count = 0;
        for (const i of indices) {
            const node = graph?.recordNodes.get(i); if (!node) continue;
            const p = rotate(node.v); result.x += p.x; result.y += p.y; result.z += p.z; count++;
        }
        if (!count) return null;
        for (const k of ['x', 'y', 'z']) result[k] /= count;
        return result;
    }
    function updateInfo(){
        if(!model)return;
        const stats=selectionStats?.stats||model.stats;
        const title=[selection.selectedAgeGroup===null?null:model.groups[selection.selectedAgeGroup].name,
            selection.selectedOccupations.length?selection.selectedOccupations.map(code=>SleepOccupations.style(code).label).join(' + '):null].filter(Boolean).join(' / ')||(window.sleepRegionSelection.id==='all'?'All respondents':'All selected-region data');
        if(shownInfo===title)return;shownInfo=title;
        $('age-title').textContent=title;
        $('age-people').textContent=stats.people.toLocaleString();$('age-diaries').textContent=stats.diaries.toLocaleString()+' diary records';
        $('age-weekday').textContent=clock(stats.weekdayOnset);$('age-weekend').textContent=clock(stats.weekendOnset);$('age-difference').textContent=delta(stats.differenceMinutes);
        const duration=value=>value===null?'—':Math.floor(Math.round(value*60)/60)+'h '+String(Math.round(value*60)%60).padStart(2,'0')+'m';
        $('age-weekday-duration').textContent=duration(stats.weekdayDuration);$('age-weekend-duration').textContent=duration(stats.weekendDuration);
        $('age-samples').textContent='Unique respondents: weekday '+stats.weekdayPeople+' / weekend '+stats.weekendPeople+' / both '+stats.pairedPeople;
        $('occupation-list').replaceChildren();
        for(const [code,count] of stats.occupations){const item=document.createElement('li');item.textContent=SleepOccupations.style(code).label+' · '+count.toLocaleString();$('occupation-list').append(item);}
    }
    function applySelection(redraw=true){
        selected=selection.selectedAgeGroup;hover=null;hoverPoint=null;hoverNode=null;tooltip.hidden=true;tooltip.dataset.bin='';shownInfo='';
        const active=selected!==null||selection.selectedOccupations.length>0;
        const indices=model.indices.filter(i=>{const n=occupationData.recordSymbols.get(i);return matchesMarker(n);});
        selectionStats=active?SleepNetworkData.build(indices):model;
        occupationFocus=null;displayDistributions=graph.distributions;
        if(active){
            const paths=selection.selectedOccupations.flatMap(code=>model.groups.filter(g=>matchesAge(g.id)).flatMap(g=>SleepOccupations.select(occupationData,g.id,code).paths));
            const activity={weekday:new Float32Array(144),weekend:new Float32Array(144)};
            for(const kind of ['weekday','weekend']){
                const persons=selectionStats.persons.filter(p=>p[kind].length);
                for(const person of persons)for(const i of person[kind]){
                    const curve=occupationData.recordSymbols.get(i).activity,weight=1/(persons.length*person[kind].length);
                    for(let t=0;t<144;t++)activity[kind][t]+=curve[t]*weight;
                }
            }
            occupationFocus={ageId:selected,code:selection.selectedOccupation,codes:[...selection.selectedOccupations],indices,statistics:selectionStats.stats,model:selectionStats,activity,paths};
            if(selection.selectedOccupations.length)displayDistributions=paths;
        }
        window.sleepOccupationSelection=!selection.selectedOccupations.length?null:{regionId:window.sleepRegionSelection.id,ageGroupId:selected,occupationCode:selection.selectedOccupation,occupationCodes:[...selection.selectedOccupations],recordIndices:[...indices],records:indices.map(i=>DATA[i]),personIds:selectionStats.persons.map(p=>p.id),statistics:selectionStats.stats};
        window.sleepAgeSelection=selected===null?null:{regionId:window.sleepRegionSelection.id,ageGroup:model.groups[selected].name,recordIndices:[...indices],records:indices.map(i=>DATA[i]),personIds:selectionStats.persons.map(p=>p.id),statistics:selectionStats.stats};
        buildOccupationKey();buildOverview();
        document.querySelectorAll('[data-age]').forEach(button=>{
            const id=+button.dataset.age,people=model.groups[id].persons.filter(p=>p.indices.some(i=>matchesOccupation(SleepOccupations.codeOf(i)))).length;
            button.textContent=model.groups[id].name+' / '+people.toLocaleString();button.disabled=!people;button.setAttribute('aria-pressed',String(id===selected));
        });
        updateInfo();updateTime();if(redraw)render();
    }
    function buildOverview(){
        const root=$('age-overview');root.replaceChildren();
        for(const group of model.groups){
            const button=document.createElement('button');button.type='button';button.className='overview-age';
            button.style.setProperty('--age-color',ageLineColors[group.id]);button.style.setProperty('--share',100*group.stats.people/Math.max(1,model.stats.people)+'%');
            button.textContent=group.name+'  '+group.stats.people.toLocaleString();button.setAttribute('aria-pressed',String(selected===group.id));button.disabled=!group.stats.people;button.onclick=()=>select(group.id);root.append(button);
        }
    }
    function clearOccupationFocus(redraw=true){selection.selectedOccupation=null;selection.selectedOccupations=[];applySelection(redraw);}
    function select(id,redraw=true){selection.selectedAgeGroup=selection.selectedAgeGroup===id?null:id;applySelection(redraw);}
    function clearSceneSelection(){selection.selectedAgeGroup=null;selection.selectedOccupation=null;selection.selectedOccupations=[];applySelection();}
    function toggleOccupation(code){
        const codes=selection.selectedOccupations,i=codes.indexOf(code);
        if(i>=0)codes.splice(i,1);else if(codes.length<3)codes.push(code);else return;
        selection.selectedOccupation=codes.length===1?codes[0]:null;applySelection();
    }
    function selectOccupation(n){
        if(selection.selectedOccupations.length>=3&&!selection.selectedOccupations.includes(n.code))return;
        selection.selectedAgeGroup=n.groupId;toggleOccupation(n.code);
    }
    function updateSamplingSummary(onScreen) {
        if(!occupationData)return;
        const text=onScreen.toLocaleString()+' landscape aggregates / '+model.indices.length.toLocaleString()+' actual diaries / '+model.stats.people.toLocaleString()+' unique people; complete data, no terrain sampling';
        if($('network-scope').textContent!==text)$('network-scope').textContent=text;
    }
    function buildOccupationKey(){
        $('occupation-key').replaceChildren();
        $('occupation-comparison-status').textContent=selection.selectedOccupations.length?selection.selectedOccupations.length+'/3 occupations selected · click again to remove':'Select up to 3 occupations to compare';
        for(const d of SleepOccupations.definitions){
            const persons=model.persons.filter(p=>(selected===null||model.groups[selected].persons.includes(p))&&p.indices.some(i=>SleepOccupations.codeOf(i)===d.code));
            // Present only original codes actually available in this region.
            if(!model.persons.some(p=>p.indices.some(i=>SleepOccupations.codeOf(i)===d.code)))continue;
            const item=document.createElement('li'),button=document.createElement('button'),icon=document.createElement('canvas'),text=document.createElement('span'),count=document.createElement('span');
            button.type='button';button.dataset.occupation=d.code;button.setAttribute('aria-pressed',String(selection.selectedOccupations.includes(d.code)));button.disabled=!persons.length||(selection.selectedOccupations.length>=3&&!selection.selectedOccupations.includes(d.code));
            const index=selection.selectedOccupations.indexOf(d.code);button.style.setProperty('--comparison-color',index<0?'#9B98A3':comparisonColors[index]);
            icon.width=28;icon.height=28;icon.setAttribute('aria-hidden','true');const ctx=icon.getContext('2d'),path=new Path2D();occupationGlyph(path,14,14,8,'circle');
            ctx.fillStyle=ctx.strokeStyle=index<0?d.color:comparisonColors[index];ctx.lineWidth=2;ctx.fillStyle=index<0?d.color:comparisonColors[index];ctx.globalAlpha=index<0?.55:1;ctx.fill(path);
            text.textContent=d.label;count.textContent=persons.length.toLocaleString();count.className='filter-count';
            button.title=d.label+(d.code?' [코드 '+d.code+']':' [원본 빈 값]')+' · unique respondents';button.onclick=()=>toggleOccupation(d.code);
            button.append(icon,text,count);item.append(button);$('occupation-key').append(item);
        }
    }

    function updateTime() {
        const minutes = Math.floor(time * 10) % 1440;
        const text = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
        if ($('sleep-time').textContent !== text) $('sleep-time').textContent = text;
        if (!model) return;
        const stats=selectionStats?.stats||model.stats;
        const proportion=kind=>occupationFocus?sample(occupationFocus.activity[kind]):model.stats[kind+'People']?model.groups.reduce((sum,g)=>sum+sample(graph.activity[g.id][kind])*g.stats[kind+'People'],0)/model.stats[kind+'People']:0;
        const textActivity=['weekday','weekend'].map(k=>(k==='weekday'?'Weekday ':'Weekend ')+(stats[k+'People']?Math.round(proportion(k)*100)+'%':'—')).join(' / ');
        const activityText = 'Principal sleep / ' + textActivity;
        if ($('sleep-activity').textContent !== activityText) $('sleep-activity').textContent = activityText;
    }
    function emphasis(group, kind) {
        const active = hover ?? selected;
        const state = phaseCache?.[group] || phaseState(group);
        return (active === null ? 1 : active === group ? 1.10 : .62) * (mode === 'compare' || mode === kind ? 1 : .82) * state[kind];
    }
    function glyph(path, x, y, radius, kind) {
        if (kind === 'weekday') {path.moveTo(x + radius, y); path.arc(x, y, radius, 0, tau);}
        else {path.moveTo(x, y - radius * 1.18); path.lineTo(x + radius * 1.02, y + radius * .72); path.lineTo(x - radius * 1.02, y + radius * .72); /* fill closes each triangle subpath */}
    }
    // Shared silhouettes keep enlarged marker hit areas aligned with their paint.
    const symbolVertices = new Map();
    function vertices(shape) {
        if(symbolVertices.has(shape))return symbolVertices.get(shape);
        let points;
        if(shape==='square')points=[[-.82,-.82],[.82,-.82],[.82,.82],[-.82,.82]];
        else if(shape==='triangle')points=[[0,-1.15],[1,.72],[-1,.72]];
        else if(shape==='diamond')points=[[0,-1.15],[.92,0],[0,1.15],[-.92,0]];
        else if(shape==='chevron')points=[[-1,-.85],[0,-.15],[1,-.85],[1,0],[0,.85],[-1,0]];
        else if(shape==='plus'||shape==='cross'){
            points=[[-.28,-1],[.28,-1],[.28,-.28],[1,-.28],[1,.28],[.28,.28],[.28,1],[-.28,1],[-.28,.28],[-1,.28],[-1,-.28],[-.28,-.28]];
            if(shape==='cross')points=points.map(([a,b])=>[(a-b)*.707,(a+b)*.707]);
        } else {
            const sides=shape==='star'?10:shape==='hexagon'?6:5;
            points=Array.from({length:sides},(_,i)=>{const t=-Math.PI/2+i*tau/sides,scale=shape==='star'&&i%2?.44:1;return [Math.cos(t)*scale,Math.sin(t)*scale];});
        }
        symbolVertices.set(shape,points);return points;
    }
    // Canvas projection is a camera-facing billboard: symbols never turn edge-on.
    function occupationGlyph(path,x,y,r,shape) {
        if(shape==='circle'||shape==='ring'){path.moveTo(x+r,y);path.arc(x,y,r,0,tau);return;}
        const points=vertices(shape);path.moveTo(x+points[0][0]*r,y+points[0][1]*r);
        for(let i=1;i<points.length;i++)path.lineTo(x+points[i][0]*r,y+points[i][1]*r);
        // fill implicitly closes each polygon; do not add per-symbol closePath.
    }
    function containsSymbol(p,x,y) {
        if(p.node.botanical){
            const u=p.ellipseU,v=p.ellipseV,dx=x-p.x,dy=y-p.y;
            if(!u||!v)return Math.hypot(dx,dy)<=p.radius;
            const det=u.x*v.y-u.y*v.x;if(Math.abs(det)<1e-8)return false;
            const a=(dx*v.y-dy*v.x)/det,b=(u.x*dy-u.y*dx)/det;
            return a*a+b*b<=1;
        }
        const dx=(x-p.x)/p.radius,dy=(y-p.y)/p.radius,shape=p.node.style.shape;
        if(shape==='circle'||shape==='ring'){
            const outer=1+(p.node.style.outline?p.outlineWidth/2/p.radius:0);
            return dx*dx+dy*dy<=outer*outer;
        }
        let inside=false;const points=vertices(shape);
        for(let i=0,j=points.length-1;i<points.length;j=i++){
            const [a,b]=points[i],[c,d]=points[j];
            if((b>dy)!==(d>dy)&&dx<(c-a)*(dy-b)/(d-b)+a)inside=!inside;
        }
        return inside;
    }

    // Fifteen-second PRESENTATION cycle. The sixty-second 24h data clock is
    // independent; phase brightness must never be interpreted as an asleep count.
    function phaseState(groupId=0) {
        if(model&&!model.stats.weekdayPeople)return {weekday:0,weekend:1,migration:0,transition:0,name:'Weekend only / weekday filtered out'};
        if(model&&!model.stats.weekendPeople)return {weekday:1,weekend:0,migration:0,transition:0,name:'Weekday only / weekend filtered out'};
        if(reduced.matches)return {weekday:1,weekend:1,migration:0,transition:0,name:'Balanced comparison'};
        const p=((animationSeconds+groupId*.34)/C.motion.comparisonSeconds)%1;
        const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
        if(p<.22)return {weekday:1,weekend:.70,migration:0,transition:.12,name:'Weekday emphasis'};
        if(p<.52){const t=smooth((p-.22)/.30);return {weekday:1-.30*t,weekend:.70+.30*t,migration:t,transition:Math.sin(Math.PI*t),name:'Weekday → Weekend'};}
        if(p<.72)return {weekday:.70,weekend:1,migration:1,transition:.40,name:'Weekend emphasis'};
        if(p<.88){const t=smooth((p-.72)/.16);return {weekday:.70+.16*t,weekend:1-.14*t,migration:1-t,transition:.45,name:'Return to balance'};}
        const t=smooth((p-.88)/.12);return {weekday:.86+.14*t,weekend:.86-.16*t,migration:0,transition:.12,name:'Balanced comparison'};
    }
    function batch(map,key,color,alpha,width) {
        let b=map.get(key);if(!b){b={path:new Path2D(),color,alpha:Math.max(0,Math.min(1,alpha)),width};map.set(key,b);}return b.path;
    }
    function fillBatches(context,map) {for(const b of map.values()){context.globalAlpha=b.alpha;context.fillStyle=b.color;context.fill(b.path);}}
    function strokeBatches(context,map) {for(const b of map.values()){context.globalAlpha=b.alpha;context.strokeStyle=b.color;context.lineWidth=b.width;context.stroke(b.path);}}
    // A gentle, shared 3D deformation keeps strands and their data nodes together.
    // These small display motions do not change any measurements or statistics.
    function flexPoint(v,id,out={}) {
        const f=flexCache?.[id];
        if(!f){out.x=v.x;out.y=v.y;out.z=v.z;return out;}
        const c=graph.groups[id].center,x=(v.x-c.x)*f.sx,y=(v.y-c.y)*f.sy,z=(v.z-c.z)*f.sz;
        out.x=c.x+x*f.c-z*f.s;out.y=c.y+y+f.shear*x;out.z=c.z+z*f.c+x*f.s;
        const square=out.x*out.x+out.y*out.y+out.z*out.z;
        if(square>.988036){const ratio=.994/Math.sqrt(square);out.x*=ratio;out.y*=ratio;out.z*=ratio;}
        return out;
    }
    function projectPath(record) {
        const out=record.screenPath||(record.screenPath=record.path.map(()=>({}))),scratch={};
        for(let i=0;i<out.length;i++)screen(record.groupId===undefined?record.path[i]:flexPoint(record.path[i],record.groupId,scratch),out[i]);
        return out;
    }
    // Cubic interpolation is shared by both the line and its light/tail samples.
    function strokeCurve(path,pts) {
        path.moveTo(pts[0].x,pts[0].y);
        for(let i=0;i<pts.length-1;i++){
            const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)];
            path.bezierCurveTo(b.x+(c.x-a.x)/6,b.y+(c.y-a.y)/6,c.x-(d.x-b.x)/6,c.y-(d.y-b.y)/6,c.x,c.y);
        }
    }
    function pathPoint(pts,t) {
        const scaled=Math.max(0,Math.min(.999999,t))*(pts.length-1),i=Math.floor(scaled),f=scaled-i;
        const a=pts[Math.max(0,i-1)],b=pts[i],c=pts[i+1],d=pts[Math.min(pts.length-1,i+2)],f2=f*f,f3=f2*f;
        return {x:.5*((2*b.x)+(-a.x+c.x)*f+(2*a.x-5*b.x+4*c.x-d.x)*f2+(-a.x+3*b.x-3*c.x+d.x)*f3),
            y:.5*((2*b.y)+(-a.y+c.y)*f+(2*a.y-5*b.y+4*c.y-d.y)*f2+(-a.y+3*b.y-3*c.y+d.y)*f3)};
    }
    let referenceOrbits=null;
    function drawReferenceOrbits(context,opacity){
        if(!referenceOrbits)referenceOrbits=Array.from({length:4},(_,id)=>{
            const inclination=[.38,1.05,-.72,1.43][id],twist=id*1.19,radius=1.025+id*.018;
            return {path:Array.from({length:81},(_,j)=>{const t=tau*j/80,x=radius*Math.cos(t),y=radius*Math.sin(t)*Math.cos(inclination),z=radius*Math.sin(t)*Math.sin(inclination);return {x:x*Math.cos(twist)-y*Math.sin(twist),y:x*Math.sin(twist)+y*Math.cos(twist),z};})};
        });
        for(let id=0;id<referenceOrbits.length;id++){
            const pts=projectPath(referenceOrbits[id]);context.strokeStyle='#E4E8F1';context.lineWidth=.35;
            for(let j=0;j<pts.length-1;j++){const a=pts[j],b=pts[j+1];context.globalAlpha=opacity*(.035+.055*Math.max(0,(a.z+1)/2));context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke();}
            context.fillStyle='#EFF3FA';
            for(let j=0;j<5;j++){const p=pts[(j*17+id*9)%80];context.globalAlpha=opacity*(.16+.20*Math.max(0,(p.z+1)/2));context.beginPath();context.arc(p.x,p.y,.7,0,tau);context.fill();}
            const t=reduced.matches?id*.23:(animationSeconds/(52+id*13)+id*.23)%1,p=pathPoint(pts,t);
            context.globalAlpha=opacity*.55;context.beginPath();context.arc(p.x,p.y,1.1,0,tau);context.fill();
        }
    }
    function draw(context,opacity=1) {
        if(!model||opacity<=0)return;
        const started=performance.now();viewport=$('detail-visual').getBoundingClientRect();
        context.save();
        if(AtlasTransition.stage==='detail'){context.globalAlpha=1;context.fillStyle=C.palette.background;context.fillRect(viewport.left,viewport.top,viewport.width,viewport.height);}
        const views=SleepLandscape.draw(context,botanicals,{closeup:surfaceBlend,viewport,yaw,pitch,zoom,opacity,matches:matchesMarker,filtered:!!occupationFocus,groups:model.groups,hover:hover??selected,mode,time,seconds:animationSeconds,reduced:reduced.matches,ageColors:ageLineColors,emphasis:occupationEmphasis});
        projected=views;labels=views.labels;context.restore();
        $('comparison-phase').textContent=views.phaseLabel;
        updateSamplingSummary(views.length);
        document.documentElement.dataset.terrainRenderer=views.terrainRenderer;
        metrics={terrainRenderer:views.terrainRenderer,terrainCacheHit:views.terrainCacheHit,botanicalAggregates:botanicals.length,botanicalRecords:model.indices.length,renderedSymbols:views.length,botanicalDrawCalls:views.drawCalls,representedRecords:model.indices.length,reliefHills:views.reliefHills,neuronBranches:views.neuronBranches,sprouts:views.sprouts,drawMs:performance.now()-started,layout:'spherical age-territory landscape'};
        meanDrawMs=meanDrawMs?meanDrawMs*.9+metrics.drawMs*.1:metrics.drawMs;document.documentElement.dataset.renderMs=meanDrawMs.toFixed(1);
        if(!pointer&&hoverPoint)refreshHover();
    }
    function nearest(x,y) {
        if(!viewport||x<viewport.left||x>viewport.right||y<viewport.top||y>viewport.bottom)return null;
        let result=null,best=Infinity;
        for(const p of projected){
            if(!containsSymbol(p,x,y))continue;
            const dx=x-p.x,dy=y-p.y;
            const score=(dx*dx+dy*dy)/(p.radius*p.radius)-p.z*.10+(p.muted?2:0);
            if(score<best){best=score;result=p;}
        }
        return result;
    }
    function refreshHover() {
        const found = nearest(hoverPoint.x, hoverPoint.y), id = found?.node.groupId ?? null;
        if (hover !== id) {hover = id; updateInfo(); updateTime();}
        hoverNode = found?.node ?? null;
        if (!hoverNode) {tooltip.hidden = true; return;}
        const n = hoverNode, group = model.groups[n.groupId];
        const contentKey = n.key;
        if (tooltip.dataset.bin !== contentKey) {
            tooltip.dataset.bin = contentKey; tooltip.replaceChildren();
            const title = document.createElement('strong'); title.textContent = group.name + ' / ' + n.style.label + ' / ' + (n.kind==='paired'?'Paired weekday / weekend':n.kind === 'weekday' ? 'Weekday (unpaired)' : 'Weekend (unpaired)'); tooltip.append(title);
            for (const text of [
                n.n.toLocaleString()+' actual diary records / '+n.count+' unique respondents',
                ...(n.kind==='paired'?[
                    '2-hour weekday wake × weekend wake bins',
                    'Weekday wake '+SleepBotany.clock(n.weekdayWake)+' / weekend wake '+SleepBotany.clock(n.weekendWake),
                    'Mean paired wake difference '+(n.difference*60).toFixed(1)+' min',
                    'Weekday sleep duration '+(n.weekdayDuration*60).toFixed(1)+' min / weekend '+(n.weekendDuration*60).toFixed(1)+' min',
                    'Paired duration difference '+(n.durationDifference*60).toFixed(1)+' min'
                ]:['Unpaired: 2-hour onset × duration bins; no wake difference inferred']),
                'Occupation: '+SleepLandscape.appearance(n).label+' / age-cluster share '+(SleepLandscape.appearance(n).share*100).toFixed(1)+'%',
                'Six age clusters; merged contour relief = display overlap, not an additional sleep measurement',
                (n.land.sprout?'Stem length animates paired sleep duration; unpaired stems stay fixed':'Surface disk: larger aggregate attached to the sphere; exact paired wake and duration differences shown above'),
                'Mean onset '+clock(n.onset)+' / mean duration '+(n.duration*60).toFixed(0)+' min',
                'Age group: '+group.stats.people.toLocaleString()+' unique people / '+group.stats.diaries.toLocaleString()+' diaries',
                'Sidebar uses all selected-region diaries; paired wakes are not formal social jetlag'
            ]) {
                const p = document.createElement('div'); p.textContent = text; tooltip.append(p);
            }
        }
        tooltip.hidden = false;
        const bounds = tooltip.getBoundingClientRect();
        tooltip.style.left = Math.max(8, Math.min(innerWidth - bounds.width - 8, hoverPoint.x + 16)) + 'px';
        tooltip.style.top = Math.max(8, Math.min(innerHeight - bounds.height - 8, hoverPoint.y + 16)) + 'px';
    }
    const wrapAngle=value=>Math.atan2(Math.sin(value),Math.cos(value));
    function pauseRotation(delay=300) {rotationResumeAt=performance.now()+delay;}
    function move(e) {
        if(pointer){
            if(e.pointerId!==undefined&&pointer.id!==e.pointerId)return;
            const now=performance.now(),dt=Math.max(1/240,Math.min(.08,(now-pointer.time)/1000));
            const dx=(e.clientX-pointer.x)*dragSpeed,dy=(e.clientY-pointer.y)*dragSpeed;
            yaw=wrapAngle(yaw+dx);pitch=Math.max(-1.25,Math.min(1.25,pitch+dy));
            const vx=Math.max(-maxAngularSpeed,Math.min(maxAngularSpeed,dx/dt));
            const vy=Math.max(-maxAngularSpeed,Math.min(maxAngularSpeed,dy/dt));
            const blend=pointer.moved?1-Math.exp(-30*dt):1;
            pointer.vx+=(vx-pointer.vx)*blend;pointer.vy+=(vy-pointer.vy)*blend;
            pointer.distance=Math.max(pointer.distance,Math.hypot(e.clientX-pointer.sx,e.clientY-pointer.sy));
            pointer.x=e.clientX;pointer.y=e.clientY;pointer.time=now;pointer.moved=true;
            hoverPoint=null;tooltip.hidden=true;
        } else {hoverPoint={x:e.clientX,y:e.clientY};refreshHover();}
        // Coalesce high-frequency pointer events into the existing animation RAF.
        if(playing)schedule();else render();
    }
    function down(e) {
        if(pointer||(e.button!==undefined&&e.button!==0))return;
        const now=performance.now();cameraFlight=null;velocityYaw=0;velocityPitch=0;autoRate=0;
        pointer={id:e.pointerId,x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,distance:0,time:now,vx:0,vy:0,moved:false};
        hoverPoint=null;tooltip.hidden=true;canvas.setPointerCapture(e.pointerId);
    }
    function up(e) {
        if(!pointer||(e.pointerId!==undefined&&pointer.id!==e.pointerId))return;
        const held=pointer,now=performance.now(),d=Math.max(held.distance,Math.hypot(e.clientX-held.sx,e.clientY-held.sy));
        pointer=null;pauseRotation(120);
        if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
        if(d<5){
            velocityYaw=0;velocityPitch=0;
            const found=nearest(e.clientX,e.clientY);
            if(found&&!surfaceView){selection.selectedAgeGroup=found.node.groupId;applySelection(false);setView(true,found.node.groupId);}
            else if(found){selectOccupation(found.node);hoverPoint={x:e.clientX,y:e.clientY};refreshHover();}
            else if(occupationFocus)clearSceneSelection();
            else {const label=labels.find(p=>Math.hypot(p.x-e.clientX,p.y-e.clientY)<24);if(label&&!surfaceView){selection.selectedAgeGroup=label.id;applySelection(false);setView(true,label.id);}else if(label)select(label.id);else if(!surfaceView){const near=projected.reduce((a,p)=>!a||Math.hypot(p.x-e.clientX,p.y-e.clientY)<Math.hypot(a.x-e.clientX,a.y-e.clientY)?p:a,null);if(near&&Math.hypot(near.x-e.clientX,near.y-e.clientY)<70){selection.selectedAgeGroup=near.node.groupId;applySelection(false);setView(true,near.node.groupId);}else clearSceneSelection();}else clearSceneSelection();}
        } else if(!reduced.matches){
            // Pausing before release naturally suppresses an unintended throw.
            const hold=Math.exp(-7*Math.max(0,(now-held.time)/1000-.08));
            velocityYaw=held.vx*hold;velocityPitch=held.vy*hold;
        }
        schedule();
    }
    function cancelPointer() {
        if(typeof AtlasTransition==='undefined'||AtlasTransition.stage!=='detail')return;
        const id=pointer?.id;pointer=null;velocityYaw=0;velocityPitch=0;autoRate=0;pauseRotation(120);
        if(id!==undefined&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    }
    function leave() {
        // Leaving the element during capture must not cancel a continuing drag.
        if(pointer)return;
        hoverPoint=null;hoverNode=null;hover=null;tooltip.hidden=true;updateInfo();
        if(playing)schedule();else render();
    }
    function wheel(e) {
        pauseRotation();
        const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?viewport.height:1);
        targetZoom=Math.max(minZoom,Math.min(maxZoom,targetZoom*Math.exp(-Math.max(-240,Math.min(240,delta))*.0018)));
        if(reduced.matches)zoom=targetZoom;
        render();schedule();
    }
    function schedule() {if (!frame && playing && !document.hidden && AtlasTransition.stage === 'detail') frame = requestAnimationFrame(tick);}
    function tick(now) {
        frame = 0; if (!playing || document.hidden || AtlasTransition.stage !== 'detail') {previous = null; return;}
        if(previous!==null)document.documentElement.dataset.frameIntervalMs=(now-previous).toFixed(1);
        const dt = previous === null ? 0 : Math.min(.25, Math.max(0, (now - previous) / 1000)); previous = now;
        zoom+=(targetZoom-zoom)*(reduced.matches?1:1-Math.exp(-12*dt));
        if(Math.abs(targetZoom-zoom)<.0001)zoom=targetZoom;
        time = (time + dt * 144 / daySeconds) % 144; animationSeconds += dt;
        if(cameraFlight){
            const q=Math.min(1,(now-cameraFlight.start)/1250),ease=q*q*q*(q*(q*6-15)+10);
            surfaceBlend=cameraFlight.from+(cameraFlight.to-cameraFlight.from)*ease;
            yaw=cameraFlight.yaw+cameraFlight.dyaw*ease;pitch=cameraFlight.pitch+(cameraFlight.endPitch-cameraFlight.pitch)*ease;
            if(q===1)cameraFlight=null;
        }else surfaceBlend=surfaceView?1:0;
        if(!pointer&&!cameraFlight&&!reduced.matches){
            // Exact integration of exponential damping is independent of FPS.
            const decay=Math.exp(-inertiaDamping*dt),travel=(1-decay)/inertiaDamping;
            yaw+=velocityYaw*travel;pitch+=velocityPitch*travel;
            velocityYaw*=decay;velocityPitch*=decay;
            if(Math.abs(velocityYaw)<.0001)velocityYaw=0;if(Math.abs(velocityPitch)<.0001)velocityPitch=0;
            const t=Math.max(0,Math.min(1,(now-rotationResumeAt)/900));
            autoRate=surfaceView?0:.045*t*t*(3-2*t);
            yaw=wrapAngle(yaw+dt*autoRate);pitch=Math.max(-1.25,Math.min(1.25,pitch));
        } else {autoRate=0;if(reduced.matches){velocityYaw=0;velocityPitch=0;}}

        updateTime(); render(); schedule();
    }
    function start() {playing = true; previous = null; schedule();}
    function stop() {playing = false; previous = null; pointer = null;velocityYaw=0;velocityPitch=0;autoRate=0; hoverPoint = null; tooltip.hidden = true; if (frame) cancelAnimationFrame(frame); frame = 0;}
    document.querySelectorAll('[data-sleep-mode]').forEach(b => b.onclick = () => {
        if (b.disabled) return; mode = b.dataset.sleepMode;
        document.querySelectorAll('[data-sleep-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); render();
    });
    addEventListener('sleepdetailready', start);
    addEventListener('sleepatlasreturn', () => {stop();selection.selectedAgeGroup=null;selection.selectedOccupation=null;selection.selectedOccupations=[];occupationFocus=null;window.sleepAgeSelection=null;window.sleepOccupationSelection=null;});
    $('focus-surface').addEventListener('click',()=>setView(!surfaceView));
    $('occupation-clear').addEventListener('click',clearSceneSelection);
    $('map').addEventListener('pointercancel',cancelPointer);
    $('map').addEventListener('lostpointercapture',()=>{if(pointer)cancelPointer();});
    addEventListener('blur',cancelPointer);
    document.addEventListener('visibilitychange', () => {previous = null; if (document.hidden) {cancelPointer();if (frame) cancelAnimationFrame(frame); frame = 0;} else schedule();});
    return {prepare, setView, transitionTarget, draw, down, move, up, leave, wheel, stop,
        get model() {return model;}, get nodes() {return nodes;}, get projected() {return projected;},
        get mode() {return mode;}, get time() {return time;}, get selectedId() {return selected;}, get network() {return graph;},
        get visualOccupationSymbols() {return occupationData?.sampledSymbols||[];}, get sampling() {return occupationData?.sampling;}, get ageNetworkColors() {return ageLineColors;},
        get selection() {return {...selection,selectedOccupations:[...selection.selectedOccupations]};}, get occupationFilter() {return occupationFocus;}, get occupationSymbols() {return occupationData?.symbols||[];},
        get botanicals() {return botanicals;}, get rendering() {return metrics;}, get config() {return C;},
        get animation() {return {playing, scheduled: !!frame, yaw, pitch,velocityYaw,velocityPitch,autoRate,pointerActive:!!pointer,surfaceView,surfaceBlend,cameraFlight:!!cameraFlight,inertiaDamping,zoom, targetZoom, maxZoom, daySeconds, rotationSeconds,comparisonSeconds:C.motion.comparisonSeconds,elapsedSeconds:animationSeconds};}};
})();
