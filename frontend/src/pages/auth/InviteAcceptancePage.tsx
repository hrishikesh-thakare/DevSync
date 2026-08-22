import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../lib/api.js';
import { Loader2, CheckCircle2, XCircle, UserPlus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const InviteAcceptancePage = () => {
  const { inviteToken } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const acceptInvite = async () => {
    setStatus('loading');
    try {
      // Depending on the backend implementation, inviteToken might be the workspace slug
      // For DevSync, we updated the backend to use /workspaces/:slug/invites/accept
      await apiFetch(`/workspaces/${inviteToken}/invites/accept`, { method: 'POST' });
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans text-foreground p-4">
      <div className="bg-card border border-border rounded-lg p-10 max-w-[400px] w-full text-center shadow-md relative overflow-hidden">
        {/* Decorator */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-foreground/5 rounded-full blur-[40px] pointer-events-none"></div>

        {status === 'idle' && (
          <div className="py-2">
            <div className="w-16 h-16 bg-primary-muted text-primary border border-primary-border rounded-lg flex items-center justify-center mx-auto mb-6">
              <UserPlus className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-heading font-[590] text-foreground mb-2">Workspace Invitation</h2>
            <p className="text-ui text-muted-foreground mb-8">
              You've been invited to join the workspace <strong className="text-foreground">{inviteToken}</strong>.
            </p>
            <div className="space-y-3">
              <Button 
                onClick={acceptInvite}
                variant="primary"
                className="w-full py-3 bg-primary hover:bg-primary-hover text-primary-foreground font-[590] rounded-lg transition-colors flex items-center justify-center h-auto"
              >
                Accept Invitation
              </Button>
              <Button 
                onClick={() => navigate('/workspaces')}
                variant="ghost"
                className="w-full py-3 bg-transparent hover:bg-hover text-muted-foreground font-[510] rounded-lg transition-colors h-auto"
              >
                Decline & Return Home
              </Button>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div className="py-6">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-6" strokeWidth={1.5} />
            <h2 className="text-heading font-[590] text-foreground mb-2">Accepting Invitation...</h2>
            <p className="text-muted-foreground">Please wait while we set up your workspace access.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <div className="w-16 h-16 bg-success-muted text-success border border-success-border rounded-lg flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-heading font-[590] text-foreground mb-2">Invite Accepted</h2>
            <p className="text-muted-foreground mb-8">Your invitation has been accepted. You can now access all projects and channels.</p>
            <Button 
              onClick={() => navigate(`/w/${inviteToken}`)}
              variant="primary"
              className="w-full py-3 bg-primary text-primary-foreground font-[590] rounded-lg flex items-center justify-center gap-2 hover:bg-primary-hover transition-colors h-auto"
            >
              <span>Go to Workspace</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <div className="w-16 h-16 bg-danger-muted text-danger border border-danger-border rounded-lg flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8" strokeWidth={1.5} />
            </div>
            <h2 className="text-heading font-[590] text-foreground mb-2">Invalid or Expired Invite</h2>
            <p className="text-muted-foreground mb-8">This invitation link is no longer valid. Please ask your administrator to send a new one.</p>
            <Button 
              onClick={() => navigate('/workspaces')}
              variant="secondary"
              className="w-full py-3 bg-hover hover:bg-hover text-foreground font-[590] rounded-lg transition-colors h-auto"
            >
              Return to Dashboard
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
