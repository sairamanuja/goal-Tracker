import NextAuth from "next-auth";
import AzureAD from "next-auth/providers/azure-ad";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  getDelegatedManagerEmail,
  getDelegatedRole,
  getAppTokenForTenant,
  getGraphUserManagerEmail,
  getGraphUserGroups,
} from "@/lib/graph";
import type { Role } from "@/generated/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      userId: string;
      department?: string | null;
    };
  }
  interface User {
    role?: Role;
    department?: string | null;
    userId?: string;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    AzureAD({
      clientId: process.env.AZURE_AD_CLIENT_ID ?? "",
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET ?? "",
      // Use AZURE_AD_TENANT_ID=common in .env to support personal MSA accounts,
      // Gmail-linked Microsoft accounts, and org (AAD) accounts simultaneously.
      // A specific tenant GUID here locks out personal accounts.
      // An empty string is treated as "common" via the || fallback.
      issuer: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID || "common"}/v2.0`,
      authorization: {
        params: {
          // CRITICAL: Only OIDC scopes here. Graph API scopes (User.Read, Mail.Read, etc.)
          // must NOT appear in the OIDC authorization_endpoint request.
          // The MSA consumer endpoint (login.live.com) does not accept Graph scopes
          // in the initial OIDC flow and returns `unauthorized_client` when they are present.
          // Graph API access uses a separate client-credentials app token (see graph.ts).
          scope: "openid profile email",
        },
      },
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          userId: user.id,
          department: user.department,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.department = user.department;
      }
      if (account?.provider === "azure-ad" && profile) {
        const email = (
          (profile.email as string | undefined) ??
          ((profile as Record<string, unknown>).preferred_username as string | undefined) ??
          ""
        );
        if (!email) return token;

        const name = (profile.name as string | undefined) ?? email;
        let managerEmail: string | null = null;
        let roleFromGraph: Role | null = null;

        // tid = actual tenant GUID from the ID token (always a real GUID, never "common")
        // oid = user's stable object ID in the tenant — correct key for Graph /users/{oid}/manager
        const p = profile as Record<string, unknown>;
        const tidClaim = p.tid as string | undefined;
        const oidClaim = p.oid as string | undefined;

        // Primary: app token with real tenant ID — works without User.Read in OIDC scope.
        // Requires User.Read.All + GroupMember.Read.All Application permissions in Azure portal.
        if (tidClaim && oidClaim) {
          try {
            const appToken = await getAppTokenForTenant(tidClaim);
            if (appToken) {
              managerEmail = await getGraphUserManagerEmail(oidClaim, appToken);
              const groups = await getGraphUserGroups(oidClaim, appToken);
              if (groups.includes("GoalTrack-Admins")) roleFromGraph = "ADMIN";
              else if (groups.includes("GoalTrack-Managers")) roleFromGraph = "MANAGER";
              else roleFromGraph = "EMPLOYEE";
            }
          } catch {
            // App token failed — try delegated token below
          }
        }

        // Fallback: delegated token (works if the user's token has User.Read permission)
        if (managerEmail === null) {
          try {
            const at = account.access_token as string | undefined;
            if (at) {
              managerEmail = await getDelegatedManagerEmail(at);
              if (roleFromGraph === null) roleFromGraph = await getDelegatedRole(at);
            }
          } catch {
            // Graph not reachable — fall back to DB role
          }
        }

        // Resolve manager in DB
        let managerId: string | null = null;
        if (managerEmail) {
          const mgr = await prisma.user.findUnique({
            where: { email: managerEmail },
            select: { id: true },
          });
          managerId = mgr?.id ?? null;
        }

        // Upsert user — create on first login, update on subsequent
        const dbUser = await prisma.user.upsert({
          where: { email },
          update: {
            entraId: account.providerAccountId,
            name,
            ...(managerId !== null ? { managerId } : {}),
            ...(roleFromGraph !== null ? { role: roleFromGraph } : {}),
          },
          create: {
            email,
            name,
            entraId: account.providerAccountId,
            role: roleFromGraph ?? "EMPLOYEE",
            managerId,
          },
        });

        token.userId = dbUser.id;
        token.role = dbUser.role;
        token.department = dbUser.department;
        token.email = dbUser.email;
        token.name = dbUser.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.userId = token.userId as string;
        session.user.role = token.role as Role;
        session.user.department = token.department as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
