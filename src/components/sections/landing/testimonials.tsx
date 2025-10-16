import { Star } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Card, CardContent } from '~/components/ui/card';
import { siteConfig } from '~/lib/site';

const testimonials = [
  {
    name: 'Sarah Johnson',
    role: 'Content Marketing Manager',
    image:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    content:
      '{siteConfig.name} has completely transformed how we create content. What used to take hours now takes minutes. The quality is consistently excellent.',
    rating: 5,
  },
  {
    name: 'Michael Chen',
    role: 'Freelance Writer',
    image:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    content:
      'As a freelancer, this tool has doubled my productivity. I can take on more clients and deliver faster without compromising quality.',
    rating: 5,
  },
  {
    name: 'Emily Rodriguez',
    role: 'Social Media Manager',
    image:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    content:
      "The social media templates are a game-changer. I can create a week's worth of engaging posts in under an hour. Absolutely love it!",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="py-20 px-4 container mx-auto bg-muted/30"
    >
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold mb-4">
          Loved by Content Creators
        </h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Join thousands of writers, marketers, and businesses who trust{' '}
          {siteConfig.name}
          for their content needs.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {testimonials.map((testimonial, index) => (
          <Card key={index} className="border-border">
            <CardContent className="pt-6">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: testimonial.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-muted-foreground mb-6">
                &ldquo;{testimonial.content}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={testimonial.image} alt={testimonial.name} />
                  <AvatarFallback>
                    {testimonial.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
