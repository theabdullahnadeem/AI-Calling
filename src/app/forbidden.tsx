/**
 * Rendered by Next.js when a server component calls forbidden(). Deliberately
 * generic: it confirms nothing about what exists at the requested path.
 */
export default function Forbidden() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FAFAF8",
        fontFamily:
          "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <p style={{ color: "#161B22", fontSize: 14 }}>
        403 — you don&apos;t have access to this page.
      </p>
    </main>
  );
}
