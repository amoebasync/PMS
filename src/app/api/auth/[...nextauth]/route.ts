import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "missing",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "missing",
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const hash = crypto.createHash('sha256').update(credentials.password).digest('hex');
        
        const contact = await prisma.customerContact.findFirst({
          where: { email: credentials.email, passwordHash: hash },
          include: { customer: true }
        });
        
        if (contact && contact.customer.status !== 'INVALID') {
          // ★ 変更: lastName と firstName を結合して返す
          return { id: contact.id.toString(), name: `${contact.lastName} ${contact.firstName}`, email: contact.email, company: contact.customer.name };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: '/portal/login',
    newUser: '/portal/signup',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        if (account.provider === 'google') {
          try {
            let contact = await prisma.customerContact.findFirst({
              where: { email: user.email! },
              include: { customer: true }
            });
            
            if (!contact) {
              const customerCode = `EC${Date.now()}`;
              
              // ★ Googleのアカウント名 (例: "Taro Yamada") をスペースで「姓」と「名」に分割する
              const nameParts = (user.name || 'Google User').split(' ');
              const firstName = nameParts[0] || 'User';
              const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Google';

              const customer = await prisma.customer.create({
                data: {
                  customerCode,
                  customerType: 'INDIVIDUAL', // Google連携は一旦「個人」として登録
                  name: user.name || 'Google登録ユーザー',
                  nameKana: null, // ★ ダミーカナを廃止し null に
                  contacts: {
                    create: {
                      lastName: lastName,
                      firstName: firstName,
                      email: user.email!,
                      isPrimary: true,
                    }
                  }
                },
                include: { contacts: true }
              });
              
              contact = Object.assign({}, customer.contacts[0], { customer });
            }
            
            token.id = contact.id.toString();
            token.company = contact.customer.name;
            // ユーザー名もトークンに保持させておく
            token.name = `${contact.lastName} ${contact.firstName}`;
            
          } catch (e) {
            console.error("Google Auth DB Registration Error:", e);
          }
        } else if (account.provider === 'credentials') {
          token.id = user.id;
          token.company = (user as any).company;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).company = token.company;
        if (token.name) {
          session.user.name = token.name;
        }
      }
      return session;
    }
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_dev",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };