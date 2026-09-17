/**
 * Standard Server Action result shape, shared by every mutating and
 * read action across the app (staff/departments/levels/rates/requests/
 * auth). One definition — each `lib/actions/*.actions.ts` file used to
 * declare its own byte-identical copy of `{ success, error? }`.
 */
export interface ActionResult<T = void> {
  success: boolean
  error?: string
  data?: T
}
