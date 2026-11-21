// jsdom ships no types and @types/jsdom is not installed; the extension fixture needs only this much.
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window: any;
  }
}
