import { performance } from 'perf_hooks';

// Simulate the logic in syncNow
const N = 10000;
const local = [];
const remoteSongs = [];

for (let i = 0; i < N; i++) {
  local.push({ id: `song-${i}`, updatedAt: '2023-01-01T00:00:00Z' });
  // Remote is newer for all
  remoteSongs.push({ id: `song-${i}`, updatedAt: '2023-01-02T00:00:00Z' });
}

function runOld() {
  const localMap = Object.fromEntries(local.map((s) => [s.id, s]));
  const merged = [...local];

  const start = performance.now();
  for (const rs of remoteSongs) {
    const ls = localMap[rs.id];
    if (!ls) {
      merged.push(rs);
    } else if ((rs.updatedAt || '') > (ls.updatedAt || '')) {
      const idx = merged.findIndex((s) => s.id === rs.id);
      if (idx !== -1) merged[idx] = rs;
    }
  }
  return performance.now() - start;
}

function runNew() {
  const localMap = new Map();
  local.forEach((s, idx) => localMap.set(s.id, { song: s, index: idx }));
  const merged = [...local];

  const start = performance.now();
  for (const rs of remoteSongs) {
    const localData = localMap.get(rs.id);
    if (!localData) {
      merged.push(rs);
    } else {
      const ls = localData.song;
      if ((rs.updatedAt || '') > (ls.updatedAt || '')) {
        merged[localData.index] = rs;
      }
    }
  }
  return performance.now() - start;
}

console.log('Old time:', runOld(), 'ms');
console.log('New time:', runNew(), 'ms');
