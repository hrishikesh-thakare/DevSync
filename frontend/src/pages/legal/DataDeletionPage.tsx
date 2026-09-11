import { Link } from 'react-router-dom';

export function DataDeletionPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>Data Deletion / Account Deletion</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <p>At DevSync, we believe that your data is yours. You have the right to request the deletion of your personal data and account at any time.</p><h2>How to Delete Your Account</h2><p>The fastest and easiest way to delete your account is directly through the DevSync application:</p><ol className='list-decimal pl-6 space-y-2 mt-4 mb-8'><li>Log in to your DevSync account.</li><li>Click on your profile avatar in the bottom left of the sidebar and select <strong>Account Settings</strong>.</li><li>Scroll down to the <strong>Danger Zone</strong> section.</li><li>Click on the <strong>Delete Account</strong> button.</li><li>You will be prompted to type your email address to confirm the deletion.</li></ol><div className='bg-red-500/10 border border-red-500/20 rounded-xl p-4 my-8'><h3 className='text-red-400 font-semibold m-0 mb-2'>Warning: Permanent Action</h3><p className='text-sm text-red-200/80 m-0'>Deleting your account is permanent and cannot be undone. It will instantly revoke all active sessions, remove your access to all workspaces, and permanently delete your personal information from our databases.</p></div><h2>Requesting Manual Data Deletion</h2><p>If you no longer have access to your account, or if you prefer to have our support team handle the deletion, you can submit a manual data deletion request.</p><p>Please send an email to <a href='mailto:privacy@devsync.app' className='text-primary hover:underline'>privacy@devsync.app</a> from the email address associated with your DevSync account, with the subject line <strong>'Account Deletion Request'</strong>. We will process your request within 14 days.</p><h2>What Data is Retained?</h2><p>When you delete your account, your personal identifying information is removed. However, to maintain the integrity of shared workspaces, messages you sent in channels and tasks you created or modified in projects you do not own will remain, but will be attributed to a 'Deleted User' to protect your privacy.</p>
        </div>
      </div>
    </div>
  );
}
