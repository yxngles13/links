// app/network/layout.tsx
import NetworkingLayout from '@/components/NetworkingLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <NetworkingLayout active="network">{children}</NetworkingLayout>
}
