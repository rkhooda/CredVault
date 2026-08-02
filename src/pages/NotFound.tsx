import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { LogoMark } from "@/components/Logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.warn("404: no route for", location.pathname);
  }, [location.pathname]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-lg flex-col justify-center px-4 py-16 sm:px-6">
      <LogoMark className="h-7 w-7 text-muted-foreground" />

      <p className="mt-6 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page is not on file</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        No route matches{" "}
        <code className="break-all rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
          {location.pathname}
        </code>
        . Credentials are looked up by holder and document hash, never by URL — so if you were sent something to check,
        the verifier is where it goes.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link to="/verify">
            <Search className="h-4 w-4" aria-hidden="true" />
            Verify a credential
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back home
          </Link>
        </Button>
      </div>
    </div>
  );
}
