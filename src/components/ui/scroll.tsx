import * as React from 'react';
import { RefObject } from 'react';
import { useScrollProgress } from '~/hooks/use-scroll-progress';

export function Scroll({ children }: React.PropsWithChildren) {
  const ref = React.useRef<HTMLDivElement>(null);

  const { scrollProgress, updateScrollProgress } = useScrollProgress(
    ref as RefObject<HTMLElement>
  );

  return (
    <>
      <div
        className="scrollbar-hide max-h-[min(50vh,250px)] w-screen overflow-y-scroll sm:w-auto"
        ref={ref}
        onScroll={updateScrollProgress}
      >
        {children}
      </div>
      {/* Bottom scroll fade */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 hidden h-5 w-full rounded-b-md bg-gradient-to-t from-gray-25 sm:block"
        style={{
          opacity: scrollProgress === 1 ? 0 : 0.95 + 0.05 * scrollProgress,
        }}
      />
    </>
  );
}
