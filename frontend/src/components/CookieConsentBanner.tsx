import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

export function CookieConsentBanner() {
  const [isVisible, setIsVisible] = useState(() => {
    return !localStorage.getItem('cookie-consent');
  });

  if (!isVisible) return null;

  const handleAcceptAll = () => {
    localStorage.setItem('cookie-consent', 'all');
    setIsVisible(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('cookie-consent', 'essential');
    setIsVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pb-safe">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/10 bg-[#121217] p-6 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1 pr-4">
            <h3 className="text-lg font-semibold text-white">We value your privacy</h3>
            <p className="mt-2 text-sm text-zinc-400">
              We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies. Read our <Link to="/cookie-policy" className="text-primary hover:underline">Cookie Policy</Link> for more information.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" size="sm" onClick={handleAcceptEssential}>
              Essential Only
            </Button>
            <Button size="sm" onClick={handleAcceptAll}>
              Accept All
            </Button>
            <button
              onClick={handleAcceptEssential}
              className="absolute right-4 top-4 text-zinc-500 hover:text-zinc-300 sm:relative sm:right-auto sm:top-auto sm:ml-2"
              aria-label="Close"
            >
              <XIcon className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
