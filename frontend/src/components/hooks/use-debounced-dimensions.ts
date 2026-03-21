// ABOUTME: Hook that tracks an element's width/height via resize events.
// ABOUTME: Returns debounced dimensions to avoid layout thrashing during resize.

import { type RefObject, useEffect, useState } from "react";

interface Dimensions {
  width: number;
  height: number;
}

export function useDimensions(ref: RefObject<HTMLElement | SVGElement | null>): Dimensions {
  const [dimensions, setDimensions] = useState<Dimensions>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const updateDimensions = () => {
      if (ref.current) {
        const { width, height } = ref.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    const debouncedUpdate = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDimensions, 250);
    };

    updateDimensions();

    window.addEventListener("resize", debouncedUpdate);

    return () => {
      window.removeEventListener("resize", debouncedUpdate);
      clearTimeout(timeoutId);
    };
  }, [ref]);

  return dimensions;
}
