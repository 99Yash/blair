import { Features } from '~/components/sections/features';
import { Footer } from '~/components/sections/footer';
import { Header } from '~/components/sections/header';
import { Hero } from '~/components/sections/hero';
import { Testimonials } from '~/components/sections/testimonials';

export default function Home() {
  return (
    <div className="">
      <Header />
      <Hero />
      <Features />
      <Testimonials />
      <Footer />
    </div>
  );
}
