// Data-only statistics for the continuous sleep landscape. Original rows are never changed.
// The six-region classification is owned exclusively by sleep-regions.js.
window.SleepAtlas = (() => {
  const config = Object.freeze({
    coordinateSystem: 'sleep-onset-and-duration',
    anchorHour: 18,
    onsetDomain: [0, 12],
    durationDomain: [3, 15]
  });
  const ids = SleepRegions.regions.map(region => SleepRegions.indices(region.id));
  const cache = new Map();

  function statistics(indices) {
    const stats = {
      count: indices.length,
      onsetMin: Infinity,
      onsetMax: -Infinity,
      durationMin: Infinity,
      durationMax: -Infinity,
      onsetMean: null,
      durationMean: null,
      categoryCounts: {
        1: 0,
        2: 0,
        3: 0
      }
    };
    let onsetSum = 0,
      durationSum = 0;
    for (const i of indices) {
      const row = DATA[i];
      onsetSum += row[0];
      durationSum += row[1];
      stats.categoryCounts[row[2]]++;
      stats.onsetMin = Math.min(stats.onsetMin, row[0]);
      stats.onsetMax = Math.max(stats.onsetMax, row[0]);
      stats.durationMin = Math.min(stats.durationMin, row[1]);
      stats.durationMax = Math.max(stats.durationMax, row[1]);
    }
    if (indices.length) {
      // Onset is already unwrapped from 18:00; averaging across midnight is safe.
      stats.onsetMean = onsetSum / indices.length;
      stats.durationMean = durationSum / indices.length;
    } else {
      stats.onsetMin = stats.onsetMax = stats.durationMin = stats.durationMax = null;
    }
    stats.percentOfValid = 100 * indices.length / SleepRegions.validIndices.length;
    return stats;
  }
  const fullStats = ids.map(statistics);

  function build(filter) {
    const signature = [1, 2, 3].map(day => Number(!!filter[day])).join('');
    if (cache.has(signature)) return cache.get(signature);
    const regions = SleepRegions.regions.map((region, i) => {
      const indices = ids[i].filter(index => !!filter[DATA[index][2]]);
      return {
        region,
        indices,
        stats: statistics(indices),
        allStats: fullStats[i],
        allIndices: ids[i]
      };
    });
    const total = regions.reduce((sum, r) => sum + r.indices.length, 0);
    const result = {
      regions,
      total,
      signature
    };
    cache.set(signature, result);
    return result;
  }

  function hexCell(x, y, pitch) {
    const r = y / (pitch * Math.sqrt(3) / 2),
      q = x / pitch - r / 2;
    let a = Math.round(q),
      b = Math.round(r),
      c = Math.round(-q - r);
    const da = Math.abs(a - q),
      db = Math.abs(b - r),
      dc = Math.abs(c + q + r);
    if (da > db && da > dc) a = -b - c;
    else if (db > dc) b = -a - c;
    return {
      key: a + ',' + b,
      x: pitch * (a + b / 2),
      y: pitch * Math.sqrt(3) / 2 * b
    };
  }
  return {
    config,
    build,
    hexCell,
    validCount: SleepRegions.validIndices.length
  };
})();
