import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

/** Terms, privacy, cookies and refunds: public, plain reading layout. */
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      <main className="flex-1 py-16 md:py-20">{children}</main>
      <Footer />
    </>
  );
}
