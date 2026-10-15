import { ashbyForm } from "./ashby";
import { greenhouseForm } from "./greenhouse";
import { leverForm } from "./lever";
import type { AtsFormAdapter } from "./types";

export const formAdapters: AtsFormAdapter[] = [greenhouseForm, leverForm, ashbyForm];

export function detectAdapter(url: URL): AtsFormAdapter | null {
  return formAdapters.find((a) => a.matches(url)) ?? null;
}

export type { AtsFormAdapter } from "./types";
