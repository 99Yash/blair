import { headers } from 'next/headers';
import { Features } from '~/components/sections/landing/features';
import { Footer } from '~/components/sections/landing/footer';
import { Header } from '~/components/sections/landing/header';
import { Hero } from '~/components/sections/landing/hero';
import { Testimonials } from '~/components/sections/landing/testimonials';
import { auth } from '~/lib/auth/server';

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <div>
      {session ? (
        <div>
          <h1>Dashboard</h1>
        </div>
      ) : (
        <>
          <Header />
          <Hero />
          <Features />
          <Testimonials />
          <Footer />
        </>
      )}
    </div>
  );
}
