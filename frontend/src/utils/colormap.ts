export type ColormapName = 'viridis' | 'turbo' | 'jet' | 'rainbow' | 'coolwarm';

export interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

export const viridis: [number, number, number][] = [
  [0.267, 0.004, 0.329],
  [0.283, 0.141, 0.458],
  [0.254, 0.265, 0.530],
  [0.207, 0.372, 0.553],
  [0.164, 0.471, 0.558],
  [0.128, 0.567, 0.551],
  [0.135, 0.659, 0.518],
  [0.267, 0.749, 0.441],
  [0.478, 0.821, 0.318],
  [0.741, 0.873, 0.150],
  [0.993, 0.906, 0.144],
];

const colormaps: Record<ColormapName, [number, number, number][]> = {
  viridis,
  turbo: [
    [0.189, 0.071, 0.232],
    [0.214, 0.375, 0.945],
    [0.103, 0.667, 0.945],
    [0.094, 0.906, 0.812],
    [0.314, 0.965, 0.620],
    [0.655, 0.984, 0.420],
    [0.859, 0.914, 0.102],
    [0.984, 0.773, 0.024],
    [0.957, 0.545, 0.020],
    [0.878, 0.318, 0.071],
    [0.773, 0.106, 0.106],
  ],
  jet: [
    [0.000, 0.000, 0.500],
    [0.000, 0.000, 1.000],
    [0.000, 0.500, 1.000],
    [0.000, 1.000, 1.000],
    [0.500, 1.000, 0.500],
    [1.000, 1.000, 0.000],
    [1.000, 0.500, 0.000],
    [1.000, 0.000, 0.000],
    [0.500, 0.000, 0.000],
  ],
  rainbow: [
    [0.000, 0.000, 1.000],
    [0.000, 0.500, 1.000],
    [0.000, 1.000, 1.000],
    [0.000, 1.000, 0.500],
    [0.000, 1.000, 0.000],
    [0.500, 1.000, 0.000],
    [1.000, 1.000, 0.000],
    [1.000, 0.500, 0.000],
    [1.000, 0.000, 0.000],
  ],
  coolwarm: [
    [0.230, 0.299, 0.754],
    [0.265, 0.453, 0.801],
    [0.326, 0.583, 0.849],
    [0.417, 0.694, 0.894],
    [0.533, 0.784, 0.934],
    [0.652, 0.849, 0.964],
    [0.763, 0.894, 0.980],
    [0.843, 0.918, 0.984],
    [0.900, 0.900, 0.900],
    [0.969, 0.772, 0.748],
    [0.988, 0.733, 0.682],
    [0.993, 0.682, 0.608],
    [0.986, 0.612, 0.533],
    [0.965, 0.525, 0.459],
    [0.930, 0.424, 0.388],
    [0.881, 0.310, 0.326],
    [0.718, 0.088, 0.102],
  ],
};

export function getColor(
  value: number,
  min: number,
  max: number,
  colormap: ColormapName = 'turbo'
): ColorRGB {
  const colors = colormaps[colormap];
  if (colors.length === 0) return { r: 0, g: 0, b: 0 };

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const index = t * (colors.length - 1);
  const lower = Math.floor(index);
  const upper = Math.min(colors.length - 1, lower + 1);
  const frac = index - lower;

  const c1 = colors[lower];
  const c2 = colors[upper];

  return {
    r: c1[0] + (c2[0] - c1[0]) * frac,
    g: c1[1] + (c2[1] - c1[1]) * frac,
    b: c1[2] + (c2[2] - c1[2]) * frac,
  };
}

export function getColorHex(
  value: number,
  min: number,
  max: number,
  colormap: ColormapName = 'turbo'
): string {
  const { r, g, b } = getColor(value, min, max, colormap);
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function getColorArray(
  values: number[],
  min: number,
  max: number,
  colormap: ColormapName = 'turbo'
): Float32Array {
  const colors = new Float32Array(values.length * 3);
  for (let i = 0; i < values.length; i++) {
    const { r, g, b } = getColor(values[i], min, max, colormap);
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  return colors;
}

export function getDeviationColor(deviation: number, range: [number, number] = [-20, 20]): ColorRGB {
  return getColor(deviation, range[0], range[1], 'coolwarm');
}

export function getDeviationColorHex(deviation: number, range: [number, number] = [-20, 20]): string {
  return getColorHex(deviation, range[0], range[1], 'coolwarm');
}
