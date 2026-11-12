const SleepOccupationShifts = (() => {
    const dialog = document.getElementById('occupation-shifts');
    const title = document.getElementById('occupation-shifts-title');
    const summary = document.getElementById('occupation-shifts-summary');
    const rows = document.getElementById('occupation-shifts-rows');
    const axis = document.getElementById('occupation-shifts-axis');
    document.getElementById('occupation-shifts-back').addEventListener('click', () => dialog.close());

    function summarize(group) {
        const byCode = new Map(SleepOccupations.definitions.map(({code, label}) => [code, {
            label, count: 0, earlier: {sum: 0, count: 0}, later: {sum: 0, count: 0}
        }]));
        for (const {person, shift} of SleepAgeTerrainData.pairedShifts(group, DATA)) {
            const row = byCode.get(person.occupation);
            row.count++;
            if (Math.abs(shift) < 1e-8) continue;
            const direction = shift < 0 ? row.earlier : row.later;
            direction.sum += Math.abs(shift);
            direction.count++;
        }
        return [...byCode.values()];
    }

    const mean = ({sum, count}) => count ? sum / count : 0;
    const format = (value, sign) => {
        const rounded = Math.round(value);
        return rounded ? sign + rounded : value ? sign + value.toFixed(2) : '0';
    };

    function renderSide(side, direction, limit) {
        const half = document.createElement('span');
        half.className = 'occupation-shift-half ' + side;
        if (!direction.count) return half;
        const value = mean(direction);
        const bar = document.createElement('span');
        bar.className = 'occupation-shift-bar';
        bar.style.width = (value / limit * 80) + '%';
        const sign = side === 'earlier' ? '−' : '+';
        bar.title = format(value, sign) + '분 · ' + direction.count.toLocaleString() + '명';
        const number = document.createElement('span');
        number.className = 'occupation-shift-value';
        number.textContent = format(value, sign);
        bar.append(number);
        half.append(bar);
        return half;
    }

    function renderRow({label, count, earlier, later}, limit) {
        const row = document.createElement('tr');
        const heading = document.createElement('th');
        heading.scope = 'row';
        heading.textContent = label;
        const countLabel = document.createElement('small');
        countLabel.textContent = count.toLocaleString() + '명';
        heading.append(countLabel);
        const cell = document.createElement('td');
        const plot = document.createElement('div');
        plot.className = 'occupation-shift-track';
        plot.append(renderSide('earlier', earlier, limit), renderSide('later', later, limit));
        if (!earlier.count && !later.count) {
            const empty = document.createElement('span');
            empty.className = 'occupation-shift-empty';
            empty.textContent = count ? '0분' : '표본 없음';
            plot.append(empty);
        }
        cell.append(plot);
        row.append(heading, cell);
        return row;
    }

    function open(group) {
        if (dialog.open) return;
        const data = summarize(group);
        const peak = Math.max(...data.flatMap(row => [mean(row.earlier), mean(row.later)]));
        const limit = Math.max(60, Math.ceil(peak / 60) * 60);
        const age = group.id === 5 ? '60대 이상' : group.min + '대';
        title.textContent = age + ' 직업별 수면 시차';
        summary.textContent = '평일·주말 모두 기록한 응답자 ' + data.reduce((total, row) => total + row.count, 0).toLocaleString() + '명';
        axis.replaceChildren(...[-limit, -limit / 2, 0, limit / 2, limit].map(value => {
            const tick = document.createElement('span');
            tick.style.left = (50 + value / limit * 40) + '%';
            tick.textContent = format(Math.abs(value), value < 0 ? '−' : '+') + '분';
            return tick;
        }));
        rows.replaceChildren(...data.map(row => renderRow(row, limit)));
        dialog.showModal();
        dialog.scrollTop = 0;
    }

    return {open};
})();
