// 도입부: 가상 스크롤(휠·터치·키)로 진행도 p(0~1)를 올리면
//  텍스트 장면 → 등고선 원이 중앙으로 모이며 퍼짐 → 홍채처럼 열리며 3D 구가 나타난다. 페이지 이동 없음.
(function () {
  'use strict';
  // 계산기에서 넘어오거나(?personal) 특정 위치로 바로 이동(#...)하는 경우에는 도입부를 건너뛴다.
  if (new URLSearchParams(location.search).has('personal') || location.hash) return;
  var SCENES = [
    { id: 's0', a: 0, b: .1, cover: true,
      h: '주말에 몰아 자는 건, 게으름일까요?',
      sub: '평일에 빌려 쓴 잠을 주말에 갚는 사람들의 하루를 지도로 그렸습니다.' },
    { id: 's1', a: .1, b: .3, n: '01', label: '사회적 시차란', h: '사회적 시차란',
      body: '<p>월요일 아침 알람에 맞춰 일어나고, 금요일 밤에는 늦게 자고, 주말에는 늦잠을 잡니다. 비행기를 타지 않아도 우리 몸은 매주 작은 시차를 겪습니다.</p>' +
        '<p>이것을 <b>사회적 시차(Social Jetlag)</b>라고 부릅니다. 몸이 원하는 수면 리듬과 학교·직장이 정한 시간표가 어긋나면서 생기는 시차입니다. 시간생물학자 틸 뢰네베르크 연구팀이 2006년에 이 개념을 제안했고, 보통 쉬는 날과 일하는 날의 수면 중간 시각이 얼마나 다른가로 잽니다.</p>' },
    { id: 's2', a: .3, b: .5, n: '02', label: '만들게 된 배경', h: '만들게 된 배경',
      body: '<p>수면 이야기는 대부분 "몇 시간 잤는가"에서 멈춥니다. 하지만 같은 7시간이라도 <b>언제</b> 자고 평일과 주말에 얼마나 달라지는지는 사람마다 다릅니다.</p>' +
        '<p>통계청 생활시간조사는 하루를 10분 단위로 기록합니다. 그래서 언제 잠들고 언제 깼는지를 평일과 주말로 나란히 놓고 볼 수 있습니다. 평일과 주말 기록을 모두 남긴 응답자 9,634명의 하루를 연령대와 직업별로 묶어 한눈에 비교해 보고 싶었습니다.</p>' },
    { id: 's3', a: .5, b: .72, n: '03', label: '이렇게 보세요', h: '이렇게 보세요',
      body: '<p>구를 돌려보세요.</p><ul><li>구 위의 영역은 연령대입니다.</li><li>원판의 크기는 그 집단에 속한 사람의 수입니다.</li><li>원판의 색은 그 집단에서 가장 많은 직업입니다.</li><li>줄기는 평일과 주말 사이에서 수면 시간이 늘고 줄어드는 폭을 보여 줍니다.</li></ul>' +
        '<p>드래그로 회전하고 스크롤로 확대할 수 있습니다. 직업은 최대 3개까지 골라 비교할 수 있습니다.</p>' }
  ];
  var REVEAL_A = .74;                       // 이 지점부터 구가 열린다
  var PAL = ['#F68CC0', '#EDCD72', '#78DCAD', '#72BFED', '#BB9BFF'];
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (x, a, b) { return Math.min(b || 1, Math.max(a || 0, x)); };
  var sm = function (x) { x = clamp(x); return x * x * (3 - 2 * x); };
  var easeIO = function (x) { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  var easeO = function (x) { return 1 - Math.pow(1 - clamp(x), 4); };

  // ---------- DOM ----------
  var root = document.createElement('div');
  root.id = 'intro';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', '도입부. 스크롤하면 지도가 열립니다.');
  root.innerHTML = '<div class="is-bg"></div><canvas></canvas><div class="is-stage"></div>' +
    '<div class="is-brand"><i></i>Social Jetlag</div>' +
    '<button class="is-skip" type="button">건너뛰기 →</button>' +
    '<div class="is-steps"></div><div class="is-hint">SCROLL</div>';
  document.body.appendChild(root);
  document.body.classList.add('intro-on');
  var bg = root.querySelector('.is-bg'), cv = root.querySelector('canvas'), cx = cv.getContext('2d'),
    stage = root.querySelector('.is-stage'), hint = root.querySelector('.is-hint'),
    stepsEl = root.querySelector('.is-steps'), globe = document.getElementById('detail-screen');

  function wrapWords(node, cls) {            // <b> 안의 단어는 .em 으로 강조
    var out = [];
    Array.prototype.slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var parts = n.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
        parts.forEach(function (t) {
          if (!t) return;
          if (/^\s+$/.test(t)) { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span'); s.className = 'w' + (cls ? ' ' + cls : ''); s.textContent = t;
          frag.appendChild(s); out.push(s);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1) {
        out = out.concat(wrapWords(n, n.tagName === 'B' ? 'em' : cls));
      }
    });
    return out;
  }

  SCENES.forEach(function (S) {
    var el = document.createElement('section');
    el.className = 'is-scene is-' + S.id;
    var html = '';
    if (S.n) html += '<span class="is-num"><span>' + S.n + ' — ' + S.label + '</span></span>';
    html += '<h2 class="is-h">' + S.h.split(' ').map(function (w) { return '<span class="m"><span>' + w + '</span></span>'; }).join(' ') + '</h2>';
    if (S.body) html += '<div class="is-body">' + S.body + '</div>';
    if (S.sub) html += '<p class="is-sub">' + S.sub + '</p>';
    el.innerHTML = html;
    stage.appendChild(el);
    S.el = el;
    S.hw = [].slice.call(el.querySelectorAll('.is-h .m>span'));
    S.num = el.querySelector('.is-num>span');
    S.sub = el.querySelector('.is-sub');
    S.words = []; S.lis = [].slice.call(el.querySelectorAll('li'));
    var body = el.querySelector('.is-body');
    if (body) S.words = wrapWords(body);
    if (S.n) {
      var st = document.createElement('div'); st.className = 'st'; st.innerHTML = '<b>' + S.n + '</b><s></s><span>' + S.label + '</span>';
      stepsEl.appendChild(st); S.step = st;
    }
  });

  // ---------- 등고선 캔버스 ----------
  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  }
  addEventListener('resize', resize); resize();
  var N = 18, rings = [];
  for (var k = 0; k < N; k++) {
    var dots = [];
    for (var d = 0; d < 3 + (k % 5); d++) dots.push({ a: Math.random() * 6.283, s: (Math.random() < .5 ? -1 : 1) * (.08 + Math.random() * .22), r: 1.6 + Math.random() * 2.6 });
    rings.push({ ph: k * 1.7, c: PAL[k % 5], dots: dots, a1: .035 + .03 * Math.sin(k * 1.3), a2: .02 + .02 * Math.cos(k * .9) });
  }
  function blob(R, ring, t, steps, extra) {
    cx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var th = i / steps * 6.2832,
        r = R * (1 + ring.a1 * Math.sin(3 * th + ring.ph + t * .5) + ring.a2 * Math.sin(5 * th - ring.ph * 1.3 - t * .35) + (extra || 0));
      var x = Math.cos(th) * r, y = Math.sin(th) * r * .94;
      i ? cx.lineTo(x, y) : cx.moveTo(x, y);
    }
  }

  // ---------- 상태 ----------
  var target = 0, cur = 0, done = false, t0 = performance.now(), last = t0, loadT = 0;
  var total = 7.2;                                // 화면 N장 분량의 휠 거리
  function add(d) { if (!done) target = clamp(target + d); }
  root.addEventListener('wheel', function (e) {
    e.preventDefault();
    var k = e.deltaMode === 1 ? 32 : 1;
    add(e.deltaY * k / (H * total));
  }, { passive: false });
  var ty = null;
  root.addEventListener('touchstart', function (e) { ty = e.touches[0].clientY; }, { passive: true });
  root.addEventListener('touchmove', function (e) {
    var y = e.touches[0].clientY; if (ty != null) add((ty - y) / (H * 2.6)); ty = y;
  }, { passive: true });
  addEventListener('keydown', function (e) {
    if (done) return;
    var m = { ArrowDown: .035, PageDown: .12, ' ': .12, ArrowUp: -.035, PageUp: -.12, End: 1, Home: -1 }[e.key];
    if (m == null) return;
    e.preventDefault(); add(m);
  });
  root.querySelector('.is-skip').addEventListener('click', function () { target = 1; });

  // ---------- 렌더 ----------
  function sceneUpdate(S, p) {
    var u = (p - S.a) / (S.b - S.a);
    var inn = S.cover ? 1 : sm(u / .1), out = sm((1 - u) / .1);
    var o = inn * out;
    S.el.style.opacity = o;
    S.el.style.visibility = o > .003 ? 'visible' : 'hidden';
    if (o <= .003) return;
    var shift = (1 - out) * -46 + (1 - inn) * 46;
    S.el.style.transform = 'translateY(calc(-50% + ' + shift.toFixed(1) + 'px))';
    S.el.style.filter = (1 - o) > .02 ? 'blur(' + ((1 - o) * 7).toFixed(1) + 'px)' : 'none';
    var n = S.hw.length, hp;
    S.hw.forEach(function (w, i) {
      hp = S.cover ? easeO((loadT - .2 - i * .12) / 1.1) : easeO((u - .02 - i * .018) / .13);
      w.style.transform = 'translateY(' + ((1 - hp) * 112).toFixed(1) + '%)';
    });
    if (S.num) S.num.style.transform = 'translateY(' + ((1 - easeO(S.cover ? 1 : (u - .0) / .1)) * 110).toFixed(1) + '%)';
    if (S.sub) { var sp = easeO(S.cover ? (loadT - 1.1) / 1.2 : 1); S.sub.style.opacity = sp; S.sub.style.transform = 'translateY(' + ((1 - sp) * 18).toFixed(1) + 'px)'; }
    if (S.words.length) {
      var m = S.words.length, g = clamp((u - .12) / .58) * (m + 3);
      S.words.forEach(function (w, i) {
        var wp = clamp((g - i) / 3);
        w.style.opacity = (.16 + .84 * wp).toFixed(3);
        w.style.color = w.classList.contains('em') && wp > .5 ? '#d8c6ff' : '#fff';
      });
      S.lis.forEach(function (li) {
        var f = S.words.indexOf(li.querySelector('.w')); li.style.setProperty('--bo', (.2 + .8 * clamp((g - f) / 3)).toFixed(2));
      });
    }
  }

  function drawRings(p, t) {
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
    var rp = clamp((p - REVEAL_A) / (1 - REVEAL_A)), er = easeIO(rp);
    var conv = sm((p - .62) / .16);                          // 오른쪽 → 중앙으로 모임
    var X = W * (.72 + (.5 - .72) * conv), Y = H * .5;
    var base = Math.min(W, H) * (W < 760 ? .5 : .46);
    var grow = easeO(loadT / 2.6) * clamp(.28 + p * 2.2);    // 처음엔 시간으로, 이후엔 스크롤로 자란다
    var pul = 1 + (1 - er) * .03 * Math.sin(t * .8);
    var irisMax = Math.hypot(W, H) * .56, R = easeIO(rp * 1.05) * irisMax;
    cx.save(); cx.translate(X, Y);
    cx.lineJoin = 'round'; cx.globalCompositeOperation = 'lighter';
    var fade = 1 - sm(rp / .6);
    for (var k = 0; k < N; k++) {
      var f = k / (N - 1), a = clamp((grow - f * .85) * 5);
      if (a <= 0 || fade <= 0) continue;
      var Rk = base * (.1 + .9 * Math.pow(f, .85)) * pul * (1 + er * 1.6);
      var ring = rings[k];
      cx.globalAlpha = a * fade * (.22 + .3 * (1 - f));
      cx.strokeStyle = ring.c; cx.lineWidth = 1.1 + (k % 4 === 0 ? .8 : 0);
      cx.save(); cx.rotate(t * .03 * (k % 2 ? 1 : -1) + p * 2.4 * (k % 2 ? 1 : -1));
      blob(Rk, ring, t, 160); cx.stroke();
      if (k % 6 === 2) { cx.globalAlpha *= .12; cx.fillStyle = ring.c; cx.fill(); }
      cx.restore();
      cx.globalAlpha = a * fade * .9;                       // 궤도 위 점 (= 사람)
      ring.dots.forEach(function (d) {
        var th = d.a + t * d.s + p * 3 * (k % 2 ? 1 : -1), r = Rk * (1 + ring.a1 * Math.sin(3 * (th) + ring.ph + t * .5));
        cx.fillStyle = ring.c; cx.beginPath(); cx.arc(Math.cos(th) * r, Math.sin(th) * r * .94, d.r, 0, 6.2832); cx.fill();
      });
    }
    cx.restore();
    // 홍채 가장자리: 열리는 구의 등고선 테두리
    if (rp > 0 && rp < 1) {
      cx.save(); cx.translate(W / 2, H / 2); cx.globalCompositeOperation = 'lighter';
      for (var j = 0; j < 5; j++) {
        var rr = rings[j * 3 + 1], off = j * 14 * (1 - rp * .5);
        cx.globalAlpha = (1 - sm((rp - .55) / .45)) * (.85 - j * .15);
        cx.strokeStyle = PAL[(j + 4) % 5]; cx.lineWidth = 2 - j * .25;
        cx.shadowColor = PAL[(j + 4) % 5]; cx.shadowBlur = j ? 0 : 24;
        blob(Math.max(1, R - off), rr, t * 1.3, 220, .002); cx.stroke();
      }
      cx.restore();
    }
    return { rp: rp, R: R, er: er };
  }

  var showHint = true;
  function frame(now) {
    if (done) return;
    requestAnimationFrame(frame);
    var dt = Math.min(.05, (now - last) / 1000); last = now; loadT = (now - t0) / 1000;
    cur += (target - cur) * (reduce ? 1 : 1 - Math.exp(-dt * 6));
    if (Math.abs(target - cur) < .0004) cur = target;
    var p = cur, t = now / 1000;
    SCENES.forEach(function (S) { sceneUpdate(S, p); });
    var info = drawRings(p, t);
    // 구 열기 (마스크 구멍 + 구가 살짝 줄어들며 안착)
    var hole = info.R > 1 ? 'radial-gradient(circle at 50% 50%,transparent ' + info.R.toFixed(1) + 'px,#000 ' + (info.R + 1.5).toFixed(1) + 'px)' : '';
    bg.style.webkitMaskImage = bg.style.maskImage = hole;
    globe.style.transform = 'scale(' + (1 + .16 * (1 - info.er)).toFixed(4) + ')';
    // 진행 표시
    SCENES.forEach(function (S) {
      if (!S.step) return;
      var f = clamp((p - S.a) / (S.b - S.a));
      S.step.style.setProperty('--f', f); S.step.classList.toggle('on', p >= S.a && p < S.b + .02);
    });
    var hv = p < .015 && loadT > 1.6;
    if (hv !== showHint) { showHint = hv; hint.style.opacity = hv ? 1 : 0; }
    if (loadT < 1.6) hint.style.opacity = 0;
    stepsEl.style.opacity = 1 - sm((p - .68) / .06);
    if (p >= .999 && target >= .999) finish();
  }

  function finish() {
    done = true; cur = target = 1;
    root.hidden = true; document.body.classList.remove('intro-on');
    globe.style.transform = '';
    var b = document.getElementById('intro-replay'); if (b) b.hidden = false;
    dispatchEvent(new Event('resize'));
  }
  function replay() {
    var b = document.getElementById('intro-replay'); if (b) b.hidden = true;
    done = false; target = cur = 0; t0 = last = performance.now();
    root.hidden = false; document.body.classList.add('intro-on');
    requestAnimationFrame(frame);
  }

  var rb = document.createElement('button');
  rb.id = 'intro-replay'; rb.type = 'button'; rb.hidden = true; rb.textContent = '↑ 도입부 다시 보기';
  rb.style.cssText = 'position:fixed;left:18px;bottom:14px;z-index:35;background:#0b0813cc;color:#ffffffcc;border:1px solid #ffffff33;border-radius:999px;padding:8px 16px;font-size:12px;cursor:pointer;backdrop-filter:blur(6px)';
  rb.addEventListener('click', replay);
  document.body.appendChild(rb);

  requestAnimationFrame(frame);
})();
