import { permanentRedirect } from "next/navigation";

/** Refund terms live inside the legal pages (README D10); old links survive. */
export default function RefundsPage() {
  permanentRedirect("/terms#refunds");
}
