'use client';
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, X, Clock, CreditCard } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { api } from '@/lib/api';
import { formatKes } from '@optex/ui';
import type { AdminCancellationRequest } from '@optex/api-client';

/**
 * Cancellation requests — SPEC-06 R3.
 *
 * The client chose a request/approval workflow, not self-service: the customer
 * asks, an admin decides. This screen is where that decision is made, so each
 * row carries what the decision depends on — whether the money has been taken,
 * how far into fulfilment the order is, and whether it moved while the request
 * was waiting.
 *
 * Approving a paid order requires an explicit acknowledgement (R5). Client
 * policy is "no refunds", so cancelling a paid order has a financial
 * consequence someone has to own; the API refuses to infer that consent and
 * this dialog makes it a deliberate act rather than a second click.
 */

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  declined: 'bg-gray-100 text-gray-600',
};

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Cancellations() {
  const [requests, setRequests] = useState<AdminCancellationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('pending');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [declining, setDeclining] = useState<AdminCancellationRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [approvingPaid, setApprovingPaid] = useState<AdminCancellationRequest | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    setError('');
    try {
      setRequests(await api.admin.cancellations.list(status === 'all' ? undefined : status));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load cancellation requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function approve(req: AdminCancellationRequest, acknowledgePaid = false) {
    setBusyId(req.id);
    setError('');
    try {
      await api.admin.cancellations.approve(req.id, acknowledgePaid);
      setApprovingPaid(null);
      await load(tab);
    } catch (e) {
      // The API returns a specific, readable reason — a paid order needing
      // acknowledgement, or a request already decided. Show it rather than a
      // generic failure.
      setError(e instanceof Error ? e.message : 'Could not approve that request.');
    } finally {
      setBusyId(null);
    }
  }

  async function decline() {
    if (!declining) return;
    setBusyId(declining.id);
    setError('');
    try {
      await api.admin.cancellations.decline(declining.id, declineReason.trim() || undefined);
      setDeclining(null);
      setDeclineReason('');
      await load(tab);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decline that request.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cancellation requests</h1>
        <p className="text-muted-foreground text-sm">
          Customers request; you decide. Approving cancels the order — it never refunds.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6 space-y-4">
          {loading ? (
            [1, 2, 3].map((n) => <Skeleton key={n} className="h-36 w-full rounded-lg" />)
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-12 text-center text-sm">
                {tab === 'pending' ? 'No requests waiting on a decision.' : `No ${tab} requests.`}
              </CardContent>
            </Card>
          ) : (
            requests.map((req) => (
              <Card key={req.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {req.orderNumber ?? 'Order'}{' '}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[req.status] ?? ''}`}
                        >
                          {req.status}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {req.customerName ?? 'Customer'}
                        {req.customerEmail ? ` · ${req.customerEmail}` : ''}
                        {req.customerPhone ? ` · ${req.customerPhone}` : ''}
                      </CardDescription>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="h-3.5 w-3.5" />
                      {timeAgo(req.created_at)}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded bg-gray-100 px-2 py-1">
                      Stage: <strong>{req.orderStatus ?? '—'}</strong>
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded px-2 py-1 ${
                        req.paymentStatus === 'paid' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100'
                      }`}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      {req.paymentStatus ?? '—'}
                    </span>
                    {req.totalKes != null && (
                      <span className="rounded bg-gray-100 px-2 py-1">
                        {formatKes(Number(req.totalKes))}
                      </span>
                    )}
                  </div>

                  {/* R3: the order moved on while the request waited. */}
                  {req.movedSinceRequest && req.status === 'pending' && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        This order moved to <strong>{req.orderStatus}</strong> after the request was
                        made (it was <strong>{req.status_at_request}</strong> at the time). Check
                        before approving.
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="text-muted-foreground text-xs font-medium uppercase">Reason</p>
                    <p className="text-sm">{req.reason || 'No reason given.'}</p>
                  </div>

                  {req.status === 'declined' && req.decline_reason && (
                    <div>
                      <p className="text-muted-foreground text-xs font-medium uppercase">
                        Declined because
                      </p>
                      <p className="text-sm">{req.decline_reason}</p>
                    </div>
                  )}

                  {req.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        disabled={busyId === req.id}
                        onClick={() =>
                          req.paymentStatus === 'paid' ? setApprovingPaid(req) : approve(req)
                        }
                      >
                        <Check className="mr-1 h-4 w-4" />
                        Approve &amp; cancel order
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === req.id}
                        onClick={() => {
                          setDeclining(req);
                          setDeclineReason('');
                        }}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* R5 — cancelling a paid order is a deliberate act, not a second click. */}
      <Dialog open={!!approvingPaid} onOpenChange={(o) => !o && setApprovingPaid(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This order has been paid</DialogTitle>
            <DialogDescription>
              Cancelling {approvingPaid?.orderNumber} does <strong>not</strong> refund the customer
              — Optex policy is no automatic refunds, and nothing here contacts M-Pesa or Pesapal.
              If money is to go back, you must arrange it yourself.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setApprovingPaid(null)}>
              Cancel
            </Button>
            <Button
              disabled={busyId === approvingPaid?.id}
              onClick={() => approvingPaid && approve(approvingPaid, true)}
            >
              I understand — cancel the order
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!declining} onOpenChange={(o) => !o && setDeclining(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline this request</DialogTitle>
            <DialogDescription>
              The order keeps its current status. Your reason is shown to the customer, so write it
              for them.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="e.g. The frames have already been picked and packed."
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button disabled={busyId === declining?.id} onClick={decline}>
              Decline request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
