import { formatNGN } from '@/lib/utils/formatting'
import type { PolicyDefaults } from '@/lib/utils/policy-calculator'
import type { GradeBand } from '@/types/database'

interface DtaPolicyReferenceProps {
  gradeBands: GradeBand[]
  policyDefaults: PolicyDefaults
  compact?: boolean
  showHeader?: boolean
}

function DtaBandRow({ band }: { band: GradeBand }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-b border-gray-100 py-3 last:border-b-0 dark:border-gray-800">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-50">{band.code}</p>
        <p className="truncate text-xs text-gray-500">{band.label}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{formatNGN(band.dta_per_day_100)}</p>
        <p className="text-[11px] text-gray-400">DTA / day @100%</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-50">{formatNGN(band.dta_per_day_75)}</p>
        <p className="text-[11px] text-gray-400">DTA / day @75%</p>
      </div>
    </div>
  )
}

function DefaultCost({ label, amount, detail }: { label: string; amount: number; detail: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/60">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-50">{formatNGN(amount)}</p>
      <p className="text-[11px] text-gray-400">{detail}</p>
    </div>
  )
}

export function DtaPolicyReference({
  gradeBands,
  policyDefaults,
  compact = false,
  showHeader = true,
}: DtaPolicyReferenceProps) {
  const bands = [...gradeBands].sort((left, right) => left.code.localeCompare(right.code))

  return (
    <div className={compact ? '' : 'rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'}>
      {!compact && showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-50">DTA Policy Reference</h2>
            <p className="mt-1 text-sm text-gray-500">
              Current DTA amounts used in the staff preview and HR costing review.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
            DTA only
          </span>
        </div>
      )}

      {bands.length === 0 ? (
        <p className="mt-5 text-sm text-gray-500">No DTA grade bands have been configured yet.</p>
      ) : (
        <div className="mt-5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-gray-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-800">
            <span>Grade band</span>
            <span className="text-right">Full rate</span>
            <span className="text-right">Standard rate</span>
          </div>
          {bands.map((band) => <DtaBandRow key={band.id} band={band} />)}
        </div>
      )}

      {!compact && (
        <>
          <div className="mt-6 border-t border-gray-100 pt-5 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Costing defaults</h3>
            <p className="mt-1 text-xs text-gray-500">Transport and airport taxi are added separately during costing.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <DefaultCost label="Air transport" amount={policyDefaults.transportAirEachWay} detail="each way" />
              <DefaultCost label="Road transport" amount={policyDefaults.transportRoadEachWay} detail="each way" />
              <DefaultCost label="Airport taxi" amount={policyDefaults.airportTaxiPerLeg} detail="per leg" />
            </div>
          </div>
          <p className="mt-5 text-xs leading-5 text-gray-500">
            The traveller&apos;s assigned designation determines the DTA band. The destination policy selects the applicable rate, and HR can review the final costing before it is frozen for the memo.
          </p>
        </>
      )}
    </div>
  )
}
