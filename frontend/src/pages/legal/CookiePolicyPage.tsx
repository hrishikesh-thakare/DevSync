import { Link } from 'react-router-dom';

export function CookiePolicyPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Cookie Policy</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <h2>1. What are Cookies?</h2><p>Cookies are small text files that are used to store small pieces of information. The cookies are stored on your device when the website is loaded on your browser. These cookies help us make the website function properly, make the website more secure, provide better user experience, and understand how the website performs and to analyze what works and where it needs improvement.</p><h2>2. How We Use Cookies</h2><p>As most of the online services, our website uses cookies first-party and third-party cookies for a number of purposes. The first-party cookies are mostly necessary for the website to function the right way, and they do not collect any of your personally identifiable data.</p><p>The third-party cookies used on our websites are used mainly for understanding how the website performs, how you interact with our website, keeping our services secure, providing advertisements that are relevant to you, and all in all providing you with a better and improved user experience and help speed up your future interactions with our website.</p><h2>3. Types of Cookies We Use</h2><ul><li><strong>Essential:</strong> Some cookies are essential for you to be able to experience the full functionality of our site. They allow us to maintain user sessions and prevent any security threats. They do not collect or store any personal information.</li><li><strong>Statistics:</strong> These cookies store information like the number of visitors to the website, the number of unique visitors, which pages of the website have been visited, the source of the visit, etc.</li><li><strong>Preferences:</strong> These cookies help us store your settings and browsing preferences like language preferences so that you have a better and efficient experience on future visits to the website.</li></ul><h2>4. Managing Your Cookie Preferences</h2><p>You can manage your cookie preferences at any time by clearing your browser cache and interacting with our cookie consent banner. Different browsers provide different methods to block and delete cookies used by websites.</p>
        </div>
      </div>
    </div>
  );
}
