export type StateProjection = {
  state: string;
  vanceVotes: number;
  vancePct: number;
  newsomVotes: number;
  newsomPct: number;
  otherVotes: number;
  otherPct: number;
  totalVotes: number;
  margin: number;       // Vance positive, Newsom negative
  shiftMargin: number;
  otherShift: number;
  turnoutShift: number;
};

export const STATE_PROJECTIONS: StateProjection[] = [

{ state: "Alabama", vanceVotes: 1403497, vancePct: 63.64, newsomVotes: 772674, newsomPct: 35.03, otherVotes: 29264, otherPct: 1.33, totalVotes: 2205435, margin: 28.6, shiftMargin: -1.87, otherShift: 0.00, turnoutShift: -2.63 },
{ state: "Alaska", vanceVotes: 162947, vancePct: 49.71, newsomVotes: 151510, newsomPct: 46.22, otherVotes: 13339, otherPct: 4.07, totalVotes: 327796, margin: 3.5, shiftMargin: -9.74, otherShift: 0.00, turnoutShift: -2.86 },
{ state: "Arizona", vanceVotes: 1611028, vancePct: 48.93, newsomVotes: 1635155, newsomPct: 49.67, otherVotes: 46113, otherPct: 1.40, totalVotes: 3292296, margin: -0.7, shiftMargin: -6.24, otherShift: 0.00, turnoutShift: -3.19 },
{ state: "Arkansas", vanceVotes: 726789, vancePct: 63.14, newsomVotes: 398490, newsomPct: 34.62, otherVotes: 25813, otherPct: 2.24, totalVotes: 1151092, margin: 28.5, shiftMargin: -2.12, otherShift: 0.00, turnoutShift: -2.67 },
{ state: "California", vanceVotes: 4633305, vancePct: 30.21, newsomVotes: 10221342, newsomPct: 66.65, otherVotes: 482165, otherPct: 3.14, totalVotes: 15336813, margin: -36.4, shiftMargin: -16.30, otherShift: -0.11, turnoutShift: -3.33 },
{ state: "Colorado", vanceVotes: 1241845, vancePct: 40.03, newsomVotes: 1775417, newsomPct: 57.24, otherVotes: 84668, otherPct: 2.73, totalVotes: 3101930, margin: -17.2, shiftMargin: -6.22, otherShift: 0.00, turnoutShift: -2.84 },
{ state: "Connecticut", vanceVotes: 650062, vancePct: 37.94, newsomVotes: 1033933, newsomPct: 60.35, otherVotes: 29258, otherPct: 1.71, totalVotes: 1713254, margin: -22.4, shiftMargin: -7.90, otherShift: 0.00, turnoutShift: -2.60 },
{ state: "Delaware", vanceVotes: 196325, vancePct: 39.41, newsomVotes: 293248, newsomPct: 58.87, otherVotes: 8556, otherPct: 1.72, totalVotes: 498130, margin: -19.5, shiftMargin: -4.76, otherShift: 0.00, turnoutShift: -2.88 },
{ state: "Florida", vanceVotes: 5648023, vancePct: 53.21, newsomVotes: 4827852, newsomPct: 45.49, otherVotes: 138130, otherPct: 1.30, totalVotes: 10614006, margin: 7.7, shiftMargin: -5.32, otherShift: 0.00, turnoutShift: -2.94 },
{ state: "Georgia", vanceVotes: 2485095, vancePct: 48.64, newsomVotes: 2566275, newsomPct: 50.23, otherVotes: 57850, otherPct: 1.13, totalVotes: 5109219, margin: -1.6, shiftMargin: -3.77, otherShift: 0.00, turnoutShift: -3.07 },
{ state: "Hawaii", vanceVotes: 145587, vancePct: 29.23, newsomVotes: 342889, newsomPct: 68.84, otherVotes: 9637, otherPct: 1.93, totalVotes: 498113, margin: -39.6, shiftMargin: -16.51, otherShift: 0.00, turnoutShift: -3.60 },
{ state: "Idaho", vanceVotes: 582873, vancePct: 66.47, newsomVotes: 269969, newsomPct: 30.79, otherVotes: 24073, otherPct: 2.75, totalVotes: 876915, margin: 35.7, shiftMargin: -0.81, otherShift: 0.00, turnoutShift: -3.11 },
{ state: "Illinois", vanceVotes: 2166182, vancePct: 39.39, newsomVotes: 3196324, newsomPct: 58.13, otherVotes: 136351, otherPct: 2.48, totalVotes: 5498857, margin: -18.7, shiftMargin: -7.87, otherShift: 0.00, turnoutShift: -2.71 },
{ state: "Indiana", vanceVotes: 1677458, vancePct: 58.50, newsomVotes: 1131140, newsomPct: 39.45, otherVotes: 58796, otherPct: 2.05, totalVotes: 2867394, margin: 19.1, shiftMargin: 0.14, otherShift: 0.00, turnoutShift: -2.61 },
{ state: "Iowa", vanceVotes: 878010, vancePct: 54.11, newsomVotes: 716029, newsomPct: 44.13, otherVotes: 28487, otherPct: 1.76, totalVotes: 1622527, margin: 10.0, shiftMargin: -3.23, otherShift: 0.00, turnoutShift: -2.46 },
{ state: "Kansas", vanceVotes: 722549, vancePct: 55.60, newsomVotes: 546059, newsomPct: 42.02, otherVotes: 30838, otherPct: 2.37, totalVotes: 1299447, margin: 13.6, shiftMargin: -2.44, otherShift: 0.00, turnoutShift: -2.69 },
{ state: "Kentucky", vanceVotes: 1290237, vancePct: 63.81, newsomVotes: 697368, newsomPct: 34.49, otherVotes: 34329, otherPct: 1.70, totalVotes: 2021935, margin: 29.3, shiftMargin: -1.18, otherShift: 0.00, turnoutShift: -2.64 },
{ state: "Louisiana", vanceVotes: 1165599, vancePct: 59.64, newsomVotes: 758143, newsomPct: 38.79, otherVotes: 30767, otherPct: 1.57, totalVotes: 1954510, margin: 20.8, shiftMargin: -1.16, otherShift: 0.00, turnoutShift: -2.61 },
{ state: "Maine", vanceVotes: 342756, vancePct: 42.61, newsomVotes: 444515, newsomPct: 55.26, otherVotes: 17101, otherPct: 2.13, totalVotes: 804371, margin: -12.7, shiftMargin: -6.20, otherShift: 0.00, turnoutShift: -2.43 },
{ state: "Maryland", vanceVotes: 852124, vancePct: 28.77, newsomVotes: 2012477, newsomPct: 67.94, otherVotes: 97703, otherPct: 3.30, totalVotes: 2962304, margin: -39.2, shiftMargin: -10.63, otherShift: 0.00, turnoutShift: -2.50 },
{ state: "Massachusetts", vanceVotes: 1032057, vancePct: 30.50, newsomVotes: 2258652, newsomPct: 66.74, otherVotes: 93359, otherPct: 2.76, totalVotes: 3384068, margin: -36.2, shiftMargin: -11.05, otherShift: 0.00, turnoutShift: -2.58 },
{ state: "Michigan", vanceVotes: 2694713, vancePct: 48.78, newsomVotes: 2711375, newsomPct: 49.08, otherVotes: 118138, otherPct: 2.14, totalVotes: 5524227, margin: -0.3, shiftMargin: -1.71, otherShift: 0.00, turnoutShift: -2.65 },
{ state: "Minnesota", vanceVotes: 1411667, vancePct: 44.51, newsomVotes: 1684096, newsomPct: 53.10, otherVotes: 75938, otherPct: 2.39, totalVotes: 3171702, margin: -8.6, shiftMargin: -4.35, otherShift: 0.00, turnoutShift: -2.53 },
{ state: "Mississippi", vanceVotes: 707746, vancePct: 59.26, newsomVotes: 473415, newsomPct: 39.64, otherVotes: 13224, otherPct: 1.11, totalVotes: 1194385, margin: 19.6, shiftMargin: -3.27, otherShift: 0.00, turnoutShift: -2.74 },
{ state: "Missouri", vanceVotes: 1702334, vancePct: 58.12, newsomVotes: 1176455, newsomPct: 40.17, otherVotes: 50089, otherPct: 1.71, totalVotes: 2928878, margin: 18.0, shiftMargin: -0.40, otherShift: 0.00, turnoutShift: -2.50 },
{ state: "Montana", vanceVotes: 331220, vancePct: 56.54, newsomVotes: 236110, newsomPct: 40.31, otherVotes: 18465, otherPct: 3.15, totalVotes: 585795, margin: 16.2, shiftMargin: -3.69, otherShift: 0.00, turnoutShift: -2.85 },
{ state: "Nebraska", vanceVotes: 537958, vancePct: 58.01, newsomVotes: 372476, newsomPct: 40.17, otherVotes: 16917, otherPct: 1.82, totalVotes: 927351, margin: 17.8, shiftMargin: -2.62, otherShift: 0.00, turnoutShift: -2.61 },
{ state: "Nevada", vanceVotes: 673502, vancePct: 46.86, newsomVotes: 736359, newsomPct: 51.23, otherVotes: 27534, otherPct: 1.92, totalVotes: 1437396, margin: -4.4, shiftMargin: -7.47, otherShift: 0.00, turnoutShift: -3.20 },
{ state: "New Hampshire", vanceVotes: 363428, vancePct: 45.09, newsomVotes: 430651, newsomPct: 53.43, otherVotes: 11881, otherPct: 1.47, totalVotes: 805959, margin: -8.3, shiftMargin: -5.56, otherShift: 0.00, turnoutShift: -2.45 },
{ state: "New Jersey", vanceVotes: 1668953, vancePct: 40.10, newsomVotes: 2397134, newsomPct: 57.60, otherVotes: 95924, otherPct: 2.30, totalVotes: 4162010, margin: -17.5, shiftMargin: -11.61, otherShift: 0.00, turnoutShift: -2.93 },
{ state: "New Mexico", vanceVotes: 365639, vancePct: 40.67, newsomVotes: 512796, newsomPct: 57.04, otherVotes: 20652, otherPct: 2.30, totalVotes: 899087, margin: -16.4, shiftMargin: -10.37, otherShift: 0.00, turnoutShift: -2.63 },
{ state: "New York", vanceVotes: 2702364, vancePct: 33.46, newsomVotes: 5286795, newsomPct: 65.46, otherVotes: 86699, otherPct: 1.07, totalVotes: 8075857, margin: -32.0, shiftMargin: -19.47, otherShift: -0.31, turnoutShift: -2.70 },
{ state: "North Carolina", vanceVotes: 2720980, vancePct: 49.12, newsomVotes: 2735128, newsomPct: 49.38, otherVotes: 82950, otherPct: 1.50, totalVotes: 5539058, margin: -0.3, shiftMargin: -3.47, otherShift: 0.00, turnoutShift: -2.81 },
{ state: "North Dakota", vanceVotes: 233596, vancePct: 65.07, newsomVotes: 116303, newsomPct: 32.40, otherVotes: 9091, otherPct: 2.53, totalVotes: 358990, margin: 32.7, shiftMargin: -3.77, otherShift: 0.00, turnoutShift: -2.49 },
{ state: "Ohio", vanceVotes: 3092834, vancePct: 54.67, newsomVotes: 2480729, newsomPct: 43.85, otherVotes: 83889, otherPct: 1.48, totalVotes: 5657451, margin: 10.8, shiftMargin: -0.33, otherShift: 0.00, turnoutShift: -2.45 },
{ state: "Oklahoma", vanceVotes: 989203, vancePct: 64.83, newsomVotes: 507156, newsomPct: 33.24, otherVotes: 29581, otherPct: 1.94, totalVotes: 1525940, margin: 31.6, shiftMargin: -2.67, otherShift: 0.00, turnoutShift: -2.57 },
{ state: "Oregon", vanceVotes: 833478, vancePct: 38.30, newsomVotes: 1261129, newsomPct: 57.94, otherVotes: 81849, otherPct: 3.76, totalVotes: 2176455, margin: -19.6, shiftMargin: -5.34, otherShift: 0.00, turnoutShift: -3.03 },
{ state: "Pennsylvania", vanceVotes: 3331188, vancePct: 48.46, newsomVotes: 3453750, newsomPct: 50.24, otherVotes: 89531, otherPct: 1.30, totalVotes: 6874468, margin: -1.8, shiftMargin: -3.49, otherShift: 0.00, turnoutShift: -2.60 },
{ state: "Rhode Island", vanceVotes: 193270, vancePct: 38.70, newsomVotes: 292639, newsomPct: 58.60, otherVotes: 13439, otherPct: 2.69, totalVotes: 499348, margin: -19.9, shiftMargin: -6.33, otherShift: 0.00, turnoutShift: -2.44 },
{ state: "South Carolina", vanceVotes: 1419010, vancePct: 57.42, newsomVotes: 1017609, newsomPct: 41.17, otherVotes: 34874, otherPct: 1.41, totalVotes: 2471492, margin: 16.2, shiftMargin: -1.63, otherShift: 0.00, turnoutShift: -3.01 },
{ state: "South Dakota", vanceVotes: 257246, vancePct: 61.66, newsomVotes: 150297, newsomPct: 36.02, otherVotes: 9680, otherPct: 2.32, totalVotes: 417223, margin: 25.6, shiftMargin: -3.56, otherShift: -0.01, turnoutShift: -2.73 },
{ state: "Tennessee", vanceVotes: 1893086, vancePct: 63.72, newsomVotes: 1038175, newsomPct: 34.95, otherVotes: 39564, otherPct: 1.33, totalVotes: 2970826, margin: 28.8, shiftMargin: -0.94, otherShift: 0.00, turnoutShift: -3.04 },
{ state: "Texas", vanceVotes: 5790574, vancePct: 52.48, newsomVotes: 5070883, newsomPct: 45.96, otherVotes: 171460, otherPct: 1.55, totalVotes: 11032917, margin: 6.5, shiftMargin: -7.14, otherShift: 0.00, turnoutShift: -3.27 },
{ state: "Utah", vanceVotes: 843172, vancePct: 58.63, newsomVotes: 554347, newsomPct: 38.54, otherVotes: 40690, otherPct: 2.83, totalVotes: 1438209, margin: 20.1, shiftMargin: -1.50, otherShift: 0.00, turnoutShift: -3.38 },
{ state: "Vermont", vanceVotes: 99301, vancePct: 27.61, newsomVotes: 246488, newsomPct: 68.54, otherVotes: 13860, otherPct: 3.85, totalVotes: 359649, margin: -40.9, shiftMargin: -9.42, otherShift: 0.00, turnoutShift: -2.65 },
{ state: "Virginia", vanceVotes: 1829809, vancePct: 41.69, newsomVotes: 2465855, newsomPct: 56.19, otherVotes: 92988, otherPct: 2.12, totalVotes: 4388653, margin: -14.5, shiftMargin: -8.72, otherShift: 0.00, turnoutShift: -2.60 },
{ state: "Washington", vanceVotes: 1335771, vancePct: 35.09, newsomVotes: 2328089, newsomPct: 61.15, otherVotes: 143064, otherPct: 3.76, totalVotes: 3806924, margin: -26.1, shiftMargin: -7.85, otherShift: 0.00, turnoutShift: -2.99 },
{ state: "West Virginia", vanceVotes: 512020, vancePct: 68.93, newsomVotes: 215406, newsomPct: 29.00, otherVotes: 15383, otherPct: 2.07, totalVotes: 742809, margin: 39.9, shiftMargin: -1.87, otherShift: 0.00, turnoutShift: -2.73 },
{ state: "Wisconsin", vanceVotes: 1604235, vancePct: 48.11, newsomVotes: 1674757, newsomPct: 50.22, otherVotes: 55593, otherPct: 1.67, totalVotes: 3334585, margin: -2.1, shiftMargin: -2.97, otherShift: 0.00, turnoutShift: -2.58 },
{ state: "Wyoming", vanceVotes: 181900, vancePct: 69.33, newsomVotes: 73755, newsomPct: 28.11, otherVotes: 6716, otherPct: 2.56, totalVotes: 262371, margin: 41.2, shiftMargin: -4.54, otherShift: 0.00, turnoutShift: -2.48 }

];

export const NATIONAL_TOTAL = {
  vanceVotes: 69949297,
  vancePct: 46.32,
  newsomVotes: 78041632,
  newsomPct: 51.67,
  otherVotes: 3036582,
  otherPct: 2.01,
  totalVotes: 151027511,
  margin: -5.4,
  shiftMargin: -6.83,
  otherShift: -0.03,
  turnoutShift: -2.85
};

export const DISTRICT_RESULTS = {
  "ME-1": -27.4,
  "ME-2": 3.0,
  "NE-1": 11.1,
  "NE-2": -5.5,
  "NE-3": 49.1
};