import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="text-6xl font-bold text-muted-foreground">403</div>
      <h1 className="text-2xl font-semibold">Access Denied</h1>
      <p className="text-muted-foreground max-w-md">
        You don&apos;t have permission to view this page. Contact your administrator if you believe this is an error.
      </p>
      <Link href="/" className={buttonVariants()}>
        Go to Dashboard
      </Link>
    </div>
  );
}
