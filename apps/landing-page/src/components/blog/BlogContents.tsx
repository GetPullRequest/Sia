"use client";

import { useEffect, useState } from "react";

interface OutlineItem {
  id: string;
  text: string;
  level: number;
  isActive: boolean;
  index: number;
}

interface BlogContentsProps {
  content: string;
  contentType?: "markdown" | "html";
  isSeoBot?: boolean;
}

const BlogContents: React.FC<BlogContentsProps> = ({
  content,
  contentType = "markdown",
  isSeoBot = false,
}) => {
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    // Wait for the DOM to be ready
    const timer = setTimeout(() => {
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

      const outlineItems: OutlineItem[] = Array.from(headings)
        .filter((heading, index) => {
          // Skip the main title (first h1) but keep other headings
          if (index === 0 && heading.tagName === "H1") return false;

          // For SEO bot blogs, only include h1 and h2
          if (isSeoBot) {
            const level = parseInt(heading.tagName.charAt(1));
            if (level > 2) return false;
          }

          // Only include headings that have text content
          const text = heading.textContent?.trim() || "";
          if (!text) return false;

          return true;
        })
        .map((heading, index) => {
          const level = parseInt(heading.tagName.charAt(1));
          const text = heading.textContent?.trim() || "";
          // Use existing ID if available, otherwise generate one
          let id = heading.id;
          if (!id) {
            id = `heading-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;
            // Assign the ID to the heading element for scroll functionality
            heading.id = id;
          }

          return {
            id,
            text,
            level,
            isActive: false,
            index,
          };
        });

      setOutline(outlineItems);
    }, 300);

    // Fallback: try again after a longer delay if no headings found
    const fallbackTimer = setTimeout(() => {
      if (outline.length === 0) {
        const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");

        const outlineItems: OutlineItem[] = Array.from(headings)
          .filter((heading, index) => {
            // Skip the main title (first h1) but keep other headings
            if (index === 0 && heading.tagName === "H1") return false;

            // For SEO bot blogs, only include h1 and h2
            if (isSeoBot) {
              const level = parseInt(heading.tagName.charAt(1));
              if (level > 2) return false;
            }

            // Only include headings that have text content
            const text = heading.textContent?.trim() || "";
            if (!text) return false;

            return true;
          })
          .map((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent?.trim() || "";
            // Use existing ID if available, otherwise generate one
            let id = heading.id;
            if (!id) {
              id = `heading-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`;
              // Assign the ID to the heading element for scroll functionality
              heading.id = id;
            }

            return {
              id,
              text,
              level,
              isActive: false,
              index,
            };
          });

        setOutline(outlineItems);
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearTimeout(fallbackTimer);
    };
  }, [content, contentType]);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
          let currentActive = "";
          let minDistance = Infinity;

          // Get all headings that are in the outline
          const outlineHeadingIds = outline.map((item) => item.id);

          headings.forEach((heading) => {
            const rect = heading.getBoundingClientRect();
            const headingId = heading.id || "";

            // Only consider headings that are in our outline
            if (!outlineHeadingIds.includes(headingId)) return;

            const distance = Math.abs(rect.top - 100); // 100px from top

            // Find the heading closest to the top of the viewport
            if (distance < minDistance && rect.top <= 200) {
              minDistance = distance;
              currentActive = headingId;
            }
          });

          setActiveId(currentActive);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [outline]);

  const scrollToHeading = (id: string) => {
    // Try to find element by ID first
    let element = document.getElementById(id);
    
    if (!element) {
      // Fallback: try to find the element by matching the ID pattern
      const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
      for (const heading of headings) {
        const headingId = heading.id || 
          `heading-${heading.textContent?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || ""}`;
        if (headingId === id || heading.textContent?.trim() === id.replace(/^heading-/, "").replace(/-/g, " ")) {
          element = heading as HTMLElement;
          // Assign ID if it doesn't have one
          if (!heading.id) {
            heading.id = id;
          }
          break;
        }
      }
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const navbarHeight = 100; // Account for navbar height
      const targetPosition = scrollTop + rect.top - navbarHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: "smooth",
      });
    }
  };

  if (outline.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-32 top-24 w-64 bg-card rounded-lg shadow-lg  p-4 pt-8 max-h-[calc(100vh-8rem)] overflow-y-auto z-50">
      <h3 className="text-base font-semibold text-text mb-2">Contents</h3>
      <nav className="space-y-0.5">
        {outline.map((item) => (
          <button
            key={`${item.id}-${item.index}`}
            onClick={() => scrollToHeading(item.id)}
            className={`block w-full text-left px-2 py-2 rounded text-xs transition-colors relative ${
              activeId === item.id
                ? "bg-slate-800 text-gray-300 font-medium border-l-4 border-gray-500"
                : "text-gray-300 hover:text-gray-300 hover:bg-gray-800"
            }`}
            style={{ paddingLeft: `${(item.level - 1) * 8 + 6}px` }}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </div>
  );
};

export default BlogContents;
