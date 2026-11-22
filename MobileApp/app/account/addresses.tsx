import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardTypeOptions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { colors, radius, spacing } from "@/lib/theme";
import { Text, TextInput } from "@/components/ui/Typography";
import { Footer } from "@/components/ui/Footer";
import type { SavedAddress, User } from "@shared/types";

const EMPTY_FORM = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

type Form = typeof EMPTY_FORM;

export default function AddressesScreen() {
  const { user, loading: authLoading } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAddresses(await apiFetch<SavedAddress[]>("/api/addresses"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your addresses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
    else setLoading(false);
  }, [user, load]);

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (address: SavedAddress) => {
    setEditingId(address.id);
    setForm({
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    });
    setShowForm(true);
    setError(null);
  };

  const save = async () => {
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
    setBusy(true);
    setError(null);
    try {
      const path = editingId ? `/api/addresses/${editingId}` : "/api/addresses";
      const editing = addresses.find((address) => address.id === editingId);
      const updated = await apiFetch<User>(path, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify({
          ...payload,
          isDefault: editing ? !!editing.isDefault : addresses.length === 0,
        }),
      });
      setAddresses(updated.addresses ?? []);
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this address.");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (address: SavedAddress) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<User>(`/api/addresses/${address.id}`, {
        method: "PUT",
        body: JSON.stringify({
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2 ?? "",
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          isDefault: true,
        }),
      });
      setAddresses(updated.addresses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the default address.");
    } finally {
      setBusy(false);
    }
  };

  const remove = (address: SavedAddress) => {
    Alert.alert("Delete address", `Remove the address for ${address.fullName}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          setError(null);
          try {
            const updated = await apiFetch<User>(`/api/addresses/${address.id}`, { method: "DELETE" });
            setAddresses(updated.addresses ?? []);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete this address.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (authLoading || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>Sign in to manage addresses</Text>
        <Footer />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      {error && <Text style={styles.errorBox}>{error}</Text>}

      {!showForm && (
        <Pressable style={styles.primary} onPress={openNew}>
          <Text style={styles.primaryText}>+ Add a new address</Text>
        </Pressable>
      )}

      {showForm && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{editingId ? "Edit address" : "New address"}</Text>
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
          </View>
          <View style={styles.formActions}>
            <Pressable
              style={styles.secondary}
              onPress={() => {
                setShowForm(false);
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={save} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      )}

      {!addresses.length ? (
        <Text style={styles.emptyState}>No saved addresses yet.</Text>
      ) : (
        addresses.map((address) => (
          <View key={address.id} style={styles.card}>
            <View style={styles.addressHeader}>
              <Text style={styles.addressName}>{address.fullName}</Text>
              {address.isDefault && <Text style={styles.defaultBadge}>DEFAULT</Text>}
            </View>
            <Text style={styles.addressText}>
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
            </Text>
            <Text style={styles.addressText}>
              {address.city}, {address.state} — {address.pincode}
            </Text>
            <Text style={styles.addressText}>📞 {address.phone}</Text>
            <View style={styles.actions}>
              {!address.isDefault && (
                <Pressable onPress={() => makeDefault(address)} disabled={busy}>
                  <Text style={styles.link}>Set default</Text>
                </Pressable>
              )}
              <Pressable onPress={() => openEdit(address)} disabled={busy}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => remove(address)} disabled={busy}>
                <Text style={[styles.link, { color: colors.red }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
      <Footer />
    </ScrollView>
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
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  emptyState: { textAlign: "center", color: colors.textMuted, padding: spacing.xl },
  errorBox: {
    backgroundColor: "#fef2f2",
    color: colors.red,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  addressHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addressName: { fontSize: 15, fontWeight: "700", color: colors.text },
  defaultBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.emerald,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  addressText: { fontSize: 13, color: colors.textMuted, marginTop: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md },
  link: { color: colors.brand, fontWeight: "600", fontSize: 13 },
  form: { gap: spacing.sm },
  formRow: { flexDirection: "row", gap: spacing.sm },
  formActions: { flexDirection: "row", gap: spacing.sm, justifyContent: "flex-end", marginTop: spacing.md },
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
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
});
