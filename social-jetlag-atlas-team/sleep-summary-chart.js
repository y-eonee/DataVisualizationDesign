const SleepSummaryChart = (() => {
    const canvas = document.getElementById('summary-clock');
    const context = canvas.getContext('2d');
    const mint = '#afe8d5';
    let summary = null;
    let selectedBand = 0;
    let currentModel = null;
    let currentTitle = '';
    const bandButtons = [...document.querySelectorAll('[data-summary-band]')];
    const bandNames = ['거의 같음', '보통', '큼'];
    for (const button of bandButtons) {
        button.addEventListener('click', () => {
            const band = Number(button.dataset.summaryBand);
            selectedBand = selectedBand === band ? null : band;
            if (currentModel) update(currentModel, currentTitle);
        });
    }
    const wrap = minutes => ((minutes % 1440) + 1440) % 1440;
    const difference = (from, to) => wrap(to - from + 720) - 720;
    const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
    const circularMean = values => {
        const x = mean(values.map(value => Math.cos(value * Math.PI / 720)));
        const y = mean(values.map(value => Math.sin(value * Math.PI / 720)));
        return wrap(Math.atan2(y, x) * 720 / Math.PI);
    };
    const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value);
    function night(indices) {
        const onset = circularMean(indices.map(index => (DATA[index][0] + 18) * 60));
        const duration = mean(indices.map(index => DATA[index][1] * 60));
        return {onset, duration, midpoint: wrap(onset + duration / 2)};
    }
    function update(model, title) {
        currentModel = model;
        currentTitle = title;
        const allPairs = model.persons.filter(person => person.weekday.length && person.weekend.length)
            .map(person => ({weekday: night(person.weekday), weekend: night(person.weekend)}));
        const bandOf = pair => { const m = Math.abs(difference(pair.weekday.midpoint, pair.weekend.midpoint)); return m < 30 ? 0 : m < 60 ? 1 : 2; };
        const counts = [0, 0, 0];
        allPairs.forEach(pair => counts[bandOf(pair)]++);
        const dist = document.getElementById('summary-distribution');
        dist.replaceChildren();
        counts.forEach((count, index) => {
            const percent = allPairs.length ? count / allPairs.length * 100 : 0;
            const row = document.createElement('div');
            row.className = 'summary-dist-row' + (selectedBand === index ? ' active' : '');
            const name = document.createElement('span'); name.textContent = bandNames[index];
            const track = document.createElement('div'); track.className = 'summary-dist-track';
            const fill = document.createElement('i'); fill.style.width = percent + '%'; track.append(fill);
            const value = document.createElement('b'); value.textContent = count.toLocaleString() + '명 · ' + percent.toFixed(1) + '%';
            row.append(name, track, value); dist.append(row);
        });
        const pairs = allPairs.filter(pair => {
            if (selectedBand === null) return true;
            const magnitude = Math.abs(difference(pair.weekday.midpoint, pair.weekend.midpoint));
            return selectedBand === (magnitude < 30 ? 0 : magnitude < 60 ? 1 : 2);
        });
        document.getElementById('summary-cohort').textContent = title + ' · ' + (selectedBand === null ? '전체 시차 구간' : bandNames[selectedBand]) + ' ' + pairs.length.toLocaleString() + '명 / 비교 가능 ' + allPairs.length.toLocaleString() + '명';
        if (!pairs.length) summary = null;
        else {
            const weekday = {onset: circularMean(pairs.map(pair => pair.weekday.onset)), duration: mean(pairs.map(pair => pair.weekday.duration))};
            const weekend = {onset: circularMean(pairs.map(pair => pair.weekend.onset)), duration: mean(pairs.map(pair => pair.weekend.duration))};
            summary = {weekday, weekend,
                onset: Math.round(mean(pairs.map(pair => difference(pair.weekday.onset, pair.weekend.onset)))),
                midpoint: Math.round(mean(pairs.map(pair => difference(pair.weekday.midpoint, pair.weekend.midpoint)))),
                wake: Math.round(mean(pairs.map(pair => difference(wrap(pair.weekday.onset + pair.weekday.duration), wrap(pair.weekend.onset + pair.weekend.duration)))))};
        }
        bandButtons.forEach((element, index) => {
            element.classList.toggle('active', selectedBand === index);
            element.setAttribute('aria-pressed', String(selectedBand === index));
        });
        document.getElementById('summary-caption').textContent = summary
            ? '호·막대 = 수면 구간 · 점 = 중간 시각 · 민트 평일, 흰색 주말. 개인별 시차의 절댓값으로 구간을 나누고 선택한 응답자의 시차를 평균했습니다. 선택한 구간을 다시 누르면 전체를 봅니다.'
            : '선택한 구간에 평일·주말을 모두 기록한 응답자가 없습니다.';
        draw();
    }
    function draw() {
        const width = canvas.clientWidth;
        if (!width) return;
        const height = width * .61;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        context.setTransform(dpr * width / 640, 0, 0, dpr * width / 640, 0, 0);
        context.clearRect(0, 0, 640, 391);
        if (!summary) return;
        const ctx = context;
        const clockHours = Math.max(12, Math.ceil(Math.max(summary.weekday.duration, summary.weekend.duration) / 360) * 6);
        const clockMinutes = clockHours * 60;
        const clockStart = 18 * 60;
        const text = (value, x, y, size = 13, color = '#aaa', weight = 400) => {
            ctx.fillStyle = color;
            ctx.font = weight + ' ' + size + 'px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
            ctx.fillText(value, x, y);
        };
        function arc(night, radius, color) {
            const start = (night.onset - clockStart) * Math.PI * 2 / clockMinutes - Math.PI / 2;
            const end = start + night.duration * Math.PI * 2 / clockMinutes;
            ctx.lineWidth = 14;
            ctx.lineCap = 'round';
            ctx.strokeStyle = '#242424';
            ctx.beginPath();
            ctx.arc(148, 207, radius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.arc(148, 207, radius, start, end);
            ctx.stroke();
            const middle = (start + end) / 2;
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(148 + Math.cos(middle) * radius, 207 + Math.sin(middle) * radius, 4.5, 0, 2 * Math.PI);
            ctx.fill();
        }
        arc(summary.weekday, 121, mint);
        arc(summary.weekend, 96, '#fff');
        ctx.textAlign = 'center';
        const clockLabel = part => String((18 + clockHours * part) % 24).padStart(2,'0');
        text(clockLabel(0), 148, 62);
        text(clockLabel(.25), 292, 211);
        text(clockLabel(.5), 148, 356);
        text(clockLabel(.75), 8, 211);
        text(clockHours + '시간 확대', 148, 211, 12);
        ctx.textAlign = 'left';
        text('수면 중간 시각 차이 (주말 − 평일)', 330, 58, 12);
        text(signed(summary.midpoint) + '분', 330, 110, 45, mint, 650);
        const timeX = value => 330 + value / 1440 * 294;
        ctx.strokeStyle = '#353535';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(330, 164);
        ctx.lineTo(624, 164);
        ctx.stroke();
        ctx.textAlign = 'center';
        for (const hour of [0, 6, 12, 18, 24]) text(String(hour).padStart(2, '0'), timeX(hour * 60), 153, 11);
        ctx.textAlign = 'left';
        function bar(night, y, color, label) {
            text(label, 330, y - 13, 12, '#fff');
            const start = wrap(night.onset);
            const end = start + night.duration;
            const intervals = end > 1440 ? [[start, 1440], [0, end - 1440]] : [[start, end]];
            ctx.strokeStyle = color;
            ctx.lineWidth = 11;
            ctx.lineCap = 'round';
            for (const [from, to] of intervals) {
                ctx.beginPath();
                ctx.moveTo(timeX(from), y);
                ctx.lineTo(timeX(to), y);
                ctx.stroke();
            }
            ctx.fillStyle = '#000';
            ctx.beginPath();
            ctx.arc(timeX(wrap(start + night.duration / 2)), y, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
        bar(summary.weekday, 201, mint, '평일');
        bar(summary.weekend, 252, '#fff', '주말');
        ctx.strokeStyle = '#353535';
        ctx.beginPath();
        ctx.moveTo(330, 293);
        ctx.lineTo(624, 293);
        ctx.stroke();
        for (const [index, [label, value]] of [['취침', summary.onset], ['중간', summary.midpoint], ['기상', summary.wake]].entries()) {
            text(label, 330 + index * 101, 319, 12);
            text(signed(value) + '분', 330 + index * 101, 347, 19, index === 1 ? mint : '#fff', 600);
        }
    }
    new ResizeObserver(draw).observe(canvas);
    return {update};
})();
