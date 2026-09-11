import { Link } from 'react-router-dom';

export function AboutUsPage() {
  return (
    <div className='min-h-svh bg-[#08080A] text-zinc-100 py-20 px-6'>
      <div className='max-w-3xl mx-auto'>
        <Link to='/' className='text-primary hover:underline mb-8 inline-block'>&larr; Back to Home</Link>
        <h1 className='text-4xl font-bold mb-8'>About Us</h1>
        <div className='prose prose-invert prose-zinc max-w-none prose-a:text-primary hover:prose-a:text-primary/80 prose-headings:text-zinc-100 prose-p:text-zinc-400 prose-li:text-zinc-400'>
          <p className='text-sm text-zinc-500 font-medium'>Last updated: 11/9/2026</p>
          <p className='text-xl leading-relaxed text-zinc-300'>DevSync was born out of a simple frustration: the tab you keep switching to is the problem.</p><h2>Our Story</h2><p>We noticed that engineering teams were spending too much time bridging the gap between their issue trackers and their chat applications. A tracker records that something changed. A chat app records why. Keeping them apart means every decision lives in one tool and every task in another, and the person who needs both has to reconstruct the story from scratch.</p><p>We built DevSync to collapse that seam. We store the task and the conversation in one schema, so a message can reference a card and a card can show the discussion that produced it. There is no integration to configure and nothing to keep in sync, because there is only one system.</p><h2>Our Mission</h2><p>Our mission is to help teams ship faster by reducing context switching and keeping everyone aligned. We believe that when the conversation lives next to the work, standups get shorter, context is preserved, and teams can focus on what they do best: building great software.</p><h2>The Team</h2><p>We are a small, dedicated team of engineers and designers who are passionate about building tools that get out of your way. We operate globally and are always looking for talented individuals to join our mission.</p>
        </div>
      </div>
    </div>
  );
}
