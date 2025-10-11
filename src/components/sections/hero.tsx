import { ArrowRight, Badge, Sparkles, Zap } from 'lucide-react';
import { siteConfig } from '~/lib/site';
import { Button } from '../ui/button';

export function Hero() {
  return (
    <section className="pt-32 pb-20 px-4 container mx-auto">
      <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
        <Badge className="mb-6 px-4 py-2">
          <Sparkles className="h-3 w-3 mr-2" />
          Powered by Advanced AI
        </Badge>

        <h1 className="text-5xl md:text-7xl font-bold font-sans tracking-tight mb-6 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
          Create Amazing Content
          <br />
          in Seconds
        </h1>

        <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Transform your ideas into compelling content with our AI-powered
          writing assistant. From blog posts to social media, create
          professional content 10x faster.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-12">
          <Button size="lg" className="text-base">
            Start Writing Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button size="lg" variant="outline" className="text-base">
            Watch Demo
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            No credit card required
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            50+ content templates
          </div>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            10,000+ happy users
          </div>
        </div>

        {/* Hero Image/Illustration */}
        <div className="mt-16 w-full max-w-5xl">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-border shadow-2xl bg-gradient-to-br from-primary/10 to-secondary">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=675&fit=crop"
              alt={`${siteConfig.name} Dashboard`}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
