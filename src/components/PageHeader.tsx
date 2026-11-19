import type { ReactNode } from 'react';

export function PageHeader({
  title,
  lead,
  children,
}: {
  title: string;
  lead: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      <p className="max-w-3xl text-slate-600 dark:text-slate-400">{lead}</p>
      {children}
    </div>
  );
}
