import { PartialType } from '@nestjs/swagger';
import { CreateBranchDto } from './create-branch.dto';

/**
 * Body for `PATCH /branches/:id` (super_admin only). Every field of
 * `CreateBranchDto` is optional; only the keys present are updated. Unknown keys
 * are stripped by the global `whitelist` validation pipe.
 */
export class UpdateBranchDto extends PartialType(CreateBranchDto) {}
