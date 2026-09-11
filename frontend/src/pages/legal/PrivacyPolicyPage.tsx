import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Privacy Policy</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2>1. Introduction</h2>
          <p>Welcome to DevSync. We respect your privacy and are committed to protecting your personal data. This privacy policy will inform you about how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
          
          <h2>2. Information We Collect</h2>
          <p>We may collect, use, store, and transfer different kinds of personal data about you, including:</p>
          <ul>
            <li><strong>Identity Data:</strong> First name, last name, username.</li>
            <li><strong>Contact Data:</strong> Email address.</li>
            <li><strong>Technical Data:</strong> IP address, browser type and version, time zone setting and location, browser plug-in types and versions, operating system and platform.</li>
            <li><strong>Usage Data:</strong> Information about how you use our website and services, including chat logs and project data.</li>
          </ul>
          
          <h2>3. How We Use Your Information</h2>
          <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
          <ul>
            <li>To register you as a new user.</li>
            <li>To provide and maintain our Service.</li>
            <li>To manage our relationship with you.</li>
            <li>To improve our website, products/services, marketing or customer relationships.</li>
          </ul>

          <h2>4. Third-Party Subprocessors and AI Processing</h2>
          <p>We use specific third-party service providers (subprocessors) to deliver the DevSync platform. We maintain Data Processing Agreements (DPAs) with each of these providers to ensure your data is handled securely and in compliance with global privacy laws.</p>
          <ul>
            <li>
              <strong>Google Gemini (AI Processing):</strong> DevSync utilizes Google Gemini to provide intelligent features like sprint retrospectives, task duration estimates, and CI failure summaries. 
              <strong>Data Scope:</strong> The Gemini API receives strictly scoped data required for the task. For example, sprint summaries only receive task titles, generic statuses, and assignee names. CI failure summaries only receive the final few thousand characters of anonymized build logs.
              <strong>Privacy Guarantee:</strong> We explicitly ensure our AI prompts do NOT expose user email addresses, private chat logs, or non-essential personal data. Google does not use data submitted via the Gemini API to train their foundational models.
            </li>
            <li>
              <strong>Supabase (Database & Storage):</strong> We use Supabase for our core database and file storage infrastructure. Supabase stores user account data, workspace configurations, chat messages, and uploaded files. Supabase operates under strict SOC2 compliance and encrypts data at rest and in transit.
            </li>
            <li>
              <strong>SendGrid (Email Provider):</strong> We use Twilio SendGrid to send transactional emails (like password resets and workspace invitations). SendGrid receives the recipient's email address and name solely for the purpose of delivering these messages.
            </li>
            <li>
              <strong>GitHub (OAuth & Integrations):</strong> If you connect GitHub, DevSync uses OAuth tokens strictly to read your repositories for CI/CD status and PR synchronization. Tokens are securely encrypted and DevSync only accesses the repositories you explicitly authorize. We do not store your source code.
            </li>
          </ul>
          
          <h2>5. Data Retention Policy</h2>
          <p>We will only retain your personal data for as long as reasonably necessary to fulfill the purposes we collected it for, including for the purposes of satisfying any legal, regulatory, tax, accounting, or reporting requirements. We may retain your personal data for a longer period in the event of a complaint or if we reasonably believe there is a prospect of litigation in respect to our relationship with you.</p>
          
          <h2>6. Your Legal Rights</h2>
          <p>Under certain circumstances, you have rights under data protection laws in relation to your personal data, including the right to request access, correction, erasure, restriction, transfer, to object to processing, to portability of data, and (where the lawful ground of processing is consent) to withdraw consent.</p>
          
          <h2>7. Grievance Officer / Data Protection Contact</h2>
          <p>We have appointed a data privacy manager who is responsible for overseeing questions in relation to this privacy policy. If you have any questions about this privacy policy, including any requests to exercise your legal rights, please contact them using the details set out below:</p>
          <p>Email: <a href='mailto:privacy@devsync.app' className='text-primary hover:underline'>privacy@devsync.app</a></p>
          <p>Or visit our <Link to='/contact-us' className='text-primary hover:underline'>Contact Us</Link> page.</p>
        </div>
      </div>
    </div>
  );
}
