const canvas = document.getElementById('map'),
    ctx = canvas.getContext('2d');
// Canvas and filter swatches share the same day-type palette.
const palette = getComputedStyle(document.documentElement);
const colors = {
        1: palette.getPropertyValue('--weekday').trim() || '#C93DEB',
        2: palette.getPropertyValue('--saturday').trim() || '#34CFE6',
        3: palette.getPropertyValue('--sunday').trim() || '#E8E72C'
    },
    names = {
        1: '평일',
        2: '토요일',
        3: '일요일'
    };
let W = 0,
    H = 0,
    dpr = 1,
    scale = 1,
    ox = 0,
    oy = 0,
    drag = false,
    last = null,
    filter = {
        1: true,
        2: true,
        3: true
    },
    pts = [],
    view = {
        x: 90,
        y: 110,
        w: 900,
        h: 470
    };
// Display-only rectangular occupancy layout; source values, thresholds and statistics remain separate.
const densityStyle = {
    pitch: 7,
    minDiameter: 1.1,
    maxDiameter: 6.1,
    opacity: 1,
    colorMultipliers: [0, 1, 1.4, 1.8],
    baseScale: .56
};
let densityCache = null;

function markerDiameter(count, colorCount) {
    // Retain the original count scale while keeping low-count multicolor dots modest.
    const countContrast = .5 + .5 * Math.sqrt(count / HybridAtlas.config.maxBatch);
    const base = HybridAtlas.diameter(count) * countContrast * densityStyle.baseScale;
    // Smoothly bound baseline diameter to 90% of pitch while retaining color ratios.
    const limit = densityStyle.pitch * .90 / 1.8;
    const bounded = base / Math.pow(1 + Math.pow(base / limit, 8), 1 / 8);
    return bounded * densityStyle.colorMultipliers[colorCount];
}

function densityCells() {
    const signature = [view.x, view.y, view.w, view.h, filter[1], filter[2], filter[3]].join(',');
    if (densityCache && densityCache.signature === signature) return densityCache.cells;
    const cells = HybridAtlas.build(filter).markers.map(source => {
        const point = atlasToWorld(source),
            cell = {
                ...source,
                x: point.x,
                y: point.y
            };
        cell.categories = [1, 2, 3].filter(day => cell.counts[day] > 0).sort((a, b) => cell.counts[b] - cell.counts[a] || a - b);
        cell.day = cell.categories[0];
        cell.diameter = markerDiameter(cell.n, cell.categories.length) * atlasScale;
        cell.rings = nestedRings(cell);
        return cell;
    });
    densityCache = {
        signature,
        cells
    };
    return cells;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

function nestedRings(cell) {
    let ratio = 1,
        remaining = cell.n;
    return cell.categories.map((day, index) => {
        if (index) {
            const next = remaining - cell.counts[cell.categories[index - 1]];
            // Relative counts drive radius through area (square root). Bound the ratio
            // to keep every band visible and the outer category dominant in visible area.
            ratio *= clamp(Math.sqrt(next / remaining), .20, index === 1 ? .70 : .68);
            remaining = next;
        }
        return {
            day,
            ratio
        };
    });
}
// The display is conceptual, not a quantitative screen-axis mapping.
let mapRect = null;
let minZoom = 1,
    fitOverview = {
        x: 0,
        y: 0
    },
    fitArea = null;
let atlasScale = 1,
    atlasOffset = {
        x: 0,
        y: 0
    };

function atlasToWorld(point) {
    return {
        x: atlasOffset.x + point.x * atlasScale,
        y: atlasOffset.y + point.y * atlasScale
    };
}

function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    mapRect = AtlasTransition.measureAtlasRect();
    if (!AtlasTransition.active) AtlasTransition.syncSurface();
    const b = HybridAtlas.bounds,
        width = b.xMax - b.xMin,
        height = b.yMax - b.yMin;
    const area = {
        x: mapRect.left + 16,
        y: mapRect.top + 30,
        w: Math.max(1, mapRect.width - 32),
        h: Math.max(1, mapRect.height - 46)
    };
    atlasScale = Math.min(area.w / width, area.h / height);
    atlasOffset = {
        x: area.x + (area.w - width * atlasScale) / 2 - b.xMin * atlasScale,
        y: area.y + (area.h - height * atlasScale) / 2 - b.yMin * atlasScale
    };
    view = {
        x: atlasOffset.x,
        y: atlasOffset.y,
        w: width * atlasScale,
        h: height * atlasScale
    };
    fitMapOverview();
    RegionMap.leave();
    AtlasTransition.resized();
    render();
}

function fitMapOverview() {
    const candidates = [{
        x: mapRect.left + 16,
        y: mapRect.top + 30,
        w: Math.max(1, mapRect.width - 32),
        h: Math.max(1, mapRect.height - 46)
    }];
    const bounds = {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity
    };
    for (const marker of HybridAtlas.overviewMarkers) {
        const point = atlasToWorld(marker);
        const count = [1, 2, 3].filter(d => marker.allCounts[d] > 0).length;
        // Preserve the exact approved overview and zoom limits from the pre-merge layout.
        const originalDiameter = HybridAtlas.diameter(marker.n) * (.5 + .5 * Math.sqrt(marker.n / HybridAtlas.config.maxBatch)) * .46 * densityStyle.colorMultipliers[count];
        const radius = originalDiameter * atlasScale * 1.3 / 2;
        bounds.left = Math.min(bounds.left, point.x - radius);
        bounds.right = Math.max(bounds.right, point.x + radius);
        bounds.top = Math.min(bounds.top, point.y - radius);
        bounds.bottom = Math.max(bounds.bottom, point.y + radius);
    }
    const score = area => Math.min(area.w / (bounds.right - bounds.left), area.h / (bounds.bottom - bounds.top));
    fitArea = candidates.reduce((best, area) => score(area) > score(best) ? area : best);
    minZoom = Math.min(6, fitArea.w / (bounds.right - bounds.left), fitArea.h / (bounds.bottom - bounds.top));
    fitOverview = {
        x: fitArea.x + fitArea.w / 2 - (W / 2 + ((bounds.left + bounds.right) / 2 - W / 2) * minZoom),
        y: fitArea.y + fitArea.h / 2 - (H / 2 + ((bounds.top + bounds.bottom) / 2 - H / 2) * minZoom)
    };
    scale = minZoom;
    ox = fitOverview.x;
    oy = fitOverview.y;
}

function transform(p) {
    return {
        x: W / 2 + (p.x - W / 2) * scale + ox,
        y: H / 2 + (p.y - H / 2) * scale + oy
    }
}

// One shared RAF loop (RegionMap) advances only active/settling radius states.
const DotRipple = (() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const states = new Map();
    let pointer = null,
        pulses = [],
        lastTime = 0;
    const radius = 75;
    const maxScale = 2.2;

    function move(x, y, id) {
        const now = performance.now();
        pointer = {
            x,
            y,
            id
        };
        if (!motion.matches && (!pulses.length || now - pulses[pulses.length - 1].time > 65)) {
            pulses.push({
                x,
                y,
                id,
                time: now
            });
            if (pulses.length > 8) pulses.shift();
        }
    }

    function leave() {
        pointer = null;
        pulses = [];
    }

    function step(now) {
        const dt = Math.min(.04, Math.max(.001, lastTime ? (now - lastTime) / 1000 : .016));
        lastTime = now;
        pulses = pulses.filter(p => now - p.time < 850);
        let changed = false,
            unfinished = false;
        for (const point of pts) {
            let target = 1;
            if (pointer && point.cell.regionId === pointer.id) {
                const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
                if (distance < radius) {
                    // Restore the restrained ripple profile and smooth edge.
                    const falloff = Math.pow(1 - (distance / radius) ** 2, 2);
                    let wave = 0;
                    if (!motion.matches)
                        for (const pulse of pulses) {
                            if (pulse.id !== pointer.id) continue;
                            const d = Math.hypot(point.x - pulse.x, point.y - pulse.y);
                            const age = (now - pulse.time) / 1000;
                            wave = Math.max(wave, Math.exp(-(((age - d / 480 - .06) / .12) ** 2)) * Math.exp(-age * 1.4));
                        }
                    target += falloff * (motion.matches ? .08 : (maxScale - 1) * (1 - .18 * (1 - wave) * distance / radius));
                }
            }
            let state = states.get(point.cell.key);
            if (!state && target === 1) continue;
            if (!state) {
                state = {
                    value: 1,
                    velocity: 0
                };
                states.set(point.cell.key, state);
            }
            const previous = state.value;
            if (motion.matches) {
                state.value = target;
                state.velocity = 0;
            } else {
                // Exact critically damped spring step, independent of refresh rate.
                const displacement = state.value - target,
                    omega = 22;
                const term = state.velocity + omega * displacement,
                    decay = Math.exp(-omega * dt);
                state.value = target + (displacement + term * dt) * decay;
                state.velocity = (state.velocity - omega * term * dt) * decay;
            }
            if (Math.abs(state.value - target) < .0005 && Math.abs(state.velocity) < .005) {
                state.value = target;
                state.velocity = 0;
                if (target === 1) states.delete(point.cell.key);
            } else unfinished = true;
            if (state.value !== previous) changed = true;
        }
        unfinished ||= pulses.length > 0;
        if (!unfinished) lastTime = 0;
        return {
            changed,
            unfinished
        };
    }
    motion.addEventListener('change', () => {
        leave();
        RegionMap.leave();
    });
    return {
        move,
        leave,
        step,
        reset() {
            states.clear();
            pointer = null;
            pulses = [];
            lastTime = 0;
        },
        factor: key => states.get(key)?.value ?? 1
    };
})();

// One solid concentric marker per cell. Bounded diameter leaves space between adjacent markers.
function render() {
    AtlasTransition.updateCamera();
    const transitioning = AtlasTransition.active;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = palette.getPropertyValue('--background').trim() || '#050408';
    ctx.globalAlpha = transitioning ? AtlasTransition.backgroundAlpha : 1;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    const networkBlend = transitioning ? clamp((AtlasTransition.progress - .78) / .22, 0, 1) : 0;
    if (AtlasTransition.stage === 'detail') { SleepNetwork.draw(ctx); return; }
    pts.length = 0;
    let count = 0;
    const liquidNodes = [];
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = densityStyle.opacity;
    for (const cell of (AtlasTransition.cells || densityCells())) {
        const factor = transitioning ? AtlasTransition.factor(cell.key) : DotRipple.factor(cell.key);
        const base = transform(cell),
            baseRadius = cell.diameter * scale / 2 * factor;
        const p = transitioning ? AtlasTransition.project(cell, base, baseRadius) : {
            ...base,
            radius: baseRadius
        };
        const radius = p.radius;
        const node = {
            x: p.x,
            y: p.y,
            radius,
            factor,
            cell
        };
        pts.push(node);
        count += cell.n;
        if (p.x + radius < 0 || p.x - radius > W || p.y + radius < 0 || p.y - radius > H) continue;
        if (factor > 1.001 && !transitioning) {
            liquidNodes.push(node);
            continue;
        }
        ctx.globalAlpha = densityStyle.opacity * (transitioning ? AtlasTransition.alpha(cell) * (1 - networkBlend) : RegionMap.alpha(cell));
        if (ctx.globalAlpha < .001) continue;
        for (const ring of cell.rings) {
            ctx.fillStyle = colors[ring.day];
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius * ring.ratio, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    LiquidDots.draw(ctx, liquidNodes, colors, cell => densityStyle.opacity * RegionMap.alpha(cell));
    ctx.restore();
    if (networkBlend > 0) SleepNetwork.draw(ctx, networkBlend);
    document.getElementById('visible').textContent = count.toLocaleString() + ' visible records';
}

// Only region-level hover/selection. Individual records never generate popups.
canvas.addEventListener('pointerdown', e => {
    if (AtlasTransition.stage === 'detail') {SleepNetwork.down(e); return;}
    if (AtlasTransition.active) return;
    drag = true;
    last = {
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        maxDistance: 0
    };
    RegionMap.leave();
    canvas.style.cursor = 'default';
    canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
    if (AtlasTransition.stage === 'detail') {SleepNetwork.move(e); return;}
    if (AtlasTransition.active) return;
    if (!drag || !last) {
        RegionMap.pointerMove(e.clientX, e.clientY);
        canvas.style.cursor = 'default';
        return;
    }
    ox += e.clientX - last.x;
    oy += e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
    last.maxDistance = Math.max(last.maxDistance, Math.hypot(e.clientX - last.sx, e.clientY - last.sy));
    render();
});
canvas.addEventListener('pointerup', e => {
    if (AtlasTransition.stage === 'detail') {SleepNetwork.up(e); return;}
    if (!drag || !last) return;
    const moved = Math.max(last.maxDistance, Math.hypot(e.clientX - last.sx, e.clientY - last.sy));
    drag = false;
    last = null;
    canvas.style.cursor = 'default';
    if (moved < 5) {
        RegionMap.selectAt(e.clientX, e.clientY);
        AtlasTransition.enter(RegionMap.selectedId);
        render();
    }
});
canvas.addEventListener('pointercancel', () => {
    if (AtlasTransition.stage === 'detail') {SleepNetwork.leave(); return;}
    drag = false;
    last = null;
    canvas.style.cursor = 'default';
    RegionMap.leave();
});
canvas.addEventListener('pointerleave', () => {
    if (AtlasTransition.stage === 'detail') {SleepNetwork.leave(); return;}
    if (!drag) RegionMap.leave();
});

function zoom(mult, cx = mapRect.left + mapRect.width / 2, cy = mapRect.top + mapRect.height / 2) {
    if (AtlasTransition.active) return;
    RegionMap.leave();
    const s = clamp(scale * mult, minZoom, 6),
        ratio = s / scale;
    ox = cx - W / 2 + (ox + W / 2 - cx) * ratio;
    oy = cy - H / 2 + (oy + H / 2 - cy) * ratio;
    scale = s;
    if (scale === minZoom) {
        ox = fitOverview.x;
        oy = fitOverview.y;
    }
    render()
}
canvas.addEventListener('wheel', e => {
    e.preventDefault();
    if (AtlasTransition.stage === 'detail') {SleepNetwork.wheel(e); return;}
    zoom(e.deltaY < 0 ? 1.13 : 1 / 1.13, e.clientX, e.clientY)
}, {
    passive: false
});
document.getElementById('plus').onclick = () => zoom(1.25);
document.getElementById('minus').onclick = () => zoom(.8);
document.getElementById('reset').onclick = () => {
    if (AtlasTransition.active) {
        AtlasTransition.back();
        return;
    }
    scale = minZoom;
    ox = fitOverview.x;
    oy = fitOverview.y;
    RegionMap.clear();
    render();
};
document.querySelectorAll('[data-day]').forEach(el => el.onchange = () => {
    if (AtlasTransition.active) {
        el.checked = filter[el.dataset.day];
        return;
    }
    filter[el.dataset.day] = el.checked;
    RegionMap.filtersChanged();
    render();
});
document.getElementById('cluster-clear').addEventListener('click', () => {
    if (AtlasTransition.active) return;
    RegionMap.clear();
    render();
});
addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        if (AtlasTransition.active) {
            AtlasTransition.back();
            return;
        }
        RegionMap.clear();
        render();
    }
});
// Scrolling moves the canvas container, without altering its local map or zoom.
addEventListener('scroll', () => {
    if (AtlasTransition.active) return;
    const next = document.querySelector('.visual-area').getBoundingClientRect();
    const dx = next.left - mapRect.left,
        dy = next.top - mapRect.top;
    if (!dx && !dy) return;
    mapRect = next;
    atlasOffset.x += dx;
    atlasOffset.y += dy;
    view.x += dx;
    view.y += dy;
    ox += (1 - scale) * dx;
    oy += (1 - scale) * dy;
    fitOverview.x += (1 - minZoom) * dx;
    fitOverview.y += (1 - minZoom) * dy;
    fitArea.x += dx;
    fitArea.y += dy;
    ctx.setTransform(dpr, 0, 0, dpr, -mapRect.left * dpr, -mapRect.top * dpr);
    RegionMap.leave();
    render();
}, {
    passive: true
});
addEventListener('resize', resize);
// Selection labels and responsive UI can resize the Canvas without a window resize.
const mapObserver = new ResizeObserver(() => {
    if (document.getElementById('atlas-screen').hidden) return;
    const rect = document.querySelector('.visual-area').getBoundingClientRect();
    if (mapRect && (Math.abs(rect.width - mapRect.width) > .5 || Math.abs(rect.height - mapRect.height) > .5)) resize();
});
mapObserver.observe(document.querySelector('.visual-area'));
const dayTotals = {
    1: 0,
    2: 0,
    3: 0
};
SleepRegions.validIndices.forEach(i => dayTotals[DATA[i][2]]++);
[1, 2, 3].forEach(day => document.getElementById('d' + day).textContent = dayTotals[day].toLocaleString());
['record-total', 'diary-total'].forEach(id => document.getElementById(id).textContent = SleepRegions.validIndices.length.toLocaleString());
document.fonts.ready.then(resize);
canvas.style.cursor = 'default';
resize();

// The landing experience is the full globe, not the historical point atlas.
requestAnimationFrame(()=>setTimeout(()=>AtlasTransition.openGlobe(),0));
