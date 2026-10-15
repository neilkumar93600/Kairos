import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

/** Pages anyone can visit, signed in or not. */
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
