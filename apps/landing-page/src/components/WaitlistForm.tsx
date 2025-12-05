import { useState } from 'react';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';

export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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
            'Accept': '*/*',
          },
          body: JSON.stringify({
            text: `🎉 New Waitlist Signup!\n\nName: ${name || 'Not provided'}\nEmail: ${email}`,
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

  if (success) {
    return (
      <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-8 border border-emerald-500/20 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-bold text-text mb-2">You're on the list!</h3>
          <p className="text-text/70 mb-6">
            We'll notify you when Sia is ready to transform your workflow.
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="text-emerald-400 font-medium transition duration-200 hover:brightness-90"
          >
            Add another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-8 border border-white/10/50 shadow-2xl">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-text mb-2">Join the Waitlist</h3>
        <p className="text-text/70">Be among the first to experience async development.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-text/70 mb-2">
            Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-lg text-text placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
            placeholder="Jane Developer"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text/70 mb-2">
            Work Email <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text/70" />
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-black/50 border border-white/10 rounded-lg text-text placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              placeholder="jane@company.com"
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-black font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
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
    </div>
  );
}
