import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import WaitlistModal from './WaitlistModal';

export default function EarlyAccessCTA() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <section className="py-24 bg-background relative overflow-hidden">
        {/* Darker background overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-black to-background/50" />

        <div className="container mx-auto px-6 relative z-10">
          {/* Container with max-w-5xl that expands on hover */}
          <div className="max-w-5xl mx-auto transition-all duration-500 hover:max-w-full text-center">
            <div className="inline-flex items-center gap-2 bg-background/5 border border-background/20 rounded-full px-6 py-2 mb-8">
              <Sparkles className="w-4 h-4 text-text" />
              <span className="text-base font-extralight text-text">Limited Beta Access</span>
            </div>

            <h2 className="text-heading md:text-heading-md lg:text-heading-lg font-medium text-text mb-6 leading-tight">
              Stop Waiting for PRs.

              Start Shipping Faster.
            </h2>

            <p className="text-subheading md:text-subheading-md lg:text-subheading-lg font-extralight text-text/70 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join developers who wake up to completed pull requests.
            </p>

            <div className="flex flex-col gap-3 justify-center items-center">
              <button
                onClick={() => setIsModalOpen(true)}
                className="group bg-primary text-black font-medium px-8 py-4 rounded-xl hover:brightness-75 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/50 text-base"
              >
                Get Early Access
                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <p className="text-base font-extralight text-text/70">
                No credit card required • Free beta access
              </p>
            </div>
          </div>
        </div>
      </section>

      <WaitlistModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
