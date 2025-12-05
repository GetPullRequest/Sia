import { Check, Zap, Building2 } from 'lucide-react';
import WaitlistModal from './WaitlistModal';
import { useState } from 'react';

export default function Pricing() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out Sia',
      features: [
        '1 agent connection',
        'Up to 10 PRs per month',
        'Basic GitHub integration',
        'Community support',
        '48-hour PR turnaround',
      ],
      cta: 'Join Waitlist',
      highlighted: false,
      icon: Zap,
    },
    {
      name: 'Custom',
      price: 'Custom',
      period: '',
      description: 'For organizations at scale',
      features: [
        'Unlimited agent connections',
        'Unlimited PRs',
        'Priority processing',
        'Advanced GitHub integration',
        'Email support',
        '24-hour PR turnaround',
        'Custom review preferences',
        'Analytics dashboard',
        'Dedicated account manager',
        'Custom SLA',
        'On-premise deployment option',
        'SSO & advanced security',
        'Custom integrations',
        'Training & onboarding',
        '99.9% uptime guarantee',
      ],
      cta: 'Contact Us',
      highlighted: true,
      icon: Building2,
    },
  ];

  return (
    <>
      <section id="pricing" className="relative py-24 bg-background overflow-hidden w-full max-w-full">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-0 right-0 h-px " />

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text mb-6" style={{ lineHeight: '1.3', paddingBottom: '0.1em' }}>
                Simple,{' '}
                <span className="text-text">
                  transparent pricing
                </span>
              </h2>
              <p className="text-subheading md:text-subheading-md lg:text-subheading-lg font-extralight text-text/70 max-w-3xl mx-auto leading-relaxed" style={{ paddingBottom: '0.1em' }}>
                Start free, upgrade to enterprise when you're ready to scale.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-16">
              {plans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <div
                    key={index}
                    className={`relative rounded-3xl p-8 transition-all ${plan.highlighted
                      ? 'bg-card border-2 border-white shadow-2xl shadow-white/20'
                      : 'bg-card border border-white/10 hover:border-white/20'
                      }`}
                  >
                    {plan.highlighted && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-black px-4 py-1 rounded-full text-base font-medium">
                        Most Popular
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${plan.highlighted ? 'bg-white/5' : 'bg-black/50'
                        }`}>
                        <Icon className={`w-6 h-6 ${plan.highlighted ? 'text-text' : 'text-text/70'
                          }`} />
                      </div>
                      <div>
                        <h3 className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text">{plan.name}</h3>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className={`text-subheading font-medium ${plan.highlighted
                          ? 'text-text'
                          : 'text-text'
                          }`}>
                          {plan.price}
                        </span>
                        {/* <span className="text-text/70">{plan.period}</span> */}
                      </div>
                      <p className="text-base font-extralight text-text/70 mt-2">{plan.description}</p>
                    </div>

                    <button
                      className={`w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300 mb-8 ${plan.highlighted
                        ? 'bg-primary text-black hover:brightness-75  hover:shadow-lg hover:shadow-primary/50'
                        : 'bg-white/10 text-text hover:brightness-75 border border-white/20 hover:shadow-lg hover:shadow-primary/30'
                        }`}
                      onClick={() => {
                        if (plan.name === 'Free') {
                          setIsModalOpen(true);
                        } else if (plan.name === 'Custom') {
                          window.location.href = 'mailto:hi@getpullrequest.com';
                        }
                      }}
                    >
                      {plan.cta}
                    </button>

                    <div className="space-y-4">
                      {plan.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${plan.highlighted ? 'bg-white/5' : 'bg-black'
                            }`}>
                            <Check className={`w-3 h-3 ${plan.highlighted ? 'text-text' : 'text-text/70'
                              }`} />
                          </div>
                          <span className="text-base font-extralight text-text/70 leading-relaxed">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div><WaitlistModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} /></div>
      </section>

    </>

  );
}
