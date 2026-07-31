'use client';
import { useState, useEffect } from 'react';
import { Star, Check, Flag, MessageSquare, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { api } from '@/lib/api';

type ReviewStatus = 'Pending' | 'Approved' | 'Flagged';

interface Review {
  id: string;
  customer: string;
  product: string;
  rating: number;
  body: string;
  date: string;
  status: ReviewStatus;
  adminReply: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'}`}
        />
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<ReviewStatus, string> = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Approved: 'bg-green-100 text-green-700',
  Flagged: 'bg-red-100 text-red-700',
};

export function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | ReviewStatus>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [replyTarget, setReplyTarget] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api.admin.reviews.list();
        const mapped: Review[] = data.map((s) => ({
          id: s.id,
          customer: s.customer_name || 'Anonymous',
          product: s.product_name || '—',
          rating: s.rating,
          body: s.body ?? '',
          date: s.created_at ? s.created_at.split('T')[0] : '',
          status: (s.status.charAt(0).toUpperCase() + s.status.slice(1)) as ReviewStatus,
          adminReply: s.admin_reply || '',
        }));
        setReviews(mapped);
      } catch (e) {
        console.error('Failed to load reviews:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = reviews.filter((r) => {
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const matchSearch =
      r.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.product.toLowerCase().includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  function approve(id: string) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Approved' } : r)));
    void (async () => {
      try {
        await api.admin.reviews.moderate(id, { status: 'approved' });
      } catch (e) {
        console.error('Failed to approve review:', e);
      }
    })();
  }

  function flag(id: string) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'Flagged' } : r)));
    void (async () => {
      try {
        await api.admin.reviews.moderate(id, { status: 'flagged' });
      } catch (e) {
        console.error('Failed to flag review:', e);
      }
    })();
  }

  function submitReply() {
    if (!replyTarget || !replyText.trim()) return;
    const id = replyTarget.id;
    const text = replyText;
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, adminReply: text } : r)));
    setReplyTarget(null);
    setReplyText('');
    void (async () => {
      try {
        await api.admin.reviews.moderate(id, { admin_reply: text });
      } catch (e) {
        console.error('Failed to save reply:', e);
      }
    })();
  }

  const counts = {
    All: reviews.length,
    Pending: reviews.filter((r) => r.status === 'Pending').length,
    Approved: reviews.filter((r) => r.status === 'Approved').length,
    Flagged: reviews.filter((r) => r.status === 'Flagged').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reviews Moderation</h2>
        <p className="mt-1 text-gray-500">Approve, flag, or reply to customer product reviews</p>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {(['All', 'Pending', 'Approved', 'Flagged'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === s
                ? 'bg-[#141776] text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s} ({counts[s]})
          </button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-52 pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-medium">{review.customer}</span>
                      <span className="text-gray-400">·</span>
                      <span className="text-sm font-medium text-[#141776]">{review.product}</span>
                      <span className="text-gray-400">·</span>
                      <StarRating rating={review.rating} />
                      <span className="text-xs text-gray-400">{review.date}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[review.status]}`}
                      >
                        {review.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">{review.body}</p>
                    {review.adminReply && (
                      <div className="mt-3 rounded-r-lg border-l-4 border-blue-400 bg-blue-50 p-3">
                        <p className="mb-1 text-xs font-semibold text-blue-700">Admin Reply</p>
                        <p className="text-sm text-blue-800">{review.adminReply}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    {review.status !== 'Approved' && (
                      <Button
                        size="sm"
                        onClick={() => approve(review.id)}
                        className="h-7 bg-green-600 px-2 text-xs hover:bg-green-700"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Approve
                      </Button>
                    )}
                    {review.status !== 'Flagged' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => flag(review.id)}
                        className="h-7 border-red-200 px-2 text-xs text-red-500 hover:bg-red-50"
                      >
                        <Flag className="mr-1 h-3 w-3" />
                        Flag
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyTarget(review);
                        setReplyText(review.adminReply);
                      }}
                      className="h-7 px-2 text-xs"
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Reply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reply dialog */}
      <Dialog open={!!replyTarget} onOpenChange={() => setReplyTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to Review</DialogTitle>
            <DialogDescription>
              {replyTarget?.customer} — {replyTarget?.product}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {replyTarget && (
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <StarRating rating={replyTarget.rating} />
                </div>
                <p className="text-sm italic text-gray-600">"{replyTarget.body}"</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Your Reply</label>
              <Textarea
                placeholder="Write a helpful response..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={4}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReplyTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={submitReply}
                disabled={!replyText.trim()}
                className="bg-[#141776] hover:bg-[#0f1258]"
              >
                Post Reply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
