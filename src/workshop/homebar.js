// The mod's home page's bar of what it's made of (round 66): squares
// shared out among the kinds of thing in it. No page needed: the tests
// read it too.

// How many of `cells` squares each kind gets: the whole bar shared out by
// how many of each there are, the largest remainders rounding up, and a
// square at least for any kind there is one of.
export function barCells(ns, cells) {
  const total = ns.reduce((a, b) => a + b, 0);
  if (!total) return ns.map(() => 0);
  const raw = ns.map((n) => (n / total) * cells);
  const out = raw.map((r, i) => (ns[i] ? Math.max(1, Math.floor(r)) : 0));
  let left = cells - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).filter(([, i]) => ns[i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; left > 0 && order.length; k++) {
    out[order[k % order.length][1]]++;
    left--;
  }
  while (left < 0) {
    const i = out.indexOf(Math.max(...out));
    out[i]--;
    left++;
  }
  return out;
}
