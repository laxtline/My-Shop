"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  CouponValidation,
  PaymentConfig,
  PaymentMethod,
  Product,
  SavedAddress,
  ShippingAddress,
  User,
} from "@shared/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchCart, updateCartItem, mergeMobileCart } from "@/store/cartSlice";
import { placeOrder, clearOrderError } from "@/store/ordersSlice";
import { setUser } from "@/store/authSlice";
import { apiFetch } from "@/lib/api";
import { payForOrder } from "@/lib/razorpay";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { formatINR, unitPriceForQty } from "@/lib/format";
import { QuantitySelector } from '@/components/ui/QuantitySelector';
import { LoginDialog } from "@/components/auth/LoginDialog";

const DELIVERY_FEE = 49;
const FREE_DELIVERY_OVER = 5000;

const EMPTY_ADDRESS: ShippingAddress = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export function CheckoutView() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { toast } = useToast();
  const { cart, status, mutating, error: cartError } = useAppSelector((s) => s.cart);
  const { placing, error } = useAppSelector((s) => s.orders);
  const user = useAppSelector((s) => s.auth.user);
  const brand = useAppSelector((s) => s.brand.brand);

  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [saveAddr, setSaveAddr] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  // Shown when the (currently inactive) online-payment option is clicked.
  const [onlineNotice, setOnlineNotice] = useState(false);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [validatedCart, setValidatedCart] = useState('');
  // Login dialog state
  const [showLogin, setShowLogin] = useState(false);
  const couponRequest = useRef(0);
  const cartKey = JSON.stringify(cart?.items ?? []);
  const appliedCode = coupon?.code;
  const imported = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const input = url.searchParams.get('mobileCart');
    if (!input || imported.current) return;
    imported.current = true;
    try {
      if (input.length > 20000) throw new Error('Mobile cart is too large.');
      const items = JSON.parse(input);
      if (!Array.isArray(items)) throw new Error('Invalid mobile cart.');
      void dispatch(mergeMobileCart(items)).then((result) => {
        if (mergeMobileCart.fulfilled.match(result)) {
          url.searchParams.delete('mobileCart'); window.history.replaceState(null, '', url);
          toast('Mobile cart transferred. Review your order and apply a coupon.');
        }
      });
    } catch (error) { setPayError(error instanceof Error ? error.message : 'Could not transfer mobile cart.'); }
  }, [dispatch, toast]);

  useEffect(() => {
    if (!appliedCode || mutating) return;
    const controller = new AbortController();
    const request = ++couponRequest.current;
    setApplyingCoupon(true);
    apiFetch<CouponValidation>('/api/coupons/validate', {
      method: 'POST', body: JSON.stringify({ code: appliedCode }), signal: controller.signal,
    }).then((result) => {
      if (request !== couponRequest.current) return;
      setCoupon(result); setValidatedCart(cartKey); setCouponError(null);
    }).catch((err) => {
      if (controller.signal.aborted || request !== couponRequest.current) return;
      setCoupon(null); setCouponError(err instanceof Error ? err.message : 'Coupon no longer applies.');
    }).finally(() => {
      if (!controller.signal.aborted && request === couponRequest.current) setApplyingCoupon(false);
    });
    return () => controller.abort();
  }, [cartKey, appliedCode, mutating]);

  const addresses = user?.addresses ?? [];

  useEffect(() => {
    if (status === "idle") dispatch(fetchCart());
  }, [status, dispatch]);

  // Prefill from the user's default saved address (once).
  useEffect(() => {
    if (prefilled) return;
    const def = addresses.find((a) => a.isDefault) ?? addresses[0];
    if (def) {
      setAddress({
        fullName: def.fullName,
        phone: def.phone,
        line1: def.line1,
        line2: def.line2 ?? "",
        city: def.city,
        state: def.state,
        pincode: def.pincode,
      });
      setPrefilled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, prefilled]);

  const fillFrom = (a: SavedAddress) =>
    setAddress({
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      line2: a.line2 ?? "",
      city: a.city,
      state: a.state,
      pincode: a.pincode,
    });

  // Load payment config to decide whether to offer online payment.
  useEffect(() => {
    apiFetch<PaymentConfig>("/api/payments/config")
      .then(setConfig)
      .catch(() => setConfig({ razorpayEnabled: false, razorpayKeyId: "" }));
  }, []);

  // Prefill the buyer's name once we know who they are.
  useEffect(() => {
    if (user?.name) setAddress((a) => (a.fullName ? a : { ...a, fullName: user.name }));
  }, [user]);

  useEffect(() => () => void dispatch(clearOrderError()), [dispatch]);

  const lines = (cart?.items ?? [])
    .map((it) => ({ product: it.product, quantity: it.quantity }))
    .filter((l): l is { product: Product; quantity: number } => !!l.product && typeof l.product !== "string");

  if (status === "loading" && !cart) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!lines.length) {
    return (
      <EmptyState
        icon="🛒"
        title="Nothing to check out"
        message="Your cart is empty."
        action={
          <Link href="/products">
            <Button>Browse products</Button>
          </Link>
        }
      />
    );
  }

  const itemsTotal = lines.reduce((sum, l) => sum + unitPriceForQty(l.product, l.quantity) * l.quantity, 0);
  const deliveryFee = itemsTotal >= FREE_DELIVERY_OVER ? 0 : DELIVERY_FEE;
  const discount = coupon && validatedCart === cartKey ? Math.min(coupon.discount, itemsTotal) : 0;
  const total = Math.max(0, itemsTotal + deliveryFee - discount);

  const set = (k: keyof ShippingAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setAddress((a) => ({ ...a, [k]: e.target.value }));

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setApplyingCoupon(true);
    const request = ++couponRequest.current;
    setCouponError(null);
    try {
      const result = await apiFetch<CouponValidation>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      if (request !== couponRequest.current) return;
      setCoupon(result);
      setValidatedCart(cartKey);
      toast(`Coupon ${result.code} applied`);
    } catch (err) {
      setCoupon(null);
      setCouponError(err instanceof Error ? err.message : "Invalid coupon");
    } finally {
      setApplyingCoupon(false);
    }
  };

  const removeCoupon = () => {
    couponRequest.current++;
    setApplyingCoupon(false);
    setCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mutating || applyingCoupon || coupon && validatedCart !== cartKey) return;
    setPayError(null);

    // If user is not logged in, show login dialog instead of placing order
    if (!user) {
      setShowLogin(true);
      return;
    }

    // 1) Create the order server-side (validates address, prices, stock).
    const result = await dispatch(
      placeOrder({ shippingAddress: address, paymentMethod: method, notes, couponCode: coupon?.code })
    );
    if (!placeOrder.fulfilled.match(result)) return; // error surfaced via slice
    const order = result.payload;
    dispatch(fetchCart()); // server cleared it; refresh local state

    // Optionally save the address to the account (best-effort).
    if (saveAddr) {
      try {
        const updated = await apiFetch<User>("/api/addresses", {
          method: "POST",
          body: JSON.stringify(address),
        });
        dispatch(setUser(updated));
      } catch {
        /* non-fatal */
      }
    }

    // 2) COD is done. For online payment, launch Razorpay for this order.
    if (method === "COD") {
      toast("Order placed successfully");
      router.push(`/orders/${order.id}`);
      return;
    }

    setPaying(true);
    try {
      await payForOrder({
        orderId: order.id,
        brandName: brand.appName,
        themeColor: brand.themeColor,
        prefill: { name: address.fullName, email: user?.email, contact: address.phone },
      });
      toast("Payment successful — order confirmed");
      router.push(`/orders/${order.id}`);
    } catch (err) {
      // Payment cancelled or failed. The order exists as unpaid — the user can
      // retry from the order page.
      setPayError(err instanceof Error ? err.message : "Payment could not be completed.");
      toast("Payment not completed. You can retry from the order page.", "error");
      router.push(`/orders/${order.id}`);
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-800">Shipping address</h2>
              <Link href="/account" className="text-xs font-medium text-brand hover:underline">
                Manage addresses
              </Link>
            </div>

          {addresses.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-medium text-slate-500">Use a saved address</p>
              <div className="flex flex-wrap gap-2">
                {addresses.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => fillFrom(a)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-left text-xs hover:border-brand"
                  >
                    <span className="block font-semibold text-slate-700">
                      {a.fullName}
                      {a.isDefault ? " · Default" : ""}
                    </span>
                    <span className="block text-slate-400">
                      {a.line1}, {a.city}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Full name" value={address.fullName} onChange={set("fullName")} required autoComplete="name" />
            <Field
              label="Phone (10-digit)"
              value={address.phone}
              onChange={set("phone")}
              required
              inputMode="numeric"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              autoComplete="tel-national"
              title="Enter a 10-digit Indian mobile number starting with 6-9."
            />
            <Field label="Address line 1" value={address.line1} onChange={set("line1")} required className="sm:col-span-2" autoComplete="address-line1" />
            <Field label="Address line 2 (optional)" value={address.line2 ?? ""} onChange={set("line2")} className="sm:col-span-2" autoComplete="address-line2" />
            <Field label="City" value={address.city} onChange={set("city")} required autoComplete="address-level2" />
            <Field label="State" value={address.state} onChange={set("state")} required autoComplete="address-level1" />
            <Field
              label="Pincode (6-digit)"
              value={address.pincode}
              onChange={set("pincode")}
              required
              inputMode="numeric"
              pattern="[1-9][0-9]{5}"
              maxLength={6}
              autoComplete="postal-code"
              title="Enter a 6-digit Indian PIN code."
            />
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={saveAddr}
              onChange={(e) => setSaveAddr(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Save this address to my account
          </label>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-base font-semibold text-slate-800">Delivery notes (optional)</h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Landmark, preferred time, etc."
            className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-brand"
          />
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
          <h2 className="text-base font-semibold text-slate-800">Payment method</h2>
          <div className="mt-3 space-y-3">
            <PaymentOption
              label="Cash on Delivery (COD)"
              description="Pay in cash when your order arrives."
              selected={method === "COD"}
              onSelect={() => setMethod("COD")}
            />
            {config?.razorpayEnabled ? (
              <PaymentOption
                label="Pay Online (UPI / Card / Netbanking)"
                description="Secure payment via Razorpay."
                selected={method === "RAZORPAY"}
                onSelect={() => setMethod("RAZORPAY")}
              />
            ) : (
              // Online payment is built end-to-end (see paymentController), but the
              // gateway keys are intentionally not configured, so it stays switched
              // off. Showing it as "coming soon" is honest: the option is visible
              // without ever letting an order be placed through an inactive gateway.
              <PaymentOption
                label="Pay Online (UPI / Card / Netbanking)"
                description="Secure payment via UPI, card or netbanking."
                selected={false}
                disabled
                onSelect={() => setOnlineNotice(true)}
              />
            )}
          </div>
          {onlineNotice && (
            // aria-live so the message is announced when it appears, not silently
            // rendered for sighted users only.
            <p aria-live="polite" className="mt-2 text-xs font-medium text-brand">
              Coming soon — for now, please continue with Cash on Delivery.
            </p>
          )}
          {!config && <p className="mt-2 text-xs text-slate-400">Loading payment options…</p>}
        </section>
      </div>

      <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-5 shadow-card lg:sticky lg:top-24">
        <h2 className="text-base font-semibold text-slate-800">Order summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map(({ product, quantity }) => (
            <li key={product.id} className="space-y-2 border-b border-slate-100 pb-3 text-slate-600">
              <div className="flex justify-between gap-2"><span>{product.title}</span>
                <span className="shrink-0">{formatINR(unitPriceForQty(product, quantity) * quantity)}</span></div>
              <QuantitySelector value={quantity} max={product.stock} disabled={!!mutating || placing || paying}
                label={`Quantity for ${product.title}`}
                onChange={(next) => dispatch(updateCartItem({ productId: product.id, quantity: next }))} />
              {quantity > product.stock && <p role="alert" className="text-xs text-red-600">Only {product.stock} available. Update your cart.</p>}
            </li>
          ))}
        </ul>
        {/* Coupon */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          {coupon ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-2 text-sm">
              <span className="font-medium text-emerald-700">
                {coupon.code} applied · −{formatINR(discount)}
              </span>
              <button type="button" onClick={removeCoupon} className="text-xs font-medium text-emerald-700 hover:underline">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="Coupon code"
                className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm uppercase outline-none focus:border-brand"
              />
              <Button type="button" variant="outline" size="sm" onClick={applyCoupon} loading={applyingCoupon} disabled={!!mutating}>
                Apply
              </Button>
            </div>
          )}
          {couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
          {applyingCoupon && <p role="status" className="text-xs text-slate-500">Checking coupon against your cart…</p>}
        </div>

        <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Items total</dt>
            <dd>{formatINR(itemsTotal)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>Delivery</dt>
            <dd>{deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <dt>Discount</dt>
              <dd>−{formatINR(discount)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
            <dt>Total</dt>
            <dd>{formatINR(total)}</dd>
          </div>
        </dl>

        {(error || payError || cartError) && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-600">{error || payError || cartError}</p>
        )}

        <Button type="submit" size="lg" fullWidth loading={placing || paying} className="mt-4"
          disabled={!!mutating || applyingCoupon || !!(coupon && validatedCart !== cartKey) || lines.some((l) => l.quantity > l.product.stock || !l.product.isActive)}>
          {method === "RAZORPAY" ? "Pay" : "Place order"} · {formatINR(total)}
        </Button>
        <Link href="/cart" className="mt-3 block text-center text-sm font-medium text-brand hover:underline">
          Back to cart
        </Link>
      </aside>
    </form>

    {/* Login dialog for guest users trying to place an order */}
    <LoginDialog
      open={showLogin}
      onClose={() => setShowLogin(false)}
      reason="Sign in to place your order"
    />
    </>
  );
}

function PaymentOption({
  label,
  description,
  selected,
  onSelect,
  disabled = false,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  /** Renders the option as unavailable: it can be clicked to explain why, but never selected. */
  disabled?: boolean;
}) {
  return (
    <label
      // The radio is disabled, and a disabled input does not fire click events
      // through its label — so the handler lives here, on the label itself.
      onClick={disabled ? onSelect : undefined}
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        disabled
          ? "cursor-pointer border-slate-200 bg-slate-50/60"
          : selected
            ? "cursor-pointer border-brand bg-brand-50"
            : "cursor-pointer border-slate-200 hover:bg-slate-50"
      }`}
    >
      <input
        type="radio"
        name="payment-method"
        checked={selected}
        onChange={onSelect}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 text-brand"
      />
      <span>
        <span
          className={`block text-sm font-medium ${disabled ? "text-slate-500" : "text-slate-800"}`}
        >
          {label}
          {disabled && (
            <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              Coming soon
            </span>
          )}
        </span>
        <span className="block text-xs text-slate-400">{description}</span>
      </span>
    </label>
  );
}

function Field({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
