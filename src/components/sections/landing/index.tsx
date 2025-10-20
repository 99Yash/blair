import { Features } from './features';
import { Footer } from './footer';
import { Hero } from './hero';
import { HowItWorks } from './how-it-works';

export function Landing() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <Features />
      <Footer />
    </div>
  );
}
