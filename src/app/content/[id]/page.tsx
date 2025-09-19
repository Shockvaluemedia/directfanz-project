import { ContentViewer } from '@/components/media/ContentViewer';
import { redirect } from 'next/navigation';

interface ContentPageProps {
  params: {
    id: string;
  };
}

export const metadata = {
  title: 'Content | Nahvee Even',
  description: 'View exclusive content from your favorite artists',
};

export default function ContentPage({ params }: ContentPageProps) {
  const { id } = params;

  const handleSubscribe = (tierId: string) => {
    // Redirect to subscription flow
    redirect(`/subscribe/${tierId}`);
  };

  return (
    <div className='container mx-auto px-4 py-8'>
      <ContentViewer contentId={id} onSubscribe={handleSubscribe} className='max-w-4xl mx-auto' />
    </div>
  );
}
