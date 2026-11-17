/**
 * StatCard
 * ────────
 * KPI metric card for the Dashboard.
 * Props:
 * - title: Metric title (e.g. "Total Employees")
 * - value: Numeric or text counter
 * - icon: SVG or icon element
 * - colorTheme: 'purple' | 'blue' | 'emerald' | 'amber' for subtle tinted icon background
 */
function StatCard({ title, value, icon, colorTheme = 'purple' }) {
  // Coordinated subtle tints for modern SaaS dashboards
  const themeStyles = {
    purple: {
      bg: 'bg-[#EEEDFD]',
      text: 'text-[#5B4BDB]',
    },
    blue: {
      bg: 'bg-blue-50',
      text: 'text-blue-600',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
    },
  };

  const currentTheme = themeStyles[colorTheme] || themeStyles.purple;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition-all duration-150 hover:shadow-sm hover:border-[#CBD5E1]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#64748B]">
          {title}
        </p>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${currentTheme.bg} ${currentTheme.text}`}>
          {icon}
        </div>
      </div>

      <div className="mt-4">
        <span className="text-3xl font-bold tracking-tight text-[#1E202A]">
          {value}
        </span>
      </div>
    </div>
  );
}

export default StatCard;
