import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';

interface AutoPagerProps {
  children: string;
  progress: number;
}

// Function to safely wrap text nodes in spans for DOM manipulation
const wrapCharacters = (children: React.ReactNode): React.ReactNode => {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      return child.split('').map((char, i) => (
        <span key={i} className="liturgy-char transition-colors duration-200 ease-out text-[var(--color-monastery-muted)]">
          {char}
        </span>
      ));
    }
    if (React.isValidElement(child)) {
      const element = child as React.ReactElement<{ children?: React.ReactNode }>;
      return React.cloneElement(element, {
        children: wrapCharacters(element.props.children)
      });
    }
    return child;
  });
};

export const AutoPager: React.FC<AutoPagerProps> = ({ children, progress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const radius = 4000; // Adjusted for a slightly different curve

  useLayoutEffect(() => {
    const updateHeights = () => {
      if (containerRef.current && contentRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        setContentHeight(contentRef.current.scrollHeight);
      }
    };

    // Delay slightly to ensure fonts are loaded and layout is stable
    const timer = setTimeout(updateHeights, 100);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeights);
      if (containerRef.current) observer.observe(containerRef.current);
      if (contentRef.current) observer.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [children]);

  // High-performance DOM manipulation for character highlighting
  useEffect(() => {
    if (!contentRef.current) return;
    const chars = contentRef.current.querySelectorAll('.liturgy-char');
    const total = chars.length;
    if (total === 0) return;

    const targetIndex = Math.floor(progress * total);
    
    for (let i = 0; i < total; i++) {
      const el = chars[i] as HTMLElement;
      if (i <= targetIndex) {
        el.style.color = 'var(--color-monastery-accent)';
        el.style.opacity = '1';
      } else {
        el.style.color = 'var(--color-monastery-text)';
        el.style.opacity = '0.35';
      }
    }
  }, [progress, children]);

  // Calculate rotation and translation to keep the "current line" at roughly the same vertical spot
  const rotationAngle = (contentHeight * progress) / radius * (180 / Math.PI);
  // Keep the text scrolling naturally based on progress, without massive artificial offsets
  const translateY = -progress * contentHeight;

  return (
    <div ref={containerRef} className="relative overflow-hidden w-full h-full flex flex-col items-center justify-start pt-12 md:pt-20">
      <motion.div
        animate={{ 
          rotate: -rotationAngle,
          y: translateY
        }}
        transition={{ duration: 0.2, ease: "linear" }}
        style={{ 
          transformOrigin: `50% ${radius}px`,
          width: '100%'
        }}
        className="relative"
      >
        <div ref={contentRef} className="w-full text-center px-6 md:px-20 relative pb-40">
          <Markdown
            components={{
              p: ({ children }) => <p className="mb-10 text-2xl md:text-5xl leading-relaxed font-serif">{wrapCharacters(children)}</p>,
              h2: ({ children }) => <h2 className="font-serif text-4xl md:text-7xl mb-12 text-center text-[var(--color-monastery-accent)]">{wrapCharacters(children)}</h2>,
              em: ({ children }) => <em className="italic opacity-80">{children}</em>,
              strong: ({ children }) => <strong className="font-bold text-[var(--color-monastery-accent)]">{children}</strong>,
            }}
          >
            {children}
          </Markdown>
        </div>
      </motion.div>
    </div>
  );
};
