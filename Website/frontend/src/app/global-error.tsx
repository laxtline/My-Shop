"use client";

/**
 * Global error boundary — the last-resort fallback if the root layout itself
 * throws. It must render its own <html>/<body> because it replaces the layout.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "Arial, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          textAlign: "center",
          color: "#0f172a",
        }}
      >
        <div>
          <p style={{ fontSize: 56 }}>⚠️</p>
          <h1>Something went wrong</h1>
          <p style={{ color: "#64748b" }}>The app hit an unexpected error.</p>
          <button
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
