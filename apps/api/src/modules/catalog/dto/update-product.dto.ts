import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/**
 * Payload for updating a product (admin only). Every field is optional;
 * only provided fields are changed.
 */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
