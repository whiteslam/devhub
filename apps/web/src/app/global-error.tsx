"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          background: "#0a0c0f",
          color: "#e7eaee",
          fontFamily: "system-ui",
          display: "grid",
          placeItems: "center",
          minHeight: "100dvh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 18 }}>DevHub hit an unexpected error</h1>
          {error.digest ? <p style={{ color: "#6b7483", fontFamily: "monospace", fontSize: 12 }}>ref {error.digest}</p> : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #2f3744",
              background: "#161a21",
              color: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
