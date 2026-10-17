"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="h-11 rounded-full bg-rose-deep px-6 font-semibold text-white">
      🖨️ Imprimir
    </button>
  );
}
