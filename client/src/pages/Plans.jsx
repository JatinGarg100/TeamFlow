import { useState, useEffect } from 'react';
import { fetchPlansApi, fetchUsageApi } from '../services/api';

/**
 * Plans page
 * ──────────
 * Displays dynamic subscription tiers and live database resource usage.
 * Explicitly states student project boundaries without pretending fake transactions occurred.
 */
function Plans() {
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalMessage, setModalMessage] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadPlansAndUsage() {
      try {
        setLoading(true);
        setError(null);
        const [plansRes, usageRes] = await Promise.allSettled([
          fetchPlansApi(),
          fetchUsageApi(),
        ]);

        if (!isMounted) return;

        if (plansRes.status === 'fulfilled' && plansRes.value?.plans) {
          setPlans(plansRes.value.plans);
          setCurrentPlan(plansRes.value.currentPlan || 'free');
        } else {
          const errMsg = plansRes.status === 'rejected' ? plansRes.reason?.message : 'Failed to fetch plans';
          setError(errMsg);
        }

        if (usageRes.status === 'fulfilled' && usageRes.value?.usage) {
          setUsageData(usageRes.value);
        }
      } catch (err) {
        if (isMounted) setError(err.message || 'Error connecting to subscription service');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadPlansAndUsage();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleActionClick = (plan) => {
    if (plan.id === currentPlan) {
      setModalMessage({
        title: 'Current Active Tier',
        text: `Your organisation is currently subscribed to the ${plan.name} plan. All included feature quotas are active.`,
        type: 'info',
      });
    } else {
      setModalMessage({
        title: 'Billing Integration Information',
        text: `Upgrade to "${plan.name}" requested. In this academic prototype, actual third-party payment gateways (such as Stripe or Razorpay) are not connected, and mock transactions are intentionally omitted to avoid misleading evaluation.`,
        type: 'notice',
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-[#1E202A] sm:text-3xl">
          Subscription Plans & Resource Usage
        </h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Transparent feature quotas and live MongoDB resource tallies for your organisation.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* ── Pricing Cards Grid ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
        {plans.map((plan) => {
          const isCurrent = currentPlan.toLowerCase() === plan.id.toLowerCase();
          const isPro = plan.recommended || plan.id === 'pro';

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col justify-between rounded-2xl bg-white p-7 transition-all duration-150 ${
                isCurrent
                  ? 'border-2 border-[#5B4BDB] shadow-md ring-1 ring-[#5B4BDB]/20'
                  : 'border border-[#E2E8F0] shadow-xs hover:border-[#CBD5E1]'
              }`}
            >
              {/* Current plan / Recommended badge */}
              {isCurrent ? (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-[#5B4BDB] px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-xs">
                  Current Plan
                </span>
              ) : isPro ? (
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-800 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-xs">
                  Recommended
                </span>
              ) : null}

              <div>
                {/* Header */}
                <div className="text-center pb-6 border-b border-[#F1F5F9]">
                  <h2 className="text-lg font-bold text-[#1E202A]">{plan.name}</h2>
                  <div className="mt-3 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-[#1E202A]">
                      {plan.priceLabel || (plan.price === 0 ? 'Free' : `$${plan.price}`)}
                    </span>
                    {plan.period && plan.price > 0 && (
                      <span className="text-xs text-[#64748B]">/{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[#64748B]">
                    {plan.description || (plan.id === 'free' ? 'Great for small teams & evaluation' : 'For growing companies needing full power')}
                  </p>
                </div>

                {/* Features List */}
                <ul className="mt-6 space-y-3">
                  {plan.features?.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-[#1E202A]">
                      <svg className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span>{feature}</span>
                    </li>
                  ))}
                  {plan.limitations?.map((lim, idx) => (
                    <li key={`lim-${idx}`} className="flex items-start gap-2.5 text-xs text-gray-400">
                      <svg className="h-4 w-4 shrink-0 text-gray-300 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>{lim}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => handleActionClick(plan)}
                  className={`w-full py-2.5 px-4 text-xs font-semibold rounded-xl transition-all duration-150 ${
                    isCurrent
                      ? 'bg-[#EEEDFD] text-[#5B4BDB] border border-[#DCD9FA] cursor-pointer hover:bg-[#E5E2FC]'
                      : isPro
                      ? 'bg-[#5B4BDB] text-white hover:bg-[#4A3ABF] shadow-xs cursor-pointer'
                      : 'border border-[#5B4BDB] text-[#5B4BDB] hover:bg-[#EEEDFD] cursor-pointer'
                  }`}
                >
                  {isCurrent ? '✓ Active Plan' : isPro ? 'Upgrade to Pro' : 'Switch to Free'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Resource Usage Section ── */}
      {usageData && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F1F5F9] pb-4">
            <div>
              <h3 className="text-base font-semibold text-[#1E202A]">Current Organisation Resource Usage</h3>
              <p className="text-xs text-[#64748B]">Real-time database counts compared to your current tier limits</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 self-start sm:self-auto">
              Preliminary Live Tracking
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Members Usage */}
            {usageData.usage?.members && (
              <div className="rounded-lg bg-gray-50/70 p-4 border border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1E202A]">{usageData.usage.members.label}</span>
                  <span className="text-[#64748B]">
                    {usageData.usage.members.used} / {usageData.usage.members.limit}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#5B4BDB]"
                    style={{
                      width: `${Math.min(
                        100,
                        (usageData.usage.members.used / (usageData.usage.members.limit || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Projects Usage */}
            {usageData.usage?.projects && (
              <div className="rounded-lg bg-gray-50/70 p-4 border border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1E202A]">{usageData.usage.projects.label}</span>
                  <span className="text-[#64748B]">
                    {usageData.usage.projects.used} / {usageData.usage.projects.limit}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (usageData.usage.projects.used / (usageData.usage.projects.limit || 1)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Tasks Usage */}
            {usageData.usage?.tasks && (
              <div className="rounded-lg bg-gray-50/70 p-4 border border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-[#1E202A]">{usageData.usage.tasks.label}</span>
                  <span className="text-[#64748B]">
                    {usageData.usage.tasks.used} / {usageData.usage.tasks.limit}
                  </span>
                </div>
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: '100%' }} />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg bg-blue-50/60 p-3 text-xs text-blue-700 border border-blue-100 flex items-start gap-2">
            <svg className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span>
              {usageData.notice ||
                'Usage tracking is preliminary and derived directly from active records in MongoDB. Periodic billing metering will be integrated in future phases.'}
            </span>
          </div>
        </div>
      )}

      {/* ── Informational Notice Modal ── */}
      {modalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEEDFD] text-[#5B4BDB]">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E202A]">{modalMessage.title}</h3>
                <p className="text-xs text-[#64748B]">Prototype System Notice</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-[#475569] leading-relaxed">
              {modalMessage.text}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setModalMessage(null)}
                className="btn-primary text-xs py-2 px-4"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Plans;
