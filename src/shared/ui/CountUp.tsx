import React, { useState, useEffect, useRef } from 'react';

interface CountUpProps {
  value: number;
  durationMs?: number;
  decimals?: number;
  suffix?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  durationMs = 800,
  decimals = 0,
  suffix = ''
}) => {
  const [count, setCount] = useState<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const progress = timestamp - startRef.current;
      const progressPercent = Math.min(progress / durationMs, 1);
      
      // Easing easeOutQuad: t * (2 - t)
      const easeOutQuad = (t: number) => t * (2 - t);
      const easedProgress = easeOutQuad(progressPercent);
      
      setCount(easedProgress * value);

      if (progress < durationMs) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [value, durationMs]);

  return <React.Fragment>{count.toFixed(decimals)}{suffix}</React.Fragment>;
};
