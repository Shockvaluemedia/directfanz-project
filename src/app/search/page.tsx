import AdvancedSearchEngine from '@/components/search/AdvancedSearchEngine';
import { generateMetadata as generateSEO } from '@/lib/seo';

export const metadata = generateSEO({
  title: 'Search & Discovery',
  description: 'Discover amazing artists and exclusive content on DirectFanz.',
  url: '/search',
});

export default function SearchPage() {
  return <AdvancedSearchEngine />;
}
