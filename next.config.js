/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'tesseract.js'] },
  serverExternalPackages: ['tesseract.js'],
}
module.exports = nextConfig
