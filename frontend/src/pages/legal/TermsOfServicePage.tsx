import { Link } from 'react-router-dom';

export function TermsOfServicePage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Terms of Service</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <h2>1. Acceptance of Terms</h2><p>By accessing and using DevSync, you accept and agree to be bound by the terms and provision of this agreement. In addition, when using DevSync's particular services, you shall be subject to any posted guidelines or rules applicable to such services.</p><h2>2. Description of Service</h2><p>DevSync provides an integrated platform for agile planning and team communication. We provide the service 'AS IS' and 'AS AVAILABLE'. We assume no responsibility for the timeliness, deletion, mis-delivery, or failure to store any user communications or personalization settings.</p><h2>3. User Account, Password, and Security</h2><p>You will receive a password and account designation upon completing the Service's registration process. You are responsible for maintaining the confidentiality of the password and account and are fully responsible for all activities that occur under your password or account.</p><h2>4. Acceptable Use</h2><p>You agree to not use the Service to:</p><ul><li>Upload, post, email, transmit or otherwise make available any content that is unlawful, harmful, threatening, abusive, harassing, tortious, defamatory, vulgar, obscene, libelous, invasive of another's privacy, hateful, or racially, ethnically or otherwise objectionable.</li><li>Impersonate any person or entity.</li><li>Interfere with or disrupt the Service or servers or networks connected to the Service.</li></ul><h2>5. Modifications to Service</h2><p>DevSync reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice.</p><h2>6. Termination</h2><p>You agree that DevSync may, under certain circumstances and without prior notice, immediately terminate your DevSync account and access to the Service. Cause for such termination shall include, but not be limited to, breaches or violations of the Terms of Service or other incorporated agreements or guidelines.</p>
        </div>
      </div>
    </div>
  );
}
