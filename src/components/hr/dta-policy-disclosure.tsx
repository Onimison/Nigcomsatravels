import { formatNGN } from '@/lib/utils/formatting'
import type { PolicyDefaults } from '@/lib/utils/policy-calculator'
import type { GradeBand } from '@/types/database'

/** Collapsed, read-only DTA reference for HR's costing checks. */
export function DtaPolicyDisclosure({ gradeBands, policyDefaults }: { gradeBands: GradeBand[]; policyDefaults: PolicyDefaults }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-6 py-4 text-sm font-semibold text-gray-900 marker:hidden dark:text-gray-50">
        <span>View DTA policy reference</span>
        <span className="text-xs font-normal text-gray-500">Rates used by the calculator ▾</span>
      </summary>
      <div className="border-t border-gray-100 px-6 pb-6 pt-4 dark:border-gray-800">
        <p className="text-xs text-gray-500">DTA is calculated per traveller and per travel day. The destination determines whether the 100% or 75% policy rate applies.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-400">
              <tr>
                <th className="pb-2 pr-4 font-semibold">Band</th>
                <th className="pb-2 pr-4 font-semibold">100% DTA / day</th>
                <th className="pb-2 font-semibold">75% DTA / day</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {gradeBands.map((band) => (
                <tr key={band.id}>
                  <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-50">{band.code} · {band.label}</td>
                  <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatNGN(band.dta_per_day_100)}</td>
                  <td className="py-2 text-gray-700 dark:text-gray-300">{formatNGN(band.dta_per_day_75)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 text-xs text-gray-500 sm:grid-cols-3">
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Air transport:</span> {formatNGN(policyDefaults.transportAirEachWay)} each way</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Road transport:</span> {formatNGN(policyDefaults.transportRoadEachWay)} each way</p>
          <p><span className="font-medium text-gray-700 dark:text-gray-300">Airport taxi:</span> {formatNGN(policyDefaults.airportTaxiPerLeg)} per leg</p>
        </div>
      </div>
    </details>
  )
}
