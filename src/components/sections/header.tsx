'use client';

import { Menu, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { siteConfig } from '~/lib/site';
import { Button } from '../ui/button';

const containerVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: 'auto',
  },
  exit: { opacity: 0, height: 0 },
};

const itemVariants = {
  hidden: { y: -10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
  },
  exit: { y: -10, opacity: 0 },
};

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Handle clicking outside to close mobile menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node)
      ) {
        setMobileMenuOpen(false);
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [mobileMenuOpen]);

  return (
    <header className="fixed top-0 w-full bg-background/80 backdrop-blur-md z-50 border-b border-border">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">{siteConfig.name}</span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="#features"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Features
          </Link>
          <Link
            href="#testimonials"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Testimonials
          </Link>
          <Link
            href="#pricing"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="#about"
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            About
          </Link>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Button variant="ghost" size="sm">
            Sign In
          </Button>
          <Button size="sm">Get Started</Button>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            ref={mobileMenuRef}
            className="md:hidden border-t border-border bg-background"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
          >
            <div className="container mx-auto px-4 py-4 flex flex-col gap-4">
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0,
                }}
              >
                <Link
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium hover:text-primary transition-colors block"
                >
                  Features
                </Link>
              </motion.div>
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.075,
                }}
              >
                <Link
                  href="#testimonials"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium hover:text-primary transition-colors block"
                >
                  Testimonials
                </Link>
              </motion.div>
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.15,
                }}
              >
                <Link
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium hover:text-primary transition-colors block"
                >
                  Pricing
                </Link>
              </motion.div>
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.225,
                }}
              >
                <Link
                  href="#about"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm font-medium hover:text-primary transition-colors block"
                >
                  About
                </Link>
              </motion.div>
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{
                  duration: 0.25,
                  ease: [0.4, 0, 0.2, 1],
                  delay: 0.3,
                }}
                className="flex flex-col gap-2 pt-2"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
