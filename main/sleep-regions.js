// Data-only region model. No DOM, canvas, filters, or visual coordinates.
// Edit the overrides below to change thresholds; null uses whole-dataset quantiles.
const SLEEP_REGION_CONFIG = Object.freeze({
  onsetQuantiles: [1 / 3, 2 / 3],
  durationQuantile: 0.5,
  onsetBreaks: null, // e.g. [4.5, 5.67], hours elapsed since 18:00
  durationBreak: null // e.g. 7.5, hours
});

window.SleepRegions = (() => {
  const valid = record => Array.isArray(record) &&
    Number.isFinite(record[0]) && record[0] >= 0 && record[0] < 24 &&
    Number.isFinite(record[1]) && record[1] > 0 && record[1] <= 24 && [1, 2, 3].includes(record[2]);
  const validIndices = [],
    invalidIndices = [];
  DATA.forEach((record, index) => (valid(record) ? validIndices : invalidIndices).push(index));
  if (!validIndices.length) throw new Error('No valid sleep records');
  // Linear interpolation of sorted observations (R-7 quantiles).
  const quantile = (sorted, q) => {
    const index = (sorted.length - 1) * q,
      lo = Math.floor(index),
      fraction = index - lo;
    return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * fraction;
  };
  const onsets = validIndices.map(i => DATA[i][0]).sort((a, b) => a - b);
  const durations = validIndices.map(i => DATA[i][1]).sort((a, b) => a - b);
  const onsetBreaks = SLEEP_REGION_CONFIG.onsetBreaks || SLEEP_REGION_CONFIG.onsetQuantiles.map(q => quantile(onsets, q));
  const durationBreak = SLEEP_REGION_CONFIG.durationBreak ?? quantile(durations, SLEEP_REGION_CONFIG.durationQuantile);
  if (!(0 < onsetBreaks[0] && onsetBreaks[0] < onsetBreaks[1] && onsetBreaks[1] < 24 && durationBreak > 0)) {
    throw new Error('Invalid sleep region thresholds');
  }
  const thresholds = Object.freeze({
    onsetBreaks: Object.freeze([...onsetBreaks]),
    durationBreak,
    anchorHour: 18
  });
  // DATA[0] already unwraps midnight: 23:00 -> 5, 01:00 -> 7.
  // Never sort modulo-24 clock hours to determine bedtime quantiles.
  function classify(onset, duration) {
    if (!Number.isFinite(onset) || onset < 0 || onset >= 24 || !Number.isFinite(duration) || duration <= 0 || duration > 24) return null;
    const column = onset < onsetBreaks[0] ? 0 : onset < onsetBreaks[1] ? 1 : 2;
    return column + (duration >= durationBreak ? 0 : 3) + 1;
  }
  const names = ['Early & Long Sleep', 'Regular & Long Sleep', 'Late & Long Sleep',
    'Early & Short Sleep', 'Regular & Short Sleep', 'Late & Short Sleep'
  ];
  const edges = [0, ...onsetBreaks, 24];
  const regions = names.map((name, index) => {
    const column = index % 3,
      long = index < 3;
    return Object.freeze({
      id: index + 1,
      number: String(index + 1).padStart(2, '0'),
      name,
      column,
      long,
      onsetMin: edges[column],
      onsetMax: edges[column + 1],
      durationMin: long ? durationBreak : 0,
      durationMax: long ? 24 : durationBreak
    });
  });
  const membership = new Uint8Array(DATA.length);
  const byRegion = Array.from({
    length: 6
  }, () => []);
  for (const i of validIndices) {
    const id = classify(DATA[i][0], DATA[i][1]);
    membership[i] = id;
    byRegion[id - 1].push(i);
  }
  byRegion.forEach(Object.freeze);
  if (byRegion.reduce((sum, indices) => sum + indices.length, 0) !== validIndices.length) {
    throw new Error('Region partition does not preserve record count');
  }
  const clock = hours => {
    const minute = ((Math.round((18 + hours) * 60) % 1440) + 1440) % 1440;
    return String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
  };
  const enabled = (index, filter) => !filter || !!filter[DATA[index][2]];

  function indices(id, filter) {
    return id >= 1 && id <= 6 ? byRegion[id - 1].filter(i => enabled(i, filter)) : [];
  }

  function counts(filter) {
    return byRegion.map(list => list.reduce((n, i) => n + Number(enabled(i, filter)), 0));
  }

  function ranges(id) {
    const r = regions[id - 1];
    const clockWithDay = value => clock(value) + (18 + value >= 24 ? ' (+1d)' : '');
    const lower = r.column === 0 ? onsets[0] : r.onsetMin;
    const upper = r.column === 2 ? onsets[onsets.length - 1] : r.onsetMax;
    const onset = clockWithDay(lower) + ' ? onset ' + (r.column === 2 ? '? ' : '< ') + clockWithDay(upper);
    const duration = r.long ? durationBreak + ' ? duration ? ' + durations[durations.length - 1] + ' h' :
      durations[0] + ' ? duration < ' + durationBreak + ' h';
    return {onset, duration};
  }
  return Object.freeze({
    config: SLEEP_REGION_CONFIG,
    thresholds,
    regions: Object.freeze(regions),
    validIndices: Object.freeze(validIndices),
    invalidIndices: Object.freeze(invalidIndices),
    regionOf: index => membership[index] || null,
    classify,
    indices,
    counts,
    ranges,
    clock,
    records: (id, filter) => indices(id, filter).map(i => DATA[i]),
    extent: Object.freeze({
      onsetMin: onsets[0],
      onsetMax: onsets[onsets.length - 1],
      durationMin: durations[0],
      durationMax: durations[durations.length - 1]
    })
  });
})();
