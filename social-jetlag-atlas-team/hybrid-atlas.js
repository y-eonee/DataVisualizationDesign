// Rectangular occupancy atlas. No displaced, random or noise-based coordinates.
// Every marker is a region-pure partition of immutable original record indices.
window.HybridAtlas = (() => {
    const config = Object.freeze({
        width: 1200,
        height: 480,
        pitchX: 7,
        pitchY: 7,
        maxBatch: 10,
        separationPenalty: 88,
        searchRadius: 18,
        bandwidthX: 4.2,
        bandwidthY: 2.6,
        horizontalSpread: 1.65,
        verticalSpread: .85,
        verticalScale: .90
    });
    // Fit once to the full dataset. Filters never change this coordinate system.
    const fullRegions = SleepAtlas.build({
        1: true,
        2: true,
        3: true
    }).regions;
    const columnMass = [0, 1, 2].map(c => fullRegions[c].stats.count + fullRegions[c + 3].stats.count);
    const weights = columnMass.map(n => Math.pow(n, .55));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const edges = [0];
    weights.forEach(weight => edges.push(edges[edges.length - 1] + config.width * weight / totalWeight));

    function empiricalAxis(indices, dimension) {
        const sorted = indices.map(i => DATA[i][dimension]).sort((a, b) => a - b);
        const knots = [],
            ranks = [];
        for (let lo = 0; lo < sorted.length;) {
            let hi = lo + 1;
            while (hi < sorted.length && sorted[hi] === sorted[lo]) hi++;
            knots.push(sorted[lo]);
            ranks.push((lo + (hi - lo - 1) / 2) / Math.max(1, sorted.length - 1));
            lo = hi;
        }
        return value => {
            let low = 0,
                high = knots.length - 1;
            while (low < high) {
                const mid = Math.floor((low + high) / 2);
                if (knots[mid] < value) low = mid + 1;
                else high = mid;
            }
            const upper = low,
                lower = Math.max(0, upper - 1);
            const fraction = knots[upper] === knots[lower] ? 0 : (value - knots[lower]) / (knots[upper] - knots[lower]);
            const rank = ranks[lower] + fraction * (ranks[upper] - ranks[lower]);
            const linear = (value - knots[0]) / (knots[knots.length - 1] - knots[0] || 1);
            // Strictly monotone blend: expose dense values without flattening their density.
            const rankWeight = dimension === 1 ? .82 : .45;
            const t = rankWeight * rank + (1 - rankWeight) * linear;
            // A monotone, soft central emphasis retains tails and unequal local densities.
            const centered = 2 * t - 1;
            return .55 * t + .45 * (.5 + .5 * Math.sign(centered) * Math.pow(Math.abs(centered), 1.8));
        };
    }
    const mapping = fullRegions.map((region, i) => {
        const column = i % 3,
            long = i < 3;
        const relativeMass = Math.pow(region.stats.count / (columnMass[column] / 2), .18);
        const width = (edges[column + 1] - edges[column]) * .99 * relativeMass;
        const xOffset = (long ? [-14, 17, -9] : [19, -18, 16])[column];
        const yOffset = (long ? [8, -28, 30] : [6, 38, -8])[column];
        return {
            regionId: i + 1,
            xMin: (edges[column] + edges[column + 1] - width) / 2 + xOffset,
            width,
            yMin: (long ? 0 : 218) + yOffset + (long ? 5 : 19),
            height: config.verticalScale * (long ? 252 : 256) * Math.pow(region.stats.count / (SleepRegions.validIndices.length / 6), .10),
            onset: empiricalAxis(region.indices, 0),
            duration: empiricalAxis(region.indices, 1)
        };
    });

    function sourcePoint(row, regionId = SleepRegions.classify(row[0], row[1])) {
        const m = mapping[regionId - 1];
        return {
            x: m.xMin + m.width * m.onset(row[0]),
            y: m.yMin + m.height * (1 - m.duration(row[1]))
        };
    }
    const bins = new Map(),
        histogram = new Map();
    const keyOf = (col, row) => col + ',' + row;
    for (const index of SleepRegions.validIndices) {
        const record = DATA[index],
            regionId = SleepRegions.regionOf(index),
            p = sourcePoint(record, regionId);
        const col = Math.round(p.x / config.pitchX),
            row = Math.round(p.y / config.pitchY);
        const key = regionId + ':' + keyOf(col, row);
        if (!bins.has(key)) bins.set(key, {
            regionId,
            col,
            row,
            days: [
                [],
                [],
                []
            ]
        });
        bins.get(key).days[record[2] - 1].push(index);
        const site = keyOf(col, row);
        if (!histogram.has(site)) histogram.set(site, Array(6).fill(0));
        histogram.get(site)[regionId - 1]++;
    }
    // Empirical density scores choose occupied grid cells, never offset their centers.
    const fieldCache = new Map();

    function density(col, row) {
        const key = keyOf(col, row);
        if (fieldCache.has(key)) return fieldCache.get(key);
        const values = Array(6).fill(0);
        for (let dy = -8; dy <= 8; dy++)
            for (let dx = -13; dx <= 13; dx++) {
                const counts = histogram.get(keyOf(col + dx, row + dy));
                if (!counts) continue;
                const weight = Math.exp(-.5 * ((dx / config.bandwidthX) ** 2 + (dy / config.bandwidthY) ** 2));
                counts.forEach((count, i) => values[i] += count * weight);
            }
        fieldCache.set(key, values);
        return values;
    }
    const batches = [];
    for (const bin of bins.values()) {
        const ordered = [],
            offsets = [0, 0, 0];
        while (offsets.some((offset, day) => offset < bin.days[day].length)) {
            for (let day = 0; day < 3; day++)
                if (offsets[day] < bin.days[day].length) ordered.push(bin.days[day][offsets[day]++]);
        }
        const number = Math.ceil(ordered.length / config.maxBatch);
        const parts = Array.from({
            length: number
        }, () => []);
        ordered.forEach((index, i) => parts[i % number].push(index));
        parts.forEach(allIndices => batches.push({
            key: batches.length,
            regionId: bin.regionId,
            sourceCol: bin.col,
            sourceRow: bin.row,
            allIndices,
            n: allIndices.length
        }));
    }
    const occupied = new Set();
    const candidates = [];
    for (let dy = -config.searchRadius; dy <= config.searchRadius; dy++)
        for (let dx = -config.searchRadius; dx <= config.searchRadius; dx++) candidates.push({
            dx,
            dy,
            // Elliptical allocation spreads real batches horizontally on the same grid.
            distance: (dx / config.horizontalSpread) ** 2 + (dy / config.verticalSpread) ** 2
        });
    candidates.sort((a, b) => a.distance - b.distance || a.dy - b.dy || a.dx - b.dx);
    // Dense batches get first choice. Small batches retain peripheral source support.
    for (const marker of [...batches].sort((a, b) => b.n - a.n || a.key - b.key)) {
        let best = null,
            bestScore = Infinity;
        for (const candidate of candidates) {
            if (candidate.distance > bestScore) break;
            const col = marker.sourceCol + candidate.dx,
                row = marker.sourceRow + candidate.dy;
            if (occupied.has(keyOf(col, row))) continue;
            const values = density(col, row),
                total = values.reduce((a, b) => a + b, 0);
            const own = values[marker.regionId - 1];
            // Competition opens small valleys at genuine distribution transitions.
            const score = candidate.distance + config.separationPenalty * (1 - own / (total || 1)) ** 2;
            if (score < bestScore) {
                bestScore = score;
                best = {
                    col,
                    row
                };
            }
        }
        if (!best) throw Error('Grid occupancy capacity exceeded');
        marker.col = best.col;
        marker.row = best.row;
        marker.x = best.col * config.pitchX;
        marker.y = best.row * config.pitchY;
        marker.allCounts = {
            1: 0,
            2: 0,
            3: 0
        };
        marker.allIndices.forEach(i => marker.allCounts[DATA[i][2]]++);
        occupied.add(keyOf(best.col, best.row));
    }
    // Post-process the approved occupancy; never rerun or relocate its source layout.
    const overviewMarkers = batches;
    const target = Math.round(batches.length * .70);
    const sites = new Map(batches.map(m => [keyOf(m.col, m.row), m]));
    const neighbors = marker => {
        let total = 0,
            axial = 0;
        for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
                if (!dx && !dy) continue;
                const other = sites.get(keyOf(marker.col + dx, marker.row + dy));
                if (other?.regionId === marker.regionId) {
                    total++;
                    if (!dx || !dy) axial++;
                }
            }
        return {
            total,
            axial
        };
    };
    const neighborhood = new Map(batches.map(m => [m.key, neighbors(m)]));
    const pairs = [];
    for (const a of batches)
        for (const [dx, dy] of [
                [1, 0],
                [0, 1]
            ]) {
            const b = sites.get(keyOf(a.col + dx, a.row + dy));
            if (!b || a.regionId !== b.regionId) continue;
            const na = neighborhood.get(a.key),
                nb = neighborhood.get(b.key);
            // Keep sparse edges, tips and narrow necks at full resolution.
            if (Math.min(na.total, nb.total) < 5 || Math.min(na.axial, nb.axial) < 3) continue;
            pairs.push({
                a,
                b,
                score: na.total + nb.total
            });
        }
    pairs.sort((a, b) => b.score - a.score || a.a.row - b.a.row || a.a.col - b.a.col || a.b.key - b.b.key);
    const used = new Set(),
        merged = new Map();
    let removed = 0;
    for (const pair of pairs) {
        if (removed >= batches.length - target) break;
        if (used.has(pair.a.key) || used.has(pair.b.key)) continue;
        // Retain the more exposed endpoint; remove the more interior cell only.
        const a = neighborhood.get(pair.a.key),
            b = neighborhood.get(pair.b.key);
        const keep = a.total <= b.total ? pair.a : pair.b;
        const donor = keep === pair.a ? pair.b : pair.a;
        if (neighborhood.get(donor.key).total < 6) continue;
        used.add(keep.key);
        used.add(donor.key);
        const allIndices = [...keep.allIndices, ...donor.allIndices];
        merged.set(keep.key, {
            ...keep,
            allIndices,
            n: allIndices.length,
            allCounts: {
                1: keep.allCounts[1] + donor.allCounts[1],
                2: keep.allCounts[2] + donor.allCounts[2],
                3: keep.allCounts[3] + donor.allCounts[3]
            },
            supportCells: [keep, donor]
        });
        removed++;
    }
    const retained = new Set(merged.keys());
    const markers = batches.filter(m => !used.has(m.key) || retained.has(m.key)).map((m, key) => ({
        ...(merged.get(m.key) || m),
        key,
        sourceKey: m.key,
        supportCells: merged.get(m.key)?.supportCells || [m]
    }));
    const aggregation = Object.freeze({
        before: batches.length,
        after: markers.length,
        target,
        reduction: 1 - markers.length / batches.length
    });
    const recordIds = markers.flatMap(m => m.allIndices);
    if (recordIds.length !== SleepRegions.validIndices.length || new Set(recordIds).size !== recordIds.length) throw Error('Grid partition mismatch');
    const diameter = n => Math.min(config.pitchX, config.pitchY) * (.16 + .72 * Math.pow(Math.log(Math.max(1, n)) / Math.log(config.maxBatch), .8));
    const bounds = {
        xMin: Math.min(-14, ...overviewMarkers.map(m => m.x)) - 7,
        xMax: Math.max(1214, ...overviewMarkers.map(m => m.x)) + 7,
        yMin: Math.min(-14, ...overviewMarkers.map(m => m.y)) - 7,
        yMax: Math.max(494, ...overviewMarkers.map(m => m.y)) + 7
    };
    const cache = new Map();

    function build(filter) {
        const key = [1, 2, 3].map(d => Number(!!filter[d])).join('');
        if (cache.has(key)) return cache.get(key);
        const active = [];
        for (const source of markers) {
            const indices = source.allIndices.filter(i => filter[DATA[i][2]]);
            if (!indices.length) continue;
            const counts = {
                    1: 0,
                    2: 0,
                    3: 0
                },
                regionCounts = Array(6).fill(0);
            indices.forEach(i => counts[DATA[i][2]]++);
            regionCounts[source.regionId - 1] = indices.length;
            active.push({
                ...source,
                indices,
                supportCells: source.supportCells.map(cell => ({
                    col: cell.col,
                    row: cell.row,
                    indices: cell.allIndices.filter(i => filter[DATA[i][2]])
                })).filter(cell => cell.indices.length),
                n: indices.length,
                counts,
                regionCounts
            });
        }
        const result = {
            markers: active,
            total: active.reduce((sum, m) => sum + m.n, 0)
        };
        cache.set(key, result);
        return result;
    }
    return {
        config,
        aggregation,
        overviewMarkers,
        markers,
        bounds,
        build,
        diameter,
        sourcePoint,
        mapping
    };
})();
