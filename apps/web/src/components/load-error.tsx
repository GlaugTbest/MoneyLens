'use client';

export function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning-foreground">
      <p>Não foi possível carregar os dados. {message}</p>
      <button onClick={retry} className="mt-2 min-h-11 font-medium underline underline-offset-4">
        Tentar novamente
      </button>
    </div>
  );
}
