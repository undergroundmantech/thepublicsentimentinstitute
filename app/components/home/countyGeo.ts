// County geometry helpers. public/forecast/states/{ST}.json paths are absolute M/L/Z commands,
// already projected, so a bounding box is the min and max of the coordinate pairs.
export type CountyPath = { id: string; d: string };
export type CountyRow = [number, number, number, number, number[]?];

export function pathsBox(paths: CountyPath[]): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
  for (const p of paths) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(p.d))) {
      const x = +m[1], y = +m[2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return [x0, y0, x1, y1];
}

/** translate/scale that fits the box into W x H with a margin. */
export function fit(box: [number, number, number, number], W: number, H: number, padX = 20, padY = 20) {
  const [x0, y0, x1, y1] = box;
  const sc = Math.min((W - padX) / (x1 - x0 || 1), (H - padY) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc;
  const oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
  return { sc, ox, oy };
}
