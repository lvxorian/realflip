/// <reference types="next" />
/// <reference types="next/types/global" />

declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    AUTH_SECRET: string;
    AUTH_URL?: string;
    AUTH_GOOGLE_ID?: string;
    AUTH_GOOGLE_SECRET?: string;
    OPENAI_API_KEY?: string;
    REDIS_URL?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    INVESTOR_ONLY?: string;
    NEXT_PUBLIC_INVESTOR_PORTAL_URL?: string;
    NEXT_PUBLIC_INVESTOR_BRAND?: string;
    NEXT_PUBLIC_APP_URL: string;
    NEXT_PUBLIC_APP_NAME: string;
  }
}
