// app/matches/layout.tsx
import NetworkingLayout from '@/components/NetworkingLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <NetworkingLayout active="research">{children}</NetworkingLayout>
}
