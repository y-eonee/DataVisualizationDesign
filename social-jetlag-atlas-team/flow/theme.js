// Pretendard, letter-spacing -5% for canvas text too (CSS covers the DOM).
(function(){
  var proto=CanvasRenderingContext2D.prototype,d=Object.getOwnPropertyDescriptor(proto,'font');
  Object.defineProperty(proto,'font',{configurable:true,get:d.get,set:function(v){
    var m=/(\d+(?:\.\d+)?)px/.exec(v);
    if(!m){d.set.call(this,v);return}
    var px=+m[1];d.set.call(this,v.slice(0,m.index)+px+'px Pretendard, sans-serif');
    if('letterSpacing' in this){this.letterSpacing=(-.05*px)+'px';this.wordSpacing=(.05*px)+'px'}
  }});
  if(document.fonts)[400,500,700,800].forEach(function(w){document.fonts.load(w+' 12px Pretendard')});
})();
