"use client"

import { useSession } from "next-auth/react"
import Link from "next/link"

export default function Home() {
  const { data: session, status } = useSession()

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold text-center">
          Direct Fan Platform
        </h1>
        <div className="flex items-center space-x-4">
          {status === "loading" ? (
            <div>Loading...</div>
          ) : session ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm">Welcome, {session.user.name}</span>
              <Link
                href={session.user.role === "ARTIST" ? "/dashboard/artist" : "/dashboard/fan"}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Dashboard
              </Link>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/signin"
                className="text-indigo-600 hover:text-indigo-500 font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex place-items-center">
        <div className="text-center">
          <h2 className="mb-3 text-2xl font-semibold">
            Welcome to the Direct Fan Platform
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Connect artists with their superfans through exclusive content and subscriptions.
          </p>
          {!session && (
            <div className="mt-6 space-x-4">
              <Link
                href="/auth/signup"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-4 lg:text-left">
        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            For Artists
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Create subscription tiers and upload exclusive content for your fans.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            For Fans
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Discover artists and support them with flexible subscription pricing.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            Secure Payments
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Powered by Stripe with daily payouts for artists.
          </p>
        </div>

        <div className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100">
          <h2 className="mb-3 text-2xl font-semibold">
            Community
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Build superfan communities with exclusive content access.
          </p>
        </div>
      </div>
    </main>
  )
}