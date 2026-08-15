import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { AuthUser } from '../../auth/auth-user';
import { CurrentUser } from '../../auth/decorators';
import { AddressesService, AddressRow } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

/**
 * Customer-facing saved-address endpoints. Mounted at `/api/addresses`
 * (global `api` prefix applied in `main.ts`). All routes require a valid
 * JWT (global guard); every operation is scoped to the caller's own
 * customer row.
 */
@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's own saved addresses" })
  @ApiOkResponse({ description: 'The caller’s addresses, default first' })
  listMine(@CurrentUser() user: AuthUser): Promise<AddressRow[]> {
    return this.addresses.listMine(user);
  }

  @Post()
  @ApiOperation({ summary: 'Save a new address' })
  @ApiCreatedResponse({ description: 'The created address' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateAddressDto): Promise<AddressRow> {
    return this.addresses.create(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Update one of the caller's own addresses" })
  @ApiOkResponse({ description: 'The updated address' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressRow> {
    return this.addresses.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: "Delete one of the caller's own addresses" })
  @ApiOkResponse({ description: 'The deleted address id' })
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<{ id: string }> {
    return this.addresses.remove(user, id);
  }

  @Post(':id/default')
  @ApiOperation({ summary: 'Mark one of the caller’s own addresses as the default' })
  @ApiOkResponse({ description: 'The now-default address' })
  setDefault(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<AddressRow> {
    return this.addresses.setDefault(user, id);
  }
}
