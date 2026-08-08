export enum MovementReason {
  Sale = 'sale',
  Restock = 'restock',
  Adjustment = 'adjustment',
  Return = 'return',
  Damage = 'damage',
}

export const MOVEMENT_REASONS = Object.values(MovementReason)

// Reasons that a user can submit via POST /inventory/movements.
// 'sale' is deliberately excluded; sales are recorded by the checkout flow.
export const USER_SUBMITTABLE_REASONS: MovementReason[] = [
  MovementReason.Restock,
  MovementReason.Adjustment,
  MovementReason.Return,
  MovementReason.Damage,
]
