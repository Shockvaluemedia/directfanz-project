'use client';

import { useState } from 'react';

export default function TestPage() {
  const [clicked, setClicked] = useState(false);

  const handleClick = () => {
    console.log('Button clicked - JavaScript is working!');
    setClicked(true);
    alert('JavaScript is working!');
  };

  console.log('TestPage component rendered');

  return (
    <div className='p-8'>
      <h1 className='text-2xl font-bold mb-4'>JavaScript Test Page</h1>
      <button onClick={handleClick} className='bg-blue-500 text-white px-4 py-2 rounded'>
        Test JavaScript ({clicked ? 'Clicked!' : 'Not clicked'})
      </button>
      <p className='mt-4'>Check the console for logs.</p>
    </div>
  );
}
