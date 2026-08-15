import { Module } from '@nestjs/common';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

/**
 * ADDRESSES module — a customer's saved address book, offered at checkout
 * as an alternative to retyping the full shipping address every order.
 * Relies on the global `SupabaseModule` (service-role client) and global
 * auth guards.
 */
@Module({
  controllers: [AddressesController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class AddressesModule {}
