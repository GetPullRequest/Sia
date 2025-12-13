import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-12">
      <div className=" mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div className="text-center md:text-left">
            <h3 className="text-subheading md:text-subheading-md lg:text-subheading-lg font-medium text-text mb-2">
              GetPullRequest
            </h3>
            <p className="text-base font-extralight text-text/70">
              AI dev assistant that creates PRs while you sleep
            </p>
          </div>

          <div className="text-center">
            <h4 className="text-base font-medium text-text mb-3">Legal</h4>
            <div className="space-y-2">
              <Link
                to="/privacy-policy"
                className="block text-base font-extralight text-text/70 hover:text-text transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms-of-service"
                className="block text-base font-extralight text-text/70 hover:text-text transition-colors"
              >
                Terms of Service
              </Link>
            </div>
          </div>

          <div className="flex gap-4 justify-center md:justify-end">
            <a
              href="https://github.com/GetPullRequest/sia"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-lg bg-text  flex items-center justify-center transition-colors"
              aria-label="GitHub"
            >
              <img
                src="/github.svg"
                alt="GitHub"
                className="w-5 h-5 text-white "
              />
            </a>
            <a
              href="https://x.com/getpullrequest"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-lg bg-text flex items-center justify-center transition-colors"
              aria-label="Twitter"
            >
              <img
                src="/x_icon.svg"
                alt="Twitter"
                className="w-5 h-5 text-white"
              />
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-center text-base font-extralight text-text/70">
          <p>
            &copy; {new Date().getFullYear()} GetPullRequest. All rights
            reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
