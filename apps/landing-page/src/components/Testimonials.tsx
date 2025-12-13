import { Zap, Rocket, Brain } from 'lucide-react';

export default function Testimonials() {
  const benefits = [
    {
      icon: Zap,
      title: 'Ship faster',
      description:
        'Get 3x more done by parallelizing work across timezones. Your AI never sleeps.',
    },
    {
      icon: Rocket,
      title: 'Focus on what matters',
      description:
        'Delegate boilerplate, refactors, and migrations. You work on the hard problems.',
    },
    {
      icon: Brain,
      title: 'Code while you sleep',
      description:
        "Review Sia's PRs and learn new patterns. It's like pair programming with the future.",
    },
  ];

  return (
    <section className="relative py-12 bg-black overflow-hidden w-full max-w-7xl rounded-3xl mx-auto">
      {/* Background matching kiro-style */}
      <div className="absolute inset-0 bg-card" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Horizontal row layout */}
          <div className="flex flex-col md:flex-row gap-4 md:gap-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="flex-1 text-left">
                  {/* Icon at top */}
                  <div className="flex justify-start pb-4">
                    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-text/70" />
                    </div>
                  </div>

                  {/* Title below icon */}
                  <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text pb-3 leading-snug">
                    {benefit.title}
                  </h3>

                  {/* Description below title */}
                  <p className="text-base md:text-sm lg:text-lg font-extralight text-text/70 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
