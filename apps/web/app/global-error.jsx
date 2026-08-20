'use client';

/**
 * Last-resort error boundary (audit F-10).
 *
 * `error.jsx` handles a failure inside a route; this one catches a failure in
 * the ROOT LAYOUT itself, where none of the app's providers, styles or chrome
 * are available. Next replaces the entire document, which is why this file has
 * to render its own `<html>` and `<body>` and cannot import the stylesheet or
 * any component that depends on context.
 *
 * Everything here is therefore deliberately plain and inline-styled. It is the
 * page nobody should ever see, and its only job is to not be a blank screen.
 */
export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#F7F7FA',
          color: '#1A1A2E',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <main style={{ maxWidth: '460px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '0 0 12px', lineHeight: 1.2 }}>
            Optex Opticians is temporarily unavailable
          </h1>
          <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#5A5F73', margin: '0 0 28px' }}>
            We hit an unexpected problem loading the site. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#2A3182',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 26px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <p style={{ fontSize: '13px', color: '#868CA1', margin: '28px 0 0' }}>
            Need help now? Call <a href="tel:+254700897007">+254 700 897 007</a>.
          </p>
          {error?.digest ? (
            <p style={{ fontSize: '12px', color: '#A0A6BC', margin: '14px 0 0' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
