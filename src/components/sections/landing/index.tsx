import { Features } from './features';
import { Footer } from './footer';
import { Hero } from './hero';
import { Testimonials } from './testimonials';

export function Landing() {
  return (
    <div>
      <Hero />
      <Features />
      <Testimonials />
      <Footer />
    </div>
  );
}
