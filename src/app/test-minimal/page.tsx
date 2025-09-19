'use client';

export default function TestMinimalPage() {
  console.log('TestMinimalPage is rendering');

  const handleClick = () => {
    console.log('Minimal test button clicked!');
    alert('Minimal test works!');
  };

  return (
    <div>
      <h1>Minimal Test</h1>
      <button onClick={handleClick}>Click Me</button>
      <p>If you can click the button above, React is working.</p>
    </div>
  );
}
