import { PartialType } from '@nestjs/swagger';
import { CreateAddressDto } from './create-address.dto';

/**
 * Body for `PATCH /addresses/:id`. Every field of `CreateAddressDto` is
 * optional; only the keys present are updated. Unknown keys are stripped by
 * the global `whitelist` validation pipe.
 */
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
