# NeuralBiz Backend - Authentication Module Setup

This document provides setup instructions for the NeuralBiz Authentication Module backend built with NestJS, GraphQL (Apollo), Prisma, and PostgreSQL.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v15 or higher)
- npm or yarn

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy the `.env.example` file to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
   
   Update the following variables in `.env`:
   - `DATABASE_URL`: Your PostgreSQL connection string
   - `JWT_SECRET`: A secure secret key for JWT signing (change in production)
   - `JWT_EXPIRES_IN`: Access token expiration time (default: 15m)
   - `REFRESH_TOKEN_EXPIRES_IN`: Refresh token expiration time (default: 7d)
   - SMTP configuration (optional - if not configured, verification codes will be logged to console)

3. **Set up the database:**
   ```bash
   # Generate Prisma Client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   ```

   This will create the necessary tables in your PostgreSQL database.

## Running the Application

### Development Mode
```bash
npm run start:dev
```
The GraphQL playground will be available at `http://localhost:3000/graphql`

### Production Mode
```bash
# Build the application
npm run build

# Start the production server
npm run start:prod
```

## GraphQL Schema

The backend implements the following GraphQL contract:

### Types
```graphql
type User {
  id: ID!
  fullName: String!
  email: String!
  phoneNumber: String
  country: String
  location: String
  interests: [String!]!
  status: String
  emailVerified: Boolean
  phoneVerified: Boolean
}

type AuthPayload {
  accessToken: String
  refreshToken: String
  verificationRequired: Boolean
  message: String
  user: User!
}
```

### Mutations
1. **register(input: { fullName: String!, email: String!, phoneNumber: String! })** → AuthPayload
   - Creates a user in PENDING state and sends verification code
   - Returns verificationRequired: true

2. **verifyRegistration(input: { userId: String!, code: String! })** → AuthPayload
   - Validates the verification code and marks email as verified

3. **resendVerificationCode(input: { userId: String, email: String })** → AuthPayload
   - Resends verification code for a pending user

4. **completePasswordSetup(input: { userId: String!, password: String! })** → AuthPayload
   - Sets the user's password after email verification

5. **completeProfile(input: { userId: String!, fullName: String!, country: String, location: String, interests: [String!] })** → AuthPayload
   - Completes user profile during onboarding or updates profile for authenticated users

6. **login(input: { identifier: String!, password: String! })** → AuthPayload
   - Authenticates user and returns access/refresh tokens

7. **refreshSession(input: { refreshToken: String! })** → AuthPayload
   - Exchanges a valid refresh token for new access/refresh tokens

8. **logout(input: { refreshToken: String! })** → String
   - Invalidates the given refresh token

### Queries
1. **me** → User!
   - Returns the current authenticated user
   - Requires `Authorization: Bearer <accessToken>` header

## Authentication Flow

1. **Registration**: User provides name, email, phone → creates PENDING user, sends verification code
2. **Email Verification**: User enters verification code → marks email as verified
3. **Password Setup**: User sets password → stores hashed password
4. **Profile Completion**: User completes profile → marks account as ACTIVE
5. **Login**: User provides credentials → returns access and refresh tokens
6. **Token Refresh**: Use refresh token to get new access token when expired
7. **Logout**: Invalidate refresh token on server

## Database Schema

The application uses three main Prisma models:

- **User**: Stores user information and authentication status
- **RefreshToken**: Stores valid refresh tokens for session management
- **VerificationCode**: Stores verification codes for email/phone verification

## Email Configuration

The email service supports two modes:

1. **SMTP Mode**: Configure SMTP variables in `.env` to send real emails
2. **Dev Mode**: If SMTP is not configured, verification codes are logged to the console

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check that `DATABASE_URL` in `.env` is correct
- Verify database exists and user has proper permissions

### Build Errors
- Run `npm run prisma:generate` to regenerate Prisma Client
- Ensure TypeScript is properly installed: `npm install -D typescript@^6`

### Migration Issues
- If migrations fail, you can reset the database (WARNING: deletes all data):
  ```bash
  npx prisma migrate reset
  ```

## Security Notes

- Change `JWT_SECRET` in production to a strong, random value
- Use HTTPS in production
- Configure proper SMTP settings for email verification in production
- Keep refresh token expiration reasonable (default: 7 days)
- The app does not crash if SMTP is not configured (falls back to console logging)

## Development Tools

- **Prisma Studio**: View and edit database data
  ```bash
  npm run prisma:studio
  ```

- **GraphQL Playground**: Interactive GraphQL explorer available at `/graphql` when running in dev mode

## Contract Verification

This backend implements the exact GraphQL contract specified:
- All mutation names match exactly (register, verifyRegistration, resendVerificationCode, etc.)
- All field names and types match the User and AuthPayload types
- All argument names and nullability match the specification
- The `logout` mutation returns a plain String (not wrapped in AuthPayload)
- The `me` query requires Bearer token authentication

No deviations from the contract have been made.
