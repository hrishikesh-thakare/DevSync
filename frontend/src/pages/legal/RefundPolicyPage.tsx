import { Link } from 'react-router-dom';

export function RefundPolicyPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Refund & Cancellation Policy</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <h2>1. Subscriptions</h2><p>Some parts of the Service are billed on a subscription basis ('Subscription(s)'). You will be billed in advance on a recurring and periodic basis ('Billing Cycle'). Billing cycles are set either on a monthly or annual basis, depending on the type of subscription plan you select when purchasing a Subscription.</p><h2>2. Free Trial</h2><p>DevSync may, at its sole discretion, offer a Subscription with a free trial for a limited period of time. You may be required to enter your billing information in order to sign up for the Free Trial.</p><h2>3. Cancellation</h2><p>You may cancel your Subscription renewal either through your online account management page or by contacting DevSync customer support team. You will not receive a refund for the fees you already paid for your current Billing Cycle and you will be able to access the Service until the end of your current Billing Cycle.</p><h2>4. Refunds</h2><p>We issue refunds for Subscriptions within <strong>14 days</strong> of the original purchase of the Subscription. If 14 days have passed since your purchase, we will not offer you a refund or exchange.</p><p>To request a refund, please contact us at <a href='mailto:support@devsync.app' className='text-primary hover:underline'>support@devsync.app</a> with your account details.</p>
        </div>
      </div>
    </div>
  );
}
