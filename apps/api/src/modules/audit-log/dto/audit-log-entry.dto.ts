import { ApiProperty } from '@nestjs/swagger';

/** An `audit_log` row. `before`/`after`/`metadata` are opaque JSON — shape varies by `action`. */
export class AuditLogEntryDto {
  @ApiProperty({ description: 'Audit entry id (uuid).', format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'The auth.users id of who performed the action.', format: 'uuid' })
  actor_user_id!: string;

  @ApiProperty({ description: "The actor's role AT THE TIME of the action." })
  actor_role!: string;

  @ApiProperty({ description: "The action, e.g. 'staff.create', 'orders.status_change'." })
  action!: string;

  @ApiProperty({ description: "The mutated resource's table, e.g. 'staff_users'." })
  resource_type!: string;

  @ApiProperty({ description: 'The mutated resource id.', nullable: true })
  resource_id!: string | null;

  @ApiProperty({
    description: "The actor's branch AT THE TIME of the action, when they were branch-scoped.",
    nullable: true,
  })
  branch_id!: string | null;

  @ApiProperty({
    description: 'Resource state before the mutation, when captured.',
    nullable: true,
  })
  before!: unknown;

  @ApiProperty({ description: 'Resource state after the mutation, when captured.', nullable: true })
  after!: unknown;

  @ApiProperty({ description: 'Any extra context (e.g. a reason string).', nullable: true })
  metadata!: unknown;

  @ApiProperty({ description: 'When this entry was recorded (ISO 8601).' })
  created_at!: string;
}

/** Paginated envelope for `GET /admin/audit-log`. Mirrors `PaginatedOrders`. */
export interface PaginatedAuditLog {
  data: AuditLogEntryDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
