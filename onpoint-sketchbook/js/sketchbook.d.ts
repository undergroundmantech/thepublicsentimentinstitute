declare const SK: {
  init(o?: { base?: string; overlays?: boolean; flashOnLoad?: boolean }): void;
  flash(ms?: number): void;
  coin(el: Element): void;
  pointy(el: Element, o?: { pose?: string; run?: boolean; wave?: boolean }): Promise<SVGSVGElement> | SVGSVGElement;
  reveal(root?: ParentNode): void;
};
export default SK;
