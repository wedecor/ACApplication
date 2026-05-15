/**
 * Reserved top-level slugs that the dynamic `/[city]` route MUST NOT
 * shadow. Whenever a new top-level route is added (e.g. `/contact`,
 * `/lp`), add it here.
 *
 * The `[city]` route does its own `getCityBySlug` lookup and falls
 * back to `notFound()` if the slug isn't in `CITIES`. This list is a
 * defence-in-depth: if a future city happens to share a name with a
 * static route we'd crash builds, so we explicitly enumerate.
 */
export const RESERVED_TOP_LEVEL_SLUGS = new Set<string>([
  'about',
  'admin',
  'amc',
  'api',
  'areas',
  'blog',
  'book',
  'brands',
  'cart',
  'cities',
  'contact',
  'customer',
  'emergency',
  'login',
  'lp',
  'membership',
  'order',
  'pricing',
  'privacy',
  'search',
  'services',
  'sitemap.xml',
  'robots.txt',
  'terms',
  'thank-you',
  'whatsapp',
]);
