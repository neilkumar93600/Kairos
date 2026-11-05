import { marketingCopy } from "@/content/marketing-copy";

export const BANNER_STORAGE_KEY = `kairos.banner.${marketingCopy.banner.id}`;

/** Inline in the root layout's <head>, so a dismissed band is gone before first paint. Built from a constant, no user input. */
export const BANNER_HEAD_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(BANNER_STORAGE_KEY)}))document.documentElement.setAttribute("data-tb-off","")}catch(e){}`;
