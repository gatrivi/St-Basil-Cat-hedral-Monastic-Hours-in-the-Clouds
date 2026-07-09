import React, { useState, useLayoutEffect, useRef } from 'react';
import Markdown from 'react-markdown';

interface AutoPagerProps {
  children: string;
  progress: number;
}

/** Prayer text only — soft scroll, no decorative chrome. */
export const AutoPager: React.FC<AutoPagerProps> = ({ children, progress }) => {
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
    updateHeights();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateHeights);
      if (viewportRef.current) observer.observe(viewportRef.current);
      if (contentRef.current) observer.observe(contentRef.current);
    }
    return () => {
      if (observer) observer.disconnect();
    };
  }, [children]);

  const scrollRange = Math.max(0, contentHeight - containerHeight);
  const translateY = -Math.round(progress * scrollRange);

  return (
    <div ref={viewportRef} className="prayer-viewport">
      <div
        ref={contentRef}
        className="prayer-markdown-body"
        style={{ transform: `translate3d(0, ${translateY}px, 0)` }}
      >
        <Markdown
          components={{
            p: ({ children: c }) => (
              <p className="prayer-verse font-serif">{c}</p>
            ),
            h2: ({ children: c }) => (
              <h3 className="prayer-heading font-serif">{c}</h3>
            ),
            em: ({ children: c }) => <em>{c}</em>,
            strong: ({ children: c }) => <strong>{c}</strong>,
          }}
        >
          {children}
        </Markdown>
      </div>
    </div>
  );
};
