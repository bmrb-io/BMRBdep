/* SystemJS module definition */
declare var module: NodeModule;
interface NodeModule {
  id: string;
}

declare module 'country-region-selector' {
  // The library only exposes init(), which wires its handlers to the
  // country/state inputs already on the page.
  export function init(): void;
}
