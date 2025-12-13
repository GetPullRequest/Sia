import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import WaitlistModal from './WaitlistModal';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks: Array<{ name: string; href: string; isRoute?: boolean }> = [
    { name: 'Features', href: '#features' },
    { name: 'How It Works', href: '#how-it-works' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Blogs', href: '/blogs', isRoute: true },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] flex justify-center pt-4 pb-4 px-4 ">
      <div
        className={`w-full max-w-screen-2xl mx-auto rounded-2xl transition-all duration-300 ${
          isScrolled
            ? 'bg-background/50 backdrop-blur-sm border border-white/10'
            : 'bg-transparent'
        }`}
      >
        <div className="flex items-center justify-between  px-6 p-6 h-16 ">
          {/* Logo */}
          <Link
            to="/"
            className="flex items-center gap-2 text-white hover:opacity-80 transition-opacity"
          >
            <img src="/sia-icon-dark.svg" alt="SIA" width={48} height={48} />
            <span className="text-subheading font-medium">SIA</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map(link =>
              link.isRoute ? (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-white/90 hover:text-white transition-colors text-base uppercase font-extralight"
                >
                  {link.name}
                </Link>
              ) : (
                <a
                  key={link.name}
                  href={link.href}
                  className="text-white/90 hover:text-white transition-colors text-base uppercase font-extralight"
                >
                  {link.name}
                </a>
              )
            )}
          </div>

          {/* Right Side Actions */}
          <div className="hidden md:flex items-center gap-4">
            {/* GitHub Link */}
            <a
              href="https://github.com/GetPullRequest/sia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white transition-colors"
              aria-label="GitHub Repository"
            >
              <img src="/github.webp" alt="GitHub" width={24} height={24} />
            </a>

            {/* Downloads / Get Started */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-primary text-black hover:brightness-90 transition-all rounded-lg text-base font-medium"
            >
              Get Early Access
            </button>
          </div>

          {/* Mobile Actions - GitHub Icon and Menu Button */}
          <div className="md:hidden flex items-center gap-4">
            {/* GitHub Link - Mobile */}
            <a
              href="https://github.com/GetPullRequest/sia"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/90 hover:text-white transition-colors"
              aria-label="GitHub Repository"
            >
              <img src="/github.webp" alt="GitHub" width={24} height={24} />
            </a>

            {/* Mobile Menu Button */}
            <button
              className="text-white"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 mt-2 border-t border-white/10 rounded-b-2xl bg-background/95 backdrop-blur-md">
            <div className="flex flex-col gap-4 px-6">
              {navLinks.map(link =>
                link.isRoute ? (
                  <Link
                    key={link.name}
                    to={link.href}
                    className="text-white/90 hover:text-white transition-colors text-base font-extralight"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ) : (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-white/90 hover:text-white transition-colors text-base font-extralight"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </a>
                )
              )}

              <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="w-full px-4 py-2 bg-primary text-black hover:brightness-90 transition-all rounded-lg text-base font-medium"
                >
                  Get Early Access
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <WaitlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </nav>
  );
}
