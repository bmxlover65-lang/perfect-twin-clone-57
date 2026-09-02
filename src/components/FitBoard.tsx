import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children at a fixed design width and scales the whole block down
 * so it always fits the available width (mobile / tablet), keeping the exact
 * desktop layout proportions.
 */
export function FitBoard({
  children,
  designWidth = 860,
  className = "",
}: {
  children: ReactNode;
  designWidth?: number;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;

    const measure = () => {
      const w = o.clientWidth;
      const s = w > 0 ? Math.min(1, w / designWidth) : 1;
      setScale(s);
      setHeight(i.offsetHeight * s);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [designWidth]);

  return (
    <div ref={outer} className={`w-full ${className}`} style={{ height }}>
      <div
        ref={inner}
        style={{
          width: designWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}
