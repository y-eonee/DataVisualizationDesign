const SleepAgeTerrainData = (() => {
    const step = 10;
    const limit = 240;
    const binCount = 2 * limit / step + 2;
    const timeStep = 10;
    const morningEnd = 9 * 60;
    const timeCount = morningEnd / timeStep + 2;
    const wrap = minutes => ((minutes + 720) % 1440 + 1440) % 1440 - 720;
    function cellAt(localTime, shift) {
        const x = Math.max(0, Math.min(timeCount - 1, 1 + Math.floor((wrap(localTime) + 1e-8) / timeStep)));
        const y = Math.max(0, Math.min(binCount - 1, 1 + Math.floor((shift + limit + 1e-8) / step)));
        return {x, y};
    }

    function midpoint(indices, records) {
        const angles = indices.map(i => {
            const [onset, duration] = records[i];
            return (onset + duration / 2) * Math.PI / 12;
        });
        const x = angles.reduce((sum, angle) => sum + Math.cos(angle), 0);
        const y = angles.reduce((sum, angle) => sum + Math.sin(angle), 0);
        return Math.atan2(y, x) * 720 / Math.PI;
    }

    function* pairedShifts(group, records) {
        for (const person of group.persons) {
            if (!person.weekday.length || !person.weekend.length) continue;
            const weekday = midpoint(person.weekday, records);
            yield {person, weekday, shift: wrap(midpoint(person.weekend, records) - weekday)};
        }
    }

    function build(group, records) {
        const cells = Array.from({length: timeCount}, () => Array(binCount).fill(0));
        let count = 0;
        let totalShift = 0;
        let peak = 0;
        for (const {weekday, shift} of pairedShifts(group, records)) {
            // DATA's clock starts at 18:00. Group local time around midnight.
            const {x, y} = cellAt(weekday + 18 * 60, shift);
            const column = cells[x];
            column[y]++;
            peak = Math.max(peak, column[y]);
            totalShift += Math.abs(shift);
            count++;
        }
        return {cells, count, peak, mean: count ? totalShift / count : null};
    }

    const signed = minutes => (minutes < 0 ? '−' : minutes > 0 ? '+' : '') + Math.abs(minutes);
    function range(bin) {
        if (bin === 0) return '−240분 미만';
        if (bin === binCount - 1) return '+240분 이상';
        const lower = (bin - 1) * step - limit;
        return signed(lower) + '분 이상 ~ ' + signed(lower + step) + '분 미만';
    }
    const clock = minutes => String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    function timeRange(bin) {
        if (bin === 0) return '전날 12:00~자정 전';
        if (bin === timeCount - 1) return '09:00~정오 전';
        const start = (bin - 1) * timeStep;
        return clock(start) + '–' + clock(start + timeStep);
    }
    return {build, pairedShifts, cellAt, range, timeRange, binCount, timeStep};
})();

(() => {
    const dialog = document.getElementById('age-terrain');
    if (!dialog) return;
    const plot = document.getElementById('terrain-plot');
    const chart = document.getElementById('terrain-canvas');
    const ctx = chart.getContext('2d');
    const tooltip = document.getElementById('terrain-hover');
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const closeButton = document.getElementById('terrain-back');
    const occupationButton = document.getElementById('terrain-occupations');
    const viewButtons = [...dialog.querySelectorAll('[data-terrain-view]')];
    const viewNote = document.getElementById('terrain-view-note');
    const viewNotes = {
        overview: '',
        left: '평일 수면 중간 시각\n어느 시간대에 모일까?',
        right: '주말 수면 중간 시각\n− 앞당김 / + 늦어짐',
        top: '평일 수면 시각 × 주말 시차\n밝을수록 응답자가 많아요.'
    };
    const colors = [[143,151,237],[102,188,239],[186,225,218],[246,217,140],[243,157,164]];
    let terrain = null;
    let ageGroup = null;
    let personalCell = null;
    let faces = [];
    let closing = false;
    const views = {
        overview: [Math.PI / 4, .55],
        left: [0, 0],
        right: [Math.PI / 2, 0],
        top: [0, Math.PI / 2]
    };
    let [yaw, elevation] = views.overview;
    let activeView = 'overview';
    let lastSide = 'overview';
    let drag = null;
    let frame = 0;
    let bars = [];
    let turn = null;

    occupationButton.addEventListener('click', openOccupations);
    function openOccupations() {
        if (terrain?.count) SleepOccupationShifts.open(ageGroup);
    }

    for (const button of viewButtons) {
        button.addEventListener('click', () => {
            setView(button.dataset.terrainView);
        });
    }

    function setView(view) {
        activeView = view;
        const [targetYaw, targetElevation] = views[view];
        const yawDistance = Math.atan2(Math.sin(targetYaw - yaw), Math.cos(targetYaw - yaw));
        if (motion.matches || (Math.abs(yawDistance) < .001 && Math.abs(targetElevation - elevation) < .001)) {
            [yaw, elevation] = views[view];
            turn = null;
        } else {
            turn = {yaw, elevation, yawDistance, targetYaw, targetElevation, started: performance.now()};
        }
        if (view === 'left' || view === 'right') lastSide = view;
        for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset.terrainView === view));
        viewNote.textContent = viewNotes[view];
        scheduleDraw();
    }

    function stepView(view) {
        if (view === activeView) return;
        setView(activeView === 'overview' ? view : 'overview');
    }

    function scheduleDraw() {
        if (frame) return;
        frame = requestAnimationFrame(now => {
            frame = 0;
            if (turn) {
                const progress = Math.max(0, Math.min(1, (now - turn.started) / 540));
                const eased = progress * progress * (3 - 2 * progress);
                yaw = turn.yaw + turn.yawDistance * eased;
                elevation = turn.elevation + (turn.targetElevation - turn.elevation) * eased;
                if (progress === 1 || motion.matches) finishTurn();
            }
            draw();
            if (turn) scheduleDraw();
        });
    }

    function finishTurn() {
        if (!turn) return;
        yaw = turn.targetYaw;
        elevation = turn.targetElevation;
        turn = null;
    }

    function tint(bin, shade) {
        const position = bin / (SleepAgeTerrainData.binCount - 1) * (colors.length - 1);
        const low = Math.floor(position);
        const high = Math.min(colors.length - 1, low + 1);
        const values = colors[low].map((value, i) => Math.round((value + (colors[high][i] - value) * (position - low)) * shade));
        return 'rgb(' + values.join(',') + ')';
    }

    const groundColors = Array.from({length: SleepAgeTerrainData.binCount}, (_, bin) => tint(bin,.2));

    function draw() {
        if (!dialog.open || !terrain?.count) return;
        const width = chart.clientWidth;
        const height = chart.clientHeight;
        if (!width || !height) return;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
        if (chart.width !== pixelWidth || chart.height !== pixelHeight) {
            chart.width = pixelWidth;
            chart.height = pixelHeight;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0,0,width,height);
        faces = [];
        tooltip.hidden = true;

        const nx = terrain.cells.length;
        const ny = SleepAgeTerrainData.binCount;
        const overhead = elevation >= Math.PI / 2 - .015;
        const sideOn = elevation === 0;
        const edge = width < 500 ? 30 : 46;
        const tilt = Math.sin(elevation), zScale = overhead ? 0 : Math.cos(elevation);
        const sine = Math.sin(yaw), cosine = Math.cos(yaw);
        const vertical = (nx + ny) * (width < 500 ? .8 : .55);
        const layerHeight = vertical / terrain.peak;
        const depthAt = (x,y) => x * sine - y * cosine;
        const project = (x,y,z = 0) => [x * cosine + y * sine, depthAt(x,y) * tilt - z * zScale];
        const corners = [[0,0],[nx,0],[nx,ny],[0,ny]];
        const floor = corners.map(([x,y]) => project(x,y));
        const minX = Math.min(...floor.map(p => p[0])), maxX = Math.max(...floor.map(p => p[0]));
        const minFloorY = Math.min(...floor.map(p => p[1])), maxY = Math.max(...floor.map(p => p[1]));
        const axis = corners[floor.findIndex(p => p[0] === minX)];
        let minY = Math.min(minFloorY, project(...axis, vertical)[1]);
        for (const bar of bars) minY = Math.min(minY, project(bar.x + .5,bar.y + .5,bar.count * layerHeight)[1] - .8);
        const unit = Math.min((width - edge * 2) / (maxX - minX), (height - 40) / (maxY - minY));
        if (!(unit > 0)) return;
        const markerWorld = personalCell && [personalCell.x + .5, personalCell.y + .5, terrain.cells[personalCell.x][personalCell.y] * layerHeight];
        const originX = (width - (minX + maxX) * unit) / 2;
        const originY = (height - (minY + maxY) * unit) / 2;
        const point = (x,y,z = 0) => {
            const [px,py] = project(x,y,z);
            return [originX + px * unit, originY + py * unit];
        };
        const polygon = (points, color) => {
            ctx.beginPath();
            points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };
        const line = (a, b, color) => {
            ctx.beginPath();
            ctx.moveTo(...a);
            ctx.lineTo(...b);
            ctx.strokeStyle = color;
            ctx.stroke();
        };
        for (let x = 0; x < nx; x++) {
            for (let y = 0; y < ny; y++) {
                polygon([point(x+.06,y+.06), point(x+.94,y+.06), point(x+.94,y+.94), point(x+.06,y+.94)], groundColors[y]);
            }
        }
        if (sideOn) line(point(...axis), [originX + maxX * unit, originY], '#777985');
        else line(point(0,ny / 2), point(nx,ny / 2), '#777985');

        bars.sort((a,b) => depthAt(a.x,a.y) - depthAt(b.x,b.y));
        const nearX = sine >= 0;
        const nearY = cosine < 0;
        for (const bar of bars) {
            const {x,y,count} = bar;
            const x0 = x + .06, x1 = x + .94, y0 = y + .06, y1 = y + .94;
            const front = tint(y, .62), side = tint(y, .79), top = tint(y, 1);
            const height = count * layerHeight;
            const a = point(x0,y0,height), b = point(x1,y0,height);
            const c = point(x1,y1,height), d = point(x0,y1,height);
            const topFace = [a,b,c,d];
            if (overhead) {
                polygon(topFace, tint(y, .38 + .62 * Math.sqrt(count / terrain.peak)));
                faces.push({points:topFace, bar});
                continue;
            }
            const frontY = nearY ? y1 : y0, sideX = nearX ? x1 : x0;
            const frontFace = [nearY ? d : a, nearY ? c : b, point(x1,frontY),point(x0,frontY)];
            const sideFace = [nearX ? b : a, nearX ? c : d, point(sideX,y1),point(sideX,y0)];
            polygon(frontFace, front);
            polygon(sideFace, side);
            polygon(topFace, top);
            ctx.lineWidth = .7;
            for (let level = 1; level < count; level++) {
                const z = level * layerHeight;
                const corner = point(sideX,frontY,z);
                line(point(nearX ? x0 : x1,frontY,z), corner, tint(y,.35));
                line(corner, point(sideX,nearY ? y0 : y1,z), tint(y,.44));
            }
            ctx.lineWidth = 1;
            for (const points of [frontFace, sideFace, topFace]) {
                faces.push({points, bar});
            }
        }

        if (markerWorld) {
            const [x, y] = point(...markerWorld);
            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#a7f2d9';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.font = '650 12px sans-serif';
            ctx.textAlign = x < width - 62 ? 'left' : 'right';
            ctx.textBaseline = 'middle';
            const labelX = x < width - 62 ? x + 11 : x - 11;
            ctx.lineWidth = 3;
            ctx.strokeText('내 위치', labelX, y);
            ctx.fillText('내 위치', labelX, y);
            ctx.lineWidth = 1;
        }
        ctx.font = (width < 500 ? '10' : '12') + 'px sans-serif';
        ctx.fillStyle = '#efeff3';
        ctx.textBaseline = 'middle';
        const xAxisY = nearY ? ny : 0;
        const yAxisX = overhead && Math.abs(sine) < .01 ? nx : nearX ? nx : 0;
        const xOffset = (nearY ? 1 : -1) * sine;
        const yOffset = (yAxisX ? 1 : -1) * cosine;
        function label(text, [x,y], outward, down) {
            ctx.textAlign = Math.abs(outward) < .22 ? 'center' : outward < 0 ? 'right' : 'left';
            ctx.fillText(text, x + outward * 7, y + down);
        }
        for (const hour of (width < 500 ? [0, 3, 6, 9] : [0, 2, 4, 6, 8, 9])) {
            if (sideOn && Math.abs(cosine) < .01) break;
            label(String(hour).padStart(2,'0') + ':00', point(1 + hour * 60 / SleepAgeTerrainData.timeStep,xAxisY), xOffset, 10);
        }
        for (const [bin,label] of [[1,'−4h'],[ny/4+.5,'−2h'],[ny/2,'0'],[ny*.75-.5,'+2h'],[ny-1,'+4h']]) {
            if (sideOn && Math.abs(sine) < .01) break;
            const [x,y] = point(yAxisX,bin);
            ctx.textAlign = yOffset < 0 ? 'right' : 'left';
            ctx.fillText(label, x + yOffset * 7, y + (overhead ? 0 : 9));
        }
        if (overhead) return;
        line(point(...axis), point(...axis,vertical), '#a8a8b5');
        ctx.textAlign = 'right';
        for (const count of [...new Set([0, Math.round(terrain.peak / 2), terrain.peak])]) {
            const z = count / terrain.peak * vertical;
            const [x,y] = point(...axis,z);
            line([x - 4,y], [x,y], '#a8a8b5');
            ctx.fillText(count + '명', x - 6, y);
        }
    }

    function contains(points, x, y) {
        let inside = false;
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [ax,ay] = points[i], [bx,by] = points[j];
            if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
        }
        return inside;
    }

    function hitAt(event) {
        const bounds = chart.getBoundingClientRect();
        return faces.findLast(face => contains(face.points, event.clientX - bounds.left, event.clientY - bounds.top));
    }

    chart.addEventListener('pointerdown', event => {
        if (!terrain?.count || drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
        drag = {id:event.pointerId, x:event.clientX, y:event.clientY};
        tooltip.hidden = true;
        chart.setPointerCapture(event.pointerId);
        chart.classList.add('is-dragging');
    });
    function endDrag(event) {
        if (drag?.id !== event.pointerId) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag = null;
        chart.classList.remove('is-dragging');
        if (event.type !== 'pointerup') return;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        if (distance < 8 && hitAt(event)) openOccupations();
        if (distance < 24) return;
        if (Math.abs(dx) >= Math.abs(dy)) stepView(dx < 0 ? 'left' : 'right');
        else stepView(dy < 0 ? 'top' : lastSide);
    }
    for (const event of ['pointerup','pointercancel','lostpointercapture']) chart.addEventListener(event, endDrag);
    chart.addEventListener('keydown', event => {
        const keys = {ArrowLeft:'left', ArrowRight:'right', ArrowUp:'top', ArrowDown:lastSide};
        const view = keys[event.key];
        if (!view) return;
        event.preventDefault();
        stepView(view);
    });
    chart.addEventListener('pointermove', event => {
        if (drag) return;
        const bounds = chart.getBoundingClientRect();
        const x = event.clientX - bounds.left, y = event.clientY - bounds.top;
        const hit = hitAt(event);
        tooltip.hidden = !hit;
        if (!hit) return;
        const {x: timeBin, y: bin, count} = hit.bar;
        tooltip.textContent = SleepAgeTerrainData.timeRange(timeBin) + ' · ' + SleepAgeTerrainData.range(bin) + ' · ' + count.toLocaleString() + '명';
        tooltip.style.left = Math.max(4, Math.min(x + 12, bounds.width - tooltip.offsetWidth - 4)) + 'px';
        tooltip.style.top = Math.max(4, y - 37) + 'px';
    });
    chart.addEventListener('pointerleave', () => { tooltip.hidden = true; });
    new ResizeObserver(draw).observe(plot);

    window.addEventListener('sleepageopen', event => {
        if (dialog.open) return;
        const {group, personal} = event.detail;
        ageGroup = group;
        terrain = SleepAgeTerrainData.build(group, DATA);
        personalCell = personal ? SleepAgeTerrainData.cellAt(personal.weekday, personal.shift) : null;
        document.getElementById('terrain-personal-position').textContent = personalCell
            ? '내 위치 · 평일 수면 중간 시각 ' + SleepAgeTerrainData.timeRange(personalCell.x) + ' · 시차 ' + SleepAgeTerrainData.range(personalCell.y)
            : '';
        chart.setAttribute('aria-describedby', personal ? 'terrain-orbit-hint terrain-personal-position' : 'terrain-orbit-hint');
        bars = terrain.cells.flatMap((column,x) => column.flatMap((count,y) => count ? [{x,y,count}] : []));
        document.getElementById('age-terrain-title').textContent = group.id === 5 ? '60대 이상' : group.min + '대';
        document.getElementById('terrain-count').textContent = terrain.count.toLocaleString() + '명';
        document.getElementById('terrain-mean').textContent = terrain.mean === null ? '—' : Math.round(terrain.mean) + '분';
        document.getElementById('terrain-empty').hidden = terrain.count > 0;
        chart.hidden = !terrain.count;
        occupationButton.hidden = !terrain.count;
        const totals = Array.from({length: SleepAgeTerrainData.binCount}, (_, bin) => terrain.cells.reduce((sum, column) => sum + column[bin], 0));
        document.getElementById('terrain-bin-summary').textContent = totals.flatMap((count, bin) => count ? [SleepAgeTerrainData.range(bin) + ' ' + count.toLocaleString() + '명'] : []).join(' · ');
        SleepNetwork.stop();
        dialog.showModal();
        dialog.scrollTop = 0;
        [yaw, elevation] = views.overview;
        lastSide = 'overview';
        setView('overview');
        draw();
    });

    function close() {
        if (closing || !dialog.open) return;
        if (motion.matches) { dialog.close(); return; }
        closing = true;
        dialog.classList.add('is-closing');
        dialog.addEventListener('animationend', () => dialog.close(), {once:true});
    }
    closeButton.addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', () => {
        closing = false;
        cancelAnimationFrame(frame);
        frame = 0;
        finishTurn();
        drag = null;
        chart.classList.remove('is-dragging');
        dialog.classList.remove('is-closing');
        window.dispatchEvent(new CustomEvent('sleepdetailready'));
    });
})();
