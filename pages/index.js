import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-white to-gray-200 flex flex-col items-center justify-center">
      <div className="bg-white/80 rounded-2xl shadow-2xl p-10 max-w-2xl w-full flex flex-col items-center">
        <h1 className="text-4xl font-extrabold text-blue-700 mb-4 tracking-tight">Railway Section Controller Dashboard</h1>
        <p className="text-lg text-gray-700 mb-8 text-center">
          Welcome to the modern AI-powered railway traffic control system.<br/>
          Use the dashboard to monitor, optimize, and simulate train operations in real time.
        </p>
        <div className="flex flex-col gap-4 w-full">
          <Link href="/dashboard" legacyBehavior>
            <a className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-xl shadow transition">Go to Live Dashboard</a>
          </Link>
          <Link href="/simulation" legacyBehavior>
            <a className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg text-xl shadow transition">Go to Simulation Only</a>
          </Link>
        </div>
        <div className="mt-8 text-gray-500 text-sm">&copy; 2025 Indian Railways AI Section Control Demo</div>
      </div>
    </div>
  );
}
