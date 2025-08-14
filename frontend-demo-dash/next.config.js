/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ Removed 'output: export' for Render deployment
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    // ✅ Fixed: Use correct Flask backend port and URL
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  }
}

module.exports = nextConfig