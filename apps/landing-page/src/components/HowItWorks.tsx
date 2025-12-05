import { Moon, GitBranch, CheckCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

const steps = [
  {
    icon: Moon,
    title: 'Assign',
    description: 'Before you clock out, assign coding tasks to Sia via Slack or Discord. Simple, natural language works.',
    example: '@sia refactor the auth module to use JWT tokens',
    iconBg: 'from-slate-800 to-slate-900'
  },
  {
    icon: GitBranch,
    title: 'Sleep',
    description: 'While you\'re sleeping, Sia uses AI coding tools to implement your task, run tests, and create a pull request.',
    example: [
      '// Sia working...',
      '✓ Code written',
      '✓ Tests passed',
      '✓ PR created'
    ],
    iconBg: 'from-slate-800 to-slate-900'
  },
  {
    icon: CheckCircle,
    title: 'Review',
    description: 'Wake up to a notification. Review the PR on mobile, approve it, or request changes. Ship faster.',
    example: [
      'PR #247 ready for review',
      '✓ 15 files changed',
      '✓ All checks passing'
    ],
    iconBg: 'from-slate-800 to-slate-900'
  }
];

export default function HowItWorks() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % steps.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="how-it-works" className="py-24 bg-background overflow-hidden w-full max-w-full">
      {/* <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0zNiAxOGMwLTkuOTQtOC4wNi0xOC0xOC0xOCIgc3Ryb2tlPSJyZ2JhKDAsIDAsIDAsIDAuMDIpIiBzdHJva2Utd2lkdGg9IjEiLz48L2c+PC9zdmc+')] opacity-40" /> */}

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-heading sm:text-heading-lg font-medium text-text mb-4">
            How it works
          </h2>
          <p className="text-subheading sm:text-subheading-lg font-extralight text-text/60">
            Three simple steps to async development bliss
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto relative">
          {steps.map((step, index) => {
            const isActive = index === currentStep;
            const isPast = index < currentStep;

            return (
              <div
                key={index}
                className={`bg-card rounded-2xl p-8 border transition-all duration-1000 group relative ${isActive
                  ? 'border-purple-300 shadow-2xl shadow-purple-500/30 scale-105 ring-2 ring-purple-500/20'
                  : isPast
                    ? 'border-gray-200 opacity-70 scale-100'
                    : 'border-gray-200 opacity-50 scale-95'
                  }`}
              >
                <div className={`absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg transition-all duration-1000 ${isActive
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white scale-110 shadow-purple-500/50'
                  : 'bg-gray-300 text-gray-600'
                  }`}>
                  {index + 1}
                </div>

                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 z-10">
                    <div className={`w-8 h-0.5 transition-all duration-1000 ${isPast ? 'bg-black' : 'bg-gray-300'
                      }`} />
                  </div>
                )}

                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-1000 ${isActive ? 'bg-gradient-to-br from-purple-600 to-green-600 scale-110 rotate-0' : 'bg-gray-100 scale-100 rotate-12'
                  }`}>
                  <step.icon className={`w-8 h-8 ${isActive ? 'text-text' : 'text-black'
                    }`} />
                </div>

                <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text mb-4">{step.title}</h3>
                <p className={`text-base font-extralight text-text/60 leading-relaxed mb-6 transition-all duration-1000 ${isActive ? 'opacity-100' : 'opacity-70'
                  }`}>
                  {step.description}
                </p>

                <div className={`bg-background rounded-xl p-4 border border-white/10 overflow-hidden transition-all duration-1000 ${isActive ? 'opacity-100 border-white/20' : 'opacity-80 border-white/10'
                  }`}>
                  {Array.isArray(step.example) ? (
                    <div className="space-y-1">
                      {step.example.map((line, i) => (
                        <div
                          key={i}
                          className={`font-mono text-sm transition-all duration-500 ${isActive
                            ? 'text-text/80 opacity-100 translate-x-0'
                            : 'text-text/50 opacity-80 translate-x-0'
                            }`}
                          style={{ transitionDelay: isActive ? `${i * 150}ms` : '0ms' }}
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <code className={`font-mono text-sm block transition-all duration-500 ${isActive
                      ? 'text-text/80 opacity-100 translate-x-0'
                      : 'text-text/50 opacity-80 translate-x-0'
                      }`}>
                      {step.example}
                    </code>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center gap-3 mt-12">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${index === currentStep
                ? 'bg-text scale-125'
                : 'bg-text/30 hover:brightness-90'
                }`}
              aria-label={`Go to step ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
