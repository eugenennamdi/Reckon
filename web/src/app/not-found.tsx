import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { ReckonMark } from "@/components/ReckonMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[55dvh] items-center justify-center py-12">
      <Card className="w-full max-w-md space-y-4 p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
          <ReckonMark size={20} />
        </div>
        <div className="font-mono text-xs text-muted-foreground">404</div>
        <div className="space-y-1.5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Route not found
          </h1>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The requested Reckon terminal view does not exist. Return to the live 4-hour forecasting markets.
          </p>
        </div>
        <div className="pt-2">
          <Button asChild size="sm" variant="default">
            <Link href="/">
              <ArrowLeft size={14} />
              Back to markets
            </Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
