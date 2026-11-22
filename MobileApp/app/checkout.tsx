import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/lib/cart";
import { apiFetch, formatINR } from "@/lib/api";
import { openPaymentLink, pollPaymentStatus } from "@/lib/payments";
import { colors, radius, spacing } from "@/lib/theme";
import { Text, TextInput } from "@/components/ui/Typography";
import { Footer } from "@/components/ui/Footer";
import { shipmentWeightKg, type ServiceabilityResult } from "@shared/shipping";
import { unitPriceForQty } from "@shared/pricing";
import type {
  CouponValidation,
  Order,
  PaymentChannel,
  PaymentConfig,
  PaymentMethod,
  SavedAddress,
  User,
} from "@shared/types";

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

type AddressForm = typeof EMPTY_FORM;

const CHANNEL_META: Array<{ id: PaymentChannel; label: string; icon: string; hint: string }> = [
  { id: "UPI", label: "UPI", icon: "📱", hint: "GPay, PhonePe, Paytm" },
  { id: "CARD", label: "Card", icon: "💳", hint: "Credit or debit card" },
  { id: "NETBANKING", label: "Netbanking", icon: "🏦", hint: "All major banks" },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const { user, loading: authLoading, signIn } = useAuth();
  const { lines, total, clear } = useCart();

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddressForm>(EMPTY_FORM);
  const [savingAddress, setSavingAddress] = useState(false);

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("COD");
  const [channel, setChannel] = useState<PaymentChannel>("UPI");

  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponValidation | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const [service, setService] = useState<ServiceabilityResult | null>(null);
  const [checkingPin, setCheckingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const [placing, setPlacing] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedId) ?? null,
    [addresses, selectedId]
  );

  const weight = useMemo(
    () => shipmentWeightKg(lines.map((line) => ({ weight: line.product.weight, quantity: line.quantity }))),
    [lines]
  );

  const loadAddresses = useCallback(async () => {
    setAddressLoading(true);
    try {
      const list = await apiFetch<SavedAddress[]>("/api/addresses");
      setAddresses(list);
      setSelectedId((current) => {
        if (current && list.some((address) => address.id === current)) return current;
        return list.find((address) => address.isDefault)?.id ?? list[0]?.id ?? null;
      });
      if (!list.length) setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your addresses.");
    } finally {
      setAddressLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setAddressLoading(false);
      return;
    }
    void loadAddresses();
    apiFetch<PaymentConfig>("/api/payments/config")
      .then((paymentConfig) => {
        setConfig(paymentConfig);
        if (!paymentConfig.codEnabled) setMethod("RAZORPAY");
        setChannel(paymentConfig.onlineMethods[0] ?? "UPI");
      })
      .catch(() => {
        /* checkout still works with COD defaults */
      });
  }, [user, loadAddresses]);

  // Check delivery availability whenever the pincode, cart value or weight changes.
  useEffect(() => {
    const pincode = selectedAddress?.pincode ?? "";
    if (!/^[1-9]\d{5}$/.test(pincode) || !lines.length) {
      setService(null);
      setPinError(null);
      return;
    }
    let active = true;
    setCheckingPin(true);
    setPinError(null);
    const timer = setTimeout(async () => {
      try {
        const query = `pincode=${pincode}&itemsTotal=${encodeURIComponent(total)}&weight=${weight}&cod=true`;
        const result = await apiFetch<ServiceabilityResult>(`/api/shipping/serviceability?${query}`);
        if (active) setService(result);
      } catch (err) {
        if (active) {
          setService(null);
          setPinError(err instanceof Error ? err.message : "Could not check this pincode.");
        }
      } finally {
        if (active) setCheckingPin(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedAddress?.pincode, total, weight, lines.length]);

  const saveAddress = async () => {
    const payload = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      line1: form.line1.trim(),
      line2: form.line2.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
    };
    if (!payload.fullName || !payload.line1 || !payload.city || !payload.state) {
      setError("Please fill your name, address, city and state.");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(payload.phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!/^[1-9]\d{5}$/.test(payload.pincode)) {
      setError("Enter a valid 6-digit pincode.");
      return;
    }
    setSavingAddress(true);
    setError(null);
    try {
      const updated = await apiFetch<User>("/api/addresses", {
        method: "POST",
        body: JSON.stringify({ ...payload, isDefault: addresses.length === 0 }),
      });
      const list = updated.addresses ?? [];
      setAddresses(list);
      const added = list.find(
        (address) => address.phone === payload.phone && address.line1 === payload.line1 && address.pincode === payload.pincode
      );
      setSelectedId(added?.id ?? list[list.length - 1]?.id ?? null);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code) return;
    setCouponBusy(true);
    setError(null);
    try {
      // The coupon endpoint prices the *server* cart, so mirror the phone cart first.
      await apiFetch("/api/cart/replace", {
        method: "POST",
        body: JSON.stringify({ items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }),
      });
      const result = await apiFetch<CouponValidation>("/api/coupons/validate", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      setCoupon(result);
    } catch (err) {
      setCoupon(null);
      setError(err instanceof Error ? err.message : "This coupon is not valid.");
    } finally {
      setCouponBusy(false);
    }
  };

  const deliveryFee = service?.deliveryFee ?? 0;
  const codFee = method === "COD" ? service?.codFee ?? config?.codFee ?? 0 : 0;
  const discount = coupon ? Math.min(coupon.discount, total) : 0;
  const payable = Math.max(0, total + deliveryFee + codFee - discount);
  const codAvailable = !!service?.codAvailable && (config?.codEnabled ?? true);
  const onlineAvailable = !!config?.razorpayEnabled && !!config?.onlineMethods.length;

  const startPayment = async (order: Order) => {
    setPlacedOrder(order);
    setStage("Opening secure payment…");
    try {
      await openPaymentLink(order.id, channel);
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : "Could not open the payment page."} Your order is saved — tap Retry payment.`
      );
      return;
    }
    setStage("Confirming your payment…");
    try {
      const status = await pollPaymentStatus(order.id);
      if (status?.paymentStatus === "PAID") {
        clear();
        router.replace({ pathname: "/orders/[id]", params: { id: order.id, placed: "1" } });
        return;
      }
      if (status?.paymentStatus === "FAILED") {
        setError("The payment failed. Your order is saved — tap Retry payment.");
      } else {
        setError(
          "Payment is not confirmed yet. If money was debited it will be confirmed automatically. You can also retry below."
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the payment.");
    } finally {
      setStage(null);
    }
  };

  const placeOrder = async () => {
    if (!user) {
      await signIn();
      return;
    }
    if (!lines.length) {
      setError("Your cart is empty.");
      return;
    }
    if (!selectedAddress) {
      setError("Choose a delivery address first.");
      return;
    }
    if (!service) {
      setError("Wait for the delivery check to finish, or pick another pincode.");
      return;
    }
    if (!service.serviceable) {
      setError(`Delivery is not available to ${selectedAddress.pincode}. Please choose another address.`);
      return;
    }
    if (method === "COD" && !codAvailable) {
      setError("Cash on Delivery is not available here. Please pay online.");
      return;
    }
    if (method === "RAZORPAY" && !onlineAvailable) {
      setError("Online payment is not available right now. Please choose Cash on Delivery.");
      return;
    }

    setPlacing(true);
    setError(null);
    setStage("Placing your order…");
    let order: Order | null = null;
    try {
      await apiFetch("/api/cart/replace", {
        method: "POST",
        body: JSON.stringify({ items: lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) }),
      });
      order = await apiFetch<Order>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          shippingAddress: {
            fullName: selectedAddress.fullName,
            phone: selectedAddress.phone,
            line1: selectedAddress.line1,
            line2: selectedAddress.line2 ?? "",
            city: selectedAddress.city,
            state: selectedAddress.state,
            pincode: selectedAddress.pincode,
          },
          paymentMethod: method,
          paymentChannel: method === "COD" ? "COD" : channel,
          ...(coupon ? { couponCode: coupon.code } : {}),
        }),
      });

      // The order now exists server-side and the server cart is empty, so the
      // phone cart is cleared even if the online payment is abandoned. The
      // order page offers "Pay now" to retry.
      setPlacedOrder(order);
      clear();
      if (method === "COD") {
        router.replace({ pathname: "/orders/[id]", params: { id: order.id, placed: "1" } });
        return;
      }
      await startPayment(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setPlacing(false);
      setStage(null);
    }
  };

  const retryPayment = async () => {
    if (!placedOrder) return;
    setError(null);
    setPlacing(true);
    try {
      await startPayment(placedOrder);
    } finally {
      setPlacing(false);
    }
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🔐</Text>
        <Text style={styles.emptyTitle}>Sign in to check out</Text>
        <Text style={styles.muted}>Your cart is saved on this phone.</Text>
        <Pressable style={styles.primary} onPress={signIn}>
          <Text style={styles.primaryText}>Sign in with Google</Text>
        </Pressable>
        <Footer />
      </View>
    );
  }

  if (!lines.length && !placedOrder) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🛒</Text>
        <Text style={styles.emptyTitle}>Your cart is empty</Text>
        <Pressable style={styles.primary} onPress={() => router.replace("/")}>
          <Text style={styles.primaryText}>Browse products</Text>
        </Pressable>
        <Footer />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      {error && <Text style={styles.errorBox}>{error}</Text>}
      {stage && (
        <View style={styles.stageBox}>
          <ActivityIndicator color={colors.brand} />
          <Text style={styles.stageText}>{stage}</Text>
        </View>
      )}

      {!placedOrder && (
        <>
          {/* Addresses */}
          <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Delivery address</Text>
          {!showForm && (
            <Pressable onPress={() => setShowForm(true)}>
              <Text style={styles.link}>+ Add new</Text>
            </Pressable>
          )}
        </View>

        {addressLoading ? (
          <ActivityIndicator color={colors.brand} />
        ) : (
          addresses.map((address) => (
            <Pressable
              key={address.id}
              onPress={() => setSelectedId(address.id)}
              style={[styles.addressRow, selectedId === address.id && styles.addressRowActive]}
            >
              <View style={[styles.radio, selectedId === address.id && styles.radioActive]}>
                {selectedId === address.id && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressName}>
                  {address.fullName}
                  {address.isDefault ? "  ·  Default" : ""}
                </Text>
                <Text style={styles.addressText}>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                </Text>
                <Text style={styles.addressText}>
                  {address.city}, {address.state} — {address.pincode}
                </Text>
                <Text style={styles.addressText}>📞 {address.phone}</Text>
              </View>
            </Pressable>
          ))
        )}

        {showForm && (
          <View style={styles.form}>
            <Field label="Full name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
            <Field
              label="Mobile number"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v.replace(/\D/g, "").slice(0, 10) })}
              keyboardType="phone-pad"
            />
            <Field label="Address line 1" value={form.line1} onChange={(v) => setForm({ ...form, line1: v })} />
            <Field label="Address line 2 (optional)" value={form.line2} onChange={(v) => setForm({ ...form, line2: v })} />
            <View style={styles.formRow}>
              <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} style={{ flex: 1 }} />
              <Field label="State" value={form.state} onChange={(v) => setForm({ ...form, state: v })} style={{ flex: 1 }} />
            </View>
            <Field
              label="Pincode"
              value={form.pincode}
              onChange={(v) => setForm({ ...form, pincode: v.replace(/\D/g, "").slice(0, 6) })}
              keyboardType="number-pad"
            />
            <View style={styles.formActions}>
              <Pressable
                style={styles.secondary}
                onPress={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
              >
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.primary} onPress={saveAddress} disabled={savingAddress}>
                {savingAddress ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save address</Text>}
              </Pressable>
            </View>
          </View>
        )}

        {!!selectedAddress && (
          <View style={styles.serviceBox}>
            {checkingPin ? (
              <Text style={styles.muted}>Checking delivery to {selectedAddress.pincode}…</Text>
            ) : pinError ? (
              <Text style={styles.errorText}>{pinError}</Text>
            ) : service ? (
              service.serviceable ? (
                <>
                  <Text style={styles.serviceOk}>
                    ✓ Delivers in {service.estimatedDaysMin}–{service.estimatedDaysMax} days
                    {service.source === "estimate" ? " (estimated)" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    Delivery {service.deliveryFee === 0 ? "FREE" : formatINR(service.deliveryFee)}
                    {service.freeDeliveryOver > 0 && service.deliveryFee > 0
                      ? ` · free over ${formatINR(service.freeDeliveryOver)}`
                      : ""}
                    {service.codAvailable ? " · COD available" : " · prepaid only"}
                  </Text>
                </>
              ) : (
                <Text style={styles.errorText}>
                  {service.message || `We do not deliver to ${service.pincode} yet.`}
                </Text>
              )
            ) : null}
          </View>
        )}
      </View>

      {/* Payment */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Payment method</Text>

        <Pressable
          onPress={() => setMethod("COD")}
          style={[styles.methodRow, method === "COD" && styles.methodRowActive]}
        >
          <View style={[styles.radio, method === "COD" && styles.radioActive]}>
            {method === "COD" && <View style={styles.radioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>💵 Cash on Delivery</Text>
            <Text style={styles.muted}>
              {codAvailable
                ? (service?.codFee ?? config?.codFee ?? 0) > 0
                  ? `Pay the delivery agent · +${formatINR(service?.codFee ?? config?.codFee ?? 0)} handling`
                  : "Pay the delivery agent when it arrives"
                : "Not available for this pincode"}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setMethod("RAZORPAY")}
          style={[styles.methodRow, method === "RAZORPAY" && styles.methodRowActive]}
        >
          <View style={[styles.radio, method === "RAZORPAY" && styles.radioActive]}>
            {method === "RAZORPAY" && <View style={styles.radioDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.methodTitle}>🔒 Pay online</Text>
            <Text style={styles.muted}>
              {onlineAvailable ? "UPI, card or netbanking via Razorpay" : "Online payment is currently unavailable"}
            </Text>
          </View>
        </Pressable>

        {method === "RAZORPAY" && onlineAvailable && (
          <View style={styles.channels}>
            {(config?.onlineMethods ?? CHANNEL_META.map((c) => c.id))
              .map((id) => CHANNEL_META.find((c) => c.id === id))
              .filter((meta): meta is (typeof CHANNEL_META)[number] => !!meta)
              .map((meta) => (
                <Pressable
                  key={meta.id}
                  onPress={() => setChannel(meta.id)}
                  style={[styles.channel, channel === meta.id && styles.channelActive]}
                >
                  <Text style={styles.channelIcon}>{meta.icon}</Text>
                  <Text style={[styles.channelLabel, channel === meta.id && styles.channelLabelActive]}>{meta.label}</Text>
                  <Text style={styles.channelHint}>{meta.hint}</Text>
                </Pressable>
              ))}
          </View>
        )}
      </View>

      {/* Coupon */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Coupon</Text>
        {coupon ? (
          <View style={styles.couponApplied}>
            <Text style={styles.serviceOk}>✓ {coupon.code} applied · −{formatINR(discount)}</Text>
            <Pressable onPress={() => { setCoupon(null); setCouponInput(""); }}>
              <Text style={styles.link}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.couponRow}>
            <TextInput
              value={couponInput}
              onChangeText={setCouponInput}
              placeholder="Enter coupon code"
              autoCapitalize="characters"
              style={styles.input}
            />
            <Pressable style={styles.secondary} onPress={applyCoupon} disabled={couponBusy}>
              {couponBusy ? <ActivityIndicator color={colors.brand} /> : <Text style={styles.secondaryText}>Apply</Text>}
            </Pressable>
          </View>
        )}
      </View>
        </>
      )}

      {/* Summary */}
      {lines.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order summary</Text>
          {lines.map((line) => (
            <View key={line.product.id} style={styles.summaryRow}>
              <Text style={styles.summaryLabel} numberOfLines={1}>
                {line.product.title} × {line.quantity}
              </Text>
              <Text style={styles.summaryValue}>
                {formatINR(unitPriceForQty(line.product, line.quantity) * line.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <Row label="Items" value={formatINR(total)} />
          <Row label="Delivery" value={deliveryFee === 0 ? "FREE" : formatINR(deliveryFee)} />
          {method === "COD" && codFee > 0 && <Row label="COD handling" value={formatINR(codFee)} />}
          {discount > 0 && <Row label="Coupon discount" value={`−${formatINR(discount)}`} />}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>To pay</Text>
            <Text style={styles.totalValue}>{formatINR(payable)}</Text>
          </View>
          <Text style={styles.muted}>
            {method === "COD"
              ? "Pay cash when the order is delivered."
              : "You will be redirected to Razorpay's secure page."}
          </Text>
        </View>
      )}

      {placedOrder ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment pending</Text>
          <Text style={styles.muted}>
            Order #{placedOrder.id.slice(-8).toUpperCase()} is saved. Complete the payment to confirm it.
          </Text>
          <Pressable style={[styles.primary, { marginTop: spacing.md }]} onPress={retryPayment} disabled={placing}>
            {placing ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Retry payment</Text>}
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: placedOrder.id } })}
          >
            <Text style={styles.secondaryText}>View order</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.primary, (!service?.serviceable || placing) && styles.disabled]}
          onPress={placeOrder}
          disabled={placing}
        >
          {placing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {method === "COD" ? `Place order · ${formatINR(payable)}` : `Pay ${formatINR(payable)} securely`}
            </Text>
          )}
        </Pressable>
      )}

      <Footer />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  keyboardType,
  style,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboardType} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginTop: spacing.md },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  errorText: { color: colors.red, fontSize: 13 },
  errorBox: {
    backgroundColor: "#fef2f2",
    color: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  stageBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#eff6ff",
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  stageText: { color: colors.brandDark, fontSize: 13, flex: 1 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  link: { color: colors.brand, fontWeight: "600", fontSize: 13 },
  addressRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  addressRowActive: { borderColor: colors.brand, backgroundColor: "#eff6ff" },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  addressName: { fontSize: 14, fontWeight: "700", color: colors.text },
  addressText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  serviceBox: { marginTop: spacing.sm, padding: spacing.md, backgroundColor: colors.bg, borderRadius: radius.md },
  serviceOk: { color: colors.emerald, fontWeight: "600", fontSize: 13 },
  form: { gap: spacing.sm, marginTop: spacing.sm },
  formRow: { flexDirection: "row", gap: spacing.sm },
  formActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.sm },
  field: { gap: spacing.xs },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    color: colors.text,
    backgroundColor: "#fff",
    flex: 1,
  },
  methodRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  methodRowActive: { borderColor: colors.brand, backgroundColor: "#eff6ff" },
  methodTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  channels: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  channel: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  channelActive: { borderColor: colors.brand, backgroundColor: "#eff6ff" },
  channelIcon: { fontSize: 20 },
  channelLabel: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 2 },
  channelLabelActive: { color: colors.brandDark },
  channelHint: { fontSize: 10, color: colors.textMuted, textAlign: "center", marginTop: 2 },
  couponRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  couponApplied: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md, marginBottom: spacing.xs },
  summaryLabel: { fontSize: 13, color: colors.text, flex: 1 },
  summaryValue: { fontSize: 13, fontWeight: "600", color: colors.text },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  totalLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 18, fontWeight: "800", color: colors.text },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondary: {
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  secondaryText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  disabled: { opacity: 0.5 },
});
