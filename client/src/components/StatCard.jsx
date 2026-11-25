/**
 * StatCard
 * ────────
 * Premium KPI metric card for the Dashboard.
 * Props:
 * - title: Metric title (e.g. "Total Employees")
 * - value: Numeric or text counter
 * - icon: SVG or icon element
 * - colorTheme: 'blue' | 'emerald' | 'amber' | 'indigo' | 'rose' | 'slate'
 * - subtitle: Optional helper text or trend badge
 */
function StatCard({ title, value, icon, colorTheme = 'blue', subtitle = null }) {
  const themeStyles = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/60',
      text: 'text-blue-600 dark:text-blue-400',
      border: 'group-hover:border-blue-200 dark:group-hover:border-blue-800',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'group-hover:border-emerald-200 dark:group-hover:border-emerald-800',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/60',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'group-hover:border-amber-200 dark:group-hover:border-amber-800',
    },
    indigo: {
      bg: 'bg-indigo-50 dark:bg-indigo-950/60',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'group-hover:border-indigo-200 dark:group-hover:border-indigo-800',
    },
    rose: {
      bg: 'bg-rose-50 dark:bg-rose-950/60',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'group-hover:border-rose-200 dark:group-hover:border-rose-800',
    },
    slate: {
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-600 dark:text-slate-300',
      border: 'group-hover:border-slate-200 dark:group-hover:border-slate-700',
    },
  };

  const currentTheme = themeStyles[colorTheme] || themeStyles.blue;

  return (
    <div className={`group flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-xs transition-all duration-200 hover:shadow-sm ${currentTheme.border}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </p>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${currentTheme.bg} ${currentTheme.text} transition-transform duration-200 group-hover:scale-105`}>
          {icon}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
          {value}
        </span>
        {subtitle && (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatCard;
