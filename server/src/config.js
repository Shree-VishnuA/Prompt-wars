export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  serverSecret: process.env.SERVER_SECRET || 'dev-secret-change-me',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  clientOrigin: process.env.CLIENT_ORIGIN || '',
  isDev: (process.env.NODE_ENV || 'development') === 'development'
};
