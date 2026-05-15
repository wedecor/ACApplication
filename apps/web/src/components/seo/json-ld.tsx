/**
 * Safely renders a JSON-LD payload as a `<script type="application/ld+json">`.
 *
 * IMPORTANT: We deliberately escape `<` to prevent any embedded HTML in
 * description / FAQ answer fields from breaking out of the script tag.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const payload = Array.isArray(data) ? data : [data];
  return (
    <>
      {payload.map((d, i) => (
        <script
          key={i}
          type="application/ld+json"
          // We're rendering JSON, not HTML — this is safe by construction.
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(d).replace(/</g, '\\u003c'),
          }}
        />
      ))}
    </>
  );
}
