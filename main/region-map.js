// Logical-region interaction within one continuous data landscape. No individual record popups.
window.RegionMap = (() => {
    let selectedId = null,
        hoveredId = null,
        frame = 0,
        previousTime = 0;
    let levels = Array(6).fill(1),
        pointer = null,
        tooltipPosition = null,
        tooltipRegion = null,
        hitInfo = null;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const tooltip = document.getElementById('region-tooltip');
    window.sleepRegionSelection = null;
    window.sleepClusterSelection = null;

    function model() {
        return SleepAtlas.build(filter);
    }

    function clock(hours) {
        return SleepRegions.clock(hours) + (18 + hours >= 24 ? ' (+1d)' : '');
    }

    function duration(hours) {
        const minutes = Math.round(hours * 60);
        return Math.floor(minutes / 60) + 'h ' + String(minutes % 60).padStart(2, '0') + 'm';
    }

    function contents(id, mixed) {
        const data = model().regions[id - 1],
            {
                region,
                stats,
                allStats
            } = data;
        const item = (label, value) => '<div class="region-tooltip-row"><span>' + label + '</span><b>' + value + '</b></div>';
        return '<div class="region-tooltip-number">REGION ' + region.number + '</div><strong>' + region.name + '</strong>' +
            '<div class="region-tooltip-count">' + stats.count.toLocaleString() + ' <small>VISIBLE RECORDS</small></div>' +
            '<p>' + stats.percentOfValid.toFixed(2) + '% of all ' + SleepAtlas.validCount.toLocaleString() + ' valid records<br>' +
            allStats.count.toLocaleString() + ' records in this region before filtering</p>' +
            item('ONSET RANGE', clock(stats.onsetMin) + ' - ' + clock(stats.onsetMax)) +
            item('DURATION RANGE', duration(stats.durationMin) + ' - ' + duration(stats.durationMax)) +
            item('MEAN ONSET', clock(stats.onsetMean)) + item('MEAN DURATION', duration(stats.durationMean)) +
            '<p class="region-tooltip-foot">Conceptual atlas coordinates; statistics use original filtered records' +
            (mixed ? '<br>Shared dot: region follows nearest original coordinate.' : '') + '</p>';
    }

    let hitCells = null,
        hitGrid = new Map(),
        hideAnimation = null;

    function hit(x, y) {
        const cells = densityCells();
        if (hitCells !== cells) {
            hitCells = cells;
            hitGrid = new Map();
            for (const marker of cells)
                for (const support of marker.supportCells) {
                    hitGrid.set(support.col + ',' + support.row, {
                        ...marker,
                        col: support.col,
                        row: support.row,
                        indices: support.indices
                    });
                }
        }
        // Invert the live viewport transform; this lookup is independent of animated radii.
        const worldX = W / 2 + (x - W / 2 - ox) / scale;
        const worldY = H / 2 + (y - H / 2 - oy) / scale;
        const atlasX = (worldX - atlasOffset.x) / atlasScale;
        const atlasY = (worldY - atlasOffset.y) / atlasScale;
        const pitchX = HybridAtlas.config.pitchX,
            pitchY = HybridAtlas.config.pitchY;
        const col = Math.round(atlasX / pitchX),
            row = Math.round(atlasY / pitchY);
        // A one-cell hole is included; larger valleys and outside space stay unresponsive.
        const reach = Math.min(pitchX, pitchY) * 1.1;
        let nearest = null,
            distance = Infinity,
            previous = null,
            previousDistance = Infinity;
        for (let dy = -2; dy <= 2; dy++)
            for (let dx = -2; dx <= 2; dx++) {
                const cell = hitGrid.get((col + dx) + ',' + (row + dy));
                if (!cell) continue;
                const d = Math.hypot(cell.col * pitchX - atlasX, cell.row * pitchY - atlasY);
                if (d > reach) continue;
                if (d < distance) {
                    nearest = cell;
                    distance = d;
                }
                if (cell.regionId === hoveredId && d < previousDistance) {
                    previous = cell;
                    previousDistance = d;
                }
            }
        // Small spatial hysteresis only near equidistant boundaries prevents flickering.
        if (previous && previousDistance <= distance + .12 * Math.min(pitchX, pitchY)) nearest = previous;
        hitInfo = null;
        if (!nearest) return null;
        const regionId = nearest.regionId;
        hitInfo = {
            regionId,
            recordIndex: nearest.indices[0],
            cell: nearest,
            mixed: false
        };
        return regionId;
    }

    function targetPosition() {
        if (!pointer || tooltip.hidden) return null;
        const width = tooltip.offsetWidth,
            height = tooltip.offsetHeight;
        let x = pointer.x + 18,
            y = pointer.y + 18;
        if (x + width > W - 12) x = pointer.x - width - 18;
        if (y + height > H - 12) y = pointer.y - height - 18;
        return {
            x: Math.max(12, Math.min(W - width - 12, x)),
            y: Math.max(12, Math.min(H - height - 12, y))
        };
    }

    function animate(now) {
        const dt = previousTime ? Math.min(64, now - previousTime) : 16;
        previousTime = now;
        let unfinished = false,
            changed = false;
        const active = hoveredId ?? selectedId;
        levels = levels.map((value, i) => {
            const target = active === null || i + 1 === active ? 1 : (i + 1 === selectedId ? 0.85 : 0.68);
            let next = reducedMotion.matches ? target : value + (target - value) * (1 - Math.exp(-dt / 55));
            if (Math.abs(next - target) < 0.004) next = target;
            else unfinished = true;
            if (next !== value) changed = true;
            return next;
        });
        const target = targetPosition();
        if (target) {
            if (!tooltipPosition || reducedMotion.matches) tooltipPosition = {
                ...target
            };
            else {
                const factor = 1 - Math.exp(-dt / 35);
                tooltipPosition.x += (target.x - tooltipPosition.x) * factor;
                tooltipPosition.y += (target.y - tooltipPosition.y) * factor;
                if (Math.hypot(target.x - tooltipPosition.x, target.y - tooltipPosition.y) > 0.3) unfinished = true;
            }
            // Clamp even while interpolating after a cursor flip or viewport resize.
            tooltipPosition.x = Math.max(12, Math.min(W - tooltip.offsetWidth - 12, tooltipPosition.x));
            tooltipPosition.y = Math.max(12, Math.min(H - tooltip.offsetHeight - 12, tooltipPosition.y));
            tooltip.style.transform = 'translate3d(' + tooltipPosition.x + 'px,' + tooltipPosition.y + 'px,0)';
        }
        const ripple = DotRipple.step(now);
        changed ||= ripple.changed;
        unfinished ||= ripple.unfinished;
        if (changed) render();
        if (unfinished) frame = requestAnimationFrame(animate);
        else {
            frame = 0;
            previousTime = 0;
        }
    }

    function refresh() {
        if (!frame) frame = requestAnimationFrame(animate);
    }

    function leave(animateExit = false) {
        DotRipple.leave();
        hoveredId = null;
        pointer = null;
        tooltipRegion = null;
        tooltipPosition = null;
        if (animateExit && !reducedMotion.matches && !tooltip.hidden) {
            if (!hideAnimation) {
                hideAnimation = tooltip.animate([{
                    opacity: 1
                }, {
                    opacity: 0
                }], {
                    duration: 120,
                    easing: 'ease-out'
                });
                hideAnimation.onfinish = () => {
                    tooltip.hidden = true;
                    hideAnimation = null;
                };
            }
        } else {
            if (hideAnimation) {
                hideAnimation.cancel();
                hideAnimation = null;
            }
            tooltip.hidden = true;
        }
        refresh();
    }

    function pointerMove(x, y) {
        const id = hit(x, y);
        pointer = {
            x,
            y
        };
        if (hoveredId !== id) {
            hoveredId = id;
            tooltipPosition = null;
        }
        if (!id) {
            leave(true);
            return;
        }
        const tooltipKey = id + ':' + Number(hitInfo.mixed);
        if (tooltipRegion !== tooltipKey) {
            tooltip.innerHTML = contents(id, hitInfo.mixed);
            tooltipRegion = tooltipKey;
        }
        if (hideAnimation) {
            hideAnimation.cancel();
            hideAnimation = null;
        }
        tooltip.hidden = false;
        DotRipple.move(x, y, id);
        refresh();
    }

    function publish() {
        const status = document.getElementById('cluster-selection');
        if (selectedId === null) {
            window.sleepRegionSelection = window.sleepClusterSelection = null;
            status.hidden = true;
        } else {
            const data = model().regions[selectedId - 1];
            const selection = {
                id: selectedId,
                region: data.region,
                recordIndices: [...data.allIndices],
                records: data.allIndices.map(i => DATA[i]),
                visibleRecordIndices: [...data.indices],
                visibleRecords: data.indices.map(i => DATA[i]),
                statistics: data.stats,
                thresholds: SleepRegions.thresholds
            };
            window.sleepRegionSelection = window.sleepClusterSelection = selection;
            status.hidden = false;
            document.getElementById('cluster-selection-text').textContent = data.region.number + ' / ' + data.region.name + ' / ' + data.stats.count.toLocaleString() + ' VISIBLE';
        }
        window.dispatchEvent(new CustomEvent('sleepregionchange', {
            detail: window.sleepRegionSelection
        }));
        window.dispatchEvent(new CustomEvent('sleepclusterselect', {
            detail: window.sleepClusterSelection
        }));
    }

    function select(id) {
        selectedId = id;
        publish();
        refresh();
    }

    function selectAt(x, y) {
        select(hit(x, y));
    }

    function clear() {
        select(null);
        leave();
    }

    function filtersChanged() {
        leave();
        publish();
    }

    function alpha(cell) {
        return cell.regionCounts.reduce((sum, count, i) => sum + count * levels[i], 0) / cell.n;
    }

    return {
        suspend() {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            previousTime = 0;
        },
        hit,
        pointerMove,
        leave,
        select,
        selectAt,
        clear,
        filtersChanged,
        alpha,
        get hitInfo() {
            return hitInfo;
        },
        get selectedId() {
            return selectedId;
        },
        get hoveredId() {
            return hoveredId;
        }
    };
})();
