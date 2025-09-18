'use client';

import { useEffect, useState } from 'react';
import Breadcrumbs from './breadcrumbs';

export default function ClientBreadcrumbs() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Only render the Breadcrumbs on the client side to avoid SSR issues with useSession
  if (!isClient) {
    return null; // Don't render anything server-side
  }

  return <Breadcrumbs />;
}