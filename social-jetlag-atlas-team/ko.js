// Korean translation layer: DOM text, tooltips, aria/title attributes and canvas text.
// The teammate's source files stay in English; everything visible is translated here.
(function(){
  var EXACT={
    'sleep atlas':'수면 아틀라스','SLEEP ATLAS / FULL DATASET':'수면 아틀라스 / 전체 데이터',
    'Main':'메인','About SJ':'SJ 소개','Data':'데이터','Contact':'문의','About Us':'소개',
    'EXTRACTED DIARIES':'추출된 일기 수','TIME RESOLUTION':'시간 해상도','10 min':'10분',
    'Explore / Day type':'탐색 / 요일 구분','Dot Size = Record Count':'점 크기 = 기록 수',
    'Drag to rotate · Scroll to zoom':'드래그로 회전 · 스크롤로 확대',
    'All Sleep Records':'전체 수면 기록','sleep records':'수면 기록','Region baseline':'구역 기준값',
    'MEAN ONSET':'평균 취침 시각','MEAN DURATION':'평균 수면 시간',
    'GLOBAL OVERVIEW':'전체 개요','Reset filters':'필터 초기화',
    'Unique respondents · selected region':'응답자 수(중복 제외) · 선택한 구역',
    'SELECTED DATA SUMMARY':'선택한 데이터 요약','All respondents':'전체 응답자','All age groups':'전체 연령대',
    'All selected-region data':'선택한 구역 전체 데이터','unique people':'명 (중복 제외)',
    'WEEKDAY ONSET':'평일 취침 시각','WEEKEND ONSET':'주말 취침 시각','WEEKEND − WEEKDAY':'주말 − 평일',
    'WEEKDAY DURATION':'평일 수면 시간','WEEKEND DURATION':'주말 수면 시간',
    'Occupation distribution / original codes':'직업 분포 / 원본 코드',
    'OCCUPATION FILTERS':'직업 필터','Unique respondents · within selected age':'응답자 수(중복 제외) · 선택한 연령대 안에서',
    'Select up to 3 occupations to compare':'최대 3개 직업을 골라 비교하세요',
    'AGE-GROUP FILTERS':'연령대 필터','Unique respondents · within selected occupation':'응답자 수(중복 제외) · 선택한 직업 안에서',
    'COLOR / COMPARISON LEGEND':'색 / 비교 범례','TIME / NETWORK LEGEND':'시간 / 네트워크 범례',
    'Weekday':'평일','Weekend':'주말','Compare':'비교',
    'Clusters = age · Disks / sprouts = aggregate size · Color = occupation share within age cluster':'군집 = 연령대 · 원판·줄기 = 집합 크기 · 색 = 연령 군집 안의 직업 비중',
    'Each age cluster uses its largest recorded occupation as the terrain and branch hue. Shares count unique respondents within this region and age, including unrecorded occupation in the denominator. Unrecorded occupation is excluded from leader ranking and shown as a faint cluster tint. Other occupation disks retain subdued versions of their own hues; smaller shares are fainter. Up to three selected occupations receive outline accents and full emphasis. Disk area = respondents; relief = display overlap; paired-duration stem animation is unchanged.':
      '각 연령 군집은 기록된 최다 직업의 색을 지형과 가지의 색으로 씁니다. 비중은 이 구역·연령대의 응답자(중복 제외) 기준이며, 직업 미기록도 분모에 포함합니다. 직업 미기록은 대표 순위에서 제외하고 군집 색을 옅게 입혀 표시합니다. 다른 직업의 원판은 자기 색을 낮춘 색으로 그리며, 비중이 작을수록 더 옅습니다. 선택한 직업(최대 3개)은 윤곽선과 함께 가장 선명하게 강조됩니다. 원판 면적 = 응답자 수, 지형 = 표시상 겹침이며, 짝 있는 수면 시간에 따른 줄기 움직임은 그대로입니다.',
    'Unweighted, person-balanced means from selected-region diaries. Onset difference is not individual social jetlag. Occupation labels use the official MDIS 2024 response code table; blank means no recorded occupation code, not unemployment. Flat circles represent 2-hour aggregates of unique respondents; circle area is proportional to respondent count. Cluster terrain and branch hue follow the largest recorded occupation by unique respondents. Other occupation colors are subdued according to their share. Unrecorded occupation is excluded from leader ranking and shown as a faint cluster tint. Exact counts and paired duration differences remain available on hover. Overlapping larger disks share raised contour terrain on the sphere (display overlap, not measured geography or sleep height); smaller aggregates sprout from nearby larger disks within their age group. Sprout stems animate between paired person-balanced weekday and weekend sleep durations. Larger duration differences cause larger length changes; unpaired stems remain fixed. Supports and central branches are visual organizing structures, not respondent relationships. Sphere positions are categorical age clusters ordered by sleep bins. Matched weekday/weekend principal wake times are derived from verified sleep runs; unmatched respondents remain in onset/duration aggregates, without inferred wake pairs. Wake differences are not formal social jetlag.':
      '선택한 구역 일기를 사람 수로 균형 맞춘(가중치 없는) 평균입니다. 취침 시각 차이는 개인의 사회적 시차가 아닙니다. 직업 이름은 통계청 MDIS 2024 공식 응답 코드표를 따르며, 빈 값은 직업 코드가 기록되지 않았다는 뜻이지 무직이 아닙니다. 납작한 원은 응답자(중복 제외)를 2시간 단위로 묶은 집합이고, 원의 면적은 응답자 수에 비례합니다. 군집 지형과 가지의 색은 응답자 수가 가장 많은 기록된 직업을 따릅니다. 다른 직업의 색은 비중에 따라 낮춰 표시합니다. 직업 미기록은 대표 순위에서 제외하고 군집 색을 옅게 입혀 표시합니다. 정확한 인원과 짝 있는 수면 시간 차이는 마우스를 올리면 볼 수 있습니다. 겹친 큰 원판은 구 위에서 솟은 등고선 지형을 함께 만듭니다(표시상 겹침이며 실제 지리나 수면의 높이가 아닙니다). 작은 집합은 같은 연령대의 가까운 큰 원판에서 줄기로 자랍니다. 줄기는 짝 있는 응답자의 평일·주말 수면 시간 사이를 오가며, 차이가 클수록 길이 변화가 큽니다. 짝이 없는 줄기는 고정됩니다. 지지대와 중앙 가지는 구조를 정리해 보여 주는 장식이며 응답자 사이의 관계가 아닙니다. 구 위의 위치는 수면 구간 순서로 나눈 연령 군집이라는 범주형 배치입니다. 평일·주말 기상 시각 짝은 검증된 수면 구간에서 구했고, 짝이 없는 응답자는 기상 시각 짝을 추정하지 않고 취침·수면 시간 집계에만 남습니다. 기상 시각 차이는 공식 사회적 시차가 아닙니다.',
    'Sidebar uses all selected-region diaries; paired wakes are not formal social jetlag':'오른쪽 패널은 선택한 구역의 모든 일기를 사용합니다. 짝 있는 기상 시각 차이는 공식 사회적 시차가 아닙니다',
    'Six age clusters; merged contour relief = display overlap, not an additional sleep measurement':'6개 연령 군집. 합쳐진 등고선 지형 = 표시상 겹침이며 추가 수면 측정값이 아닙니다',
    'Stem length animates paired sleep duration; unpaired stems stay fixed':'줄기 길이는 짝 있는 수면 시간을 따라 움직이고, 짝이 없는 줄기는 고정됩니다',
    'Surface disk: larger aggregate attached to the sphere; exact paired wake and duration differences shown above':'표면 원판: 구에 붙은 큰 집합. 짝 있는 기상 시각·수면 시간 차이의 정확한 값은 위에 표시됩니다',
    'SLEEP GLOBE / SIX AGE TERRITORIES':'수면 구 / 6개 연령대 영역',
    'Cluster hue: largest recorded occupation · fainter: lower respondent share · area: people':'군집 색: 기록된 최다 직업 · 옅을수록: 응답자 비중 낮음 · 면적: 인원',
    'Cluster hue: leading occupation · faint: smaller groups':'군집 색: 대표 직업 · 옅음: 적은 집단',
    'Page not yet available':'아직 제공되지 않는 페이지입니다','Age flow':'연령대 flow',
    'Sleep Atlas main':'수면 아틀라스 메인','Main navigation':'메인 내비게이션',
    'Atlas information and day filters':'아틀라스 정보와 요일 필터','Clear selected sleep region':'선택한 수면 구역 해제',
    'Interactive sleep region atlas':'수면 구역 인터랙티브 아틀라스','Map zoom controls':'지도 확대·축소 조작',
    'Sleep globe: six age clusters with radial layered contour disks. Drag to orbit, scroll to zoom.':'수면 구: 방사형 층 등고선 원판으로 이뤄진 6개 연령 군집. 드래그로 회전, 스크롤로 확대',
    'Full sleep globe. Drag to rotate, scroll to zoom.':'수면 구 전체. 드래그로 회전, 스크롤로 확대',
    'Simulated time':'시뮬레이션 시각','Sleep data explorer':'수면 데이터 탐색 패널','Filter age group':'연령대 필터',
    'Sleep activity over 24 hours':'24시간 수면 활동','Day-type emphasis; both datasets remain visible':'요일 강조: 두 데이터 모두 표시됩니다',
    'Occupation not recorded':'직업 미기록'
  };
  // Ordered pattern rules applied to any text (also to each tooltip line).
  var RULES=[
    [/([\d,]+) visible records/g,'표시 중인 기록 $1건'],
    [/([\d.]+)% of all valid records/g,'전체 유효 기록의 $1%'],
    [/sleep records in one landscape\./g,'수면 기록을 하나의 지형으로 보여 줍니다.'],
    [/([\d,]+) diary records/g,'일기 기록 $1건'],
    [/Unique respondents: weekday (\d+) \/ weekend (\d+) \/ both (\d+)/g,'응답자(중복 제외): 평일 $1명 / 주말 $2명 / 둘 다 $3명'],
    [/Principal sleep \/ Weekday (\d+)% \/ Weekend (\d+)%/g,'주 수면 / 평일 $1% / 주말 $2%'],
    [/([\d,]+) landscape aggregates \/ ([\d,]+) actual diaries \/ ([\d,]+) unique people; complete data, no terrain sampling/g,'지형 집합 $1개 / 실제 일기 $2건 / 응답자 $3명(중복 제외); 전체 데이터이며 지형 표집은 없습니다'],
    [/Paired weekday \/ weekend/g,'평일·주말 짝 있음'],
    [/Weekday \(unpaired\)/g,'평일만 있음(짝 없음)'],[/Weekend \(unpaired\)/g,'주말만 있음(짝 없음)'],
    [/([\d,]+) actual diary records \/ ([\d,]+) unique respondents/g,'실제 일기 기록 $1건 / 응답자 $2명(중복 제외)'],
    [/(\d+)-hour weekday wake × weekend wake bins/g,'$1시간 단위 평일 기상 × 주말 기상 구간'],
    [/Unpaired: (\d+)-hour onset × duration bins; no wake difference inferred/g,'짝 없음: $1시간 단위 취침 × 수면 시간 구간 · 기상 시각 차이는 추정하지 않음'],
    [/Age group: ([\d,]+) unique people \/ ([\d,]+) diaries/g,'연령대: 응답자 $1명(중복 제외) / 일기 $2건'],
    [/Mean onset (\S+) \/ mean duration ([\d.]+) min/g,'평균 취침 $1 / 평균 수면 $2분'],
    [/Mean paired wake difference ([-+−]?[\d.]+) min/g,'짝 있는 응답자의 평균 기상 시각 차이 $1분'],
    [/Paired duration difference ([-+−]?[\d.]+) min/g,'짝 있는 응답자의 수면 시간 차이 $1분'],
    [/Weekday sleep duration ([\d.]+) min \/ weekend ([\d.]+) min/g,'평일 수면 시간 $1분 / 주말 $2분'],
    [/Weekday wake (\S+) \/ weekend wake (\S+)/g,'평일 기상 $1 / 주말 기상 $2'],
    [/Occupation: Occupation not recorded/g,'직업: 미기록'],
    [/Occupation: /g,'직업: '],[/ · largest recorded occupation/g,' · 기록된 최다 직업'],[/ \/ age-cluster share /g,' / 연령 군집 내 비중 '],
    [/ · unique respondents/g,' · 응답자 수(중복 제외)'],
    [/(\d+)h\s*(\d+)m\b/g,'$1시간 $2분'],
    [/([-+−]?[\d.]+) min\b/g,'$1분'],
    [/\b([1-5]0)s\b/g,'$1대'],[/\b60\+/g,'60대 이상'],
    [/sleep atlas/g,'수면 아틀라스']
  ];
  var cache=new Map();
  function T(text){
    if(!text||!/[A-Za-z]|\d\+/.test(text))return text;
    if(cache.has(text))return cache.get(text);
    var lead=/^\s*/.exec(text)[0],trail=/\s*$/.exec(text)[0],core=text.trim(),out;
    if(EXACT.hasOwnProperty(core))out=EXACT[core];
    else{out=core;for(var i=0;i<RULES.length;i++)out=out.replace(RULES[i][0],RULES[i][1]);}
    out=lead+out+trail;if(cache.size>4000)cache.clear();cache.set(text,out);return out;
  }
  window.koT=T;

  // Canvas text (labels, captions).
  var proto=CanvasRenderingContext2D.prototype,ft=proto.fillText,st=proto.strokeText,mt=proto.measureText;
  proto.fillText=function(t){arguments[0]=T(String(t));return ft.apply(this,arguments)};
  proto.strokeText=function(t){arguments[0]=T(String(t));return st.apply(this,arguments)};
  proto.measureText=function(t){return mt.call(this,T(String(t)))};

  // DOM text + attributes. The hidden original clock and the phase indicator read English, so they stay untouched.
  var SKIP='.network-clock,#sj-phase,script,style';
  var ATTRS=['title','aria-label'];
  function skip(n){var e=n.nodeType===1?n:n.parentElement;return !e||(e.closest&&e.closest(SKIP));}
  function fixNode(n){
    if(n.nodeType===3){if(skip(n))return;var v=T(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;return}
    if(n.nodeType!==1||skip(n))return;
    ATTRS.forEach(function(a){var v=n.getAttribute&&n.getAttribute(a);if(v){var t=T(v);if(t!==v)n.setAttribute(a,t)}});
    for(var c=n.firstChild;c;c=c.nextSibling)fixNode(c);
  }
  function start(){
    fixNode(document.body);
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){var m=ms[i];
        if(m.type==='characterData')fixNode(m.target);
        else if(m.type==='attributes'){var e=m.target;if(skip(e))continue;var v=e.getAttribute(m.attributeName);if(v){var t=T(v);if(t!==v)e.setAttribute(m.attributeName,t)}}
        else m.addedNodes.forEach(fixNode);
      }
    }).observe(document.body,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:ATTRS});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
