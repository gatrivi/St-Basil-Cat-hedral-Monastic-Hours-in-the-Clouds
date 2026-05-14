import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion } from 'motion/react';

interface AutoPagerProps {
  children: React.ReactNode;
  isActive?: boolean;
}

export const AutoPager: React.FC<AutoPagerProps> = ({ children, isActive = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const [progress, setProgress] = useState(0);

  const calculatePages = () => {
    if (containerRef.current && contentRef.current) {
      const containerH = containerRef.current.clientHeight;
      const contentH = contentRef.current.scrollHeight;
      
      setContainerHeight(containerH);

      if (contentH > containerH && containerH > 0) {
        const numPages = Math.ceil(contentH / containerH);
        setPages(numPages);
      } else {
        setPages(1);
        setCurrentPage(0);
      }
    }
  };

  useLayoutEffect(() => {
    calculatePages();
    
    const observer = new ResizeObserver(() => {
      calculatePages();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [children]);

  useEffect(() => {
    if (!isActive || pages <= 1) {
      setCurrentPage(0);
      setProgress(0);
      return;
    }

    const text = contentRef.current?.innerText || '';
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedTotalSeconds = (wordCount / 120) * 60;
    const timePerPage = Math.max(10000, (estimatedTotalSeconds * 1000) / pages);

    let start: number | null = null;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      const newProgress = Math.min(1, elapsed / timePerPage);
      
      setProgress(newProgress);

      if (elapsed < timePerPage) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCurrentPage((prev) => (prev + 1) % pages);
        start = null; // Reset for next page
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrame);
  }, [isActive, pages, children]);

  return (
    <div 
      ref={containerRef} 
      className="relative overflow-hidden w-full h-full"
      style={{ '--reading-progress': `${progress * 100}%` } as React.CSSProperties}
    >
      <motion.div
        animate={{ y: -currentPage * containerHeight }}
        transition={{ 
          duration: 1.5, 
          ease: [0.4, 0, 0.2, 1],
          type: "spring",
          stiffness: 50,
          damping: 15
        }}
        className={`w-full ${pages === 1 ? 'min-h-full flex flex-col justify-center' : ''} relative`}
      >
        {/* Base Layer (White/Muted text) */}
        <div ref={contentRef} className="w-full opacity-40">
          {children}
        </div>

        {/* Highlight Layer (Gold text) */}
        <div 
          className="absolute inset-0 w-full select-none pointer-events-none text-[var(--color-monastery-accent)]"
          style={{ 
            clipPath: `inset(0 0 ${100 - (progress * 100)}% 0)`,
            display: pages === 1 ? 'flex' : 'block',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {children}
        </div>
      </motion.div>
      
      {pages > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 z-10">
          {Array.from({ length: pages }).map((_, i) => (
            <motion.div
              key={i}
              initial={false}
              animate={{ 
                width: i === currentPage ? 24 : 8,
                opacity: i === currentPage ? 1 : 0.3,
                backgroundColor: i === currentPage ? 'var(--color-monastery-accent)' : '#fff'
              }}
              className="h-1 rounded-full cursor-pointer"
              onClick={() => setCurrentPage(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
