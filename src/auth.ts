import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { Role } from '@/generated/prisma/enums';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      avenueId: string | null;
      boardPositionId: string | null;
      isActive: boolean;
    } & DefaultSession['user'];
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as never,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  providers: [
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            // The club's board is pre-created by an admin; Google login just
            // links to the existing record with the same email.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.isActive || user.deletedAt) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      // Unknown Google accounts are only admitted if listed as bootstrap admins.
      if (!existing && !superAdminEmails().includes(email)) return '/login?error=not_a_member';
      if (existing && (!existing.isActive || existing.deletedAt)) return '/login?error=inactive';
      if (!existing && superAdminEmails().includes(email)) return true;
      return true;
    },
    async jwt({ token, user, trigger }) {
      const email = (user?.email ?? token.email ?? '').toLowerCase();
      if (!email) return token;
      if (user || trigger === 'update' || !token.role) {
        let record = await prisma.user.findUnique({ where: { email } });
        if (record && superAdminEmails().includes(email) && record.role !== 'SUPER_ADMIN') {
          record = await prisma.user.update({ where: { id: record.id }, data: { role: 'SUPER_ADMIN' } });
        }
        if (record) {
          token.sub = record.id;
          token.name = record.name;
          token.picture = record.image ?? undefined;
          token.role = record.role;
          token.avenueId = record.avenueId;
          token.boardPositionId = record.boardPositionId;
          token.isActive = record.isActive;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? '';
        session.user.role = (token.role as Role) ?? 'VIEWER';
        session.user.avenueId = (token.avenueId as string | null) ?? null;
        session.user.boardPositionId = (token.boardPositionId as string | null) ?? null;
        session.user.isActive = (token.isActive as boolean) ?? true;
      }
      return session;
    },
  },
});

export const isGoogleEnabled = googleConfigured;
