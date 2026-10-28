// Exact occupation partitions of existing time bins. Geometry/statistics stay separate.
// Verified against the official MDIS 2024 time-band-all response code table.
// Item 10428258 (CSV column 55), response group 5935495; all 10 raw CSV
// frequencies match the official table. Excel codebook download requires login;
// the names below were read from the public response table, not inferred from KSCO.
const SleepOccupations = (() => {
    const codebook = Object.freeze({
        year:2024, surveyId:'10', areaId:'20002501', surveySequence:'8',
        itemId:'10428258', responseGroupId:'5935495', column:'직업분류코드',
        source:'https://mdis.mods.go.kr/dwnlSvc/ofrSurvSearch.do?curMenuNo=UI_POR_P9240',
        responseEndpoint:'https://mdis.mods.go.kr/dwnlSvc/rspnGrpSearch.do',
        names:Object.freeze({"1": "관리자", "2": "전문가 및 관련 종사자", "3": "사무 종사자", "4": "서비스 종사자", "5": "판매 종사자", "6": "농림어업숙련·종사자", "7": "기능원 및 관련기능 종사자", "8": "장치,기계조작 및 조립 종사자", "9": "단순노무 종사자", "A": "직업군인"})
    });
    const definitions = [
        {code:'1',shape:'circle',color:'#FFE28A',name:'Circle / yellow'},
        {code:'2',shape:'triangle',color:'#B69CFF',name:'Triangle / orange'},
        {code:'3',shape:'square',color:'#8FD0FF',name:'Square / blue'},
        {code:'4',shape:'plus',color:'#FF9FD0',name:'Plus / magenta'},
        {code:'5',shape:'diamond',color:'#FFB585',name:'Diamond / cyan'},
        {code:'6',shape:'hexagon',color:'#9FF0C0',name:'Hexagon / lavender'},
        {code:'7',shape:'star',color:'#7FE6E0',name:'Star / coral'},
        {code:'8',shape:'pentagon',color:'#FF8FA0',name:'Pentagon / teal'},
        {code:'9',shape:'cross',color:'#D9F08A',name:'Cross / ochre'},
        {code:'A',shape:'chevron',color:'#A8B4FF',name:'Chevron / periwinkle'},
        {code:'',shape:'ring',color:'#E1E8F5',name:'Open circle / grey',outline:true}
    ].map((d,index)=>Object.freeze({...d,index,label:d.code?codebook.names[d.code]:'직업 코드 없음'}));
    const byCode=new Map(definitions.map(d=>[d.code,d]));
    const codeOf=i=>String(SleepDemographics.rows[i][2]??'');
    const style=code=>{const d=byCode.get(String(code??''));if(!d)throw Error('Unsupported original occupation code: '+code);return d;};
    const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
    function build(graph,model) {
        const symbols=[],recordSymbols=new Map(),groups=model.groups.map(()=>new Map());
        for(const parent of graph.nodes){
            parent.occupationParts=new Map();
            for(const i of parent.indices){
                const code=codeOf(i);let n=parent.occupationParts.get(code);
                if(!n){n={networkId:symbols.length,key:parent.key+':occupation:'+code,parent,groupId:parent.groupId,kind:parent.kind,code,style:style(code),indices:[],personIds:new Set()};parent.occupationParts.set(code,n);symbols.push(n);}
                n.indices.push(i);n.personIds.add(SleepDemographics.rows[i][0]);recordSymbols.set(i,n);
                const map=groups[parent.groupId];if(!map.has(code))map.set(code,[]);map.get(code).push(i);
            }
            for(const n of parent.occupationParts.values()){
                n.n=n.indices.length;n.count=n.personIds.size;n.onset=mean(n.indices.map(i=>DATA[i][0]));n.duration=mean(n.indices.map(i=>DATA[i][1]));
                n.meanAge=mean([...n.personIds].map(id=>graph.personById.get(id).age));
                // Subdivide only the existing bin footprint along its original
                // generative curve; no cluster/regional rank tables are refitted.
                const offset=(n.style.index-5)*.0012;
                n.v=SleepNetworkLinks.surfacePoint(n.onset,n.duration,graph.groups[n.groupId],n.kind,parent.jitterU+offset,parent.jitterV);
                n.dataU=n.v.dataU;n.dataV=n.v.dataV;n.activity=parent.activity;
                n.wavePhase=parent.dataU*Math.PI*4+parent.dataV*3+parent.groupId*.7;
                n.drawRadius=Math.min(4.4,1.65+Math.sqrt(n.n)*.29);
                n.view={node:n,kind:n.kind,code:n.code,world:{x:0,y:0,z:0}};
            }
        }
        // No record can be discarded, copied, or cross an age/occupation boundary.
        if(recordSymbols.size!==model.indices.length||symbols.reduce((s,n)=>s+n.n,0)!==model.indices.length)throw Error('Occupation partition mismatch');
        return {symbols,recordSymbols,groups};
    }
    function select(partition,ageId,code) {
        code=String(code??'');const indices=partition.groups[ageId].get(code)||[];
        const model=SleepNetworkData.build(indices),sets={weekday:[],weekend:[]};
        for(const i of indices)sets[DATA[i][2]===1?'weekday':'weekend'].push(i);
        for(const set of Object.values(sets))set.sort((a,b)=>DATA[a][0]-DATA[b][0]||DATA[a][1]-DATA[b][1]||a-b);
        const paths=[],unique=new Map();
        if(sets.weekday.length&&sets.weekend.length){
            const count=Math.min(32,Math.max(8,Math.round(Math.sqrt(indices.length))));
            for(let j=0;j<count;j++){
                const q=(j+.5)/count,a=sets.weekday[Math.floor(q*sets.weekday.length)],b=sets.weekend[Math.floor(q*sets.weekend.length)];
                const weekdayNode=partition.recordSymbols.get(a),weekendNode=partition.recordSymbols.get(b),key=weekdayNode.key+'>'+weekendNode.key;
                if(unique.has(key)){unique.get(key).mass+=1/count;continue;}
                const shift=SleepNetworkLinks.shortest(DATA[a][0],DATA[b][0]),durationShift=DATA[b][1]-DATA[a][1];
                const magnitude=Math.min(1,Math.abs(shift)/2+Math.abs(durationShift)/3);
                const d={groupId:ageId,occupationCode:code,quantile:q,weekday:DATA[a][0],weekend:DATA[b][0],shift,durationShift,magnitude,mass:1/count,weekdayNode,weekendNode,
                    path:SleepNetworkLinks.curve(weekdayNode.v,weekendNode.v,.012+.035*magnitude)};
                unique.set(key,d);paths.push(d);
            }
        }
        const activity=Object.fromEntries(['weekday','weekend'].map(kind=>{
            const people=model.persons.filter(p=>p[kind].length),curve=new Float32Array(144);
            for(const p of people)for(const i of p[kind]){const n=partition.recordSymbols.get(i),weight=1/(people.length*p[kind].length);for(let t=0;t<144;t++)curve[t]+=n.activity[t]*weight;}
            return [kind,curve];
        }));
        return {ageId,code,style:style(code),indices,model,statistics:model.stats,paths,activity};
    }
    function related(a,b,code) {
        const x=a.occupationParts.get(code),y=b.occupationParts.get(code),limits=SleepConstellationConfig.network;
        return x&&y&&Math.abs(SleepNetworkLinks.shortest(x.onset,y.onset))<=limits.onsetHours&&Math.abs(x.duration-y.duration)<=limits.durationHours&&Math.abs(x.meanAge-y.meanAge)<=limits.ageYears;
    }
    // A display-only sampling plan is fitted to the COMPLETE selected region,
    // never the current day/occupation filter or camera. Original records, bins,
    // coordinates and statistics are not sampled or modified.
    const samplePlans=new Map();
    const cohortKey=(age,code)=>age+':'+code;
    function morton(onset,duration) {
        let order=0;for(let bit=0;bit<8;bit++){order|=((onset>>bit)&1)<<(2*bit);order|=((duration>>bit)&1)<<(2*bit+1);}return order;
    }
    function samplingPlan(regionId) {
        if(samplePlans.has(regionId))return samplePlans.get(regionId);
        const catalog=new Map();
        for(const i of (regionId==='all'?SleepRegions.validIndices:SleepRegions.indices(regionId))){
            const [onset,duration,day]=DATA[i],age=SleepDemographics.rows[i][1];
            const groupId=SleepNetworkData.definitions.find(g=>age>=g.min&&age<=g.max).id;
            const kind=day===1?'weekday':'weekend',code=codeOf(i),onsetBin=Math.round(onset*6),durationBin=Math.round(duration*6);
            const key=[groupId,kind,onsetBin,durationBin].join(':')+':occupation:'+code;
            let bin=catalog.get(key);if(!bin){bin={key,groupId,kind,code,onsetBin,durationBin,dayMask:0};catalog.set(key,bin);}
            bin.dayMask|=1<<(day-1);
        }
        const groups=new Map();
        for(const bin of catalog.values()){
            // Day-support masks protect rare Saturday-only / Sunday-only bins.
            const key=[bin.groupId,bin.code,bin.kind,bin.dayMask].join('|');
            if(!groups.has(key))groups.set(key,{key,bins:[]});groups.get(key).bins.push(bin);
        }
        const strata=[...groups.values()].sort((a,b)=>a.key.localeCompare(b.key,'en'));
        let minimum=0,capacity=0;
        for(const s of strata){s.min=s.bins.length<=4?s.bins.length:1;minimum+=s.min;s.capacity=s.bins.length-s.min;capacity+=s.capacity;}
        const target=Math.min(catalog.size,Math.max(Math.round(catalog.size*.5),minimum)),budget=target-minimum;
        let assigned=minimum;
        for(const s of strata){const share=capacity?budget*s.capacity/capacity:0;s.quota=s.min+Math.floor(share);s.remainder=share-Math.floor(share);assigned+=s.quota-s.min;}
        for(const s of [...strata].sort((a,b)=>b.remainder-a.remainder||a.key.localeCompare(b.key,'en'))){if(assigned>=target)break;if(s.quota<s.bins.length){s.quota++;assigned++;}}
        const keys=new Set();
        for(const s of strata){
            // Systematic mid-quantiles of a 2D time order cover onset AND duration;
            // no random trial, rare-category deletion or synthetic point is used.
            s.bins.sort((a,b)=>morton(a.onsetBin,a.durationBin)-morton(b.onsetBin,b.durationBin)||a.key.localeCompare(b.key,'en'));
            for(let j=0;j<s.quota;j++)keys.add(s.bins[Math.floor((j+.5)*s.bins.length/s.quota)].key);
        }
        if(keys.size!==target)throw Error('Visual sampling quota mismatch');
        const plan={regionId,keys,fullCount:catalog.size,target,strata:strata.map(s=>({key:s.key,available:s.bins.length,selected:s.quota,minimum:s.min}))};
        samplePlans.set(regionId,plan);return plan;
    }
    function sample(partition,regionId) {
        const plan=samplingPlan(regionId),cohorts=new Map();
        for(const n of partition.symbols){
            n.sampled=plan.keys.has(n.key);
            const key=cohortKey(n.groupId,n.code);if(!cohorts.has(key))cohorts.set(key,{available:0,displayed:0,records:0});
            const c=cohorts.get(key);c.available++;c.displayed+=Number(n.sampled);c.records+=n.n;
        }
        partition.sampledSymbols=partition.symbols.filter(n=>n.sampled);
        partition.sampling={plan,cohorts,available:partition.symbols.length,displayed:partition.sampledSymbols.length};
        return partition.sampling;
    }
    return {definitions,style,codeOf,build,select,related,sample,samplingPlan,cohortKey,codebook};
})();
