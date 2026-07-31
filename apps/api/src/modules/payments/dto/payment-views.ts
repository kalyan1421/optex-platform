/**
 * Response shapes returned by the PAYMENTS module. Plain interfaces (output
 * only, never validated), mirroring the orders module's `*View` convention.
 * camelCase at the API boundary; snake_case stays in the DB.
 */

/** Result of initiating an M-Pesa STK push. */
export interface MpesaStkPushResult {
  checkoutRequestId: string;
  merchantRequestId: string | null;
  message: string;
}

/** Resolved status of an M-Pesa STK push (from a query or stored transaction). */
export interface MpesaStatusView {
  checkoutRequestId: string;
  resultCode: number | null;
  resultDesc: string | null;
  /** Local transaction status (pending | matched | failed | reversed). */
  status: string;
  orderId: string | null;
  paid: boolean;
}

/** Result of initiating a Pesapal payment. */
export interface PesapalInitiateResult {
  orderTrackingId: string;
  redirectUrl: string;
  message: string;
}

/** Resolved Pesapal transaction status. */
export interface PesapalStatusView {
  orderTrackingId: string;
  paymentStatusDescription: string | null;
  statusCode: number | null;
  /** Local transaction status (pending | matched | failed | reversed). */
  status: string;
  orderId: string | null;
  paid: boolean;
}

/** A unified payment-transaction row for the admin list. */
export interface AdminPaymentView {
  id: string;
  provider: 'mpesa' | 'pesapal';
  /** Provider reference: M-Pesa receipt / CheckoutRequestID, or Pesapal tracking id. */
  reference: string;
  amountKes: number | null;
  status: string;
  orderId: string | null;
  orderNumber: string | null;
  customerPhone: string | null;
  method: string | null;
  receivedAt: string;
}

/** Generic paginated envelope (matches the orders module's shape). */
export interface PaginatedPayments<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** Result of an admin reconcile action. */
export interface ReconcileResult {
  provider: 'mpesa' | 'pesapal';
  transactionId: string;
  previousStatus: string;
  status: string;
  orderId: string | null;
  orderMarkedPaid: boolean;
  changed: boolean;
  detail: string;
}
