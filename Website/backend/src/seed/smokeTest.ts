/**
 * Throwaway end-to-end smoke test. Boots the REAL Express app against an
 * in-memory MongoDB, mints a JWT directly (no Google needed), and exercises the
 * catalog → cart → COD checkout → orders → admin flow. Run:  npx tsx src/seed/smokeTest.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
  const mem = await MongoMemoryServer.create();
  // env.ts reads these at import time — set BEFORE importing anything that uses env.
  process.env.MONGODB_URI = mem.getUri();
  process.env.JWT_SECRET = "smoke-secret";
  process.env.GOOGLE_CLIENT_ID = "smoke-client-id";
  process.env.NODE_ENV = "test";

  const { connectDB, disconnectDB } = await import("../config/db.js");
  const { createApp } = await import("../app.js");
  const { UserModel } = await import("../models/User.js");
  const { CategoryModel } = await import("../models/Category.js");
  const { ProductModel } = await import("../models/Product.js");
  const { signToken } = await import("../utils/jwt.js");

  await connectDB();
  const app = createApp();
  const server = app.listen(0);
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const results: string[] = [];
  let failures = 0;
  const check = (name: string, cond: boolean, extra = "") => {
    results.push(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
    if (!cond) failures++;
  };

  // --- seed a user (ADMIN via canonical email rule), a category and a product ---
  const admin = await UserModel.create({
    googleId: "g1",
    email: "suryakant321pradhan@gmail.com",
    name: "Owner",
  });
  const cat = await CategoryModel.create({ name: "Tiles", order: 1 });
  const product = await ProductModel.create({
    title: "Test Vitrified Tile 600x600",
    category: cat._id,
    brand: "Kajaria",
    images: ["https://example.com/a.jpg"],
    price: 48,
    mrp: 65,
    stock: 100,
    sku: "TIL-TEST-1",
    bulkPricing: [{ minQty: 10, pricePerUnit: 42 }],
  });

  const token = signToken({ userId: admin._id.toString() });
  const authHeaders = { "Content-Type": "application/json", Cookie: `rt_token=${token}` };

  const j = async (res: Response) => ({ status: res.status, body: (await res.json()) as any });

  // 1. Public product list returns `id` (the _id→id transform).
  {
    const { status, body } = await j(await fetch(`${base}/api/products`));
    const item = body?.data?.items?.[0];
    check("GET /api/products 200", status === 200);
    check("product has string `id` (not _id)", typeof item?.id === "string" && !("_id" in (item ?? {})), `id=${item?.id}`);
    check("category is populated with id", typeof item?.category?.id === "string");
  }

  // 2. Product detail by slug.
  {
    const { status, body } = await j(await fetch(`${base}/api/products/${product.slug}`));
    check("GET /api/products/:slug 200", status === 200 && body?.data?.id === product._id.toString());
  }

  // 3. Add to cart, verify populated product id.
  {
    const { status, body } = await j(
      await fetch(`${base}/api/cart/add`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ productId: product._id.toString(), quantity: 12 }),
      })
    );
    const line = body?.data?.items?.[0];
    check("POST /api/cart/add 201", status === 201);
    check("cart item product populated with id", typeof line?.product?.id === "string");
    check("cart quantity persisted", line?.quantity === 12);
  }

  // 4. Place a COD order — totals recomputed server-side (bulk price 42 @ qty12 = 504).
  let orderId = "";
  {
    const { status, body } = await j(
      await fetch(`${base}/api/orders`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          shippingAddress: {
            fullName: "Owner", phone: "9876543210", line1: "1 Main St",
            city: "Cuttack", state: "Odisha", pincode: "753001",
          },
        }),
      })
    );
    orderId = body?.data?.id ?? "";
    check("POST /api/orders 201", status === 201, `status=${status} msg=${body?.message}`);
    check("server-side bulk pricing (itemsTotal=504)", body?.data?.itemsTotal === 504, `got ${body?.data?.itemsTotal}`);
    check("delivery fee applied (<5000 => 49)", body?.data?.deliveryFee === 49);
    check("total = 553", body?.data?.total === 553, `got ${body?.data?.total}`);
    check("order status PLACED", body?.data?.status === "PLACED");
  }

  // 5. Stock decremented by 12 -> 88.
  {
    const fresh = await ProductModel.findById(product._id);
    check("stock decremented 100 -> 88", fresh?.stock === 88, `got ${fresh?.stock}`);
  }

  // 6. Cart cleared after order.
  {
    const { body } = await j(await fetch(`${base}/api/cart`, { headers: authHeaders }));
    check("cart emptied after checkout", (body?.data?.items?.length ?? -1) === 0);
  }

  // 7. My orders list.
  {
    const { body } = await j(await fetch(`${base}/api/orders`, { headers: authHeaders }));
    check("GET /api/orders returns the order", body?.data?.items?.some((o: any) => o.id === orderId));
  }

  // 8. Admin: stats + advance status PLACED->CONFIRMED->SHIPPED->DELIVERED (marks COD paid).
  {
    const stats = await j(await fetch(`${base}/api/orders/admin/stats`, { headers: authHeaders }));
    check("admin stats revenue = 553", stats.body?.data?.revenue === 553, `got ${stats.body?.data?.revenue}`);

    const bad = await j(
      await fetch(`${base}/api/orders/${orderId}/status`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ status: "DELIVERED" }),
      })
    );
    check("illegal PLACED->DELIVERED rejected (400)", bad.status === 400);

    for (const next of ["CONFIRMED", "SHIPPED", "DELIVERED"]) {
      await fetch(`${base}/api/orders/${orderId}/status`, {
        method: "PATCH", headers: authHeaders, body: JSON.stringify({ status: next }),
      });
    }
    const { body } = await j(await fetch(`${base}/api/orders/${orderId}`, { headers: authHeaders }));
    check("status advanced to DELIVERED", body?.data?.status === "DELIVERED");
    check("COD marked PAID on delivery", body?.data?.paymentStatus === "PAID");
  }

  // 9. Unauthenticated cart is rejected.
  {
    const res = await fetch(`${base}/api/cart`);
    check("GET /api/cart without auth = 401", res.status === 401);
  }

  // 10. Input validation — bad review payload rejected with 400.
  {
    const res = await j(
      await fetch(`${base}/api/reviews`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ productId: product._id.toString(), rating: 9 }),
      })
    );
    check("validation: rating 9 rejected (400)", res.status === 400, `status=${res.status}`);
  }

  // 11. Reviews — create, recompute product rating, list.
  {
    const create = await j(
      await fetch(`${base}/api/reviews`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ productId: product._id.toString(), rating: 4, comment: "Solid tile." }),
      })
    );
    check("POST /api/reviews 201", create.status === 201, `status=${create.status}`);

    const fresh = await ProductModel.findById(product._id);
    check("product rating recomputed to 4", fresh?.rating === 4, `got ${fresh?.rating}`);
    check("product numReviews = 1", fresh?.numReviews === 1, `got ${fresh?.numReviews}`);

    const list = await j(await fetch(`${base}/api/reviews/product/${product._id.toString()}`));
    check("GET reviews returns 1 item", (list.body?.data?.items?.length ?? 0) === 1);
  }

  // 12. Saved addresses — add then list.
  {
    const add = await j(
      await fetch(`${base}/api/addresses`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          fullName: "Owner", phone: "9876543210", line1: "1 Main St",
          city: "Cuttack", state: "Odisha", pincode: "753001",
        }),
      })
    );
    check("POST /api/addresses 201", add.status === 201, `status=${add.status}`);
    check("first address is default", add.body?.data?.addresses?.[0]?.isDefault === true);

    const bad = await fetch(`${base}/api/addresses`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ fullName: "X", phone: "123", line1: "y", city: "c", state: "s", pincode: "12" }),
    });
    check("validation: bad phone/pincode rejected (400)", bad.status === 400);
  }

  // 13. Coupons — admin creates one, checkout validation computes discount.
  {
    const create = await j(
      await fetch(`${base}/api/coupons`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: "SAVE10", type: "PERCENT", value: 10, minOrder: 100 }),
      })
    );
    check("POST /api/coupons 201", create.status === 201, `status=${create.status}`);

    const valid = await j(
      await fetch(`${base}/api/coupons/validate`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: "SAVE10", itemsTotal: 1000 }),
      })
    );
    check("coupon validate: 10% of 1000 = 100", valid.body?.data?.discount === 100, `got ${valid.body?.data?.discount}`);

    const belowMin = await fetch(`${base}/api/coupons/validate`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ code: "SAVE10", itemsTotal: 50 }),
    });
    check("coupon below minOrder rejected (400)", belowMin.status === 400);
  }

  // 14. Admin product CRUD — create, then admin-all lists it.
  {
    const create = await j(
      await fetch(`${base}/api/products`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          title: "Admin Made Product", sku: "ADM-1", category: cat._id.toString(),
          price: 100, mrp: 120, stock: 5,
        }),
      })
    );
    check("POST /api/products (admin) 201", create.status === 201, `status=${create.status}`);

    const all = await j(await fetch(`${base}/api/products/admin/all`, { headers: authHeaders }));
    check("admin/all lists >= 2 products", (all.body?.data?.items?.length ?? 0) >= 2);

    const missingCat = await fetch(`${base}/api/products`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ title: "No Cat", sku: "NC-1", price: 10, mrp: 12 }),
    });
    check("validation: product without category rejected (400)", missingCat.status === 400);
  }

  server.close();
  await disconnectDB();
  await mem.stop();

  console.log("\n" + results.join("\n"));
  console.log(`\n${failures === 0 ? "✅ ALL PASSED" : `❌ ${failures} FAILED`} (${results.length} checks)\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke test crashed:", err);
  process.exit(1);
});
