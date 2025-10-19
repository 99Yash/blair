import { RefObject, useEffect, useState } from 'react';

/**
 * ResizeObserver to react to changes in an element's size
 * More about ResizeObserver: https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver
 * Source: https://github.com/dubinc/dub/blob/a573af382069bf9b4b3c7a4e2e73f41122b01792/packages/ui/src/hooks/use-resize-observer.ts
 */
export function useResizeObserver(
  elementRef: RefObject<Element>
): ResizeObserverEntry | undefined {
  const [entry, setEntry] = useState<ResizeObserverEntry>();

  const updateEntry = ([entry]: ResizeObserverEntry[]): void => {
    setEntry(entry);
  };

  useEffect(() => {
    const node = elementRef?.current;
    if (!node) return;

    const observer = new ResizeObserver(updateEntry);

    observer.observe(node);

    return () => observer.disconnect();
  }, [elementRef]);

  return entry;
}
