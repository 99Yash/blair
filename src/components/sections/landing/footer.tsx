import { Sparkles } from 'lucide-react';
import { siteConfig } from '~/lib/site';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Transform your ideas into compelling content with AI-powered
            writing.
          </p>
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getUTCFullYear()} {siteConfig.name}. All rights
            reserved.
          </p>
          {/* Minimal footprint for side project: no extra nav links */}
        </div>
      </div>
    </footer>
  );
}
