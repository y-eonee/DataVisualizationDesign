// Added link only: teammate files are untouched. When the camera is zoomed onto an age
// surface and an occupation node is clicked, open the Social Jetlag flow for that age.
(function(){
  var o=document.createElement('div');o.id='flow-overlay';o.hidden=true;
  o.style.cssText='position:fixed;inset:0;z-index:9999;background:#000';
  var f=document.createElement('iframe');f.title='Age flow';f.style.cssText='width:100%;height:100%;border:0;display:block';
  o.appendChild(f);document.body.appendChild(o);
  function open(id){f.src='flow/index.html?embed=1&six=1&v='+Date.now()+'#flow'+id;o.hidden=false;SleepNetwork.stop();setTimeout(function(){try{f.contentWindow.focus()}catch(e){}},300)}
  addEventListener('message',function(e){if(e.data==='sj-close'){o.hidden=true;f.src='about:blank';dispatchEvent(new CustomEvent('sleepdetailready',{detail:window.sleepRegionSelection}))}});
  var map=document.getElementById('map'),before=null;
  function sig(){return (SleepNetwork.selection.selectedOccupations||[]).length}
  map.addEventListener('pointerdown',function(){before={close:SleepNetwork.animation.surfaceView&&SleepNetwork.animation.surfaceBlend>.9,sig:sig()}},true);
  map.addEventListener('pointerup',function(){
    var b=before;before=null;if(!b||!b.close)return;
    setTimeout(function(){
      var s=SleepNetwork.selection;
      if(sig()>b.sig&&s.selectedAgeGroup!==null&&s.selectedAgeGroup!==undefined)open(s.selectedAgeGroup);
    },30);
  },false);
})();

// Added: plain-language social jetlag note under SELECTED DATA SUMMARY (reads the panel's own values).
(function(){
  var means=document.querySelector('.age-means');if(!means)return;
  var box=document.createElement('div');box.id='sj-note';
  box.style.cssText='margin:14px 0 4px;padding:12px 0 0;border-top:1px solid rgba(255,255,255,.14);font-size:12px;line-height:1.7;color:#e8e1f2';
  means.parentNode.insertBefore(box,means.nextSibling);
  var $=function(id){return document.getElementById(id)};
  var mins=function(t){var m=/(\d+)\s*(?:h|시간)\s*(\d+)/.exec(t||'');return m?+m[1]*60+ +m[2]:null};
  var hm=function(m){m=Math.round(Math.abs(m));return m>=60?Math.floor(m/60)+'시간'+(m%60?' '+m%60+'분':''):m+'분'};
  var AGE={'10s':'10대','20s':'20대','30s':'30대','40s':'40대','50s':'50대','60+':'60대 이상'};
  function subject(t){if(t==='All respondents'||t==='All selected-region data')return '전체 응답자';
    return t.split(' / ').map(function(x){return AGE[x]||x}).join(' · ')}
  function render(){
    if(!($('age-difference').textContent||'').trim()){box.style.display='none';return}box.style.display='';
    var d=parseFloat(($('age-difference').textContent||'').replace('−','-')),
        wdur=mins($('age-weekday-duration').textContent),edur=mins($('age-weekend-duration').textContent),
        wd=$('age-weekday').textContent,we=$('age-weekend').textContent,who=subject($('age-title').textContent||'');
    if(isNaN(d)){box.innerHTML='<b style="display:block;font-size:11px;color:#b69cff;margin-bottom:6px">사회적 시차</b>평일·주말 기록이 함께 있는 응답자가 없어 이 집단의 사회적 시차는 계산할 수 없습니다.';return}
    var a=Math.abs(d),dir=d>0?'늦게':'일찍';
    var s1=a<1?'주말에도 평일과 거의 같은 시각에 잠들기 시작합니다':'주말에는 평일보다 평균 <b>'+hm(a)+' '+dir+'</b> 잠들기 시작합니다';
    s1+=' (평일 '+wd+' → 주말 '+we+').';
    var s2='';
    if(wdur!==null&&edur!==null){var dd=edur-wdur;
      s2=' 수면 시간은 평일 '+$('age-weekday-duration').textContent+', 주말 '+$('age-weekend-duration').textContent+(Math.abs(dd)<5?'로 비슷합니다.':'으로 주말에 '+hm(dd)+(dd>0?' 더 깁니다.':' 더 짧습니다.'))}
    var mid=(wdur!==null&&edur!==null)?d+(edur-wdur)/2:d,am=Math.abs(mid);
    var lvl=am<15?'거의 없는 수준':am<30?'작은 편':am<60?'중간 정도':'큰 편';
    var s3=' 수면의 중간 시각으로 보면 주말이 평일보다 약 <b>'+hm(am)+(mid>=0?' 늦어':' 빨라')+'</b>, 사회적 시차는 <b>'+lvl+'</b>입니다.';
    box.innerHTML='<b style="display:block;font-size:11px;color:#b69cff;margin-bottom:6px">사회적 시차 · '+who+'</b>'+who+' 집단은 '+s1+s2+s3
      +'<span style="display:block;margin-top:8px;font-size:10.5px;line-height:1.6;color:#8e80a1">사회적 시차(SJL)는 평일 일정에 맞춘 생활 리듬과 쉬는 날의 자연스러운 리듬이 얼마나 어긋나는지를 뜻하며, 주말과 평일의 수면 중간 시각 차이로 잽니다. 여기서는 집단 평균 취침 시각과 수면 시간으로 근사한 값이라 개인별 SJL 값은 아닙니다. 구분 기준(15분·30분·1시간)은 읽기 편하게 정한 참고 기준입니다.</span>';
  }
  var mo=new MutationObserver(render);
  ['age-title','age-difference','age-weekday','age-weekend','age-weekday-duration','age-weekend-duration'].forEach(function(id){mo.observe($(id),{childList:true,characterData:true,subtree:true})});
  render();
})();

// Added: only a weekday / weekend indicator (the original clock + phase text stay hidden).
(function(){
  var src=document.getElementById('comparison-phase'),host=document.getElementById('detail-visual');
  if(!src||!host)return;
  var el=document.createElement('div');el.id='sj-phase';
  el.style.cssText='position:absolute;top:44px;left:18px;z-index:3;pointer-events:none;padding:5px 14px;border-radius:999px;border:1px solid;font-size:14px;font-weight:600;transition:color .4s,border-color .4s,background .4s';
  host.appendChild(el);
  var last='';
  function render(){
    var t=src.textContent||'',m=/(\d+)%\s*weekend/.exec(t),k;
    if(/Weekend only/i.test(t))k='we';else if(/Weekday only/i.test(t))k='wd';
    else if(m)k=+m[1]>=50?'we':'wd';else k=/Weekend emphasis/i.test(t)?'we':/Weekday emphasis/i.test(t)?'wd':last||'wd';
    if(k===last)return;last=k;
    var c=k==='we'?'#E9A8C9':'#83CEDC';
    el.textContent=k==='we'?'주말':'평일';el.style.color=c;el.style.borderColor=c;el.style.background=k==='we'?'rgba(233,168,201,.14)':'rgba(131,206,220,.14)';
  }
  new MutationObserver(render).observe(src,{childList:true,characterData:true,subtree:true});
  render();
})();
