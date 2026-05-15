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
      return React.cloneElement(child as React.ReactElement<any>, {
        children: wrapCharacters(child.props.children)
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

  const radius = 5000;

  useLayoutEffect(() => {
    const updateHeights = () => {
      if (containerRef.current && contentRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        setContentHeight(contentRef.current.scrollHeight);
      }
    };

    updateHeights();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeights);
      if (containerRef.current) observer.observe(containerRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [children]);

  // High-performance DOM manipulation for character highlighting
  useEffect(() => {
    if (!contentRef.current) return;
    const chars = contentRef.current.querySelectorAll('.liturgy-char');
    const total = chars.length;
    if (total === 0) return;

    // Direct color update bypassing React render for performance and stability
    const targetIndex = Math.floor(progress * total);
    
    for (let i = 0; i < total; i++) {
      const el = chars[i] as HTMLElement;
      if (i <= targetIndex) {
        el.style.color = 'var(--color-monastery-accent)';
      } else {
        el.style.color = 'var(--color-monastery-muted)';
      }
    }
  }, [progress, children]);

  const rotationAngle = (contentHeight * progress) / radius * (180 / Math.PI);
  const translateY = -progress * contentHeight * 0.7;

  return (
    <div ref={containerRef} className="relative overflow-hidden w-full h-full flex flex-col items-center justify-start pt-[35vh]">
      <motion.div
        animate={{ 
          rotate: -rotationAngle,
          y: translateY
        }}
        transition={{ duration: 0.1, ease: "linear" }}
        style={{ 
          transformOrigin: `50% ${radius}px`,
          width: '100%'
        }}
        className="relative"
      >
        <div ref={contentRef} className="w-full text-center px-10 md:px-20 relative">
          <Markdown
            components={{
              p: ({ children }) => <p className="mb-12 text-2xl md:text-4xl leading-relaxed">{wrapCharacters(children)}</p>,
              h2: ({ children }) => <h2 className="font-serif text-5xl md:text-8xl mb-16 text-center">{wrapCharacters(children)}</h2>,
              em: ({ children }) => <em className="italic">{children}</em>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            }}
          >
            {children}
          </Markdown>
        </div>
      </motion.div>
    </div>
  );
};
