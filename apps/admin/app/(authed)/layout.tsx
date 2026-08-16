import AdminSidebar from '@/components/layout/AdminSidebar';
import { UserProvider } from '@/lib/user-context';
import { PermissionGate } from '@/components/auth/PermissionGate';

export default function AuthedLayout({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 overflow-auto">
          <div className="p-8">
            <PermissionGate>{children}</PermissionGate>
          </div>
        </div>
      </div>
    </UserProvider>
  );
}
