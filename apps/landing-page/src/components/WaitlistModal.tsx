import { useState, useEffect } from 'react';
import { X, Mail, Loader2, CheckCircle2, Sparkles } from 'lucide-react';

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaitlistModal({ isOpen, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setSuccess(false);
        setError('');
      }, 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        'https://gpr-interest-slack-notification-257538584568.us-east1.run.app/',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: '*/*',
          },
          body: JSON.stringify({
            text: `🎉 New Waitlist Signup!\n\nName: ${
              name || 'Not provided'
            }\nEmail: ${email}`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to submit waitlist entry');
      }

      setSuccess(true);
      setEmail('');
      setName('');
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div
        className="absolute inset-0 bg-card backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-card border border-white/10 rounded-2xl shadow-2xl max-w-md w-full animate-slideUp">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-card/50 flex items-center justify-center transition duration-200 hover:brightness-90"
        >
          <X className="w-5 h-5 text-text/70" />
        </button>

        <div className="p-8">
          {success ? (
            <div className="text-center animate-fadeIn">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-text mb-2">
                You're on the list!
              </h3>
              <p className="text-text/70 mb-6">
                We'll notify you when Sia is ready to transform your workflow.
              </p>
              <button
                onClick={onClose}
                className="bg-black text-white font-semibold py-2 px-6 rounded-lg transition duration-200 hover:brightness-90"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-green-400" />
                  <h3 className="text-2xl font-bold text-text">
                    Join the Waitlist
                  </h3>
                </div>
                <p className="text-text/70">
                  Be among the first to experience async development. Get
                  notified when we launch.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="modal-name"
                    className="block text-sm font-medium text-text/70 mb-2"
                  >
                    Name
                  </label>
                  <input
                    type="text"
                    id="modal-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-text placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                    placeholder="Jane Developer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="modal-email"
                    className="block text-sm font-medium text-text/70 mb-2"
                  >
                    Work Email <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/70" />
                    <input
                      type="email"
                      id="modal-email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-black/50 border border-white/10 rounded-lg text-text placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500 transition-all"
                      placeholder="jane@company.com"
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-shake">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-green-500/25 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Joining...</span>
                    </>
                  ) : (
                    <span>Get Early Access</span>
                  )}
                </button>

                <p className="text-xs text-text/70 text-center">
                  No spam, just updates on Sia's launch.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
