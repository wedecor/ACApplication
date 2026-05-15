'use client';

import Script from 'next/script';

import { siteConfig } from '@/env';

/**
 * Loads GA4, GTM, and Meta Pixel scripts using Next's `<Script>`
 * primitive. Strategy `afterInteractive` keeps the initial page render
 * unblocked (LCP / TBT priority). Each loader is conditional on the
 * relevant env var being present so dev builds stay quiet.
 *
 * Consent gating: in regulated geos this should be wrapped with a
 * cookie-consent provider before mounting. For India that's currently
 * not required, but we keep the surface small in case it changes.
 */
export function AnalyticsScripts() {
  const { gaId, gtmId, metaPixelId } = siteConfig.analytics;

  return (
    <>
      {/* Google Analytics 4 */}
      {gaId ? (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${gaId}', { send_page_view: true, anonymize_ip: true });
            `}
          </Script>
        </>
      ) : null}

      {/* Google Tag Manager */}
      {gtmId ? (
        <Script id="gtm-init" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `}
        </Script>
      ) : null}

      {/* Meta Pixel */}
      {metaPixelId ? (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      ) : null}
    </>
  );
}
