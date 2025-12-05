import { X, Check } from 'lucide-react';

export default function ProblemSolution() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiLz48cGF0aCBkPSJNMzAgMzBtLTEwIDAgYSAxMCAxMCAwIDEgMCAyMCAwIGEgMTAgMTAgMCAxIDAgLTIwIDAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-30" />
      <div className="absolute top-1/2 left-0 w-72 h-72 bg-red-500/10 rounded-full blur-3xl transform -translate-y-1/2" />
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl transform -translate-y-1/2" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text mb-4">
              Stop Waiting. Start Shipping.
            </h2>
            <p className="text-subheading md:text-subheading-md lg:text-subheading-lg font-extralight text-text/70">
              The real bottleneck isn't AI—it's you watching it work
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="relative bg-card backdrop-blur-sm rounded-2xl p-8 border border-red-500/20 hover:border-red-500/40 transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-red-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <X className="w-6 h-6 text-red-400" />
                  </div>
                  <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text">Without Sia</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Manually feeding prompts one by one',
                    'Waiting around for AI to finish',
                    'Losing track when you step away',
                    'Wasted idle hours overnight',
                    'Constant context switching',
                    'No visibility for your team'
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-base font-extralight text-text/70">
                      <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="relative bg-card backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:border-green-500/50 transition-all duration-300 overflow-hidden hover:shadow-xl hover:shadow-green-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                    <Check className="w-6 h-6 text-text" />
                  </div>
                  <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text">With Sia</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Queue multiple tasks at once',
                    'Work continues 24/7 automatically',
                    'Wake up to ready-to-review PRs',
                    'Turn idle time into dev time',
                    'Stay in flow, let Sia orchestrate',
                    'Full team visibility via Slack/Discord'
                  ].map((item, index) => (
                    <li key={index} className="flex items-start gap-3 text-base font-extralight text-text/70">
                      <Check className="w-5 h-5 text-text flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
