import { Resolver, Mutation, Query, Args, Context } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import {
  AuthPayload,
  User,
  RegisterInput,
  VerifyRegistrationInput,
  ResendVerificationCodeInput,
  CompletePasswordSetupInput,
  CompleteProfileInput,
  LoginInput,
  RefreshSessionInput,
  LogoutInput,
} from './auth.types';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload)
  async register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input);
  }

  @Mutation(() => AuthPayload)
  async verifyRegistration(@Args('input') input: VerifyRegistrationInput): Promise<AuthPayload> {
    return this.authService.verifyRegistration(input);
  }

  @Mutation(() => AuthPayload)
  async resendVerificationCode(@Args('input') input: ResendVerificationCodeInput): Promise<AuthPayload> {
    return this.authService.resendVerificationCode(input);
  }

  @Mutation(() => AuthPayload)
  async completePasswordSetup(@Args('input') input: CompletePasswordSetupInput): Promise<AuthPayload> {
    return this.authService.completePasswordSetup(input);
  }

  @Mutation(() => AuthPayload)
  async completeProfile(@Args('input') input: CompleteProfileInput, @Context() context?: any): Promise<AuthPayload> {
    return this.authService.completeProfile(input, context?.req?.headers?.authorization);
  }

  @Mutation(() => AuthPayload)
  async login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input);
  }

  @Mutation(() => AuthPayload)
  async refreshSession(@Args('input') input: RefreshSessionInput): Promise<AuthPayload> {
    return this.authService.refreshSession(input);
  }

  @Mutation(() => String)
  async logout(@Args('input') input: LogoutInput): Promise<string> {
    return this.authService.logout(input);
  }

  @Query(() => User)
  async me(@Context() context: any): Promise<User> {
    return this.authService.me(context.req.headers.authorization);
  }
}
