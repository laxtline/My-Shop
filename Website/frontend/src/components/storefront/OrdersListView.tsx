"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchMyOrders, fetchMoreOrders } from "@/store/ordersSlice";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { formatINR } from "@/lib/format";
import { ProtectedRoute } from "@/components/ProtectedRoute";

export function OrdersListView() {
  return (
    <ProtectedRoute fallback={<SignInPrompt />}>
      <Orders />
    </ProtectedRoute>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
      <p className="text-slate-600">Please sign in to view your orders.</p>
      <Link href="/" className="mt-3 inline-block font-medium text-brand hover:underline">
        Go home
      </Link>
    </div>
  );
}

function Orders() {
  const dispatch = useAppDispatch();
  const { list, listStatus, hasMore } = useAppSelector((s) => s.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  const loadMore = () => {
    dispatch(fetchMoreOrders());
  };

  if (listStatus === "loading" && list.length === 0) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon="📦"
        title="No orders yet"
        message="When you place an order, it will appear here."
        action={
          <Link href="/products">
            <Button>Start shopping</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {list.map((order) => {
          const count = order.items.reduce((n, i) => n + i.quantity, 0);
          const placed = order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }) : "";
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition-shadow hover:shadow-card-hover"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">#{order.id.slice(-6).toUpperCase()}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {placed} · {count} item{count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{formatINR(order.total)}</p>
                  <p className="text-xs text-brand">View details →</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <div className="text-center pt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={listStatus === "loading"}
            loading={listStatus === "loading"}
          >
            Load more orders
          </Button>
        </div>
      )}
    </div>
  );
}
