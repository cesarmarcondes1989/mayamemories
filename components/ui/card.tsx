import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-line bg-paper shadow-[var(--shadow-soft)]", className)}
      {...props}
    />
  );
}
