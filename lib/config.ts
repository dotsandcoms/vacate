// Tunable business assumptions — surfaced in the UI wherever they're used,
// so nobody mistakes an estimate for a fact.
export const config = {
  /** Average cost of one working day of leave, in Rand.
   *  Placeholder until real salary data is imported from payroll. */
  avgDailyCostR: 1_400,

  /** How many people out on the same day counts as a coverage clash.
   *  Will become per-department once departments exist on the form. */
  clashThreshold: 2,

  /** Warn when annual balance is at or below this many days. */
  lowBalanceDays: 3,

  /** Flag approvals waiting longer than this many days. */
  approvalAgingDays: 3,

  /** BCEA: sick note required for more than this many consecutive days. */
  sickNoteAfterDays: 2,

  /** Leave cycle: month the annual cycle starts (1 = January). */
  cycleStartMonth: 1,

  /** BCEA annual accrual: 15 working days / 12 months. */
  annualAccrualPerMonth: 1.25,

  /**
   * Default Excel cutover when an employee has openings but no as-of date.
   * Prefer the last fully closed month before go-live.
   */
  excelBaselineAsOf: "2026-06-30",
};
