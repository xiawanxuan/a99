import type { Point3D, Point2D, EllipseParams } from '../types';

export type Plane = {
  normal: Point3D;
  d: number;
};

export function distanceToPlane(
  point: Point3D,
  planeNormal: Point3D,
  planeD: number
): number {
  return (
    Math.abs(
      planeNormal.x * point.x + planeNormal.y * point.y + planeNormal.z * point.z + planeD
    ) / Math.sqrt(planeNormal.x ** 2 + planeNormal.y ** 2 + planeNormal.z ** 2)
  );
}

export function createPlaneFromPointNormal(
  point: Point3D,
  normal: Point3D
): { normal: Point3D; d: number } {
  const len = Math.sqrt(normal.x ** 2 + normal.y ** 2 + normal.z ** 2);
  const nx = normal.x / len;
  const ny = normal.y / len;
  const nz = normal.z / len;
  return {
    normal: { x: nx, y: ny, z: nz },
    d: -(nx * point.x + ny * point.y + nz * point.z),
  };
}

export function projectPointToPlane(
  point: Point3D,
  planeNormal: Point3D,
  planeD: number
): Point2D {
  const t =
    -(planeNormal.x * point.x + planeNormal.y * point.y + planeNormal.z * point.z + planeD) /
    (planeNormal.x ** 2 + planeNormal.y ** 2 + planeNormal.z ** 2);

  const projX = point.x + t * planeNormal.x;
  const projY = point.y + t * planeNormal.y;
  const projZ = point.z + t * planeNormal.z;

  const { u, v } = getPlaneBasis(planeNormal);
  const x = projX * u.x + projY * u.y + projZ * u.z;
  const y = projX * v.x + projY * v.y + projZ * v.z;

  return { x, y };
}

export function getPlaneBasis(normal: Point3D): { u: Point3D; v: Point3D } {
  let u: Point3D;
  if (Math.abs(normal.z) < 0.9) {
    const len = Math.sqrt(normal.x ** 2 + normal.y ** 2);
    u = { x: -normal.y / len, y: normal.x / len, z: 0 };
  } else {
    const len = Math.sqrt(normal.x ** 2 + normal.z ** 2);
    u = { x: normal.z / len, y: 0, z: -normal.x / len };
  }

  const v: Point3D = {
    x: normal.y * u.z - normal.z * u.y,
    y: normal.z * u.x - normal.x * u.z,
    z: normal.x * u.y - normal.y * u.x,
  };

  return { u, v };
}

export function cutCrossSection(
  points: Point3D[],
  planeNormal: Point3D,
  planeD: number,
  thickness: number
): { points: Point2D[]; indices: number[] } {
  const result: Point2D[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const dist = distanceToPlane(points[i], planeNormal, planeD);
    if (dist <= thickness) {
      const projected = projectPointToPlane(points[i], planeNormal, planeD);
      result.push(projected);
      indices.push(i);
    }
  }

  return { points: result, indices };
}

export function fitEllipse(points: Point2D[]): EllipseParams | null {
  const n = points.length;
  if (n < 5) return null;

  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0,
    sumY2 = 0,
    sumX3 = 0,
    sumY3 = 0,
    sumX2Y = 0,
    sumXY2 = 0,
    sumX4 = 0,
    sumY4 = 0,
    sumX3Y = 0,
    sumXY3 = 0,
    sumX2Y2 = 0;

  for (const p of points) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const y2 = y * y;
    const xy = x * y;

    sumX += x;
    sumY += y;
    sumXY += xy;
    sumX2 += x2;
    sumY2 += y2;
    sumX3 += x2 * x;
    sumY3 += y2 * y;
    sumX2Y += x2 * y;
    sumXY2 += x * y2;
    sumX4 += x2 * x2;
    sumY4 += y2 * y2;
    sumX3Y += x2 * xy;
    sumXY3 += xy * y2;
    sumX2Y2 += x2 * y2;
  }

  const D = [
    [sumX4, sumX3Y, sumX2Y2, sumX3, sumX2Y, sumX2],
    [sumX3Y, sumX2Y2, sumXY3, sumX2Y, sumXY2, sumXY],
    [sumX2Y2, sumXY3, sumY4, sumX2Y, sumY3, sumY2],
    [sumX3, sumX2Y, sumX2Y, sumX2, sumXY, sumX],
    [sumX2Y, sumXY2, sumY3, sumXY, sumY2, sumY],
    [sumX2, sumXY, sumY2, sumX, sumY, n],
  ];

  const C = [
    [0, 0, 2, 0, 0, 0],
    [0, -1, 0, 0, 0, 0],
    [2, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ];

  const { eigenvalues, eigenvectors } = generalizedEigenvalue(D, C, 6);

  let bestIdx = 0;
  let minEig = Infinity;
  for (let i = 0; i < eigenvalues.length; i++) {
    if (eigenvalues[i] > 0 && eigenvalues[i] < minEig) {
      minEig = eigenvalues[i];
      bestIdx = i;
    }
  }

  const A = eigenvectors[0][bestIdx];
  const B = eigenvectors[1][bestIdx];
  const Ccoef = eigenvectors[2][bestIdx];
  const Dcoef = eigenvectors[3][bestIdx];
  const Ecoef = eigenvectors[4][bestIdx];
  const F = eigenvectors[5][bestIdx];

  const denom = B * B - 4 * A * Ccoef;
  if (denom >= 0) return null;

  const cx = (2 * Ccoef * Dcoef - B * Ecoef) / denom;
  const cy = (2 * A * Ecoef - B * Dcoef) / denom;

  const numer =
    2 * (A * Ecoef * Ecoef + Ccoef * Dcoef * Dcoef - B * Dcoef * Ecoef + denom * F);
  const denomA =
    (B * B - 4 * A * Ccoef) *
    (Math.sqrt((A - Ccoef) * (A - Ccoef) + B * B) - (A + Ccoef));
  const denomB =
    (B * B - 4 * A * Ccoef) *
    (-Math.sqrt((A - Ccoef) * (A - Ccoef) + B * B) - (A + Ccoef));

  let a = Math.sqrt(Math.abs(numer / denomA));
  let b = Math.sqrt(Math.abs(numer / denomB));

  let theta: number;
  if (B === 0) {
    theta = A < Ccoef ? 0 : Math.PI / 2;
  } else {
    theta = 0.5 * Math.atan2(B, A - Ccoef);
    if (a < b) {
      [a, b] = [b, a];
      theta += Math.PI / 2;
    }
  }

  return { cx, cy, a, b, rotation: theta };
}

function generalizedEigenvalue(
  D: number[][],
  C: number[][],
  n: number
): { eigenvalues: number[]; eigenvectors: number[][] } {
  const eigenvalues = new Array(n).fill(0);
  const eigenvectors: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    eigenvectors[i][i] = 1;
  }

  const Dcopy = D.map((row) => [...row]);

  for (let iter = 0; iter < 100; iter++) {
    let maxOff = 0;
    let p = 0,
      q = 1;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(Dcopy[i][j]) > maxOff) {
          maxOff = Math.abs(Dcopy[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxOff < 1e-10) break;

    const Dpp = Dcopy[p][p];
    const Dqq = Dcopy[q][q];
    const Dpq = Dcopy[p][q];

    let theta: number;
    if (Math.abs(Dqq - Dpp) < 1e-10) {
      theta = Math.PI / 4;
    } else {
      theta = 0.5 * Math.atan2(2 * Dpq, Dqq - Dpp);
    }

    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Dip = Dcopy[i][p];
        const Diq = Dcopy[i][q];
        Dcopy[i][p] = c * Dip - s * Diq;
        Dcopy[p][i] = Dcopy[i][p];
        Dcopy[i][q] = s * Dip + c * Diq;
        Dcopy[q][i] = Dcopy[i][q];
      }
    }

    Dcopy[p][p] = c * c * Dpp - 2 * s * c * Dpq + s * s * Dqq;
    Dcopy[q][q] = s * s * Dpp + 2 * s * c * Dpq + c * c * Dqq;
    Dcopy[p][q] = 0;
    Dcopy[q][p] = 0;

    for (let i = 0; i < n; i++) {
      const eip = eigenvectors[i][p];
      const eiq = eigenvectors[i][q];
      eigenvectors[i][p] = c * eip - s * eiq;
      eigenvectors[i][q] = s * eip + c * eiq;
    }
  }

  for (let i = 0; i < n; i++) {
    eigenvalues[i] = Dcopy[i][i];
  }

  return { eigenvalues, eigenvectors };
}

export function distanceToEllipse(point: Point2D, ellipse: EllipseParams): number {
  const { cx, cy, a, b, rotation } = ellipse;

  const cosT = Math.cos(-rotation);
  const sinT = Math.sin(-rotation);

  const dx = point.x - cx;
  const dy = point.y - cy;

  const lx = dx * cosT - dy * sinT;
  const ly = dx * sinT + dy * cosT;

  let t = 0;
  for (let i = 0; i < 10; i++) {
    const cos = Math.cos(t);
    const sin = Math.sin(t);

    const ex = a * cos;
    const ey = b * sin;

    const distX = lx - ex;
    const distY = ly - ey;

    const dist = Math.sqrt(distX * distX + distY * distY);
    if (dist < 1e-8) return 0;

    const fx = -a * sin;
    const fy = b * cos;

    const deriv = (distX * fx + distY * fy) / dist;
    const deriv2 =
      (distX * (-a * cos) + distY * (-b * sin)) / dist - (deriv * deriv) / dist;

    if (Math.abs(deriv2) < 1e-10) break;

    t -= deriv / deriv2;
  }

  const cosT2 = Math.cos(t);
  const sinT2 = Math.sin(t);
  const ex = a * cosT2;
  const ey = b * sinT2;

  const distX = lx - ex;
  const distY = ly - ey;

  const sign = (lx * lx) / (a * a) + (ly * ly) / (b * b) < 1 ? -1 : 1;

  return sign * Math.sqrt(distX * distX + distY * distY);
}

export const pointToEllipseDistance = distanceToEllipse;

export function computeDeformation(
  current: EllipseParams,
  baseline: EllipseParams
): { convergence: number; settlement: number } {
  const convergence = (current.a - baseline.a) * 2000;
  const settlement = (current.cy - baseline.cy) * 1000;
  return { convergence, settlement };
}

export function generateEllipsePoints(ellipse: EllipseParams, numPoints: number = 100): Point2D[] {
  const points: Point2D[] = [];
  const { cx, cy, a, b, rotation } = ellipse;

  const cosT = Math.cos(rotation);
  const sinT = Math.sin(rotation);

  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2;
    const x = a * Math.cos(theta);
    const y = b * Math.sin(theta);

    points.push({
      x: cx + x * cosT - y * sinT,
      y: cy + x * sinT + y * cosT,
    });
  }

  return points;
}

export function getBoundingBox(points: Point3D[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  if (points.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 };
  }

  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

export function getCentroid(points: Point3D[]): Point3D {
  const bbox = getBoundingBox(points);
  return {
    x: (bbox.minX + bbox.maxX) / 2,
    y: (bbox.minY + bbox.maxY) / 2,
    z: (bbox.minZ + bbox.maxZ) / 2,
  };
}
