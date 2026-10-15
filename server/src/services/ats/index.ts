import type { AtsProvider } from "@auto-career/shared";
import { ashby } from "./ashby";
import { greenhouse } from "./greenhouse";
import { lever } from "./lever";
import type { AtsAdapter } from "./types";

export const atsAdapters: Record<AtsProvider, AtsAdapter> = { greenhouse, lever, ashby };
export * from "./types";
