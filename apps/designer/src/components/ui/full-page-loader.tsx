import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type FullPageLoaderProps = {
  className?: string;
  description?: string;
  height?: "screen" | "content";
  spinnerClassName?: string;
  title?: string;
};

export function FullPageLoader({
  className,
  description,
  height = "screen",
  spinnerClassName,
  title = "Loading…",
}: FullPageLoaderProps) {
  return (
    <div
      className={cn(
        height === "content" ? "min-h-[calc(100vh-4rem)]" : "min-h-screen",
        "bg-transparent flex items-center justify-center px-4 py-10",
        className,
      )}
    >
      <div className="text-center">
        <Spinner className={cn("h-8 w-8 mx-auto text-muted-foreground", spinnerClassName)} />
        <p className="mt-4 text-sm text-muted-foreground">{title}</p>
        {description ? (
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
