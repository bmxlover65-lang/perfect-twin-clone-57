import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Renders its children at a fixed design width and scales the whole block down
 * so it always fits the available width (mobile / tablet), keeping the exact
 * desktop layout proportions.
 */
export function FitBoard({
  children,
  designWidth = 860,
  minScale = 0.62,
  className = "",
}: {
  children: ReactNode;
  designWidth?: number;
  minScale?: number;
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
      // Content can be wider than the nominal design width (long boards):
      // scale against the real content width so nothing is cut off.
      const contentW = Math.max(designWidth, i.scrollWidth || 0);
      const raw = w > 0 ? Math.min(1, w / contentW) : 1;
      const s = Math.max(minScale, raw);
      setScale(s);
      setHeight(i.offsetHeight * s);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [designWidth, minScale]);

  return (
    <div
      ref={outer}
      className={`w-full overflow-x-auto ${className}`}
      style={{ height: height ? height + 4 : undefined }}
    >
      <div style={{ width: designWidth * scale }}>
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

    </div>
  );
}

