import { Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators';
import {
  CustomerNotificationsService,
  NotificationView,
  PaginatedNotifications,
} from './customer-notifications.service';
import { NotificationQueryDto } from './dto/notification-query.dto';

/**
 * The signed-in customer's own notification feed. Mounted at
 * `/api/notifications` (global `api` prefix applied in `main.ts`). Every
 * route requires a valid JWT (global guard; no `@Public()` here) and is
 * scoped to the caller's own customer row — same trust level as
 * `/api/wishlist` or `/api/cart`, no special permission needed.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class CustomerNotificationsController {
  constructor(private readonly notifications: CustomerNotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's notifications, newest first" })
  @ApiOkResponse({ description: 'Paginated notifications' })
  list(
    @CurrentUser('id') authUserId: string,
    @Query() query: NotificationQueryDto,
  ): Promise<PaginatedNotifications> {
    return this.notifications.listForCustomer(authUserId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: "Count of the caller's unread notifications" })
  @ApiOkResponse({ description: 'Unread count' })
  unreadCount(@CurrentUser('id') authUserId: string): Promise<{ count: number }> {
    return this.notifications.unreadCount(authUserId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one notification read (idempotent)' })
  @ApiOkResponse({ description: 'The updated notification' })
  markRead(
    @CurrentUser('id') authUserId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<NotificationView> {
    return this.notifications.markRead(authUserId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: "Mark all of the caller's unread notifications read" })
  @ApiOkResponse({ description: 'How many were marked read' })
  markAllRead(@CurrentUser('id') authUserId: string): Promise<{ count: number }> {
    return this.notifications.markAllRead(authUserId);
  }
}
