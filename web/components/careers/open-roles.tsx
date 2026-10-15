import { siteConfig } from "@/lib/site";

/** No open roles yet; keeps the page honest and gives people a way in. */
export function OpenRoles() {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-8">
      <h2 className="text-xl tracking-tight">No open roles right now</h2>
      <p className="max-w-[60ch] leading-relaxed text-body">
        We are a small team. If you have built browser automation, hiring tools or careful AI products and want to talk, write to{" "}
        <a className="text-foreground underline underline-offset-4" href={`mailto:${siteConfig.supportEmail}?subject=Careers`}>
          {siteConfig.supportEmail}
        </a>{" "}
        with what you have shipped.
      </p>
    </div>
  );
}
