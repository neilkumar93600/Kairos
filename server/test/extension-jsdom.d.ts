// jsdom ships no types and @types/jsdom is not installed; the extension fixture needs only this much.
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: { url?: string });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    window: any;
    /** Moves window.location without a navigation (the fixture follows a board's redirect this way). */
    reconfigure(settings: { url?: string }): void;
  }
}
