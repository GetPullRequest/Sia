import { MessageSquare, CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

const tasks = [
  { id: 1, label: 'Task queued', status: 'queued' },
  { id: 2, label: 'Running tests', status: 'pending' },
  { id: 3, label: 'Created PR...', status: 'pending' },
  { id: 4, label: 'PR #247 Ready', status: 'pending' },
];

export default function ScrollStopperIntegration() {
  const [taskStates, setTaskStates] = useState(tasks);
  const [currentStep, setCurrentStep] = useState(0);
  const [isInView, setIsInView] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const currentStepRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          setIsInView(entry.isIntersecting);
        });
      },
      { threshold: 0.5 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isInView) return;

    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const sectionMiddle = rect.top + rect.height / 2;
      const distanceFromCenter = Math.abs(windowHeight / 2 - sectionMiddle);

      // Calculate progress based on scroll position
      const maxDistance = windowHeight / 2;
      const progress = Math.max(0, 1 - distanceFromCenter / maxDistance);
      const step = Math.min(4, Math.floor(progress * 5));

      // Only update if step actually changed
      if (step !== currentStepRef.current) {
        currentStepRef.current = step;

        // Use requestAnimationFrame to batch updates and prevent layout shifts
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
        }

        rafIdRef.current = requestAnimationFrame(() => {
          setCurrentStep(step);

          if (step === 0) {
            setTaskStates(tasks);
          } else {
            setTaskStates(prevStates =>
              prevStates.map((task, index) => {
                if (index < step) {
                  return { ...task, status: 'completed' };
                } else if (index === step) {
                  return { ...task, status: 'running' };
                } else {
                  return { ...task, status: 'pending' };
                }
              })
            );
          }
        });
      }
    };

    // Throttle scroll handler using requestAnimationFrame
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isInView]);

  return (
    <div className="pt-24">
      {/* Header Section */}

      {/* Interactive Demo */}
      <div
        ref={sectionRef}
        className="max-w-6xl flex flex-col mx-auto min-h-[100vh] items-center will-change-transform"
      >
        <div className="text-center pt-24 max-w-3xl mx-auto">
          <h2
            className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text mb-6"
            style={{ lineHeight: '1.3', paddingBottom: '0.1em' }}
          >
            See Sia in Action
          </h2>
          <p
            className="text-subheading md:text-subheading-md lg:text-subheading-lg font-extralight text-text/70 leading-relaxed"
            style={{ paddingBottom: '0.1em' }}
          >
            Watch how Sia processes your tasks in real-time. From queue to pull
            request, track every step of the journey.
          </p>
        </div>
        <div className="relative bg-black/50 backdrop-blur-sm rounded-2xl p-8 border border-white/10 overflow-hidden w-full">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L2c+PC9zdmc+')] opacity-50" />

          <div className="relative z-10 flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="bg-card rounded-xl p-6 border border-white/10">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 mt-1">
                      <MessageSquare className="w-4 h-4 text-text" />
                    </div>
                    <div className="flex-1">
                      <div className="text-base font-extralight text-text/70 mb-2">
                        <span className="text-text font-mono">@sia - </span> Fix
                        the token-persistence bug in login.tsx by moving the
                        auth token from React state into a secure persistent
                        storage.
                      </div>
                      <div className="text-base font-extralight text-text/70">
                        2 hours ago
                      </div>
                    </div>
                  </div>

                  <div className="border-l-2 border-white/10 ml-4 pl-6 space-y-3">
                    {taskStates.map(task => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 transition-all duration-500 ${
                          task.status === 'pending'
                            ? 'opacity-40'
                            : 'opacity-100'
                        }`}
                      >
                        {task.status === 'completed' && (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        )}
                        {task.status === 'running' && (
                          <Loader2 className="w-4 h-4 text-purple-500 flex-shrink-0 animate-spin" />
                        )}
                        {task.status === 'pending' && (
                          <Circle className="w-4 h-4 text-white/30 flex-shrink-0" />
                        )}
                        <span
                          className={`text-subheading font-extralight transition-colors ${
                            task.status === 'completed'
                              ? 'text-text'
                              : task.status === 'running'
                              ? 'text-text'
                              : 'text-text/50'
                          }`}
                        >
                          {task.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Always reserve space for PR card to prevent layout shift */}
                  <div
                    className={`transition-opacity duration-500 ${
                      currentStep === 4
                        ? 'opacity-100'
                        : 'opacity-0 pointer-events-none'
                    }`}
                  >
                    <div className="bg-gradient-to-br from-green-500/10 to-transparent rounded-lg p-4 border border-green-500/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text">
                          PR #247 Ready
                        </span>
                        <span className="text-base font-extralight px-2 py-1 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                          94% confidence
                        </span>
                      </div>
                      <p className="text-base font-extralight text-text/70 mb-3">
                        Fixed OAuth callback issue in login flow
                      </p>
                      <button className="text-base font-medium text-green-400 hover:text-green-300 transition-colors">
                        Review on GitHub →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 text-center lg:text-left">
              <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text mb-4">
                Real-time visibility, zero overhead
              </h3>
              <p className="text-base font-extralight text-text/70 leading-relaxed mb-6">
                Track task progress, get confidence scores, and merge PRs—all
                without leaving Slack or opening your laptop.
              </p>
              <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                <span className="text-base font-extralight px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  Task Queue
                </span>
                <span className="text-base font-extralight px-3 py-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
                  Live Updates
                </span>
                <span className="text-base font-extralight px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                  Confidence Scores
                </span>
              </div>
              <div className="mt-6 text-base font-extralight text-text/40">
                Scroll to see the progress in action
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
