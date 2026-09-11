import { Link } from 'react-router-dom';

export function ContactUsPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Contact Us</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <p>We'd love to hear from you. Whether you have a question about features, trials, pricing, need a demo, or anything else, our team is ready to answer all your questions.</p><div className='grid grid-cols-1 md:grid-cols-2 gap-8 mt-12'><div className='bg-white/5 border border-white/10 p-6 rounded-xl'><h3 className='text-xl font-semibold text-white mb-2'>Support</h3><p className='text-zinc-400 mb-4'>Need help with DevSync? We're here to help.</p><a href='mailto:support@devsync.app' className='text-primary hover:underline font-medium'>support@devsync.app</a></div><div className='bg-white/5 border border-white/10 p-6 rounded-xl'><h3 className='text-xl font-semibold text-white mb-2'>Sales</h3><p className='text-zinc-400 mb-4'>Questions about pricing or enterprise plans?</p><a href='mailto:sales@devsync.app' className='text-primary hover:underline font-medium'>sales@devsync.app</a></div></div><h2 className='mt-12'>Grievance Officer</h2><p>In accordance with the Digital Personal Data Protection (DPDP) Act, the name and contact details of the Grievance Officer are provided below:</p><ul className='list-none pl-0 mt-4 border-l-2 border-primary/50 pl-4'><li><strong>Entity:</strong> DevSync (Data Fiduciary)</li><li><strong>Email:</strong> <a href='mailto:privacy@devsync.app' className='text-primary hover:underline'>privacy@devsync.app</a></li><li><strong>Registered Address:</strong> [Insert Registered Indian Business Address Here]</li></ul><p className='mt-4'>We will try to resolve your grievances within 30 days from the date of receipt of the grievance.</p>
        </div>
      </div>
    </div>
  );
}
