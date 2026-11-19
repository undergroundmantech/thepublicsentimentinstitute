export type SkMark = { party: 'd' | 'r' | 't' | 'i'; tier: 'safe' | 'likely' | 'lean'; lvl: 1 | 2 | 3 | 4 | 5 };
export function start(): () => void;
export function sweep(root?: ParentNode): void;
export function classify(fill: string): SkMark | null;
declare const SKMaps: { start: typeof start; sweep: typeof sweep; classify: typeof classify };
export default SKMaps;
