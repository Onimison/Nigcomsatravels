'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/utils/auth-guard'
import { parseCostingMemoPayload } from '@/lib/erp/costing-memo'
import type { ErpExportPayload } from '@/types/database'
import { z } from 'zod'

export interface CostingMemoResult {
  success: boolean
  data: ErpExportPayload | null
  error?: string
}

export interface ManualHandoff {
  id: string
  export_id: string
  erp_company_id: string
  erp_costing_memo_number: string
  erp_workflow_reference: string
  recorded_by: string
  recorded_at: string
}

export interface ManualHandoffResult {
  success: boolean
  data: ManualHandoff | null
  error?: string
}

const manualHandoffSchema = z.object({
  export_id: z.string().uuid(),
  erp_company_id: z.string().trim().min(1).max(120),
  erp_costing_memo_number: z.string().trim().min(1).max(120),
  erp_workflow_reference: z.string().trim().min(1).max(160),
})

const manualHandoffRowSchema = z.object({
  id: z.string().uuid(),
  export_id: z.string().uuid(),
  erp_company_id: z.string(),
  erp_costing_memo_number: z.string(),
  erp_workflow_reference: z.string(),
  recorded_by: z.string().uuid(),
  recorded_at: z.string(),
})

/** Load the immutable HR costing snapshot for authorized HR/admin document actions. */
export async function getHrCostingMemo(exportId: string): Promise<CostingMemoResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, data: null, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('erp_exports')
    .select('payload')
    .eq('id', exportId)
    .maybeSingle()

  if (error) return { success: false, data: null, error: 'The finalized costing could not be loaded' }
  if (!data) return { success: false, data: null, error: 'Finalized costing not found' }

  const payload = parseCostingMemoPayload(data.payload)
  if (!payload) return { success: false, data: null, error: 'The finalized costing payload is invalid' }

  return { success: true, data: payload }
}

export async function getManualErpHandoff(exportId: string): Promise<ManualHandoffResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, data: null, error: auth.error }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('erp_manual_handoffs')
    .select('id, export_id, erp_company_id, erp_costing_memo_number, erp_workflow_reference, recorded_by, recorded_at')
    .eq('export_id', exportId)
    .maybeSingle()

  if (error) return { success: false, data: null, error: 'The ERP handoff could not be loaded' }
  if (!data) return { success: true, data: null }
  const parsed = manualHandoffRowSchema.safeParse(data)
  if (!parsed.success) return { success: false, data: null, error: 'The ERP handoff has an invalid shape' }
  return { success: true, data: parsed.data }
}

export async function recordManualErpHandoff(input: {
  export_id: string
  erp_company_id: string
  erp_costing_memo_number: string
  erp_workflow_reference: string
}): Promise<ManualHandoffResult> {
  const auth = await requireRole('hr', 'admin')
  if (!auth.authorized) return { success: false, data: null, error: auth.error }

  const parsed = manualHandoffSchema.safeParse(input)
  if (!parsed.success) return { success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid ERP handoff details' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, data: null, error: 'Not authenticated' }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('record_manual_erp_handoff', {
    p_export_id: parsed.data.export_id,
    p_staff_id: user.id,
    p_erp_company_id: parsed.data.erp_company_id,
    p_erp_costing_memo_number: parsed.data.erp_costing_memo_number,
    p_erp_workflow_reference: parsed.data.erp_workflow_reference,
  })

  if (error) {
    if (error.code === '42501') return { success: false, data: null, error: 'You are not authorized to record an ERP handoff' }
    if (error.code === 'P0009') return { success: false, data: null, error: 'This costing already has a conflicting ERP handoff' }
    return { success: false, data: null, error: 'The ERP handoff could not be recorded' }
  }

  const parsedResult = z.object({
    export_id: z.string().uuid(),
    erp_company_id: z.string(),
    erp_costing_memo_number: z.string(),
    erp_workflow_reference: z.string(),
    recorded_at: z.string(),
  }).safeParse(data)
  if (!parsedResult.success) return { success: false, data: null, error: 'ERP returned an invalid handoff result' }

  return {
    success: true,
    data: {
      id: parsed.data.export_id,
      export_id: parsedResult.data.export_id,
      erp_company_id: parsedResult.data.erp_company_id,
      erp_costing_memo_number: parsedResult.data.erp_costing_memo_number,
      erp_workflow_reference: parsedResult.data.erp_workflow_reference,
      recorded_by: user.id,
      recorded_at: parsedResult.data.recorded_at,
    },
  }
}
