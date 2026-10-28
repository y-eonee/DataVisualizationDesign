// Transition-ready detail preview: the SAME aggregated markers, no new particle dataset.
window.AtlasTransition = (() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const panel = document.getElementById('detail-screen');
    const atlasScreen = document.getElementById('atlas-screen');
    const atlasVisual = document.querySelector('.visual-area');
    const detailVisual = document.getElementById('detail-visual');
    const layer = document.getElementById('transition-layer');
    const backButton = document.getElementById('back-to-atlas');
    const duration = 1700;
    let state = null,
        frame = 0;
    const mix = (a, b, t) => a + (b - a) * t;
    const limit = t => Math.max(0, Math.min(1, t));
    const ease = t => {
        t = limit(t);
        return t * t * t * (t * (t * 6 - 15) + 10);
    };
    const camera = () => ({
        scale,
        ox,
        oy
    });
    const stamp = () => [W, H, atlasScale, atlasOffset.x, atlasOffset.y, mapRect.left, mapRect.top, mapRect.width, mapRect.height].join(':');

    function measureAtlasRect() {
        if(state?.direct)return detailVisual.getBoundingClientRect();
        const hidden = atlasScreen.hidden,
            visibility = atlasScreen.style.visibility;
        if (hidden) {
            atlasScreen.style.visibility = 'hidden';
            atlasScreen.hidden = false;
        }
        const rect = atlasVisual.getBoundingClientRect();
        if (hidden) {
            atlasScreen.hidden = true;
            atlasScreen.style.visibility = visibility;
        }
        return rect;
    }

    function syncSurface() {
        const rect = state ? (state.stage === 'detail' ? detailVisual.getBoundingClientRect() : {
            left: 0,
            top: 0,
            width: W,
            height: H
        }) : mapRect;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, -rect.left * dpr, -rect.top * dpr);
    }

    function travelSurface() {
        layer.hidden = false;
        layer.appendChild(canvas);
        syncSurface();
        render();
    }

    function prepare() {
        const cells = densityCells();
        const selected = cells.filter(cell => cell.regionId === state.id).sort((a, b) => a.key - b.key);
        if (!selected.length) return false;
        state.selected = selected;
        const bounds = {
            left: Infinity,
            right: -Infinity,
            top: Infinity,
            bottom: -Infinity
        };
        for (const cell of selected) {
            bounds.left = Math.min(bounds.left, cell.x);
            bounds.right = Math.max(bounds.right, cell.x);
            bounds.top = Math.min(bounds.top, cell.y);
            bounds.bottom = Math.max(bounds.bottom, cell.y);
        }
        const center = {
            x: (bounds.left + bounds.right) / 2,
            y: (bounds.top + bounds.bottom) / 2
        };
        const destination = detailVisual.getBoundingClientRect();
        state.center = {
            x: destination.left + destination.width / 2,
            y: destination.top + destination.height / 2
        };
        state.radius = Math.max(12, Math.min(destination.width, destination.height) * .46);
        const fit = Math.min(mapRect.width * .78 / Math.max(1, bounds.right - bounds.left), mapRect.height * .78 / Math.max(1, bounds.bottom - bounds.top));
        const targetScale = Math.min(6, Math.max(state.saved.scale, fit));
        state.target = {
            scale: targetScale,
            ox: state.center.x - W / 2 - (center.x - W / 2) * targetScale,
            oy: state.center.y - H / 2 - (center.y - H / 2) * targetScale
        };
        state.targets = new Map();
        selected.forEach((cell, i) => {
            const z = 1 - 2 * (i + .5) / selected.length,
                angle = i * Math.PI * (3 - Math.sqrt(5));
            const ring = Math.sqrt(1 - z * z),
                perspective = 1 / (1 - .14 * z);
            state.targets.set(cell.key, SleepNetwork.transitionTarget(cell.indices) || {
                x: Math.cos(angle) * ring * perspective,
                y: Math.sin(angle) * ring * perspective,
                z
            });
        });
        state.ordered = [...cells.filter(cell => cell.regionId !== state.id), ...selected.slice().sort((a, b) => state.targets.get(a.key).z - state.targets.get(b.key).z)];
        return true;
    }

    function populate() {
        const selection = window.sleepRegionSelection,
            stats = selection.statistics;
        document.getElementById('detail-number').textContent = 'REGION ' + selection.region.number + ' / AGE & SLEEP NETWORK';
        document.getElementById('detail-title').textContent = selection.region.name;
        document.getElementById('detail-count').textContent = stats.count.toLocaleString();
        document.getElementById('detail-percent').textContent = stats.percentOfValid.toFixed(2) + '% of all valid records';
        document.getElementById('detail-onset').textContent = SleepRegions.clock(stats.onsetMean) + (18 + stats.onsetMean >= 24 ? ' (+1d)' : '');
        const minutes = Math.round(stats.durationMean * 60);
        document.getElementById('detail-duration').textContent = Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
        document.getElementById('detail-days').textContent = [1, 2, 3].map(day => names[day] + ' ' + stats.categoryCounts[day].toLocaleString()).join(' / ');
    }

    function updateCamera() {
        if (!state || state.direct) return;
        const t = motion.matches ? 0 : ease(state.progress / .76);
        scale = mix(state.saved.scale, state.target.scale, t);
        ox = mix(state.saved.ox, state.target.ox, t);
        oy = mix(state.saved.oy, state.target.oy, t);
        state.morph = motion.matches ? state.progress : ease((state.progress - .38) / .62);
        const reveal = ease((state.progress - .70) / .30);
        atlasScreen.style.opacity = 1 - ease(state.progress / .50);
        panel.style.setProperty('--detail-reveal', reveal);
        panel.setAttribute('aria-hidden', String(reveal < .05));
        panel.style.pointerEvents = reveal > .5 ? 'auto' : 'none';
        if (panel.inert !== (reveal <= .5)) panel.inert = reveal <= .5;
        backButton.tabIndex = reveal > .5 ? 0 : -1;
    }

    function project(cell, point, radius) {
        if (!state || cell.regionId !== state.id) return {
            ...point,
            radius
        };
        const target = state.targets.get(cell.key);
        if (!target) return {
            ...point,
            radius
        };
        const t = motion.matches ? (state.progress < .5 ? 0 : 1) : state.morph;
        const r = Math.max(.7, Math.min(3.5, cell.diameter / atlasScale / 2)) * Math.max(.8, Math.min(1.6, state.radius / 200)) * (.86 + .14 * (target.z + 1) / 2);
        return {
            x: mix(point.x, state.center.x + target.x * state.radius, t),
            y: mix(point.y, state.center.y + target.y * state.radius, t),
            radius: mix(radius, r, t)
        };
    }

    function alpha(cell) {
        const initial = state.initialAlpha.get(cell.key) ?? 1;
        if (cell.regionId !== state.id) return mix(initial, 0, ease(state.progress / .62));
        const depth = state.targets.get(cell.key)?.z ?? 1;
        return mix(initial, 1, ease(state.progress / .3)) * mix(1, .5 + .5 * (depth + 1) / 2, state.morph) * (motion.matches ? Math.abs(2 * state.progress - 1) : 1);
    }

    function settleAtlas() {
        const previous = state;
        scale = previous.saved.scale;
        ox = previous.saved.ox;
        oy = previous.saved.oy;
        filter = {
            ...previous.filters
        };
        previous.disabled.forEach(([el, disabled]) => {
            el.disabled = disabled;
        });
        atlasScreen.hidden = false;
        atlasScreen.inert = false;
        atlasScreen.setAttribute('aria-hidden', 'false');
        atlasScreen.style.opacity = 1;
        document.body.classList.remove('atlas-detail-active');
        document.body.dataset.screen = 'atlas';
        panel.classList.remove('is-settled');
        panel.hidden = true;
        panel.inert = true;
        panel.setAttribute('aria-hidden', 'true');
        state = null;
        frame = 0;
        atlasVisual.prepend(canvas);
        canvas.setAttribute('aria-label', previous.canvasLabel);
        syncSurface();
        layer.hidden = true;
        RegionMap.leave();
        render();
        if (previous.focus?.isConnected) previous.focus.focus({
            preventScroll: true
        });
        window.dispatchEvent(new CustomEvent('sleepatlasreturn', {
            detail: window.sleepRegionSelection
        }));
    }

    function animate(now) {
        if (!state) return;
        if (state.started === null) state.started = now;
        const t = limit((now - state.started) / state.animationDuration);
        state.progress = mix(state.from, state.to, ease(t));
        render();
        if (t < 1) {
            frame = requestAnimationFrame(animate);
            return;
        }
        frame = 0;
        if (state.to === 0) {
            settleAtlas();
            return;
        }
        state.stage = 'detail';
        detailVisual.appendChild(canvas);
        syncSurface();
        panel.classList.add('is-settled');
        atlasScreen.hidden = true;
        layer.hidden = true;
        document.body.dataset.screen = 'detail';
        render();
        backButton.focus({
            preventScroll: true
        });
        window.dispatchEvent(new CustomEvent('sleepdetailready', {
            detail: {
                selection: window.sleepRegionSelection,
                markers: state.selected
            }
        }));
    }

    function factor(key) {
        if (!state) return 1;
        if (state.stage === 'exiting') return mix(state.exitFactors.get(key) ?? 1, 1, ease((state.from - state.progress) / (state.from || 1)));
        return mix(state.initialFactors.get(key) ?? 1, 1, ease(state.progress / .25));
    }

    function run(to) {
        if (to === 0) state.exitFactors = new Map(state.ordered.map(cell => [cell.key, factor(cell.key)]));
        if (frame) cancelAnimationFrame(frame);
        state.from = state.progress;
        state.to = to;
        state.started = null;
        state.animationDuration = motion.matches ? 180 : Math.max(240, duration * Math.abs(to - state.progress));
        state.stage = to ? 'entering' : 'exiting';
        document.body.dataset.screen = 'transition';
        if (to === 0) {
            atlasScreen.hidden = false;
            panel.classList.remove('is-settled');
            travelSurface();
        }
        frame = requestAnimationFrame(animate);
    }

    function enter(id) {
        if (state || !SleepRegions.regions.some(region => region.id === id)) return;
        if (RegionMap.selectedId !== id) RegionMap.select(id);
        if (!window.sleepRegionSelection?.visibleRecordIndices.length) return;
        const saved = camera();
        const center = {
            x: mapRect.left + mapRect.width / 2,
            y: mapRect.top + mapRect.height / 2
        };
        const anchor = {
            x: ((W / 2 + (center.x - W / 2 - ox) / scale) - atlasOffset.x) / atlasScale,
            y: ((H / 2 + (center.y - H / 2 - oy) / scale) - atlasOffset.y) / atlasScale
        };
        state = {
            id,
            saved,
            anchor,
            layout: stamp(),
            filters: {
                ...filter
            },
            progress: 0,
            morph: 0,
            stage: 'entering',
            focus: document.activeElement,
            canvasLabel: canvas.getAttribute('aria-label'),
            initialAlpha: new Map(densityCells().map(c => [c.key, RegionMap.alpha(c)])),
            initialFactors: new Map(pts.map(p => [p.cell.key, p.factor])),
            disabled: []
        };
        panel.hidden = false;
        panel.style.setProperty('--detail-reveal', 0);
        panel.style.pointerEvents = 'none';
        populate();
        SleepNetwork.prepare(window.sleepRegionSelection.visibleRecordIndices);
        if (!prepare()) {
            state = null;
            panel.hidden = true;
            return;
        }
        RegionMap.leave();
        RegionMap.suspend();
        DotRipple.reset();
        document.querySelectorAll('[data-day],.controls button,#cluster-clear').forEach(el => {
            state.disabled.push([el, el.disabled]);
            el.disabled = true;
        });
        atlasScreen.inert = true;
        atlasScreen.setAttribute('aria-hidden', 'true');
        document.body.classList.add('atlas-detail-active');
        canvas.setAttribute('aria-label', window.sleepRegionSelection.region.name + ' age-territory sleep landscape');
        travelSurface();
        run(1);
    }

    function openGlobe(){
        if(state)return;
        const indices=[...SleepRegions.validIndices],records=indices.map(i=>DATA[i]),categoryCounts={1:0,2:0,3:0};
        for(const row of records)categoryCounts[row[2]]++;
        window.sleepRegionSelection={id:'all',region:{id:'all',number:'ALL',name:'All Sleep Records'},recordIndices:indices,visibleRecordIndices:indices,records,visibleRecords:records,statistics:{count:indices.length,percentOfValid:100,onsetMean:records.reduce((s,r)=>s+r[0],0)/records.length,durationMean:records.reduce((s,r)=>s+r[1],0)/records.length,categoryCounts}};
        state={direct:true,id:'all',stage:'detail',progress:1,morph:1,targets:new Map()};
        panel.hidden=false;panel.inert=false;panel.setAttribute('aria-hidden','false');panel.style.pointerEvents='auto';panel.style.setProperty('--detail-reveal',1);panel.classList.add('is-settled');
        atlasScreen.hidden=true;atlasScreen.inert=true;atlasScreen.setAttribute('aria-hidden','true');
        document.body.dataset.screen='detail';document.body.classList.add('atlas-detail-active');
        detailVisual.appendChild(canvas);canvas.setAttribute('aria-label','Full sleep globe. Drag to rotate, scroll to zoom.');
        RegionMap.suspend();populate();document.getElementById('detail-number').textContent='SLEEP ATLAS / FULL DATASET';SleepNetwork.prepare(indices);syncSurface();
        document.getElementById('globe-loading').hidden=true;
        SleepNetwork.setView(false);window.dispatchEvent(new CustomEvent('sleepdetailready',{detail:window.sleepRegionSelection}));
    }
    function back() {
        if(state?.direct){SleepNetwork.setView(false);return;}
        if (state && state.stage !== 'exiting') { SleepNetwork.stop(); run(0); }
    }

    function resized() {
        if(state?.direct){syncSurface();return;}
        if (!state) return;
        if (state.layout !== stamp()) {
            const world = atlasToWorld(state.anchor),
                center = {
                    x: mapRect.left + mapRect.width / 2,
                    y: mapRect.top + mapRect.height / 2
                };
            state.saved.ox = center.x - W / 2 - (world.x - W / 2) * state.saved.scale;
            state.saved.oy = center.y - H / 2 - (world.y - H / 2) * state.saved.scale;
            state.layout = stamp();
        }
        prepare();
        syncSurface();
        RegionMap.suspend();
    }
    backButton.addEventListener('click', back);
    document.querySelectorAll('a[href="#main"]').forEach(link => link.addEventListener('click', event => {
        if (state) {
            event.preventDefault();
            back();
        }
    }));
    motion.addEventListener('change', () => {
        if (state && state.stage !== 'detail') run(state.to);
    });
    return {
        enter,
        openGlobe,
        back,
        measureAtlasRect,
        syncSurface,
        resized,
        updateCamera,
        project,
        alpha,
        factor,
        get backgroundAlpha() {
            return state ? ease(state.progress / .55) : 1;
        },
        get active() {
            return !!state;
        },
        get stage() {
            return state?.stage ?? 'atlas';
        },
        get progress() {
            return state?.progress ?? 0;
        },
        get cells() {
            return state?.ordered;
        }
    };
})();
