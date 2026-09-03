import type { Role } from '@/generated/prisma/enums';
import 'next-auth/jwt';

declare module 'next-auth/jwt' {
  interface JWT {
    role?: Role;
    avenueId?: string | null;
    boardPositionId?: string | null;
    isActive?: boolean;
  }
}
