// Pequenos traços desenhados à mão (coração, brilho, divisor). Decorativos.

export function HeartDoodle({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 44" className={className} fill="none" aria-hidden="true">
      <path
        d="M24 40C14 33 5 26 4.5 16.5 4.2 10 8.8 5 14.6 5c4.3 0 7.4 2.6 9.4 6.2C26 7.6 29.1 5 33.4 5 39.2 5 43.8 10 43.5 16.5 43 26 34 33 24 40Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SparkleDoodle({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden="true">
      <path d="M8 22 3 26M14 12 11 4M24 10l6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function HeartDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 text-rose ${className}`} aria-hidden="true">
      <span className="h-px flex-1 bg-current" />
      <svg viewBox="0 0 24 22" className="size-4 text-rose-deep" fill="currentColor">
        <path d="M12 21C6.5 17 1 13 1 7.6 1 4 3.6 1.5 6.8 1.5c2.2 0 4 1.3 5.2 3.2C13.2 2.8 15 1.5 17.2 1.5 20.4 1.5 23 4 23 7.6 23 13 17.5 17 12 21Z" />
      </svg>
      <span className="h-px flex-1 bg-current" />
    </div>
  );
}
