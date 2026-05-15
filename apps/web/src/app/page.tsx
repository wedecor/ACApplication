import type { Metadata } from 'next';

import { BrandsMarquee } from '@/components/home/brands-marquee';
import { CitiesShowcase } from '@/components/home/cities-showcase';
import { Hero } from '@/components/home/hero';
import { ServiceGrid } from '@/components/home/service-grid';
import { ServiceProcess } from '@/components/home/service-process';
import { SocialProof } from '@/components/home/social-proof';
import { TechnicianShowcase } from '@/components/home/technician-showcase';
import { TestimonialsCarousel } from '@/components/home/testimonials-carousel';
import { WhyChooseUs } from '@/components/home/why-choose-us';
import { CtaBand } from '@/components/sections/cta-band';
import { Faq } from '@/components/sections/faq';
import { SITE_FAQS } from '@/content/faqs';
import { siteConfig } from '@/env';
import { fetchPublicStats } from '@/lib/public-api';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: `${siteConfig.name} — Home Appliance Repair, Same-Day`,
  description: siteConfig.description,
  path: '/',
  keywords: [
    'ac repair near me',
    'home appliance repair',
    'refrigerator repair',
    'washing machine repair',
    'microwave repair',
    'kitchen chimney service',
    'geyser repair',
    'urban service company',
  ],
});

export const revalidate = 300;

export default async function HomePage() {
  const stats = await fetchPublicStats({ revalidate: 60 });

  return (
    <>
      <Hero
        bookingsToday={stats.bookingsToday}
        rating={stats.averageRating}
        reviewCount={26_400}
      />
      <SocialProof
        households={25_000}
        repairs={130_000}
        cities={Math.max(stats.citiesLive, 3)}
        rating={stats.averageRating}
        reviewCount={18_400}
      />
      <BrandsMarquee />
      <ServiceGrid />
      <WhyChooseUs />
      <ServiceProcess />
      <TechnicianShowcase />
      <CitiesShowcase />
      <TestimonialsCarousel />
      <Faq items={SITE_FAQS} />
      <CtaBand />
    </>
  );
}
