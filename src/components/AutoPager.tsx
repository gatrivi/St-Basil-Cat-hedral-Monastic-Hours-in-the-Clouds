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

  const calculatePages = () => {
    if (containerRef.current && contentRef.current) {
      const containerH = containerRef.current.clientHeight;
      const contentH = contentRef.current.scrollHeight;
      
      setContainerHeight(containerH);

      if (contentH > containerH && containerH > 0) {
        // We add a bit of padding to avoid cutting the last line too close
        // and to give some breathing room
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
      return;
    }

    // Slow contemplative reading speed: 
    // Roughly 120 words per minute (2 words per second)
    const text = contentRef.current?.innerText || '';
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedTotalSeconds = (wordCount / 120) * 60;
    
    // We want at least 10 seconds per page, and we divide total time by pages
    const timePerPage = Math.max(10000, (estimatedTotalSeconds * 1000) / pages);

    const interval = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % pages);
    }, timePerPage);

    return () => clearInterval(interval);
  }, [isActive, pages, children]);

  return (
    <div ref={containerRef} className="relative overflow-hidden w-full h-full">
      <motion.div
        ref={contentRef}
        animate={{ y: -currentPage * containerHeight }}
        transition={{ 
          duration: 1.5, 
          ease: [0.4, 0, 0.2, 1],
          type: "spring",
          stiffness: 50,
          damping: 15
        }}
        className={`w-full ${pages === 1 ? 'min-h-full flex flex-col justify-center' : ''}`}
      >
        {children}
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
