# Generates Ramachandra_Traders_Presentation.pptx and Ramachandra_Traders_Report.docx
# Run: python scripts/build_docs.py
import os
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR

from docx import Document
from docx.shared import Pt as DPt, RGBColor as DRGB, Inches as DInches
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ---- Brand palette (from shared/constants) -------------------------------
BRAND = RGBColor(0x25, 0x63, 0xEB)      # #2563eb
DARK = RGBColor(0x0F, 0x17, 0x2A)       # slate-900
SLATE = RGBColor(0x47, 0x55, 0x69)      # slate-600
LIGHT = RGBColor(0xF1, 0xF5, 0xF9)      # slate-100
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
ACCENT = RGBColor(0x05, 0x96, 0x69)     # emerald-600

APP = "Ramachandra Traders"
TAGLINE = "Everything for Your Dream Home — From Cement to Color, All in One Place."

# ==========================================================================
# PRESENTATION
# ==========================================================================
def build_pptx():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    SW, SH = prs.slide_width, prs.slide_height
    blank = prs.slide_layouts[6]

    def slide():
        return prs.slides.add_slide(blank)

    def rect(s, x, y, w, h, color):
        sp = s.shapes.add_shape(1, x, y, w, h)  # rectangle
        sp.fill.solid(); sp.fill.fore_color.rgb = color
        sp.line.fill.background()
        sp.shadow.inherit = False
        return sp

    def text(s, x, y, w, h, runs, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, space=6):
        tb = s.shapes.add_textbox(x, y, w, h); tf = tb.text_frame
        tf.word_wrap = True; tf.vertical_anchor = anchor
        first = True
        for item in runs:
            txt, size, color, bold = item
            p = tf.paragraphs[0] if first else tf.add_paragraph()
            first = False
            p.alignment = align; p.space_after = Pt(space)
            r = p.add_run(); r.text = txt
            r.font.size = Pt(size); r.font.bold = bold
            r.font.color.rgb = color; r.font.name = "Segoe UI"
        return tb

    def header(s, title, num):
        rect(s, 0, 0, SW, Inches(1.15), BRAND)
        text(s, Inches(0.6), Inches(0.18), Inches(11), Inches(0.8),
             [(title, 30, WHITE, True)], anchor=MSO_ANCHOR.MIDDLE)
        text(s, Inches(12.2), Inches(0.18), Inches(0.9), Inches(0.8),
             [(f"{num:02d}", 18, RGBColor(0xBF,0xD4,0xFE), True)],
             align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
        rect(s, 0, Inches(1.15), SW, Pt(4), ACCENT)

    def bullets(s, items, x=Inches(0.8), y=Inches(1.6), w=Inches(11.7), size=18, gap=10):
        tb = s.shapes.add_textbox(x, y, w, SH - y - Inches(0.5))
        tf = tb.text_frame; tf.word_wrap = True
        first = True
        for it in items:
            lvl = 0; txt = it
            if isinstance(it, tuple): txt, lvl = it
            p = tf.paragraphs[0] if first else tf.add_paragraph(); first = False
            p.space_after = Pt(gap); p.level = lvl
            bullet = "•   " if lvl == 0 else "–   "
            r = p.add_run(); r.text = bullet + txt
            r.font.size = Pt(size - lvl*2); r.font.color.rgb = DARK if lvl==0 else SLATE
            r.font.name = "Segoe UI"
        return tb

    # ---- Slide 1: Title ----
    s = slide()
    rect(s, 0, 0, SW, SH, DARK)
    rect(s, 0, 0, Inches(0.35), SH, BRAND)
    rect(s, 0, SH - Inches(0.35), SW, Inches(0.35), ACCENT)
    text(s, Inches(1), Inches(2.2), Inches(11.3), Inches(1.4),
         [(APP, 54, WHITE, True)])
    text(s, Inches(1), Inches(3.5), Inches(11), Inches(1),
         [(TAGLINE, 22, RGBColor(0x94,0xA3,0xB8), False)])
    text(s, Inches(1), Inches(4.8), Inches(11), Inches(1.2),
         [("Full-Stack E-commerce Platform  •  TypeScript Monorepo", 20, BRAND, True),
          ("Next.js 15  ·  React 19  ·  Express  ·  MongoDB  ·  Tailwind  ·  Redux Toolkit", 15, RGBColor(0xCB,0xD5,0xE1), False)])
    text(s, Inches(1), Inches(6.6), Inches(11), Inches(0.6),
         [("Project by SURYA", 14, RGBColor(0x64,0x74,0x8B), False)])

    # ---- Slide 2: Problem & Solution ----
    s = slide(); header(s, "Problem & Solution", 2)
    text(s, Inches(0.8), Inches(1.5), Inches(5.7), Inches(0.5),
         [("The Problem", 20, BRAND, True)])
    bullets(s, [
        "Building-material shops (tiles, paints, electrical, interiors) rely on phone calls and walk-ins.",
        "No single online catalog; prices, stock and bulk rates are hard to share.",
        "Customers can't browse, compare or order online.",
    ], x=Inches(0.8), y=Inches(2.0), w=Inches(5.6), size=15, gap=10)
    text(s, Inches(6.9), Inches(1.5), Inches(5.7), Inches(0.5),
         [("The Solution", 20, ACCENT, True)])
    bullets(s, [
        "A branded e-commerce platform for Tiles, Paints, Electrical & Home Interiors.",
        "Searchable catalog with filters, bulk pricing and GST-ready data.",
        "Secure Google login, cart, wishlist & COD checkout with order tracking.",
        "Admin dashboard to manage the catalog and fulfil orders.",
        "Verified end-to-end by an automated smoke test (in-memory MongoDB).",
        "One codebase serving web today and mobile apps later.",
    ], x=Inches(6.9), y=Inches(2.0), w=Inches(5.6), size=15, gap=10)

    # ---- Slide 3: Tech Stack ----
    s = slide(); header(s, "Technology Stack", 3)
    cols = [
        ("Frontend", [ "Next.js 15 (App Router)", "React 19 + TypeScript", "Tailwind CSS", "Redux Toolkit", "@react-oauth/google" ]),
        ("Backend", [ "Node.js + Express 4", "TypeScript (tsx)", "Mongoose 8 / MongoDB", "JWT + google-auth-library", "Helmet · CORS · rate-limit" ]),
        ("Shared & Tooling", [ "@shared/* types package", "Single API contract", "Git monorepo", "MongoDB Atlas (cloud)", "Vercel + Render (deploy)" ]),
    ]
    cw = Inches(3.9); gap = Inches(0.3); x0 = Inches(0.7); y0 = Inches(1.7)
    for i,(title, items) in enumerate(cols):
        x = x0 + i*(cw+gap)
        rect(s, x, y0, cw, Inches(5.0), LIGHT)
        rect(s, x, y0, cw, Inches(0.7), BRAND)
        text(s, x, y0, cw, Inches(0.7), [(title, 18, WHITE, True)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        bullets(s, items, x=x+Inches(0.3), y=y0+Inches(0.95), w=cw-Inches(0.6), size=15, gap=12)

    # ---- Slide 4: Architecture ----
    s = slide(); header(s, "Architecture", 4)
    def box(x, y, w, h, title, sub, color, tcolor=WHITE):
        rect(s, x, y, w, h, color)
        text(s, x, y+Inches(0.12), w, h-Inches(0.2),
             [(title, 16, tcolor, True), (sub, 11, tcolor, False)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE, space=2)
    box(Inches(1.0), Inches(2.6), Inches(2.7), Inches(1.5), "Browser", "Next.js 15 + Redux", DARK)
    box(Inches(5.3), Inches(2.6), Inches(2.7), Inches(1.5), "Express API", "REST  /api/*", BRAND)
    box(Inches(9.6), Inches(2.6), Inches(2.7), Inches(1.5), "MongoDB", "Mongoose models", ACCENT)
    # arrows
    for ax in [Inches(3.8), Inches(8.1)]:
        a = s.shapes.add_shape(1, ax, Inches(3.25), Inches(1.4), Pt(6));
        a.fill.solid(); a.fill.fore_color.rgb = SLATE; a.line.fill.background()
    text(s, Inches(1.0), Inches(4.4), Inches(11.3), Inches(0.5),
         [("HTTPS + httpOnly JWT cookie  →  verified per request  →  Mongoose queries", 14, SLATE, False)],
         align=PP_ALIGN.CENTER)
    box(Inches(4.6), Inches(5.4), Inches(4.1), Inches(1.1), "shared/  (@shared/*)",
        "One set of TypeScript types & contracts used by every app", RGBColor(0x33,0x41,0x55))

    # ---- Slide 5: Features ----
    s = slide(); header(s, "Key Features", 5)
    feats = [
        "Google OAuth sign-in with JWT sessions in httpOnly cookies",
        "Role-based access control — ADMIN vs USER, enforced server-side",
        "Catalog API: products & categories with filter, sort & pagination",
        "Cart & wishlist per user",
        "Full-text product search",
        "Dynamic branding (name, logo, theme) loaded from the database",
        "Real commerce data: bulk-pricing tiers, GST, SKU, stock, discounts",
        "Security: Helmet, CORS allow-list, two-tier rate limiting, body caps",
    ]
    # two columns
    bullets(s, feats[:4], x=Inches(0.8), y=Inches(1.7), w=Inches(5.7), size=16, gap=14)
    bullets(s, feats[4:], x=Inches(6.9), y=Inches(1.7), w=Inches(5.7), size=16, gap=14)

    # ---- Slide 6: API ----
    s = slide(); header(s, "REST API Overview", 6)
    api = [
        ("PUBLIC", BRAND, [
            "GET  /api/health   /api/brand",
            "GET  /api/categories[/:slug]",
            "GET  /api/products  (filters, sort, page)",
            "GET  /api/products/:slug   /api/search?q=",
        ]),
        ("AUTH (USER)", ACCENT, [
            "POST /api/auth/google   /api/auth/logout",
            "GET  /api/auth/me",
            "GET/POST/PUT/DELETE  /api/cart...",
            "GET/POST/DELETE      /api/wishlist...",
            "POST /api/orders   GET /api/orders/:id",
        ]),
        ("ADMIN", RGBColor(0xB4,0x53,0x09), [
            "POST/PUT/DELETE  /api/products",
            "POST/PUT/DELETE  /api/categories",
            "GET /api/orders/admin/all  PATCH /:id/status",
            "Envelope: { success, data?, message? }",
        ]),
    ]
    y = Inches(1.6)
    for title, color, lines in api:
        rect(s, Inches(0.8), y, Inches(2.6), Inches(1.55), color)
        text(s, Inches(0.8), y, Inches(2.6), Inches(1.55), [(title, 15, WHITE, True)],
             align=PP_ALIGN.CENTER, anchor=MSO_ANCHOR.MIDDLE)
        tb = s.shapes.add_textbox(Inches(3.7), y, Inches(8.8), Inches(1.55))
        tf = tb.text_frame; tf.word_wrap = True; first=True
        for ln in lines:
            p = tf.paragraphs[0] if first else tf.add_paragraph(); first=False
            r = p.add_run(); r.text = ln; r.font.size = Pt(13)
            r.font.name = "Consolas"; r.font.color.rgb = DARK
        y += Inches(1.75)

    # ---- Slide 7: Roadmap ----
    s = slide(); header(s, "Build Roadmap", 7)
    phases = [
        ("Phase 0", "Foundation · Google login · dynamic branding · JWT/RBAC", True),
        ("Phase 1", "Catalog backend · cart · wishlist · search · demo data", True),
        ("Phase 2", "Storefront UI — home, listings, product page, cart, wishlist, search", True),
        ("Phase 3", "COD checkout · orders · order tracking · admin dashboard", True),
        ("Phase 4", "Online payments (Razorpay) · reviews · invoices · SEO", False),
        ("Phase 5", "Android & iOS apps (Expo) on the same shared API", False),
    ]
    y = Inches(1.6)
    for name, desc, done in phases:
        c = ACCENT if done else RGBColor(0xCB,0xD5,0xE1)
        rect(s, Inches(0.8), y, Inches(0.45), Inches(0.7), c)
        mark = "DONE" if done else "TODO"
        text(s, Inches(1.4), y, Inches(2.0), Inches(0.7),
             [(name, 17, DARK, True)], anchor=MSO_ANCHOR.MIDDLE)
        text(s, Inches(3.3), y, Inches(8.0), Inches(0.7),
             [(desc, 14, SLATE, False)], anchor=MSO_ANCHOR.MIDDLE)
        text(s, Inches(11.4), y, Inches(1.3), Inches(0.7),
             [(mark, 12, ACCENT if done else RGBColor(0x94,0xA3,0xB8), True)],
             align=PP_ALIGN.RIGHT, anchor=MSO_ANCHOR.MIDDLE)
        y += Inches(0.82)

    # ---- Slide 8: Closing ----
    s = slide()
    rect(s, 0, 0, SW, SH, DARK)
    rect(s, 0, 0, Inches(0.35), SH, BRAND)
    text(s, Inches(1), Inches(2.6), Inches(11), Inches(1.2),
         [("Thank You", 48, WHITE, True)])
    text(s, Inches(1), Inches(3.9), Inches(11), Inches(1.5),
         [("A production-style, secure, end-to-end TypeScript e-commerce platform —", 18, RGBColor(0xCB,0xD5,0xE1), False),
          ("architected to grow from web to mobile on a single shared contract.", 18, RGBColor(0xCB,0xD5,0xE1), False)], space=4)
    text(s, Inches(1), Inches(5.6), Inches(11), Inches(0.6),
         [("Live demo + GitHub  →  see  'best free way to live this project for free.txt'", 15, BRAND, True)])

    out = os.path.join(ROOT, "Ramachandra_Traders_Presentation.pptx")
    prs.save(out)
    return out

# ==========================================================================
# WORD REPORT
# ==========================================================================
def build_docx():
    doc = Document()
    styles = doc.styles
    styles["Normal"].font.name = "Calibri"
    styles["Normal"].font.size = DPt(11)

    def h(text, size, color, bold=True, before=12, after=6, align=None):
        p = doc.add_paragraph(); p.space_before = DPt(before); p.space_after = DPt(after)
        if align is not None: p.alignment = align
        r = p.add_run(text); r.bold = bold; r.font.size = DPt(size); r.font.color.rgb = color
        return p

    def para(text, size=11, color=DRGB(0x1F,0x2A,0x37)):
        p = doc.add_paragraph(); r = p.add_run(text); r.font.size = DPt(size); r.font.color.rgb = color
        return p

    def bullet(text):
        p = doc.add_paragraph(style="List Bullet"); p.add_run(text); return p

    BRANDD = DRGB(0x25,0x63,0xEB); DARKD = DRGB(0x0F,0x17,0x2A); SLATED = DRGB(0x47,0x55,0x69)

    # Title block
    h(APP, 28, BRANDD, align=WD_ALIGN_PARAGRAPH.CENTER, before=40, after=2)
    h(TAGLINE, 13, SLATED, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, before=0, after=4)
    h("Full-Stack E-commerce Platform — Project Report", 14, DARKD,
      align=WD_ALIGN_PARAGRAPH.CENTER, before=8, after=2)
    h("Next.js 15 · React 19 · Express · MongoDB · TypeScript Monorepo", 11, SLATED, bold=False,
      align=WD_ALIGN_PARAGRAPH.CENTER, before=0, after=2)
    h("Prepared by SURYA", 10, SLATED, bold=False, align=WD_ALIGN_PARAGRAPH.CENTER, before=6)
    doc.add_page_break()

    # 1. Abstract
    h("1. Abstract", 16, BRANDD)
    para("Ramachandra Traders is a production-style e-commerce platform for a building-materials "
         "and home-interiors business covering Tiles, Paints, Electrical and Home Interiors. It is "
         "built end-to-end in TypeScript as a monorepo: a Next.js 15 web frontend, an Express + "
         "MongoDB REST backend, and a shared types package that defines the API contract once for "
         "every client. The system features Google OAuth authentication, JWT sessions in httpOnly "
         "cookies, role-based access control, a fully-featured product catalog API, cart and "
         "wishlist, search, a responsive server-rendered storefront (home, catalog with "
         "filters/sorting/pagination, product detail, cart and wishlist pages), a "
         "Cash-on-Delivery checkout with server-authoritative pricing, per-user order history "
         "and tracking, an admin dashboard for order fulfilment, and database-driven dynamic "
         "branding.")

    # 2. Objectives
    h("2. Objectives", 16, BRANDD)
    for b in [
        "Bring a building-materials store online with a searchable, filterable catalog.",
        "Provide secure authentication and role-based admin control of the catalog.",
        "Model real commerce data: bulk-pricing tiers, GST, SKU, stock and discounts.",
        "Use a single shared type layer to keep web (and future mobile) apps in sync.",
        "Follow production security practices and deploy on free cloud infrastructure.",
    ]:
        bullet(b)

    # 3. Technology Stack
    h("3. Technology Stack", 16, BRANDD)
    table = doc.add_table(rows=1, cols=2); table.style = "Light Grid Accent 1"
    table.rows[0].cells[0].paragraphs[0].add_run("Layer").bold = True
    table.rows[0].cells[1].paragraphs[0].add_run("Technologies").bold = True
    rows = [
        ("Frontend", "Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Redux Toolkit, @react-oauth/google"),
        ("Backend", "Node.js, Express 4, TypeScript (tsx), Mongoose 8, JSON Web Tokens, google-auth-library"),
        ("Security", "Helmet, CORS allow-list, express-rate-limit (two-tier), 1 MB body cap, env validation"),
        ("Database", "MongoDB (local or MongoDB Atlas free tier)"),
        ("Shared", "@shared/* TypeScript types, contracts and constants — single source of truth"),
        ("Deployment", "Vercel (frontend), Render (backend), MongoDB Atlas (database) — all free tiers"),
    ]
    for layer, tech in rows:
        c = table.add_row().cells
        c[0].paragraphs[0].add_run(layer).bold = True
        c[1].text = tech

    # 4. System Architecture
    h("4. System Architecture", 16, BRANDD)
    para("The platform is a monorepo with three first-class apps plus a shared layer:")
    for b in [
        "Website/frontend — Next.js 15 app; Redux Toolkit state; calls the API with credentials.",
        "Website/backend — Express REST API under /api/*, organised as routes → controllers → models.",
        "shared/ — TypeScript types and the response envelope { success, data?, message? }, imported via @shared/*.",
        "AndroidApp/ and iOSApp/ — React Native (Expo) placeholders for a later phase, reusing the same API.",
    ]:
        bullet(b)
    para("Request flow: the browser sends an httpOnly JWT cookie with each request; the backend "
         "verifies it, applies role checks, runs Mongoose queries against MongoDB, and returns the "
         "standard JSON envelope. Because all apps import the same shared types, the client and "
         "server can never drift out of contract.")

    # 5. Features
    h("5. Key Features", 16, BRANDD)
    for b in [
        "Google OAuth sign-in; ID token verified server-side; JWT issued in an httpOnly cookie.",
        "Role-based access control: a fixed admin email is ADMIN, everyone else is USER.",
        "Product catalog with category/brand/price/rating/discount filters, five sort modes and pagination.",
        "Per-user cart and wishlist.",
        "Full-text product search.",
        "Dynamic branding (app name, logo, theme colour, support details) loaded from the database.",
        "Commerce data modelling: bulk-pricing tiers, GST rate, SKU, stock, MRP/discount, ratings, specs.",
        "Seed scripts that create 4 categories and 32 demo products for instant setup.",
    ]:
        bullet(b)

    # 6. API
    h("6. REST API Summary", 16, BRANDD)
    api_table = doc.add_table(rows=1, cols=3); api_table.style = "Light Grid Accent 1"
    hdr = api_table.rows[0].cells
    for i, t in enumerate(["Access", "Method", "Endpoint"]):
        hdr[i].paragraphs[0].add_run(t).bold = True
    api_rows = [
        ("Public", "GET", "/api/health, /api/brand"),
        ("Public", "GET", "/api/categories, /api/categories/:slug"),
        ("Public", "GET", "/api/products (filters, sort, page), /api/products/:slug"),
        ("Public", "GET", "/api/search?q="),
        ("Auth", "POST", "/api/auth/google, /api/auth/logout"),
        ("Auth", "GET", "/api/auth/me"),
        ("User", "GET/POST/PUT/DELETE", "/api/cart, /api/cart/add|update|remove/:id"),
        ("User", "GET/POST/DELETE", "/api/wishlist, /api/wishlist/add|remove/:id"),
        ("User", "POST/GET/PATCH", "/api/orders, /api/orders/:id, /api/orders/:id/cancel"),
        ("Admin", "GET/PATCH", "/api/orders/admin/all, /api/orders/:id/status"),
        ("Admin", "POST/PUT/DELETE", "/api/products, /api/categories"),
    ]
    for a, m, e in api_rows:
        c = api_table.add_row().cells
        c[0].text = a; c[1].text = m; c[2].text = e

    # 7. Security
    h("7. Security Measures", 16, BRANDD)
    for b in [
        "JWT stored in an httpOnly cookie (not readable by JavaScript) to mitigate XSS token theft.",
        "CORS locked to the configured client origin with credentials enabled.",
        "Helmet sets safe HTTP response headers; request body capped at 1 MB.",
        "Two-tier rate limiting: global (300/15 min) plus a stricter auth limiter (20/15 min).",
        "Admin-only write endpoints enforced server-side via middleware — never trusted from the client.",
        "Environment variables validated at startup; secrets are never committed to Git.",
    ]:
        bullet(b)

    # 8. Roadmap
    h("8. Build Roadmap", 16, BRANDD)
    rmap = [
        ("Phase 0", "Foundation, Google login gate, dynamic branding, JWT/RBAC", "Complete"),
        ("Phase 1", "Catalog backend, cart, wishlist, search, demo seed data", "Complete"),
        ("Phase 2", "Storefront UI: home, listings, product detail, cart, wishlist, search", "Complete"),
        ("Phase 3", "COD checkout, orders, order tracking, admin dashboard", "Complete"),
        ("Phase 4", "Online payments (Razorpay), reviews, invoices, SEO", "Planned"),
        ("Phase 5", "Android & iOS apps (Expo) on the shared API", "Planned"),
    ]
    rt = doc.add_table(rows=1, cols=3); rt.style = "Light Grid Accent 1"
    hd = rt.rows[0].cells
    for i,t in enumerate(["Phase", "Scope", "Status"]):
        hd[i].paragraphs[0].add_run(t).bold = True
    for name, scope, status in rmap:
        c = rt.add_row().cells
        c[0].paragraphs[0].add_run(name).bold = True
        c[1].text = scope; c[2].text = status

    # 9. How to Run
    h("9. How to Run (Local)", 16, BRANDD)
    para("Backend (Terminal 1):", 11, DARKD)
    for ln in ["cd Website/backend", "cp .env.example .env   # fill in MONGODB_URI, GOOGLE_CLIENT_ID, JWT_SECRET",
               "npm install", "npm run seed", "npm run dev   # http://localhost:5000"]:
        p = doc.add_paragraph(); r = p.add_run("    " + ln); r.font.name = "Consolas"; r.font.size = DPt(10)
    para("Frontend (Terminal 2):", 11, DARKD)
    for ln in ["cd Website/frontend", "cp .env.local.example .env.local   # set NEXT_PUBLIC_* values",
               "npm install", "npm run dev   # http://localhost:3000"]:
        p = doc.add_paragraph(); r = p.add_run("    " + ln); r.font.name = "Consolas"; r.font.size = DPt(10)
    para("Verify (no .env or internet needed):", 11, DARKD)
    for ln in ["cd Website/backend", "npm run test:smoke   # boots the API on in-memory MongoDB"]:
        p = doc.add_paragraph(); r = p.add_run("    " + ln); r.font.name = "Consolas"; r.font.size = DPt(10)
    para("Full guide: run.txt (English) or HOW_TO_RUN_PROJECT.txt (detailed). "
         "Free hosting: 'best free way to live this project for free.txt'.")

    # 10. Conclusion
    h("10. Conclusion", 16, BRANDD)
    para("Ramachandra Traders demonstrates end-to-end full-stack engineering: a clean monorepo "
         "architecture, secure authentication and authorization, a well-structured REST API, "
         "realistic data modelling, and a clear, phased roadmap from web to mobile. The foundation, "
         "the complete catalog backend, the responsive storefront UI, a Cash-on-Delivery checkout "
         "with order tracking, and an admin order-management dashboard are all built; online "
         "payments (Razorpay) and further polish are the next phases, and the project is ready to "
         "deploy to free cloud infrastructure for a public, resume-ready demo. The catalog -> "
         "cart -> checkout -> order-tracking -> admin flow is verified end-to-end by an "
         "automated smoke test that runs the real server against an in-memory MongoDB.")

    out = os.path.join(ROOT, "Ramachandra_Traders_Report.docx")
    doc.save(out)
    return out

if __name__ == "__main__":
    p1 = build_pptx()
    p2 = build_docx()
    print("Created:", p1)
    print("Created:", p2)
