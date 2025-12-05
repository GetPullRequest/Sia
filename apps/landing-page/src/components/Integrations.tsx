import ScrollStopperIntegration from './ScrollStopperIntegration';

export default function Integrations() {
  const features = [
    {
      title: 'Job Board Dashboard',
      description: 'Visualize your entire workflow at a glance. Track tasks from queue to completion with our intuitive job board. See what Sia is working on, what\'s in the pipeline, and what\'s been delivered.',
      image: '/sia-homepage.webp',
      imageAlt: 'Sia Job Board Dashboard'
    },
    {
      title: 'Recent Activity Feed',
      description: 'Stay updated with real-time activity tracking. Monitor every action Sia takes, from code commits to PR creation. Never miss a beat with detailed activity logs and notifications.',
      image: '/sia-recentspage.webp',
      imageAlt: 'Sia Recent Activity Page'
    },
    {
      title: 'Agent Management',
      description: 'Configure and manage your AI agents with precision. Set up custom workflows, define task priorities, and optimize agent performance. Full control over your autonomous development team.',
      image: '/sia-agentspage.webp',
      imageAlt: 'Sia Agents Management Page'
    },
    {
      title: 'Seamless Integrations',
      description: 'Connect with your favorite tools effortlessly. Slack, Discord, GitHub, and more. Sia fits right into your existing workflow, no disruption required.',
      image: '/sia-integrationspage.webp',
      imageAlt: 'Sia Integration Page'
    }
  ];

  return (
    <section className="py-24 bg-background relative overflow-hidden w-full max-w-full">
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-20">
            <h2 className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text mb-6" style={{ paddingBottom: '0.1em' }}>
              Powerful Features,  Seamless Experience

            </h2>
            <p className="text-subheading md:text-subheading-md lg:text-subheading-lg font-extralight text-text/70 max-w-3xl mx-auto leading-relaxed" style={{ paddingBottom: '0.1em' }}>
              Everything you need to manage your autonomous development workflow, all in one place.
            </p>
          </div>

          {/* Features with Screenshots - All images on right */}
          <div className="space-y-20 md:space-y-32">
            {features.map((feature, index) => (
              <div
                key={index}
                className="flex flex-col lg:flex-row gap-8 md:gap-16 items-center"
              >
                {/* Content Side - Always on Left on desktop, below image on mobile */}
                <div className="flex-1 space-y-4 md:space-y-6">
                  <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text leading-tight">
                    {feature.title}
                  </h3>
                  <p className="text-body md:text-body-md lg:text-body-lg font-extralight text-text/70 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Image Side - Always on Right on desktop, first on mobile */}
                <div className="lg:w-[60%] w-full">
                  {/* Gradient glow background */}
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/10 via-green-600/10 to-purple-600/10 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition duration-500"></div>
                    <div className="relative h-full rounded-2xl overflow-hidden border border-white/10 shadow-[0_10px_30px_rgba(139,92,246,0.15),0_0_40px_rgba(34,197,94,0.1)] hover:shadow-[0_15px_40px_rgba(139,92,246,0.2),0_0_60px_rgba(34,197,94,0.15)] transition-shadow duration-500">
                      <img
                        src={feature.image}
                        alt={feature.imageAlt}
                        className="w-full h-auto object-contain"
                        style={{ height: 'auto' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ScrollStopperIntegration Component */}
          <ScrollStopperIntegration />
        </div>
      </div>
    </section>
  );
}
