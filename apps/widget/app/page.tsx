import Link from 'next/link';

export default function WidgetErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-sm border p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Missing Instance ID</h1>
          <p className="text-gray-600 mb-6">
            Adventure URLs require an instance ID. Please include the instance ID in your URL.
          </p>
          
          <div className="bg-gray-100 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-gray-900 mb-2">Correct URL format:</p>
            <code className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
              /adventure/[your-instance-id]
            </code>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-gray-500">
              If you&apos;re trying to test an adventure, you need the instance ID from your designer app.
            </p>
            <Link 
              href="https://adventure.app"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Go to Designer App
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 
