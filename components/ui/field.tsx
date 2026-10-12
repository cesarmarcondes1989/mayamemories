import { cn } from "./cn";

const control =
  "w-full rounded-2xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-taupe/60 focus:border-rose-deep focus:outline-none focus:ring-2 focus:ring-rose/40 disabled:opacity-60";

export function Label({ children, htmlFor, optional }: { children: React.ReactNode; htmlFor?: string; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
      {children}
      {optional && <span className="ml-1 font-normal text-taupe">(opcional)</span>}
    </label>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-sm text-taupe">{children}</p>;
}

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-danger">
      {children}
    </p>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-36 leading-relaxed", className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-12 appearance-none bg-[length:16px] pr-10", className)} {...props} />;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} optional={optional}>
        {label}
      </Label>
      {children}
      {hint && !error && <Hint>{hint}</Hint>}
      <FieldError>{error}</FieldError>
    </div>
  );
}

export function Checkbox({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-paper p-4 has-[:checked]:border-rose-deep/50 has-[:checked]:bg-rose-soft/50">
      <input type="checkbox" className="mt-1 size-5 accent-[var(--rose-deep)]" {...props} />
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {hint && <span className="mt-0.5 block text-sm text-taupe">{hint}</span>}
      </span>
    </label>
  );
}
