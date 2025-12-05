import { MessageSquare, GitPullRequest, Smartphone, Clock, Zap, TrendingUp } from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: 'Delegate via Chat',
    description: 'Assign tasks through Slack or Discord. Just mention @sia with your task and she handles the rest.',
    color: 'from-white/10 to-white/5'
  },
  {
    icon: GitPullRequest,
    title: 'Automatic PRs',
    description: 'Sia integrates with Claude Agent and Aider to execute tasks and create pull requests automatically.',
    color: 'from-white/10 to-white/5'
  },
  {
    icon: Clock,
    title: '24/7 Execution',
    description: 'Tasks run continuously, even when you\'re offline. Turn idle hours into productive development time.',
    color: 'from-white/10 to-white/5'
  },
  {
    icon: Smartphone,
    title: 'Mobile Control',
    description: 'Review progress, merge PRs, or request rework directly from your phone without opening a laptop.',
    color: 'from-white/10 to-white/5'
  },
  {
    icon: Zap,
    title: 'Smart Queue',
    description: 'Prioritize, pause, or cancel tasks from chat. Sia manages execution order intelligently.',
    color: 'from-white/10 to-white/5'
  },
  {
    icon: TrendingUp,
    title: 'Learning Assistant',
    description: 'Over time, Sia learns your working style and suggests priorities to improve code quality.',
    color: 'from-white/10 to-white/5'
  }
];

export default function Features() {
  return (
    <section className="pb-24 bg-background relative overflow-hidden w-full max-w-full">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxwYXRoIGQ9Ik00MCAwdjQwTTAgNDBoNDBNNDAgNDB2NDBNNDAgNDBoNDAiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9nPjwvc3ZnPg==')] opacity-20" />

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-heading md:text-heading-md lg:text-heading-lg font-bold text-text mb-6" style={{ lineHeight: '1.3', paddingBottom: '0.1em' }}>
            Everything You Need To Ship Faster
            <span className="block mt-1 text-text" style={{ paddingBottom: '0.15em' }}>

            </span>
          </h2>
          <p className="text-xl text-text/70 max-w-2xl mx-auto leading-relaxed" style={{ paddingBottom: '0.1em' }}>
            Powerful features that work together seamlessly.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative bg-card backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-purple-500/20 hover:-translate-y-1"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-green-500/20 p-2.5 mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon className="w-full h-full text-text" />
                </div>
                <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text mb-3">{feature.title}</h3>
                <p className="text-base font-extralight text-text/70 leading-relaxed">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
