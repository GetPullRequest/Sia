import { useState, useEffect } from 'react';
import { Terminal, ArrowRight } from 'lucide-react';
import WaitlistModal from './WaitlistModal';

export default function Hero() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const fullText =
    'Hey buddy, in our @web project, can you update job-card file. Right now the card drags only when you grab that tiny vertical handle. I want the whole card to be draggable.';

  useEffect(() => {
    // Start typing animation after a delay
    const startDelay = setTimeout(() => {
      setIsTyping(true);
      let currentIndex = 0;

      const typeNextChunk = () => {
        if (currentIndex < fullText.length) {
          // Simulate LLM chunking - add 1-5 characters at a time
          const chunkSize = Math.floor(Math.random() * 4) + 1;
          const nextChunk = fullText.slice(
            currentIndex,
            currentIndex + chunkSize
          );

          setDisplayedText(prev => prev + nextChunk);
          currentIndex += chunkSize;

          // Variable delay to simulate realistic AI generation (20-80ms)
          const delay = Math.random() * 60 + 20;
          setTimeout(typeNextChunk, delay);
        } else {
          setIsTyping(false);
        }
      };

      typeNextChunk();
    }, 1500); // Start after 1.5 seconds

    return () => clearTimeout(startDelay);
  }, []);

  const codeSnippets = [
    'const task = await queue.add();',
    'git commit -m "feat: add tests"',
    'npm run test --coverage',
    'function executeTask() {',
    'if (status === "ready") {',
    'await pr.create(changes);',
    '✓ All tests passing',
    'export default async () => {',
    'return { success: true };',
    'const data = await fetch();',
    'class TaskQueue {',
    'public async execute() {',
    '// Initialize components',
    'for (let i = 0; i < n; i++)',
    'try { await process(); }',
    'catch (err) { log(err); }',
  ];

  return (
    <>
      <section className="relative overflow-hidden w-full">
        {/* Git branch-like network pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          style={{ zIndex: 1 }}
        >
          <defs>
            <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop
                offset="0%"
                style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0 }}
              />
              <stop
                offset="50%"
                style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0.5 }}
              />
              <stop
                offset="100%"
                style={{ stopColor: 'rgb(255, 255, 255)', stopOpacity: 0 }}
              />
            </linearGradient>
          </defs>
          <path
            d="M 0 100 Q 200 80 400 100 T 800 100"
            stroke="url(#grad1)"
            strokeWidth="2"
            fill="none"
            className="animate-git-branch"
            style={{ strokeDasharray: 1000 }}
          />
          <path
            d="M 0 200 Q 250 180 500 200 T 1000 200"
            stroke="url(#grad1)"
            strokeWidth="2"
            fill="none"
            className="animate-git-branch"
            style={{ strokeDasharray: 1000, animationDelay: '2s' }}
          />
          <path
            d="M 400 0 Q 450 150 400 300"
            stroke="url(#grad1)"
            strokeWidth="2"
            fill="none"
            className="animate-git-branch"
            style={{ strokeDasharray: 1000, animationDelay: '4s' }}
          />
          <circle
            cx="400"
            cy="100"
            r="4"
            fill="rgb(255, 255, 255)"
            className="animate-pulse-glow"
          />
          <circle
            cx="800"
            cy="100"
            r="4"
            fill="rgb(255, 255, 255)"
            className="animate-pulse-glow"
            style={{ animationDelay: '1s' }}
          />
          <circle
            cx="500"
            cy="200"
            r="4"
            fill="rgb(255, 255, 255)"
            className="animate-pulse-glow"
            style={{ animationDelay: '2s' }}
          />
        </svg>

        {/* Code stream columns - lighter subtle effect */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ zIndex: 1 }}
        >
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute font-mono text-xs text-emerald-400/20 animate-code-stream"
              style={{
                left: `${15 + i * 15}%`,
                animationDelay: `${i * 2}s`,
                animationDuration: `${8 + i}s`,
              }}
            >
              <div className="space-y-4">
                {codeSnippets.map((snippet, j) => (
                  <div key={j} className="whitespace-nowrap">
                    {snippet}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Terminal scan line effect */}
        <div
          className="hidden md:block absolute inset-0 pointer-events-none opacity-10"
          style={{ zIndex: 1 }}
        >
          <div className="absolute w-full h-px bg-white/5 animate-scan-line" />
        </div>

        {/* Code blocks background */}
        <div className="absolute inset-0 opacity-5" style={{ zIndex: 0 }}>
          <div
            className="absolute top-20 left-10 w-64 h-32 bg-white/10 rounded-lg animate-pulse-code"
            style={{ animationDelay: '0s' }}
          />
          <div
            className="absolute top-40 right-20 w-48 h-24 bg-white/10 rounded-lg animate-pulse-code"
            style={{ animationDelay: '1s' }}
          />
          <div
            className="absolute bottom-32 left-1/3 w-56 h-28 bg-white/10 rounded-lg animate-pulse-code"
            style={{ animationDelay: '2s' }}
          />
          <div
            className="absolute top-1/2 right-1/4 w-40 h-20 bg-white/10 rounded-lg animate-pulse-code"
            style={{ animationDelay: '1.5s' }}
          />
        </div>

        {/* Grid pattern - subtle */}
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,rgba(139,92,246,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(139,92,246,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]"
          style={{ zIndex: 0 }}
        />

        {/* Terminal cursor dots */}
        <div className="absolute inset-0" style={{ zIndex: 1 }}>
          <div className="absolute top-[15%] left-[20%] w-2 h-4 bg-white/10 animate-blink" />
          <div
            className="absolute top-[35%] right-[25%] w-2 h-4 bg-white/10 animate-blink"
            style={{ animationDelay: '0.5s' }}
          />
          <div
            className="absolute bottom-[25%] left-[30%] w-2 h-4 bg-white/10 animate-blink"
            style={{ animationDelay: '0.3s' }}
          />
        </div>

        {/* Subtle gradient orbs for depth */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-20 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className=" mx-auto px-6 relative z-10 py-24">
          <div className="max-w-5xl mx-auto text-center">
            <h1
              className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 animate-fadeInUp"
              style={{
                animationDelay: '100ms',
                lineHeight: '1.3',
                paddingBottom: '0.1em',
              }}
            >
              Wake Up To Ready
              <span
                className="block mt-2 text-white animate-gradient"
                style={{ paddingBottom: '0.15em' }}
              >
                Pull Requests
              </span>
            </h1>

            <p
              className="text-xl md:text-2xl text-white/70 mb-12 leading-relaxed max-w-3xl mx-auto animate-fadeInUp"
              style={{ animationDelay: '200ms', paddingBottom: '0.1em' }}
            >
              Delegate coding tasks to{' '}
              <span className="font-semibold text-white">Sia</span> through
              Slack or Discord. It queues them, executes via AI coding tools,
              and creates pull requests while you sleep.
            </p>

            <div
              className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fadeInUp"
              style={{ animationDelay: '300ms' }}
            >
              <button
                onClick={() => setIsModalOpen(true)}
                className="group relative px-8 py-4 bg-primary text-black font-semibold rounded-xl hover:brightness-75 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:shadow-primary/50  hover:scale-105"
              >
                <span>Get Early Access</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <a
                href="#how-it-works"
                className="px-8 py-4 bg-white/10 hover:brightness-75 text-white font-semibold rounded-xl transition-all duration-300 border border-white/20 flex items-center justify-center gap-2 hover:shadow-primary/50 hover:shadow-lg "
              >
                <span>Watch Demo</span>
              </a>
            </div>

            <div
              className="flex flex-wrap gap-8 justify-center text-white/70 mb-16 animate-fadeInUp"
              style={{ animationDelay: '400ms' }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                <span>Slack & Discord</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full bg-green-500 animate-pulse"
                  style={{ animationDelay: '200ms' }}
                />
                <span>24/7 Execution</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"
                  style={{ animationDelay: '400ms' }}
                />
                <span>Mobile Control</span>
              </div>
            </div>

            <div
              className="max-w-2xl mx-auto animate-fadeInUp"
              style={{ animationDelay: '500ms' }}
            >
              <div className="relative bg-card backdrop-blur-sm rounded-xl p-6 border border-white/10 hover:border-white/10 transition-all group overflow-hidden">
                <div className="absolute inset-0 bg-white/5 animate-shimmer" />

                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Terminal className="w-5 h-5 text-white" />
                    <span className="text-sm font-medium text-white/70">
                      Example task
                    </span>
                  </div>
                  <code className="block text-left gap-2 text-white/70 font-mono text-sm md:text-base">
                    <span className="text-white">@sia-</span>
                    <span className="pl-1">
                      {displayedText}
                      {isTyping && (
                        <span className="inline-block w-2 h-4 bg-white/70 ml-0.5 animate-blink"></span>
                      )}
                    </span>
                  </code>
                  <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-sm text-white/70">
                    <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    <span>Task queued • Est. 5 minutes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-px bg-white/5" />
      </section>

      <WaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
