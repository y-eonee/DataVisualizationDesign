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
