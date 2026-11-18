// Statistical model uses exact CSV companion rows, never display coordinates.
const SleepNetworkData = (() => {
    const definitions = [
        {id:0,name:'10s',min:10,max:19,color:'#AF91AF'},
        {id:1,name:'20s',min:20,max:29,color:'#B5A2CD'},
        {id:2,name:'30s',min:30,max:39,color:'#88AFC5'},
        {id:3,name:'40s',min:40,max:49,color:'#D59789'},
        {id:4,name:'50s',min:50,max:59,color:'#C18FA9'},
        {id:5,name:'60+',min:60,max:Infinity,color:'#D5C28E'}
    ];
    const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
    const averageCurve = curves => Float32Array.from({length:144},(_,t)=>mean(curves.map(c=>c[t]))??0);
    function curve(indices) {
        const result=new Float32Array(144);
        for(const index of indices) {
            const hex=SleepDemographics.masks[SleepDemographics.rows[index][3]];
            for(let t=0;t<144;t++) result[t]+=(parseInt(hex[t>>2],16)>>(3-(t&3)))&1;
        }
        if(indices.length) for(let t=0;t<144;t++) result[t]/=indices.length;
        return result;
    }
    function summarize(persons) {
        const weekday=persons.filter(p=>p.weekday.length),weekend=persons.filter(p=>p.weekend.length);
        const onset=(list,key)=>mean(list.map(p=>mean(p[key].map(i=>DATA[i][0]))));
        const weekdayOnset=onset(weekday,'weekday'),weekendOnset=onset(weekend,'weekend');
        const duration=(list,key)=>mean(list.map(p=>mean(p[key].map(i=>DATA[i][1]))));
        const weekdayDuration=duration(weekday,'weekday'),weekendDuration=duration(weekend,'weekend');
        const durationMean=duration(persons,'indices');
        const occupations=new Map();
        for(const p of persons) occupations.set(p.occupation,(occupations.get(p.occupation)||0)+1);
        return {people:persons.length,diaries:persons.reduce((s,p)=>s+p.indices.length,0),
            weekdayPeople:weekday.length,weekendPeople:weekend.length,
            pairedPeople:persons.filter(p=>p.weekday.length&&p.weekend.length).length,
            weekdayOnset,weekendOnset,weekdayDuration,weekendDuration,durationMean,
            differenceMinutes:weekdayOnset===null||weekendOnset===null?null:(weekendOnset-weekdayOnset)*60,
            occupations:[...occupations].sort((a,b)=>b[1]-a[1]),
            weekdayCurve:averageCurve(weekday.map(p=>p.weekdayCurve)),
            weekendCurve:averageCurve(weekend.map(p=>p.weekendCurve))};
    }
    function build(indices) {
        if(SleepDemographics.rows.length!==DATA.length) throw Error('Demographic alignment mismatch');
        const people=new Map();
        for(const i of indices) {
            const [id,age,occupation]=SleepDemographics.rows[i];
            let p=people.get(id);
            if(!p) {
                const group=definitions.find(g=>age>=g.min&&age<=g.max);
                if(!group) throw Error('Unclassified age: '+age);
                p={id,age,occupation,groupId:group.id,indices:[],weekday:[],weekend:[]};people.set(id,p);
            }
            p.indices.push(i);p[DATA[i][2]===1?'weekday':'weekend'].push(i);
        }
        for(const p of people.values()) {p.weekdayCurve=curve(p.weekday);p.weekendCurve=curve(p.weekend);}
        const persons=[...people.values()];
        const groups=definitions.map(def=>{const members=persons.filter(p=>p.groupId===def.id);return {...def,persons:members,stats:summarize(members)};});
        return {groups,persons,indices:[...indices],stats:summarize(persons)};
    }
    return {build,definitions};
})();
