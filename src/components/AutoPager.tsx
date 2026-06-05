import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import Markdown from 'react-markdown';

interface AutoPagerProps {
  children: string;
  progress: number;
  title?: string;
  subtitle?: string;
}

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
        children: wrapCharacters(element.props.children),
      });
    }
    return child;
  });
};

/** Main prayer: vertical split-flap scroll (face-on), synced to slot progress. */
export const AutoPager: React.FC<AutoPagerProps> = ({ children, progress, title, subtitle }) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    const updateHeights = () => {
      if (viewportRef.current && contentRef.current) {
        setContainerHeight(viewportRef.current.clientHeight);
        setContentHeight(contentRef.current.scrollHeight);
      }
    };
    const timer = setTimeout(updateHeights, 100);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeights);
      if (viewportRef.current) observer.observe(viewportRef.current);
      if (contentRef.current) observer.observe(contentRef.current);
    }
    return () => {
      clearTimeout(timer);
      if (observer) observer.disconnect();
    };
  }, [children]);

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

  const scrollRange = Math.max(0, contentHeight - containerHeight);
  const translateY = -progress * scrollRange;

  return (
    <div className="flex flex-col w-full h-full min-h-0">
      {(title || subtitle) && (
        <header className="shrink-0 text-center mb-3 px-2 z-10">
          {subtitle && (
            <p className="text-xs uppercase tracking-[0.25em] opacity-50 mb-1">{subtitle}</p>
          )}
          {title && (
            <h2 className="font-serif text-2xl md:text-4xl text-[var(--color-monastery-accent)] leading-tight">{title}</h2>
          )}
        </header>
      )}
      <div ref={viewportRef} className="ticker-viewport ticker-viewport--prayer flex-1 min-h-0">
        <div className="ticker-slot" aria-hidden />
        <div
          className="ticker-track ticker-track--prayer"
          style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
        >
          <div ref={contentRef} className="w-full text-center px-3 md:px-10 pb-16 prayer-markdown-body">
            <Markdown
              components={{
                p: ({ children }) => <p className="mb-8 prayer-verse leading-relaxed font-serif">{wrapCharacters(children)}</p>,
                h2: ({ children }) => <h3 className="font-serif text-xl md:text-2xl mb-6 text-center text-[var(--color-monastery-accent)]">{wrapCharacters(children)}</h3>,
                em: ({ children }) => <em className="italic opacity-80">{children}</em>,
                strong: ({ children }) => <strong className="font-bold text-[var(--color-monastery-accent)]">{children}</strong>,
              }}
            >
              {children}
            </Markdown>
          </div>
        </div>
      </div>
    </div>
  );
};
