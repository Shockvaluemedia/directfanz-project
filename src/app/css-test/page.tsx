export default function CSSTest() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'>
      <div className='bg-white rounded-lg shadow-2xl p-8 max-w-md'>
        <h1 className='text-3xl font-bold text-gray-900 mb-4'>CSS Test</h1>
        <p className='text-gray-600 mb-6'>
          If you can see this styled properly, Tailwind CSS is working!
        </p>
        <div className='flex space-x-4'>
          <div className='w-4 h-4 bg-red-500 rounded-full'></div>
          <div className='w-4 h-4 bg-green-500 rounded-full'></div>
          <div className='w-4 h-4 bg-blue-500 rounded-full'></div>
        </div>
        <button className='mt-6 w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors'>
          Test Button
        </button>
      </div>
    </div>
  );
}
