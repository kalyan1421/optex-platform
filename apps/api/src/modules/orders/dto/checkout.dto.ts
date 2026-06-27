import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ShippingAddressDto } from './shipping-address.dto';

/**
 * Payment methods accepted at checkout. Mirrors the `payment_method` Postgres
 * enum (`mpesa | pesapal | cod`).
 */
export enum CheckoutPaymentMethod {
  COD = 'cod',
  MPESA = 'mpesa',
  PESAPAL = 'pesapal',
}

/**
 * Delivery options. `delivery` adds a shipping fee; `pickup` (collect from a
 * branch) is free. Defaults to `delivery` when omitted.
 */
export enum CheckoutDeliveryOption {
  DELIVERY = 'delivery',
  PICKUP = 'pickup',
}

/**
 * Body for `POST /checkout`.
 *
 * SECURITY (S-1 fix): this DTO deliberately accepts NO monetary fields, no
 * `status`, and no `payment_status`. Every amount and state is recomputed
 * server-side from `products` + `promo_codes`; nothing about price or payment
 * standing is ever trusted from the client. `whitelist: true` on the global
 * ValidationPipe strips any extra properties (e.g. an injected `total_kes`).
 */
export class CheckoutDto {
  @ApiProperty({
    enum: CheckoutPaymentMethod,
    description: 'How the order will be paid for',
    example: CheckoutPaymentMethod.MPESA,
  })
  @IsEnum(CheckoutPaymentMethod)
  paymentMethod!: CheckoutPaymentMethod;

  @ApiProperty({ type: ShippingAddressDto, description: 'Delivery address' })
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress!: ShippingAddressDto;

  @ApiPropertyOptional({
    enum: CheckoutDeliveryOption,
    description: 'Delivery vs. branch pickup (defaults to delivery)',
    default: CheckoutDeliveryOption.DELIVERY,
  })
  @IsEnum(CheckoutDeliveryOption)
  @IsOptional()
  deliveryOption?: CheckoutDeliveryOption;

  @ApiPropertyOptional({
    description: 'Promo code to apply (validated and re-priced server-side)',
    example: 'WELCOME10',
  })
  @IsString()
  @IsOptional()
  @MaxLength(64)
  promoCode?: string;
}
