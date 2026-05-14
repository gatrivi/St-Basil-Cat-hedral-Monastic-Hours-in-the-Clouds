import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import Markdown from 'react-markdown';

interface AutoPagerProps {
  children: string;
  progress: number;
}

// Recursive component to wrap characters and preserve progress
const CharReveal = ({ children, progress, context }: { children: React.ReactNode, progress: number, context: { charCount: number, total: number } }) => {
  return React.Children.map(children, child => {
    if (typeof child === 'string') {
      const chars = child.split('');
      const start = context.charCount;
      context.charCount += chars.length;
      return chars.map((char, i) => {
        const isHighlighted = progress >= (start + i) / context.total;
        return (
          <span 
            key={start + i} 
            style={{ 
              color: isHighlighted ? 'var(--color-monastery-accent)' : 'var(--color-monastery-muted)',
              transition: 'color 0.2s ease-out'
            }}
          >
            {char}
          </span>
        );
      });
    }
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, {
        children: <CharReveal progress={progress} context={context}>{child.props.children}</CharReveal>
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
  const totalChars = children.length;

  useLayoutEffect(() => {
    if (containerRef.current && contentRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
      setContentHeight(contentRef.current.scrollHeight);
    }
    const observer = new ResizeObserver(() => {
      if (containerRef.current && contentRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
        setContentHeight(contentRef.current.scrollHeight);
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [children]);

  const rotationAngle = (contentHeight * progress) / radius * (180 / Math.PI);
  const translateY = -progress * contentHeight * 0.7; // Keep reading area visible

  // Reset character count for each render
  const context = { charCount: 0, total: totalChars };

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
              p: ({ children }) => <p className="mb-12 text-2xl md:text-4xl leading-relaxed"><CharReveal progress={progress} context={context}>{children}</CharReveal></p>,
              h2: ({ children }) => <h2 className="font-serif text-5xl md:text-8xl mb-16 text-center"><CharReveal progress={progress} context={context}>{children}</CharReveal></h2>,
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
