import { BarChart, Globe, Shield, Sparkles, Wand2, Zap } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Writing',
    description:
      'Advanced AI models trained on millions of high-quality content pieces to generate compelling copy.',
  },
  {
    icon: Zap,
    title: 'Lightning Fast',
    description:
      'Generate complete articles, blog posts, and social media content in seconds, not hours.',
  },
  {
    icon: Globe,
    title: 'Multi-Language Support',
    description:
      'Create content in 25+ languages with native-level fluency and cultural awareness.',
  },
  {
    icon: BarChart,
    title: 'SEO Optimization',
    description:
      'Built-in SEO tools ensure your content ranks higher and reaches more people.',
  },
  {
    icon: Shield,
    title: 'Plagiarism Free',
    description:
      'Every piece of content is 100% original and passes all plagiarism detection tools.',
  },
  {
    icon: Wand2,
    title: 'Smart Templates',
    description:
      '50+ pre-built templates for blogs, ads, emails, and more to jumpstart your creativity.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 px-4 container mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Everything You Need to Create
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Powerful features designed to help you create professional content
          faster than ever before.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <Card
              key={index}
              className="border-border hover:border-primary/50 transition-colors"
            >
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
